#!/usr/bin/env tsx
/**
 * Meta Desk Pipeline Scheduler CLI
 *
 * Run modes:
 *   npm run dev:pipeline        # start the long-running cron loop
 *   npm run pipeline:once       # run every enabled job once and exit
 *   npm run pipeline:once -- --job=dex   # run a single job and exit
 *
 * Keys are loaded from .env (same as the debate + scraper CLIs). Jobs whose
 * required keys are missing auto-disable rather than 500 at tick time.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PipelineScheduler, defaultConfig, type PipelineJobId } from '../src/lib/meta-desk/pipeline-scheduler';

const VALID_JOB_IDS: PipelineJobId[] = ['dex', 'x', 'debate'];

function parseArgs(argv: string[]): { once: boolean; only?: PipelineJobId } {
  const once = argv.includes('--once');
  const onlyArg = argv.find((a) => a.startsWith('--job='));
  const only = onlyArg ? (onlyArg.slice('--job='.length) as PipelineJobId) : undefined;
  if (only && !VALID_JOB_IDS.includes(only)) {
    console.error(`Invalid --job value: ${only}. Must be one of: ${VALID_JOB_IDS.join(', ')}`);
    process.exit(2);
  }
  return { once, only };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configs = defaultConfig().map((c) => {
    // If --job is set, disable everything except that one.
    if (args.only && c.id !== args.only) return { ...c, enabled: false };
    return c;
  });

  console.log('='.repeat(60));
  console.log('Meta Desk Pipeline Scheduler');
  console.log('='.repeat(60));
  for (const c of configs) {
    console.log(`  ${c.id.padEnd(8)} ${c.enabled ? 'ENABLED ' : 'DISABLED'}  ${c.cron}  — ${c.description}`);
  }
  console.log('');

  const scheduler = new PipelineScheduler(configs);

  if (args.once) {
    console.log('[scheduler] Running all enabled jobs once…');
    const entries = await scheduler.runOnce();
    console.log('');
    console.log('Results:');
    for (const entry of entries) {
      console.log(
        `  [${entry.status.toUpperCase().padEnd(9)}] ${entry.job.padEnd(8)} ${entry.duration_ms}ms ${entry.detail ?? entry.error ?? ''}`
      );
    }
    const anyFailed = entries.some((e) => e.status === 'failed');
    process.exit(anyFailed ? 1 : 0);
  }

  await scheduler.start();
  console.log('[scheduler] Running. Ctrl-C to stop.');

  const shutdown = (signal: string) => {
    console.log(`\n[scheduler] Received ${signal}, stopping…`);
    scheduler.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Scheduler crashed:', err);
  process.exit(1);
});
