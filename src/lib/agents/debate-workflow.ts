/**
 * Agent Debate Workflow Orchestrator
 *
 * Manages the full debate workflow with Resolution Round:
 * 1. Observe → Agents Analyze
 * 2. Skeptic Challenges
 * 3. Resolution Round (Gap Extraction → Task Routing → Research → Re-Challenge)
 * 4. Referee Synthesizes
 *
 * Triggered automatically when daily brief is committed, or manually via CLI.
 */

import fs from 'fs/promises';
import path from 'path';
import { GapExtractor } from './resolution/gap-extractor';
import { LLMGapExtractor } from './resolution/llm-gap-extractor';
import { TaskRouter } from './resolution/task-router';
import { ResolutionExecutor } from './resolution/resolution-executor';
import { DirectResearchExecutor } from './resolution/direct-research-executor';
import { SkepticReChallenger } from './resolution/skeptic-rechallenger';
import { LedgerManager } from './resolution/ledger-manager';
import { synthesizeReferee_withOptionalLLM } from './resolution/referee-synthesizer';
import { writeRunIndex, writeRunsRootIndex } from '../meta-desk/run-index-builder';

export interface DebateRun {
  id: string;
  date: string;
  status: 'running' | 'completed' | 'failed';
  phase: 'observations' | 'analysis' | 'skeptic' | 'resolution' | 'referee' | 'complete';
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface Gap {
  gap_id: string;
  question: string;
  source_agent: string;
  blocking_claim: string;
  assigned_to: string;
  state: 'PENDING' | 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'UNRESOLVABLE';
  /**
   * Named entity this gap is about (e.g. "SNIGGA", "Agentic Payments").
   * Optional because the regex-based gap extractor doesn't produce it; the
   * LLM gap extractor does. When present, LedgerManager uses it directly
   * instead of trying to fish an entity name out of free text.
   */
  entity?: string;
  evidence?: string;
  sources?: string[];
  reason?: string;
  attempts?: number;
}

export interface ResolutionIteration {
  iteration: number;
  gaps_resolved: number;
  gaps_flipped: number;
  delta: string;
  timestamp: string;
}

const MAX_ITERATIONS = 5;
const DATA_DIR = path.join(process.cwd(), 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');

export class DebateWorkflowOrchestrator {
  private runId: string;
  private runDir: string;
  private gapExtractor: GapExtractor;
  private llmGapExtractor: LLMGapExtractor;
  private taskRouter: TaskRouter;
  private resolutionExecutor: ResolutionExecutor;
  private skepticReChallenger: SkepticReChallenger;
  private ledgerManager: LedgerManager;
  private iterations: ResolutionIteration[] = [];

  constructor(runId: string) {
    this.runId = runId;
    this.runDir = path.join(RUNS_DIR, runId);
    this.gapExtractor = new GapExtractor();
    this.llmGapExtractor = new LLMGapExtractor();
    this.taskRouter = new TaskRouter();

    // Use DirectResearchExecutor for production, ResolutionExecutor for simulation/testing
    const useSimulation = process.env.SIMULATION_MODE === 'true';
    const useDirectApi = process.env.USE_DIRECT_API === 'true' || !useSimulation;

    if (useDirectApi && !useSimulation) {
      console.log('[Workflow] Using DirectResearchExecutor (production mode with real API calls)');
      this.resolutionExecutor = new DirectResearchExecutor() as any;
    } else {
      console.log('[Workflow] Using ResolutionExecutor (simulation mode)');
      this.resolutionExecutor = new ResolutionExecutor(useSimulation);
    }

    this.skepticReChallenger = new SkepticReChallenger();
    this.ledgerManager = new LedgerManager();
  }

  /**
   * Main orchestration method - runs full debate workflow
   */
  async execute(): Promise<void> {
    console.log(`[Debate Workflow] Starting run ${this.runId}`);

    try {
      // Create run directory structure
      await this.initializeRunDirectory();

      // Phase 1: Load observations and analyses (already completed by heartbeat agents)
      console.log('[Phase 1] Loading observations and agent analyses...');
      const dailyBrief = await this.loadDailyBrief();
      await this.copyObservationsAndAnalyses(dailyBrief);

      // Phase 2: Load Skeptic challenges
      console.log('[Phase 2] Loading Skeptic challenges...');
      const skepticChallenges = await this.loadSkepticChallenges(dailyBrief);
      await fs.writeFile(
        path.join(this.runDir, 'skeptic_challenges.md'),
        skepticChallenges
      );

      // Phase 3: Resolution Round
      console.log('[Phase 3] Starting Resolution Round...');
      const gaps = await this.executeResolutionRound(dailyBrief, skepticChallenges);

      // Phase 4: Referee Synthesis
      console.log('[Phase 4] Generating Referee synthesis...');
      await this.executeRefereeSynthesis(dailyBrief, gaps);

      // Update ledger
      console.log('[Phase 5] Updating confidence ledger...');
      await this.ledgerManager.updateFromRun(this.runId, gaps);

      console.log(`[Debate Workflow] Run ${this.runId} completed successfully`);
      await this.markRunComplete();

    } catch (error) {
      console.error(`[Debate Workflow] Run ${this.runId} failed:`, error);
      await this.markRunFailed(error as Error);
      throw error;
    }
  }

  /**
   * Resolution Round with iterative gap resolution
   */
  private async executeResolutionRound(
    dailyBrief: string,
    skepticChallenges: string
  ): Promise<Gap[]> {
    console.log('[Resolution Round] Starting...');

    // Step 1: Gap Extraction
    console.log('[Resolution Round] Step 1: Extracting gaps...');

    // Use LLM-based extraction for production (cleaner questions)
    const useLLMExtraction = process.env.USE_LLM_GAP_EXTRACTION !== 'false';
    let gaps: Gap[];

    if (useLLMExtraction) {
      console.log('[Resolution Round] Using LLM-based gap extraction (intelligent parsing)...');
      // Build agent outputs map for context
      const agentOutputs: Record<string, string> = {
        historian: dailyBrief.match(/## Historian([\s\S]*?)(?=##|$)/)?.[1] || '',
        scout: dailyBrief.match(/## Scout([\s\S]*?)(?=##|$)/)?.[1] || '',
        aesthetician: dailyBrief.match(/## Aesthetician([\s\S]*?)(?=##|$)/)?.[1] || '',
        translator: dailyBrief.match(/## Translator([\s\S]*?)(?=##|$)/)?.[1] || '',
      };
      gaps = await this.llmGapExtractor.extract(skepticChallenges, agentOutputs);
    } else {
      console.log('[Resolution Round] Using regex-based gap extraction...');
      gaps = await this.gapExtractor.extract(dailyBrief, skepticChallenges);
    }

    // Load ledger to check for known unresolvables
    const ledger = await this.ledgerManager.load();
    gaps = this.filterKnownUnresolvables(gaps, ledger);

    await fs.writeFile(
      path.join(this.runDir, 'gaps.md'),
      this.formatGapsMarkdown(gaps)
    );
    console.log(`[Resolution Round] Extracted ${gaps.length} gaps`);

    if (gaps.length === 0) {
      console.log('[Resolution Round] No gaps to resolve');
      return [];
    }

    // Step 2: Task Routing
    console.log('[Resolution Round] Step 2: Routing tasks to agents...');
    const routedGaps = this.taskRouter.route(gaps);

    // Step 3 & 4: Bounded Research with Skeptic Re-Challenge loop
    let iteration = 0;
    let previousGapsState = JSON.stringify(routedGaps);
    let noChangeIterations = 0;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`[Resolution Round] Iteration ${iteration}/${MAX_ITERATIONS}`);

      // Step 3: Execute research
      console.log(`[Resolution Round] Executing bounded research...`);
      const resolvedGaps = await this.resolutionExecutor.execute(routedGaps, this.runDir);

      // Write resolution outputs
      await this.writeResolutionOutputs(resolvedGaps, iteration);

      // Step 4: Skeptic re-challenge
      console.log(`[Resolution Round] Skeptic re-challenge pass...`);
      const rechallengeResult = await this.skepticReChallenger.review(resolvedGaps);

      await fs.writeFile(
        path.join(this.runDir, `skeptic_rechallenge_iteration_${iteration}.md`),
        rechallengeResult.markdown
      );

      // Log iteration metrics
      const gapsResolved = resolvedGaps.filter(g => g.state === 'RESOLVED').length;
      const gapsFlipped = rechallengeResult.flippedCount;
      const currentGapsState = JSON.stringify(resolvedGaps);
      const delta = this.computeDelta(previousGapsState, currentGapsState);

      this.iterations.push({
        iteration,
        gaps_resolved: gapsResolved,
        gaps_flipped: gapsFlipped,
        delta,
        timestamp: new Date().toISOString()
      });

      console.log(`[Iteration ${iteration}] Resolved: ${gapsResolved}, Flipped: ${gapsFlipped}`);

      // Check termination conditions
      if (rechallengeResult.approved) {
        console.log('[Resolution Round] Skeptic approved all resolutions');
        await this.writeIterationLog();
        return resolvedGaps;
      }

      // Check for no new information
      if (delta === 'no-change') {
        noChangeIterations++;
        if (noChangeIterations >= 2) {
          console.log('[Resolution Round] 2 consecutive iterations with no new info - terminating');
          await this.writeIterationLog();
          return this.markRemainingAsUnresolvable(resolvedGaps);
        }
      } else {
        noChangeIterations = 0;
      }

      previousGapsState = currentGapsState;

      // If not approved and we have iterations left, continue loop
      if (iteration >= MAX_ITERATIONS) {
        break;
      }
    }

    // If we hit max iterations without approval, this is a workflow failure
    console.error('[Resolution Round] WORKFLOW FAILURE - Max iterations reached');
    await this.writeWorkflowFailure(routedGaps);
    throw new Error('WORKFLOW_FAILURE: Maximum iterations reached without Skeptic approval');
  }

  /**
   * Initialize run directory structure
   */
  private async initializeRunDirectory(): Promise<void> {
    await fs.mkdir(this.runDir, { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'analyses'), { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'resolutions'), { recursive: true });

    const runMetadata: DebateRun = {
      id: this.runId,
      date: this.runId.split('T')[0],
      status: 'running',
      phase: 'observations',
      created_at: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(this.runDir, 'run.json'),
      JSON.stringify(runMetadata, null, 2)
    );

    // Seed the per-run index.md immediately so the sidebar has a friendly
    // title for this folder (instead of the raw ISO run ID) while the
    // workflow is still running. Regenerated on complete/fail.
    await writeRunIndex(this.runId).catch(() => {});
    await writeRunsRootIndex().catch(() => {});
  }

  /**
   * Load daily brief from meta-desk
   */
  private async loadDailyBrief(): Promise<string> {
    const date = this.runId.split('T')[0];
    const briefPath = path.join(DATA_DIR, 'meta-desk', 'daily-briefs', `${date}.md`);
    return await fs.readFile(briefPath, 'utf-8');
  }

  /**
   * Copy observations and analyses to run directory
   */
  private async copyObservationsAndAnalyses(dailyBrief: string): Promise<void> {
    // Extract agent sections from daily brief
    const agents = ['Historian', 'Scout', 'Aesthetician', 'Translator'];

    for (const agent of agents) {
      const section = this.extractAgentSection(dailyBrief, agent);
      if (section) {
        await fs.writeFile(
          path.join(this.runDir, 'analyses', `${agent.toLowerCase()}.md`),
          section
        );
      }
    }

    // Observations would be loaded from observations/ directory
    // For now, create a placeholder
    await fs.writeFile(
      path.join(this.runDir, 'observations.md'),
      '# Observations\n\n(Loaded from observations directory)\n'
    );
  }

  /**
   * Load Skeptic challenges from daily brief
   */
  private async loadSkepticChallenges(dailyBrief: string): Promise<string> {
    return this.extractAgentSection(dailyBrief, 'Skeptic') || '# No Skeptic challenges found';
  }

  /**
   * Extract agent section from daily brief
   */
  private extractAgentSection(brief: string, agentName: string): string | null {
    const regex = new RegExp(`## ${agentName}([\\s\\S]*?)(?=## |$)`, 'i');
    const match = brief.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Filter out gaps that are known to be unresolvable from previous runs
   */
  private filterKnownUnresolvables(gaps: Gap[], ledger: any): Gap[] {
    // Implementation would check ledger.entities[].unresolvable_gaps
    // For now, return all gaps
    return gaps;
  }

  /**
   * Format gaps as markdown for human readability
   */
  private formatGapsMarkdown(gaps: Gap[]): string {
    let md = '# Extracted Gaps\n\n';
    md += `Total gaps: ${gaps.length}\n\n`;

    for (const gap of gaps) {
      md += `## Gap ${gap.gap_id}\n\n`;
      md += `- **Question:** ${gap.question}\n`;
      md += `- **Source Agent:** ${gap.source_agent}\n`;
      md += `- **Blocking Claim:** ${gap.blocking_claim}\n`;
      md += `- **Assigned To:** ${gap.assigned_to}\n`;
      md += `- **State:** ${gap.state}\n\n`;
    }

    return md;
  }

  /**
   * Write resolution outputs per agent
   */
  private async writeResolutionOutputs(gaps: Gap[], iteration: number): Promise<void> {
    const agentGroups: Record<string, Gap[]> = {};

    for (const gap of gaps) {
      if (!agentGroups[gap.assigned_to]) {
        agentGroups[gap.assigned_to] = [];
      }
      agentGroups[gap.assigned_to].push(gap);
    }

    for (const [agent, agentGaps] of Object.entries(agentGroups)) {
      let md = `# ${agent.charAt(0).toUpperCase() + agent.slice(1)} Resolution (Iteration ${iteration})\n\n`;

      for (const gap of agentGaps) {
        md += `## ${gap.question}\n\n`;
        md += `**State:** ${gap.state}\n\n`;

        if (gap.state === 'RESOLVED' && gap.evidence) {
          md += `**Evidence:** ${gap.evidence}\n\n`;
          if (gap.sources && gap.sources.length > 0) {
            md += `**Sources:**\n${gap.sources.map(s => `- ${s}`).join('\n')}\n\n`;
          }
        } else if (gap.state === 'PARTIALLY_RESOLVED' && gap.evidence) {
          md += `**Partial Evidence:** ${gap.evidence}\n\n`;
          md += `**Still Missing:** ${gap.reason}\n\n`;
        } else if (gap.state === 'UNRESOLVABLE') {
          md += `**Reason:** ${gap.reason}\n\n`;
          md += `**Attempts:** ${gap.attempts || 1}\n\n`;
        }
      }

      await fs.writeFile(
        path.join(this.runDir, 'resolutions', `${agent}_iteration_${iteration}.md`),
        md
      );
    }
  }

  /**
   * Compute delta between two gap states
   */
  private computeDelta(prev: string, current: string): string {
    if (prev === current) return 'no-change';

    // Simple implementation - could be more sophisticated
    const prevObj = JSON.parse(prev);
    const currentObj = JSON.parse(current);

    const changes: string[] = [];

    for (let i = 0; i < currentObj.length; i++) {
      if (prevObj[i].state !== currentObj[i].state) {
        changes.push(`Gap ${currentObj[i].gap_id}: ${prevObj[i].state} → ${currentObj[i].state}`);
      }
    }

    return changes.length > 0 ? changes.join('; ') : 'no-state-change';
  }

  /**
   * Write iteration log showing all deltas
   */
  private async writeIterationLog(): Promise<void> {
    let log = '# Resolution Round Iteration Log\n\n';

    for (const iter of this.iterations) {
      log += `## Iteration ${iter.iteration}\n\n`;
      log += `- **Timestamp:** ${iter.timestamp}\n`;
      log += `- **Gaps Resolved:** ${iter.gaps_resolved}\n`;
      log += `- **Gaps Flipped:** ${iter.gaps_flipped}\n`;
      log += `- **Delta:** ${iter.delta}\n\n`;
    }

    await fs.writeFile(
      path.join(this.runDir, 'iteration_log.md'),
      log
    );
  }

  /**
   * Mark remaining gaps as unresolvable after 2 no-change iterations
   */
  private markRemainingAsUnresolvable(gaps: Gap[]): Gap[] {
    return gaps.map(gap => {
      if (gap.state === 'PENDING') {
        return {
          ...gap,
          state: 'UNRESOLVABLE',
          reason: 'No new information after 2 consecutive iterations'
        };
      }
      return gap;
    });
  }

  /**
   * Write workflow failure document
   */
  private async writeWorkflowFailure(gaps: Gap[]): Promise<void> {
    let failure = '# WORKFLOW FAILURE\n\n';
    failure += `Run ID: ${this.runId}\n`;
    failure += `Timestamp: ${new Date().toISOString()}\n\n`;
    failure += `## Reason\n\nMaximum iterations (${MAX_ITERATIONS}) reached without Skeptic approval.\n\n`;
    failure += `## Gaps That Kept Flipping\n\n`;

    // Track which gaps changed state multiple times
    const gapFlipCount: Record<string, number> = {};

    for (const iter of this.iterations) {
      const changes = iter.delta.split(';');
      for (const change of changes) {
        const gapId = change.match(/Gap (\d+)/)?.[1];
        if (gapId) {
          gapFlipCount[gapId] = (gapFlipCount[gapId] || 0) + 1;
        }
      }
    }

    for (const [gapId, flipCount] of Object.entries(gapFlipCount)) {
      if (flipCount > 1) {
        const gap = gaps.find(g => g.gap_id === gapId);
        if (gap) {
          failure += `### Gap ${gapId}: ${gap.question}\n\n`;
          failure += `- Flipped ${flipCount} times\n`;
          failure += `- Current state: ${gap.state}\n`;
          failure += `- Assigned to: ${gap.assigned_to}\n\n`;
        }
      }
    }

    failure += `## Next Steps\n\n`;
    failure += `1. Review iteration log at \`iteration_log.md\`\n`;
    failure += `2. Check if gaps are genuinely unresolvable or if Skeptic needs prompt tuning\n`;
    failure += `3. Manually mark unresolvables in ledger or re-run with adjusted parameters\n`;

    await fs.writeFile(
      path.join(this.runDir, 'WORKFLOW_FAILURE.md'),
      failure
    );
  }

  /**
   * Execute Referee synthesis with resolution results.
   *
   * The deterministic path (synthesizeReferee) stratifies gaps into
   * High-Confidence / Cautious / Watching tiers and is always cheap + safe.
   * When REFEREE_USE_LLM=true and ANTHROPIC_API_KEY is present, the
   * synthesizer also asks Claude Haiku for a richer "Portfolio-Level Read"
   * paragraph; failure falls back to the deterministic narrative.
   */
  private async executeRefereeSynthesis(_dailyBrief: string, gaps: Gap[]): Promise<void> {
    const date = this.runId.split('T')[0];
    const report = await synthesizeReferee_withOptionalLLM(gaps, date);
    await fs.writeFile(path.join(this.runDir, 'referee_report.md'), report);
  }

  /**
   * Mark run as complete
   */
  private async markRunComplete(): Promise<void> {
    const metadataPath = path.join(this.runDir, 'run.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    metadata.status = 'completed';
    metadata.phase = 'complete';
    metadata.completed_at = new Date().toISOString();

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Regenerate the per-run and top-level run indexes so the sidebar
    // reflects the terminal status + final gap counts immediately. Failures
    // are swallowed so a broken index never masks a successful run.
    await writeRunIndex(this.runId).catch(() => {});
    await writeRunsRootIndex().catch(() => {});
  }

  /**
   * Mark run as failed
   */
  private async markRunFailed(error: Error): Promise<void> {
    const metadataPath = path.join(this.runDir, 'run.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    metadata.status = 'failed';
    metadata.error = error.message;
    metadata.completed_at = new Date().toISOString();

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    await writeRunIndex(this.runId).catch(() => {});
    await writeRunsRootIndex().catch(() => {});
  }
}

/**
 * Trigger a debate workflow run
 */
export async function triggerDebateRun(runId?: string): Promise<void> {
  const id = runId || new Date().toISOString();
  const orchestrator = new DebateWorkflowOrchestrator(id);
  await orchestrator.execute();
}

/**
 * Auto-trigger when daily brief is committed
 * (To be integrated with git hooks or file watcher)
 */
export async function autoTriggerOnBriefCommit(briefDate: string): Promise<void> {
  console.log(`[Auto-trigger] Daily brief for ${briefDate} committed`);
  const runId = `${briefDate}T${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`;
  await triggerDebateRun(runId);
}
