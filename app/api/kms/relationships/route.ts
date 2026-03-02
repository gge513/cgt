import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { validateAuth } from '@/lib/auth';

const INFERRED_PATH = '.processed_kms_inferred.json';

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
    const { searchParams } = new URL(request.url);
    const decisionId = searchParams.get('decisionId');

    if (!decisionId) {
      return NextResponse.json(
        { error: 'Missing decisionId parameter' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(INFERRED_PATH)) {
      return NextResponse.json({
        total: 0,
        relationships: [],
      });
    }

    const content = fs.readFileSync(INFERRED_PATH, 'utf-8');
    const inferredStore = JSON.parse(content);

    // Filter relationships for this decision (both outgoing and incoming)
    const relationships = (inferredStore.relationships || []).filter(
      (rel: any) => rel.fromId === decisionId || rel.toId === decisionId
    );

    return NextResponse.json({
      total: relationships.length,
      relationships: relationships.sort(
        (a: any, b: any) => b.confidence - a.confidence
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch relationships', details: String(error) },
      { status: 500 }
    );
  }
}
