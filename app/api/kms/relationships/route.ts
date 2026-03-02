/**
 * KMS Relationships Endpoint
 *
 * Returns AI-inferred relationships between KMS items.
 *
 * Type-safe: Uses proper types for inferred relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { InferencedRelationship } from '@/lib/validation-schemas';
import { validateAuth } from '@/lib/auth';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();
const INFERRED_PATH = '.processed_kms_inferred.json';

interface InferredRelationshipsStore {
  version: number;
  inferredAt: string;
  totalRelationships: number;
  relationships: InferencedRelationship[];
}

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
      logger.debug('No inferred relationships found');
      return NextResponse.json({
        total: 0,
        relationships: [],
      });
    }

    const content = fs.readFileSync(INFERRED_PATH, 'utf-8');
    const inferredStore: InferredRelationshipsStore = JSON.parse(content);

    // Filter relationships for this decision (both outgoing and incoming)
    const relationships = (inferredStore.relationships || []).filter(
      (rel) => rel.fromId === decisionId || rel.toId === decisionId
    );

    logger.debug(`Found ${relationships.length} relationships for ${decisionId}`);

    return NextResponse.json({
      total: relationships.length,
      relationships: relationships.sort((a, b) => b.confidence - a.confidence),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch relationships: ${message}`);

    return NextResponse.json(
      { error: 'Failed to fetch relationships', details: message },
      { status: 500 }
    );
  }
}
