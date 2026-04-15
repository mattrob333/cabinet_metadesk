/**
 * X / Twitter Trending Narrative Monitor (via xAI Grok)
 *
 * Uses xAI's Responses API with the server-side `x_search` + `web_search`
 * tools to identify trending meme/crypto narratives on X in the last N hours.
 * Writes observations to `data/observations/social/x/` in the same
 * contract the DexScreener scraper uses.
 *
 * Why xAI Grok instead of the Twitter v2 API:
 *   - Grok's x_search is keyword + semantic + thread-aware (not just firehose).
 *   - Combines X + open-web results in one call (via web_search), which is
 *     what the Skeptic agent ends up wanting during Resolution Round anyway.
 *   - No tweet-rate-card limits. Cost is per-token, not per-tweet.
 *
 * References (verified April 2026):
 *   - POST https://api.x.ai/v1/responses
 *   - Tools: [{type: "web_search"}, {type: "x_search", allowed_x_handles?: [...]}]
 *   - Live Search (search_parameters) was retired 2026-01-12.
 *
 * Contract:
 *   - If `dryRun`, no file is written.
 *   - If ANTHROPIC-style env is missing (XAI_API_KEY), the function throws
 *     before making a network call.
 *   - Grok's output is expected to be a JSON code fence with an array of
 *     narratives; we parse defensively.
 */

import type {
  XTrendingNarrative,
  XScraperConfig,
  ScraperResult,
  ObservationFrontmatter,
} from './types';
import {
  writeObservation,
  formatTimestampForFilename,
  formatTimestampForFrontmatter,
} from './observation-writer';
import { sanitizeEntityName } from '../agents/resolution/entity-utils';

const XAI_RESPONSES_ENDPOINT = 'https://api.x.ai/v1/responses';

const DEFAULT_CONFIG: XScraperConfig = {
  model: process.env.XAI_MODEL || 'grok-4-latest',
  topN: parseInt(process.env.X_SCRAPER_TOP_N || '10', 10),
  lookbackHours: parseInt(process.env.X_SCRAPER_LOOKBACK_HOURS || '24', 10),
  allowedHandles: (process.env.X_SCRAPER_ALLOWED_HANDLES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

interface GrokResponsesEndpointResponse {
  // xAI's Responses API mirrors OpenAI's shape closely. The fields we care
  // about vary by model version, so we handle a few plausible shapes below.
  id?: string;
  model?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
    text?: string;
  }>;
  output_text?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: Record<string, number>;
}

function buildPrompt(config: XScraperConfig): string {
  return `You are a meme coin and crypto narrative analyst. Using the x_search and web_search tools, find the top ${config.topN} trending crypto / meme-coin narratives on X (Twitter) in the last ${config.lookbackHours} hours.

Focus on:
- Narratives driving new interest (new tokens, revived tokens, cultural waves).
- Signals from influential crypto voices, not bot chatter.
- Cross-corroboration with reputable web sources when available.

For each narrative, include:
- rank (1 = most significant)
- entity: a SHORT proper name (a ticker like "BONK", a protocol like "Jupiter",
  or a narrative slug like "Agentic Payments"). Must NOT be a sentence fragment.
- entity_type: "token" | "narrative" | "protocol" | "account"
- narrative_summary: 1-2 sentences on what the narrative is about
- sentiment: "bullish" | "bearish" | "mixed" | "neutral"
- estimated_reach: free-form string describing magnitude (e.g. "~50K impressions in 24h")
- top_voices: array of @handles driving the narrative (max 5, NO leading @)
- sample_posts: array of up to 3 objects {url, excerpt, handle}. URL should be
  a real post URL (x.com/...) when available.
- why_trending: one sentence explaining WHY this is showing up now

Return ONLY valid JSON in a single fenced block like:

\`\`\`json
[
  {
    "rank": 1,
    "entity": "BONK",
    "entity_type": "token",
    "narrative_summary": "...",
    "sentiment": "bullish",
    "estimated_reach": "...",
    "top_voices": ["handle1", "handle2"],
    "sample_posts": [{"url": "https://x.com/...", "excerpt": "...", "handle": "handle1"}],
    "why_trending": "..."
  }
]
\`\`\`

If nothing meaningful is trending, return an empty array \`[]\` inside the fence.`;
}

/**
 * Extract the assistant's text content from an xAI Responses API response.
 * Handles three shapes we've seen or anticipate:
 *   - {output_text: "..."}
 *   - {output: [{content: [{type: "output_text", text: "..."}]}]}
 *   - {choices: [{message: {content: "..."}}]} (chat-completions-compatible)
 */
function extractAssistantText(resp: GrokResponsesEndpointResponse): string {
  if (typeof resp.output_text === 'string' && resp.output_text.length > 0) {
    return resp.output_text;
  }

  if (Array.isArray(resp.output)) {
    for (const item of resp.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c.text === 'string' && c.text.length > 0) return c.text;
        }
      }
      if (typeof item.text === 'string' && item.text.length > 0) return item.text;
    }
  }

  if (Array.isArray(resp.choices)) {
    for (const ch of resp.choices) {
      if (typeof ch.message?.content === 'string' && ch.message.content.length > 0) {
        return ch.message.content;
      }
    }
  }

  return '';
}

