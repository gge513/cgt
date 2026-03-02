/**
 * File Upload Helper Functions
 *
 * Reusable utilities for file upload validation and safety
 */

import { v4 as uuid } from 'uuid';
import { join } from 'path';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadConfig {
  maxFileSize: number;  // bytes
  allowedExtensions: string[];
  uploadDir: string;
}

const DEFAULT_CONFIG: UploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),  // 10MB
  allowedExtensions: ['.txt'],
  uploadDir: 'input',
};

/**
 * Validate file size
 */
export function validateFileSize(
  size: number,
  maxSize: number = DEFAULT_CONFIG.maxFileSize
): FileValidationResult {
  if (size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (size > maxSize) {
    const maxMB = (maxSize / 1024 / 1024).toFixed(1);
    const sizeMB = (size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File exceeds size limit (${maxMB}MB). Current: ${sizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate file extension
 */
export function validateFileExtension(
  filename: string,
  allowed: string[] = DEFAULT_CONFIG.allowedExtensions
): FileValidationResult {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  if (!allowed.includes(ext)) {
    const supportedExt = allowed.join(', ');
    return {
      valid: false,
      error: `Only ${supportedExt} files are supported. Received: ${ext}`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let safe = filename.replace(/[\/\\]/g, '').replace(/\0/g, '');

  // Remove leading dots (prevent hidden files)
  safe = safe.replace(/^\.+/, '');

  // Keep only safe characters: alphanumeric, dots, underscores, hyphens
  safe = safe.replace(/[^a-zA-Z0-9._\-]/g, '-');

  // Remove multiple consecutive hyphens
  safe = safe.replace(/-{2,}/g, '-');

  // Remove trailing dots/spaces
  safe = safe.replace(/[\s.]+$/, '');

  // Ensure it's not empty
  if (!safe) {
    safe = `transcript-${uuid()}.txt`;
  }

  return safe;
}

/**
 * Check if path is within allowed directory (prevent traversal)
 */
export function isPathSafe(
  filePath: string,
  baseDir: string = DEFAULT_CONFIG.uploadDir
): boolean {
  const path = require('path');
  const resolvedPath = path.resolve(filePath);
  const resolvedBaseDir = path.resolve(baseDir);

  return resolvedPath.startsWith(resolvedBaseDir + path.sep) ||
    resolvedPath === resolvedBaseDir;
}

/**
 * Construct safe file path
 */
export function constructSafePath(
  filename: string,
  uploadDir: string = DEFAULT_CONFIG.uploadDir
): { path: string; safe: boolean; error?: string } {
  const sanitized = sanitizeFilename(filename);
  const filePath = join(uploadDir, sanitized);

  const safe = isPathSafe(filePath, uploadDir);

  if (!safe) {
    return {
      path: filePath,
      safe: false,
      error: 'Path traversal detected',
    };
  }

  return {
    path: filePath,
    safe: true,
  };
}

/**
 * Validate entire file upload
 */
export function validateFileUpload(
  filename: string,
  fileSize: number,
  config: Partial<UploadConfig> = {}
): FileValidationResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Check extension
  const extValidation = validateFileExtension(filename, finalConfig.allowedExtensions);
  if (!extValidation.valid) {
    return extValidation;
  }

  // Check size
  const sizeValidation = validateFileSize(fileSize, finalConfig.maxFileSize);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Check path safety
  const pathCheck = constructSafePath(filename, finalConfig.uploadDir);
  if (!pathCheck.safe) {
    return {
      valid: false,
      error: pathCheck.error,
    };
  }

  return { valid: true };
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get upload config from environment
 */
export function getUploadConfig(): UploadConfig {
  return {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.txt').split(','),
    uploadDir: process.env.UPLOAD_DIR || 'input',
  };
}
