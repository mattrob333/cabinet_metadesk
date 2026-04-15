/**
 * Run Index Builder
 *
 * Cabinet's sidebar/tree already renders any directory under `data/` for free —
 * so `data/runs/*` shows up automatically once a debate runs. The problem is
 * the UX: run IDs like `2026-04-11T15-07-15` are ugly, and each run's folder
 * contains 5-10 markdown files with no entry point.
 *
 * This module fixes both problems by writing:
 *   - data/runs/{runId}/index.md         — one per run, describes the run
 *   - data/runs/index.md                 — top-level, lists all runs
 *
 * Both files are auto-regenerated. Both have YAML frontmatter with
 * `title`/`icon`/`order` so the tree renders a friendly name instead of the
 * raw run ID.
 *
 * Invoked by DebateWorkflowOrchestrator at lifecycle points (run start,
 * complete, fail) so the index is always current. Also exposed via
 * `npm run runs:index` for retroactive regeneration of existing runs.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  listRuns,
  loadRunDetail,
  type DebateRunMeta,
  type DebateRunDetail,
} from './debate-reader';
import { countGaps, type RefereeSynthesisCounts } from '../agents/resolution/referee-synthesizer';

const DATA_DIR = path.join(process.cwd(), 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');

/**
 * Human-readable title for a run — used as the sidebar label.
 * Example: "2026-04-11 15:07 UTC — completed"
 */
export function runTitle(meta: DebateRunMeta): string {
  // runId is YYYY-MM-DDTHH-mm-SS — we want to render it as HH:MM UTC.
  const [date, time] = meta.id.split('T');
  const [hh, mm] = (time || '').split('-');
  const clock = hh && mm ? `${hh}:${mm} UTC` : time || '';
  return `${date} ${clock} — ${meta.status}`;
}

/**
 * Icon hint for tree rendering. Uses emoji (consistent with Cabinet's
 * existing persona emojis); one-per-status.
 */
function runIcon(status: DebateRunMeta['status']): string {
  switch (status) {
    case 'completed':
      return '\u2696\ufe0f'; // ⚖️
    case 'failed':
      return '\u274c'; // ❌
    case 'running':
    default:
      return '\u23f3'; // ⏳
  }
}

/** Short "1R/1P/1U" summary from a RefereeSynthesisCounts object. */
export function countsSummary(counts: RefereeSynthesisCounts): string {
  if (counts.total === 0) return '—';
  const parts: string[] = [];
  if (counts.resolved) parts.push(`${counts.resolved}R`);
  if (counts.partially_resolved) parts.push(`${counts.partially_resolved}P`);
  if (counts.unresolvable) parts.push(`${counts.unresolvable}U`);
  if (counts.pending) parts.push(`${counts.pending}!`);
  return `${counts.total} (${parts.join('/')})`;
}

/**
 * Build the markdown body for a single run's `index.md`.
 * Pure function — easy to unit-test.
 */