/** Pull the first JSON fenced block out of Grok's text response. */
function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1].trim();
  // Fallback: maybe the model returned raw JSON without a fence.
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return trimmed;
  return null;
}

/**
 * Minimally validate and clean a narrative object parsed from Grok's output.
 * Returns null if the shape is so wrong it isn't worth keeping — protecting
 * the ledger + Skeptic from garbage inputs.
 */
function normalizeNarrative(raw: unknown, fallbackRank: number): XTrendingNarrative | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  // Entity is required — and must survive our entity-fragment filter, or the
  // confidence ledger will accumulate garbage again.
  const rawEntity = typeof r.entity === 'string' ? r.entity : '';
  const entity = sanitizeEntityName(rawEntity);
  if (!entity) return null;

  const entityType = (['token', 'narrative', 'protocol', 'account'] as const).includes(
    r.entity_type as 'token'
  )
    ? (r.entity_type as XTrendingNarrative['entity_type'])
    : 'narrative';

  const sentiment = (['bullish', 'bearish', 'mixed', 'neutral'] as const).includes(
    r.sentiment as 'bullish'
  )
    ? (r.sentiment as XTrendingNarrative['sentiment'])
    : 'neutral';

  const topVoices: string[] = Array.isArray(r.top_voices)
    ? (r.top_voices as unknown[])
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.replace(/^@+/, '').trim())
        .filter((v) => v.length > 0)
        .slice(0, 5)
    : [];

  const samplePosts: XTrendingNarrative['sample_posts'] = [];
  if (Array.isArray(r.sample_posts)) {
    for (const item of r.sample_posts) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      const url = typeof p.url === 'string' ? p.url : '';
      if (!url) continue;
      const post: XTrendingNarrative['sample_posts'][number] = {
        url,
        excerpt: typeof p.excerpt === 'string' ? p.excerpt : '',
      };
      if (typeof p.handle === 'string') {
        const handle = p.handle.replace(/^@+/, '').trim();
        if (handle) post.handle = handle;
      }
      samplePosts.push(post);
      if (samplePosts.length >= 3) break;
    }
  }

  return {
    rank: typeof r.rank === 'number' ? r.rank : fallbackRank,
    entity,
    entity_type: entityType,
    narrative_summary: typeof r.narrative_summary === 'string' ? r.narrative_summary : '',
    sentiment,
    estimated_reach: typeof r.estimated_reach === 'string' ? r.estimated_reach : 'unknown',
    top_voices: topVoices,
    sample_posts: samplePosts,
    why_trending: typeof r.why_trending === 'string' ? r.why_trending : '',
  };
}

async function callGrok(
  prompt: string,
  apiKey: string,
  config: XScraperConfig
): Promise<GrokResponsesEndpointResponse> {
  const tools: Array<Record<string, unknown>> = [
    { type: 'web_search' },
    config.allowedHandles.length > 0
      ? { type: 'x_search', allowed_x_handles: config.allowedHandles }
      : { type: 'x_search' },
  ];

  const response = await fetch(XAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: [{ role: 'user', content: prompt }],
      tools,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `xAI Grok API error: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`
    );
  }

  return (await response.json()) as GrokResponsesEndpointResponse;
}

