/**
 * CLI Command routing
 * Handles three main commands: analyze, convert, analyze-existing
 */

import * as dotenv from "dotenv";
import { getLogger } from "./utils/logging";
import { validateStartupRequirements } from "./utils/validation";

// Load environment variables from .env
dotenv.config();

const logger = getLogger();

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
Transcript Analyzer Unified - Multi-Agent Analysis System

USAGE:
  npm run analyze          # Full pipeline: .txt → .md → report
  npm run convert          # Conversion only: .txt → .md
  npm run analyze-existing # Analysis only: .md → report

ENVIRONMENT VARIABLES:
  ANTHROPIC_API_KEY       (required) API key from console.anthropic.com
  MODEL_ID               (optional) Claude model to use (default: claude-haiku-4-5-20251001)
  MAX_FILE_SIZE          (optional) Max per-file size in bytes (default: 10MB)
  MAX_TOTAL_SIZE         (optional) Max total input size in bytes (default: 100MB)
  LOG_LEVEL              (optional) Logging level: debug, info, warn, error (default: info)

EXAMPLES:
  # Basic analysis with default settings
  npm run analyze

  # Use more powerful (expensive) model for important material
  MODEL_ID=claude-opus-4-6 npm run analyze

  # Convert transcripts and inspect before analysis
  npm run convert
  # [inspect output files]
  npm run analyze-existing

  # Re-process everything from scratch
  npm run analyze -- --force

DIRECTORY STRUCTURE:
  input/          Place your .txt transcript files here
  processing/     Converted .md files (intermediate staging)
  output/         Final analysis reports
`);
}

/**
 * Display version information
 */
function showVersion(): void {
  const packageJson = require("../package.json");
  console.log(`${packageJson.name} v${packageJson.version}`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  // Validate startup requirements
  const startupValidation = validateStartupRequirements();
  if (!startupValidation.valid) {
    logger.error(startupValidation.error!);
    process.exit(2);
  }

  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "analyze":
        logger.info("Starting unified pipeline (convert + analyze)");
        // TODO: Implement full pipeline orchestration
        console.log("✓ Phase 1: Foundation complete!");
        console.log("Next: Implement conversion core (Phase 2)");
        break;

      case "convert":
        logger.info("Starting conversion stage only");
        // TODO: Implement conversion orchestration
        console.log("✓ Phase 1: Foundation complete!");
        console.log("Next: Implement conversion core (Phase 2)");
        break;

      case "analyze-existing":
        logger.info("Starting analysis on existing .md files");
        // TODO: Implement analysis orchestration
        console.log("✓ Phase 1: Foundation complete!");
        console.log("Next: Implement conversion core (Phase 2)");
        break;

      case "--help":
      case "-h":
        showHelp();
        process.exit(0);

      case "--version":
      case "-v":
        showVersion();
        process.exit(0);

      default:
        if (command) {
          console.error(`Unknown command: ${command}`);
          showHelp();
          process.exit(1);
        } else {
          // Default to analyze if no command specified
          logger.info("Starting unified pipeline (convert + analyze) - default");
          console.log("✓ Phase 1: Foundation complete!");
          console.log("Next: Implement conversion core (Phase 2)");
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error: ${message}`);
    process.exit(2);
  }
}

// Run CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(2);
});
