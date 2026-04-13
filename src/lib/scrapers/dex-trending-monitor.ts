/**
 * DexScreener/GMGN Trending Monitor
 *
 * Scrapes trending Solana tokens from GMGN API (fallback to DexScreener boosted endpoint)
 * Writes observations to markdown files for agent consumption
 */

import type {
  DexScreenerPair,
  TrendingToken,
  DexScreenerConfig,
  ScraperResult,
  ObservationFrontmatter
} from './types';
import {
  writeObservation,
  formatTimestampForFilename,
  formatTimestampForFrontmatter
} from './observation-writer';

const DEXSCREENER_BOOSTED_API = 'https://api.dexscreener.com/token-boosts/latest/v1';

/**
 * Default configuration
 * Can be overridden via environment variables
 */
const DEFAULT_CONFIG: DexScreenerConfig = {
  pollIntervalMinutes: parseInt(process.env.DEXSCREENER_POLL_INTERVAL_MINUTES || '15', 10),
  minVolumeUsd: parseInt(process.env.DEXSCREENER_MIN_VOLUME_USD || '10000', 10),
  topN: 10,
  chainIds: ['solana'] // Focus on Solana meme coins
};

/**
 * GMGN Boosted Token Response
 */
interface GMGNBoostedToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  description?: string;
  icon?: string;
  header?: string;
  totalAmount: number;
  amount: number;
}

/**
 * Fetch boosted/trending tokens from DexScreener
 */
async function fetchBoostedTokens(chainId: string = 'solana'): Promise<GMGNBoostedToken[]> {
  console.log(`[DexScreener] Fetching boosted tokens`);

  const response = await fetch(DEXSCREENER_BOOSTED_API, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Cabinet/1.0 (Meme Token Intelligence)'
    }
  });

  if (!response.ok) {
    throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
  }

  const data: GMGNBoostedToken[] = await response.json();

  // Filter by chainId
  const filtered = data.filter(token => token.chainId === chainId);

  console.log(`[DexScreener] Found ${filtered.length} boosted ${chainId} tokens`);

  return filtered;
}

/**
 * Fetch pair data for a specific token
 */
