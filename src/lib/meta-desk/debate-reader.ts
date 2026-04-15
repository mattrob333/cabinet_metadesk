/**
 * Debate Reader
 *
 * Loads debate workflow artifacts (daily briefs + run outputs) from disk so
 * the /api/meta-desk/* endpoints can expose them to MemeLabz without the
 * consumer needing filesystem access.
 *
 * On-disk contract (written by src/lib/agents/debate-workflow.ts):
 *   data/meta-desk/daily-briefs/{YYYY-MM-DD}.md
 *   data/runs/{runId}/run.json
 *   data/runs/{runId}/referee_report.md
 *   data/runs/{runId}/gaps.md
 *   data/runs/{runId}/iteration_log.md
 *   data/runs/{runId}/skeptic_challenges.md
 *   data/runs/{runId}/analyses/{agent}.md
 *   data/runs/{runId}/resolutions/{agent}_iteration_{n}.md
 *
 * Run IDs start with an ISO date like `2026-04-11T14-30-00`, so we treat
 * the leading `YYYY-MM-DD` as the bucket for "brief for that day".
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import type { Gap } from '../agents/debate-workflow';

const DATA_DIR = path.join(process.cwd(), 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const BRIEFS_DIR = path.join(DATA_DIR, 'meta-desk', 'daily-briefs');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const RUN_ID_REGEX = /^\d{4}-\d{2}-\d{2}T[\d-]+$/;

export interface DailyBrief {
  date: string;
  path: string;
  frontmatter: Record<string, unknown>;
  body_markdown: string;
  agents: Record<string, string>;
}

export interface DebateRunMeta {
  id: string;
  date: string;
  status: 'running' | 'completed' | 'failed';
  phase: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface DebateRunDetail extends DebateRunMeta {
  referee_report: string | null;
  gaps_markdown: string | null;
  gaps: Gap[];
  iteration_log: string | null;
  skeptic_challenges: string | null;
  analyses: Record<string, string>;
  has_workflow_failure: boolean;
}

/**
 * Validate that a YYYY-MM-DD string is well-formed and represents a real date.
 * Rejects anything that could be used for path traversal.
 */
