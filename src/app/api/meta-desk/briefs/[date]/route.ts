/**
 * API Route: GET /api/meta-desk/briefs/[date]
 *
 * Returns the daily brief (data/meta-desk/daily-briefs/{date}.md) plus the
 * most recent completed debate run for that date. Meant to be called from
 * MemeLabz so it can render the Referee's synthesis, the resolved facts, and
 * any remaining open gaps without needing filesystem access to Cabinet.
 *
 * Response shape:
 *   {
 *     date, generated_at,
 *     status: "available" | "brief_only" | "debate_only" | "unavailable",
 *     brief: DailyBrief | null,
 *     debate: DebateRunDetail | null,
 *     available_runs: [{id, status, created_at, completed_at}]
 *   }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { addCorsHeaders, corsOptionsResponse } from '@/lib/meta-desk/cors';
import {
  isValidDate,
  loadDailyBrief,
  listRunsForDate,
  pickLatestRunForDate,
  loadRunDetail,
} from '@/lib/meta-desk/debate-reader';

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request.headers.get('origin'));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const origin = request.headers.get('origin');
  const { date } = await params;

  if (!isValidDate(date)) {
    const response = NextResponse.json(
      { error: 'Invalid date format. Expected YYYY-MM-DD.', date },
      { status: 400 }
    );
    return addCorsHeaders(response, origin);
  }

  try {
    const [brief, latestRunMeta, runsForDate] = await Promise.all([
      loadDailyBrief(date),
      pickLatestRunForDate(date),
      listRunsForDate(date),
    ]);

    const debate = latestRunMeta ? await loadRunDetail(latestRunMeta.id) : null;

    let status: 'available' | 'brief_only' | 'debate_only' | 'unavailable';
    if (brief && debate) status = 'available';
    else if (brief) status = 'brief_only';
    else if (debate) status = 'debate_only';
    else status = 'unavailable';

    if (status === 'unavailable') {
      const response = NextResponse.json(
        {
          date,
          generated_at: new Date().toISOString(),
          status,
          brief: null,
          debate: null,
          available_runs: [],
          suggestions: [
            `No brief found at data/meta-desk/daily-briefs/${date}.md`,
            `No debate runs found in data/runs/ with date prefix ${date}`,
            'Run a debate: npm run debate ' + date,
          ],
        },
        { status: 404 }
      );
      return addCorsHeaders(response, origin);
    }

    const response = NextResponse.json(
      {
        date,
        generated_at: new Date().toISOString(),
        status,
        brief,
        debate,
        available_runs: runsForDate.map((r) => ({
          id: r.id,
          status: r.status,
          phase: r.phase,
          created_at: r.created_at,
          completed_at: r.completed_at,
        })),
      },
      { status: 200 }
    );
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error('[API] briefs endpoint error:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to load brief',
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}
