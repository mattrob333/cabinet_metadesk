/**
 * Integration tests for LedgerManager.
 *
 * Feeds realistic gap inputs — including the exact sentence-fragment pattern
 * that used to poison `data/ledger.json` per META_DESK_REALITY_CHECK.md:158 —
 * and verifies that the produced ledger has clean entity names.
 *
 * Uses a temp directory so the test doesn't touch the repo's real ledger.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Gap } from '../debate-workflow';

// The LedgerManager resolves paths relative to process.cwd(), so we swap cwd
// to a tmp dir for the duration of the test.
let tmpDir: string;
let originalCwd: string;
let LedgerManager: typeof import('./ledger-manager').LedgerManager;

describe('LedgerManager.updateFromRun', () => {
  before(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-ledger-test-'));
    await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true });
    process.chdir(tmpDir);
    // Import AFTER chdir so the module's LEDGER_PATH resolves to our tmp dir.
    ({ LedgerManager } = await import('./ledger-manager'));
  });

  after(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('produces clean entity names for realistic gap inputs', async () => {
    const manager = new LedgerManager();

    const gaps: Gap[] = [
      {
        gap_id: 'gap_1',
        question: "What are SNIGGA's character visuals?",
        source_agent: 'skeptic',
        blocking_claim: 'SNIGGA listing logo exists but screenshot test fails',
        assigned_to: 'aesthetician',
        state: 'PARTIALLY_RESOLVED',
      },
      {
        gap_id: 'gap_2',
        question: 'Can we verify the 14.8M March agent-transaction count?',
        source_agent: 'skeptic',
        blocking_claim: 'Agentic payments volume unconfirmed',
        assigned_to: 'scout',
        state: 'RESOLVED',
        evidence: 'Confirmed via solscan',
        sources: ['https://solscan.io/analytics/agents'],
      },
      // This is the bug-trigger shape: quoted sentence fragment in question.
      // The old extractor would have stored `" without seeing actual images"`
      // as an entity key. The new one must not.
      {
        gap_id: 'gap_3',
        question: 'We cannot evaluate BONK art "without seeing actual images"',
        source_agent: 'skeptic',
        blocking_claim: 'Visual gap for BONK: cannot complete screenshot test',
        assigned_to: 'aesthetician',
        state: 'UNRESOLVABLE',
        reason: 'No image artifacts available',
        attempts: 3,
      },
    ];

    await manager.updateFromRun('test-run-1', gaps);

    const ledger = await manager.load();
    const entityNames = Object.keys(ledger.entities);

    // Clean entities must be present.
    assert.ok(entityNames.includes('SNIGGA'), `expected SNIGGA, got: ${entityNames.join(', ')}`);
    assert.ok(entityNames.includes('BONK'), `expected BONK, got: ${entityNames.join(', ')}`);
    assert.ok(
      entityNames.includes('Agentic Payments'),
      `expected "Agentic Payments", got: ${entityNames.join(', ')}`
    );

    // Regression: the poisoning strings must NOT appear as keys.
    for (const poison of [' without seeing actual images', 'without seeing actual images', 'high quality']) {
      assert.ok(
        !entityNames.includes(poison),
        `REGRESSION: ${JSON.stringify(poison)} should not be a ledger entity`
      );
    }

    // BONK gap was UNRESOLVABLE → recorded as an unresolvable_gap.
    assert.equal(ledger.entities['BONK'].unresolvable_gaps.length, 1);
    // Agentic Payments gap was RESOLVED → recorded as a resolved_fact.
    assert.equal(ledger.entities['Agentic Payments'].resolved_facts.length, 1);
  });

  test('prefers explicit gap.entity over heuristic extraction', async () => {
    const manager = new LedgerManager();

    // Claim has no obvious entity, but gap.entity explicitly says "Jupiter".
    const gaps: Gap[] = [
      {
        gap_id: 'gap_10',
        question: 'Is the claimed TVL accurate?',
        source_agent: 'skeptic',
        blocking_claim: 'TVL reported by aggregators',
        assigned_to: 'scout',
        entity: 'Jupiter',
        state: 'RESOLVED',
        evidence: 'Confirmed via on-chain',
        sources: ['https://defillama.com/protocol/jupiter'],
      },
    ];

    await manager.updateFromRun('test-run-2', gaps);

    const ledger = await manager.load();
    assert.ok(Object.keys(ledger.entities).includes('Jupiter'));
  });
});
