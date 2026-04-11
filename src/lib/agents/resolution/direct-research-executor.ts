/**
 * Direct Research Executor (Production)
 *
 * Bypasses daemon/PTY layer and calls Anthropic API directly.
 * - Uses Claude with extended_thinking for complex research
 * - Enables web search via prompt instructions
 * - Returns structured JSON output
 * - Tracks costs and token usage
 * - Reliable, OS-independent
 */

import Anthropic from '@anthropic-ai/sdk';
import { tavily } from '@tavily/core';
import type { Gap } from '../debate-workflow';
import { readPersona } from '../persona-manager';

export interface ResearchResult {
  gap_id: string;
  state: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'UNRESOLVABLE';
  evidence?: string;
  sources?: string[];
  reason?: string;
  attempts: number;
  search_count: number;
  tokens_used?: number;
  cost_usd?: number;
}

interface ResearchMetrics {
  total_tokens: number;
  total_cost_usd: number;
  gaps_processed: number;
  resolution_rate: number;
}

export class DirectResearchExecutor {
  private anthropic: Anthropic;
  private tavilyClient: ReturnType<typeof tavily>;
  private metrics: ResearchMetrics = {
    total_tokens: 0,
    total_cost_usd: 0,
    gaps_processed: 0,
    resolution_rate: 0,
  };

  constructor(apiKey?: string, tavilyApiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.tavilyClient = tavily({
      apiKey: tavilyApiKey || process.env.TAVILY_API_KEY || '',
    });
  }

  /**
   * Execute research for all gaps
   */
  async execute(gaps: Gap[], runDir: string): Promise<Gap[]> {
    // Group by agent
    const agentGroups: Record<string, Gap[]> = {};
    for (const gap of gaps) {
      if (!agentGroups[gap.assigned_to]) {
        agentGroups[gap.assigned_to] = [];
      }
      agentGroups[gap.assigned_to].push(gap);
    }

    console.log('[Direct Research Executor] Agent workload:',
      Object.entries(agentGroups).map(([agent, gaps]) => `${agent}: ${gaps.length}`).join(', ')
    );

    // Execute in parallel
    const agentPromises = Object.entries(agentGroups).map(([agent, agentGaps]) =>
      this.executeAgentResearch(agent, agentGaps)
    );

    const results = await Promise.all(agentPromises);

    // Calculate metrics
    const resolvedCount = results.flat().filter(g => g.state === 'RESOLVED').length;
    this.metrics.gaps_processed = results.flat().length;
    this.metrics.resolution_rate = resolvedCount / this.metrics.gaps_processed;

    console.log('[Direct Research Executor] Metrics:', {
      gaps_processed: this.metrics.gaps_processed,
      resolved: resolvedCount,
      resolution_rate: `${(this.metrics.resolution_rate * 100).toFixed(1)}%`,
      tokens_used: this.metrics.total_tokens,
      cost_usd: `$${this.metrics.total_cost_usd.toFixed(4)}`,
    });

    return results.flat();
  }

  /**
   * Execute research for a specific agent's gaps
   */
  private async executeAgentResearch(agent: string, gaps: Gap[]): Promise<Gap[]> {
    console.log(`[${agent}] Resolving ${gaps.length} gaps via direct API...`);

    const resolvedGaps: Gap[] = [];

    for (const gap of gaps) {
      try {
        const result = await this.researchGap(agent, gap);
        resolvedGaps.push({
          ...gap,
          state: result.state,
          evidence: result.evidence,
          sources: result.sources,
          reason: result.reason,
          attempts: result.attempts,
        });
      } catch (error) {
        console.error(`[${agent}] Failed to research gap ${gap.gap_id}:`, error);
        resolvedGaps.push({
          ...gap,
          state: 'UNRESOLVABLE',
          reason: `API error: ${(error as Error).message}`,
          attempts: 1,
        });
      }
    }

    return resolvedGaps;
  }

