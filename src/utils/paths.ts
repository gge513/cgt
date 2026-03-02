/**
 * Path Security Utilities
 * Prevents path traversal attacks by validating file paths
 * are within allowed directories.
 */

import path from "path";
import { getLogger } from "./logging";

const logger = getLogger();

/**
 * Resolve a path within a base directory and ensure it doesn't escape
 * the base directory through traversal sequences like ../
 *
 * @param basePath - The base directory path (must be absolute)
 * @param requestedPath - The requested file path (relative or absolute)
 * @returns The resolved absolute path if valid
 * @throws Error if path tries to escape the base directory (path traversal)
 */
export function resolveSafePath(basePath: string, requestedPath: string): string {
  // Validate inputs
  if (typeof basePath !== "string" || !basePath.trim()) {
    throw new Error("Base path must be a non-empty string");
  }

  if (typeof requestedPath !== "string") {
    throw new Error("Requested path must be a string");
  }

  // Convert to absolute paths for proper validation
  const absoluteBase = path.resolve(basePath);
  const resolvedPath = path.resolve(absoluteBase, requestedPath);

  // Verify the resolved path is within the base directory
  // Use path.relative to check if the path escapes
  const relative = path.relative(absoluteBase, resolvedPath);

  // If relative path starts with .., we've escaped the base directory
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    logger.warn(`Path traversal detected: ${requestedPath} -> ${resolvedPath}`);
    throw new Error(
      `Path traversal detected: requested path escapes base directory`
    );
  }

  // Additional check: ensure resolved path actually starts with base
  // This handles edge cases on case-insensitive filesystems
  if (!resolvedPath.startsWith(absoluteBase)) {
    logger.warn(`Path outside base directory: ${resolvedPath}`);
    throw new Error(
      `Resolved path is outside the allowed base directory`
    );
  }

  return resolvedPath;
}

/**
 * Validate that a filename contains only safe characters
 * and no path traversal sequences
 *
 * @param filename - The filename to validate (not a path)
 * @returns true if valid, false otherwise
 */
export function isValidFilename(filename: string): boolean {
  if (typeof filename !== "string" || !filename.trim()) {
    return false;
  }

  // Reject path traversal sequences
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return false;
  }

  // Reject null bytes
  if (filename.includes("\0")) {
    return false;
  }

  // Reject absolute paths
  if (path.isAbsolute(filename)) {
    return false;
  }

  // Whitelist safe characters: alphanumeric, dots, hyphens, underscores
  const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
  return SAFE_FILENAME_PATTERN.test(filename);
}

/**
 * Create a safe path join that validates the result
 *
 * @param basePath - The base directory (must be absolute)
 * @param segments - Path segments to join
 * @returns Safe resolved path
 * @throws Error if path traversal is detected
 */
export function safePath(basePath: string, ...segments: string[]): string {
  if (segments.length === 0) {
    return path.resolve(basePath);
  }

  // Join all segments first
  const joined = path.join(...segments);

  // Validate the result using resolveSafePath
  return resolveSafePath(basePath, joined);
}

/**
 * Whitelist of allowed filenames that can be accessed
 * Add new files here as the system grows
 */
const ALLOWED_FILENAMES = new Set([
  ".processed_kms.json",
  ".processed_manifest.json",
  ".processed_kms_inferred.json",
  ".pipeline.log",
  "validations.json",
]);

/**
 * Check if a filename is in the whitelist
 *
 * @param filename - The filename to check
 * @returns true if filename is allowed
 */
export function isAllowedKMSFile(filename: string): boolean {
  return ALLOWED_FILENAMES.has(filename);
}

/**
 * Add a filename to the whitelist of allowed KMS files
 * Use this when adding new system files
 *
 * @param filename - The filename to allow
 */
export function allowKMSFile(filename: string): void {
  if (!isValidFilename(filename)) {
    throw new Error(`Invalid filename: ${filename}`);
  }
  ALLOWED_FILENAMES.add(filename);
  logger.info(`Added KMS file to whitelist: ${filename}`);
}

/**
 * Security context for file operations
 * Use this to ensure consistent path validation across the app
 */
export class SafeFileContext {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Resolve a path within this context's base directory
   */
  resolve(requestedPath: string): string {
    return resolveSafePath(this.baseDir, requestedPath);
  }

  /**
   * Join path segments safely within this context
   */
  join(...segments: string[]): string {
    return safePath(this.baseDir, ...segments);
  }

  /**
   * Get the base directory for this context
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
