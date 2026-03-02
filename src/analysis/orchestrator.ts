/**
 * Analysis Orchestrator
 * Coordinates reading converted .md files and running multi-agent analysis
 */

import * as fs from "fs";
import * as path from "path";
import { getLogger } from "../utils/logging";
import { SafeFileContext } from "../utils/paths";
import { parseFrontmatter, extractMarkdownContent } from "../utils/parsing";
import { synthesizeAnalysis } from "./synthesisCoordinator";
import { generateMarkdownReport } from "./reportGenerator";
import { ManifestManager } from "../conversion/manifest";
import { extractKMSData, KMSStoreManager } from "../kms";
import { inferRelationshipsWithDSPy } from "../kms/relationshipInferencerDSPy";
import {
  TranscriptMetadata,
  Manifest,
  InferredRelationshipsStore,
} from "../types";

const logger = getLogger();

export interface AnalysisOptions {
  processingDir: string;
  outputDir: string;
  model: string;
  force?: boolean;
  forceAnalyze?: boolean;
}

/**
 * Read markdown files from processing directory
 * Uses safe path resolution to prevent directory traversal
 */
function readMarkdownFiles(processingDir: string): string[] {
  try {
    // Validate the directory exists
    if (!fs.existsSync(processingDir)) {
      logger.warn(`Processing directory not found: ${processingDir}`);
      return [];
    }

    // Create a safe context for the processing directory
    const processingContext = new SafeFileContext(path.resolve(processingDir));

    const files = fs.readdirSync(processingDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        try {
          // Validate each file path is within the processing directory
          return processingContext.resolve(f);
        } catch (error) {
          logger.warn(`Skipping file due to path validation: ${f}`);
          return null;
        }
      })
      .filter((f): f is string => f !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error reading markdown files: ${message}`);
    return [];
  }
}

/**
 * Extract transcript metadata from markdown file with frontmatter
 */
function extractMetadataFromMarkdown(
  filePath: string
): TranscriptMetadata | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter) {
      logger.debug(`No frontmatter found in ${path.basename(filePath)}`);
      return {
        date: "Unknown",
        concepts: [],
        source: path.basename(filePath),
      };
    }

    const concepts = frontmatter.concepts
      ? Array.isArray(frontmatter.concepts)
        ? frontmatter.concepts
        : [frontmatter.concepts]
      : [];

    return {
      date: frontmatter.date || "Unknown",
      concepts: concepts,
      source: path.basename(filePath),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not extract metadata from ${path.basename(filePath)}: ${message}`);
    return null;
  }
}

/**
 * Build TranscriptMetadata for analysis including full content
 */
