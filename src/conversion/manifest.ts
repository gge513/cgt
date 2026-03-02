/**
 * Manifest Management for tracking file processing state
 * Handles loading, saving, and updating processing manifest with atomic operations
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Manifest, ProcessedFile } from "../types";
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
   * Save manifest to disk atomically
   * Writes to temp file first, then renames to prevent corruption
   */
  saveManifest(manifest: Manifest): void {
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
      logger.error(`Could not save manifest: ${message}`);
      // Clean up temp file if it exists
      this.cleanupTempFile();
    }
  }

  /**
   * Check if a file has already been processed
   * Returns true only if file exists in manifest AND hash matches (not modified)
   */
  isFileProcessed(filePath: string, manifest: Manifest): boolean {
    const fileName = path.basename(filePath);

    for (const entry of manifest.processed_files) {
      if (entry.input_file === fileName) {
        // File was processed before, check if it was modified
        const currentHash = this.computeFileHash(filePath);
        if (currentHash && currentHash === entry.conversions.file_hash) {
          // File unchanged, skip it
          logger.debug(`File already processed: ${fileName}`);
          return true;
        } else {
          // File was modified, needs re-processing
          logger.debug(`File modified, will reprocess: ${fileName}`);
          return false;
        }
      }
    }

    // File not in manifest, it's new
    return false;
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
    // Remove existing entry if it exists (update case)
    manifest.processed_files = manifest.processed_files.filter(
      (f) => f.input_file !== inputFile
    );

    // Add new entry
    const entry: ProcessedFile = {
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
    logger.debug(`Recorded conversion: ${inputFile} → ${outputFile}`);
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
