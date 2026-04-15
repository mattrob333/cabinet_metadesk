/**
 * API Route: GET /api/meta-desk/context-bundle
 *
 * Returns the latest intelligence package (observations + daily brief +
 * ledger) as a single JSON document. CORS-enabled for MemeLabz.
 *
 * See src/lib/meta-desk/cors.ts for the allowlist.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { buildContextBundle } from '@/lib/meta-desk/context-bundle-builder';
import { addCorsHeaders, corsOptionsResponse } from '@/lib/meta-desk/cors';

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request.headers.get('origin'));
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    const bundle = await buildContextBundle(date);

    if (bundle.status === 'unavailable') {
      const response = NextResponse.json(
        {
          error: `No data available for date ${bundle.date}`,
          date: bundle.date,
          suggestions: [
            "Try today's date",
            'Run the DexScreener scraper: npm run scrape:dex',
            'Check if observations exist in data/observations/onchain/dexscreener/',
          ],
        },
        { status: 404 }
      );
      return addCorsHeaders(response, origin);
    }

    const response = NextResponse.json(bundle, { status: 200 });
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error('[API] Context bundle error:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to generate context bundle',
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}
