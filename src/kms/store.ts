/**
 * KMS Data Store Manager
 * Handles loading, saving, and querying KMS data
 */

import * as fs from "fs";
import * as path from "path";
import { getLogger } from "../utils/logging";
import { SafeFileContext, isAllowedKMSFile } from "../utils/paths";
import { KMSData, KMSStore, KMSDecision, KMSActionItem, KMSCommitment, KMSRisk } from "../types";

const logger = getLogger();
const KMS_STORE_PATH = ".processed_kms.json";
const fileContext = new SafeFileContext(process.cwd());

export class KMSStoreManager {
  private store: KMSStore;

  constructor() {
    this.store = this.loadStore();
  }

  /**
   * Load KMS store from disk
   * Uses safe path resolution to prevent path traversal attacks
   */
  private loadStore(): KMSStore {
    try {
      // Validate filename is allowed
      if (!isAllowedKMSFile(KMS_STORE_PATH)) {
        logger.warn(`Access to file denied: ${KMS_STORE_PATH}`);
        return this.createEmptyStore();
      }

      // Resolve path safely
      const safePath = fileContext.resolve(KMS_STORE_PATH);

      if (!fs.existsSync(safePath)) {
        return this.createEmptyStore();
      }

      const content = fs.readFileSync(safePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      logger.warn("Could not load KMS store, creating new one");
      return this.createEmptyStore();
    }
  }

  /**
   * Create empty KMS store
   */
  private createEmptyStore(): KMSStore {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      meetings: {},
    };
  }

  /**
   * Save KMS store to disk
   * Uses safe path resolution to prevent path traversal attacks
   */
  saveStore(): void {
    try {
      // Validate filename is allowed
      if (!isAllowedKMSFile(KMS_STORE_PATH)) {
        logger.warn(`Cannot write to file: ${KMS_STORE_PATH} not in whitelist`);
        return;
      }

      this.store.lastUpdated = new Date().toISOString();
      const safePath = fileContext.resolve(KMS_STORE_PATH);
      fs.writeFileSync(safePath, JSON.stringify(this.store, null, 2));
      logger.debug("KMS store saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to save KMS store: ${message}`);
    }
  }

  /**
   * Get the current KMS store (for relationship inference and analysis)
   */
  getStore(): KMSStore {
    return this.store;
  }

  /**
   * Record KMS data for a meeting
   */
  recordKMSData(kmsData: KMSData): void {
    this.store.meetings[kmsData.meeting] = kmsData;
    this.saveStore();
    logger.debug(`Recorded KMS data for meeting: ${kmsData.meeting}`);
  }

  /**
   * Get KMS data for a specific meeting
   */
  getKMSData(meeting: string): KMSData | null {
    return this.store.meetings[meeting] || null;
  }

  /**
   * Query all decisions across meetings
   */
  getAllDecisions(owner?: string): KMSDecision[] {
    const decisions: KMSDecision[] = [];
    Object.values(this.store.meetings).forEach((meeting) => {
      meeting.decisions.forEach((decision) => {
        if (!owner || decision.owner === owner) {
          decisions.push(decision);
        }
      });
    });
    return decisions;
  }

  /**
   * Query all action items across meetings
   */
  getAllActionItems(owner?: string, status?: string): KMSActionItem[] {
    const items: KMSActionItem[] = [];
    Object.values(this.store.meetings).forEach((meeting) => {
      meeting.actionItems.forEach((item) => {
        if ((!owner || item.owner === owner) && (!status || item.status === status)) {
          items.push(item);
        }
      });
    });
    return items;
  }

  /**
   * Query all commitments across meetings
   */
  getAllCommitments(owner?: string): KMSCommitment[] {
    const commitments: KMSCommitment[] = [];
    Object.values(this.store.meetings).forEach((meeting) => {
      meeting.commitments.forEach((commitment) => {
        if (!owner || commitment.owner === owner) {
          commitments.push(commitment);
        }
      });
    });
    return commitments;
  }

  /**
   * Query all risks across meetings
   */
  getAllRisks(severity?: string): KMSRisk[] {
    const risks: KMSRisk[] = [];
    Object.values(this.store.meetings).forEach((meeting) => {
      meeting.risks.forEach((risk) => {
        if (!severity || risk.severity === severity) {
          risks.push(risk);
        }
      });
    });
    return risks;
  }

  /**
   * Search KMS data by keyword
   */
  search(keyword: string, type?: "decision" | "action" | "commitment" | "risk"): any[] {
    const results: any[] = [];
    const lowerKeyword = keyword.toLowerCase();

    Object.entries(this.store.meetings).forEach(([, meeting]) => {
      if (!type || type === "decision") {
        meeting.decisions
          .filter((d) => d.text.toLowerCase().includes(lowerKeyword))
          .forEach((d) => results.push({ type: "decision", ...d }));
      }
      if (!type || type === "action") {
        meeting.actionItems
          .filter((a) => a.text.toLowerCase().includes(lowerKeyword))
          .forEach((a) => results.push({ type: "action", ...a }));
      }
      if (!type || type === "commitment") {
        meeting.commitments
          .filter((c) => c.text.toLowerCase().includes(lowerKeyword))
          .forEach((c) => results.push({ type: "commitment", ...c }));
      }
      if (!type || type === "risk") {
        meeting.risks
          .filter((r) => r.text.toLowerCase().includes(lowerKeyword))
          .forEach((r) => results.push({ type: "risk", ...r }));
      }
    });

    return results;
  }

  /**
   * Get action items due on or before a date
   */
  getActionItemsDueBefore(dueDate: string): KMSActionItem[] {
    return this.getAllActionItems().filter((item) => item.dueDate && item.dueDate <= dueDate);
  }

  /**
   * Get all high/medium severity risks
   */
  getHighPriorityRisks(): KMSRisk[] {
    return this.getAllRisks().filter((r) => r.severity === "high" || r.severity === "medium");
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const allDecisions = this.getAllDecisions();
    const allActions = this.getAllActionItems();
    const allCommitments = this.getAllCommitments();
    const allRisks = this.getAllRisks();
    const highRisks = this.getHighPriorityRisks();

    return {
      meetingsAnalyzed: Object.keys(this.store.meetings).length,
      totalDecisions: allDecisions.length,
      totalActionItems: allActions.length,
      actionItemsByStatus: {
        "not-started": allActions.filter((a) => a.status === "not-started").length,
        "in-progress": allActions.filter((a) => a.status === "in-progress").length,
        blocked: allActions.filter((a) => a.status === "blocked").length,
        completed: allActions.filter((a) => a.status === "completed").length,
      },
      totalCommitments: allCommitments.length,
      totalRisks: allRisks.length,
      highPriorityRisks: highRisks.length,
    };
  }
}
