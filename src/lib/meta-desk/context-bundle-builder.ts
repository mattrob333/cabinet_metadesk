/**
 * Context Bundle Builder
 *
 * Assembles the intelligence package for MemeLabz consumption.
 * Combines three on-disk sources:
 *   - Trending tokens:  data/observations/onchain/dexscreener/ (latest)
 *   - Daily brief:      data/meta-desk/daily-briefs/{date}.md
 *   - Confidence ledger: data/ledger.json (FULL-confidence entities only)
 */

import fs from 'fs/promises';
import path from 'path';
import { readObservation, getLatestObservation } from '../scrapers/observation-writer';
import type { TrendingToken } from '../scrapers/types';
import {
  loadDailyBrief,
  pickLatestRunForDate,
  loadRunDetail,
  type DailyBrief,
} from './debate-reader';
import type { Ledger, LedgerEntity } from '../agents/resolution/ledger-manager';

const LEDGER_PATH = path.join(process.cwd(), 'data', 'ledger.json');

export interface BriefSection {
  date: string;
  source_path: string;
  frontmatter: Record<string, unknown>;
  agents: Record<string, string>;
  referee_report: string | null;
  run_id: string | null;
  run_status: string | null;
}

export interface LedgerSection {
  last_updated: string;
  version: string;
  entity_count: number;
  high_confidence_entities: Array<{ name: string } & LedgerEntity>;
}

export interface ContextBundle {
  date: string;
  generated_at: string;
  // `status` preserves the original contract: "complete" when trending data
  // is present (the minimum shipping slice), "unavailable" when nothing is on
  // disk. Consumers wanting finer granularity should inspect `sections_present`.
  status: 'complete' | 'unavailable';
  sections_present: Array<'trending' | 'brief' | 'ledger'>;
  sections: {
    brief: BriefSection | null;
    trending: {
      last_updated: string;
      source: string;
      tokens: TrendingToken[];
    } | null;
    ledger: LedgerSection | null;
  };
  metadata: {
    debate_workflow_status: 'integrated' | 'not_integrated' | 'partial';
    observations_processed: number;
    last_scrape: string | null;
    scraper_version: string;
  };
}

async function loadLedgerSection(): Promise<LedgerSection | null> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf-8');
    const ledger = JSON.parse(raw) as Ledger;
    const high = Object.entries(ledger.entities)
      .filter(([, e]) => e.confidence_state === 'FULL')
      .map(([name, e]) => ({ name, ...e }));
    return {
      last_updated: ledger.last_updated,
      version: ledger.version,
      entity_count: Object.keys(ledger.entities).length,
      high_confidence_entities: high,
    };
  } catch {
    return null;
  }
}

async function loadBriefSection(date: string): Promise<BriefSection | null> {
  const [brief, latestRun] = await Promise.all([
    loadDailyBrief(date),
    pickLatestRunForDate(date),
  ]);

  // If neither a brief file nor a debate run exists for the date, there's
  // nothing to surface.
  if (!brief && !latestRun) return null;

  const detail = latestRun ? await loadRunDetail(latestRun.id) : null;
  const fallback: DailyBrief | null = brief;

  return {
    date,
    source_path: fallback?.path ?? '',
    frontmatter: fallback?.frontmatter ?? {},
    agents: fallback?.agents ?? {},
    referee_report: detail?.referee_report ?? null,
    run_id: latestRun?.id ?? null,
    run_status: latestRun?.status ?? null,
  };
}

/**
 * Parse observation markdown body to extract trending tokens
 */
