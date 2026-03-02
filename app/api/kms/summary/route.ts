/**
 * KMS Summary Endpoint
 *
 * Returns aggregated statistics across all meetings.
 * Uses mtime caching for KMS file reads (automatic invalidation when file changes).
 *
 * Type-safe: Uses proper KMS types from src/types.ts
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
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
    // Load KMS data using the abstraction layer (mtime-cached, one disk read)
    const store = getKMSStore();
    const kmsData = store.loadData();
    const decisions = store.getDecisions();       // cache hit (same mtime epoch)
    const actions = store.getActions();           // cache hit (same mtime epoch)
    const commitments = store.getCommitments();   // cache hit (same mtime epoch)
    const risks = store.getRisks();               // cache hit (same mtime epoch)

    if (!decisions || decisions.length === 0) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    const statusCounts = {
      pending: decisions.filter((d) => d.status === 'pending').length,
      in_progress: decisions.filter((d) => d.status === 'in-progress').length,
      completed: decisions.filter((d) => d.status === 'completed').length,
    };

    const riskCounts = {
      low: risks.filter((r) => r.severity === 'low').length,
      medium: risks.filter((r) => r.severity === 'medium').length,
      high: risks.filter((r) => r.severity === 'high').length,
    };

    const totalItems = decisions.length + actions.length + commitments.length;
    const escalatedCount = decisions.filter((d) => (d as any).is_escalated).length;

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
