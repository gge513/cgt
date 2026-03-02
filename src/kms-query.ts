/**
 * KMS Query CLI Entry Point
 * Provides command-line interface for querying knowledge management data
 */

import { KMSQuery, parseQueryArgs } from "./kms/query";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  showHelp();
  process.exit(0);
}

try {
  const queryOptions = parseQueryArgs(args);
  const query = new KMSQuery();
  const result = query.execute(queryOptions);
  console.log(result);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}

function showHelp(): void {
  console.log(`
KMS Query Tool - Search Knowledge Management System Data

USAGE:
  npm run kms [OPTIONS] [QUERY]

EXAMPLES:
  # Show summary of all KMS data
  npm run kms --summary

  # Find all decisions
  npm run kms --type decision

  # Find all action items assigned to Alice
  npm run kms --type action --owner Alice

  # Find all high-priority risks
  npm run kms --type risk --severity high

  # Find all action items due before a date
  npm run kms --type action --due 2026-03-15

  # Search by keyword
  npm run kms --keyword "scalability"
  npm run kms -k "API infrastructure"

  # Find all blocked action items
  npm run kms --type action --status blocked

OPTIONS:
  -s, --summary              Show KMS summary statistics
  -t, --type TYPE            Filter by type: decision|action|commitment|risk
  -o, --owner NAME           Filter by person name
  --status STATUS            Filter by status (for actions/decisions)
  --due DATE                 Show actions due before YYYY-MM-DD
  --severity LEVEL           Filter risks by level: low|medium|high
  -k, --keyword QUERY        Search by keyword
  -h, --help                 Show this help message

QUERY TYPES:
  • decisions        - Strategic decisions made
  • actionItems      - Concrete action items with owners
  • commitments      - Commitments made by people
  • risks            - Identified risks and issues

STATUSES:
  • For decisions:    pending, in-progress, completed
  • For actions:      not-started, in-progress, blocked, completed
  • For commitments:  pending, in-progress, completed
  • For risks:        low, medium, high (severity)
`);
}