function parseObservationTokens(body: string): TrendingToken[] {
  const tokens: TrendingToken[] = [];

  // Split by token sections (### 1. TICKER)
  const tokenSections = body.split(/\n### \d+\. /g).slice(1);

  for (let i = 0; i < tokenSections.length; i++) {
    const section = tokenSections[i];
    const rank = i + 1;

    try {
      // Parse ticker and name from first line: "WIF (dogwifhat)"
      const firstLine = section.split('\n')[0];
      const match = firstLine.match(/^(.+?)\s+\((.+?)\)$/);
      if (!match) continue;

      const [, ticker, name] = match;

      // Extract fields using regex
      const contract = section.match(/\*\*Contract\*\*:\s+`(.+?)`/)?.[1] || '';
      const priceMatch = section.match(/\*\*Price\*\*:\s+\$([0-9.]+)\s+\(([+-]?[0-9.]+)%/);
      const volumeMatch = section.match(/\*\*Volume 24h\*\*:\s+\$([0-9.]+)M/);
      const liquidityMatch = section.match(/\*\*Liquidity\*\*:\s+\$([0-9.]+)K/);
      const marketCapMatch = section.match(/\*\*Market Cap\*\*:\s+\$([0-9.]+)M/);
      const createdMatch = section.match(/\*\*Created\*\*:\s+([0-9-]+)/);
      const urlMatch = section.match(/\*\*DexScreener\*\*:\s+(.+?)$/m);
      const whyMatch = section.match(/\*\*Why Trending\*\*:\s+(.+?)$/m);

      const token: TrendingToken = {
        rank,
        ticker: ticker.trim(),
        name: name.trim(),
        contract,
        price_usd: priceMatch ? parseFloat(priceMatch[1]) : 0,
        price_change_24h_pct: priceMatch ? parseFloat(priceMatch[2]) : 0,
        volume_24h_usd: volumeMatch ? parseFloat(volumeMatch[1]) * 1_000_000 : 0,
        market_cap_usd: marketCapMatch ? parseFloat(marketCapMatch[1]) * 1_000_000 : null,
        liquidity_usd: liquidityMatch ? parseFloat(liquidityMatch[1]) * 1_000 : null,
        holder_count: null,
        created_at: createdMatch ? `${createdMatch[1]}T00:00:00Z` : null,
        dexscreener_url: urlMatch ? urlMatch[1].trim() : '',
        why_trending: whyMatch ? whyMatch[1].trim() : ''
      };

      tokens.push(token);
    } catch (err) {
      console.warn(`[ContextBundle] Failed to parse token ${rank}:`, err);
    }
  }

  return tokens;
}

/**
 * Build context bundle from latest observations
 *
 * @param date - Optional date in YYYY-MM-DD format. Defaults to today.
 * @returns Context bundle ready for API response
 */
export async function buildContextBundle(date?: string): Promise<ContextBundle> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Load all three sources in parallel — each can be absent independently.
  const [latestObsPath, brief, ledger] = await Promise.all([
    getLatestObservation('onchain/dexscreener'),
    loadBriefSection(targetDate),
    loadLedgerSection(),
  ]);

  // Trending section is optional — only absent when no scraper has ever run.
  let trending: ContextBundle['sections']['trending'] = null;
  let lastScrape: string | null = null;
  let scraperVersion = '1.0';
  let observationsProcessed = 0;

  if (latestObsPath) {
    const observation = await readObservation(latestObsPath);
    trending = {
      last_updated: observation.frontmatter.collected_at,
      source: observation.frontmatter.source,
      tokens: parseObservationTokens(observation.body),
    };
    lastScrape = observation.frontmatter.collected_at;
    scraperVersion = observation.frontmatter.scraper_version;
    observationsProcessed = 1;
  }

  // Keep the original `status` contract: "complete" if the minimum trending
  // slice is present, "unavailable" otherwise. This matches what the existing
  // /api/meta-desk/context-bundle route checks for (`status === 'unavailable'`
  // → HTTP 404, otherwise 200).
  const status: ContextBundle['status'] = trending ? 'complete' : 'unavailable';

  const sectionsPresent: ContextBundle['sections_present'] = [];
  if (trending) sectionsPresent.push('trending');
  if (brief) sectionsPresent.push('brief');
  if (ledger) sectionsPresent.push('ledger');

  let debateStatus: ContextBundle['metadata']['debate_workflow_status'];
  if (brief && ledger) debateStatus = 'integrated';
  else if (brief || ledger) debateStatus = 'partial';
  else debateStatus = 'not_integrated';

  return {
    date: targetDate,
    generated_at: now,
    status,
    sections_present: sectionsPresent,
    sections: {
      brief,
      trending,
      ledger,
    },
    metadata: {
      debate_workflow_status: debateStatus,
      observations_processed: observationsProcessed,
      last_scrape: lastScrape,
      scraper_version: scraperVersion,
    },
  };
}
