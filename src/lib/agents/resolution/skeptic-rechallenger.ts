/**
 * Skeptic Re-Challenger
 *
 * Reviews resolution outputs for:
 * - Press releases being treated as verification
 * - Circular sourcing (aggregators citing each other)
 * - Confirmation bias in resolved claims
 * - Gaps marked RESOLVED that weren't actually answered
 *
 * Can flip RESOLVED back to UNRESOLVED or PARTIALLY_RESOLVED with justification
 */

import type { Gap } from '../debate-workflow';

export interface ReChallengeResult {
  approved: boolean;
  flippedCount: number;
  markdown: string;
  gaps: Gap[];
}

interface ChallengeFlag {
  gap_id: string;
  current_state: string;
  proposed_state: string;
  reason: string;
}

export class SkepticReChallenger {
  /**
   * Review resolution outputs and challenge weak resolutions
   */
  async review(gaps: Gap[]): Promise<ReChallengeResult> {
    const challenges: ChallengeFlag[] = [];

    for (const gap of gaps) {
      // Only review gaps that claim to be resolved or partially resolved
      if (gap.state === 'RESOLVED' || gap.state === 'PARTIALLY_RESOLVED') {
        const challenge = this.evaluateResolution(gap);
        if (challenge) {
          challenges.push(challenge);
        }
      }
    }

    // Apply challenges to gaps
    const updatedGaps = this.applyChallenge(gaps, challenges);

    // Generate markdown report
    const markdown = this.generateMarkdown(challenges, gaps.length);

    return {
      approved: challenges.length === 0,
      flippedCount: challenges.length,
      markdown,
      gaps: updatedGaps
    };
  }

  /**
   * Evaluate a single resolution for issues
   */
  private evaluateResolution(gap: Gap): ChallengeFlag | null {
    // Check for press releases as verification
    if (this.isPressReleaseSource(gap)) {
      return {
        gap_id: gap.gap_id,
        current_state: gap.state,
        proposed_state: 'UNRESOLVED',
        reason: 'Source is a press release, not independent verification. Need primary data or on-chain evidence.'
      };
    }

    // Check for circular sourcing
    if (this.hasCircularSourcing(gap)) {
      return {
        gap_id: gap.gap_id,
        current_state: gap.state,
        proposed_state: 'UNRESOLVED',
        reason: 'Sources cite each other (circular sourcing). Need independent primary source.'
      };
    }

    // Check if RESOLVED but evidence doesn't actually answer the question
    if (gap.state === 'RESOLVED' && !this.evidenceAnswersQuestion(gap)) {
      return {
        gap_id: gap.gap_id,
        current_state: 'RESOLVED',
        proposed_state: 'PARTIALLY_RESOLVED',
        reason: 'Evidence provided doesn\'t fully answer the original question. Missing key details.'
      };
    }

    // Check for missing sources on RESOLVED claims
    if (gap.state === 'RESOLVED' && (!gap.sources || gap.sources.length === 0)) {
      return {
        gap_id: gap.gap_id,
        current_state: 'RESOLVED',
        proposed_state: 'UNRESOLVED',
        reason: 'Marked RESOLVED but no sources cited. Cannot verify claim without sources.'
      };
    }

    // Check for weak evidence on RESOLVED claims
    if (gap.state === 'RESOLVED' && this.hasWeakEvidence(gap)) {
      return {
        gap_id: gap.gap_id,
        current_state: 'RESOLVED',
        proposed_state: 'PARTIALLY_RESOLVED',
        reason: 'Evidence is circumstantial or indirect. Need more direct verification.'
      };
    }

    return null;
  }

  /**
   * Check if sources are press releases
   */
  private isPressReleaseSource(gap: Gap): boolean {
    if (!gap.sources || gap.sources.length === 0) return false;

    const pressReleaseIndicators = [
      'press-release',
      'prnewswire',
      'businesswire',
      'globenewswire',
      '/news/',
      '/press/',
      'medium.com',
      'blog.',
      'announcement'
    ];

    const evidence = gap.evidence?.toLowerCase() || '';
    const hasPressLanguage = /announced|announces|unveils|launches|introducing/.test(evidence);

    return gap.sources.some(source => {
      const lowerSource = source.toLowerCase();
      return pressReleaseIndicators.some(indicator => lowerSource.includes(indicator));
    }) && hasPressLanguage;
  }

