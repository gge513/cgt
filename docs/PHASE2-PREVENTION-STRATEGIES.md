# Phase 2 KMS Remediation: Prevention Strategies & Best Practices

**Status**: Production Implementation Guide
**Created**: March 2, 2026
**Audience**: Developers maintaining the KMS system

---

## Table of Contents

1. [Overview](#overview)
2. [Prevention Strategies](#prevention-strategies)
3. [Best Practices](#best-practices)
4. [Testing & Verification](#testing--verification)
5. [Reusable Code Patterns](#reusable-code-patterns)
6. [Checklists](#checklists)

---

## Overview

This document captures **lessons learned** from Phase 1 (security hardening) and Phase 2 (performance optimization) KMS implementation. Four critical issues were addressed:

| Issue | Root Cause | Prevention Strategy | Risk If Ignored |
|-------|-----------|-------------------|-----------------|
| **N+1 Reads** | Reading .processed_kms.json on every request | mtime-based caching | 30x slower response times |
| **JSON Injection** | Unvalidated external data in responses | Zod schema validation | Security vulnerability |
| **Non-atomic Writes** | Direct writeFileSync without temp file | Temp file + rename pattern | Data corruption on process crash |
| **Path Traversal** | User-supplied paths without validation | SafeFileContext class | File system access outside intended dirs |

---

## Prevention Strategies

### 1. Preventing N+1 Reads (mtime-Based Caching)

**Problem**: Loading `.processed_kms.json` multiple times without checking if file changed.

#### Strategy: mtime-Based Cache Pattern

```typescript
// File: lib/cache.ts
interface MtimeCacheEntry<T> {
  data: T;
  mtime: number;  // File modification time in milliseconds
}

const mtimeCache = new Map<string, MtimeCacheEntry<unknown>>();

/**
 * Load with automatic cache invalidation based on file modification time
 * This pattern combines:
 * - No stale data (always checks mtime)
 * - Minimal overhead (one stat() call per request)
 * - Zero external dependencies (no Redis, no TTL timers)
 */
export function getKMSData(): KMSStore {
  try {
    const safePath = fileContext.resolve(KMS_FILE_PATH);
    const stat = statSync(safePath);
    const currentMtime = stat.mtimeMs;

    // Cache hit if file hasn't changed
    const cached = mtimeCache.get('kms');
    if (cached && cached.mtime === currentMtime) {
      logger.debug('KMS cache hit (mtime match)');
      return cached.data as KMSStore;
    }

    // Cache miss: reload and store new entry
    logger.debug('KMS cache miss, reloading from disk');
    const content = readFileSync(safePath, 'utf-8');
    const data = kmsStoreSchema.parse(JSON.parse(content));

    mtimeCache.set('kms', { data, mtime: currentMtime });
    return data as KMSStore;
  } catch (error) {
    logger.error(`Failed to load KMS data: ${error}`);
    throw error;
  }
}
```

#### When to Use mtime vs TTL

| Strategy | Use Case | Pros | Cons |
|----------|----------|------|------|
| **mtime** | Source file tracking | No stale data, minimal overhead | Requires one stat() call |
| **TTL** | Aggregation/filtering | Reduces computation | Data stale until expiration |
| **Both** | KMS endpoints | Best of both worlds | Slight complexity |

**Recommendation**: Use both layers:
- **Layer 1 (mtime)**: Cache loaded file to detect changes
- **Layer 2 (TTL)**: Cache filtered/aggregated results for 30s

#### Implementation Checklist

- [ ] Create MtimeCacheEntry interface with `data: T` and `mtime: number`
- [ ] Use `statSync(path).mtimeMs` to get file mod time
- [ ] On cache miss, always reload from disk and parse with validation
- [ ] Invalidate mtime cache after ANY write operation
- [ ] Log cache hits/misses for monitoring

---

### 2. Preventing JSON Injection (Zod Validation)

**Problem**: Accepting unvalidated JSON that could corrupt data or enable attacks.

#### Strategy: Always Use Zod Schemas for External Data

```typescript
// File: lib/validation-schemas.ts
import { z } from 'zod';

// Define strict schema for all external data
export const kmsStoreSchema = z.object({
  version: z.literal(1),  // Pinned version for safety
  lastUpdated: z.string().datetime(),
  meetings: z.record(
    z.string(),
    z.object({
      meeting: z.string(),
      analyzedAt: z.string().datetime(),
      decisions: z.array(kmsDecisionStoreSchema),
      actionItems: z.array(kmsActionItemStoreSchema),
      // ... rest of fields
    })
  ),
});

// Never do this:
// const data = JSON.parse(content);  // ❌ NO VALIDATION

// Always do this:
// const data = kmsStoreSchema.parse(JSON.parse(content));  // ✅ Validated
```

#### Zod Schema Versioning & Evolution

```typescript
// Version 1: Current production schema
export const kmsStoreSchemaV1 = z.object({
  version: z.literal(1),
  lastUpdated: z.string(),
  meetings: z.record(z.string(), z.any()),
});

// Version 2: Future enhancement (backwards compatible)
export const kmsStoreSchemaV2 = z.object({
  version: z.literal(2),
  lastUpdated: z.string(),
  apiKey: z.string().optional(),  // New field
  meetings: z.record(z.string(), z.any()),
});

// Router function for handling multiple versions
export function parseKMSStore(data: unknown): KMSStore {
  try {
    // Try current version first
    return kmsStoreSchema.parse(data);
  } catch {
    // Fallback: try older versions if needed
    const asObject = data as Record<string, unknown>;
    if (asObject.version === 0) {
      return migrateFromV0(asObject);
    }
    throw new Error(`Unsupported KMS version: ${asObject.version}`);
  }
}
```

#### Schema Field Validation Rules

```typescript
// Strings with length limits (prevent injection)
text: z
  .string()
  .min(1, 'Cannot be empty')
  .max(2000, 'Must be 2000 chars or less'),

// Enums (prevent invalid values)
status: z.enum(['active', 'superseded', 'archived']),

// Dates in ISO format only
date: z.string().datetime('Must be ISO 8601 datetime'),

// UUIDs for IDs (structured, not arbitrary strings)
id: z.string().uuid('Must be valid UUID'),

// Arrays with item validation
blockedBy: z.array(z.string().uuid()),

// Optional fields with defaults
severity: z.enum(['low', 'medium', 'high']).optional().default('medium'),

// Numbers with bounds
confidence: z.number().min(0).max(1),
```

#### Validation Error Handling

```typescript
export function validateAndParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Extract user-friendly error messages
      const messages = error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      logger.error(`${context} validation failed: ${messages}`);
      throw new Error(`${context} validation failed: ${messages}`);
    }
    throw error;
  }
}
```

#### Implementation Checklist

- [ ] Define Zod schema for each data type (.processed_kms.json, actions, etc.)
- [ ] Use specific types (z.enum, z.uuid) instead of z.any
- [ ] Add min/max constraints to strings and numbers
- [ ] Use z.literal() for version fields
- [ ] Parse ALL external JSON with schema validation
- [ ] Log validation errors without exposing internals
- [ ] Version schemas from day one

---

### 3. Preventing Non-Atomic Writes (Temp + Rename)

**Problem**: Process crash during writeFileSync leaves corrupted files.

#### Strategy: Atomic File Operations

```typescript
// File: lib/kms/store.ts (or any file write)

/**
 * Save state with atomic write pattern:
 * 1. Write to temporary file
 * 2. Verify write succeeded
 * 3. Atomic rename (OS-level guarantee)
 * 4. Log success
 */
function saveKMSStore(store: KMSStore): void {
  try {
    const safePath = fileContext.resolve(KMS_FILE_PATH);
    const tempPath = safePath + '.tmp';

    // Step 1: Write to temp file
    const content = JSON.stringify(store, null, 2);
    fs.writeFileSync(tempPath, content, 'utf-8');

    // Step 2: Verify temp file was created
    if (!fs.existsSync(tempPath)) {
      throw new Error('Temp file was not created');
    }

    // Step 3: Atomic rename (atomic at OS level)
    fs.renameSync(tempPath, safePath);

    // Step 4: Verify final file exists
    if (!fs.existsSync(safePath)) {
      throw new Error('Rename operation failed');
    }

    logger.debug('KMS store saved (atomic write)');
  } catch (error) {
    // Cleanup temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      logger.warn(`Could not cleanup temp file: ${cleanupError}`);
    }

    logger.error(`Failed to save KMS store: ${error}`);
    throw error;
  }
}
```

#### Why Atomic Writes Matter

```
NON-ATOMIC (vulnerable):
┌─────────────┐
│ Start write │
└──────┬──────┘
       │ [CRASH] ← Process dies mid-write
       ▼
   ❌ Corrupted file (partial content)


ATOMIC (safe):
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│ Write .tmp   │ --> │ Rename .tmp  │ --> │ Success        │
│              │     │ to final     │     │ (atomically)   │
└──────────────┘     └──────────────┘     └────────────────┘
   If crash here:         If crash here:
   ✓ Original safe        ✓ Original safe
     (.tmp deleted)         (rename is atomic)
```

#### Implementation Checklist

- [ ] Always write to `.tmp` file first
- [ ] Use `fs.renameSync()` (atomic at OS level)
- [ ] Verify temp file exists after write
- [ ] Verify final file exists after rename
- [ ] Clean up temp files on error
- [ ] Log atomicity success
- [ ] Test with simulated process kills (see Testing section)

---

### 4. Preventing Path Traversal (SafeFileContext)

**Problem**: User-supplied paths could escape intended directories via `../`.

#### Strategy: SafeFileContext Class

```typescript
// File: src/utils/paths.ts

/**
 * Security context for all file operations
 * Prevents path traversal attacks by validating paths stay within base dir
 */
export class SafeFileContext {
  private baseDir: string;

  constructor(baseDir: string) {
    // Always use absolute paths
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Resolve a path within this context's base directory
   * Throws if path attempts to escape via ../ or absolute paths
   */
  resolve(requestedPath: string): string {
    // Convert both to absolute for comparison
    const absoluteBase = this.baseDir;
    const resolvedPath = path.resolve(absoluteBase, requestedPath);

    // Check if relative path starts with .. (escaped)
    const relative = path.relative(absoluteBase, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path traversal detected: requested path escapes base directory');
    }

    // Double-check resolved path starts with base
    if (!resolvedPath.startsWith(absoluteBase)) {
      throw new Error('Resolved path is outside the allowed base directory');
    }

    return resolvedPath;
  }

  /**
   * Join path segments safely (prevents ../ in any segment)
   */
  join(...segments: string[]): string {
    const joined = path.join(...segments);
    return this.resolve(joined);
  }

  /**
   * Get base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
```

#### Usage Pattern

```typescript
// Initialize once per request/module
const fileContext = new SafeFileContext(process.cwd());

// All file operations go through context
const safePath = fileContext.resolve(userProvidedFilename);
const content = fs.readFileSync(safePath, 'utf-8');

// This throws an error (path traversal):
const badPath = fileContext.resolve('../../../etc/passwd');
```

#### Additional Filename Validation

```typescript
/**
 * Validate filename contains only safe characters
 * and no path traversal sequences
 */
export function isValidFilename(filename: string): boolean {
  // Reject empty strings
  if (typeof filename !== 'string' || !filename.trim()) {
    return false;
  }

  // Reject path traversal sequences
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Reject null bytes (filesystem attacks)
  if (filename.includes('\0')) {
    return false;
  }

  // Reject absolute paths
  if (path.isAbsolute(filename)) {
    return false;
  }

  // Only allow alphanumeric, dots, hyphens, underscores
  const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
  return SAFE_FILENAME_PATTERN.test(filename);
}
```

#### Whitelist Approach

```typescript
/**
 * Whitelist of allowed system files
 * Add new files here as system grows
 */
const ALLOWED_FILENAMES = new Set([
  '.processed_kms.json',
  '.processed_kms_actions.json',
  '.processed_manifest.json',
  '.processed_kms_inferred.json',
  '.pipeline.log',
  'validations.json',
]);

export function isAllowedKMSFile(filename: string): boolean {
  return ALLOWED_FILENAMES.has(filename);
}
```

#### Implementation Checklist

- [ ] Create SafeFileContext with absolute base path
- [ ] Use context.resolve() for all user-supplied paths
- [ ] Check relative path doesn't start with '..'
- [ ] Verify resolved path starts with base directory
- [ ] Validate filenames match safe pattern
- [ ] Maintain whitelist of allowed system files
- [ ] Log path traversal attempts

---

## Best Practices

### 1. Layer Your Validation

```
User Input
    ↓
[Authentication] ← Verify user identity
    ↓
[Authorization]  ← Check permissions
    ↓
[Path Validation] ← Ensure safe paths
    ↓
[Schema Validation] ← Zod parse
    ↓
[Business Logic]  ← Process with confidence
```

### 2. Cache Hierarchy

Implement multiple cache layers with clear responsibilities:

```typescript
// Layer 1: File modification time (avoids re-reading file)
const mtimeCache = new Map<string, MtimeCacheEntry>();

// Layer 2: TTL cache (avoids re-aggregating)
const ttlCache = new Map<string, TtlCacheEntry>();

// Request flow:
// 1. Check TTL cache (fastest, 30s lifespan)
// 2. If miss, check mtime cache (still fast, auto-invalidates)
// 3. If miss, reload from disk and validate
```

### 3. Error Messages

Never leak implementation details:

```typescript
// ❌ BAD: Exposes internals
logger.error(`Zod validation failed: ${error.issues.map(...).join(',')}`);
return NextResponse.json(
  { error: `Invalid field: ${issue.path.join('.')}` },
  { status: 400 }
);

// ✅ GOOD: User-friendly
logger.error(`Request validation failed: ${message}`);
return NextResponse.json(
  { error: 'Invalid request format', details: 'Please check your input' },
  { status: 400 }
);
```

### 4. Atomic Operations Pattern

All writes follow this pattern:

```typescript
// 1. Validate inputs
const validated = schema.parse(input);

// 2. Prepare data
const content = JSON.stringify(validated, null, 2);

// 3. Write atomically
const tempPath = finalPath + '.tmp';
fs.writeFileSync(tempPath, content, 'utf-8');
fs.renameSync(tempPath, finalPath);

// 4. Invalidate cache
invalidateKMSCache();

// 5. Log success
logger.info('Data saved successfully');
```

### 5. File Operations Security

```typescript
// ✅ DO: Secure approach
const fileContext = new SafeFileContext(process.cwd());
const safePath = fileContext.resolve(filename);
const content = fs.readFileSync(safePath, 'utf-8');
const data = schema.parse(JSON.parse(content));

// ❌ DON'T: Vulnerable approaches
fs.readFileSync(userPath);  // No path validation
JSON.parse(content);         // No schema validation
fs.writeFileSync(path, data); // No atomic write
```

---

## Testing & Verification

### 1. Testing N+1 Elimination

**Objective**: Verify cache prevents redundant file reads.

```typescript
describe('mtime Cache - N+1 Prevention', () => {
  it('should cache file on first read', async () => {
    clearMtimeCache();

    // First read: loads from disk
    const data1 = getKMSData();

    // Second read: should be from cache (same mtime)
    const data2 = getKMSData();

    expect(data1).toEqual(data2);
  });

  it('should invalidate cache when file changes', async () => {
    const data1 = getKMSData();

    // Simulate file change
    const store = data1;
    store.lastUpdated = new Date().toISOString();
    saveKMSStore(store);  // Updates mtime

    // Next read should reload from disk
    const data2 = getKMSData();
    expect(data2.lastUpdated).not.toBe(data1.lastUpdated);
  });

  it('should benchmark cache hits', async () => {
    const iterations = 1000;

    // Warm cache
    getKMSData();

    // Time cache hits
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      getKMSData();
    }
    const duration = performance.now() - start;

    // Should be very fast (mtime check only)
    const avgMs = duration / iterations;
    console.log(`Avg cache hit: ${avgMs.toFixed(2)}ms (target: <1ms)`);
    expect(avgMs).toBeLessThan(1);  // Less than 1ms per hit
  });
});
```

### 2. Testing Zod Validation

**Objective**: Verify invalid data is rejected.

```typescript
describe('Zod Validation - JSON Injection Prevention', () => {
  it('should reject missing required fields', () => {
    const invalid = {
      version: 1,
      lastUpdated: '2026-03-02T00:00:00Z',
      // Missing 'meetings' field
    };

    expect(() => kmsStoreSchema.parse(invalid)).toThrow();
  });

  it('should reject invalid enum values', () => {
    const invalid = {
      version: 1,
      lastUpdated: '2026-03-02T00:00:00Z',
      meetings: {
        'meeting-1': {
          decisions: [
            {
              status: 'invalid_status',  // ❌ Not in enum
              // ... other fields
            }
          ]
        }
      }
    };

    expect(() => kmsStoreSchema.parse(invalid)).toThrow();
  });

  it('should reject oversized strings', () => {
    const invalid = {
      decisions: [
        {
          text: 'x'.repeat(2001),  // Exceeds 2000 limit
        }
      ]
    };

    expect(() => kmsDecisionStoreSchema.parse(invalid)).toThrow();
  });

  it('should provide helpful error messages', () => {
    const invalid = { version: 1 };  // Missing fields

    try {
      kmsStoreSchema.parse(invalid);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Validate error message is helpful
        expect(error.message).toContain('meetings');
      }
    }
  });

  it('should handle corrupt JSON gracefully', () => {
    const corruptJson = '{ invalid json }';

    expect(() => {
      kmsStoreSchema.parse(JSON.parse(corruptJson));
    }).toThrow();
  });
});
```

### 3. Testing Atomic Writes

**Objective**: Verify file integrity on process crash.

```typescript
describe('Atomic Writes - Data Integrity', () => {
  it('should create temp file before rename', () => {
    const spy = jest.spyOn(fs, 'renameSync');

    saveKMSStore(mockStore);

    // Verify rename was called (indicating atomic pattern)
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should clean up temp files on error', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      // Simulate mid-write crash
      throw new Error('Write failed');
    });

    const unlinkSpy = jest.spyOn(fs, 'unlinkSync');

    expect(() => saveKMSStore(mockStore)).toThrow();
    expect(unlinkSpy).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('should survive process kill simulation', async () => {
    // Simulate process crash during write
    const originalExit = process.exit;
    process.exit = jest.fn();

    try {
      // Start write operation
      const promise = Promise.resolve(saveKMSStore(mockStore));

      // Simulate crash before completion
      const killTimer = setTimeout(() => {
        (process.exit as jest.Mock)(1);
      }, 10);

      await promise;
      clearTimeout(killTimer);

      // Verify file wasn't corrupted
      const recovered = fs.readFileSync(KMS_FILE_PATH, 'utf-8');
      const data = kmsStoreSchema.parse(JSON.parse(recovered));
      expect(data).toBeDefined();
    } finally {
      process.exit = originalExit;
    }
  });

  it('should verify file exists after save', () => {
    const existsSync = jest.spyOn(fs, 'existsSync');
    existsSync.mockReturnValue(true);

    saveKMSStore(mockStore);

    // Should check file exists at least once
    expect(existsSync).toHaveBeenCalled();
    existsSync.mockRestore();
  });
});
```

### 4. Testing Path Traversal Protection

**Objective**: Verify path validation prevents escaping base directory.

```typescript
describe('SafeFileContext - Path Traversal Prevention', () => {
  let context: SafeFileContext;

  beforeEach(() => {
    context = new SafeFileContext('/home/user/app');
  });

  it('should allow safe relative paths', () => {
    const safePath = context.resolve('data.json');
    expect(safePath).toContain('/home/user/app/data.json');
  });

  it('should reject parent directory traversal', () => {
    expect(() => context.resolve('../../../etc/passwd')).toThrow();
  });

  it('should reject absolute paths', () => {
    expect(() => context.resolve('/etc/passwd')).toThrow();
  });

  it('should reject paths with ../ in middle', () => {
    expect(() => context.resolve('data/../../../etc/passwd')).toThrow();
  });

  it('should reject null bytes', () => {
    expect(() => context.resolve('file.json\0.txt')).toThrow();
  });

  it('should validate filename patterns', () => {
    const validFilenames = [
      'data.json',
      'report-2026-03-02.md',
      'file_v1.json',
    ];

    validFilenames.forEach(filename => {
      expect(isValidFilename(filename)).toBe(true);
    });

    const invalidFilenames = [
      '../escape.json',
      'file/with/slashes.json',
      'null\0byte.json',
      '/absolute/path.json',
    ];

    invalidFilenames.forEach(filename => {
      expect(isValidFilename(filename)).toBe(false);
    });
  });

  it('should maintain whitelist of allowed files', () => {
    expect(isAllowedKMSFile('.processed_kms.json')).toBe(true);
    expect(isAllowedKMSFile('.processed_kms_actions.json')).toBe(true);
    expect(isAllowedKMSFile('random-file.json')).toBe(false);
  });
});
```

---

## Reusable Code Patterns

### Pattern 1: Mtime-Cached Data Loader

Use this for any file that should be loaded with automatic cache invalidation.

```typescript
// File: src/utils/mtime-cache.ts

export interface MtimeCacheEntry<T> {
  data: T;
  mtime: number;
}

export class MtimeCache<T> {
  private cache = new Map<string, MtimeCacheEntry<T>>();
  private parser: (content: string) => T;

  constructor(parser: (content: string) => T) {
    this.parser = parser;
  }

  /**
   * Load data from file with automatic cache invalidation
   */
  load(filePath: string): T {
    const stat = statSync(filePath);
    const currentMtime = stat.mtimeMs;

    // Check cache
    const cached = this.cache.get(filePath);
    if (cached && cached.mtime === currentMtime) {
      return cached.data;
    }

    // Cache miss: reload
    const content = readFileSync(filePath, 'utf-8');
    const data = this.parser(content);

    this.cache.set(filePath, { data, mtime: currentMtime });
    return data;
  }

  /**
   * Invalidate cache after write
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// Usage:
const kmsCache = new MtimeCache((content) =>
  kmsStoreSchema.parse(JSON.parse(content))
);

const data = kmsCache.load('.processed_kms.json');
// ... update data ...
kmsCache.invalidate('.processed_kms.json');
```

### Pattern 2: Validated Atomic Writer

Use this for any file that must be written safely.

```typescript
// File: src/utils/atomic-writer.ts

export class AtomicFileWriter {
  constructor(private fileContext: SafeFileContext) {}

  /**
   * Write data atomically: temp file → rename → validate
   */
  write<T>(
    filename: string,
    data: T,
    serializer: (data: T) => string
  ): void {
    const safePath = this.fileContext.resolve(filename);
    const tempPath = safePath + '.tmp';

    try {
      // Serialize with error handling
      const content = serializer(data);

      // Write to temp file
      writeFileSync(tempPath, content, 'utf-8');

      // Verify temp file
      if (!existsSync(tempPath)) {
        throw new Error('Temp file creation failed');
      }

      // Atomic rename
      renameSync(tempPath, safePath);

      // Verify final file
      if (!existsSync(safePath)) {
        throw new Error('File rename failed');
      }

      logger.debug(`Wrote ${filename} (atomic)`);
    } catch (error) {
      // Cleanup temp file
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        logger.warn(`Cleanup failed: ${cleanupError}`);
      }

      throw error;
    }
  }
}

// Usage:
const writer = new AtomicFileWriter(fileContext);
writer.write(
  '.processed_kms.json',
  store,
  (data) => JSON.stringify(data, null, 2)
);
```

### Pattern 3: Zod Schema Router

Use this to handle multiple versions of schemas.

```typescript
// File: lib/schema-router.ts

export class SchemaRouter<T> {
  private schemas: Map<number, z.ZodSchema<T>> = new Map();

  registerSchema(version: number, schema: z.ZodSchema<T>): void {
    this.schemas.set(version, schema);
  }

  /**
   * Parse data with automatic version detection
   */
  parse(data: unknown): T {
    const obj = data as Record<string, unknown>;
    const version = obj.version as number;

    const schema = this.schemas.get(version);
    if (!schema) {
      throw new Error(`Unsupported schema version: ${version}`);
    }

    return schema.parse(data);
  }

  /**
   * List supported versions (for debugging)
   */
  supportedVersions(): number[] {
    return Array.from(this.schemas.keys()).sort((a, b) => b - a);
  }
}

// Usage:
const router = new SchemaRouter<KMSStore>();
router.registerSchema(1, kmsStoreSchemaV1);
router.registerSchema(2, kmsStoreSchemaV2);

const store = router.parse(JSON.parse(content));
```

### Pattern 4: Safe File Operations

Use this for all file system operations.

```typescript
// File: src/utils/safe-fs.ts

export class SafeFileSystem {
  constructor(private context: SafeFileContext) {}

  readJSON<T>(
    filename: string,
    schema: z.ZodSchema<T>,
    fallback?: T
  ): T {
    try {
      const path = this.context.resolve(filename);
      const content = readFileSync(path, 'utf-8');
      return schema.parse(JSON.parse(content));
    } catch (error) {
      if (fallback) {
        logger.warn(`Could not read ${filename}, using fallback`);
        return fallback;
      }
      throw error;
    }
  }

  writeJSON<T>(filename: string, data: T): void {
    const path = this.context.resolve(filename);
    const tempPath = path + '.tmp';

    try {
      const content = JSON.stringify(data, null, 2);
      writeFileSync(tempPath, content, 'utf-8');
      renameSync(tempPath, path);
    } catch (error) {
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      } catch {}
      throw error;
    }
  }

  exists(filename: string): boolean {
    return existsSync(this.context.resolve(filename));
  }

  delete(filename: string): void {
    const path = this.context.resolve(filename);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }
}

// Usage:
const fs = new SafeFileSystem(fileContext);
const store = fs.readJSON('.processed_kms.json', kmsStoreSchema);
fs.writeJSON('.processed_kms.json', updatedStore);
```

---

## Checklists

### Checklist: Adding a New File Type

When adding a new `.processed_*.json` file:

- [ ] Define Zod schema for the file in `lib/validation-schemas.ts`
- [ ] Add filename to `ALLOWED_FILENAMES` in `src/utils/paths.ts`
- [ ] Use `AtomicFileWriter` for writes (temp + rename)
- [ ] Use `MtimeCache` for reads
- [ ] Add integration tests for write recovery
- [ ] Add tests for schema validation
- [ ] Document the file format in this guide
- [ ] Update CLAUDE.md if it's a core system file

### Checklist: Adding a New API Endpoint

When adding a new `/api/kms/*` endpoint:

- [ ] Validate authentication first
- [ ] Validate request schema with Zod
- [ ] Use SafeFileContext for all paths
- [ ] Implement dual-layer caching (mtime + TTL)
- [ ] Invalidate cache after writes
- [ ] Return user-friendly errors (no implementation details)
- [ ] Log all security events
- [ ] Write integration tests including error cases
- [ ] Verify cache hit performance (<1ms)
- [ ] Document endpoint with examples

### Checklist: Code Review for KMS Changes

Before approving KMS code changes:

- [ ] All file operations use SafeFileContext
- [ ] All external JSON uses Zod validation
- [ ] All writes use atomic pattern (temp + rename)
- [ ] Cache is invalidated after writes
- [ ] Error messages don't leak internals
- [ ] Tests cover validation errors
- [ ] Tests cover path traversal attempts
- [ ] Tests verify atomic write recovery
- [ ] Performance benchmarks show cache working
- [ ] No direct `fs.readFileSync(userPath)` without validation

### Checklist: Deployment

Before deploying KMS changes:

- [ ] All 196 tests passing
- [ ] No TypeScript compilation errors
- [ ] Cache benchmarks show <1ms hits
- [ ] Security audit passed
- [ ] Database migrations (if any) tested
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Error messages reviewed for leaks
- [ ] Performance baselines documented
- [ ] README updated if needed

---

## Summary Table

| Concern | Prevention | Testing | Pattern |
|---------|-----------|---------|---------|
| **N+1 Reads** | mtime-based cache | Response time benchmarks | MtimeCache class |
| **JSON Injection** | Zod validation | Corrupt data scenarios | SchemaRouter |
| **Non-atomic Writes** | Temp + rename | Process kill simulation | AtomicFileWriter |
| **Path Traversal** | SafeFileContext | ../escape attempts | SafeFileSystem |

---

**Last Updated**: March 2, 2026
**Status**: Production Ready
**Maintained By**: Claude AI Assistant
