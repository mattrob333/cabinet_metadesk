/**
 * Referee Synthesizer
 *
 * Produces the final `referee_report.md` for a debate run by stratifying
 * gaps from the Resolution Round into confidence tiers:
 *
 *   - RESOLVED          → "High-Confidence Signals" — main analysis
 *   - PARTIALLY_RESOLVED → "Cautious Signals" — caveats required
 *   - UNRESOLVABLE       → "Watching" — insufficient data, not the thesis
 *   - PENDING            → "Incomplete" — Resolution Round didn't terminate
 *
 * This replaces the `executeRefereeSynthesis` stub in debate-workflow.ts,
 * which was hardcoded to write an empty file. The deterministic path here
 * is pure, testable, and produces real value without requiring an LLM call.
 *
 * An optional LLM pass (`synthesizeWithLLM`) layers a narrative paragraph
 * on top. It runs when `REFEREE_USE_LLM=true` and both ANTHROPIC_API_KEY
 * and a valid Gap set are present. Failure in the LLM pass degrades
 * gracefully to the deterministic output, never blocking the debate.
 */

import type { Gap } from '../debate-workflow';

export type GapBucket = 'RESOLVED' | 'PARTIALLY_RESOLVED' | 'UNRESOLVABLE' | 'PENDING';

export interface RefereeSynthesisCounts {
  total: number;
  resolved: number;
  partially_resolved: number;
  unresolvable: number;
  pending: number;
}

export function countGaps(gaps: Gap[]): RefereeSynthesisCounts {
  const counts: RefereeSynthesisCounts = {
    total: gaps.length,
    resolved: 0,
    partially_resolved: 0,
    unresolvable: 0,
    pending: 0,
  };
  for (const g of gaps) {
    if (g.state === 'RESOLVED') counts.resolved++;
    else if (g.state === 'PARTIALLY_RESOLVED') counts.partially_resolved++;
    else if (g.state === 'UNRESOLVABLE') counts.unresolvable++;
    else counts.pending++;
  }
  return counts;
}

function groupByState(gaps: Gap[]): Record<GapBucket, Gap[]> {
  const buckets: Record<GapBucket, Gap[]> = {
    RESOLVED: [],
    PARTIALLY_RESOLVED: [],
    UNRESOLVABLE: [],
    PENDING: [],
  };
  for (const g of gaps) buckets[g.state].push(g);
  return buckets;
}

function formatSources(sources: string[] | undefined): string {
  if (!sources || sources.length === 0) return '';
  return sources.map((s) => `  - ${s}`).join('\n');
}