async function fetchTokenPairData(tokenAddress: string): Promise<DexScreenerPair | null> {
  const endpoint = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Cabinet/1.0 (Meme Token Intelligence)'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data: { schemaVersion: string; pairs: DexScreenerPair[] | null } = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      return null;
    }

    // Return the pair with highest liquidity
    const sorted = data.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    return sorted[0];
  } catch (error) {
    console.warn(`[DexScreener] Failed to fetch pair data for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Fetch trending tokens from DexScreener (boosted tokens + pair data)
 */
async function fetchDexScreenerData(chainId: string = 'solana'): Promise<DexScreenerPair[]> {
  // Get boosted tokens
  const boostedTokens = await fetchBoostedTokens(chainId);

  // Fetch pair data for each token (in parallel)
  const pairs = await Promise.all(
    boostedTokens.map(token => fetchTokenPairData(token.tokenAddress))
  );

  // Filter out nulls
  const validPairs = pairs.filter((pair): pair is DexScreenerPair => pair !== null);

  console.log(`[DexScreener] Found ${validPairs.length} pairs with data`);

  return validPairs;
}

/**
 * Filter and rank pairs by relevance
 */
function filterAndRankPairs(
  pairs: DexScreenerPair[],
  config: DexScreenerConfig
): DexScreenerPair[] {
  // Filter by minimum volume
  const filtered = pairs.filter((pair) => {
    const volume24h = pair.volume?.h24 || 0;
    const hasPrice = pair.priceUsd && parseFloat(pair.priceUsd) > 0;
    return volume24h >= config.minVolumeUsd && hasPrice;
  });

  console.log(`[DexScreener] Filtered to ${filtered.length} pairs with volume >${config.minVolumeUsd}`);

  // Sort by 24h volume (descending)
  filtered.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));

  // Take top N
  return filtered.slice(0, config.topN);
}

/**
 * Generate "why trending" insight for a token
 */
function generateWhyTrending(pair: DexScreenerPair): string {
  const priceChange24h = pair.priceChange?.h24 || 0;
  const volume24h = pair.volume?.h24 || 0;
  const txns24h = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);

  const insights: string[] = [];

  // Price movement
  if (priceChange24h > 50) {
    insights.push(`Massive pump +${priceChange24h.toFixed(1)}% in 24h`);
  } else if (priceChange24h > 20) {
    insights.push(`Strong rally +${priceChange24h.toFixed(1)}%`);
  } else if (priceChange24h > 10) {
    insights.push(`Moderate gain +${priceChange24h.toFixed(1)}%`);
  } else if (priceChange24h < -20) {
    insights.push(`Heavy sell-off ${priceChange24h.toFixed(1)}%`);
  }

  // Volume analysis
  if (volume24h > 10_000_000) {
    insights.push(`Massive volume $${(volume24h / 1_000_000).toFixed(1)}M`);
  } else if (volume24h > 1_000_000) {
    insights.push(`High volume $${(volume24h / 1_000_000).toFixed(1)}M`);
  }

  // Transaction count
  if (txns24h > 5000) {
    insights.push(`Very active (${txns24h.toLocaleString()} txns)`);
  } else if (txns24h > 1000) {
    insights.push(`Active trading (${txns24h.toLocaleString()} txns)`);
  }

  // Liquidity
  if (pair.liquidity?.usd && pair.liquidity.usd > 1_000_000) {
    insights.push('Deep liquidity');
  } else if (pair.liquidity?.usd && pair.liquidity.usd < 50_000) {
    insights.push('⚠️ Low liquidity');
  }

  // New token
  if (pair.pairCreatedAt) {
    const ageMs = Date.now() - pair.pairCreatedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      insights.push(`New token (${ageDays.toFixed(0)} days old)`);
    }
  }

  return insights.join('. ') || 'Steady trading activity';
}

/**
 * Convert DexScreenerPair to TrendingToken format
 */
function pairToTrendingToken(pair: DexScreenerPair, rank: number): TrendingToken {
  return {
    rank,
    ticker: pair.baseToken.symbol,
    name: pair.baseToken.name,
    contract: pair.baseToken.address,
    price_usd: parseFloat(pair.priceUsd || '0'),
    price_change_24h_pct: pair.priceChange?.h24 || 0,
    volume_24h_usd: pair.volume?.h24 || 0,
    market_cap_usd: pair.marketCap || null,
    liquidity_usd: pair.liquidity?.usd || null,
    holder_count: null, // Not available from DexScreener
    created_at: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
    dexscreener_url: pair.url,
    why_trending: generateWhyTrending(pair)
  };
}

/**
 * Format token data as markdown
 */
function formatTokenMarkdown(token: TrendingToken): string {
  const sections: string[] = [];

  sections.push(`### ${token.rank}. ${token.ticker} (${token.name})`);
  sections.push(`- **Contract**: \`${token.contract}\``);
  sections.push(`- **Price**: $${token.price_usd.toFixed(token.price_usd < 0.01 ? 6 : 2)} (${token.price_change_24h_pct > 0 ? '+' : ''}${token.price_change_24h_pct.toFixed(1)}% 24h)`);
  sections.push(`- **Volume 24h**: $${(token.volume_24h_usd / 1_000_000).toFixed(2)}M`);

  if (token.liquidity_usd) {
    sections.push(`- **Liquidity**: $${(token.liquidity_usd / 1_000).toFixed(0)}K`);
  }

  if (token.market_cap_usd) {
    sections.push(`- **Market Cap**: $${(token.market_cap_usd / 1_000_000).toFixed(1)}M`);
  }

  if (token.created_at) {
    const createdDate = new Date(token.created_at).toISOString().split('T')[0];
    sections.push(`- **Created**: ${createdDate}`);
  }

  sections.push(`- **DexScreener**: ${token.dexscreener_url}`);
  sections.push('');
  sections.push(`**Why Trending**: ${token.why_trending}`);
  sections.push('');

  return sections.join('\n');
}

/**
 * Generate observation body markdown
 */
function generateObservationBody(tokens: TrendingToken[], timestamp: string): string {
  const sections: string[] = [];

  sections.push(`# DexScreener Trending - ${new Date(timestamp).toUTCString()}`);
  sections.push('');
  sections.push(`Scraped ${tokens.length} trending Solana tokens with >$${DEFAULT_CONFIG.minVolumeUsd.toLocaleString()} 24h volume.`);
  sections.push('');
  sections.push('## Trending Tokens (Top 10)');
  sections.push('');

  tokens.forEach((token) => {
    sections.push(formatTokenMarkdown(token));
  });

  sections.push('---');
  sections.push('');
  sections.push('## Metadata');
  sections.push('');

  const totalVolume = tokens.reduce((sum, t) => sum + t.volume_24h_usd, 0);
  const avgPriceChange = tokens.reduce((sum, t) => sum + t.price_change_24h_pct, 0) / tokens.length;
  const newTokens = tokens.filter((t) => {
    if (!t.created_at) return false;
    const ageMs = Date.now() - new Date(t.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays < 7;
  }).length;

  sections.push(`- **Total Volume (all ${tokens.length})**: $${(totalVolume / 1_000_000).toFixed(1)}M`);
  sections.push(`- **Avg Price Change 24h**: ${avgPriceChange > 0 ? '+' : ''}${avgPriceChange.toFixed(1)}%`);
  sections.push(`- **New Tokens (< 7 days old)**: ${newTokens}`);
  sections.push(`- **Next Scrape**: ${new Date(Date.now() + DEFAULT_CONFIG.pollIntervalMinutes * 60 * 1000).toISOString()}`);
  sections.push('');

  return sections.join('\n');
}

/**
 * Main scraper function
 *
 * @param dryRun - If true, prints output but doesn't write files
 * @returns Scraper result
 */
export async function scrapeDexScreener(dryRun: boolean = false): Promise<ScraperResult> {
  try {
    const timestamp = formatTimestampForFrontmatter();
    const filename = formatTimestampForFilename();

    console.log(`[DexScreener] Starting scrape at ${timestamp}`);

    // Fetch data
    const pairs = await fetchDexScreenerData('solana');

    // Filter and rank
    const topPairs = filterAndRankPairs(pairs, DEFAULT_CONFIG);

    if (topPairs.length === 0) {
      throw new Error('No tokens passed filters');
    }

    console.log(`[DexScreener] Top token: ${topPairs[0].baseToken.symbol} ($${topPairs[0].priceUsd}, $${(topPairs[0].volume.h24 / 1_000_000).toFixed(1)}M vol)`);

    // Convert to TrendingToken format
    const tokens = topPairs.map((pair, idx) => pairToTrendingToken(pair, idx + 1));

    // Build frontmatter
    const frontmatter: ObservationFrontmatter = {
      source: 'dexscreener',
      collected_at: timestamp,
      language: 'en',
      entities: tokens.map((t) => t.ticker),
      confidence: 1.0, // On-chain data is high confidence
      scraper_version: '1.0',
      tokens_found: tokens.length,
      api_endpoint: DEXSCREENER_BOOSTED_API
    };

    // Generate body
    const body = generateObservationBody(tokens, timestamp);

    // Write observation
    if (dryRun) {
      console.log('[DRY RUN] Would write to: data/observations/onchain/dexscreener/' + filename + '.md');
      console.log('[DRY RUN] Observation preview:');
      console.log('---');
      console.log(JSON.stringify(frontmatter, null, 2));
      console.log('---');
      console.log(body.substring(0, 500) + '...');

      return {
        success: true,
        tokensFound: tokens.length,
        timestamp
      };
    }

    const filePath = await writeObservation('onchain/dexscreener', filename, frontmatter, body);

    console.log(`[DexScreener] ✓ Observation written to: ${filePath}`);

    return {
      success: true,
      tokensFound: tokens.length,
      observationFilePath: filePath,
      timestamp
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[DexScreener] ✗ Scrape failed:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      tokensFound: 0,
      timestamp: new Date().toISOString()
    };
  }
}
