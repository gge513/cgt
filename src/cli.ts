/**
 * CLI Command routing
 * Handles three main commands: analyze, convert, analyze-existing
 */

import * as dotenv from "dotenv";
import { getLogger } from "./utils/logging";
import { validateStartupRequirements } from "./utils/validation";
import { convertTranscripts } from "./conversion/converter";
import { analyzeConvertedFiles } from "./analysis/orchestrator";
import { ManifestManager } from "./conversion/manifest";
import { getModel } from "./utils/client";

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
      case "analyze": {
        logger.info("Starting unified pipeline (convert + analyze)");
        const inputDir = "input";
        const processingDir = "processing";
        const outputDir = "output";

        // Step 1: Convert transcripts
        logger.info("Step 1: Converting transcripts...");
        const conversionStats = await convertTranscripts(inputDir, processingDir);

        if (conversionStats.total_found === 0) {
          logger.warn("No transcript files found in input directory");
          process.exit(1);
        }

        logger.info(`Conversion complete: ${conversionStats.successful}/${conversionStats.total_found} successful`);

        // Step 2: Analyze converted files
        logger.info("Step 2: Analyzing converted files...");
        const manifestManager = new ManifestManager();
        let manifest = manifestManager.loadManifest();

        const analysisResult = await analyzeConvertedFiles(
          {
            processingDir,
            outputDir,
            model: getModel(),
          },
          manifest
        );

        manifest = analysisResult.manifest;
        manifestManager.saveManifest(manifest);

        logger.info(`Analysis complete: ${analysisResult.analyzed} analyzed, ${analysisResult.skipped} skipped`);

        if (analysisResult.reportFiles.length > 0) {
          console.log("\n✓ Analysis complete! Reports generated:");
          analysisResult.reportFiles.forEach(f => console.log(`  - ${f}`));
        }

        process.exit(analysisResult.exitCode);
        break;
      }

      case "convert": {
        logger.info("Starting conversion stage only");
        const inputDir = "input";
        const processingDir = "processing";

        const conversionStats = await convertTranscripts(inputDir, processingDir);

        if (conversionStats.total_found === 0) {
          logger.warn("No transcript files found in input directory");
          process.exit(1);
        }

        logger.info(`Conversion complete: ${conversionStats.successful}/${conversionStats.total_found} successful`);

        if (conversionStats.successful > 0) {
          console.log(`\n✓ Conversion complete! Files ready in ${processingDir}/`);
          console.log("Next: npm run analyze-existing  (to analyze converted files)");
        }

        process.exit(conversionStats.exitCode);
        break;
      }

      case "analyze-existing": {
        logger.info("Starting analysis on existing .md files");
        const processingDir = "processing";
        const outputDir = "output";

        const manifestManager = new ManifestManager();
        let manifest = manifestManager.loadManifest();

        const analysisResult = await analyzeConvertedFiles(
          {
            processingDir,
            outputDir,
            model: getModel(),
          },
          manifest
        );

        manifest = analysisResult.manifest;
        manifestManager.saveManifest(manifest);

        if (analysisResult.analyzed === 0 && analysisResult.skipped === 0) {
          logger.warn("No markdown files found in processing directory");
          process.exit(1);
        }

        logger.info(`Analysis complete: ${analysisResult.analyzed} analyzed, ${analysisResult.skipped} skipped`);

        if (analysisResult.reportFiles.length > 0) {
          console.log("\n✓ Analysis complete! Reports generated:");
          analysisResult.reportFiles.forEach(f => console.log(`  - ${f}`));
        }

        process.exit(analysisResult.exitCode);
        break;
      }

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
          const inputDir = "input";
          const processingDir = "processing";
          const outputDir = "output";

          // Step 1: Convert transcripts
          logger.info("Step 1: Converting transcripts...");
          const conversionStats = await convertTranscripts(inputDir, processingDir);

          if (conversionStats.total_found === 0) {
            logger.warn("No transcript files found in input directory");
            process.exit(1);
          }

          logger.info(`Conversion complete: ${conversionStats.successful}/${conversionStats.total_found} successful`);

          // Step 2: Analyze converted files
          logger.info("Step 2: Analyzing converted files...");
          const manifestManager = new ManifestManager();
          let manifest = manifestManager.loadManifest();

          const analysisResult = await analyzeConvertedFiles(
            {
              processingDir,
              outputDir,
              model: getModel(),
            },
            manifest
          );

          manifest = analysisResult.manifest;
          manifestManager.saveManifest(manifest);

          logger.info(`Analysis complete: ${analysisResult.analyzed} analyzed, ${analysisResult.skipped} skipped`);

          if (analysisResult.reportFiles.length > 0) {
            console.log("\n✓ Analysis complete! Reports generated:");
            analysisResult.reportFiles.forEach(f => console.log(`  - ${f}`));
          }

          process.exit(analysisResult.exitCode);
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
