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
import type { KMSDecision } from '@/src/types';
import { validateAuth } from '@/lib/auth';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '@/lib/cache';
import { getKMSStore } from '@/lib/kms';
import { getLogger } from '@/src/utils/logging';
import { SafeFileContext } from '@/src/utils/paths';
import { actionsStoreSchema } from '@/lib/validation-schemas';

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

// Security: Use SafeFileContext to prevent path traversal attacks
const fileContext = new SafeFileContext(process.cwd());
const SAFE_ACTIONS_PATH = fileContext.resolve(ACTIONS_PATH);

/**
 * Load actions store from disk with validation
 */
function loadActions(): ActionsStore {
  try {
    if (!fs.existsSync(SAFE_ACTIONS_PATH)) {
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        actions: [],
      };
    }

    const content = fs.readFileSync(SAFE_ACTIONS_PATH, 'utf-8');
    return actionsStoreSchema.parse(JSON.parse(content)) as ActionsStore;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not load actions: ${message}, creating new store`);
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      actions: [],
    };
  }
}

/**
 * Save actions store to disk with atomic write
 */
function saveActions(store: ActionsStore): void {
  try {
    store.lastUpdated = new Date().toISOString();
    const tempPath = SAFE_ACTIONS_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tempPath, SAFE_ACTIONS_PATH);  // atomic rename
    logger.debug('Actions store saved (atomic)');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save actions: ${message}`);
  }
}

/**
 * Apply action to KMS store using the abstraction layer
 * Currently just logs the action; future enhancements could update decision status
 */
function applyActionToKMS(decisionId: string, action: string): void {
  try {
    const store = getKMSStore();
    const kmsData = store.loadData();

    if (!kmsData.meetings) {
      return;
    }

    // Verify decision exists in KMS store
    let found = false;
    Object.values(kmsData.meetings).forEach((meeting) => {
      if (!meeting.decisions) return;

      const decision = meeting.decisions.find(
        (d: KMSDecision) => d.id === decisionId
      );

      if (decision) {
        found = true;
        // Future: Could update decision properties here if schema allows
        // For now, just record that action was taken (stored in ActionsStore)
      }
    });

    if (!found) {
      logger.warn(`Decision ${decisionId} not found in KMS store`);
      return;
    }

    logger.debug(`Recorded action ${action} for decision ${decisionId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to apply action to KMS: ${message}`);
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
