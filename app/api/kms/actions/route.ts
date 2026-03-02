import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

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

    return NextResponse.json({
      success: true,
      action: actionRecord,
      totalActions: store.actions.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to execute action', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const store = loadActions();

    return NextResponse.json({
      version: store.version,
      lastUpdated: store.lastUpdated,
      totalActions: store.actions.length,
      actions: store.actions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load actions', details: String(error) },
      { status: 500 }
    );
  }
}
