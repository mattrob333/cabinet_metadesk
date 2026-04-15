#!/usr/bin/env tsx
/**
 * X / Twitter Trending Scraper CLI
 *
 * Run with:
 *   npm run scrape:x         # live (requires XAI_API_KEY)
 *   npm run scrape:x:test    # dry run (prints prompt, no network call)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { scrapeXTrending } from '../src/lib/scrapers/x-trending-monitor';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('X Trending Narrative Scraper (via xAI Grok)');
  console.log('='.repeat(60));
  console.log(dryRun ? 'MODE: Dry run (no files will be written)' : 'MODE: Live');
  console.log('');

  const result = await scrapeXTrending(dryRun);

  console.log('');
  console.log('='.repeat(60));
  console.log('Result:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    if (!dryRun && result.observationFilePath) {
      console.log(`  File: ${result.observationFilePath}`);
    }
    process.exit(0);
  }
  console.error(`  Error: ${result.error}`);
  process.exit(1);
}

main();
