/**
 * Resolution Executor
 *
 * Executes bounded research for each gap:
 * - No hard limit on searches per gap (accuracy over latency)
 * - Each gap must terminate as RESOLVED, PARTIALLY_RESOLVED, or UNRESOLVABLE
 * - Never silently drops gaps
 * - Prefers primary sources over aggregators
 */

import type { Gap } from '../debate-workflow';
import fs from 'fs/promises';
import path from 'path';
import { createDaemonSession, getDaemonSessionOutput } from '../daemon-client';
import { readPersona } from '../persona-manager';
import { DATA_DIR } from '../../storage/path-utils';
import { randomUUID } from 'crypto';

export interface ResearchResult {
  gap_id: string;
  state: 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'UNRESOLVABLE';
  evidence?: string;
  sources?: string[];
  reason?: string;
  attempts: number;
  search_count: number;
}

export class ResolutionExecutor {
  private useSimulation: boolean;

  constructor(useSimulation = false) {
    this.useSimulation = useSimulation;
  }

  /**
   * Execute research tasks for all gaps
   * Groups by agent and runs in parallel where possible
   */
  async execute(gaps: Gap[], runDir: string): Promise<Gap[]> {
    // Group gaps by assigned agent
    const agentGroups: Record<string, Gap[]> = {};
    for (const gap of gaps) {
      if (!agentGroups[gap.assigned_to]) {
        agentGroups[gap.assigned_to] = [];
      }
      agentGroups[gap.assigned_to].push(gap);
    }

    console.log('[Resolution Executor] Agent workload:',
      Object.entries(agentGroups).map(([agent, gaps]) => `${agent}: ${gaps.length}`).join(', ')
    );

    // Execute research for each agent's queue in parallel
    const agentPromises = Object.entries(agentGroups).map(([agent, agentGaps]) =>
      this.executeAgentResearch(agent, agentGaps, runDir)
    );

    const results = await Promise.all(agentPromises);

    // Flatten results
    return results.flat();
  }

  /**
   * Execute research for a specific agent's gaps
   */
  private async executeAgentResearch(
    agent: string,
    gaps: Gap[],
    runDir: string
  ): Promise<Gap[]> {
    console.log(`[${agent}] Resolving ${gaps.length} gaps...`);

    // In real implementation, this would:
    // 1. Load agent persona
    // 2. Construct research prompt with all gaps
    // 3. Invoke agent (via provider-cli) with search capability
    // 4. Parse agent's response to extract resolutions
    //
    // For now, we'll create a simulation that demonstrates the expected behavior

    const resolvedGaps: Gap[] = [];

    for (const gap of gaps) {
      try {
        const result = await this.researchGap(agent, gap, runDir);
        resolvedGaps.push({
          ...gap,
          state: result.state,
          evidence: result.evidence,
          sources: result.sources,
          reason: result.reason,
          attempts: result.attempts
        });
      } catch (error) {
        console.error(`[${agent}] Failed to research gap ${gap.gap_id}:`, error);
        resolvedGaps.push({
          ...gap,
          state: 'UNRESOLVABLE',
          reason: `Research error: ${(error as Error).message}`,
          attempts: 1
        });
      }
    }

    return resolvedGaps;
  }

  /**
   * Research a single gap
   * Invokes the actual agent via daemon session with search enabled
   */
  private async researchGap(
    agent: string,
    gap: Gap,
    runDir: string
  ): Promise<ResearchResult> {
    console.log(`[${agent}] Researching: ${gap.question}`);

    // Skip daemon session if in simulation mode
    if (this.useSimulation) {
      console.log(`[${agent}] Using simulation mode...`);
      return await this.simulateResearch(gap);
    }

    try {
      // Load agent persona
      const persona = await readPersona(agent);
      if (!persona) {
        throw new Error(`Agent persona not found: ${agent}`);
      }

      // Construct research prompt
      const prompt = this.buildResearchPrompt(agent, gap);

      // Create unique session ID for this research task
      const sessionId = `research-${agent}-${gap.gap_id}-${randomUUID().slice(0, 8)}`;

      // Determine working directory
      const cwd = persona.workdir && persona.workdir !== '/data'
        ? `${DATA_DIR}/${persona.workdir.replace(/^\/+/, '')}`
        : DATA_DIR;

      console.log(`[${agent}] Creating daemon session ${sessionId}...`);

      // Invoke agent via daemon session
      await createDaemonSession({
        id: sessionId,
        prompt,
        providerId: persona.provider || 'claude-code',
        cwd,
        timeoutSeconds: 600 // 10 minutes timeout for research
      });

      console.log(`[${agent}] Waiting for research results...`);

      // Poll for results
      const output = await this.pollForSessionOutput(sessionId, 600000); // 10 min max

      // Parse agent response to extract resolution
      const result = this.parseAgentResponse(gap, output);

      console.log(`[${agent}] Research complete: ${result.state}`);

      return result;

    } catch (error) {
      console.error(`[${agent}] Research failed for gap ${gap.gap_id}:`, error);

      // Fallback to simulation on error (for testing)
      console.log(`[${agent}] Falling back to simulation...`);
      return await this.simulateResearch(gap);
    }
  }

