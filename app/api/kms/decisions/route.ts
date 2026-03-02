/**
 * KMS Decisions Endpoint (Cached)
 *
 * Returns all decisions across meetings with optional filtering.
 * Uses dual-layer caching with query-aware cache keys.
 *
 * Type-safe: Uses proper KMS types from src/types.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import type { KMSDecision } from '@/src/types';
import { validateAuth } from '@/lib/auth';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getKMSStore } from '@/lib/kms';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

export async function GET(request: NextRequest) {
  // Validate authentication first
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const keyword = searchParams.get('keyword');

    // Create cache key based on query parameters
    const cacheKey = `decisions:${status || ''}:${severity || ''}:${keyword || ''}`;

    // Check TTL cache first
    const cached = cacheGet(cacheKey);
    if (cached) {
      logger.debug(`Decisions returned from cache: ${cacheKey}`);
      return NextResponse.json(cached);
    }

    // Load decisions using the abstraction layer
    const store = getKMSStore();
    const decisions: KMSDecision[] = store.getDecisions();

    if (!decisions || decisions.length === 0) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    // Filter decisions
    let filtered = decisions;

    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter((d) =>
        d.text.toLowerCase().includes(lowerKeyword) ||
        d.owner?.toLowerCase().includes(lowerKeyword) ||
        d.meeting?.toLowerCase().includes(lowerKeyword)
      );
    }

    const result = {
      total: decisions.length,
      filtered: filtered.length,
      decisions: filtered,
    };

    // Cache the filtered result (30 seconds)
    cacheSet(cacheKey, result);
    logger.debug(`Decisions cached: ${cacheKey}`);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Decisions endpoint failed: ${message}`);

    return NextResponse.json(
      { error: 'Failed to fetch decisions', details: message },
      { status: 500 }
    );
  }
}
