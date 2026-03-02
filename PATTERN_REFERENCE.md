# Pattern Reference Guide
**Design Patterns, Anti-Patterns & Best Practices for the Unified Transcript Analyzer**

---

## Quick Reference: Error Handling Patterns

### Pattern 1: Boundary Validation (Fail Fast)
**Location:** Entry points to major functions

```typescript
// ✅ CORRECT - Validate at system boundaries
export async function convertTranscripts(
  inputDir: string,
  processingDir: string
): Promise<ConversionStats> {
  // Validate input directories first
  const inputDirCheck = ensureDirectoryExists(inputDir);
  if (!inputDirCheck.valid) {
    logger.error(inputDirCheck.error!);
    return { /* stats with error */ };
  }

  // Now we know inputs are safe - proceed with processing
  const files = discoverTranscripts(inputDir);

  for (const file of files) {
    try {
      await convertSingleFile(file, processingDir, ...);
    } catch (error) {
      stats.failed++;
      logger.warn(`File failed: ${file}`, extractErrorMessage(error));
      // Continue processing next file
    }
  }

  return stats;
}
```

**Used In:**
- `cli.ts` - validateStartupRequirements() (lines 72-77)
- `converter.ts` - convertTranscripts() (lines 165-177)
- All validation utility functions

**When to Use:**
- CLI startup
- File I/O operations
- API endpoints
- Configuration loading

---

### Pattern 2: Graceful Degradation (Continue on Error)
**Location:** Batch processing loops

```typescript
// ✅ CORRECT - Single item failure doesn't halt batch
for (const file of filesToProcess) {
  const result = await convertSingleFile(file, processingDir, ...);

  if (result.success) {
    stats.successful++;
  } else {
    stats.failed++;
    if (result.error) {
      stats.errors.push(`${path.basename(file)}: ${result.error}`);
    }
  }
  // Always continue to next file
}
```

**Used In:**
- `converter.ts` lines 220-231
- `orchestrator.ts` analysis loop
- Manifest loading with corruption recovery

**When to Use:**
- Batch/bulk operations
- Data import/export
- Multi-file processing

---

### Pattern 3: Corruption Recovery
**Location:** Data persistence operations

```typescript
// ✅ CORRECT - Recover from corrupted data
loadManifest(): Manifest {
  try {
    if (!fs.existsSync(this.manifestPath)) {
      return { version: 1, last_run: new Date().toISOString(), processed_files: [] };
    }

    const content = fs.readFileSync(this.manifestPath, "utf-8");
    const manifest = JSON.parse(content) as Manifest;
    logger.debug(`Loaded manifest with ${manifest.processed_files.length} entries`);
    return manifest;
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.warn(`Manifest corrupted (JSON parse error), regenerating...`);
    } else {
      const message = extractErrorMessage(error);
      logger.warn(`Could not load manifest: ${message}, regenerating...`);
    }

    // Return fresh manifest instead of crashing
    return { version: 1, last_run: new Date().toISOString(), processed_files: [] };
  }
}
```

**Used In:**
- `manifest.ts` lines 43-71
- `kms/store.ts` lines 23-42
- All store loading operations

**When to Use:**
- Loading from disk
- JSON parsing
- Critical state recovery

---

## Quick Reference: Logging Patterns

### Pattern 1: Centralized Logger Usage
**Location:** All modules using logging

```typescript
// ✅ CORRECT - Consistent logger pattern
import { getLogger } from "../utils/logging";

const logger = getLogger();

logger.debug(`Processing file: ${filename}`);          // Detailed
logger.info(`✓ Converted: ${fileName}`);              // User-facing success
logger.warn(`File modified, will reconvert`);         // Recoverable issue
logger.error(`Error converting ${fileName}: ${msg}`); // Failure with context
```

**Used In:**
- All src/ files except fileHandler.ts (which needs fixing)

**Logger Levels:**
- `debug` - Implementation details, unimportant state
- `info` - User-visible operations
- `warn` - Recoverable issues, fallbacks
- `error` - Failures preventing progress

---

### Pattern 2: Context in Logs
**Location:** Complex operations with multiple variables

