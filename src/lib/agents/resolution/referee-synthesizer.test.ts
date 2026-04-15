/**
 * Unit tests for the Referee synthesizer.
 * These are especially important because the deterministic path now
 * produces the final debate artifact (referee_report.md) — regressing its
 * structure would make every downstream consumer (future MemeLabz UI, the
 * briefs endpoint's debate.referee_report field) show garbage.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Gap } from '../debate-workflow';
import {
  synthesizeReferee,
  countGaps,
  computePortfolioNarrative,
} from './referee-synthesizer';

function makeGap(overrides: Partial<Gap> & { state: Gap['state'] }): Gap {
  return {
    gap_id: 'gap_1',
    question: 'Can we verify X?',
    source_agent: 'skeptic',
    blocking_claim: 'X is claimed',
    assigned_to: 'scout',
    ...overrides,
  };
}

describe('countGaps', () => {
  test('sums the four buckets correctly', () => {
    const gaps: Gap[] = [
      makeGap({ state: 'RESOLVED' }),
      makeGap({ state: 'RESOLVED' }),
      makeGap({ state: 'PARTIALLY_RESOLVED' }),
      makeGap({ state: 'UNRESOLVABLE' }),
      makeGap({ state: 'PENDING' }),
    ];
    assert.deepEqual(countGaps(gaps), {
      total: 5,
      resolved: 2,
      partially_resolved: 1,
      unresolvable: 1,
      pending: 1,
    });
  });

  test('handles an empty set', () => {
    assert.deepEqual(countGaps([]), {
      total: 0,
      resolved: 0,
      partially_resolved: 0,
      unresolvable: 0,
      pending: 0,
    });
  });
});

describe('synthesizeReferee', () => {
  test('produces a report with all required section headings', () => {
    const gaps: Gap[] = [
      makeGap({
        gap_id: 'g1',
        state: 'RESOLVED',
        entity: 'BONK',
        question: 'When did BONK launch?',
        evidence: 'Confirmed via solscan',
        sources: ['https://solscan.io/...'],
      }),
    ];
    const md = synthesizeReferee(gaps, '2026-04-15');
    assert.match(md, /^# Referee Synthesis — 2026-04-15/);
    assert.match(md, /## Resolution Summary/);
    assert.match(md, /## High-Confidence Signals \(RESOLVED\)/);
    assert.match(md, /## Cautious Signals \(PARTIALLY_RESOLVED\)/);
    assert.match(md, /## Watching \(Insufficient Data\)/);
    assert.match(md, /## Portfolio-Level Read/);
  });

  test('RESOLVED gaps land in the High-Confidence section with evidence + sources', () => {
    const gaps: Gap[] = [
      makeGap({
        state: 'RESOLVED',
        entity: 'SNIGGA',
        question: 'What is SNIGGA volume?',
        evidence: '18.4M over 24h via DexScreener',
        sources: ['https://dexscreener.com/solana/x', 'https://solscan.io/y'],
      }),
    ];
    const md = synthesizeReferee(gaps, '2026-04-15');
    const resolvedSection = md.split('## High-Confidence Signals (RESOLVED)')[1].split('##')[0];
    assert.match(resolvedSection, /SNIGGA/);
    assert.match(resolvedSection, /18\.4M over 24h/);
    assert.match(resolvedSection, /https:\/\/dexscreener\.com/);
    assert.match(resolvedSection, /https:\/\/solscan\.io/);
  });

  test('PARTIALLY_RESOLVED gaps include both evidence AND "still missing"', () => {
    const gaps: Gap[] = [
      makeGap({
        state: 'PARTIALLY_RESOLVED',
        entity: 'SNIGGA',
        question: 'What are SNIGGA visuals?',
        evidence: 'Logo found on pump.fun',
        reason: 'Full character sheet missing',
      }),
    ];
    const md = synthesizeReferee(gaps, '2026-04-15');
    assert.match(md, /What we found: Logo found on pump\.fun/);
    assert.match(md, /Still missing: Full character sheet missing/);
  });

  test('UNRESOLVABLE gaps include attempt count', () => {
    const gaps: Gap[] = [
      makeGap({
        state: 'UNRESOLVABLE',
        entity: 'PUNCH',
        question: 'When did PUNCH launch?',
        reason: 'No official announcement',
        attempts: 3,
      }),
    ];
    const md = synthesizeReferee(gaps, '2026-04-15');
    assert.match(md, /PUNCH/);
    assert.match(md, /No official announcement/);
    assert.match(md, /3 attempts/);
  });

  test('PENDING gaps surface as "REQUIRES ATTENTION"', () => {
    const gaps: Gap[] = [
      makeGap({ state: 'PENDING', question: 'Did resolution terminate?' }),
    ];
    const md = synthesizeReferee(gaps, '2026-04-15');
    assert.match(md, /REQUIRES ATTENTION/);
  });

  test('empty RESOLVED tier gets an explicit "no gaps fully resolved" note', () => {
    const gaps: Gap[] = [makeGap({ state: 'UNRESOLVABLE', question: 'x' })];
    const md = synthesizeReferee(gaps, '2026-04-15');
    const resolvedSection = md.split('## High-Confidence Signals (RESOLVED)')[1].split('##')[0];
    assert.match(resolvedSection, /No gaps were fully resolved this run/);
  });

  test('empty PENDING tier is omitted (no REQUIRES ATTENTION noise)', () => {
    const gaps: Gap[] = [makeGap({ state: 'RESOLVED', question: 'x', evidence: 'y' })];
    const md = synthesizeReferee(gaps, '2026-04-15');
    assert.doesNotMatch(md, /REQUIRES ATTENTION/);
  });

  test('handles empty gap set without crashing', () => {
    const md = synthesizeReferee([], '2026-04-15');
    assert.match(md, /0 gaps processed/);
    assert.match(md, /No gaps were identified this run/);
  });
});

describe('computePortfolioNarrative', () => {
  test('pending gaps always win — surface as "did not terminate cleanly"', () => {
    const out = computePortfolioNarrative({
      total: 5,
      resolved: 4,
      partially_resolved: 0,
      unresolvable: 0,
      pending: 1,
    });
    assert.match(out, /did not terminate cleanly/);
    assert.match(out, /WORKFLOW_FAILURE\.md/);
  });

  test('70%+ resolved with no unresolvables → "Strong debate"', () => {
    const out = computePortfolioNarrative({
      total: 10,
      resolved: 8,
      partially_resolved: 2,
      unresolvable: 0,
      pending: 0,
    });
    assert.match(out, /Strong debate/);
  });

  test('40-69% resolved → "Mixed debate"', () => {
    const out = computePortfolioNarrative({
      total: 10,
      resolved: 5,
      partially_resolved: 3,
      unresolvable: 2,
      pending: 0,
    });
    assert.match(out, /Mixed debate/);
  });

  test('zero resolved + majority unresolvable → "Weak debate"', () => {
    const out = computePortfolioNarrative({
      total: 6,
      resolved: 0,
      partially_resolved: 1,
      unresolvable: 5,
      pending: 0,
    });
    assert.match(out, /Weak debate/);
  });

  test('empty gap set gets a specific message (not a generic "weak")', () => {
    const out = computePortfolioNarrative({
      total: 0,
      resolved: 0,
      partially_resolved: 0,
      unresolvable: 0,
      pending: 0,
    });
    assert.match(out, /No gaps were identified/);
  });
});
