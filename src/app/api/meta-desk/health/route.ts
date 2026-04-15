/**
 * API Route: GET /api/meta-desk/health
 *
 * Health check endpoint that returns scraper status.
 * Always returns HTTP 200 (it reports status, doesn't fail).
 * CORS-enabled for MemeLabz (same allowlist as the other /api/meta-desk routes).
 */

export const dynamic = 'force-dynamic';

import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getLatestObservation, readObservation } from '@/lib/scrapers/observation-writer';
import { addCorsHeaders, corsOptionsResponse } from '@/lib/meta-desk/cors';
import type { PipelineHeartbeat } from '@/lib/meta-desk/pipeline-scheduler';

const PIPELINE_HEARTBEAT_PATH = path.join(process.cwd(), 'data', '.cabinet', 'pipeline-heartbeat.json');

async function readPipelineHeartbeat(): Promise<PipelineHeartbeat | null> {
  try {
    const raw = await fs.readFile(PIPELINE_HEARTBEAT_PATH, 'utf-8');
    return JSON.parse(raw) as PipelineHeartbeat;
  } catch {
    return null;
  }
}

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request.headers.get('origin'));
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const pipeline = await readPipelineHeartbeat();

  try {
    const latestObsPath = await getLatestObservation('onchain/dexscreener');

    if (!latestObsPath) {
      const response = NextResponse.json(
        {
          status: 'pending',
          last_scrape: null,
          observations_count: 0,
          latest_observation_file: null,
          pipeline,
          message: 'No observations collected yet. Run scraper first.',
        },
        { status: 200 }
      );
      return addCorsHeaders(response, origin);
    }

    const observation = await readObservation(latestObsPath);

    const response = NextResponse.json(
      {
        status: 'ok',
        last_scrape: observation.frontmatter.collected_at,
        observations_count: observation.frontmatter.tokens_found || 0,
        latest_observation_file: latestObsPath,
        pipeline,
      },
      { status: 200 }
    );
    return addCorsHeaders(response, origin);
  } catch (error) {
    const response = NextResponse.json(
      {
        status: 'error',
        last_scrape: null,
        observations_count: 0,
        latest_observation_file: null,
        pipeline,
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
    return addCorsHeaders(response, origin);
  }
}
