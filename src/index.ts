/**
 * Main entry point for Transcript Analyzer Unified
 * Exports public API for programmatic usage
 */

// Re-export types
export * from "./types";

// Re-export utilities
export { getLogger, setLogLevel, Logger, LogLevel } from "./utils/logging";
export { getClient, getModel, resetClient } from "./utils/client";
export {
  validateFile,
  validateDirectory,
  validateApiKey,
  validateModelId,
  validateTotalSize,
  ensureDirectoryExists,
  validateStartupRequirements,
} from "./utils/validation";

// Version
export const VERSION = "2.0.0";
