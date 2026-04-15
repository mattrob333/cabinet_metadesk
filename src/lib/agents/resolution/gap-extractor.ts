/**
 * Gap Extractor
 *
 * Parses Skeptic challenges and agent outputs to identify unverified claims,
 * missing data, and unresolved questions. Converts each into a structured gap.
 */

import type { Gap } from '../debate-workflow';

interface GapIndicator {
  pattern: RegExp;
  type: 'unverified' | 'missing' | 'pending' | 'incomplete' | 'unknown' | 'need-data';
}

const GAP_INDICATORS: GapIndicator[] = [
  { pattern: /unverified|not verified|hasn't verified|haven't verified/gi, type: 'unverified' },
  { pattern: /missing data|data missing|no data|lacking data/gi, type: 'missing' },
  { pattern: /pending|awaiting|need to verify/gi, type: 'pending' },
  { pattern: /incomplete|insufficient|not enough/gi, type: 'incomplete' },
  { pattern: /unknown|unclear|don't know|do not know/gi, type: 'unknown' },
  { pattern: /need data|needs verification|require.*verification/gi, type: 'need-data' },
  { pattern: /cannot evaluate|can't evaluate|unable to evaluate/gi, type: 'incomplete' },
  { pattern: /no visual data|no character data|no images?/gi, type: 'missing' },
  { pattern: /launch date.*unknown|when.*launch/gi, type: 'unknown' },
  { pattern: /INCOMPLETE|FAIL.*no.*data/gi, type: 'incomplete' },
];

export class GapExtractor {
  private gapCounter = 0;

  /**
   * Extract gaps from daily brief and Skeptic challenges
   */
  async extract(dailyBrief: string, skepticChallenges: string): Promise<Gap[]> {
    const gaps: Gap[] = [];

    // Extract from Skeptic challenges
    const skepticGaps = this.extractFromText(
      skepticChallenges,
      'skeptic',
      'Skeptic Challenge'
    );
    gaps.push(...skepticGaps);

    // Extract from agent sections in daily brief
    const agentSections = this.splitIntoAgentSections(dailyBrief);

    for (const [agent, content] of Object.entries(agentSections)) {
      const agentGaps = this.extractFromText(content, agent.toLowerCase(), agent);
      gaps.push(...agentGaps);
    }

    // Also look for "What We DON'T KNOW" sections in Referee synthesis
    const refereeGaps = this.extractFromRefereeSection(dailyBrief);
    gaps.push(...refereeGaps);

    return gaps;
  }

  /**
   * Extract gaps from text using pattern matching
   */
  private extractFromText(
    text: string,
    sourceAgent: string,
    sectionName: string
  ): Gap[] {
    const gaps: Gap[] = [];
    const sentences = this.splitIntoSentences(text);

    for (const sentence of sentences) {
      for (const indicator of GAP_INDICATORS) {
        if (indicator.pattern.test(sentence)) {
          const gap = this.createGapFromSentence(sentence, sourceAgent, indicator.type);
          if (gap) {
            gaps.push(gap);
          }
          break; // Only create one gap per sentence
        }
      }
    }

    return gaps;
  }

  /**
   * Split text into agent sections
   */
  private splitIntoAgentSections(brief: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const agentNames = ['Historian', 'Scout', 'Aesthetician', 'Translator', 'Skeptic', 'Referee'];

    for (const agent of agentNames) {
      const regex = new RegExp(`## ${agent}([\\s\\S]*?)(?=## |$)`, 'i');
      const match = brief.match(regex);
      if (match) {
        sections[agent] = match[1].trim();
      }
    }

    return sections;
  }

  /**
   * Extract gaps specifically from Referee's "What We DON'T KNOW" section
   */
  private extractFromRefereeSection(brief: string): Gap[] {
    const gaps: Gap[] = [];
    const dontKnowRegex = /what we don't know[\s\S]*?(?=##|$)/gi;
    const match = brief.match(dontKnowRegex);

    if (match) {
      const section = match[0];
      const lines = section.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));

      for (const line of lines) {
        const cleaned = line.replace(/^[*-]\s*/, '').trim();
        if (cleaned) {
          const gap: Gap = {
            gap_id: `gap_${++this.gapCounter}`,
            question: this.convertToQuestion(cleaned),
            source_agent: 'referee',
            blocking_claim: cleaned,
            assigned_to: this.inferAgent(cleaned),
            state: 'PENDING'
          };
          gaps.push(gap);
        }
      }
    }

    return gaps;
  }

  /**
   * Create a gap object from a sentence containing a gap indicator
   */
  private createGapFromSentence(
    sentence: string,
    sourceAgent: string,
    indicatorType: string
  ): Gap | null {
    // Extract the subject/claim from the sentence
    const claim = this.extractClaim(sentence);
    if (!claim) return null;

    // Convert to a question format
    const question = this.convertToQuestion(claim);

    // Determine which agent should handle this
    const assignedAgent = this.inferAgent(claim);

    const gap: Gap = {
      gap_id: `gap_${++this.gapCounter}`,
      question,
      source_agent: sourceAgent,
      blocking_claim: claim,
      assigned_to: assignedAgent,
      state: 'PENDING'
    };

    return gap;
  }

  /**
   * Extract the core claim from a sentence
   */
  private extractClaim(sentence: string): string {
    // Remove gap indicators to get the core claim
    let claim = sentence;

    for (const indicator of GAP_INDICATORS) {
      claim = claim.replace(indicator.pattern, '').trim();
    }

    // Clean up common prefixes
    claim = claim.replace(/^(but|however|and|also|,|\.|:)\s*/gi, '').trim();

    return claim;
  }

  /**
   * Convert a claim into a question format
   */
  private convertToQuestion(claim: string): string {
    // If already a question, return as-is
    if (claim.endsWith('?')) return claim;

    // Common patterns to convert to questions
    if (/launch date/i.test(claim)) {
      const entity = claim.match(/([A-Z]+)\s+launch date/i)?.[1];
      return entity ? `When did ${entity} launch?` : 'What is the launch date?';
    }

    if (/character.*visual|visual.*data|screenshot/i.test(claim)) {
      const entity = claim.match(/([A-Z]+)\s+/)?.[1];
      return entity ? `What are ${entity}'s character visuals?` : 'What are the character visuals?';
    }

    if (/\d+M?\s+(transactions?|AI|agents?)/i.test(claim)) {
      return 'Can we verify the transaction count claim?';
    }

    if (/volume|trading|7-day/i.test(claim)) {
      return 'What is the 7-day post-event volume data?';
    }

    if (/cross-cultural|eastern/i.test(claim)) {
      return 'Are there cross-cultural signals to verify?';
    }

    // Generic fallback
    return `Can we verify: ${claim}?`;
  }

  /**
   * Infer which agent should handle this gap based on domain keywords
   */
  private inferAgent(claim: string): string {
    const lowerClaim = claim.toLowerCase();

    // Scout: on-chain data, launch dates, transaction counts, volume
    if (
      /launch date|on-chain|transaction|volume|wallet|dex|bonding curve/.test(lowerClaim)
    ) {
      return 'scout';
    }

    // Aesthetician: character visuals, screenshot test, branding, imagery
    if (
      /character|visual|screenshot|image|design|mascot|branding|pfp/.test(lowerClaim)
    ) {
      return 'aesthetician';
    }

    // Historian: comparative/historical data, patterns, cycles, trends
    if (
      /historical|pattern|cycle|comparative|trend|past|previous|q\d|2024/.test(lowerClaim)
    ) {
      return 'historian';
    }

    // Translator: cross-cultural, language, Eastern signals
    if (
      /cross-cultural|translation|language|eastern|japanese|chinese|korean/.test(lowerClaim)
    ) {
      return 'translator';
    }

    // Default to scout for factual verification
    return 'scout';
  }

  /**
   * Split text into sentences for analysis
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be enhanced with better NLP
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter out very short fragments
  }
}
