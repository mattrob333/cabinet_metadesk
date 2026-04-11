/**
 * Ledger Manager
 *
 * Manages the persistent confidence ledger (cabinet/ledger.json)
 * Tracks resolved facts and unresolvable gaps across runs
 * Auto-generates human-readable markdown view (cabinet/ledger.md)
 */

import fs from 'fs/promises';
import path from 'path';
import type { Gap } from '../debate-workflow';

export interface LedgerEntity {
  type: 'token' | 'narrative' | 'protocol' | 'account';
  first_seen: string;
  last_updated: string;
  resolved_facts: ResolvedFact[];
  unresolvable_gaps: UnresolvableGap[];
  open_gaps: string[];
  confidence_state: 'FULL' | 'PARTIAL' | 'MINIMAL';
}

export interface ResolvedFact {
  claim: string;
  source: string;
  resolved_at: string;
  run_id: string;
}

export interface UnresolvableGap {
  question: string;
  reason: string;
  attempts: number;
  last_attempted: string;
  run_id: string;
}

export interface Ledger {
  entities: Record<string, LedgerEntity>;
  last_updated: string;
  version: string;
}

const CABINET_DIR = path.join(process.cwd(), 'data');
const LEDGER_PATH = path.join(CABINET_DIR, 'ledger.json');
const LEDGER_MD_PATH = path.join(CABINET_DIR, 'ledger.md');

export class LedgerManager {
  /**
   * Load ledger from disk (or create empty if doesn't exist)
   */
  async load(): Promise<Ledger> {
    try {
      const content = await fs.readFile(LEDGER_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // If file doesn't exist, return empty ledger
      return {
        entities: {},
        last_updated: new Date().toISOString(),
        version: '1.0.0'
      };
    }
  }

  /**
   * Save ledger to disk
   */
  async save(ledger: Ledger): Promise<void> {
    ledger.last_updated = new Date().toISOString();
    await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  }

  /**
   * Update ledger from a completed run
   */
  async updateFromRun(runId: string, gaps: Gap[]): Promise<void> {
    const ledger = await this.load();

    // Extract entity names from gaps
    const entities = this.extractEntities(gaps);

    for (const [entityName, entityGaps] of Object.entries(entities)) {
      if (!ledger.entities[entityName]) {
        ledger.entities[entityName] = {
          type: this.inferEntityType(entityName),
          first_seen: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          resolved_facts: [],
          unresolvable_gaps: [],
          open_gaps: [],
          confidence_state: 'MINIMAL'
        };
      }

      const entity = ledger.entities[entityName];

      // Process each gap
      for (const gap of entityGaps) {
        if (gap.state === 'RESOLVED' && gap.evidence && gap.sources) {
          // Add to resolved facts
          entity.resolved_facts.push({
            claim: gap.question,
            source: gap.sources.join(', '),
            resolved_at: new Date().toISOString(),
            run_id: runId
          });
        } else if (gap.state === 'UNRESOLVABLE') {
          // Add to unresolvable gaps (avoid duplicates)
          const exists = entity.unresolvable_gaps.some(
            ug => ug.question === gap.question
          );

          if (!exists) {
            entity.unresolvable_gaps.push({
              question: gap.question,
              reason: gap.reason || 'Unknown',
              attempts: gap.attempts || 1,
              last_attempted: new Date().toISOString(),
              run_id: runId
            });
          } else {
            // Update existing unresolvable gap
            const existing = entity.unresolvable_gaps.find(
              ug => ug.question === gap.question
            );
            if (existing) {
              existing.attempts = (existing.attempts || 1) + 1;
              existing.last_attempted = new Date().toISOString();
              existing.run_id = runId;
            }
          }
        } else if (gap.state === 'PARTIALLY_RESOLVED') {
          // Track as open gap
          if (!entity.open_gaps.includes(gap.question)) {
            entity.open_gaps.push(gap.question);
          }
        }
      }

      // Update confidence state
      entity.confidence_state = this.computeConfidenceState(entity);
      entity.last_updated = new Date().toISOString();
    }

    // Save updated ledger
    await this.save(ledger);

    // Generate markdown view
    await this.generateMarkdownView(ledger);

    console.log(`[Ledger] Updated with data from run ${runId}`);
  }

  /**
   * Extract entity names from gaps
   */
  private extractEntities(gaps: Gap[]): Record<string, Gap[]> {
    const entities: Record<string, Gap[]> = {};

    for (const gap of gaps) {
      // Try to extract entity name from question or blocking claim
      const entityName = this.extractEntityName(gap.question, gap.blocking_claim);

      if (!entities[entityName]) {
        entities[entityName] = [];
      }
      entities[entityName].push(gap);
    }

    return entities;
  }

  /**
   * Extract entity name from text (e.g., "PUNCH" from "When did PUNCH launch?")
   */
  private extractEntityName(question: string, claim: string): string {
    // Look for all-caps token names
    const text = `${question} ${claim}`;
    const matches = text.match(/\b([A-Z]{2,})\b/);

    if (matches) {
      return matches[1];
    }

    // Look for quoted names
    const quotedMatch = text.match(/"([^"]+)"/);
    if (quotedMatch) {
      return quotedMatch[1];
    }

    // Look for common patterns
    if (/agentic payments?/i.test(text)) {
      return 'Agentic Payments';
    }

    if (/drift.*exploit/i.test(text)) {
      return 'Drift Exploit';
    }

    // Default to generic
    return 'General';
  }