  /**
   * Research a single gap via direct API call
   */
  private async researchGap(agent: string, gap: Gap): Promise<ResearchResult> {
    console.log(`[${agent}] Researching: ${gap.question.slice(0, 80)}...`);

    const persona = await readPersona(agent);
    if (!persona) {
      throw new Error(`Agent persona not found: ${agent}`);
    }

    // Step 1: Perform web search if needed
    let searchResults: string = '';
    let searchCount = 0;

    if (this.needsWebSearch(gap)) {
      console.log(`[${agent}] Performing web search...`);
      searchResults = await this.performWebSearch(gap);
      searchCount = (searchResults.match(/\[Source/g) || []).length;
      console.log(`[${agent}] Found ${searchCount} search results`);
    }

    const systemPrompt = this.buildSystemPrompt(agent, persona);
    const userPrompt = this.buildResearchPrompt(gap, searchResults);

    const startTime = Date.now();

    // Use Haiku for simple gaps, Sonnet 4.6 for complex ones
    const isComplexGap = this.isComplexGap(gap);
    const model = isComplexGap
      ? (process.env.COMPLEX_RESEARCH_MODEL || 'claude-sonnet-4-6')
      : (process.env.SIMPLE_RESEARCH_MODEL || 'claude-haiku-4-5');

    console.log(`[${agent}] Using ${model.includes('haiku') ? 'Haiku' : 'Sonnet'} (${isComplexGap ? 'complex' : 'simple'} gap)`);

    try {
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 2048, // Reduced from 4096 to prevent runaway costs
        temperature: 0.2, // Low temperature for factual research
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const elapsedMs = Date.now() - startTime;
      console.log(`[${agent}] API call completed in ${elapsedMs}ms`);

      // Track token usage
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      const costUsd = this.calculateCost(tokensUsed, model);
      this.metrics.total_tokens += tokensUsed;
      this.metrics.total_cost_usd += costUsd;

      // Parse response
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in API response');
      }

      const result = this.parseApiResponse(gap, textContent.text);
      result.tokens_used = tokensUsed;
      result.cost_usd = costUsd;
      result.search_count = searchCount;

      console.log(`[${agent}] Resolution: ${result.state} (${tokensUsed} tokens, $${costUsd.toFixed(4)}, ${searchCount} searches)`);

      return result;
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error(`[${agent}] Anthropic API error:`, error.status, error.message);
        throw new Error(`API error ${error.status}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build system prompt with agent persona and research instructions
   */
  private buildSystemPrompt(agent: string, persona: any): string {
    const personaContent = persona.content || `You are ${agent}, a specialized research agent.`;

    return `${personaContent}

# Research Task Instructions

You are conducting bounded research to resolve information gaps in a meme token intelligence brief.

Your goal is to find PRIMARY SOURCES that can definitively answer the research question.

## Research Quality Standards

1. **Primary Sources Only**
   - On-chain data (Solana/Ethereum explorers, RPC data)
   - Official project websites, GitHub repos, documentation
   - Direct social media accounts (verified Twitter/Discord)
   - Avoid aggregators, news sites, or third-party interpretations

2. **Evidence Requirements**
   - RESOLVED: Found primary source data that fully answers the question
   - PARTIALLY_RESOLVED: Found some data but gaps remain
   - UNRESOLVABLE: No primary sources available after exhaustive search

3. **Source Citation**
   - Always cite specific URLs
   - Prefer URLs you can verify (not "according to DexScreener")
   - For on-chain data, cite block explorer links with tx hashes

## Available Research Methods

You have access to web search. Use search queries strategically:
- Search for official project domains
- Look for verified social accounts
- Find on-chain data via block explorers
- Cross-reference multiple sources

## Output Format (CRITICAL)

You MUST respond with this EXACT format:

\`\`\`json
{
  "state": "RESOLVED|PARTIALLY_RESOLVED|UNRESOLVABLE",
  "evidence": "Specific findings from primary sources",
  "sources": ["https://url1.com", "https://url2.com"],
  "reason": "Why partially resolved or unresolvable (if applicable)",
  "search_count": 5
}
\`\`\`

No other output format will be accepted.`;
  }

  /**
   * Determine if gap needs web search
   */
  private needsWebSearch(gap: Gap): boolean {
    // Visual gaps might need search to find image URLs
    // Most other gaps need search to find primary sources
    return true; // For now, always search
  }

  /**
   * Perform web search and format results
   */
  private async performWebSearch(gap: Gap): Promise<string> {
    try {
      const searchQuery = this.buildSearchQuery(gap);
      console.log(`[Search] Query: "${searchQuery}"`);

      const response = await this.tavilyClient.search(searchQuery, {
        maxResults: 5,
        searchDepth: 'advanced',
        includeRawContent: false,
        includeAnswer: false,
      });

      if (!response.results || response.results.length === 0) {
        return 'No search results found.';
      }

      // Format search results for Claude
      let formatted = '# Web Search Results\n\n';
      response.results.forEach((result, index) => {
        formatted += `[Source ${index + 1}] ${result.title}\n`;
        formatted += `URL: ${result.url}\n`;
        formatted += `Content: ${result.content}\n\n`;
      });

      return formatted;
    } catch (error) {
      console.error('[Search] Error:', error);
      return `Search failed: ${(error as Error).message}`;
    }
  }

  /**
   * Build search query from gap
   */
  private buildSearchQuery(gap: Gap): string {
    // Extract key terms from question
    let query = gap.question
      .replace(/Can we verify:/gi, '')
      .replace(/\*\*/g, '')
      .trim();

    // Add context keywords based on gap type
    if (gap.blocking_claim.toLowerCase().includes('bonk')) {
      query = `BONK token ${query}`;
    }

    if (query.toLowerCase().includes('mascot') || query.toLowerCase().includes('character')) {
      query += ' official artwork';
    }

    if (query.toLowerCase().includes('dao')) {
      query += ' treasury governance';
    }

    return query.slice(0, 200); // Limit query length
  }

  /**
   * Build research prompt for specific gap
   */
  private buildResearchPrompt(gap: Gap, searchResults?: string): string {
    const isVisualGap = /visual|character|image|screenshot|design|mascot|logo|artwork|pfp/i.test(gap.question);

    const visualInstructions = isVisualGap ? `

**VISUAL RESEARCH INSTRUCTIONS:**
For visual/character gaps, you need to:
1. Find the official project website or social media
2. Locate actual images/artwork URLs
3. Describe what you see in the images (color, style, character traits)
4. Evaluate based on screenshot test criteria (3 audiences, remix potential)

If you cannot access images directly, mark as UNRESOLVABLE with reason "Image verification requires manual inspection".
` : '';

    return `# Research Gap

**Question:** ${gap.question}

**Context:** ${gap.blocking_claim}

**Your Role:** ${gap.assigned_to}
${visualInstructions}

**Task:**
1. ${searchResults ? 'Analyze the web search results below' : 'Use your knowledge to answer'}
2. Verify the information against multiple sources
3. Determine resolution state (RESOLVED/PARTIALLY_RESOLVED/UNRESOLVABLE)
4. Cite specific URLs for all evidence
${searchResults ? `\n---\n\n${searchResults}\n\n---\n` : ''}

Remember: No speculation. No aggregator citations. Primary sources only.

Respond with the JSON format specified in your system instructions.`;
  }

  /**
   * Parse API response and extract structured result
   */
  private parseApiResponse(gap: Gap, responseText: string): ResearchResult {
    // Try to extract JSON block from response
    const jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          gap_id: gap.gap_id,
          state: parsed.state as ResearchResult['state'],
          evidence: parsed.evidence,
          sources: parsed.sources,
          reason: parsed.reason,
          attempts: 1,
          search_count: parsed.search_count || 0,
        };
      } catch (error) {
        console.warn('Failed to parse JSON response, falling back to text parsing');
      }
    }

