#!/usr/bin/env tsx
/**
 * Regenerate `data/runs/index.md` and every `data/runs/{runId}/index.md`
 * from the on-disk run artifacts. Safe to run any time — it never deletes
 * or modifies the real run outputs (run.json, gaps.md, referee_report.md,
 * etc.), only the index files it owns.
 *
 * Useful after:
 *   - Upgrading this codebase (old runs pre-date the index feature)
 *   - Manually deleting a run folder (stale entries disappear from the root
 *     index on next run)
 *   - Editing referee_report.md by hand and wanting the root table refreshed
 */

import { rebuildAllRunIndexes } from '../src/lib/meta-desk/run-index-builder';

async function main() {
  const { perRun, root } = await rebuildAllRunIndexes();
  console.log(`Rebuilt ${perRun.length} per-run index file${perRun.length === 1 ? '' : 's'}.`);
  for (const p of perRun) console.log(`  - ${p}`);
  if (root) console.log(`Top-level index: ${root}`);
  else console.log('No runs found; top-level index not written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
