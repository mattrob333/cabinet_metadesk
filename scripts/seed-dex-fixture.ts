#!/usr/bin/env tsx
/**
 * Seeds a realistic DexScreener observation file using the production code path
 * (writeObservation + the same frontmatter contract as dex-trending-monitor.ts).
 *
 * Used for smoke-testing the /api/meta-desk/context-bundle endpoint without
 * requiring outbound connectivity to DexScreener.
 *
 * Safe to delete once live scraping works in this environment.
 */

import {
  writeObservation,
  formatTimestampForFilename,
  formatTimestampForFrontmatter,
} from '../src/lib/scrapers/observation-writer';
import type { ObservationFrontmatter, TrendingToken } from '../src/lib/scrapers/types';

const FIXTURE_TOKENS: TrendingToken[] = [
  {
    rank: 1,
    ticker: 'SNIGGA',
    name: 'Snigga Inu',
    contract: 'SnGAp9pxQnvRFQm1wUuYR2vK4Z3nEJfNrGm1QVd2V4R1',
    price_usd: 0.0234,
    price_change_24h_pct: 441.2,
    volume_24h_usd: 18_400_000,
    market_cap_usd: 11_700_000,
    liquidity_usd: 1_240_000,
    holder_count: null,
    created_at: '2026-04-10T00:00:00Z',
    dexscreener_url: 'https://dexscreener.com/solana/sniggapair',
    why_trending: 'Massive pump +441.2% in 24h. Massive volume $18.4M. Very active (12,410 txns). Deep liquidity. New token (5 days old)',
  },
  {
    rank: 2,
    ticker: 'PENGU',
    name: 'Pudgy Penguin',
    contract: 'PenGu9DxQmV2qFgRwZpYJfN1xC3vKH2mJ4L5R6SwTnG',
    price_usd: 0.0412,
    price_change_24h_pct: 68.4,
    volume_24h_usd: 9_100_000,
    market_cap_usd: 38_400_000,
    liquidity_usd: 2_010_000,
    holder_count: null,
    created_at: '2025-12-19T00:00:00Z',
    dexscreener_url: 'https://dexscreener.com/solana/pengupair',
    why_trending: 'Strong rally +68.4%. High volume $9.1M. Very active (8,240 txns). Deep liquidity',
  },
  {
    rank: 3,
    ticker: 'FART',
    name: 'Fartcoin',
    contract: 'Fart3xDnEjQm1vRFgZ2pYJfN1xC3vKH2mJ4L5R6SwTnG',
    price_usd: 1.23,
    price_change_24h_pct: 14.8,
    volume_24h_usd: 27_800_000,
    market_cap_usd: 1_230_000_000,
    liquidity_usd: 4_500_000,
    holder_count: null,
    created_at: '2024-10-20T00:00:00Z',
    dexscreener_url: 'https://dexscreener.com/solana/fartpair',
    why_trending: 'Moderate gain +14.8%. Massive volume $27.8M. Very active (15,320 txns). Deep liquidity',
  },
];

function formatTokenMarkdown(token: TrendingToken): string {
  const lines: string[] = [];
  lines.push(`### ${token.rank}. ${token.ticker} (${token.name})`);
  lines.push(`- **Contract**: \`${token.contract}\``);
  lines.push(`- **Price**: $${token.price_usd.toFixed(token.price_usd < 0.01 ? 6 : 2)} (${token.price_change_24h_pct > 0 ? '+' : ''}${token.price_change_24h_pct.toFixed(1)}% 24h)`);
  lines.push(`- **Volume 24h**: $${(token.volume_24h_usd / 1_000_000).toFixed(2)}M`);
  if (token.liquidity_usd) lines.push(`- **Liquidity**: $${(token.liquidity_usd / 1_000).toFixed(0)}K`);
  if (token.market_cap_usd) lines.push(`- **Market Cap**: $${(token.market_cap_usd / 1_000_000).toFixed(1)}M`);
  if (token.created_at) lines.push(`- **Created**: ${token.created_at.split('T')[0]}`);
  lines.push(`- **DexScreener**: ${token.dexscreener_url}`);
  lines.push('');
  lines.push(`**Why Trending**: ${token.why_trending}`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const timestamp = formatTimestampForFrontmatter();
  const filename = formatTimestampForFilename();

  const frontmatter: ObservationFrontmatter = {
    source: 'dexscreener',
    collected_at: timestamp,
    language: 'en',
    entities: FIXTURE_TOKENS.map((t) => t.ticker),
    confidence: 1.0,
    scraper_version: '1.0',
    tokens_found: FIXTURE_TOKENS.length,
    api_endpoint: 'fixture://dexscreener',
  };

  const body = [
    `# DexScreener Trending (FIXTURE) - ${new Date(timestamp).toUTCString()}`,
    '',
    `Scraped ${FIXTURE_TOKENS.length} trending Solana tokens with >$10,000 24h volume. (Local fixture - not live data.)`,
    '',
    '## Trending Tokens (Top 10)',
    '',
    ...FIXTURE_TOKENS.map(formatTokenMarkdown),
    '---',
    '',
    '## Metadata',
    '',
    `- **Total Volume (all ${FIXTURE_TOKENS.length})**: $${(FIXTURE_TOKENS.reduce((s, t) => s + t.volume_24h_usd, 0) / 1_000_000).toFixed(1)}M`,
    `- **Avg Price Change 24h**: +${(FIXTURE_TOKENS.reduce((s, t) => s + t.price_change_24h_pct, 0) / FIXTURE_TOKENS.length).toFixed(1)}%`,
    `- **New Tokens (< 7 days old)**: 1`,
    '',
  ].join('\n');

  const filePath = await writeObservation('onchain/dexscreener', filename, frontmatter, body);
  console.log(`Seeded fixture observation: ${filePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
