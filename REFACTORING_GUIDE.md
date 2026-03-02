# Refactoring Guide
**Step-by-step improvements for identified issues**

---

## Refactoring #1: Extract Error Message Utility
**Effort:** 1 hour
**Impact:** High - Reduces duplication, improves consistency

### Step 1: Create new file `src/utils/errors.ts`

```typescript
/**
 * Error handling utilities
 * Centralizes error message extraction and formatting
 */

/**
 * Extract error message from unknown error type
 * Handles Error objects, strings, and other types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract error message with optional context
 */
export function extractErrorDetails(
  error: unknown,
  context?: Record<string, any>
): { message: string; context?: Record<string, any> } {
  return {
    message: extractErrorMessage(error),
    context,
  };
}

/**
 * Format error for logging
 */
export function formatErrorForLog(
  context: string,
  error: unknown,
  details?: Record<string, any>
): { message: string; context?: Record<string, any> } {
  return {
    message: `${context}: ${extractErrorMessage(error)}`,
    context: details,
  };
}
```

### Step 2: Update imports in all files

**File 1: `src/cli.ts`**
```typescript
// Add import at top
import { extractErrorMessage } from "./utils/errors";

// Line 249: Replace
// Before:
const message = error instanceof Error ? error.message : String(error);

// After:
const message = extractErrorMessage(error);

// Usage:
logger.error(`Error: ${message}`);
```

**File 2: `src/conversion/converter.ts`**
```typescript
// Add import
import { extractErrorMessage } from "../utils/errors";

// Line 138: Replace in catch block
// Before:
const message = error instanceof Error ? error.message : String(error);

// After:
const message = extractErrorMessage(error);

// Line 139:
logger.error(`Error converting ${fileName}: ${message}`);
```

**File 3: `src/conversion/manifest.ts`**
```typescript
// Add import
import { extractErrorMessage } from "../utils/errors";

// Line 33: In computeFileHash
// Before:
const message = error instanceof Error ? error.message : String(error);

// After:
const message = extractErrorMessage(error);

// Line 93-94: In saveManifest
// Before:
const message = error instanceof Error ? error.message : String(error);

// After:
const message = extractErrorMessage(error);
```

**File 4: `src/conversion/metadata.ts`**
```typescript
// Add import
import { extractErrorMessage } from "../utils/errors";

// Line 133: In extractMetadata catch
// Before:
const message = error instanceof Error ? error.message : String(error);

// After:
const message = extractErrorMessage(error);
```

**File 5: `src/analysis/orchestrator.ts`**
```typescript
// Add import
import { extractErrorMessage } from "../utils/errors";

// Line 46: In catch block
// Before:
const message = error instanceof Error ? error.message : String(error);

// After:
const message = extractErrorMessage(error);
```

**File 6: `src/analysis/fileHandler.ts`**
```typescript
// Add import
import { extractErrorMessage } from "../utils/errors";

// Line 48: In validateInputFile
// Before:
const msg = error instanceof Error ? error.message : "Unknown error";

// After:
const msg = extractErrorMessage(error);

// Line 76: In readTranscriptFile
// Before:
const errorMsg = error instanceof Error ? error.message : "Unknown error";

// After:
const errorMsg = extractErrorMessage(error);

// Line 147: In readAllTranscripts
// Before:
const errorMsg = error instanceof Error ? error.message : "Unknown error";

// After:
const errorMsg = extractErrorMessage(error);

// Line 169: In writeReport
// Before:
const errorMsg = error instanceof Error ? error.message : "Unknown error";

// After:
const errorMsg = extractErrorMessage(error);
```

### Step 3: Run tests
```bash
npm test
# Should pass with no changes
```

---

## Refactoring #2: Consolidate Configuration
**Effort:** 30 minutes
**Impact:** Medium - Single source of truth for limits

### Step 1: Create `src/utils/config.ts`