```typescript
// ✅ GOOD
logger.info(`Conversion complete`, {
  successful: stats.successful,
  failed: stats.failed,
  skipped: stats.already_processed,
  total: stats.total_found
});

// ✅ BETTER with object context
logger.debug(`File hash computed`, {
  file: path.basename(inputFile),
  hash: fileHash.substring(0, 8) + "...",
  size: stats.size
});
```

**Used In:**
- Validation results
- Manifest operations
- Processing statistics

---

## Quick Reference: State Management Patterns

### Pattern 1: Manifest-Based Caching
**Location:** File processing with change detection

```typescript
// ✅ CORRECT - Manifest tracks processing state
const manifestManager = new ManifestManager();
let manifest = manifestManager.loadManifest();

// Check if conversion needed
if (manifestManager.isConversionNeeded(file, manifest, force)) {
  // Do conversion
  await convertSingleFile(file, ...);

  // Record in manifest
  const fileHash = manifestManager.computeFileHash(file);
  manifestManager.recordConversion(manifest, inputFile, outputFile, fileHash);
}

// Save manifest after all changes
manifestManager.saveManifest(manifest);
```

**Components:**
- `ManifestManager.loadManifest()` - Load from disk with recovery
- `ManifestManager.isConversionNeeded()` - Check if file modified
- `ManifestManager.recordConversion()` - Update manifest
- `ManifestManager.saveManifest()` - Persist with atomic write

**Benefits:**
- Offline operation
- Change detection via MD5 hash
- Fast cache hits (<1ms)
- Per-model analysis caching

---

### Pattern 2: Per-Model Analysis Caching
**Location:** Analysis orchestration

```typescript
// ✅ CORRECT - Different models, separate caches
interface AnalysisCache {
  [model: string]: AnalysisCacheEntry;
}

interface ProcessedFile {
  input_file: string;
  output_file: string;
  conversions: ConversionState;
  analyses: AnalysisCache;  // Per-model cache
}

// Usage: Check if analysis cached for this model
const analyzed = manifestManager.isAnalysisNeeded(file, currentModel, manifest);
if (!analyzed) {
  logger.debug(`Cache hit for ${file} with ${currentModel}`);
  return; // Skip analysis
}
```

**Benefits:**
- Users can run Haiku (cheap) then Opus (quality)
- Each model has independent cache
- No duplicate API calls

---

## Quick Reference: Data Validation Patterns

### Pattern 1: Multi-Stage Validation
**Location:** File input processing

