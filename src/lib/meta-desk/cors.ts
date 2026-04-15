/**
 * Shared CORS helper for the /api/meta-desk/* endpoints.
 *
 * Public routes are meant to be called from MemeLabz (and localhost in dev),
 * so we allow a small set of known origins rather than `*`.
 */

import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS: Array<string | RegExp> = [
  'https://memelabz.fun',
  'https://www.memelabz.fun',
  /^https:\/\/.*\.memelabz\.fun$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === 'string' ? origin === allowed : allowed.test(origin)
  );
}

/**
 * Attach CORS headers to a NextResponse in-place.
 * Only sets Access-Control-Allow-Origin when the origin is in the allowlist.
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  methods: string = 'GET, OPTIONS'
): NextResponse {
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }
  response.headers.set('Access-Control-Allow-Methods', methods);
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

/**
 * Standard OPTIONS handler for preflight requests.
 */
export function corsOptionsResponse(origin: string | null, methods?: string): NextResponse {
  return addCorsHeaders(NextResponse.json({ ok: true }, { status: 200 }), origin, methods);
}
