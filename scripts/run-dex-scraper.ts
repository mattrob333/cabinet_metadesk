#!/usr/bin/env tsx
/**
 * DexScreener Scraper CLI
 *
 * Manual execution script for testing the DexScreener scraper
 * Run with: npm run scrape:dex
 * Dry run: npm run scrape:test
 */

import { scrapeDexScreener } from '../src/lib/scrapers/dex-trending-monitor';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('DexScreener Trending Token Scraper');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('MODE: Dry run (no files will be written)');
  } else {
    console.log('MODE: Live (will write observation file)');
  }

  console.log('');

  const result = await scrapeDexScreener(dryRun);

  console.log('');
  console.log('='.repeat(60));
  console.log('Result:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('');
    console.log('✓ Scrape completed successfully');
    if (!dryRun && result.observationFilePath) {
      console.log(`  File: ${result.observationFilePath}`);
    }
    process.exit(0);
  } else {
    console.log('');
    console.log('✗ Scrape failed');
    console.error(`  Error: ${result.error}`);
    process.exit(1);
  }
}

main();
