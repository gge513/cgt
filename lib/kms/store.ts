/**
 * KMS Data Store Abstraction Layer
 *
 * Provides a single interface for all KMS data access.
 * Eliminates duplication of file reading, parsing, and aggregation logic.
 *
 * Supports multiple implementations (file, database, cache) through the IKMSStore interface.
 */

import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import type { KMSStore, KMSData, KMSDecision, KMSActionItem, KMSCommitment, KMSRisk } from '@/src/types';
import { getLogger } from '@/src/utils/logging';
import { SafeFileContext } from '@/src/utils/paths';
import { getKMSData } from '../cache';
import { kmsStoreSchema } from '../validation-schemas';

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
   * Load complete KMS data from disk with mtime-based caching
   * Uses getKMSData() which eliminates N+1 reads across multiple accessor calls
   */
  loadData(): KMSStore {
    try {
      const raw = getKMSData();
      const data = kmsStoreSchema.parse(raw);
      logger.debug('KMS data loaded from cache');
      return data as KMSStore;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load KMS data: ${message}`);
      throw error;
    }
  }

  /**
   * Save KMS data to disk with atomic write
   * Writes to temp file first, then atomically renames to prevent corruption
   */
  saveData(data: KMSStore): void {
    try {
      const tempPath = this.dataPath + '.tmp';
      writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      renameSync(tempPath, this.dataPath);
      logger.debug('KMS data saved to file (atomic)');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save KMS data: ${message}`);
      throw error;
    }
  }

  /**
   * Extract items of a specific type from all meetings
   * Private helper to avoid duplication across getDecisions, getActions, etc.
   */
  private getFromMeetings<T>(accessor: (meeting: KMSData) => T[]): T[] {
    const data = this.loadData();
    const items: T[] = [];

    if (data.meetings && typeof data.meetings === 'object') {
      Object.values(data.meetings).forEach((meeting) => {
        const meetingItems = accessor(meeting);
        if (Array.isArray(meetingItems)) {
          items.push(...meetingItems);
        }
      });
    }

    return items;
  }

  /**
   * Get all decisions across all meetings
   */
  getDecisions(): KMSDecision[] {
    return this.getFromMeetings((m) => m.decisions);
  }

  /**
   * Get all action items across all meetings
   */
  getActions(): KMSActionItem[] {
    return this.getFromMeetings((m) => m.actionItems);
  }

  /**
   * Get all commitments across all meetings
   */
  getCommitments(): KMSCommitment[] {
    return this.getFromMeetings((m) => m.commitments);
  }

  /**
   * Get all risks across all meetings
   */
  getRisks(): KMSRisk[] {
    return this.getFromMeetings((m) => m.risks);
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
