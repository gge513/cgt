/**
 * KMS Summary Endpoint (Cached)
 *
 * Returns aggregated statistics across all meetings.
 * Uses dual-layer caching:
 * - File mtime cache: Automatic invalidation when KMS file changes
 * - TTL cache: 30-second cache of aggregated results
 *
 * Type-safe: Uses proper KMS types from src/types.ts
 */

import { NextRequest, NextResponse } from 'next/server';
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
    // Check TTL cache first for aggregated results
    const cachedSummary = cacheGet('summary');
    if (cachedSummary) {
      logger.debug('Summary returned from TTL cache');
      return NextResponse.json(cachedSummary);
    }

    // Load KMS data using the abstraction layer
    const store = getKMSStore();
    const kmsData = store.loadData();
    const decisions = store.getDecisions();
    const actions = store.getActions();
    const commitments = store.getCommitments();
    const risks = store.getRisks();

    if (!decisions || decisions.length === 0) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    const statusCounts = {
      pending: decisions.filter((d: any) => d.status === 'pending').length,
      in_progress: decisions.filter((d: any) => d.status === 'in_progress').length,
      completed: decisions.filter((d: any) => d.status === 'completed').length,
    };

    const riskCounts = {
      low: risks.filter((r: any) => r.severity === 'low').length,
      medium: risks.filter((r: any) => r.severity === 'medium').length,
      high: risks.filter((r: any) => r.severity === 'high').length,
    };

    const totalItems = decisions.length + actions.length + commitments.length;
    const escalatedCount = decisions.filter((d: any) => d.is_escalated).length;

    const summary = {
      summary: {
        total_decisions: decisions.length,
        total_actions: actions.length,
        total_commitments: commitments.length,
        total_risks: risks.length,
        total_items: totalItems,
        escalated_count: escalatedCount,
      },
      status_distribution: statusCounts,
      risk_distribution: riskCounts,
      completion_percentage: Math.round(
        (statusCounts.completed / decisions.length) * 100
      ) || 0,
      high_risk_count: riskCounts.high,
      last_updated: kmsData.lastUpdated || 'Unknown',
      total_meetings: Object.keys(kmsData.meetings || {}).length,
    };

    // Cache the aggregated result (30 seconds)
    cacheSet('summary', summary);
    logger.debug('Summary computed and cached');

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Summary endpoint failed: ${message}`);

    return NextResponse.json(
      { error: 'Failed to fetch summary', details: message },
      { status: 500 }
    );
  }
}