  /**
   * Infer entity type from name
   */
  private inferEntityType(name: string): LedgerEntity['type'] {
    if (/^[A-Z]{2,}$/.test(name)) {
      // All-caps likely a token ticker
      return 'token';
    }

    if (/payment|agent|ai/i.test(name)) {
      return 'narrative';
    }

    if (/protocol|drift|raydium/i.test(name)) {
      return 'protocol';
    }

    return 'token'; // default
  }

  /**
   * Compute confidence state based on resolved vs unresolvable
   */
  private computeConfidenceState(entity: LedgerEntity): 'FULL' | 'PARTIAL' | 'MINIMAL' {
    const totalFacts = entity.resolved_facts.length;
    const totalUnresolvable = entity.unresolvable_gaps.length;
    const totalOpen = entity.open_gaps.length;

    if (totalFacts >= 3 && totalUnresolvable === 0) {
      return 'FULL';
    }

    if (totalFacts > 0) {
      return 'PARTIAL';
    }

    return 'MINIMAL';
  }

  /**
   * Generate human-readable markdown view of ledger
   */
  private async generateMarkdownView(ledger: Ledger): Promise<void> {
    let md = '# Confidence Ledger\n\n';
    md += `**Last updated:** ${ledger.last_updated}\n`;
    md += `**Version:** ${ledger.version}\n\n`;
    md += '---\n\n';

    // Sort entities by confidence state
    const sorted = Object.entries(ledger.entities).sort((a, b) => {
      const confidenceOrder = { FULL: 0, PARTIAL: 1, MINIMAL: 2 };
      return confidenceOrder[a[1].confidence_state] - confidenceOrder[b[1].confidence_state];
    });

    for (const [name, entity] of sorted) {
      const emoji = entity.confidence_state === 'FULL' ? '✅' :
                    entity.confidence_state === 'PARTIAL' ? '🟡' : '⚠️';

      md += `## ${emoji} ${name}\n\n`;
      md += `- **Type:** ${entity.type}\n`;
      md += `- **Confidence:** ${entity.confidence_state}\n`;
      md += `- **First seen:** ${entity.first_seen.split('T')[0]}\n`;
      md += `- **Last updated:** ${entity.last_updated.split('T')[0]}\n\n`;

      if (entity.resolved_facts.length > 0) {
        md += `### ✅ Resolved Facts (${entity.resolved_facts.length})\n\n`;
        for (const fact of entity.resolved_facts) {
          md += `- **${fact.claim}**\n`;
          md += `  - Source: ${fact.source}\n`;
          md += `  - Resolved: ${fact.resolved_at.split('T')[0]} (run: ${fact.run_id})\n\n`;
        }
      }

      if (entity.unresolvable_gaps.length > 0) {
        md += `### ❌ Unresolvable Gaps (${entity.unresolvable_gaps.length})\n\n`;
        for (const gap of entity.unresolvable_gaps) {
          md += `- **${gap.question}**\n`;
          md += `  - Reason: ${gap.reason}\n`;
          md += `  - Attempts: ${gap.attempts}\n`;
          md += `  - Last tried: ${gap.last_attempted.split('T')[0]} (run: ${gap.run_id})\n\n`;
        }
      }

      if (entity.open_gaps.length > 0) {
        md += `### 🔄 Open Gaps (${entity.open_gaps.length})\n\n`;
        for (const gap of entity.open_gaps) {
          md += `- ${gap}\n`;
        }
        md += '\n';
      }

      md += '---\n\n';
    }

    await fs.writeFile(LEDGER_MD_PATH, md);
    console.log('[Ledger] Generated markdown view at cabinet/ledger.md');
  }
}