function buildTranscriptMetadata(filePath: string): TranscriptMetadata | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const markdownContent = extractMarkdownContent(content);
    const baseMetadata = extractMetadataFromMarkdown(filePath);

    if (!baseMetadata) {
      return null;
    }

    return {
      ...baseMetadata,
      filename: path.basename(filePath),
      content: markdownContent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error building transcript metadata for ${path.basename(filePath)}: ${message}`);
    return null;
  }
}

/**
 * Generate report filename based on date and model
 */
function generateReportFilename(
  markdownFile: string,
  model: string
): string {
  const baseName = path.basename(markdownFile, ".md");
  const modelSuffix = model
    .replace("claude-", "")
    .replace("-", "_")
    .split("_")[0]; // e.g., "haiku" from "claude-haiku-4-5"
  return `${baseName}_report_${modelSuffix}.md`;
}

/**
 * Run analysis on converted markdown files with caching support
 */
export async function analyzeConvertedFiles(
  options: AnalysisOptions,
  manifest: Manifest
): Promise<{
  analyzed: number;
  failed: number;
  skipped: number;
  errors: string[];
  reportFiles: string[];
  manifest: Manifest;
  exitCode: 0 | 1 | 2;
}> {
  let markdownFiles: string[] = [];
  const force = options.force || options.forceAnalyze || false;
  const manifestManager = new ManifestManager();

  const stats = {
    analyzed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
    reportFiles: [] as string[],
    manifest,
    exitCode: 0 as 0 | 1 | 2,
  };

  try {
    logger.info("🔍 Starting analysis phase...\n");

    // Handle force-analyze flag by clearing analysis cache
    if (force) {
      manifestManager.clearAnalysisCache(manifest);
      logger.info("Force flag set: clearing analysis cache");
    }

    // Read markdown files
    markdownFiles = readMarkdownFiles(options.processingDir);

    if (markdownFiles.length === 0) {
      logger.warn("No markdown files found in processing directory");
      return stats;
    }

    logger.info(`Found ${markdownFiles.length} markdown file(s) to analyze`);

    // Check which files need analysis (respecting cache and force flag)
    const filesToAnalyze: string[] = [];
    for (const mdFile of markdownFiles) {
      const outputFileName = path.basename(mdFile, ".md") + ".md";
      if (manifestManager.isAnalysisNeeded(outputFileName, options.model, manifest, force)) {
        filesToAnalyze.push(mdFile);
      } else {
        stats.skipped++;
        logger.info(`✓ Skipped (cached): ${path.basename(mdFile)}`);
      }
    }

    if (filesToAnalyze.length === 0) {
      logger.info("All files have cached analyses");
      stats.exitCode = 0;
      return stats;
    }

    // Build transcript metadata for files that need analysis
    const transcripts: TranscriptMetadata[] = [];
    for (const mdFile of filesToAnalyze) {
      const metadata = buildTranscriptMetadata(mdFile);
      if (metadata) {
        transcripts.push(metadata);
      } else {
        stats.failed++;
        stats.errors.push(`Failed to extract metadata from ${path.basename(mdFile)}`);
      }
    }

    if (transcripts.length === 0) {
      logger.error("No valid transcripts to analyze");
      return stats;
    }

    // Run multi-agent analysis
    logger.info(`\nAnalyzing ${transcripts.length} transcript(s) with ${options.model}...\n`);
    const report = await synthesizeAnalysis(transcripts);

    // Generate markdown report
    const reportContent = generateMarkdownReport(report, options.model);

    // Write report (using first markdown file date for naming)
    const reportFilename = generateReportFilename(filesToAnalyze[0], options.model);

    try {
      // Create a safe context for the output directory
      const outputContext = new SafeFileContext(path.resolve(options.outputDir));

      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }

      // Validate the report filename path
      const reportPath = outputContext.resolve(reportFilename);
      fs.writeFileSync(reportPath, reportContent, "utf-8");
      logger.info(`✓ Report written: ${reportFilename}\n`);

      stats.reportFiles.push(reportPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to write report: ${message}`);
      stats.failed++;
      stats.errors.push(`Report writing failed: ${message}`);
    }
    stats.analyzed = transcripts.length;

    // Extract KMS data from report
    try {
      logger.debug("Extracting KMS data from analysis report...");
      const kmsStoreManager = new KMSStoreManager();
      const meetingDate = (transcripts[0] as any)?.metadata?.date || "Unknown";
      const meetingName = path.basename(filesToAnalyze[0], ".md");

      const kmsData = await extractKMSData(reportContent, meetingName, meetingDate);
      kmsStoreManager.recordKMSData(kmsData);

      logger.debug(
        `Extracted KMS data: ${kmsData.decisions.length} decisions, ` +
        `${kmsData.actionItems.length} actions, ` +
        `${kmsData.commitments.length} commitments, ` +
        `${kmsData.risks.length} risks`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`KMS extraction failed (non-fatal): ${message}`);
    }

    // Run relationship inference on KMS data
    try {
      logger.debug("Running relationship inference on KMS data...");
      const kmsStoreManager = new KMSStoreManager();
      const kmsStore = kmsStoreManager.getStore();

      if (kmsStore && Object.keys(kmsStore.meetings).length > 0) {
        const inferencedRelationships = await inferRelationshipsWithDSPy(kmsStore);

        if (inferencedRelationships.length > 0) {
          // Write inferred relationships to file
          const inferredStore: InferredRelationshipsStore = {
            version: 1,
            inferredAt: new Date().toISOString(),
            totalRelationships: inferencedRelationships.length,
            relationships: inferencedRelationships,
          };

          try {
            const cwd = path.resolve(process.cwd());
            const cwdContext = new SafeFileContext(cwd);
            const inferredPath = cwdContext.resolve(".processed_kms_inferred.json");
            fs.writeFileSync(inferredPath, JSON.stringify(inferredStore, null, 2), "utf-8");

            logger.info(`✓ Inferred ${inferencedRelationships.length} relationships`);
            logger.debug(`Inferred relationships saved to .processed_kms_inferred.json`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`Failed to save inferred relationships: ${message}`);
          }
        } else {
          logger.debug("No relationships inferred from KMS data");
        }
      } else {
        logger.debug("No KMS data available for relationship inference");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Relationship inference failed (non-fatal): ${message}`);
    }

    // Update manifest with analysis cache for processed files
    for (const mdFile of filesToAnalyze) {
      const outputFileName = path.basename(mdFile, ".md") + ".md";
      manifestManager.recordAnalysis(manifest, outputFileName, options.model, reportFilename);
    }

    // Save manifest with updated analysis cache
    manifestManager.saveManifest(manifest);

    // Set exit code based on results
    if (stats.analyzed > 0 && stats.failed === 0) {
      stats.exitCode = 0; // All successful
    } else if (stats.analyzed > 0) {
      stats.exitCode = 1; // Partial success
    } else {
      stats.exitCode = 2; // All failed
    }

    if (stats.errors.length > 0) {
      logger.warn(`Errors encountered during analysis:`);
      stats.errors.forEach((err) => logger.warn(`  - ${err}`));
    }

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Analysis failed: ${message}`);
    stats.errors.push(`Analysis error: ${message}`);
    stats.failed = markdownFiles?.length || 0;
    stats.exitCode = 2;
    return stats;
  }
}

/**
 * Check if file needs analysis (cache hit/miss logic)
 */
export function isAnalysisNeeded(
  processedFile: { analyses: Record<string, any> },
  model: string,
  force: boolean
): boolean {
  if (force) {
    return true;
  }

  // If no analysis cache entry for this model, needs analysis
  return !processedFile.analyses || !processedFile.analyses[model];
}
