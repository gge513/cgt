/**
 * Main conversion orchestration
 * Discovers .txt files, converts to .md with metadata, and updates manifest
 */

import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import { Manifest } from "../types";
import { ManifestManager } from "./manifest";
import { extractMetadata, createMarkdownContent, generateOutputFilename } from "./metadata";
import { getLogger } from "../utils/logging";
import { ensureDirectoryExists } from "../utils/validation";

const logger = getLogger();

export interface ConversionStats {
  total_found: number;
  already_processed: number;
  new_files: number;
  successful: number;
  failed: number;
  errors: string[];
}

/**
 * Find all .txt files recursively in input directory
 */
function discoverTranscripts(inputDir: string): string[] {
  try {
    // Use glob to find all .txt files recursively
    const pattern = path.join(inputDir, "**", "*.txt");
    const files = globSync(pattern);
    logger.debug(`Discovered ${files.length} .txt files`);
    return files;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error discovering transcripts: ${message}`);
    return [];
  }
}

/**
 * Get relative folder path for preserving directory structure
 */
function getRelativeFolderPath(filePath: string, inputDir: string): string {
  const dir = path.dirname(filePath);
  const relative = path.relative(inputDir, dir);
  return relative === "." ? "" : relative;
}

/**
 * Convert a single transcript file
 */
async function convertSingleFile(
  inputFile: string,
  processingDir: string,
  manifestManager: ManifestManager,
  manifest: Manifest
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info(`Processing ${path.basename(inputFile)}...`);

    // Read file content
    const content = fs.readFileSync(inputFile, "utf-8");

    // Extract metadata (API call)
    const metadata = await extractMetadata(content);

    // Create markdown content
    const markdownContent = createMarkdownContent(content, metadata);

    // Generate output filename with date prefix
    const outputFileName = generateOutputFilename(path.basename(inputFile), metadata.date);

    // Create output file path (preserve folder structure)
    const relativeFolderPath = getRelativeFolderPath(inputFile, path.dirname(inputFile).replace(/\/[^/]*$/, ""));
    let outputFile = path.join(processingDir, outputFileName);

    if (relativeFolderPath) {
      const folderDir = path.join(processingDir, relativeFolderPath);
      ensureDirectoryExists(folderDir);
      outputFile = path.join(folderDir, outputFileName);
    }

    // Write markdown file
    fs.writeFileSync(outputFile, markdownContent, "utf-8");
    logger.info(`✓ Converted: ${path.basename(inputFile)} → ${outputFileName}`);
    if (metadata.concepts.length > 0) {
      logger.debug(`  Concepts: ${metadata.concepts.join(", ")}`);
    }

    // Compute file hash for manifest
    const fileHash = manifestManager.computeFileHash(inputFile);
    if (!fileHash) {
      logger.warn(`Could not compute hash for ${path.basename(inputFile)}, skipping manifest update`);
      return { success: false, error: "Could not compute file hash" };
    }

    // Record in manifest
    manifestManager.recordConversion(
      manifest,
      path.basename(inputFile),
      outputFileName,
      fileHash
    );

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error converting ${path.basename(inputFile)}: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Main conversion orchestration
 */
export async function convertTranscripts(
  inputDir: string,
  processingDir: string
): Promise<ConversionStats> {
  const stats: ConversionStats = {
    total_found: 0,
    already_processed: 0,
    new_files: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Validate directories exist
    const inputDirCheck = ensureDirectoryExists(inputDir);
    if (!inputDirCheck.valid) {
      logger.error(inputDirCheck.error!);
      stats.errors.push(inputDirCheck.error!);
      return stats;
    }

    const processingDirCheck = ensureDirectoryExists(processingDir);
    if (!processingDirCheck.valid) {
      logger.error(processingDirCheck.error!);
      stats.errors.push(processingDirCheck.error!);
      return stats;
    }

    // Initialize manifest manager and load existing manifest
    const manifestManager = new ManifestManager();
    const manifest = manifestManager.loadManifest();

    // Discover all .txt files
    const allFiles = discoverTranscripts(inputDir);
    stats.total_found = allFiles.length;

    if (allFiles.length === 0) {
      logger.info("No .txt files found in input directory");
      return stats;
    }

    // Filter out already-processed files
    const newFiles: string[] = [];
    for (const file of allFiles) {
      if (manifestManager.isFileProcessed(file, manifest)) {
        stats.already_processed++;
      } else {
        newFiles.push(file);
      }
    }

    stats.new_files = newFiles.length;

    logger.info(`Found ${stats.total_found} file(s)`);
    logger.info(`  Already processed: ${stats.already_processed}`);
    logger.info(`  New files: ${stats.new_files}`);

    if (newFiles.length === 0) {
      logger.info("No new files to process");
      return stats;
    }

    // Process each new file
    for (const file of newFiles) {
      const result = await convertSingleFile(file, processingDir, manifestManager, manifest);

      if (result.success) {
        stats.successful++;
      } else {
        stats.failed++;
        if (result.error) {
          stats.errors.push(`${path.basename(file)}: ${result.error}`);
        }
      }
    }

    // Save updated manifest
    manifestManager.saveManifest(manifest);

    logger.info(`Conversion complete: ${stats.successful}/${stats.new_files} files processed`);
    logger.info(`Total in manifest: ${manifest.processed_files.length} files`);

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Unexpected error during conversion: ${message}`);
    stats.errors.push(`Unexpected error: ${message}`);
    return stats;
  }
}
