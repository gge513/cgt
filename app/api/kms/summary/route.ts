/**
 * KMS Summary Endpoint (Cached)
 *
 * Returns aggregated statistics across all meetings.
 * Uses dual-layer caching:
 * - File mtime cache: Automatic invalidation when KMS file changes
 * - TTL cache: 30-second cache of aggregated results
 */

import { NextRequest, NextResponse } from 'next/server';
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
    // Check TTL cache first for aggregated results
    const cachedSummary = cacheGet('summary');
    if (cachedSummary) {
      logger.debug('Summary returned from TTL cache');
      return NextResponse.json(cachedSummary);
    }

    // Load KMS data (uses mtime cache)
    const kmsData = getKMSData();

    if (!kmsData || !kmsData.meetings) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    // Calculate statistics by aggregating from all meetings
    const decisions: any[] = [];
    const actions: any[] = [];
    const commitments: any[] = [];
    const risks: any[] = [];

    if (kmsData.meetings && typeof kmsData.meetings === 'object') {
      Object.values(kmsData.meetings).forEach((meeting: any) => {
        if (meeting.decisions && Array.isArray(meeting.decisions)) {
          decisions.push(...meeting.decisions);
        }
        if (meeting.actions && Array.isArray(meeting.actions)) {
          actions.push(...meeting.actions);
        }
        if (meeting.commitments && Array.isArray(meeting.commitments)) {
          commitments.push(...meeting.commitments);
        }
        if (meeting.risks && Array.isArray(meeting.risks)) {
          risks.push(...meeting.risks);
        }
      });
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
