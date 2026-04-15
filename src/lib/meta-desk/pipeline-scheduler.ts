/**
 * Meta Desk Pipeline Scheduler
 *
 * A standalone cron loop that runs the Meta Desk observation + debate pipeline
 * on a fixed cadence. Uses `node-cron` (already a dep, same lib the agent
 * daemon uses) but lives in its own process so a scraper failure can't take
 * down the agent runtime.
 *
 * Jobs:
 *   - dex       — npm run scrape:dex (DexScreener trending)
 *   - x         — npm run scrape:x   (xAI Grok narratives)
 *   - debate    — npm run debate     (Resolution Round for today's date)
 *
 * Each job is:
 *   - idempotent (safe to double-fire; scrapers write timestamped files,
 *     debate creates per-run directories)
 *   - wrapped with a lock so two concurrent invocations of the same job
 *     don't collide (e.g. if a scrape runs longer than its interval)
 *   - logged to `data/.cabinet/pipeline-log.jsonl` for observability, and
 *     the latest status to `data/.cabinet/pipeline-heartbeat.json` so other
 *     tooling (e.g. a future health endpoint) can read it
 *
 * Schedules are env-configurable with defaults. All cron expressions run in
 * the process's local timezone unless `PIPELINE_TZ` is set.
 */

import fs from 'fs/promises';
import path from 'path';
import cron, { type ScheduledTask } from 'node-cron';
import { scrapeDexScreener } from '../scrapers/dex-trending-monitor';
import { scrapeXTrending } from '../scrapers/x-trending-monitor';
import { triggerDebateRun } from '../agents/debate-workflow';

const CABINET_INTERNAL_DIR = path.join(process.cwd(), 'data', '.cabinet');
const LOG_PATH = path.join(CABINET_INTERNAL_DIR, 'pipeline-log.jsonl');
const HEARTBEAT_PATH = path.join(CABINET_INTERNAL_DIR, 'pipeline-heartbeat.json');

export type PipelineJobId = 'dex' | 'x' | 'debate';

export interface PipelineJobConfig {
  id: PipelineJobId;
  cron: string;
  enabled: boolean;
  description: string;
}

export interface PipelineLogEntry {
  job: PipelineJobId;
  started_at: string;
  completed_at: string;
  status: 'completed' | 'failed' | 'skipped';
  duration_ms: number;
  detail?: string;
  error?: string;
}

export interface PipelineHeartbeat {
  scheduler_started_at: string;
  last_updated: string;
  jobs: Record<
    PipelineJobId,
    {
      config: PipelineJobConfig;
      last_run?: PipelineLogEntry;
      last_success?: PipelineLogEntry;
      next_run_estimate?: string;
    }
  >;
}

/**
 * Resolve the default schedule config from env, with safe defaults.
 * Default cadence intentionally conservative to avoid rate-limit surprises.
 */
export function defaultConfig(): PipelineJobConfig[] {
  return [
    {
      id: 'dex',
      cron: process.env.METADESK_DEX_CRON || '*/15 * * * *',
      enabled: process.env.METADESK_DEX_ENABLED !== 'false',
      description: 'DexScreener trending Solana tokens',
    },
    {
      id: 'x',
      cron: process.env.METADESK_X_CRON || '*/30 * * * *',
      // X scraper needs a live xAI key, so auto-disable when missing.
      enabled:
        process.env.METADESK_X_ENABLED !== 'false' && Boolean(process.env.XAI_API_KEY),
      description: 'X / Twitter narratives via xAI Grok',
    },
    {
      id: 'debate',
      cron: process.env.METADESK_DEBATE_CRON || '0 9 * * *',
      // Debate needs Anthropic + Tavily. Auto-disable if keys missing.
      enabled:
        process.env.METADESK_DEBATE_ENABLED !== 'false' &&
        Boolean(process.env.ANTHROPIC_API_KEY),
      description: 'Daily Agent Debate (Resolution Round)',
    },
  ];
}