function renderResolved(g: Gap): string {
  const entity = g.entity ? ` (${g.entity})` : '';
  const evidence = g.evidence ? g.evidence.trim() : '(no evidence recorded)';
  const sources = formatSources(g.sources);
  return [
    `- **${g.question}**${entity}`,
    `  ${evidence}`,
    sources ? `  Sources:\n${sources}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderPartial(g: Gap): string {
  const entity = g.entity ? ` (${g.entity})` : '';
  const evidence = g.evidence ? g.evidence.trim() : '(partial evidence)';
  const still = g.reason ? g.reason.trim() : 'unknown';
  const sources = formatSources(g.sources);
  return [
    `- **${g.question}**${entity}`,
    `  What we found: ${evidence}`,
    `  Still missing: ${still}`,
    sources ? `  Sources:\n${sources}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderUnresolvable(g: Gap): string {
  const entity = g.entity ? ` (${g.entity})` : '';
  const reason = g.reason ? g.reason.trim() : 'no reason recorded';
  const attempts = g.attempts ?? 1;
  return `- **${g.question}**${entity} — ${reason} (${attempts} attempt${attempts === 1 ? '' : 's'})`;
}

function renderPending(g: Gap): string {
  const entity = g.entity ? ` (${g.entity})` : '';
  return `- **${g.question}**${entity} — still PENDING (Resolution Round did not terminate this gap)`;
}

/**
 * Pure deterministic synthesis. Safe to call with any gap set — including
 * an empty one.
 */
export function synthesizeReferee(gaps: Gap[], date: string): string {
  const counts = countGaps(gaps);
  const buckets = groupByState(gaps);
  const now = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`# Referee Synthesis — ${date}`);
  lines.push('');
  lines.push(`_Generated: ${now}_`);
  lines.push('');
  lines.push('## Resolution Summary');
  lines.push('');
  lines.push(
    `${counts.total} gap${counts.total === 1 ? '' : 's'} processed: ` +
      `**${counts.resolved} RESOLVED**, ${counts.partially_resolved} PARTIALLY_RESOLVED, ` +
      `${counts.unresolvable} UNRESOLVABLE${counts.pending > 0 ? `, ${counts.pending} PENDING` : ''}.`
  );
  lines.push('');

  // High-confidence tier — this is the main thesis.
  lines.push('## High-Confidence Signals (RESOLVED)');
  lines.push('');
  if (buckets.RESOLVED.length === 0) {
    lines.push('_No gaps were fully resolved this run. Treat the entire brief as provisional._');
  } else {
    for (const g of buckets.RESOLVED) {
      lines.push(renderResolved(g));
      lines.push('');
    }
  }
  lines.push('');

  // Partial tier — legitimate signals but must be caveated.
  lines.push('## Cautious Signals (PARTIALLY_RESOLVED)');
  lines.push('');
  if (buckets.PARTIALLY_RESOLVED.length === 0) {
    lines.push('_None._');
  } else {
    for (const g of buckets.PARTIALLY_RESOLVED) {
      lines.push(renderPartial(g));
      lines.push('');
    }
  }
  lines.push('');

  // Watching tier — explicitly NOT the analysis. Kept visible so future
  // runs don't re-litigate, but downgraded from "main signal" status.
  lines.push('## Watching (Insufficient Data)');
  lines.push('');
  if (buckets.UNRESOLVABLE.length === 0) {
    lines.push('_None._');
  } else {
    for (const g of buckets.UNRESOLVABLE) lines.push(renderUnresolvable(g));
  }
  lines.push('');

  // PENDING tier — only appears when the Resolution Round failed to terminate
  // (i.e. the workflow surfaced a WORKFLOW_FAILURE.md). Kept loud.
  if (buckets.PENDING.length > 0) {
    lines.push('## Incomplete Gaps (PENDING — REQUIRES ATTENTION)');
    lines.push('');
    for (const g of buckets.PENDING) lines.push(renderPending(g));
    lines.push('');
  }

  // Portfolio read — a deterministic narrative derived from counts, not LLM.
  lines.push('## Portfolio-Level Read');
  lines.push('');
  lines.push(computePortfolioNarrative(counts));
  lines.push('');

  return lines.join('\n');
}

/**
 * Deterministic one-paragraph "read" derived purely from bucket counts.
 * Deliberately avoids inventing detail the gaps don't support.
 */
export function computePortfolioNarrative(counts: RefereeSynthesisCounts): string {
  if (counts.total === 0) {
    return 'No gaps were identified this run. Either the observation set was thin or the Skeptic had no challenges — review observations and Skeptic output before relying on this brief.';
  }

  const resolvedShare = counts.resolved / counts.total;

  if (counts.pending > 0) {
    return `Resolution Round did not terminate cleanly: ${counts.pending} gap${counts.pending === 1 ? '' : 's'} remain PENDING. Treat this brief as incomplete and review \`WORKFLOW_FAILURE.md\` before acting.`;
  }

  if (resolvedShare >= 0.7 && counts.unresolvable === 0) {
    return `Strong debate: ${counts.resolved}/${counts.total} gaps fully resolved with no unresolvables. High-confidence section can be read as the primary thesis. Cautious signals, if any, should be position-sized accordingly.`;
  }

  if (resolvedShare >= 0.4) {
    return `Mixed debate: ${counts.resolved}/${counts.total} gaps resolved, ${counts.partially_resolved} partial, ${counts.unresolvable} unresolvable. Trust the High-Confidence tier as the thesis; the Cautious tier is acceptable as supporting evidence but should not drive conviction on its own.`;
  }

  if (counts.resolved === 0 && counts.unresolvable >= counts.total * 0.5) {
    return `Weak debate: majority of gaps were unresolvable. This brief is provisional — the Watching tier dominates, which means the data to support a thesis is missing. Consider delaying action or expanding observation coverage.`;
  }

  return `Soft debate: ${counts.resolved}/${counts.total} gaps resolved. The thesis rests on a narrow high-confidence base. Position-size conservatively and prioritize closing the partial/unresolvable gaps in the next cycle.`;
}

/**
 * Optional LLM-narrated synthesis. Produces a richer "Portfolio-Level Read"
 * section by asking Claude Haiku to synthesize the bucketed gaps. Falls back
 * to the deterministic output if the API call fails or the env flag is off.
 *
 * Gated by:
 *   - REFEREE_USE_LLM=true
 *   - ANTHROPIC_API_KEY present
 *   - At least one RESOLVED or PARTIALLY_RESOLVED gap (no point otherwise)
 */
export async function synthesizeReferee_withOptionalLLM(
  gaps: Gap[],
  date: string
): Promise<string> {
  const deterministic = synthesizeReferee(gaps, date);

  const enabled = process.env.REFEREE_USE_LLM === 'true';
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const worthAsking =
    gaps.filter((g) => g.state === 'RESOLVED' || g.state === 'PARTIALLY_RESOLVED').length > 0;

  if (!enabled || !hasKey || !worthAsking) return deterministic;

  try {
    // Dynamic import so the SDK isn't required when the LLM path is off.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const model = process.env.REFEREE_MODEL || 'claude-haiku-4-5';

    const prompt = `You are a trading-desk Referee summarizing a crypto intelligence debate. The Skeptic challenged research agents' claims, and a Resolution Round confirmed or rejected each. Your job: write ONE paragraph (3-5 sentences, <120 words) for the "Portfolio-Level Read" section.

Gaps by state (JSON):
${JSON.stringify(
  gaps.map((g) => ({
    question: g.question,
    entity: g.entity,
    state: g.state,
    evidence: g.evidence?.slice(0, 300),
    reason: g.reason?.slice(0, 300),
  })),
  null,
  2
)}

Constraints:
- Never recommend specific trades.
- Refer to entities by their ticker/name, not "the token X".
- If the RESOLVED tier is thin, say so plainly.
- Do not invent detail beyond what the gaps contain.

Output ONLY the paragraph. No heading, no preamble.`;

    const response = await client.messages.create({
      model,
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') return deterministic;
    const narrative = textContent.text.trim();
    if (!narrative) return deterministic;

    // Swap the deterministic narrative paragraph for the LLM one. The sentinel
    // for the deterministic narrative is the fixed heading + the first
    // deterministic paragraph we wrote; we do a straight string replace on
    // the last "## Portfolio-Level Read" block.
    return deterministic.replace(
      /## Portfolio-Level Read\n\n[\s\S]*?\n\n$/,
      `## Portfolio-Level Read\n\n${narrative}\n\n`
    );
  } catch (err) {
    console.warn(
      '[Referee] LLM narration failed, falling back to deterministic output:',
      err instanceof Error ? err.message : err
    );
    return deterministic;
  }
}