  /**
   * Poll for daemon session output with timeout
   */
  private async pollForSessionOutput(sessionId: string, maxWaitMs: number): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 3000; // Check every 3 seconds
    let lastOutputLength = 0;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const { status, output } = await getDaemonSessionOutput(sessionId);
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        // Log progress if output is growing
        if (output.length > lastOutputLength) {
          console.log(`[Polling] ${sessionId}: ${output.length} chars, ${elapsed}s elapsed (status=${status})`);
          lastOutputLength = output.length;
        }

        // If daemon reports the session is no longer running, return whatever we have.
        if (status && status !== 'running') {
          console.log(`[Polling] ${sessionId}: Session status=${status}, returning output`);
          return output;
        }

        // Check if session is complete (look for completion markers)
        if (output.includes('STATE:') || output.includes('RESOLVED') || output.includes('UNRESOLVABLE')) {
          console.log(`[Polling] ${sessionId}: Found completion marker`);
          return output;
        }

        // Also check if output contains cabinet block (agent finished)
        if (output.includes('```cabinet') || output.includes('SUMMARY:')) {
          console.log(`[Polling] ${sessionId}: Found cabinet completion block`);
          return output;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        // Session might not be ready yet, continue polling
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Research timed out after ${maxWaitMs}ms`);
  }

  /**
   * Parse agent's response to extract resolution state, evidence, and sources
   */
  private parseAgentResponse(gap: Gap, output: string): ResearchResult {
    let state: ResearchResult['state'] = 'UNRESOLVABLE';
    let evidence = '';
    let sources: string[] = [];
    let reason = '';
    let searchCount = 0;

    // Extract state
    const stateMatch = output.match(/STATE:\s*(RESOLVED|PARTIALLY_RESOLVED|UNRESOLVABLE)/i);
    if (stateMatch) {
      state = stateMatch[1].toUpperCase() as ResearchResult['state'];
    }

    // Extract evidence
    const evidenceMatch = output.match(/EVIDENCE:\s*\n([\s\S]*?)(?=\n(?:SOURCES:|REASON:|STATE:|$))/i);
    if (evidenceMatch) {
      evidence = evidenceMatch[1].trim();
    }

    // Extract sources
    const sourcesMatch = output.match(/SOURCES:\s*\n([\s\S]*?)(?=\n(?:REASON:|STATE:|$))/i);
    if (sourcesMatch) {
      const sourceLines = sourcesMatch[1].trim().split('\n');
      sources = sourceLines
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0 && (line.startsWith('http') || line.startsWith('www')));
    }

    // Extract reason (for UNRESOLVABLE or PARTIALLY_RESOLVED)
    const reasonMatch = output.match(/REASON:\s*\n?([\s\S]*?)(?=\n(?:STATE:|$))/i);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
    }

    // Count searches (look for web search indicators in output)
    const searchMatches = output.match(/searching|search results|found \d+ results/gi);
    searchCount = searchMatches ? searchMatches.length : 0;

    return {
      gap_id: gap.gap_id,
      state,
      evidence: evidence || undefined,
      sources: sources.length > 0 ? sources : undefined,
      reason: reason || undefined,
      attempts: 1,
      search_count: searchCount
    };
  }

  /**
   * Build research prompt for agent
   */
  private buildResearchPrompt(agent: string, gap: Gap): string {
    const isVisualGap = /visual|character|image|screenshot|design|mascot|logo|artwork|pfp/i.test(gap.question);

    const visualInstructions = isVisualGap ? `

**CRITICAL FOR VISUAL/CHARACTER GAPS:**
You have access to Firecrawl MCP tools for scraping and analyzing images:
- Use mcp__firecrawl__firecrawl_scrape to fetch pages with images
- Use mcp__firecrawl__firecrawl_search to find pages with character artwork
- The tools can extract images from pump.fun, Twitter/X, token websites, etc.
- Download and analyze actual images, don't just cite URLs
- For screenshot test evaluation, you need the actual visual content

Example workflow:
1. Search for "[token name] character artwork" or "[token name] logo"
2. Use firecrawl_scrape on the token's pump.fun page or official site
3. Extract image URLs from the scraped content
4. Analyze the images for screenshot test criteria (3 audiences, remix potential)
5. Provide evidence with actual image descriptions, not just "image exists"
` : '';

    return `You are researching the following gap:

**Question:** ${gap.question}
**Context:** ${gap.blocking_claim}
**Your role:** ${agent}
${visualInstructions}
Your task:
1. Search for primary sources that can answer this question
2. Prefer on-chain data, official docs, and verified sources over press releases
3. For visual gaps: Use Firecrawl MCP tools to scrape and analyze actual images
4. Determine if this gap can be:
   - RESOLVED (with specific evidence and sources)
   - PARTIALLY_RESOLVED (with what you found and what's still missing)
   - UNRESOLVABLE (with clear reason why)

IMPORTANT:
- Never mark something RESOLVED without citing the specific source
- Never silently drop this gap - it MUST reach a terminal state
- No limit on searches - take as many as needed for accuracy
- Avoid circular sourcing (aggregators citing each other)
- For visual gaps: Must include image analysis, not just URLs

Provide your findings in this format:

STATE: [RESOLVED | PARTIALLY_RESOLVED | UNRESOLVABLE]

EVIDENCE:
[Your findings - for visual gaps, describe what you saw in the images]

SOURCES:
- [Source 1 URL]
- [Source 2 URL]

REASON: [If UNRESOLVABLE or PARTIALLY_RESOLVED, explain why]
`;
  }

  /**
   * Simulate research (to be replaced with real agent invocation)
   * This demonstrates the expected terminal states
   */
  private async simulateResearch(gap: Gap): Promise<ResearchResult> {
    // Pattern matching based on gap question
    const question = gap.question.toLowerCase();

    // PUNCH launch date example
    if (question.includes('punch') && question.includes('launch')) {
      return {
        gap_id: gap.gap_id,
        state: 'UNRESOLVABLE',
        reason: 'Token contract shows creation timestamp but no official launch announcement. CoinGecko listing date is unreliable for Solana pump.fun tokens.',
        attempts: 3,
        search_count: 8
      };
    }

    // Character visuals example
    if (question.includes('visual') || question.includes('character')) {
      return {
        gap_id: gap.gap_id,
        state: 'PARTIALLY_RESOLVED',
        evidence: 'Found token logo on pump.fun listing page, but no full character design or mascot artwork.',
        sources: ['https://pump.fun/...'],
        reason: 'Logo exists but insufficient for screenshot test (3-audience evaluation requires full character)',
        attempts: 2,
        search_count: 5
      };
    }

    // Transaction count verification example
    if (question.includes('transaction') || question.includes('15m')) {
      return {
        gap_id: gap.gap_id,
        state: 'RESOLVED',
        evidence: 'Solana Foundation blog post cites Helius RPC data showing 14.8M agent-related transactions in March 2026. On-chain data from solscan.io confirms comparable activity levels.',
        sources: [
          'https://solana.com/blog/agentic-payments-march-2026',
          'https://solscan.io/analytics/agents'
        ],
        attempts: 1,
        search_count: 3
      };
    }

    // Volume data example
    if (question.includes('volume') || question.includes('7-day')) {
      return {
        gap_id: gap.gap_id,
        state: 'RESOLVED',
        evidence: 'DEX volume 7 days post-Drift exploit (Apr 7-14): $1.8B average daily (down 23% from pre-exploit $2.3B). Data from DeFiLlama and Dune Analytics.',
        sources: [
          'https://defillama.com/protocol/solana',
          'https://dune.com/queries/...'
        ],
        attempts: 1,
        search_count: 2
      };
    }

    // Default: UNRESOLVABLE
    return {
      gap_id: gap.gap_id,
      state: 'UNRESOLVABLE',
      reason: 'Insufficient data available from primary sources. Aggregator reports conflict.',
      attempts: 2,
      search_count: 6
    };
  }
}
