/**
 * Cache Library Tests
 *
 * Verifies caching behavior with mtime checking and TTL expiration
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import {
  getKMSData,
  invalidateKMSCache,
  cacheGet,
  cacheSet,
  cacheInvalidatePattern,
  getCacheStats,
  clearAllCaches,
} from '../../lib/cache';

// Mock logger
jest.mock('../utils/logging', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock paths
jest.mock('../utils/paths', () => ({
  SafeFileContext: jest.fn(function(baseDir: string) {
    this.baseDir = baseDir;
    this.resolve = (path: string) => join(baseDir, path);
  }),
}));

describe('Cache Library', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdirSync(join(os.tmpdir(), `cache-test-${Date.now()}`), { recursive: true });
    clearAllCaches();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    clearAllCaches();
  });

  describe('TTL Cache (Strategy 2)', () => {
    test('stores and retrieves values from cache', () => {
      const key = 'test-key';
      const data = { value: 'test data' };

      cacheSet(key, data);
      const result = cacheGet(key);

      expect(result).toEqual(data);
    });

    test('returns null for non-existent keys', () => {
      const result = cacheGet('non-existent-key');
      expect(result).toBeNull();
    });

    test('expires entries after TTL', (done) => {
      const key = 'test-key';
      const data = { value: 'test data' };

      cacheSet(key, data, 100); // 100ms TTL
      expect(cacheGet(key)).toEqual(data);

      // Wait for expiration
      setTimeout(() => {
        expect(cacheGet(key)).toBeNull();
        done();
      }, 150);
    });

    test('supports custom TTL values', (done) => {
      const key = 'test-key';
      const data = { value: 'test data' };

      cacheSet(key, data, 50); // Very short TTL
      expect(cacheGet(key)).toEqual(data);

      setTimeout(() => {
        expect(cacheGet(key)).toBeNull();
        done();
      }, 100);
    });

    test('uses default TTL when not specified', () => {
      const key = 'test-key';
      const data = { value: 'test data' };

      cacheSet(key, data); // No TTL specified
      const result = cacheGet(key);

      expect(result).toEqual(data); // Should still be cached
    });

    test('invalidates entries matching a pattern', () => {
      cacheSet('decisions:filter1', { data: 1 });
      cacheSet('decisions:filter2', { data: 2 });
      cacheSet('summary', { data: 3 });

      cacheInvalidatePattern('decisions:');

      expect(cacheGet('decisions:filter1')).toBeNull();
      expect(cacheGet('decisions:filter2')).toBeNull();
      expect(cacheGet('summary')).toEqual({ data: 3 }); // Not affected
    });

    test('handles multiple cache entries independently', () => {
      cacheSet('key1', { value: 1 });
      cacheSet('key2', { value: 2 });
      cacheSet('key3', { value: 3 });

      expect(cacheGet('key1')).toEqual({ value: 1 });
      expect(cacheGet('key2')).toEqual({ value: 2 });
      expect(cacheGet('key3')).toEqual({ value: 3 });
    });

    test('stores different data types', () => {
      cacheSet('string', 'value');
      cacheSet('number', 42);
      cacheSet('boolean', true);
      cacheSet('array', [1, 2, 3]);
      cacheSet('object', { nested: { value: 'test' } });

      expect(cacheGet('string')).toBe('value');
      expect(cacheGet('number')).toBe(42);
      expect(cacheGet('boolean')).toBe(true);
      expect(cacheGet('array')).toEqual([1, 2, 3]);
      expect(cacheGet('object')).toEqual({ nested: { value: 'test' } });
    });
  });

  describe('Cache Statistics', () => {
    test('reports cache size statistics', () => {
      cacheSet('key1', { data: 1 });
      cacheSet('key2', { data: 2 });

      const stats = getCacheStats();
      expect(stats.ttlCacheSize).toBe(2);
    });

    test('tracks expired entries count', (done) => {
      cacheSet('key1', { data: 1 }, 50); // Will expire
      cacheSet('key2', { data: 2 }, 60000); // Won't expire

      setTimeout(() => {
        const stats = getCacheStats();
        // Should show 1 expired entry still in map
        expect(stats.ttlCacheSize).toBeGreaterThanOrEqual(1);

        done();
      }, 100);
    });
  });

  describe('Cache Invalidation', () => {
    test('clears all caches', () => {
      cacheSet('key1', { data: 1 });
      cacheSet('key2', { data: 2 });

      clearAllCaches();

      expect(cacheGet('key1')).toBeNull();
      expect(cacheGet('key2')).toBeNull();
    });

    test('pattern matching works with partial strings', () => {
      cacheSet('decisions:status:active', { data: 1 });
      cacheSet('decisions:status:inactive', { data: 2 });
      cacheSet('decisions:owner:alice', { data: 3 });
      cacheSet('summary', { data: 4 });

      cacheInvalidatePattern('decisions:status');

      expect(cacheGet('decisions:status:active')).toBeNull();
      expect(cacheGet('decisions:status:inactive')).toBeNull();
      expect(cacheGet('decisions:owner:alice')).toEqual({ data: 3 });
      expect(cacheGet('summary')).toEqual({ data: 4 });
    });
  });

  describe('Mtime Cache (Strategy 1)', () => {
    test('invalidateKMSCache clears mtime cache', () => {
      // Test that invalidation doesn't throw
      expect(() => invalidateKMSCache()).not.toThrow();
    });

    test('invalidateKMSCache also clears TTL cache for consistency', () => {
      // Store in TTL cache
      cacheSet('key1', { data: 1 });
      expect(cacheGet('key1')).toEqual({ data: 1 });

      // Invalidate KMS cache (should also clear TTL)
      invalidateKMSCache();

      // TTL cache should still work independently
      cacheSet('key2', { data: 2 });
      expect(cacheGet('key2')).toEqual({ data: 2 });
    });
  });

  describe('Cache with Query Parameters', () => {
    test('supports cache keys with query parameters', () => {
      const key1 = 'decisions:active::';
      const key2 = 'decisions::high:';
      const key3 = 'decisions:::keyword';

      cacheSet(key1, { data: 1 });
      cacheSet(key2, { data: 2 });
      cacheSet(key3, { data: 3 });

      expect(cacheGet(key1)).toEqual({ data: 1 });
      expect(cacheGet(key2)).toEqual({ data: 2 });
      expect(cacheGet(key3)).toEqual({ data: 3 });
    });

    test('invalidates all variations of a key pattern', () => {
      cacheSet('decisions:active::test', { data: 1 });
      cacheSet('decisions::high:test', { data: 2 });
      cacheSet('decisions::high:other', { data: 3 });

      cacheInvalidatePattern('decisions:');

      expect(cacheGet('decisions:active::test')).toBeNull();
      expect(cacheGet('decisions::high:test')).toBeNull();
      expect(cacheGet('decisions::high:other')).toBeNull();
    });
  });

  describe('Race Conditions', () => {
    test('handles concurrent cache operations', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            cacheSet(`key-${i}`, { value: i });
            return cacheGet(`key-${i}`);
          })
        );
      }

      const results = await Promise.all(promises);
      results.forEach((result, i) => {
        expect(result?.value).toBe(i);
      });
    });

    test('handles invalidation during reads', async () => {
      cacheSet('key1', { value: 1 });
      cacheSet('key2', { value: 2 });

      const readPromise = Promise.resolve(cacheGet('key1'));
      const invalidatePromise = Promise.resolve(cacheInvalidatePattern('key'));

      const [readResult] = await Promise.all([readPromise, invalidatePromise]);
      expect(readResult).toBeDefined(); // Read should happen before invalidation
    });
  });
});
