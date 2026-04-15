/**
 * Unit tests for run index formatting.
 * These are pure-function tests — the on-disk integration (writing to
 * data/runs/<runId>/index.md) is exercised implicitly by the debate
 * workflow's lifecycle hooks and by a manual smoke test.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Gap } from '../agents/debate-workflow';
import type { DebateRunDetail, DebateRunMeta } from './debate-reader';
import {
  renderRunIndex,
  renderRunsRootIndex,
  runTitle,
  countsSummary,
} from './run-index-builder';

function makeMeta(overrides: Partial<DebateRunMeta> = {}): DebateRunMeta {
  return {
    id: '2026-04-11T15-07-15',
    date: '2026-04-11',
    status: 'completed',
    phase: 'complete',
    created_at: '2026-04-11T15:07:15Z',
    completed_at: '2026-04-11T15:42:03Z',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<DebateRunDetail> = {}): DebateRunDetail {
  return {
    ...makeMeta(),
    referee_report: '# Referee\n...',
    gaps_markdown: '# Gaps\n...',
    gaps: [],
    iteration_log: '# Log\n...',
    skeptic_challenges: '# Skeptic\n...',
    analyses: { historian: 'h', scout: 's' },
    has_workflow_failure: false,
    ...overrides,
  };
}

describe('runTitle', () => {
  test('renders date + clock + status', () => {
    assert.equal(runTitle(makeMeta()), '2026-04-11 15:07 UTC — completed');
  });

  test('handles running status', () => {
    assert.equal(runTitle(makeMeta({ status: 'running' })), '2026-04-11 15:07 UTC — running');
  });

  test('handles malformed run IDs without crashing', () => {
    const t = runTitle(makeMeta({ id: '2026-04-11' }));
    assert.match(t, /2026-04-11/);
  });
});

describe('countsSummary', () => {
  test('compresses mixed counts into R/P/U form', () => {
    assert.equal(
      countsSummary({
        total: 5,
        resolved: 2,
        partially_resolved: 1,
        unresolvable: 1,
        pending: 1,
      }),
      '5 (2R/1P/1U/1!)'
    );
  });

  test('returns em-dash for empty set', () => {
    assert.equal(
      countsSummary({
        total: 0,
        resolved: 0,
        partially_resolved: 0,
        unresolvable: 0,
        pending: 0,
      }),
      '—'
    );
  });

  test('omits zero buckets', () => {
    assert.equal(
      countsSummary({
        total: 3,
        resolved: 3,
        partially_resolved: 0,
        unresolvable: 0,
        pending: 0,
      }),
      '3 (3R)'
    );
  });
});

describe('renderRunIndex', () => {
  test('emits frontmatter with friendly title + status icon', () => {
    const md = renderRunIndex(makeDetail());
    assert.match(md, /^---\ntitle: "2026-04-11 15:07 UTC — completed"/);
    assert.match(md, /icon: "⚖️"/);
  });

  test('failed runs get a red-X icon', () => {
    const md = renderRunIndex(makeDetail({ status: 'failed', error: 'boom' }));
    assert.match(md, /icon: "❌"/);
    // Note: avoid using a literal backtick in this regex — esbuild/tsx's
    // parser trips on it. Matching Error label + the error text is enough.
    assert.match(md, /\*\*Error:\*\*/);
    assert.match(md, /boom/);
  });

  test('running runs get the hourglass icon', () => {
    const md = renderRunIndex(makeDetail({ status: 'running', completed_at: undefined }));
    assert.match(md, /icon: "⏳"/);
    assert.doesNotMatch(md, /Completed:/);
  });

  test('lists each available artifact as a relative link', () => {
    const md = renderRunIndex(makeDetail());
    assert.match(md, /\]\(\.\/referee_report\.md\)/);
    assert.match(md, /\]\(\.\/gaps\.md\)/);
    assert.match(md, /\]\(\.\/iteration_log\.md\)/);
    assert.match(md, /\]\(\.\/skeptic_challenges\.md\)/);
    assert.match(md, /\]\(\.\/analyses\/historian\.md\)/);
  });

  test('omits artifact links for files that are absent', () => {
    const md = renderRunIndex(
      makeDetail({
        referee_report: null,
        gaps_markdown: null,
        iteration_log: null,
        skeptic_challenges: null,
        analyses: {},
      })
    );
    assert.doesNotMatch(md, /referee_report\.md/);
    assert.doesNotMatch(md, /gaps\.md/);
  });

  test('surfaces WORKFLOW_FAILURE banner + link when present', () => {
    const md = renderRunIndex(makeDetail({ has_workflow_failure: true }));
    assert.match(md, /⚠️ \*\*WORKFLOW_FAILURE\*\*/);
    assert.match(md, /\]\(\.\/WORKFLOW_FAILURE\.md\)/);
  });

  test('emits a gap summary table when gaps are present', () => {
    const gaps: Gap[] = [
      {
        gap_id: 'g1',
        question: 'Can we verify X?',
        source_agent: 'skeptic',
        blocking_claim: 'X is claimed',
        assigned_to: 'scout',
        state: 'RESOLVED',
        entity: 'BONK',
      },
      {
        gap_id: 'g2',
        question: 'What are Y visuals?',
        source_agent: 'skeptic',
        blocking_claim: 'Y visual',
        assigned_to: 'aesthetician',
        state: 'UNRESOLVABLE',
      },
    ];
    const md = renderRunIndex(makeDetail({ gaps }));
    assert.match(md, /## Gap Summary/);
    assert.match(md, /\| RESOLVED \| Can we verify X\? \| BONK \| scout \|/);
    assert.match(md, /\| UNRESOLVABLE \| What are Y visuals\? \| — \| aesthetician \|/);
  });

  test('omits the gap summary section when no gaps were extracted', () => {
    const md = renderRunIndex(makeDetail({ gaps: [] }));
    assert.doesNotMatch(md, /## Gap Summary/);
  });
});

describe('renderRunsRootIndex', () => {
  test('emits friendly frontmatter + header', () => {
    const md = renderRunsRootIndex([]);
    assert.match(md, /^---\ntitle: "Debate Runs"/);
    assert.match(md, /icon: "⚖️"/);
    assert.match(md, /# Debate Runs/);
  });

  test('handles zero runs with an actionable hint', () => {
    const md = renderRunsRootIndex([]);
    assert.match(md, /No runs yet/);
    assert.match(md, /npm run debate/);
  });

  test('renders one row per run with links to folder + report', () => {
    const md = renderRunsRootIndex([
      {
        meta: makeMeta(),
        counts: {
          total: 3,
          resolved: 1,
          partially_resolved: 1,
          unresolvable: 1,
          pending: 0,
        },
      },
    ]);
    // Row contents
    assert.match(md, /\| 2026-04-11 \| 15:07 \| completed \| 3 \(1R\/1P\/1U\) \| \[report\]\(\.\/2026-04-11T15-07-15\/referee_report\.md\) \| \[2026-04-11T15-07-15\]\(\.\/2026-04-11T15-07-15\/\) \|/);
    // Header has same cardinality as rows (6 columns, each surrounded by |).
    const headerLine = md.split('\n').find((l) => l.startsWith('| Date'))!;
    const rowLine = md.split('\n').find((l) => l.startsWith('| 2026-04-11'))!;
    const headerPipes = (headerLine.match(/\|/g) || []).length;
    const rowPipes = (rowLine.match(/\|/g) || []).length;
    assert.equal(headerPipes, rowPipes, 'header and row column counts must match');
  });
});
