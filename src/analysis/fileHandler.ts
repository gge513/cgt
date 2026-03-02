import * as fs from "fs";
import * as path from "path";
import { TranscriptMetadata } from "../types";

// File size limits (configurable via environment variables)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760"); // 10MB default
const MAX_TOTAL_SIZE = parseInt(
  process.env.MAX_TOTAL_SIZE || "104857600"
); // 100MB default

/**
 * Validate a file before reading.
 * Checks for size limits, symlinks, and permissions.
 */
function validateInputFile(filePath: string): { valid: boolean; error?: string } {
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: "File does not exist" };
    }

    // Use lstat to check symlinks without following them
    const stats = fs.lstatSync(filePath);

    // Check if it's a symlink
    if (stats.isSymbolicLink()) {
      return { valid: false, error: "Symlinks not supported" };
    }

    // Check it's a regular file (not directory)
    if (!stats.isFile()) {
      return { valid: false, error: "Not a regular file" };
    }

    // Check readable
    fs.accessSync(filePath, fs.constants.R_OK);

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File exceeds size limit (${stats.size} bytes > ${MAX_FILE_SIZE} bytes)`,
      };
    }

    return { valid: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { valid: false, error: msg };
  }
}

export function readTranscriptFile(filePath: string): TranscriptMetadata | null {
  try {
    // Validate file before reading
    const validation = validateInputFile(filePath);
    if (!validation.valid) {
      console.warn(`⚠️  Skipping ${path.basename(filePath)}: ${validation.error}`);
      return null;
    }

    const filename = path.basename(filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    // Extract date from filename if it starts with YYYY-MM-DD
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "Unknown";

    return {
      date,
      concepts: [],
      filename,
      content,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `❌ Error reading ${path.basename(filePath)}: ${errorMsg}`
    );
    return null;
  }
}

export function readAllTranscripts(inputDir: string): TranscriptMetadata[] {
  if (!fs.existsSync(inputDir)) {
    console.warn(`⚠️  Input directory not found: ${inputDir}`);
    return [];
  }

  try {
    const files = fs
      .readdirSync(inputDir)
      .filter((file) => file.endsWith(".md"));

    if (files.length === 0) {
      console.warn(`⚠️  No .md files found in ${inputDir}`);
      return [];
    }

    const transcripts: TranscriptMetadata[] = [];
    let totalSize = 0;
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      const filePath = path.join(inputDir, file);

      // Check total size before reading
      try {
        const stats = fs.lstatSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          if (totalSize > MAX_TOTAL_SIZE) {
            console.warn(
              `⚠️  Total input size (${totalSize} bytes) exceeds limit (${MAX_TOTAL_SIZE} bytes). Stopping.`
            );
            break;
          }
        }
      } catch {
        // Skip files we can't stat
        continue;
      }

      const transcript = readTranscriptFile(filePath);
      if (transcript) {
        transcripts.push(transcript);
      } else {
        errors.push({ file, error: "Failed to read" });
      }
    }

    // Report summary
    if (errors.length > 0) {
      console.warn(
        `\n⚠️  Failed to read ${errors.length} file(s) (see above for details)\n`
      );
    }

    if (transcripts.length === 0 && files.length > 0) {
      throw new Error(
        `No valid transcript files found in ${inputDir}. Check for encoding issues, file size limits, or symlinks.`
      );
    }

    return transcripts;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Error reading transcripts: ${errorMsg}`);
    return [];
  }
}

export function writeReport(
  outputDir: string,
  filename: string,
  content: string
): void {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const outputPath = path.join(outputDir, `${timestamp}_${filename}`);

    fs.writeFileSync(outputPath, content, "utf-8");
    console.log(`✓ Report saved: ${outputPath}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Error writing report: ${errorMsg}`);
    throw error;
  }
}
