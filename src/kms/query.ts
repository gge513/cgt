/**
 * KMS Query CLI Tool
 * Provides command-line interface for querying KMS data
 */

import { KMSStoreManager } from "./store";

export interface QueryOptions {
  type?: "decision" | "action" | "commitment" | "risk";
  owner?: string;
  status?: string;
  keyword?: string;
  dueDate?: string;
  severity?: string;
  summary?: boolean;
}

export class KMSQuery {
  private store: KMSStoreManager;

  constructor() {
    this.store = new KMSStoreManager();
  }

  /**
   * Execute a query based on options
   */
  execute(options: QueryOptions): string {
    try {
      // Show summary
      if (options.summary) {
        return this.formatSummary(this.store.getSummary());
      }

      // Search by keyword
      if (options.keyword) {
        const results = this.store.search(options.keyword, options.type);
        return this.formatSearchResults(results);
      }

      // Get action items by status
      if (options.type === "action") {
        const items = this.store.getAllActionItems(options.owner, options.status);
        return this.formatActionItems(items);
      }

      // Get action items due before date
      if (options.dueDate) {
        const items = this.store.getActionItemsDueBefore(options.dueDate);
        return this.formatActionItems(items, `Due before ${options.dueDate}`);
      }

      // Get decisions
      if (options.type === "decision" || !options.type) {
        const decisions = this.store.getAllDecisions(options.owner);
        if (!options.type && !options.owner) {
          return this.formatSummary(this.store.getSummary());
        }
        return this.formatDecisions(decisions);
      }

      // Get commitments
      if (options.type === "commitment") {
        const commitments = this.store.getAllCommitments(options.owner);
        return this.formatCommitments(commitments);
      }

      // Get risks
      if (options.type === "risk") {
        let risks = this.store.getAllRisks(options.severity);
        if (!options.severity) {
          risks = this.store.getHighPriorityRisks();
        }
        return this.formatRisks(risks);
      }

      return "No query criteria specified";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error executing query: ${message}`;
    }
  }

  /**
   * Format summary output
   */
  private formatSummary(summary: any): string {
    const lines: string[] = [
      "\n📊 KMS SUMMARY",
      "═".repeat(50),
      `Meetings Analyzed: ${summary.meetingsAnalyzed}`,
      `\nDecisions: ${summary.totalDecisions}`,
      `\nAction Items: ${summary.totalActionItems}`,
      `  • Not Started: ${summary.actionItemsByStatus["not-started"]}`,
      `  • In Progress: ${summary.actionItemsByStatus["in-progress"]}`,
      `  • Blocked: ${summary.actionItemsByStatus.blocked}`,
      `  • Completed: ${summary.actionItemsByStatus.completed}`,
      `\nCommitments: ${summary.totalCommitments}`,
      `\nRisks: ${summary.totalRisks}`,
      `  • High Priority: ${summary.highPriorityRisks}`,
      "═".repeat(50),
    ];
    return lines.join("\n");
  }

  /**
   * Format decisions for output
   */
  private formatDecisions(decisions: any[]): string {
    if (decisions.length === 0) {
      return "No decisions found.";
    }

    const lines: string[] = [
      `\n📋 DECISIONS (${decisions.length})`,
      "═".repeat(50),
    ];

    decisions.forEach((decision, idx) => {
      lines.push(`\n${idx + 1}. ${decision.text}`);
      lines.push(`   ID: ${decision.id}`);
      if (decision.owner) lines.push(`   Owner: ${decision.owner}`);
      lines.push(`   Status: ${decision.status}`);
      lines.push(`   Meeting: ${decision.meeting}`);
    });

    lines.push("\n" + "═".repeat(50));
    return lines.join("\n");
  }

  /**
   * Format action items for output
   */
  private formatActionItems(items: any[], title?: string): string {
    if (items.length === 0) {
      return "No action items found.";
    }

    const lines: string[] = [
      `\n✓ ACTION ITEMS ${title ? `(${title})` : `(${items.length})`}`,
      "═".repeat(50),
    ];

    items.forEach((item, idx) => {
      lines.push(`\n${idx + 1}. ${item.text}`);
      lines.push(`   ID: ${item.id}`);
      if (item.owner) lines.push(`   Owner: ${item.owner}`);
      if (item.dueDate) lines.push(`   Due: ${item.dueDate}`);
      lines.push(`   Status: ${item.status}`);
      if (item.blockers?.length > 0) {
        lines.push(`   Blockers: ${item.blockers.join(", ")}`);
      }
      lines.push(`   Meeting: ${item.meeting}`);
    });

    lines.push("\n" + "═".repeat(50));
    return lines.join("\n");
  }

  /**
   * Format commitments for output
   */
  private formatCommitments(commitments: any[]): string {
    if (commitments.length === 0) {
      return "No commitments found.";
    }

    const lines: string[] = [
      `\n🤝 COMMITMENTS (${commitments.length})`,
      "═".repeat(50),
    ];

    commitments.forEach((commitment, idx) => {
      lines.push(`\n${idx + 1}. ${commitment.text}`);
      lines.push(`   ID: ${commitment.id}`);
      if (commitment.owner) lines.push(`   Owner: ${commitment.owner}`);
      if (commitment.dueDate) lines.push(`   Due: ${commitment.dueDate}`);
      lines.push(`   Status: ${commitment.status}`);
      lines.push(`   Meeting: ${commitment.meeting}`);
    });

    lines.push("\n" + "═".repeat(50));
    return lines.join("\n");
  }

  /**
   * Format risks for output
   */
  private formatRisks(risks: any[]): string {
    if (risks.length === 0) {
      return "No risks found.";
    }

    const lines: string[] = [
      `\n⚠️  RISKS (${risks.length})`,
      "═".repeat(50),
    ];

    risks.forEach((risk, idx) => {
      lines.push(`\n${idx + 1}. ${risk.text}`);
      lines.push(`   ID: ${risk.id}`);
      lines.push(`   Severity: ${risk.severity.toUpperCase()}`);
      if (risk.mitigation) lines.push(`   Mitigation: ${risk.mitigation}`);
      lines.push(`   Meeting: ${risk.meeting}`);
    });

    lines.push("\n" + "═".repeat(50));
    return lines.join("\n");
  }

  /**
   * Format search results
   */
  private formatSearchResults(results: any[]): string {
    if (results.length === 0) {
      return "No results found.";
    }

    const lines: string[] = [
      `\n🔍 SEARCH RESULTS (${results.length})`,
      "═".repeat(50),
    ];

    const grouped = results.reduce(
      (acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
        return acc;
      },
      {} as Record<string, any[]>
    );

    Object.entries(grouped).forEach(([type, items]) => {
      const itemList = items as any[];
      lines.push(`\n${type.toUpperCase()} (${itemList.length}):`);
      itemList.forEach((item: any) => {
        lines.push(`  • ${item.text}`);
        lines.push(`    Meeting: ${item.meeting}`);
      });
    });

    lines.push("\n" + "═".repeat(50));
    return lines.join("\n");
  }
}

/**
 * Helper function to parse CLI arguments
 */
export function parseQueryArgs(args: string[]): QueryOptions {
  const options: QueryOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--summary" || arg === "-s") {
      options.summary = true;
    } else if (arg === "--type" || arg === "-t") {
      options.type = args[++i] as any;
    } else if (arg === "--owner" || arg === "-o") {
      options.owner = args[++i];
    } else if (arg === "--status") {
      options.status = args[++i];
    } else if (arg === "--due") {
      options.dueDate = args[++i];
    } else if (arg === "--severity") {
      options.severity = args[++i];
    } else if (arg === "--keyword" || arg === "-k") {
      options.keyword = args.slice(i + 1).join(" ");
      break;
    } else if (!arg.startsWith("--")) {
      // Treat as keyword search
      options.keyword = args.slice(i).join(" ");
      break;
    }
  }

  return options;
}
