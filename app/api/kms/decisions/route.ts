import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    const kmsPath = path.join(process.cwd(), '.processed_kms.json');

    if (!fs.existsSync(kmsPath)) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

    // Extract decisions from all meetings
    const decisions: any[] = [];
    if (kmsData.meetings && typeof kmsData.meetings === 'object') {
      Object.values(kmsData.meetings).forEach((meeting: any) => {
        if (meeting.decisions && Array.isArray(meeting.decisions)) {
          decisions.push(...meeting.decisions);
        }
      });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const keyword = searchParams.get('keyword');

    // Filter decisions
    let filtered = decisions;

    if (status) {
      filtered = filtered.filter((d: any) => d.status === status);
    }

    if (severity) {
      filtered = filtered.filter((d: any) => d.severity === severity);
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter((d: any) =>
        d.text.toLowerCase().includes(lowerKeyword) ||
        d.owner?.toLowerCase().includes(lowerKeyword) ||
        d.meeting?.toLowerCase().includes(lowerKeyword)
      );
    }

    return NextResponse.json({
      total: decisions.length,
      filtered: filtered.length,
      decisions: filtered,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch decisions', details: String(error) },
      { status: 500 }
    );
  }
}
