/**
 * Unit tests for the X / Grok scraper's pure logic.
 * The live API call (callGrok) is not exercised here — that's smoke-tested
 * with `npm run scrape:x`. These tests cover the parsing + validation
 * surface that determines what ends up on disk in an observation.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { __internals } from './x-trending-monitor';

const { extractAssistantText, extractJsonBlock, normalizeNarrative, buildPrompt } = __internals;

describe('extractAssistantText', () => {
  test('reads output_text shorthand', () => {
    assert.equal(extractAssistantText({ output_text: 'hi' }), 'hi');
  });

  test('reads OpenAI-Responses-style output.content[].text', () => {
    const txt = extractAssistantText({
      output: [{ content: [{ type: 'output_text', text: 'hello' }] }],
    });
    assert.equal(txt, 'hello');
  });

  test('reads chat-completions-compatible choices[].message.content', () => {
    const txt = extractAssistantText({
      choices: [{ message: { content: 'from chat-completions' } }],
    });
    assert.equal(txt, 'from chat-completions');
  });

  test('returns empty string when no known shape matches', () => {
    assert.equal(extractAssistantText({}), '');
  });
});

describe('extractJsonBlock', () => {
  test('pulls JSON out of a ```json fence', () => {
    const input = 'Here you go:\n```json\n[{"a":1}]\n```\nthanks';
    assert.equal(extractJsonBlock(input), '[{"a":1}]');
  });

  test('handles unlabeled triple-backtick fence', () => {
    const input = '```\n{"x": true}\n```';
    assert.equal(extractJsonBlock(input), '{"x": true}');
  });

  test('accepts raw JSON without a fence', () => {
    assert.equal(extractJsonBlock('[]'), '[]');
  });

  test('returns null when there is no JSON anywhere', () => {
    assert.equal(extractJsonBlock('I do not know'), null);
  });
});

describe('normalizeNarrative', () => {
  test('accepts a complete well-formed narrative', () => {
    const out = normalizeNarrative(
      {
        rank: 2,
        entity: 'BONK',
        entity_type: 'token',
        narrative_summary: 'BONK revival.',
        sentiment: 'bullish',
        estimated_reach: '~100K',
        top_voices: ['@kaleo', 'fridgewars'],
        sample_posts: [{ url: 'https://x.com/kaleo/status/1', excerpt: 'BONK back' }],
        why_trending: 'Big CEX listing rumor.',
      },
      99
    );
    assert.ok(out);
    assert.equal(out!.entity, 'BONK');
    assert.equal(out!.rank, 2);
    assert.equal(out!.sentiment, 'bullish');
    // Leading @ should be stripped from handles.
    assert.deepEqual(out!.top_voices, ['kaleo', 'fridgewars']);
    assert.equal(out!.sample_posts.length, 1);
  });

  test('rejects narratives with sentence-fragment entities (ledger-poison guard)', () => {
    assert.equal(
      normalizeNarrative({ entity: ' without seeing actual images' }, 1),
      null
    );
    assert.equal(normalizeNarrative({ entity: 'high quality' }, 1), null);
    assert.equal(normalizeNarrative({ entity: '' }, 1), null);
    assert.equal(normalizeNarrative({}, 1), null);
  });

  test('falls back to sane defaults for unknown enum values', () => {
    const out = normalizeNarrative({ entity: 'WIF', sentiment: 'euphoric' }, 1);
    assert.ok(out);
    assert.equal(out!.sentiment, 'neutral');
    assert.equal(out!.entity_type, 'narrative');
  });

  test('caps top_voices at 5 and sample_posts at 3', () => {
    const out = normalizeNarrative(
      {
        entity: 'BONK',
        top_voices: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        sample_posts: [
          { url: 'https://x.com/1' },
          { url: 'https://x.com/2' },
          { url: 'https://x.com/3' },
          { url: 'https://x.com/4' },
          { url: 'https://x.com/5' },
        ],
      },
      1
    );
    assert.equal(out!.top_voices.length, 5);
    assert.equal(out!.sample_posts.length, 3);
  });

  test('drops sample_posts with no URL', () => {
    const out = normalizeNarrative(
      {
        entity: 'BONK',
        sample_posts: [{ excerpt: 'no url here' }, { url: 'https://x.com/1', excerpt: 'ok' }],
      },
      1
    );
    assert.equal(out!.sample_posts.length, 1);
    assert.equal(out!.sample_posts[0].url, 'https://x.com/1');
  });
});

describe('buildPrompt', () => {
  test('renders topN and lookbackHours from config', () => {
    const prompt = buildPrompt({
      model: 'grok-4-latest',
      topN: 15,
      lookbackHours: 48,
      allowedHandles: [],
    });
    assert.match(prompt, /top 15 trending/);
    assert.match(prompt, /last 48 hours/);
    // Prompt must explicitly warn against sentence-fragment entities.
    assert.match(prompt, /SHORT proper name/);
    assert.match(prompt, /NOT be a sentence fragment/);
  });
});
