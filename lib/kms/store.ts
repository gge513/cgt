/**
 * KMS Data Store Abstraction Layer
 *
 * Provides a single interface for all KMS data access.
 * Eliminates duplication of file reading, parsing, and aggregation logic.
 *
 * Supports multiple implementations (file, database, cache) through the IKMSStore interface.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { KMSStore, KMSDecision, KMSActionItem, KMSCommitment, KMSRisk } from '@/src/types';
import { getLogger } from '@/src/utils/logging';
import { SafeFileContext } from '@/src/utils/paths';

const logger = getLogger();

// ==========================================
// Interface Definition
// ==========================================

/**
 * Interface for KMS data stores
 * Implementations can use different backends (file, database, etc.)
 */
export interface IKMSStore {
  /**
   * Load complete KMS data
   */
  loadData(): KMSStore;

  /**
   * Save KMS data
   */
  saveData(data: KMSStore): void;

  /**
   * Get all decisions across all meetings
   */
  getDecisions(): KMSDecision[];

  /**
   * Get all action items across all meetings
   */
  getActions(): KMSActionItem[];

  /**
   * Get all commitments across all meetings
   */
  getCommitments(): KMSCommitment[];

  /**
   * Get all risks across all meetings
   */
  getRisks(): KMSRisk[];

  /**
   * Get all items of all types (decisions + actions + commitments + risks)
   */
  getAllItems(): (KMSDecision | KMSActionItem | KMSCommitment | KMSRisk)[];
}

// ==========================================
// File-Based Implementation
// ==========================================

/**
 * File-based KMS store
 * Reads from and writes to .processed_kms.json
 */
export class KMSFileStore implements IKMSStore {
  private dataPath: string;
  private fileContext: SafeFileContext;

  constructor(basePath: string = process.cwd()) {
    this.fileContext = new SafeFileContext(basePath);
    this.dataPath = this.fileContext.resolve('.processed_kms.json');
  }

  /**
   * Load complete KMS data from disk
   */
  loadData(): KMSStore {
    try {
      const content = readFileSync(this.dataPath, 'utf-8');
      const data = JSON.parse(content) as KMSStore;
      logger.debug('KMS data loaded from file');
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load KMS data: ${message}`);
      throw error;
    }
  }

  /**
   * Save KMS data to disk
   */
  saveData(data: KMSStore): void {
    try {
      writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf-8');
      logger.debug('KMS data saved to file');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save KMS data: ${message}`);
      throw error;
    }
  }

  /**
   * Get all decisions across all meetings
   */
  getDecisions(): KMSDecision[] {
    const data = this.loadData();
    const decisions: KMSDecision[] = [];

    if (data.meetings && typeof data.meetings === 'object') {
      Object.values(data.meetings).forEach((meeting) => {
        if (meeting.decisions && Array.isArray(meeting.decisions)) {
          decisions.push(...meeting.decisions);
        }
      });
    }

    return decisions;
  }

  /**
   * Get all action items across all meetings
   */
  getActions(): KMSActionItem[] {
    const data = this.loadData();
    const actions: KMSActionItem[] = [];

    if (data.meetings && typeof data.meetings === 'object') {
      Object.values(data.meetings).forEach((meeting) => {
        if (meeting.actionItems && Array.isArray(meeting.actionItems)) {
          actions.push(...meeting.actionItems);
        }
      });
    }

    return actions;
  }

  /**
   * Get all commitments across all meetings
   */
  getCommitments(): KMSCommitment[] {
    const data = this.loadData();
    const commitments: KMSCommitment[] = [];

    if (data.meetings && typeof data.meetings === 'object') {
      Object.values(data.meetings).forEach((meeting) => {
        if (meeting.commitments && Array.isArray(meeting.commitments)) {
          commitments.push(...meeting.commitments);
        }
      });
    }

    return commitments;
  }

  /**
   * Get all risks across all meetings
   */
  getRisks(): KMSRisk[] {
    const data = this.loadData();
    const risks: KMSRisk[] = [];

    if (data.meetings && typeof data.meetings === 'object') {
      Object.values(data.meetings).forEach((meeting) => {
        if (meeting.risks && Array.isArray(meeting.risks)) {
          risks.push(...meeting.risks);
        }
      });
    }

    return risks;
  }

  /**
   * Get all items of all types
   */
  getAllItems(): (KMSDecision | KMSActionItem | KMSCommitment | KMSRisk)[] {
    return [
      ...this.getDecisions(),
      ...this.getActions(),
      ...this.getCommitments(),
      ...this.getRisks(),
    ];
  }
}

// ==========================================
// Singleton Factory
// ==========================================

let storeInstance: IKMSStore | null = null;

/**
 * Get the KMS store singleton instance
 *
 * Creates a KMSFileStore on first call and caches it.
 * This prevents recreating the store on every request.
 *
 * @returns IKMSStore instance
 */
export function getKMSStore(): IKMSStore {
  if (!storeInstance) {
    storeInstance = new KMSFileStore();
  }
  return storeInstance;
}

/**
 * Reset store instance (for testing)
 */
export function resetKMSStore(): void {
  storeInstance = null;
}

/**
 * Set custom store instance (for testing)
 */
export function setKMSStore(store: IKMSStore): void {
  storeInstance = store;
}