  /**
   * Check for circular sourcing (aggregators citing each other)
   */
  private hasCircularSourcing(gap: Gap): boolean {
    if (!gap.sources || gap.sources.length < 2) return false;

    const aggregators = [
      'coingecko',
      'coinmarketcap',
      'defillama',
      'dexscreener',
      'cryptoslate',
      'decrypt',
      'coindesk',
      'cointelegraph'
    ];

    // If all sources are aggregators, likely circular
    const aggregatorCount = gap.sources.filter(source =>
      aggregators.some(agg => source.toLowerCase().includes(agg))
    ).length;

    return aggregatorCount === gap.sources.length && gap.sources.length > 1;
  }

  /**
   * Check if evidence actually answers the question
   */
  private evidenceAnswersQuestion(gap: Gap): boolean {
    if (!gap.evidence) return false;

    const question = gap.question.toLowerCase();
    const evidence = gap.evidence.toLowerCase();

    // Launch date questions
    if (question.includes('when') && question.includes('launch')) {
      // Should contain a specific date or timeframe
      return /\d{4}|january|february|march|april|may|june|july|august|september|october|november|december|\d+ days? ago/.test(evidence);
    }

    // Visual/character questions
    if (question.includes('visual') || question.includes('character')) {
      // Should reference actual visuals or their absence
      return /image|screenshot|design|mascot|logo|no visual|no character/.test(evidence);
    }

    // Transaction/volume questions
    if (question.includes('transaction') || question.includes('volume')) {
      // Should contain specific numbers
      return /\d+m|\d+b|\d+k|\d+,\d+/.test(evidence);
    }

    // Generic check: evidence should be substantive (>100 chars)
    return evidence.length > 100;
  }

  /**
   * Check if evidence is weak or circumstantial
   */
  private hasWeakEvidence(gap: Gap): boolean {
    if (!gap.evidence) return true;

    const weakIndicators = [
      'reportedly',
      'allegedly',
      'rumored',
      'according to sources',
      'unconfirmed',
      'may have',
      'might be',
      'possibly',
      'likely',
      'appears to'
    ];

    const evidence = gap.evidence.toLowerCase();
    return weakIndicators.some(indicator => evidence.includes(indicator));
  }

  /**
   * Apply challenges to gaps, flipping states where necessary
   */
  private applyChallenge(gaps: Gap[], challenges: ChallengeFlag[]): Gap[] {
    const challengeMap = new Map(challenges.map(c => [c.gap_id, c]));

    return gaps.map(gap => {
      const challenge = challengeMap.get(gap.gap_id);
      if (challenge) {
        return {
          ...gap,
          state: challenge.proposed_state as Gap['state'],
          reason: challenge.reason
        };
      }
      return gap;
    });
  }

  /**
   * Generate markdown report of re-challenge results
   */
  private generateMarkdown(challenges: ChallengeFlag[], totalGaps: number): string {
    let md = '# Skeptic Re-Challenge Report\n\n';
    md += `**Total gaps reviewed:** ${totalGaps}\n`;
    md += `**Challenges raised:** ${challenges.length}\n\n`;

    if (challenges.length === 0) {
      md += '## Verdict\n\n';
      md += '✅ **All resolutions approved.** No weak evidence, press release sourcing, or circular citations detected.\n\n';
      return md;
    }

    md += '## Challenges\n\n';

    for (const challenge of challenges) {
      md += `### Gap ${challenge.gap_id}\n\n`;
      md += `- **Current state:** ${challenge.current_state}\n`;
      md += `- **Proposed state:** ${challenge.proposed_state}\n`;
      md += `- **Reason:** ${challenge.reason}\n\n`;
    }

    md += '## Verdict\n\n';
    md += `❌ **${challenges.length} resolution(s) challenged.** Another iteration required.\n\n`;

    return md;
  }
}
