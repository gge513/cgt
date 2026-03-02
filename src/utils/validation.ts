/**
 * Input validation utilities
 * Validates file sizes, paths, permissions, and other system boundaries
 */

import * as fs from "fs";
import { ValidationResult } from "../types";
import { getLogger } from "./logging";

const logger = getLogger();

// Default limits (configurable via environment)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10); // 10MB
const MAX_TOTAL_SIZE = parseInt(process.env.MAX_TOTAL_SIZE || "104857600", 10); // 100MB

/**
 * Validate a single file before processing
 */
export function validateFile(filePath: string): ValidationResult {
  try {
    const stats = fs.lstatSync(filePath);

    // Check for symlinks (prevents directory traversal attacks)
    if (stats.isSymbolicLink()) {
      return {
        valid: false,
        error: `Symlinks not supported: ${filePath}`,
      };
    }

    // Check if file is readable
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      return {
        valid: false,
        error: `File not readable: ${filePath}`,
      };
    }

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File exceeds size limit (${stats.size} > ${MAX_FILE_SIZE}): ${filePath}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate file: ${filePath} - ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate a directory exists and is accessible
 */
export function validateDirectory(dirPath: string, mustBeWritable: boolean = false): ValidationResult {
  try {
    const stats = fs.lstatSync(dirPath);

    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: `Path is not a directory: ${dirPath}`,
      };
    }

    // Check readability
    try {
      fs.accessSync(dirPath, fs.constants.R_OK);
    } catch {
      return {
        valid: false,
        error: `Directory not readable: ${dirPath}`,
      };
    }

    // Check writability if required
    if (mustBeWritable) {
      try {
        fs.accessSync(dirPath, fs.constants.W_OK);
      } catch {
        return {
          valid: false,
          error: `Directory not writable: ${dirPath}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate directory: ${dirPath} - ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate API key on startup (fail fast)
 */
export function validateApiKey(): ValidationResult {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      valid: false,
      error: "ANTHROPIC_API_KEY environment variable is not set. Please set it before running.",
    };
  }

  if (apiKey.length < 20) {
    return {
      valid: false,
      error: "ANTHROPIC_API_KEY appears invalid (too short). Please verify.",
    };
  }

  return { valid: true };
}

/**
 * Validate model ID format
 */
export function validateModelId(model: string): ValidationResult {
  if (!model.startsWith("claude-")) {
    return {
      valid: false,
      error: `Invalid model ID: "${model}". Must be a valid Claude model name (e.g., claude-haiku-4-5-20251001).`,
    };
  }

  return { valid: true };
}

/**
 * Validate total size of multiple files
 */
export function validateTotalSize(files: string[]): ValidationResult {
  try {
    let totalSize = 0;

    for (const file of files) {
      const stats = fs.statSync(file);
      totalSize += stats.size;

      if (totalSize > MAX_TOTAL_SIZE) {
        return {
          valid: false,
          error: `Total input size exceeds limit (${totalSize} > ${MAX_TOTAL_SIZE}). Please process fewer files.`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate total size: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Create directory if it doesn't exist
 */
export function ensureDirectoryExists(dirPath: string): ValidationResult {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug(`Created directory: ${dirPath}`);
    }

    // Verify it's writable
    return validateDirectory(dirPath, true);
  } catch (error) {
    return {
      valid: false,
      error: `Failed to create directory: ${dirPath} - ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate all runtime requirements on startup
 */
export function validateStartupRequirements(): ValidationResult {
  const logger = getLogger();

  // Check API key
  const apiKeyCheck = validateApiKey();
  if (!apiKeyCheck.valid) {
    return apiKeyCheck;
  }

  // Check model ID if set
  const modelId = process.env.MODEL_ID || "claude-haiku-4-5-20251001";
  const modelCheck = validateModelId(modelId);
  if (!modelCheck.valid) {
    return modelCheck;
  }

  logger.debug(`Startup validation passed`, {
    apiKey: "set",
    model: modelId,
    maxFileSize: MAX_FILE_SIZE,
    maxTotalSize: MAX_TOTAL_SIZE,
  });

  return { valid: true };
}