```typescript
// ✅ CORRECT - Validate all aspects before processing
function validateInputFile(filePath: string): { valid: boolean; error?: string } {
  try {
    // Stage 1: File exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: "File does not exist" };
    }

    const stats = fs.lstatSync(filePath);

    // Stage 2: Not a symlink (security)
    if (stats.isSymbolicLink()) {
      return { valid: false, error: "Symlinks not supported" };
    }

    // Stage 3: Is a regular file
    if (!stats.isFile()) {
      return { valid: false, error: "Not a regular file" };
    }

    // Stage 4: Is readable
    fs.accessSync(filePath, fs.constants.R_OK);

    // Stage 5: Within size limit
    if (stats.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File exceeds size limit` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: extractErrorMessage(error) };
  }
}
```

**Validation Functions:**
- `validateFile()` - Single file checks
- `validateDirectory()` - Directory checks
- `validateApiKey()` - Required API key
- `validateModelId()` - Model format
- `validateTotalSize()` - Batch size limit
- `ensureDirectoryExists()` - Create with verification

---

## Quick Reference: API Response Patterns

### Pattern 1: Consistent Error Response
**Location:** Next.js API routes

```typescript
// ✅ CORRECT - Consistent error handling in routes
export async function GET(request: NextRequest) {
  try {
    const kmsPath = path.join(process.cwd(), '.processed_kms.json');

    if (!fs.existsSync(kmsPath)) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

    // Process and return
    return NextResponse.json({
      total: decisions.length,
      filtered: filtered.length,
      decisions: filtered,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch decisions', details: String(error) },
      { status: 500 }
    );
  }
}
```

**Response Structure:**
- Success: `{ data... }`
- Not Found: `{ error: "...", status: 404 }`
- Server Error: `{ error: "...", details: "...", status: 500 }`

---

## Quick Reference: Type System Patterns

### Pattern 1: Centralized Type Definitions
**Location:** `src/types.ts`

```typescript
// ✅ CORRECT - All types in one location
export interface ConversionResult {
  success: boolean;
  markdown_content: string;
  metadata: TranscriptMetadata;
  errors?: string[];
}

export interface Manifest {
  version: 1;
  last_run: string;
  processed_files: ProcessedFile[];
}

export interface ConversionStats {
  total_found: number;
  successful: number;
  failed: number;
  exitCode: 0 | 1 | 2;
}
```

**Benefits:**
- Single source of truth
- Easy to find all related types
- Prevents duplicate definitions
- Simplifies refactoring

---

### Pattern 2: Literal Types for Status
**Location:** Types with specific values

```typescript
// ✅ CORRECT - Use literal types for constrained values
export interface KMSDecision {
  status: "pending" | "in-progress" | "completed";
}

export interface KMSActionItem {
  status: "not-started" | "in-progress" | "blocked" | "completed";
}

export interface ConversionStats {
  exitCode: 0 | 1 | 2;
}

export interface KMSRisk {
  severity: "low" | "medium" | "high";
}
```

**Benefits:**
- Compile-time validation
- IDE autocomplete
- Type-safe comparisons
- Self-documenting code

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Silent Error Suppression
**❌ DO NOT DO THIS:**
```typescript
try {
  await processFile(file);
} catch (error) {
  // Do nothing - suppressed silently
}
```

**✅ CORRECT:**
```typescript
try {
  await processFile(file);
} catch (error) {
  stats.failed++;
  logger.warn(`File failed: ${file}`, extractErrorMessage(error));
  // Continue with next file
}
```

---

### Anti-Pattern 2: Logging Bypass
**❌ DO NOT DO THIS:**
```typescript
// In src/analysis/fileHandler.ts
console.warn(`⚠️  Skipping ${path.basename(filePath)}: ${validation.error}`);
console.error(`❌ Error reading ${path.basename(filePath)}: ${errorMsg}`);
```

**✅ CORRECT:**
```typescript
import { getLogger } from "../utils/logging";

const logger = getLogger();
logger.warn(`Skipping file`, { file: path.basename(filePath), error: validation.error });
logger.error(`Error reading file`, { file: path.basename(filePath), error: errorMsg });
```

---

### Anti-Pattern 3: Duplicate Configuration
**❌ DO NOT DO THIS:**
```typescript
// src/utils/validation.ts
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);

// src/analysis/fileHandler.ts
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);
```

**✅ CORRECT:**
```typescript
// src/utils/config.ts
export const FILE_LIMITS = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10),
  maxTotalSize: parseInt(process.env.MAX_TOTAL_SIZE || "104857600", 10),
} as const;

// Usage everywhere:
import { FILE_LIMITS } from "../utils/config";
if (fileSize > FILE_LIMITS.maxFileSize) { ... }
```

---

### Anti-Pattern 4: Type Casting Abuse
**❌ AVOID WHEN POSSIBLE:**
```typescript
const message = await (client as any).messages.create({...});
```

**✅ BETTER (when cast is necessary):**
```typescript
// Add comment explaining why
const message = await (client as any).messages.create({
  // Anthropic SDK types not properly exported
  model,
  max_tokens: 2000,
  messages: [{ role: "user", content: prompt }],
});
```

---

## File Organization Best Practices

### Conversion Pipeline Structure
```
src/conversion/
├── converter.ts           # Main orchestration
├── metadata.ts            # Metadata extraction (Claude API)
├── manifest.ts            # State tracking & caching
└── __tests__/
    ├── metadata.test.ts
    └── manifest.test.ts
```

**File Responsibilities:**
- `converter.ts` - Coordinates .txt → .md pipeline
- `metadata.ts` - Extracts date/concepts from content
- `manifest.ts` - Tracks processing state and caching

---

### Analysis Pipeline Structure
```
src/analysis/
├── orchestrator.ts        # Coordinates analysis flow
├── synthesisCoordinator.ts # Combines agent outputs
├── reportGenerator.ts     # Formats markdown reports
├── agents/
│   ├── strategicAnalyst.ts
│   ├── stakeholderAnalyzer.ts
│   └── financialOpsAnalyzer.ts
└── fileHandler.ts         # ⚠️ Should move to utils
```

**File Responsibilities:**
- `orchestrator.ts` - Main analysis loop, reads .md files
- `agents/` - Specialist analysis functions
- `synthesisCoordinator.ts` - Combines agent outputs
- `reportGenerator.ts` - Formats combined results

---

### Utilities Structure
```
src/utils/
├── client.ts             # Anthropic API client singleton
├── logging.ts            # Logger implementation
├── validation.ts         # Input validation functions
├── parsing.ts            # JSON/text parsing utilities
├── config.ts             # Configuration constants (recommended)
├── errors.ts             # Error handling utilities (recommended)
├── persistence.ts        # Generic store operations (recommended)
└── __tests__/
    └── validation.test.ts
