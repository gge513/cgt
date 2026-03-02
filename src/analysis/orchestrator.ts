/**
 * Analysis Orchestrator
 * Coordinates reading converted .md files and running multi-agent analysis
 */

import * as fs from "fs";
import * as path from "path";
import { getLogger } from "../utils/logging";
import { parseFrontmatter, extractMarkdownContent } from "../utils/parsing";
import { synthesizeAnalysis } from "./synthesisCoordinator";
import { generateMarkdownReport } from "./reportGenerator";
import {
  TranscriptMetadata,
  Manifest,
  AnalysisCacheEntry,
} from "../types";

const logger = getLogger();

export interface AnalysisOptions {
  processingDir: string;
  outputDir: string;
  model: string;
  force?: boolean;
}

/**
 * Read markdown files from processing directory
 */
function readMarkdownFiles(processingDir: string): string[] {
  try {
    if (!fs.existsSync(processingDir)) {
      logger.warn(`Processing directory not found: ${processingDir}`);
      return [];
    }

    const files = fs.readdirSync(processingDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(processingDir, f));
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
 * Run analysis on converted markdown files
 */
export async function analyzeConvertedFiles(
  options: AnalysisOptions,
  manifest: Manifest
): Promise<{
  analyzed: number;
  failed: number;
  errors: string[];
  reportFiles: string[];
  manifest: Manifest;
}> {
  let markdownFiles: string[] = [];
  const stats = {
    analyzed: 0,
    failed: 0,
    errors: [] as string[],
    reportFiles: [] as string[],
    manifest,
  };

  try {
    logger.info("🔍 Starting analysis phase...\n");

    // Read markdown files
    markdownFiles = readMarkdownFiles(options.processingDir);

    if (markdownFiles.length === 0) {
      logger.warn("No markdown files found in processing directory");
      return stats;
    }

    logger.info(`Found ${markdownFiles.length} markdown file(s) to analyze`);

    // Build transcript metadata for all files
    const transcripts: TranscriptMetadata[] = [];
    for (const mdFile of markdownFiles) {
      const metadata = buildTranscriptMetadata(mdFile);
      if (metadata) {
        transcripts.push(metadata);
      } else {
        stats.failed++;
        stats.errors.push(`Failed to extract metadata from ${path.basename(mdFile)}`);
      }
    }

    if (transcripts.length === 0) {
      logger.error("No valid transcripts found");
      return stats;
    }

    // Run multi-agent analysis
    logger.info(`Analyzing ${transcripts.length} transcript(s)...\n`);
    const report = await synthesizeAnalysis(transcripts);

    // Generate markdown report
    const reportContent = generateMarkdownReport(report, options.model);

    // Write report (using first markdown file date for naming)
    const reportFilename = generateReportFilename(markdownFiles[0], options.model);
    const reportPath = path.join(options.outputDir, reportFilename);

    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, reportContent, "utf-8");
    logger.info(`✓ Report written: ${reportFilename}\n`);

    stats.reportFiles.push(reportPath);
    stats.analyzed = transcripts.length;

    // Update manifest with analysis cache
    for (const mdFile of markdownFiles) {
      const baseName = path.basename(mdFile, ".md");
      const processedFile = manifest.processed_files.find(
        (f: any) => f.output_file === `${baseName}.md`
      );

      if (processedFile) {
        const cacheEntry: AnalysisCacheEntry = {
          model: options.model,
          analyzed_at: new Date().toISOString(),
          report_file: reportFilename,
        };
        processedFile.analyses[options.model] = cacheEntry;
      }
    }

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Analysis failed: ${message}`);
    stats.errors.push(`Analysis error: ${message}`);
    stats.failed = markdownFiles?.length || 0;
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
