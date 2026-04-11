/**
 * Task Router
 *
 * Routes gaps to appropriate agents based on domain expertise:
 * - Scout: on-chain data, launch dates, transactions, volume
 * - Aesthetician: character visuals, branding, imagery
 * - Historian: historical/comparative data, pattern verification
 * - Translator: cross-cultural verification, non-English sources
 */

import type { Gap } from '../debate-workflow';

export interface RoutingRule {
  agent: string;
  keywords: string[];
  priority: number;
}

const ROUTING_RULES: RoutingRule[] = [
  {
    agent: 'scout',
    keywords: [
      'launch date', 'on-chain', 'transaction', 'volume', 'wallet',
      'dex', 'bonding curve', 'market cap', 'token age', 'source document',
      'verify', 'factual', 'data'
    ],
    priority: 1
  },
  {
    agent: 'aesthetician',
    keywords: [
      'character', 'visual', 'screenshot', 'image', 'design',
      'mascot', 'branding', 'pfp', 'logo', 'appearance'
    ],
    priority: 1
  },
  {
    agent: 'historian',
    keywords: [
      'historical', 'pattern', 'cycle', 'comparative', 'trend',
      'past', 'previous', 'q1', 'q2', 'q3', 'q4', '2024', '2025',
      'post-event', 'after'
    ],
    priority: 2
  },
  {
    agent: 'translator',
    keywords: [
      'cross-cultural', 'translation', 'language', 'eastern',
      'japanese', 'chinese', 'korean', 'western', 'ct'
    ],
    priority: 2
  }
];

export class TaskRouter {
  /**
   * Route gaps to appropriate agents
   * Gaps may already have assigned_to from GapExtractor, but we validate/override if needed
   */
  route(gaps: Gap[]): Gap[] {
    return gaps.map(gap => {
      const agent = this.determineAgent(gap);
      return {
        ...gap,
        assigned_to: agent
      };
    });
  }

  /**
   * Determine the best agent for a gap using keyword matching
   */
  private determineAgent(gap: Gap): string {
    const text = `${gap.question} ${gap.blocking_claim}`.toLowerCase();
    const scores: Record<string, number> = {};

    // Score each agent based on keyword matches
    for (const rule of ROUTING_RULES) {
      let score = 0;
      for (const keyword of rule.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score += rule.priority;
        }
      }
      scores[rule.agent] = score;
    }

    // Find agent with highest score
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      // No matches - default to scout for factual verification
      return 'scout';
    }

    const bestAgent = Object.entries(scores)
      .filter(([_, score]) => score === maxScore)
      .sort((a, b) => {
        // If tied, prefer based on rule priority order
        const aPriority = ROUTING_RULES.find(r => r.agent === a[0])?.priority || 0;
        const bPriority = ROUTING_RULES.find(r => r.agent === b[0])?.priority || 0;
        return aPriority - bPriority;
      })[0][0];

    return bestAgent;
  }

  /**
   * Get workload distribution across agents
   */
  getWorkloadDistribution(gaps: Gap[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const gap of gaps) {
      distribution[gap.assigned_to] = (distribution[gap.assigned_to] || 0) + 1;
    }

    return distribution;
  }
}