export function isValidDate(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

/**
 * Validate a run id (date prefix + `T` + hyphen-separated time).
 */
export function isValidRunId(id: string): boolean {
  return RUN_ID_REGEX.test(id);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extract `## <Agent>` sections from a markdown brief into a map.
 */
function splitAgentSections(body: string): Record<string, string> {
  const agents = ['Historian', 'Scout', 'Aesthetician', 'Translator', 'Skeptic', 'Referee'];
  const sections: Record<string, string> = {};
  for (const agent of agents) {
    const re = new RegExp(`## ${agent}([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = body.match(re);
    if (match) sections[agent.toLowerCase()] = match[1].trim();
  }
  return sections;
}

/**
 * Load a daily brief written to data/meta-desk/daily-briefs/{date}.md.
 * Returns null if the file doesn't exist.
 */
export async function loadDailyBrief(date: string): Promise<DailyBrief | null> {
  if (!isValidDate(date)) return null;
  const briefPath = path.join(BRIEFS_DIR, `${date}.md`);
  const raw = await readFileIfExists(briefPath);
  if (raw === null) return null;

  const parsed = matter(raw);
  return {
    date,
    path: briefPath,
    frontmatter: parsed.data ?? {},
    body_markdown: parsed.content,
    agents: splitAgentSections(parsed.content),
  };
}

/**
 * List all debate run directories, newest first.
 * Filters out anything that doesn't look like a run id to avoid leaking other content.
 */
export async function listRuns(): Promise<DebateRunMeta[]> {
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true }).catch(() => []);
  const runs: DebateRunMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidRunId(entry.name)) continue;
    const meta = await loadRunMeta(entry.name);
    if (meta) runs.push(meta);
  }
  // Newest first (lexicographic works on ISO-ish run IDs).
  runs.sort((a, b) => b.id.localeCompare(a.id));
  return runs;
}

/**
 * List runs whose date prefix matches the given YYYY-MM-DD, newest first.
 */
export async function listRunsForDate(date: string): Promise<DebateRunMeta[]> {
  if (!isValidDate(date)) return [];
  const all = await listRuns();
  return all.filter((r) => r.date === date);
}

/**
 * Pick the most recent completed run for a given date (or the most recent
 * run of any status if none completed). Returns null if there are no runs.
 */
export async function pickLatestRunForDate(date: string): Promise<DebateRunMeta | null> {
  const runs = await listRunsForDate(date);
  if (runs.length === 0) return null;
  return runs.find((r) => r.status === 'completed') ?? runs[0];
}

/**
 * Load only the run.json metadata for a single run.
 */
export async function loadRunMeta(runId: string): Promise<DebateRunMeta | null> {
  if (!isValidRunId(runId)) return null;
  const metaPath = path.join(RUNS_DIR, runId, 'run.json');
  const raw = await readFileIfExists(metaPath);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as DebateRunMeta;
    // Defensive defaults for older runs that might be missing fields.
    return {
      id: parsed.id ?? runId,
      date: parsed.date ?? runId.split('T')[0],
      status: parsed.status ?? 'running',
      phase: parsed.phase ?? 'unknown',
      created_at: parsed.created_at ?? '',
      completed_at: parsed.completed_at,
      error: parsed.error,
    };
  } catch {
    return null;
  }
}

/**
 * Parse gaps.md back into structured Gap objects.
 * The markdown is written by DebateWorkflowOrchestrator.formatGapsMarkdown,
 * which uses a deterministic `## Gap {id}` / `- **Field:** value` shape.
 */
function parseGapsMarkdown(md: string): Gap[] {
  const gaps: Gap[] = [];
  const sections = md.split(/\n## Gap /g).slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const gapId = `gap_${lines[0].trim().replace(/^gap_/, '')}`;
    const get = (label: string) => {
      const re = new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'm');
      return section.match(re)?.[1]?.trim() ?? '';
    };
    const state = (get('State') || 'PENDING') as Gap['state'];
    gaps.push({
      gap_id: gapId,
      question: get('Question'),
      source_agent: get('Source Agent'),
      blocking_claim: get('Blocking Claim'),
      assigned_to: get('Assigned To'),
      state,
    });
  }
  return gaps;
}

/**
 * Load every artifact for a single run. Missing files are returned as null
 * rather than throwing — a run might still be in progress.
 */
export async function loadRunDetail(runId: string): Promise<DebateRunDetail | null> {
  const meta = await loadRunMeta(runId);
  if (!meta) return null;

  const runDir = path.join(RUNS_DIR, runId);
  const [
    refereeReport,
    gapsMarkdown,
    iterationLog,
    skepticChallenges,
    workflowFailureExists,
  ] = await Promise.all([
    readFileIfExists(path.join(runDir, 'referee_report.md')),
    readFileIfExists(path.join(runDir, 'gaps.md')),
    readFileIfExists(path.join(runDir, 'iteration_log.md')),
    readFileIfExists(path.join(runDir, 'skeptic_challenges.md')),
    fileExists(path.join(runDir, 'WORKFLOW_FAILURE.md')),
  ]);

  // Collect per-agent analyses.
  const analyses: Record<string, string> = {};
  const analysesDir = path.join(runDir, 'analyses');
  const analysisFiles = await fs.readdir(analysesDir).catch(() => [] as string[]);
  for (const f of analysisFiles) {
    if (!f.endsWith('.md')) continue;
    const content = await readFileIfExists(path.join(analysesDir, f));
    if (content !== null) analyses[path.basename(f, '.md')] = content;
  }

  return {
    ...meta,
    referee_report: refereeReport,
    gaps_markdown: gapsMarkdown,
    gaps: gapsMarkdown ? parseGapsMarkdown(gapsMarkdown) : [],
    iteration_log: iterationLog,
    skeptic_challenges: skepticChallenges,
    analyses,
    has_workflow_failure: workflowFailureExists,
  };
}
