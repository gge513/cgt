/**
 * KMS Strategic Actions Endpoint (Cached)
 *
 * Manages user actions on decisions (escalate, resolve, mark high-priority).
 * GET: Returns audit log of executed actions (cached)
 * POST: Execute an action and update KMS store
 *
 * Type-safe: Uses proper types for action records
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { validateAuth } from '@/lib/auth';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '@/lib/cache';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

interface ActionRecord {
  decisionId: string;
  action: 'escalate' | 'resolve' | 'high-priority';
  executedAt: string;
  userId?: string;
}

interface ActionsStore {
  version: 1;
  lastUpdated: string;
  actions: ActionRecord[];
}

const ACTIONS_PATH = '.processed_kms_actions.json';

/**
 * Load actions store from disk
 */
function loadActions(): ActionsStore {
  try {
    if (!fs.existsSync(ACTIONS_PATH)) {
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        actions: [],
      };
    }

    const content = fs.readFileSync(ACTIONS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Could not load actions, creating new store');
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      actions: [],
    };
  }
}

/**
 * Save actions store to disk
 */
function saveActions(store: ActionsStore): void {
  try {
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(ACTIONS_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save actions:', error);
  }
}

/**
 * Apply action to KMS store
 */
function applyActionToKMS(decisionId: string, action: string): void {
  const kmsPath = '.processed_kms.json';

  try {
    if (!fs.existsSync(kmsPath)) {
      return;
    }

    const content = fs.readFileSync(kmsPath, 'utf-8');
    const kmsStore = JSON.parse(content);

    // Find and update the decision
    const decision = kmsStore.decisions?.find(
      (d: any) => d.id === decisionId
    );

    if (!decision) {
      console.warn(`Decision ${decisionId} not found in KMS store`);
      return;
    }

    // Apply the action
    switch (action) {
      case 'escalate':
        decision.is_escalated = true;
        break;
      case 'resolve':
        decision.status = 'resolved';
        break;
      case 'high-priority':
        decision.severity = 'high';
        break;
    }

    // Write back
    fs.writeFileSync(kmsPath, JSON.stringify(kmsStore, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to apply action to KMS:', error);
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
    const { decisionId, action } = body;

    if (!decisionId || !action) {
      return NextResponse.json(
        { error: 'Missing decisionId or action field' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['escalate', 'resolve', 'high-priority'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Load existing actions
    const store = loadActions();

    // Record the action
    const actionRecord: ActionRecord = {
      decisionId,
      action: action as ActionRecord['action'],
      executedAt: new Date().toISOString(),
    };

    store.actions.push(actionRecord);

    // Apply action to KMS store
    applyActionToKMS(decisionId, action);

    // Save updated store
    saveActions(store);

    // Invalidate related caches
    cacheInvalidatePattern('actions:');
    cacheInvalidatePattern('summary');
    logger.debug(`Cache invalidated for executed action: ${action}`);

    return NextResponse.json({
      success: true,
      action: actionRecord,
      totalActions: store.actions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to execute action: ${message}`);

    return NextResponse.json(
      { error: 'Failed to execute action', details: message },
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
    // Check TTL cache first
    const cacheKey = 'actions:list';
    const cached = cacheGet(cacheKey);
    if (cached) {
      logger.debug('Actions list returned from cache');
      return NextResponse.json(cached);
    }

    const store = loadActions();

    const result = {
      version: store.version,
      lastUpdated: store.lastUpdated,
      totalActions: store.actions.length,
      actions: store.actions,
    };

    // Cache the result (30 seconds)
    cacheSet(cacheKey, result);
    logger.debug('Actions list cached');

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load actions: ${message}`);

    return NextResponse.json(
      { error: 'Failed to load actions', details: message },
      { status: 500 }
    );
  }
}