    // Fallback: text parsing (similar to old method)
    let state: ResearchResult['state'] = 'UNRESOLVABLE';
    let evidence = '';
    let sources: string[] = [];
    let reason = '';

    const stateMatch = responseText.match(/STATE:\s*(RESOLVED|PARTIALLY_RESOLVED|UNRESOLVABLE)/i) ||
      responseText.match(/"state":\s*"(RESOLVED|PARTIALLY_RESOLVED|UNRESOLVABLE)"/i);
    if (stateMatch) {
      state = stateMatch[1].toUpperCase() as ResearchResult['state'];
    }

    const evidenceMatch = responseText.match(/EVIDENCE:\s*\n([^\n]+)/i) ||
      responseText.match(/"evidence":\s*"([^"]+)"/i);
    if (evidenceMatch) {
      evidence = evidenceMatch[1].trim();
    }

    const urlRegex = /https?:\/\/[^\s"']+/g;
    const urlMatches = responseText.match(urlRegex);
    if (urlMatches) {
      sources = urlMatches.slice(0, 5); // Max 5 sources
    }

    const reasonMatch = responseText.match(/REASON:\s*\n([^\n]+)/i) ||
      responseText.match(/"reason":\s*"([^"]+)"/i);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
    }

    return {
      gap_id: gap.gap_id,
      state,
      evidence: evidence || undefined,
      sources: sources.length > 0 ? sources : undefined,
      reason: reason || undefined,
      attempts: 1,
      search_count: 0,
    };
  }

  /**
   * Calculate API cost
   * Pricing (as of 2025):
   * Sonnet 4.6: Input $3.00 / Output $15.00 per million tokens
   * Haiku 4.5: Input $1.00 / Output $5.00 per million tokens
   */
  private calculateCost(tokens: number, model: string = 'claude-sonnet-4-6'): number {
    const isHaiku = model.includes('haiku');

    // Pricing per million tokens (correct as of Jan 2025)
    const inputPrice = isHaiku ? 1.00 : 3.00;
    const outputPrice = isHaiku ? 5.00 : 15.00;

    // Rough estimate (assuming 50/50 split input/output)
    const inputTokens = tokens * 0.5;
    const outputTokens = tokens * 0.5;
    return (inputTokens * inputPrice / 1_000_000) + (outputTokens * outputPrice / 1_000_000);
  }

  /**
   * Determine if gap is complex (needs Sonnet) or simple (Haiku is fine)
   */
  private isComplexGap(gap: Gap): boolean {
    const question = gap.question.toLowerCase();

    // Simple gaps: Yes/no questions, existence checks, URL verification
    const simplePatterns = [
      /^is .* (official|real|authentic|legitimate)/,
      /^does .* exist/,
      /^can .* be verified/,
      /^is this (a|an) .* (site|website|page|link)/,
      /verify (that|if) .* (is|exists)/,
    ];

    // Check simple patterns first
    if (simplePatterns.some(pattern => pattern.test(question))) {
      return false; // Use Haiku (87% cheaper)
    }

    // Complex indicators: Analysis, quality judgments, comparisons
    const complexIndicators = [
      'how',
      'why',
      'analyze',
      'evaluate',
      'compare',
      'quality',
      'mechanism',
      'percentage',
      'what grants',
      'what is the documented',
    ];

    // If has complex indicator, use Sonnet
    if (complexIndicators.some(indicator => question.includes(indicator))) {
      return true; // Use Sonnet
    }

    // Default to Haiku for cost savings (most gaps are simple fact-checks)
    return false;
  }

  /**
   * Get research metrics
   */
  getMetrics(): ResearchMetrics {
    return { ...this.metrics };
  }
}
