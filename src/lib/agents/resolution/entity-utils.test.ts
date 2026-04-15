/**
 * Unit tests for entity extraction/sanitization.
 *
 * These tests capture real-world bad inputs observed in META_DESK_REALITY_CHECK.md
 * section 3: the old ledger's entity keys included `" without seeing actual images"`
 * and `"high quality"` — which are sentence fragments, not entities.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlausibleEntity,
  sanitizeEntityName,
  extractEntityFromText,
} from './entity-utils';

describe('isPlausibleEntity', () => {
  test('accepts common all-caps tickers', () => {
    for (const t of ['BONK', 'PENGU', 'SNIGGA', 'WIF', 'FART', 'JUP']) {
      assert.equal(isPlausibleEntity(t), true, `expected ${t} to be plausible`);
    }
  });

  test('accepts PascalCase proper nouns', () => {
    assert.equal(isPlausibleEntity('Fartcoin'), true);
    assert.equal(isPlausibleEntity('Pudgy'), true);
  });

  test('accepts multi-word capitalized narratives', () => {
    assert.equal(isPlausibleEntity('Agentic Payments'), true);
    assert.equal(isPlausibleEntity('Drift Exploit'), true);
    assert.equal(isPlausibleEntity('Bank of America'), true);
  });

  test('rejects sentence fragments that historically poisoned the ledger', () => {
    // Exact strings from META_DESK_REALITY_CHECK.md:158-159
    assert.equal(isPlausibleEntity(' without seeing actual images'), false);
    assert.equal(isPlausibleEntity('without seeing actual images'), false);
    assert.equal(isPlausibleEntity('high quality'), false);
  });

  test('rejects common English all-caps that are not entities', () => {
    for (const t of ['WE', 'THE', 'AND', 'API', 'CLI', 'DEX', 'AI', 'TODO', 'STATE']) {
      assert.equal(isPlausibleEntity(t), false, `expected ${t} to be rejected`);
    }
  });

  test('rejects too-long strings', () => {
    assert.equal(
      isPlausibleEntity('This Is A Really Long Quoted Sentence That Someone Said'),
      false
    );
  });

  test('rejects empty / whitespace-only', () => {
    assert.equal(isPlausibleEntity(''), false);
    assert.equal(isPlausibleEntity('   '), false);
  });

  test('rejects strings that start with a verb or lowercase noise', () => {
    assert.equal(isPlausibleEntity('when the launch happened'), false);
    assert.equal(isPlausibleEntity('seeing actual images'), false);
  });

  test('handles surrounding quotes and trailing punctuation', () => {
    assert.equal(isPlausibleEntity('"BONK"'), true);
    assert.equal(isPlausibleEntity('BONK.'), true);
    assert.equal(isPlausibleEntity("'PENGU'"), true);
  });
});

describe('sanitizeEntityName', () => {
  test('returns normalized string for valid input', () => {
    assert.equal(sanitizeEntityName('  BONK  '), 'BONK');
    assert.equal(sanitizeEntityName('"PENGU"'), 'PENGU');
    assert.equal(sanitizeEntityName('Agentic Payments.'), 'Agentic Payments');
  });

  test('returns null for garbage', () => {
    assert.equal(sanitizeEntityName(' without seeing actual images'), null);
    assert.equal(sanitizeEntityName('high quality'), null);
    assert.equal(sanitizeEntityName('THE'), null);
    assert.equal(sanitizeEntityName(''), null);
  });
});

describe('extractEntityFromText', () => {
  test('picks up all-caps tickers from typical questions', () => {
    assert.equal(
      extractEntityFromText('When did PUNCH launch?', 'PUNCH launch date unverified'),
      'PUNCH'
    );
    assert.equal(
      extractEntityFromText("What are SNIGGA's character visuals?", 'SNIGGA listing logo'),
      'SNIGGA'
    );
  });

  test('recognizes known multi-word narratives', () => {
    assert.equal(
      extractEntityFromText(
        'Can we verify the agentic payments volume?',
        '14.8M agent-related transactions in March 2026'
      ),
      'Agentic Payments'
    );
  });

  test('recognizes <Name> Exploit patterns', () => {
    assert.equal(
      extractEntityFromText(
        'What was the post-Drift Exploit volume trend?',
        'Drift Exploit affected 7-day volume'
      ),
      'Drift Exploit'
    );
  });

  test('ignores noise all-caps (WE, THE, DEX, API) in favor of real tickers', () => {
    assert.equal(
      extractEntityFromText(
        'Can WE verify that the BONK DEX listing is genuine?',
        'API docs claim BONK listed on Raydium'
      ),
      'BONK'
    );
  });

  test('returns "General" when no plausible entity found', () => {
    assert.equal(
      extractEntityFromText(
        'Can we verify the claim?',
        'The claim needs verification'
      ),
      'General'
    );
  });

  test('regression: does NOT extract quoted sentence fragments', () => {
    // This is the exact bug class from META_DESK_REALITY_CHECK.md:158.
    // The old extractor grabbed `" without seeing actual images"` out of a
    // question like: `We cannot evaluate screenshots "without seeing actual images".`
    const result = extractEntityFromText(
      'We cannot evaluate character art "without seeing actual images"',
      'Visual gap for SNIGGA: "without seeing actual images" blocks screenshot test'
    );
    assert.notEqual(result, ' without seeing actual images');
    assert.notEqual(result, 'without seeing actual images');
    // Should prefer the real ticker in the claim.
    assert.equal(result, 'SNIGGA');
  });

  test('regression: does NOT extract "high quality" as an entity', () => {
    const result = extractEntityFromText(
      'Is the BONK artwork "high quality" enough?',
      'Screenshot test requires "high quality" visuals'
    );
    assert.notEqual(result, 'high quality');
    assert.equal(result, 'BONK');
  });
});