```typescript
/**
 * Centralized configuration management
 * All environment-based configuration in one place
 */

/**
 * File size limits (configurable via environment)
 */
export const FILE_LIMITS = {
  /**
   * Maximum size of a single file (default: 10MB)
   */
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10),

  /**
   * Maximum total size of all input files (default: 100MB)
   */
  maxTotalSize: parseInt(process.env.MAX_TOTAL_SIZE || "104857600", 10),
} as const;

/**
 * API configuration
 */
export const API_CONFIG = {
  /**
   * Claude model to use (default: Haiku)
   */
  modelId: process.env.MODEL_ID || "claude-haiku-4-5-20251001",

  /**
   * Anthropic API key (required)
   */
  apiKey: process.env.ANTHROPIC_API_KEY || "",
} as const;

/**
 * Logging configuration
 */
export const LOG_CONFIG = {
  /**
   * Logging level (debug, info, warn, error)
   */
  level: (process.env.LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",

  /**
   * Log file path
   */
  filePath: process.env.LOG_FILE || ".pipeline.log",
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
  /**
   * Minimum API key length
   */
  minApiKeyLength: 20,
} as const;
```

### Step 2: Update `src/utils/validation.ts`

```typescript
// Add import at top
import { FILE_LIMITS, API_CONFIG, VALIDATION_LIMITS } from "./config";

// Line 13-14: Replace
// Before:
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);
const MAX_TOTAL_SIZE = parseInt(process.env.MAX_TOTAL_SIZE || "104857600", 10);

// After:
const MAX_FILE_SIZE = FILE_LIMITS.maxFileSize;
const MAX_TOTAL_SIZE = FILE_LIMITS.maxTotalSize;

// Line 116: Replace
// Before:
if (apiKey.length < 20) {

// After:
if (apiKey.length < VALIDATION_LIMITS.minApiKeyLength) {

// Line 201: Replace
// Before:
const modelId = process.env.MODEL_ID || "claude-haiku-4-5-20251001";

// After:
const modelId = API_CONFIG.modelId;
```

### Step 3: Update `src/analysis/fileHandler.ts`

```typescript
// Add import at top
import { FILE_LIMITS } from "../utils/config";

// Line 6-9: Replace
// Before:
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760");
const MAX_TOTAL_SIZE = parseInt(
  process.env.MAX_TOTAL_SIZE || "104857600"
);

// After:
const MAX_FILE_SIZE = FILE_LIMITS.maxFileSize;
const MAX_TOTAL_SIZE = FILE_LIMITS.maxTotalSize;
```

### Step 4: Run tests
```bash
npm test
# Should pass with no changes
```

---

## Refactoring #3: Fix Logging in fileHandler.ts
**Effort:** 1 hour
**Impact:** High - Unified logging across codebase

### File: `src/analysis/fileHandler.ts`

```typescript
/**
 * Complete replacement of logging calls
 * Replace all console.* with logger.*
 */

// Add import at top (after other imports)
import { getLogger } from "../utils/logging";

// Add logger instance after imports
const logger = getLogger();

// Line 58: Replace
// Before:
console.warn(`⚠️  Skipping ${path.basename(filePath)}: ${validation.error}`);

// After:
logger.warn(`Skipping file`, {
  file: path.basename(filePath),
  error: validation.error
});

// Line 77-78: Replace
// Before:
console.error(
  `❌ Error reading ${path.basename(filePath)}: ${errorMsg}`
);

// After:
logger.error(`Error reading file`, {
  file: path.basename(filePath),
  error: errorMsg
});

// Line 86-87: Replace
// Before:
console.warn(`⚠️  File is empty: ${fileName}`);

// After:
logger.warn(`File is empty`, { file: fileName });

// Line 113-114: Replace
// Before:
console.warn(
  `⚠️  Total input size (${totalSize} bytes) exceeds limit (${MAX_TOTAL_SIZE} bytes). Stopping.`
);

// After:
logger.warn(`Total input size exceeds limit`, {
  totalSize,
  maxTotalSize: MAX_TOTAL_SIZE
});

// Line 134-135: Replace
// Before:
console.warn(
  `\n⚠️  Failed to read ${errors.length} file(s) (see above for details)\n`
);

// After:
logger.warn(`Failed to read files`, { count: errors.length });

// Line 148: Replace
// Before:
console.error(`❌ Error reading transcripts: ${errorMsg}`);

// After:
logger.error(`Error reading transcripts`, { error: errorMsg });

// Line 167: Replace
// Before:
console.log(`✓ Report saved: ${outputPath}`);

// After:
logger.info(`Report saved`, { path: outputPath });

// Line 170: Replace
// Before:
console.error(`❌ Error writing report: ${errorMsg}`);

// After:
logger.error(`Error writing report`, { error: errorMsg });
```

### Verification
```bash
# Run tests
npm test

# Check logs appear in .pipeline.log
cat .pipeline.log

# Should see messages formatted consistently
```

