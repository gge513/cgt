/**
 * KMS Performance Monitoring Endpoint
 *
 * Returns cache statistics and system memory/process information.
 * Useful for monitoring system health and performance.
 *
 * Requires authentication.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { getCacheStats } from '@/lib/cache';

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
    const cacheStats = getCacheStats();
    const memUsage = process.memoryUsage();

    return NextResponse.json({
      cache: {
        mtimeCacheSize: cacheStats.mtimeCacheSize,
        ttlCacheSize: cacheStats.ttlCacheSize,
        ttlCacheExpiredCount: cacheStats.ttlCacheExpiredCount,
      },
      memory: {
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memUsage.rss / 1024 / 1024),
      },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to get performance stats', details: message },
      { status: 500 }
    );
  }
}
