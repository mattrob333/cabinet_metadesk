/**
 * API Route: GET /api/meta-desk/ledger
 *
 * Returns the persistent confidence ledger written by LedgerManager to
 * data/ledger.json. Includes summary counts so MemeLabz can render
 * a "Confidence Leaderboard" without re-aggregating on the client.
 *
 * Query parameters:
 *   ?confidence=FULL|PARTIAL|MINIMAL  — filter entities by confidence state
 *   ?type=token|narrative|protocol|account  — filter entities by type
 *   ?entity=<name>  — return only this entity (exact match, case-sensitive)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { addCorsHeaders, corsOptionsResponse } from '@/lib/meta-desk/cors';
import type { Ledger, LedgerEntity } from '@/lib/agents/resolution/ledger-manager';

const LEDGER_PATH = path.join(process.cwd(), 'data', 'ledger.json');

const VALID_CONFIDENCE = new Set(['FULL', 'PARTIAL', 'MINIMAL']);
const VALID_TYPES = new Set(['token', 'narrative', 'protocol', 'account']);

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request.headers.get('origin'));
}

async function loadLedger(): Promise<Ledger | null> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf-8');
    return JSON.parse(raw) as Ledger;
  } catch {
    return null;
  }
}

function summarize(entities: Record<string, LedgerEntity>) {
  const byState: Record<string, number> = { FULL: 0, PARTIAL: 0, MINIMAL: 0 };
  const byType: Record<string, number> = { token: 0, narrative: 0, protocol: 0, account: 0 };
  let totalResolved = 0;
  let totalUnresolvable = 0;
  let totalOpen = 0;
  for (const entity of Object.values(entities)) {
    byState[entity.confidence_state] = (byState[entity.confidence_state] ?? 0) + 1;
    byType[entity.type] = (byType[entity.type] ?? 0) + 1;
    totalResolved += entity.resolved_facts.length;
    totalUnresolvable += entity.unresolvable_gaps.length;
    totalOpen += entity.open_gaps.length;
  }
  return {
    entity_count: Object.keys(entities).length,
    by_confidence: byState,
    by_type: byType,
    resolved_facts_total: totalResolved,
    unresolvable_gaps_total: totalUnresolvable,
    open_gaps_total: totalOpen,
  };
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const { searchParams } = new URL(request.url);
  const confidenceFilter = searchParams.get('confidence');
  const typeFilter = searchParams.get('type');
  const entityFilter = searchParams.get('entity');

  if (confidenceFilter && !VALID_CONFIDENCE.has(confidenceFilter)) {
    const response = NextResponse.json(
      { error: `Invalid confidence filter. Expected one of: ${[...VALID_CONFIDENCE].join(', ')}` },
      { status: 400 }
    );
    return addCorsHeaders(response, origin);
  }

  if (typeFilter && !VALID_TYPES.has(typeFilter)) {
    const response = NextResponse.json(
      { error: `Invalid type filter. Expected one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 }
    );
    return addCorsHeaders(response, origin);
  }

  try {
    const ledger = await loadLedger();

    if (!ledger) {
      const response = NextResponse.json(
        {
          status: 'unavailable',
          generated_at: new Date().toISOString(),
          message: 'No ledger yet. Run a debate: npm run debate',
          ledger: null,
          summary: null,
        },
        { status: 404 }
      );
      return addCorsHeaders(response, origin);
    }

    // Apply filters. Pre-summary is the full ledger (so consumers can always
    // see how their filter affected the total), filtered entities are the result.
    const fullSummary = summarize(ledger.entities);
    let entities = ledger.entities;

    if (entityFilter) {
      entities = entities[entityFilter] ? { [entityFilter]: entities[entityFilter] } : {};
    }
    if (confidenceFilter) {
      entities = Object.fromEntries(
        Object.entries(entities).filter(([, e]) => e.confidence_state === confidenceFilter)
      );
    }
    if (typeFilter) {
      entities = Object.fromEntries(
        Object.entries(entities).filter(([, e]) => e.type === typeFilter)
      );
    }

    const filteredSummary = summarize(entities);

    const response = NextResponse.json(
      {
        status: 'available',
        generated_at: new Date().toISOString(),
        last_updated: ledger.last_updated,
        version: ledger.version,
        summary: {
          full: fullSummary,
          filtered: filteredSummary,
          filters_applied: {
            confidence: confidenceFilter,
            type: typeFilter,
            entity: entityFilter,
          },
        },
        entities,
      },
      { status: 200 }
    );
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error('[API] ledger endpoint error:', error);
    const response = NextResponse.json(
      {
        error: 'Failed to load ledger',
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}