---

## Refactoring #4: Extract Persistence Utility
**Effort:** 2 hours
**Impact:** High - Reduces 60+ lines of duplication

### Step 1: Create `src/utils/persistence.ts`

```typescript
/**
 * Generic JSON store persistence utility
 * Reduces duplication across manifest, KMS, and API routes
 */

import * as fs from "fs";
import { Logger } from "./logging";

/**
 * Configuration for JSON store
 */
export interface JsonStoreConfig<T> {
  /**
   * Path to store file
   */
  filePath: string;

  /**
   * Factory function to create default/empty store
   */
  defaultFactory: () => T;

  /**
   * Optional logger instance
   */
  logger?: Logger;

  /**
   * Optional callback on load error
   */
  onLoadError?: (error: Error) => void;

  /**
   * Optional callback on save error
   */
  onSaveError?: (error: Error) => void;
}

/**
 * Generic JSON store with load/save operations
 * Handles corruption recovery and file I/O errors
 */
export class JsonStore<T> {
  private config: JsonStoreConfig<T>;
  private data: T;

  constructor(config: JsonStoreConfig<T>) {
    this.config = config;
    this.data = this.load();
  }

  /**
   * Load store from disk
   * Returns default store if file doesn't exist or is corrupted
   */
  private load(): T {
    try {
      if (!fs.existsSync(this.config.filePath)) {
        this.config.logger?.debug(`Store file not found: ${this.config.filePath}`);
        return this.config.defaultFactory();
      }

      const content = fs.readFileSync(this.config.filePath, "utf-8");
      const parsed = JSON.parse(content) as T;
      this.config.logger?.debug(`Loaded store from ${this.config.filePath}`);
      return parsed;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (error instanceof SyntaxError) {
        this.config.logger?.warn(`Store corrupted (JSON parse error), regenerating...`);
      } else {
        this.config.logger?.warn(`Could not load store: ${err.message}, using defaults`);
      }

      this.config.onLoadError?.(err);
      return this.config.defaultFactory();
    }
  }

  /**
   * Save store to disk
   */
  save(): void {
    try {
      fs.writeFileSync(
        this.config.filePath,
        JSON.stringify(this.data, null, 2),
        "utf-8"
      );
      this.config.logger?.debug(`Store saved to ${this.config.filePath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.config.logger?.error(`Failed to save store: ${err.message}`);
      this.config.onSaveError?.(err);
    }
  }

  /**
   * Get current store data
   */
  getData(): T {
    return this.data;
  }

  /**
   * Set store data (and save)
   */
  setData(data: T): void {
    this.data = data;
    this.save();
  }

  /**
   * Update store data with partial update
   */
  update(updates: Partial<T>): void {
    this.data = { ...this.data, ...updates };
    this.save();
  }

  /**
   * Reload store from disk
   */
  reload(): void {
    this.data = this.load();
  }
}
```

### Step 2: Refactor `src/conversion/manifest.ts`

```typescript
// Add import
import { JsonStore, JsonStoreConfig } from "../utils/persistence";

// Replace ManifestManager.loadManifest() with:
private loadManifest(): Manifest {
  return this.store.getData();
}

// Replace ManifestManager.saveManifest() with:
saveManifest(manifest: Manifest): void {
  manifest.last_run = new Date().toISOString();
  this.store.setData(manifest);
}

// Add to constructor:
private store: JsonStore<Manifest>;

constructor(workingDir: string = process.cwd()) {
  this.manifestPath = path.join(workingDir, MANIFEST_FILE);
  this.tempPath = path.join(workingDir, MANIFEST_TEMP_FILE);

  this.store = new JsonStore<Manifest>({
    filePath: this.manifestPath,
    defaultFactory: () => ({
      version: 1,
      last_run: new Date().toISOString(),
      processed_files: [],
    }),
    logger: getLogger(),
  });
}
```

### Step 3: Refactor `src/kms/store.ts`

```typescript
// Add import
import { JsonStore } from "../utils/persistence";

// Replace loadStore() with:
private store: JsonStore<KMSStore>;

constructor() {
  this.store = new JsonStore<KMSStore>({
    filePath: KMS_STORE_PATH,
    defaultFactory: () => ({
      version: 1,
      lastUpdated: new Date().toISOString(),
      meetings: {},
    }),
    logger: getLogger(),
  });
}

