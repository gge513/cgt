/**
 * KMS Decisions Endpoint (Cached)
 *
 * Returns all decisions across meetings with optional filtering.
 * Uses dual-layer caching with query-aware cache keys.
 *
 * Type-safe: Uses proper KMS types from src/types.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import type { KMSStore, KMSDecision } from '@/src/types';
import { validateAuth } from '@/lib/auth';
import { getKMSData, cacheGet, cacheSet } from '@/lib/cache';
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

    // Load KMS data (uses mtime cache)
    const kmsData: KMSStore = getKMSData();

    if (!kmsData || !kmsData.meetings) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    // Extract decisions from all meetings
    const decisions: KMSDecision[] = [];
    if (kmsData.meetings && typeof kmsData.meetings === 'object') {
      Object.values(kmsData.meetings).forEach((meeting) => {
        if (meeting.decisions && Array.isArray(meeting.decisions)) {
          decisions.push(...meeting.decisions);
        }
      });
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
