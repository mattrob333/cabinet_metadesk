#!/usr/bin/env tsx
/**
 * CLI tool to trigger Agent Debate workflow runs
 *
 * Usage:
 *   npm run debate           # Auto-trigger for today's brief
 *   npm run debate 2026-04-11  # Trigger for specific date
 *   npm run debate --run-id 2026-04-11T14-30-00  # Resume/replay specific run
 */

// Load environment variables from .env
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { triggerDebateRun } from '../src/lib/agents/debate-workflow';

async function main() {
  const args = process.argv.slice(2);

  let runId: string | undefined;

  if (args.length === 0) {
    // Auto-trigger for today
    const today = new Date().toISOString().split('T')[0];
    runId = `${today}T${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`;
    console.log(`Triggering debate run for today: ${runId}`);
  } else if (args[0] === '--run-id' && args[1]) {
    // Specific run ID provided
    runId = args[1];
    console.log(`Triggering debate run: ${runId}`);
  } else if (args[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Date provided (YYYY-MM-DD)
    const date = args[0];
    runId = `${date}T${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`;
    console.log(`Triggering debate run for ${date}: ${runId}`);
  } else {
    console.error('Invalid arguments. Usage:');
    console.error('  npm run debate');
    console.error('  npm run debate 2026-04-11');
    console.error('  npm run debate --run-id 2026-04-11T14-30-00');
    process.exit(1);
  }

  try {
    await triggerDebateRun(runId);
    console.log('✅ Debate run completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Debate run failed:', error);
    process.exit(1);
  }
}

main();