// Replace saveStore() with:
saveStore(): void {
  const store = this.store.getData();
  store.lastUpdated = new Date().toISOString();
  this.store.setData(store);
}

// Replace getStore() with:
getStore(): KMSStore {
  return this.store.getData();
}
```

### Step 4: Refactor `app/api/kms/actions/route.ts`

```typescript
// Add import at top
import { JsonStore } from '@/app/lib/utils/persistence';

// Replace loadActions/saveActions with:
const actionsStore = new JsonStore<ActionsStore>({
  filePath: ACTIONS_PATH,
  defaultFactory: () => ({
    version: 1,
    lastUpdated: new Date().toISOString(),
    actions: [],
  }),
});

// In POST handler:
const store = actionsStore.getData();
// ... process
actionsStore.setData(store);

// In GET handler:
const store = actionsStore.getData();
return NextResponse.json({...store});
```

### Step 5: Run tests and verify
```bash
npm test
# All tests should pass

# Verify no console logs in .pipeline.log
cat .pipeline.log | grep -v "^\[.*\]" | head -5
# Should show no output (all lines start with timestamp)
```

---

## Refactoring #5: Move fileHandler.ts
**Effort:** 15 minutes
**Impact:** Low - Improves code organization

### Steps

1. **Copy file**
```bash
cp src/analysis/fileHandler.ts src/utils/fileHandler.ts
```

2. **Update imports in the moved file**
```typescript
// In src/utils/fileHandler.ts, update imports:
import { getLogger } from "./logging";
import { FILE_LIMITS } from "./config";
// (from relative paths like ../utils/logging to ./logging)
```

3. **Update any imports in src/analysis/** (if used)
```typescript
// No current imports in src/analysis/, but if added:
// import { readTranscriptFile } from "../utils/fileHandler";
// instead of:
// import { readTranscriptFile } from "./fileHandler";
```

4. **Delete original file**
```bash
rm src/analysis/fileHandler.ts
```

5. **Update exports in src/utils/index.ts** (if it exists)
```typescript
export * from "./fileHandler";
export * from "./logging";
export * from "./validation";
export * from "./parsing";
export * from "./config";
export * from "./errors";
export * from "./persistence";
```

6. **Run tests**
```bash
npm test
```

---

## Implementation Order

### Phase 1 (Day 1) - High Priority
1. **Extract Error Message Utility** (1h) - Reduces duplication
2. **Fix Logging in fileHandler.ts** (1h) - Unified logging
3. **Consolidate Configuration** (0.5h) - Single source of truth

**Total: 2.5 hours**
**Result:** More consistent, easier to maintain

### Phase 2 (Day 2) - Medium Priority
4. **Extract Persistence Utility** (2h) - Reduces duplication
5. **Move fileHandler.ts** (0.25h) - Better organization

**Total: 2.25 hours**
**Result:** DRY principle, better separation of concerns

### Verification
```bash
# After all refactoring
npm test                    # All tests pass
npm run analyze            # Full pipeline works
cat .pipeline.log          # All logs properly formatted
```

---

## Checking Your Work

### Before Refactoring
```bash
# Count duplication patterns
grep -r "error instanceof Error" src/ | wc -l
# Output: 8

# Check console usage
grep -r "console\." src/ | wc -l
# Output: 10
```

### After Refactoring
```bash
# Error message extraction consolidated
grep -r "extractErrorMessage" src/ | wc -l
# Output: 10 (imports + usage)

# Console usage eliminated from src/
grep -r "console\." src/ | grep -v ".test.ts" | wc -l
# Output: 0

# Logger used everywhere
grep -r "logger\." src/ | wc -l
# Output: ~50+ (from 25 before)
```

---

## Risk Mitigation

### Testing Strategy
1. Run tests after each refactoring: `npm test`
2. Verify no new console logs
3. Check .pipeline.log formatting
4. Run full CLI pipeline: `npm run analyze`

### Rollback Plan
```bash
# If something breaks, revert:
git checkout <file>

# Or revert entire refactoring:
git revert <commit-hash>
```

### Code Review Checklist
- [ ] All tests passing
- [ ] No new console.* calls
- [ ] Imports updated correctly
- [ ] No breaking changes
- [ ] Documentation updated
- [ ] Performance unchanged

---

**Estimated Total Effort:** 4-5 hours
**Expected Impact:** +15% maintainability improvement

