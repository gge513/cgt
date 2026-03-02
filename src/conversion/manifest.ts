/**
 * Manifest Management for tracking file processing state
 * Handles loading, saving, and updating processing manifest with atomic operations
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Manifest } from "../types";
import { getLogger } from "../utils/logging";

const logger = getLogger();
const MANIFEST_FILE = ".processed_manifest.json";
const MANIFEST_TEMP_FILE = ".processed_manifest.json.tmp";

export class ManifestManager {
  private manifestPath: string;
  private tempPath: string;

  constructor(workingDir: string = process.cwd()) {
    this.manifestPath = path.join(workingDir, MANIFEST_FILE);
    this.tempPath = path.join(workingDir, MANIFEST_TEMP_FILE);
  }

  /**
   * Compute MD5 hash of file content to detect modifications
   */
  computeFileHash(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash("md5").update(content).digest("hex");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Could not hash file ${filePath}: ${message}`);
      return null;
    }
  }

  /**
   * Load processing manifest from disk
   * Returns empty manifest if file doesn't exist or is corrupted
   */
  loadManifest(): Manifest {
    try {
      if (!fs.existsSync(this.manifestPath)) {
        logger.debug("Manifest not found, creating new one");
        return {
          version: 1,
          last_run: new Date().toISOString(),
          processed_files: [],
        };
      }

      const content = fs.readFileSync(this.manifestPath, "utf-8");
      const manifest = JSON.parse(content) as Manifest;
      logger.debug(`Loaded manifest with ${manifest.processed_files.length} entries`);
      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.warn(`Manifest corrupted (JSON parse error), regenerating...`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Could not load manifest: ${message}, regenerating...`);
      }

      return {
        version: 1,
        last_run: new Date().toISOString(),
        processed_files: [],
      };
    }
  }

  /**
   * Save manifest to disk atomically with retry logic
   * Writes to temp file first, then renames to prevent corruption
   * Retries up to 3 times on failure
   */
  saveManifest(manifest: Manifest, retryCount: number = 0): void {
    const MAX_RETRIES = 3;

    try {
      // Update last_run timestamp
      manifest.last_run = new Date().toISOString();

      // Write to temporary file first
      fs.writeFileSync(this.tempPath, JSON.stringify(manifest, null, 2), "utf-8");

      // Atomic rename (safe on most filesystems)
      fs.renameSync(this.tempPath, this.manifestPath);
      logger.debug(`Manifest saved with ${manifest.processed_files.length} entries`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (retryCount < MAX_RETRIES) {
        logger.warn(
          `Failed to save manifest (attempt ${retryCount + 1}/${MAX_RETRIES}): ${message}. Retrying...`
        );
        // Small delay before retry
        setTimeout(() => {
          this.saveManifest(manifest, retryCount + 1);
        }, 100 * (retryCount + 1));
      } else {
        logger.error(
          `Could not save manifest after ${MAX_RETRIES} retries: ${message}`
        );
        // Clean up temp file if it exists
        this.cleanupTempFile();
      }
    }
  }

  /**
   * Check if a file has already been processed (converted)
   * Returns true only if file exists in manifest AND hash matches (not modified)
   * Respects force flag
   */
  isConversionNeeded(
    filePath: string,
    manifest: Manifest,
    force: boolean = false
  ): boolean {
    if (force) {
      logger.debug(`Force flag set, will reprocess: ${path.basename(filePath)}`);
      return true;
    }

    const fileName = path.basename(filePath);

    for (const entry of manifest.processed_files) {
      if (entry.input_file === fileName) {
        // File was processed before, check if it was modified
        const currentHash = this.computeFileHash(filePath);
        if (currentHash && currentHash === entry.conversions.file_hash) {
          // File unchanged, skip conversion
          logger.debug(`Conversion cache hit: ${fileName}`);
          return false;
        } else {
          // File was modified, needs re-processing
          logger.debug(`File modified, will reconvert: ${fileName}`);
          return true;
        }
      }
    }

    // File not in manifest, it's new
    logger.debug(`New file, will convert: ${fileName}`);
    return true;
  }

  /**
   * Check if analysis is needed for a file with given model
   * Returns true if file needs analysis with this specific model
   * Respects force flag
   */
  isAnalysisNeeded(
    outputFile: string,
    model: string,
    manifest: Manifest,
    force: boolean = false
  ): boolean {
    if (force) {
      logger.debug(`Force flag set, will re-analyze: ${outputFile} with ${model}`);
      return true;
    }

    // Find the processed file entry
    const entry = manifest.processed_files.find(
      (f) => f.output_file === outputFile
    );

    if (!entry) {
      logger.debug(`File not in manifest, will analyze: ${outputFile}`);
      return true;
    }

    // Check if analysis exists for this model
    if (entry.analyses && entry.analyses[model]) {
      logger.debug(`Analysis cache hit: ${outputFile} with model ${model}`);
      return false;
    }

    logger.debug(`No analysis cache for ${outputFile} with model ${model}, will analyze`);
    return true;
  }

  /**
   * Deprecated: Use isConversionNeeded instead
   */
  isFileProcessed(filePath: string, manifest: Manifest): boolean {
    return !this.isConversionNeeded(filePath, manifest, false);
  }

  /**
   * Record a successful conversion in the manifest
   */
  recordConversion(
    manifest: Manifest,
    inputFile: string,
    outputFile: string,
    fileHash: string
  ): void {
    // Check if entry already exists
    let entry = manifest.processed_files.find((f) => f.input_file === inputFile);

    if (entry) {
      // Update existing entry
      entry.conversions = {
        file_hash: fileHash,
        converted_at: new Date().toISOString(),
        source_file: inputFile,
        output_file: outputFile,
      };
    } else {
      // Create new entry
      entry = {
        input_file: inputFile,
        output_file: outputFile,
        conversions: {
          file_hash: fileHash,
          converted_at: new Date().toISOString(),
          source_file: inputFile,
          output_file: outputFile,
        },
        analyses: {},
      };
      manifest.processed_files.push(entry);
    }

    logger.debug(`Recorded conversion: ${inputFile} → ${outputFile}`);
  }

  /**
   * Record a successful analysis in the manifest
   * Tracks which model was used and when
   */
  recordAnalysis(
    manifest: Manifest,
    outputFile: string,
    model: string,
    reportFile: string
  ): void {
    const entry = manifest.processed_files.find((f) => f.output_file === outputFile);

    if (!entry) {
      logger.warn(
        `Could not record analysis: ${outputFile} not found in manifest`
      );
      return;
    }

    entry.analyses[model] = {
      model,
      analyzed_at: new Date().toISOString(),
      report_file: reportFile,
    };

    logger.debug(`Recorded analysis: ${outputFile} with model ${model}`);
  }

  /**
   * Clear all analysis cache entries (for --force-analyze flag)
   */
  clearAnalysisCache(manifest: Manifest): void {
    for (const entry of manifest.processed_files) {
      entry.analyses = {};
    }
    logger.info("Cleared all analysis cache entries");
  }

  /**
   * Clear entire manifest (for --force-all flag)
   */
  clearManifest(): Manifest {
    logger.info("Clearing entire manifest");
    return {
      version: 1,
      last_run: new Date().toISOString(),
      processed_files: [],
    };
  }

  /**
   * Clean up temporary manifest file
   */
  private cleanupTempFile(): void {
    try {
      if (fs.existsSync(this.tempPath)) {
        fs.unlinkSync(this.tempPath);
        logger.debug("Cleaned up temporary manifest file");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Could not clean up temp file: ${message}`);
    }
  }
}