```

---

## Naming Convention Reference

### Functions

**Verbs with clear intent:**
- `extract*` - Pull data from source
- `validate*` - Check constraints/rules
- `read*` - Load from disk
- `save*` / `store*` - Persist to disk
- `load*` - Load from disk (recovery)
- `is*` - Boolean check
- `compute*` - Calculate/derive value
- `create*` - Instantiate new object
- `parse*` - Convert format
- `format*` - Prepare for output
- `sanitize*` - Clean/validate data
- `record*` - Log/track state

**Good Examples:**
```typescript
extractMetadata()           // Clear
validateFile()              // Clear
readMarkdownFiles()         // Clear
isConversionNeeded()        // Boolean, clear
computeFileHash()           // Clear
parseJSON<T>()              // Clear
sanitizeTranscriptContent() // Clear
recordConversion()          // Clear
```

---

### Variables

**Naming conventions:**
- `message` - Error or log message
- `error` - Caught exception
- `stats` - Statistics object
- `manifest` - Processing manifest
- `metadata` - Extracted metadata
- `filePath` / `file` - File path
- `fileName` - Just filename
- `dirPath` - Directory path
- `content` - Full file content
- `data` - Generic data

**Avoid:**
- `x`, `y`, `temp`, `foo`, `bar`
- Single letters except counters/loops
- Non-standard abbreviations

---

## Testing Pattern Reference

### Test Naming Convention
**Pattern:** `should [action] [condition] [expected result]`

```typescript
// ✅ CORRECT
test("should process simple transcript file end-to-end", () => {...})
test("should detect when file needs reconversion after modification", () => {...})
test("should skip analysis if cached", () => {...})
test("should handle corrupted manifest", () => {...})

// ❌ AVOID
test("test conversion", () => {...})
test("works", () => {...})
test("test1", () => {...})
```

---

### Test Structure
```typescript
describe("Feature Description", () => {
  // Setup
  beforeEach(() => {
    // Initialize test data
    tempDir = fs.mkdtempSync(...);
    manifestManager = new ManifestManager(tempDir);
  });

  // Cleanup
  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  // Tests
  test("should do something specific", () => {
    // Arrange
    const inputFile = path.join(tempDir, "test.txt");
    fs.writeFileSync(inputFile, "test content");

    // Act
    const result = await doSomething(inputFile);

    // Assert
    expect(result.success).toBe(true);
  });
});
```

---

## Configuration Pattern Reference

### Environment Variables

**Standard Pattern:**
```typescript
const VALUE = parseInt(process.env.VAR_NAME || "default", 10);
const STRING = process.env.STRING_VAR || "default";
const BOOL = process.env.BOOL_VAR === "true";
```

**Current Config:**
```bash
# Required
ANTHROPIC_API_KEY=sk_ant_...

# Optional with defaults
MODEL_ID=claude-haiku-4-5-20251001
MAX_FILE_SIZE=10485760         # 10MB
MAX_TOTAL_SIZE=104857600       # 100MB
LOG_LEVEL=info                 # debug|info|warn|error
```

---

## Summary Checklist

When adding new code, ensure:

- [ ] **Naming:** Clear, follows established conventions
- [ ] **Error Handling:** Validates at boundaries, recovers gracefully
- [ ] **Logging:** Uses centralized logger, never console.log
- [ ] **Types:** Defined in src/types.ts, no duplication
- [ ] **Testing:** Includes test with clear naming
- [ ] **Comments:** JSDoc for public functions
- [ ] **Duplication:** No copy-paste code (extract utility if needed)
- [ ] **Modules:** Respects established boundaries
- [ ] **Configuration:** Uses config module, not hardcoded
- [ ] **Imports:** Organized (stdlib, 3rd party, local)

---

**Last Updated:** March 2, 2026
