/**
 * Scraper Type Definitions
 *
 * Shared types for all data scrapers (DexScreener, Twitter, Google Trends, etc.)
 */

// ============================================================================
// DexScreener API Response Types
// ============================================================================

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

// ============================================================================
// Processed Token Data (for observations)
// ============================================================================

// ============================================================================
// X / Social Trending Narrative (from xAI Grok)
// ============================================================================

export interface XSamplePost {
  url: string;
  excerpt: string;
  handle?: string;
}

export interface XTrendingNarrative {
  rank: number;
  entity: string; // Short proper name: ticker, protocol, or narrative slug
  entity_type: 'token' | 'narrative' | 'protocol' | 'account';
  narrative_summary: string;
  sentiment: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  /** Free-form reach estimate from Grok (e.g. "~50K impressions in 24h"). */
  estimated_reach: string;
  top_voices: string[]; // Influential @handles driving the narrative
  sample_posts: XSamplePost[];
  why_trending: string;
}

export interface XScraperConfig {
  model: string; // e.g. 'grok-4-latest', 'grok-4.20-reasoning'
  topN: number; // How many narratives to include in observation
  lookbackHours: number; // How far back to search X + web
  /** Optional @handle allowlist to restrict x_search. Empty = unrestricted. */
  allowedHandles: string[];
}

export interface TrendingToken {
  rank: number;
  ticker: string;
  name: string;
  contract: string;
  price_usd: number;
  price_change_24h_pct: number;
  volume_24h_usd: number;
  market_cap_usd: number | null;
  liquidity_usd: number | null;
  holder_count: number | null; // Not available from DexScreener, requires on-chain query
  created_at: string | null; // ISO timestamp
  dexscreener_url: string;
  why_trending: string;
}

// ============================================================================
// Observation File Frontmatter
// ============================================================================

export interface ObservationFrontmatter {
  source: 'dexscreener' | 'twitter' | 'x' | 'google-trends' | 'news' | 'grok';
  collected_at: string; // ISO timestamp
  language: string; // 'en', 'jp', 'kr', 'cn'
  entities: string[]; // Token tickers found in observation
  confidence: number; // 0.0-1.0
  scraper_version: string;

  // DexScreener-specific metadata
  tokens_found?: number;
  api_endpoint?: string;

  // X/Grok-specific metadata
  narratives_found?: number;
  model?: string;
  search_tools_used?: string[];
}

export interface Observation {
  frontmatter: ObservationFrontmatter;
  body: string; // Markdown content
}

// ============================================================================
// Scraper Configuration
// ============================================================================

export interface DexScreenerConfig {
  pollIntervalMinutes: number; // How often to scrape
  minVolumeUsd: number; // Filter tokens below this 24h volume
  topN: number; // How many tokens to include in observation
  chainIds: string[]; // ['solana', 'ethereum', 'bsc']
}

export interface ScraperResult {
  success: boolean;
  error?: string;
  tokensFound: number;
  observationFilePath?: string;
  timestamp: string;
}