export function renderRunIndex(detail: DebateRunDetail): string {
  const counts = countGaps(detail.gaps);
  const lines: string[] = [];

  lines.push('---');
  lines.push(`title: "${runTitle(detail)}"`);
  lines.push(`icon: "${runIcon(detail.status)}"`);
  // Newer runs first in the tree sort.
  lines.push('order: 1');
  lines.push('---');
  lines.push('');
  lines.push(`# Debate Run ${detail.id}`);
  lines.push('');
  lines.push(`**Status:** ${detail.status}`);
  lines.push(`**Date:** ${detail.date}`);
  lines.push(`**Created:** ${detail.created_at}`);
  if (detail.completed_at) lines.push(`**Completed:** ${detail.completed_at}`);
  if (detail.error) lines.push(`**Error:** \`${detail.error}\``);
  if (detail.has_workflow_failure) {
    lines.push('');
    lines.push(
      '> ⚠️ **WORKFLOW_FAILURE** — the Resolution Round hit max iterations without Skeptic approval. See `WORKFLOW_FAILURE.md`.'
    );
  }
  lines.push('');

  // Artifacts — relative links so they work inside the Cabinet editor.
  lines.push('## Artifacts');
  lines.push('');
  if (detail.referee_report) {
    lines.push(`- [**Referee Report**](./referee_report.md) — final synthesis`);
  }
  if (detail.gaps_markdown) lines.push('- [Gaps](./gaps.md) — extracted research questions');
  if (detail.iteration_log) {
    lines.push('- [Iteration Log](./iteration_log.md) — resolution round iteration-by-iteration');
  }
  if (detail.skeptic_challenges) {
    lines.push('- [Skeptic Challenges](./skeptic_challenges.md)');
  }
  const agentNames = Object.keys(detail.analyses).sort();
  if (agentNames.length > 0) {
    const analysisLinks = agentNames.map((n) => `[${n}](./analyses/${n}.md)`).join(', ');
    lines.push(`- Per-agent analyses: ${analysisLinks}`);
  }
  if (detail.has_workflow_failure) {
    lines.push('- [⚠️ WORKFLOW_FAILURE.md](./WORKFLOW_FAILURE.md)');
  }
  lines.push('');

  // Gap summary table — only if there are gaps. Otherwise the run was either
  // too early (observations-phase failure) or had no Skeptic challenges.
  if (detail.gaps.length > 0) {
    lines.push('## Gap Summary');
    lines.push('');
    lines.push(
      `${counts.total} gap${counts.total === 1 ? '' : 's'}: **${counts.resolved} RESOLVED**, ${counts.partially_resolved} PARTIALLY_RESOLVED, ${counts.unresolvable} UNRESOLVABLE${counts.pending ? `, ${counts.pending} PENDING` : ''}`
    );
    lines.push('');
    lines.push('| State | Question | Entity | Assigned To |');
    lines.push('|-------|----------|--------|-------------|');
    for (const g of detail.gaps) {
      const question = g.question.replace(/\|/g, '\\|').slice(0, 120);
      const entity = g.entity ?? '—';
      lines.push(`| ${g.state} | ${question} | ${entity} | ${g.assigned_to} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build the markdown body for the top-level `data/runs/index.md`.
 * Pure function — takes the run metas + their counts (fetched ahead of time).
 */
export function renderRunsRootIndex(
  rows: Array<{ meta: DebateRunMeta; counts: RefereeSynthesisCounts }>
): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('title: "Debate Runs"');
  lines.push('icon: "\u2696\ufe0f"'); // ⚖️
  lines.push('order: 10');
  lines.push('---');
  lines.push('');
  lines.push('# Debate Runs');
  lines.push('');
  lines.push(
    `${rows.length} run${rows.length === 1 ? '' : 's'} recorded. Newest first. Auto-generated after each debate — do not edit by hand.`
  );
  lines.push('');

  if (rows.length === 0) {
    lines.push(
      'No runs yet. Trigger one with `npm run debate` or enable the scheduled `debate` job in the pipeline scheduler.'
    );
    return lines.join('\n');
  }

  lines.push('| Date | Time | Status | Gaps (R/P/U) | Referee | Folder |');
  lines.push('|------|------|--------|--------------|---------|--------|');
  for (const { meta, counts } of rows) {
    const [, time] = meta.id.split('T');
    const [hh, mm] = (time || '').split('-');
    const clock = hh && mm ? `${hh}:${mm}` : time || '';
    const folderLink = `[${meta.id}](./${meta.id}/)`;
    const refereeLink = `[report](./${meta.id}/referee_report.md)`;
    lines.push(
      `| ${meta.date} | ${clock} | ${meta.status} | ${countsSummary(counts)} | ${refereeLink} | ${folderLink} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Write `data/runs/{runId}/index.md` based on the run's current on-disk state.
 * Safe to call multiple times (idempotent: always overwrites).
 * Returns `null` if the run directory doesn't exist yet.
 */
export async function writeRunIndex(runId: string): Promise<string | null> {
  const detail = await loadRunDetail(runId);
  if (!detail) return null;

  const targetPath = path.join(RUNS_DIR, runId, 'index.md');
  const body = renderRunIndex(detail);
  await fs.writeFile(targetPath, body, 'utf-8');
  return targetPath;
}

/**
 * Regenerate `data/runs/index.md` from whatever is currently on disk.
 * Safe to call after a run completes (or retroactively via `npm run runs:index`).
 */
export async function writeRunsRootIndex(): Promise<string | null> {
  const runs = await listRuns();
  const rows: Array<{ meta: DebateRunMeta; counts: RefereeSynthesisCounts }> = [];
  for (const meta of runs) {
    const detail = await loadRunDetail(meta.id);
    rows.push({ meta, counts: countGaps(detail?.gaps ?? []) });
  }

  // If there are no runs, we don't create an empty directory; return null.
  try {
    await fs.mkdir(RUNS_DIR, { recursive: true });
  } catch {
    return null;
  }

  const targetPath = path.join(RUNS_DIR, 'index.md');
  await fs.writeFile(targetPath, renderRunsRootIndex(rows), 'utf-8');
  return targetPath;
}

/** Convenience: write both per-run and root indexes in one call. */
export async function rebuildAllRunIndexes(): Promise<{
  perRun: string[];
  root: string | null;
}> {
  const runs = await listRuns();
  const perRun: string[] = [];
  for (const meta of runs) {
    const p = await writeRunIndex(meta.id);
    if (p) perRun.push(p);
  }
  const root = await writeRunsRootIndex();
  return { perRun, root };
}
