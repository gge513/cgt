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
  exitCode: 0 | 1 | 2; // 0: success, 1: partial, 2: failure
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
 * Convert a single transcript file with detailed error handling
 */
async function convertSingleFile(
  inputFile: string,
  processingDir: string,
  manifestManager: ManifestManager,
  manifest: Manifest
): Promise<{ success: boolean; error?: string }> {
  const fileName = path.basename(inputFile);

  try {
    logger.info(`Processing ${fileName}...`);

    // Stage 1: Read file with proper encoding error handling
    let content: string;
    try {
      content = fs.readFileSync(inputFile, "utf-8");
      logger.debug(`Read ${content.length} characters from ${fileName}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("ENOENT")) {
        logger.error(`File not found: ${fileName}`);
        return { success: false, error: "File not found" };
      } else if (msg.includes("EACCES")) {
        logger.error(`Permission denied reading: ${fileName}`);
        return { success: false, error: "Permission denied" };
      }
      throw error;
    }

    if (content.length === 0) {
      logger.warn(`File is empty: ${fileName}`);
      return { success: false, error: "File is empty" };
    }

    // Stage 2: Extract metadata (with fallback for API failures)
    logger.debug(`Extracting metadata from ${fileName}...`);
    const metadata = await extractMetadata(content);

    // Stage 3: Create markdown content
    const markdownContent = createMarkdownContent(content, metadata);

    // Stage 4: Generate output filename
    const outputFileName = generateOutputFilename(fileName, metadata.date);

    // Stage 5: Create output directory and write file
    try {
      const relativeFolderPath = getRelativeFolderPath(inputFile, path.dirname(inputFile).replace(/\/[^/]*$/, ""));
      let outputFile = path.join(processingDir, outputFileName);

      if (relativeFolderPath) {
        const folderDir = path.join(processingDir, relativeFolderPath);
        const dirCheck = ensureDirectoryExists(folderDir);
        if (!dirCheck.valid) {
          logger.error(`Could not create directory: ${dirCheck.error}`);
          return { success: false, error: `Directory creation failed: ${dirCheck.error}` };
        }
        outputFile = path.join(folderDir, outputFileName);
      }

      fs.writeFileSync(outputFile, markdownContent, "utf-8");
      logger.info(`✓ Converted: ${fileName} → ${outputFileName}`);
      if (metadata.concepts.length > 0) {
        logger.debug(`  Concepts: ${metadata.concepts.join(", ")}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("EACCES")) {
        logger.error(`Permission denied writing to output directory: ${msg}`);
        return { success: false, error: "Permission denied writing to output" };
      }
      throw error;
    }

    // Stage 6: Compute file hash and record in manifest
    const fileHash = manifestManager.computeFileHash(inputFile);
    if (!fileHash) {
      logger.warn(`Could not compute hash for ${fileName}, skipping manifest update`);
      return { success: false, error: "Could not compute file hash" };
    }

    manifestManager.recordConversion(manifest, fileName, outputFileName, fileHash);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error converting ${fileName}: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Main conversion orchestration with force flag support
 */
export async function convertTranscripts(
  inputDir: string,
  processingDir: string,
  options?: { force?: boolean; forceConvert?: boolean }
): Promise<ConversionStats> {
  const force = options?.force || options?.forceConvert || false;
  const stats: ConversionStats = {
    total_found: 0,
    already_processed: 0,
    new_files: 0,
    successful: 0,
    failed: 0,
    errors: [],
    exitCode: 0,
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
    let manifest = manifestManager.loadManifest();

    // Handle force-all flag
    if (force) {
      manifest = manifestManager.clearManifest();
      logger.info("Force flag set: clearing all cache");
    }

    // Discover all .txt files
    const allFiles = discoverTranscripts(inputDir);
    stats.total_found = allFiles.length;

    if (allFiles.length === 0) {
      logger.info("No .txt files found in input directory");
      return stats;
    }

    // Filter out already-processed files (respecting force flag)
    const filesToProcess: string[] = [];
    for (const file of allFiles) {
      if (manifestManager.isConversionNeeded(file, manifest, force)) {
        filesToProcess.push(file);
      } else {
        stats.already_processed++;
      }
    }

    stats.new_files = filesToProcess.length;

    logger.info(`Found ${stats.total_found} file(s)`);
    logger.info(`  Already processed: ${stats.already_processed}`);
    logger.info(`  Files to process: ${stats.new_files}`);

    if (filesToProcess.length === 0) {
      logger.info("No files need processing");
      return stats;
    }

    // Process each file that needs conversion
    for (const file of filesToProcess) {
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

    // Set exit code based on results
    if (stats.successful === stats.new_files || stats.new_files === 0) {
      stats.exitCode = 0; // All successful or nothing to process
    } else if (stats.successful > 0) {
      stats.exitCode = 1; // Partial success
    } else {
      stats.exitCode = 2; // All failed
    }

    if (stats.errors.length > 0) {
      logger.warn(`Errors encountered during conversion:`);
      stats.errors.forEach((err) => logger.warn(`  - ${err}`));
    }

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Unexpected error during conversion: ${message}`);
    stats.errors.push(`Unexpected error: ${message}`);
    stats.exitCode = 2;
    return stats;
  }
}
