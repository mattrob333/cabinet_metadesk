/**
 * Context Bundle Builder
 *
 * Assembles the intelligence package for MemeLabz consumption
 * Simplified version without debate workflow integration
 */

import { readObservation, getLatestObservation } from '../scrapers/observation-writer';
import type { TrendingToken } from '../scrapers/types';

export interface ContextBundle {
  date: string;
  generated_at: string;
  status: 'complete' | 'partial' | 'unavailable';
  sections: {
    brief: null; // Not integrated yet
    trending: {
      last_updated: string;
      source: string;
      tokens: TrendingToken[];
    } | null;
    ledger: null; // Not integrated yet
  };
  metadata: {
    debate_workflow_status: string;
    observations_processed: number;
    last_scrape: string | null;
    scraper_version: string;
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

  // Get latest DexScreener observation
  const latestObsPath = await getLatestObservation('onchain/dexscreener');

  if (!latestObsPath) {
    return {
      date: targetDate,
      generated_at: now,
      status: 'unavailable',
      sections: {
        brief: null,
        trending: null,
        ledger: null
      },
      metadata: {
        debate_workflow_status: 'not_integrated',
        observations_processed: 0,
        last_scrape: null,
        scraper_version: '1.0'
      }
    };
  }

  // Read observation
  const observation = await readObservation(latestObsPath);

  // Parse tokens from markdown
  const tokens = parseObservationTokens(observation.body);

  return {
    date: targetDate,
    generated_at: now,
    status: 'complete',
    sections: {
      brief: null, // Debate workflow not integrated
      trending: {
        last_updated: observation.frontmatter.collected_at,
        source: observation.frontmatter.source,
        tokens
      },
      ledger: null // Debate workflow not integrated
    },
    metadata: {
      debate_workflow_status: 'not_integrated',
      observations_processed: 1,
      last_scrape: observation.frontmatter.collected_at,
      scraper_version: observation.frontmatter.scraper_version
    }
  };
}
