/**
 * API Response Caching with Dual Strategy
 *
 * Strategy 1: File Modification Time Caching
 * - Cache is invalidated only when the source file changes
 * - Zero stale data risk, minimal overhead
 *
 * Strategy 2: TTL-Based Request Caching
 * - Additional layer for redundant computation (aggregation, filtering)
 * - Reduces repeated aggregation for identical queries
 *
 * Combined approach: Cache file reads + TTL cache for aggregated results
 */

import { statSync, readFileSync } from 'fs';
import { join } from 'path';
import { getLogger } from '../src/utils/logging';
import { SafeFileContext } from '../src/utils/paths';

const logger = getLogger();

// ==========================================
// Type Definitions
// ==========================================

interface MtimeCacheEntry<T> {
  data: T;
  mtime: number;
}

interface TtlCacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ==========================================
// Configuration
// ==========================================

const KMS_FILE_PATH = '.processed_kms.json';
const DEFAULT_TTL_MS = 30 * 1000; // 30 seconds
const fileContext = new SafeFileContext(process.cwd());

// ==========================================
// File Modification Time Cache (Strategy 1)
// ==========================================

const mtimeCache = new Map<string, MtimeCacheEntry<any>>();

/**
 * Get KMS data from cache if file hasn't changed, otherwise reload from disk
 *
 * This provides:
 * - Automatic cache invalidation (no stale data)
 * - Zero external dependencies
 * - Minimal overhead (one stat call per request)
 *
 * @returns Parsed KMS data from .processed_kms.json
 * @throws If file cannot be read
 */
export function getKMSData(): any {
  try {
    const safePath = fileContext.resolve(KMS_FILE_PATH);
    const stat = statSync(safePath);
    const currentMtime = stat.mtimeMs;

    // Check if cache entry exists and is valid
    const cached = mtimeCache.get('kms');
    if (cached && cached.mtime === currentMtime) {
      // Cache hit: file hasn't changed since last read
      logger.debug('KMS cache hit (mtime match)');
      return cached.data;
    }

    // Cache miss: reload from disk and store new entry
    logger.debug('KMS cache miss, reloading from disk');
    const content = readFileSync(safePath, 'utf-8');
    const data = JSON.parse(content);

    mtimeCache.set('kms', {
      data,
      mtime: currentMtime,
    });

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load KMS data: ${message}`);
    throw error;
  }
}

/**
 * Invalidate mtime cache after KMS updates
 *
 * Call this after any write operation that modifies .processed_kms.json
 * so the next read will fetch fresh data.
 */
export function invalidateKMSCache(): void {
  mtimeCache.delete('kms');
  ttlCache.clear(); // Also clear TTL cache for consistency
  logger.debug('KMS cache invalidated');
}

/**
 * Clear all mtime cache entries (for testing)
 */
export function clearMtimeCache(): void {
  mtimeCache.clear();
  logger.debug('Mtime cache cleared');
}

// ==========================================
// TTL-Based Request Cache (Strategy 2)
// ==========================================

const ttlCache = new Map<string, TtlCacheEntry<any>>();

/**
 * Get value from TTL cache if not expired
 *
 * Used for caching aggregated/filtered results to avoid redundant computation
 *
 * @param key Cache key
 * @returns Cached value or null if not found or expired
 */
export function cacheGet<T>(key: string): T | null {
  const entry = ttlCache.get(key);

  if (!entry) {
    return null;
  }

  // Check if entry has expired
  if (Date.now() > entry.expiresAt) {
    ttlCache.delete(key);
    logger.debug(`Cache expired: ${key}`);
    return null;
  }

  logger.debug(`Cache hit: ${key}`);
  return entry.data as T;
}

/**
 * Store value in TTL cache
 *
 * @param key Cache key
 * @param data Data to cache
 * @param ttlMs Time-to-live in milliseconds (default: 30 seconds)
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  ttlCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
  logger.debug(`Cache set: ${key} (TTL: ${ttlMs}ms)`);
}

/**
 * Invalidate cache entries matching a pattern
 *
 * Useful for invalidating all variations of an endpoint
 * (e.g., "decisions:*" matches all decision cache entries)
 *
 * @param pattern String pattern to match keys
 */
export function cacheInvalidatePattern(pattern: string): void {
  let count = 0;
  for (const key of ttlCache.keys()) {
    if (key.includes(pattern)) {
      ttlCache.delete(key);
      count++;
    }
  }
  logger.debug(`Cache invalidated ${count} entries matching pattern: ${pattern}`);
}

/**
 * Clear all TTL cache entries (for testing or emergency)
 */
export function clearTtlCache(): void {
  ttlCache.clear();
  logger.debug('TTL cache cleared');
}

// ==========================================
// Cache Statistics (for monitoring)
// ==========================================

export interface CacheStats {
  mtimeCacheSize: number;
  ttlCacheSize: number;
  ttlCacheExpiredCount: number;
}

/**
 * Get cache statistics for monitoring/debugging
 */
export function getCacheStats(): CacheStats {
  // Count expired TTL entries
  let expiredCount = 0;
  for (const entry of ttlCache.values()) {
    if (Date.now() > entry.expiresAt) {
      expiredCount++;
    }
  }

  return {
    mtimeCacheSize: mtimeCache.size,
    ttlCacheSize: ttlCache.size,
    ttlCacheExpiredCount: expiredCount,
  };
}

/**
 * Clear all caches (for testing)
 */
export function clearAllCaches(): void {
  clearMtimeCache();
  clearTtlCache();
  logger.debug('All caches cleared');
}
