import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    const kmsPath = path.join(process.cwd(), '.processed_kms.json');

    if (!fs.existsSync(kmsPath)) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

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

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: String(error) },
      { status: 500 }
    );
  }
}
