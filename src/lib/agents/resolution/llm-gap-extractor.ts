/**
 * LLM-Based Gap Extractor
 *
 * Uses Claude to intelligently extract clean, researchable questions
 * from Skeptic challenges instead of crude regex parsing.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Gap } from '../debate-workflow';
import { sanitizeEntityName } from './entity-utils';

export class LLMGapExtractor {
  private anthropic: Anthropic;
  private gapIdCounter = 0;

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Extract gaps from Skeptic challenges and agent outputs using LLM
   */
  async extract(
    skepticChallenges: string,
    agentOutputs: Record<string, string>
  ): Promise<Gap[]> {
    console.log('[LLM Gap Extractor] Analyzing Skeptic challenges...');

    const prompt = this.buildExtractionPrompt(skepticChallenges, agentOutputs);

    try {
      // Use Haiku for gap extraction (simple task, 67% cheaper)
      const model = process.env.GAP_EXTRACTION_MODEL || 'claude-haiku-4-5';

      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for precise extraction
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in API response');
      }

      const gaps = this.parseGapsFromResponse(textContent.text);
      console.log(`[LLM Gap Extractor] Extracted ${gaps.length} clean gaps`);

      return gaps;
    } catch (error) {
      console.error('[LLM Gap Extractor] Failed:', error);
      // Fallback to empty gaps rather than crashing
      return [];
    }
  }

  /**
   * Build extraction prompt
   */
  private buildExtractionPrompt(
    skepticChallenges: string,
    agentOutputs: Record<string, string>
  ): string {
    return `You are analyzing a meme token intelligence brief where a Skeptic agent has challenged various claims made by research agents.

Your task is to extract CLEAN, RESEARCHABLE QUESTIONS from the Skeptic's challenges.

# Skeptic Challenges:

${skepticChallenges}

# Context from Agents:

${Object.entries(agentOutputs)
  .map(([agent, output]) => `## ${agent}:\n${output.slice(0, 500)}...`)
  .join('\n\n')}

---

# Instructions:

Extract each verification request as a standalone, well-formed research question. For each challenge:

1. **Clean up the question** - Remove markdown formatting, fix grammar, make it clear
2. **Identify the claim being questioned** - Extract the specific claim that needs verification
3. **Identify the named entity** - The token ticker, protocol, or narrative the gap is about
   (e.g. "BONK", "SNIGGA", "PENGU", "Agentic Payments", "Drift Exploit"). Use the canonical
   ticker/name in short form. If the gap is not about a specific entity, use "General".
4. **Route to the right agent** - Assign based on domain:
   - **scout**: On-chain data, URLs, source verification, metrics validation
   - **aesthetician**: Visual content, character design, images, artwork
   - **historian**: Historical patterns, comparative analysis, cycle matching
   - **translator**: Cross-cultural signals, language-specific content

5. **Make it actionable** - The question should be answerable via web search + analysis

# Output Format:

Return a JSON array of gaps:

\`\`\`json
[
  {
    "question": "Is bonkcoin.com/mascot-2026 the official BONK team website or a community-created page?",
    "claim": "BONK team released official mascot artwork at bonkcoin.com/mascot-2026",
    "entity": "BONK",
    "agent": "scout",
    "source": "skeptic"
  },
  {
    "question": "Does the BONK DAO have a verifiable on-chain treasury wallet with disclosed governance mechanism?",
    "claim": "BONK has real DAO infrastructure with grants program",
    "entity": "BONK",
    "agent": "scout",
    "source": "skeptic"
  }
]
\`\`\`

IMPORTANT:
- Questions must be specific and researchable
- Avoid vague questions like "can we verify X?"
- Focus on factual claims that can be proven/disproven
- Skip meta-commentary or process questions
- The "entity" field must be a short proper name (a ticker, protocol, or narrative),
  NOT a sentence fragment. If no clear entity, use "General".

Now extract the gaps:`;
  }

  /**
   * Parse gaps from LLM response
   */
  private parseGapsFromResponse(responseText: string): Gap[] {
    // Extract JSON block
    const jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.warn('[LLM Gap Extractor] No JSON block found in response');
      return [];
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      if (!Array.isArray(parsed)) {
        console.warn('[LLM Gap Extractor] Response is not an array');
        return [];
      }

      return parsed.map((item) => {
        const entity = typeof item.entity === 'string' ? sanitizeEntityName(item.entity) : undefined;
        return {
          gap_id: `gap_${++this.gapIdCounter}`,
          question: item.question,
          blocking_claim: item.claim || item.question,
          assigned_to: item.agent || 'scout',
          source_agent: item.source || 'skeptic',
          state: 'PENDING' as const,
          attempts: 0,
          ...(entity ? { entity } : {}),
        };
      });
    } catch (error) {
      console.error('[LLM Gap Extractor] Failed to parse JSON:', error);
      return [];
    }
  }
}