async function appendLog(entry: PipelineLogEntry): Promise<void> {
  await fs.mkdir(CABINET_INTERNAL_DIR, { recursive: true });
  await fs.appendFile(LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

async function writeHeartbeat(state: PipelineHeartbeat): Promise<void> {
  await fs.mkdir(CABINET_INTERNAL_DIR, { recursive: true });
  await fs.writeFile(HEARTBEAT_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Run a single pipeline job. Returns the log entry written.
 * Each job implementation is expected to be idempotent and side-effect safe.
 */
async function runJob(id: PipelineJobId): Promise<PipelineLogEntry> {
  const started = Date.now();
  const startedIso = new Date(started).toISOString();
  let status: PipelineLogEntry['status'] = 'completed';
  let detail: string | undefined;
  let error: string | undefined;

  try {
    switch (id) {
      case 'dex': {
        const result = await scrapeDexScreener(false);
        if (!result.success) throw new Error(result.error || 'scrape failed');
        detail = `tokens=${result.tokensFound} file=${result.observationFilePath ?? '(n/a)'}`;
        break;
      }
      case 'x': {
        const result = await scrapeXTrending(false);
        if (!result.success) throw new Error(result.error || 'scrape failed');
        detail = `narratives=${result.tokensFound} file=${result.observationFilePath ?? '(n/a)'}`;
        break;
      }
      case 'debate': {
        const today = new Date().toISOString().split('T')[0];
        const runId = `${today}T${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`;
        await triggerDebateRun(runId);
        detail = `run_id=${runId}`;
        break;
      }
    }
  } catch (err) {
    status = 'failed';
    error = err instanceof Error ? err.message : String(err);
  }

  const completed = Date.now();
  const entry: PipelineLogEntry = {
    job: id,
    started_at: startedIso,
    completed_at: new Date(completed).toISOString(),
    status,
    duration_ms: completed - started,
    detail,
    error,
  };
  await appendLog(entry);
  return entry;
}

/**
 * In-memory per-job lock. Prevents the next scheduled tick from firing while
 * the current invocation is still running.
 */
const jobLocks = new Set<PipelineJobId>();

async function runJobWithLock(
  id: PipelineJobId,
  onComplete: (entry: PipelineLogEntry) => void | Promise<void>
): Promise<PipelineLogEntry> {
  if (jobLocks.has(id)) {
    console.log(`[pipeline] skipping ${id}: previous invocation still running`);
    const entry: PipelineLogEntry = {
      job: id,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'skipped',
      duration_ms: 0,
      detail: 'previous invocation still running',
    };
    await appendLog(entry);
    await onComplete(entry);
    return entry;
  }
  jobLocks.add(id);
  try {
    const entry = await runJob(id);
    await onComplete(entry);
    return entry;
  } finally {
    jobLocks.delete(id);
  }
}

export class PipelineScheduler {
  private tasks = new Map<PipelineJobId, ScheduledTask>();
  private state: PipelineHeartbeat;

  constructor(private configs: PipelineJobConfig[] = defaultConfig()) {
    const now = new Date().toISOString();
    this.state = {
      scheduler_started_at: now,
      last_updated: now,
      jobs: Object.fromEntries(
        configs.map((c) => [c.id, { config: c }])
      ) as PipelineHeartbeat['jobs'],
    };
  }

  /** Validate all cron expressions up-front. Throws on the first invalid one. */
  validate(): void {
    for (const c of this.configs) {
      if (c.enabled && !cron.validate(c.cron)) {
        throw new Error(`Invalid cron expression for job "${c.id}": ${c.cron}`);
      }
    }
  }

  async start(): Promise<void> {
    this.validate();
    await writeHeartbeat(this.state);

    for (const c of this.configs) {
      if (!c.enabled) {
        console.log(`[pipeline] ${c.id}: DISABLED (${c.description})`);
        continue;
      }
      console.log(`[pipeline] ${c.id}: scheduling "${c.cron}" — ${c.description}`);

      const task = cron.schedule(c.cron, () => {
        console.log(`[pipeline] ${c.id}: tick`);
        void runJobWithLock(c.id, async (entry) => {
          this.state.jobs[c.id].last_run = entry;
          if (entry.status === 'completed') {
            this.state.jobs[c.id].last_success = entry;
          }
          this.state.last_updated = new Date().toISOString();
          await writeHeartbeat(this.state).catch((err) =>
            console.error('[pipeline] heartbeat write failed:', err)
          );
        }).catch((err) => {
          console.error(`[pipeline] ${c.id}: unhandled error:`, err);
        });
      });
      this.tasks.set(c.id, task);
    }
  }

  stop(): void {
    for (const [, task] of this.tasks) task.stop();
    this.tasks.clear();
  }

  /**
   * Fire every enabled job exactly once, in sequence, and return the log
   * entries. Useful for manual kickoff (`npm run pipeline:once`) or for
   * integration tests that want to exercise the full pipeline quickly.
   */
  async runOnce(): Promise<PipelineLogEntry[]> {
    const entries: PipelineLogEntry[] = [];
    for (const c of this.configs) {
      if (!c.enabled) {
        entries.push({
          job: c.id,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          status: 'skipped',
          duration_ms: 0,
          detail: 'job disabled in config',
        });
        continue;
      }
      const entry = await runJobWithLock(c.id, async () => {});
      this.state.jobs[c.id].last_run = entry;
      if (entry.status === 'completed') this.state.jobs[c.id].last_success = entry;
      entries.push(entry);
    }
    this.state.last_updated = new Date().toISOString();
    await writeHeartbeat(this.state).catch(() => {});
    return entries;
  }

  getState(): PipelineHeartbeat {
    return this.state;
  }
}

/**
 * Internal test hooks — not part of the public API.
 * @internal
 */
export const __internals = { runJob, runJobWithLock, HEARTBEAT_PATH, LOG_PATH };
