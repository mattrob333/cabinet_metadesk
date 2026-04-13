/**
 * API Route: GET /api/meta-desk/health
 *
 * Health check endpoint that returns scraper status
 * Always returns HTTP 200 (even for errors - it reports status, doesn't fail)
 */

import { NextResponse } from 'next/server';
import { getLatestObservation, readObservation } from '@/lib/scrapers/observation-writer';

export async function GET() {
  try {
    const latestObsPath = await getLatestObservation('onchain/dexscreener');

    if (!latestObsPath) {
      return NextResponse.json(
        {
          status: 'pending',
          last_scrape: null,
          observations_count: 0,
          latest_observation_file: null,
          message: 'No observations collected yet. Run scraper first.'
        },
        { status: 200 }
      );
    }

    // Read observation to get metadata
    const observation = await readObservation(latestObsPath);

    return NextResponse.json(
      {
        status: 'ok',
        last_scrape: observation.frontmatter.collected_at,
        observations_count: observation.frontmatter.tokens_found || 0,
        latest_observation_file: latestObsPath
      },
      { status: 200 }
    );
  } catch (error) {
    // Even on error, return 200 with error status
    return NextResponse.json(
      {
        status: 'error',
        last_scrape: null,
        observations_count: 0,
        latest_observation_file: null,
        reason: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 }
    );
  }
}
