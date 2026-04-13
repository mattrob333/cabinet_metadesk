/**
 * API Route: GET /api/meta-desk/context-bundle
 *
 * Returns latest intelligence package (observations + trending data)
 * Includes CORS headers for MemeLabz cross-origin requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildContextBundle } from '@/lib/meta-desk/context-bundle-builder';

/**
 * CORS configuration
 * Allow MemeLabz and localhost for development
 */
const ALLOWED_ORIGINS = [
  'https://memelabz.fun',
  'https://www.memelabz.fun',
  /^https:\/\/.*\.memelabz\.fun$/, // Any subdomain
  /^http:\/\/localhost(:\d+)?$/ // Localhost with any port
];

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    }
    return allowed.test(origin);
  });
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
}

/**
 * Handle preflight OPTIONS request
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = NextResponse.json({ ok: true }, { status: 200 });
  return addCorsHeaders(response, origin);
}

/**
 * Handle GET request
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    // Build context bundle
    const bundle = await buildContextBundle(date);

    // Check if data is available
    if (bundle.status === 'unavailable') {
      const response = NextResponse.json(
        {
          error: `No data available for date ${bundle.date}`,
          date: bundle.date,
          suggestions: [
            'Try today\'s date',
            'Run the DexScreener scraper: npm run scrape:dex',
            'Check if observations exist in data/observations/onchain/dexscreener/'
          ]
        },
        { status: 404 }
      );
      return addCorsHeaders(response, origin);
    }

    // Return bundle
    const response = NextResponse.json(bundle, { status: 200 });
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error('[API] Context bundle error:', error);

    const response = NextResponse.json(
      {
        error: 'Failed to generate context bundle',
        reason: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}
