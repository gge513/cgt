import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { validateAuth } from '@/lib/auth';

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

/**
 * Load validation store from disk
 */
function loadValidations(): ValidationStore {
  try {
    if (!fs.existsSync(VALIDATIONS_PATH)) {
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        validations: [],
      };
    }

    const content = fs.readFileSync(VALIDATIONS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Could not load validations, creating new store');
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      validations: [],
    };
  }
}

/**
 * Save validation store to disk
 */
function saveValidations(store: ValidationStore): void {
  try {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(VALIDATIONS_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save validations:', error);
  }
}

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
    const { relationshipId, validated, userFeedback } = body;

    if (!relationshipId || validated === undefined) {
      return NextResponse.json(
        { error: 'Missing relationshipId or validated field' },
        { status: 400 }
      );
    }

    // Load existing validations
    const store = loadValidations();

    // Check if validation already exists
    const existingIndex = store.validations.findIndex(
      (v) => v.relationshipId === relationshipId
    );

    const validation: ValidationRecord = {
      relationshipId,
      validated,
      validatedAt: new Date().toISOString(),
      userFeedback,
    };

    if (existingIndex >= 0) {
      // Update existing
      store.validations[existingIndex] = validation;
    } else {
      // Add new
      store.validations.push(validation);
    }

    // Save updated store
    saveValidations(store);

    return NextResponse.json({
      success: true,
      validation,
      totalValidations: store.validations.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save validation', details: String(error) },
      { status: 500 }
    );
  }
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
    const store = loadValidations();

    return NextResponse.json({
      version: store.version,
      lastUpdated: store.lastUpdated,
      totalValidations: store.validations.length,
      validations: store.validations,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load validations', details: String(error) },
      { status: 500 }
    );
  }
}
