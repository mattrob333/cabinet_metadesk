#!/usr/bin/env tsx
/**
 * Seeds a realistic completed-debate fixture on disk:
 *   - data/meta-desk/daily-briefs/{date}.md
 *   - data/runs/{date}T15-07-15/run.json + referee_report.md + gaps.md + ...
 *   - data/ledger.json + data/ledger.md
 *
 * Used for smoke-testing the new /api/meta-desk/briefs/[date] and
 * /api/meta-desk/ledger endpoints without requiring live Anthropic/Tavily
 * API calls. Safe to delete once a real debate run has landed.
 *
 * Usage: npx tsx scripts/seed-debate-fixture.ts [YYYY-MM-DD]
 */

import fs from 'fs/promises';
import path from 'path';
import type { Ledger } from '../src/lib/agents/resolution/ledger-manager';

const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
  const date = process.argv[2] || new Date().toISOString().split('T')[0];
  const runId = `${date}T15-07-15`;
  const runDir = path.join(DATA_DIR, 'runs', runId);
  const briefsDir = path.join(DATA_DIR, 'meta-desk', 'daily-briefs');

  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(path.join(runDir, 'analyses'), { recursive: true });
  await fs.mkdir(path.join(runDir, 'resolutions'), { recursive: true });
  await fs.mkdir(briefsDir, { recursive: true });

  // --- Daily brief -----------------------------------------------------------
  const brief = `---
date: ${date}
title: "Meta Desk Daily Brief — ${date}"
generated_by: meta-desk-heartbeat
version: 1.0
---

# Meta Desk Daily Brief — ${date}

## Historian

Agentic payments narrative entered cycle 4 this week. Pattern resembles Q4 2024
memecoin cycle: rapid entity proliferation followed by consolidation around
2-3 dominant narratives. Cross-reference to Fartcoin's trajectory Sept 2024.

## Scout

SNIGGA launched on pump.fun 5 days ago, now at $11.7M mcap with +441% 24h move.
On-chain shows 12.4K txns and $1.24M liquidity. PENGU continues steady climb
since IPO, now $38.4M mcap. Launch date for SNIGGA contract: 2026-04-10 per
solscan, but official announcement date remains unverified.

## Aesthetician

SNIGGA artwork observed on pump.fun listing — stylized inu with neon accents,
but no full mascot or character sheet visible. PENGU has full character design
and brand consistency across site + socials (screenshot test passes all three
audiences).

## Translator

Minimal cross-cultural signal for SNIGGA (no Japanese/Korean/Chinese CT
chatter detected). PENGU retains strong Japanese community engagement.

## Skeptic

Three gaps block a confident read:
1. SNIGGA launch date claimed as 2026-04-10 but no official announcement
   verified — contract creation timestamp alone is unreliable for pump.fun tokens.
2. SNIGGA character visuals incomplete — listing logo exists but screenshot
   test requires full character work across 3 audiences.
3. Claimed "14.8M agent-related transactions" in March needs on-chain
   verification — press-release citations are circular.

## Referee

Pending Resolution Round completion before synthesis.
`;
  await fs.writeFile(path.join(briefsDir, `${date}.md`), brief);

  // --- Run metadata ----------------------------------------------------------
  const runMeta = {
    id: runId,
    date,
    status: 'completed',
    phase: 'complete',
    created_at: `${date}T15:07:15Z`,
    completed_at: `${date}T15:42:03Z`,
  };
  await fs.writeFile(path.join(runDir, 'run.json'), JSON.stringify(runMeta, null, 2));

  // --- Agent analyses (copied from brief, mirroring debate-workflow.ts) ------
  await fs.writeFile(
    path.join(runDir, 'analyses', 'historian.md'),
    'Agentic payments narrative entered cycle 4 this week. Pattern resembles Q4 2024 memecoin cycle...'
  );
  await fs.writeFile(
    path.join(runDir, 'analyses', 'scout.md'),
    'SNIGGA launched on pump.fun 5 days ago, now at $11.7M mcap...'
  );
  await fs.writeFile(
    path.join(runDir, 'analyses', 'aesthetician.md'),
    'SNIGGA artwork observed on pump.fun listing — stylized inu with neon accents...'
  );
  await fs.writeFile(
    path.join(runDir, 'analyses', 'translator.md'),
    'Minimal cross-cultural signal for SNIGGA...'
  );

  // --- Skeptic challenges ----------------------------------------------------
  await fs.writeFile(
    path.join(runDir, 'skeptic_challenges.md'),
    `# Skeptic Challenges

1. SNIGGA launch date claimed as 2026-04-10 but no official announcement verified.
2. SNIGGA character visuals incomplete.
3. "14.8M agent-related transactions" in March needs on-chain verification.
`
  );

  // --- Gaps (must match GapExtractor's formatGapsMarkdown contract) ----------
  const gapsMd = `# Extracted Gaps

Total gaps: 3

## Gap gap_1

- **Question:** When did SNIGGA launch?
- **Source Agent:** skeptic
- **Blocking Claim:** SNIGGA launch date claimed as 2026-04-10 but no official announcement verified
- **Assigned To:** scout
- **State:** PARTIALLY_RESOLVED

## Gap gap_2

- **Question:** What are SNIGGA's character visuals?
- **Source Agent:** skeptic
- **Blocking Claim:** SNIGGA character visuals incomplete — listing logo exists but screenshot test requires full character work
- **Assigned To:** aesthetician
- **State:** PARTIALLY_RESOLVED

## Gap gap_3

- **Question:** Can we verify the 14.8M March agent-transaction count?
- **Source Agent:** skeptic
- **Blocking Claim:** Claimed 14.8M agent-related transactions in March needs on-chain verification
- **Assigned To:** scout
- **State:** RESOLVED
`;
  await fs.writeFile(path.join(runDir, 'gaps.md'), gapsMd);

  // --- Referee report --------------------------------------------------------
  await fs.writeFile(
    path.join(runDir, 'referee_report.md'),
    `# Referee Synthesis — ${date}

## High-Confidence Signals (RESOLVED)

- **Agent payments volume March 2026**: 14.8M transactions confirmed via
  Solana Foundation blog + Helius RPC data + solscan cross-reference. Narrative
  thesis holds.

## Cautious Signals (PARTIALLY_RESOLVED)

- **SNIGGA launch**: Contract creation 2026-04-10 confirmed on solscan,
  but no official announcement post found. Treat ticker age as "5 days on
  chain, origin unverified."
- **SNIGGA visuals**: Listing logo confirmed, but screenshot test cannot
  complete without full character sheet. Hold on "strong visual" thesis.

## Watching (Insufficient Data)

None this run.

## Portfolio-Level Read

PENGU remains the highest-confidence meme position (FULL ledger state).
SNIGGA is a speculative play — on-chain momentum is real but provenance is
thin; size position accordingly.
`
  );

  // --- Iteration log ---------------------------------------------------------
  await fs.writeFile(
    path.join(runDir, 'iteration_log.md'),
    `# Resolution Round Iteration Log

## Iteration 1

- **Timestamp:** ${date}T15:22:48Z
- **Gaps Resolved:** 1
- **Gaps Flipped:** 0
- **Delta:** Gap gap_3: PENDING → RESOLVED; Gap gap_1: PENDING → PARTIALLY_RESOLVED; Gap gap_2: PENDING → PARTIALLY_RESOLVED
`
  );

  // --- Ledger ----------------------------------------------------------------
  const ledger: Ledger = {
    entities: {
      PENGU: {
        type: 'token',
        first_seen: '2026-01-12T00:00:00Z',
        last_updated: `${date}T15:42:03Z`,
        resolved_facts: [
          {
            claim: 'What are PENGU\'s character visuals?',
            source: 'https://pudgypenguins.com, https://x.com/pudgy_penguins',
            resolved_at: '2026-02-04T00:00:00Z',
            run_id: '2026-02-04T09-00-00',
          },
          {
            claim: 'When did PENGU launch?',
            source: 'https://pudgypenguins.com/press/launch',
            resolved_at: '2026-01-12T00:00:00Z',
            run_id: '2026-01-12T09-00-00',
          },
          {
            claim: 'Japanese community engagement verified?',
            source: 'https://x.com/pudgy_penguins_jp, Xiaohongshu thread volume metrics',
            resolved_at: '2026-03-08T00:00:00Z',
            run_id: '2026-03-08T09-00-00',
          },
        ],
        unresolvable_gaps: [],
        open_gaps: [],
        confidence_state: 'FULL',
      },
      SNIGGA: {
        type: 'token',
        first_seen: `${date}T15:07:15Z`,
        last_updated: `${date}T15:42:03Z`,
        resolved_facts: [],
        unresolvable_gaps: [],
        open_gaps: [
          'When did SNIGGA launch?',
          "What are SNIGGA's character visuals?",
        ],
        confidence_state: 'MINIMAL',
      },
      'Agentic Payments': {
        type: 'narrative',
        first_seen: '2026-03-15T00:00:00Z',
        last_updated: `${date}T15:42:03Z`,
        resolved_facts: [
          {
            claim: 'Can we verify the 14.8M March agent-transaction count?',
            source: 'https://solana.com/blog/agentic-payments-march-2026, https://solscan.io/analytics/agents',
            resolved_at: `${date}T15:34:12Z`,
            run_id: runId,
          },
        ],
        unresolvable_gaps: [],
        open_gaps: [],
        confidence_state: 'PARTIAL',
      },
    },
    last_updated: `${date}T15:42:03Z`,
    version: '1.0.0',
  };
  await fs.writeFile(path.join(DATA_DIR, 'ledger.json'), JSON.stringify(ledger, null, 2));

  console.log(`Seeded debate fixture:`);
  console.log(`  Brief: data/meta-desk/daily-briefs/${date}.md`);
  console.log(`  Run:   data/runs/${runId}/`);
  console.log(`  Ledger: data/ledger.json (3 entities: PENGU=FULL, Agentic Payments=PARTIAL, SNIGGA=MINIMAL)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