function formatNarrativeMarkdown(n: XTrendingNarrative): string {
  const lines: string[] = [];
  lines.push(`### ${n.rank}. ${n.entity} (${n.entity_type})`);
  lines.push(`- **Sentiment**: ${n.sentiment}`);
  lines.push(`- **Estimated reach**: ${n.estimated_reach}`);
  if (n.top_voices.length > 0) {
    lines.push(`- **Top voices**: ${n.top_voices.map((v) => `@${v}`).join(', ')}`);
  }
  lines.push('');
  lines.push(`**Narrative**: ${n.narrative_summary}`);
  lines.push('');
  lines.push(`**Why trending**: ${n.why_trending}`);
  if (n.sample_posts.length > 0) {
    lines.push('');
    lines.push('**Sample posts:**');
    for (const p of n.sample_posts) {
      const handle = p.handle ? ` — @${p.handle}` : '';
      lines.push(`- ${p.url}${handle}`);
      if (p.excerpt) lines.push(`  > ${p.excerpt.replace(/\n+/g, ' ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function generateObservationBody(
  narratives: XTrendingNarrative[],
  timestamp: string,
  config: XScraperConfig
): string {
  const sections: string[] = [];
  sections.push(`# X Trending Narratives - ${new Date(timestamp).toUTCString()}`);
  sections.push('');
  sections.push(
    `Observed ${narratives.length} trending crypto/meme narratives on X in the last ${config.lookbackHours}h via xAI Grok (model: ${config.model}).`
  );
  sections.push('');
  sections.push('## Trending Narratives');
  sections.push('');
  for (const n of narratives) sections.push(formatNarrativeMarkdown(n));

  sections.push('---');
  sections.push('');
  sections.push('## Metadata');
  sections.push('');
  const sentimentCounts: Record<string, number> = {};
  for (const n of narratives) {
    sentimentCounts[n.sentiment] = (sentimentCounts[n.sentiment] ?? 0) + 1;
  }
  sections.push(
    `- **Sentiment distribution**: ${Object.entries(sentimentCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`
  );
  sections.push(`- **Lookback window**: ${config.lookbackHours}h`);
  sections.push(`- **Search tools**: x_search, web_search`);
  sections.push('');

  return sections.join('\n');
}

/**
 * Main scraper entry point.
 *
 * @param dryRun - when true, make no network calls — instead print the prompt
 *   that WOULD be sent. Used by `npm run scrape:x:test`.
 */
export async function scrapeXTrending(dryRun: boolean = false): Promise<ScraperResult> {
  try {
    const timestamp = formatTimestampForFrontmatter();
    const filename = formatTimestampForFilename();

    console.log(`[X Trending] Starting scrape at ${timestamp}`);

    const apiKey = process.env.XAI_API_KEY;

    if (dryRun) {
      const prompt = buildPrompt(DEFAULT_CONFIG);
      console.log('[DRY RUN] No network call will be made.');
      console.log('[DRY RUN] Config:', DEFAULT_CONFIG);
      console.log('[DRY RUN] API key present:', Boolean(apiKey));
      console.log('[DRY RUN] Prompt preview (first 500 chars):');
      console.log('---');
      console.log(prompt.slice(0, 500) + '…');
      return { success: true, tokensFound: 0, timestamp };
    }

    if (!apiKey) {
      throw new Error(
        'XAI_API_KEY is not set. Add it to .env (see .env.example) to run the X scraper.'
      );
    }

    const prompt = buildPrompt(DEFAULT_CONFIG);
    const grokResp = await callGrok(prompt, apiKey, DEFAULT_CONFIG);
    const text = extractAssistantText(grokResp);
    if (!text) {
      throw new Error('xAI Grok returned no text content — response shape unexpected');
    }

    const jsonBlock = extractJsonBlock(text);
    if (!jsonBlock) {
      throw new Error(
        `Could not find JSON block in Grok response. First 300 chars: ${text.slice(0, 300)}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonBlock);
    } catch (e) {
      throw new Error(
        `Failed to parse Grok JSON output: ${e instanceof Error ? e.message : e}. Raw: ${jsonBlock.slice(0, 300)}`
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Grok JSON output was not an array');
    }

    const narratives: XTrendingNarrative[] = [];
    parsed.forEach((raw, idx) => {
      const n = normalizeNarrative(raw, idx + 1);
      if (n) narratives.push(n);
    });

    if (narratives.length === 0) {
      console.warn('[X Trending] Grok returned no valid narratives — writing empty observation');
    }

    console.log(
      `[X Trending] ${narratives.length} narratives (top: ${narratives[0]?.entity ?? 'none'})`
    );

    const frontmatter: ObservationFrontmatter = {
      source: 'x',
      collected_at: timestamp,
      language: 'en',
      entities: narratives.map((n) => n.entity),
      confidence: 0.7, // Social signal is lower confidence than on-chain
      scraper_version: '1.0',
      narratives_found: narratives.length,
      model: DEFAULT_CONFIG.model,
      search_tools_used: ['x_search', 'web_search'],
    };

    const body = generateObservationBody(narratives, timestamp, DEFAULT_CONFIG);
    const filePath = await writeObservation('social/x', filename, frontmatter, body);
    console.log(`[X Trending] ✓ Observation written to: ${filePath}`);

    return {
      success: true,
      tokensFound: narratives.length,
      observationFilePath: filePath,
      timestamp,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[X Trending] ✗ Scrape failed:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      tokensFound: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Exported internals for unit tests — not part of the public API.
 * @internal
 */
export const __internals = {
  buildPrompt,
  extractAssistantText,
  extractJsonBlock,
  normalizeNarrative,
  formatNarrativeMarkdown,
};
