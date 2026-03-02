/**
 * KMS Relationship Validation API
 *
 * Allows agents to confirm or reject AI-inferred relationships
 * between KMS items (decisions, actions, risks, commitments).
 *
 * Uses Zod schema validation to prevent injection attacks
 * and ensure data integrity.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { validateAuth } from '@/lib/auth';
import { validateRelationshipSchema, type ValidateRelationshipRequest } from '@/lib/validation-schemas';
import { getLogger } from '@/src/utils/logging';
import { SafeFileContext } from '@/src/utils/paths';

const logger = getLogger();

interface ValidationRecord {
  relationshipId: string;
  validated: boolean;
  validatedAt: string;
  userFeedback?: string;
}

interface ValidationStore {
  version: 1;
  lastUpdated: string;
  validations: ValidationRecord[];
}

const VALIDATIONS_PATH = '.processed_kms_validations.json';
const fileContext = new SafeFileContext(process.cwd());

/**
 * Load validation store from disk
 * Uses SafeFileContext to prevent path traversal attacks
 */
function loadValidations(): ValidationStore {
  try {
    const safePath = fileContext.resolve(VALIDATIONS_PATH);

    if (!fs.existsSync(safePath)) {
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        validations: [],
      };
    }

    const content = fs.readFileSync(safePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not load validations, creating new store: ${message}`);
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      validations: [],
    };
  }
}

/**
 * Save validation store to disk
 * Uses SafeFileContext to prevent path traversal attacks
 */
function saveValidations(store: ValidationStore): void {
  try {
    const safePath = fileContext.resolve(VALIDATIONS_PATH);
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(safePath, JSON.stringify(store, null, 2), 'utf-8');
    logger.debug('Validation store saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save validations: ${message}`);
  }
}

/**
 * POST /api/kms/validate
 *
 * Validate (confirm or reject) an AI-inferred relationship
 * between KMS items.
 *
 * Request body:
 * {
 *   relationshipId: UUID,     // ID of the inferred relationship
 *   validated: boolean,       // Whether the relationship is valid
 *   userFeedback?: string     // Optional human feedback
 * }
 */
export async function POST(request: NextRequest) {
  // Validate authentication first
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // ==========================================
    // Schema validation with Zod
    // ==========================================
    let validated: ValidateRelationshipRequest;
    try {
      validated = validateRelationshipSchema.parse(body);
    } catch (error) {
      if (error instanceof Error) {
        logger.warn(`Validation request rejected: ${error.message}`);
        return NextResponse.json(
          { error: 'Invalid request', details: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

    // Load existing validations
    const store = loadValidations();

    // Check if validation already exists
    const existingIndex = store.validations.findIndex(
      (v) => v.relationshipId === validated.relationshipId
    );

    const validation: ValidationRecord = {
      relationshipId: validated.relationshipId,
      validated: validated.validated,
      validatedAt: new Date().toISOString(),
      userFeedback: validated.userFeedback,
    };

    if (existingIndex >= 0) {
      // Update existing
      store.validations[existingIndex] = validation;
      logger.debug(`Updated validation for relationship: ${validated.relationshipId}`);
    } else {
      // Add new
      store.validations.push(validation);
      logger.debug(`Created validation for relationship: ${validated.relationshipId}`);
    }

    // Save updated store
    saveValidations(store);

    return NextResponse.json(
      {
        success: true,
        validation,
        totalValidations: store.validations.length,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Validation endpoint failed: ${message}`);

    return NextResponse.json(
      { error: 'Failed to save validation', details: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kms/validate
 *
 * Retrieve all relationship validations from human reviewers.
 */
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
    const store = loadValidations();

    logger.debug(`Retrieving ${store.validations.length} relationship validations`);

    return NextResponse.json({
      version: store.version,
      lastUpdated: store.lastUpdated,
      totalValidations: store.validations.length,
      validations: store.validations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load validations: ${message}`);

    return NextResponse.json(
      { error: 'Failed to load validations', details: message },
      { status: 500 }
    );
  }
}
