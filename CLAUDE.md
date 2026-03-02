# CLAUDE.md - Development Guidelines

This document provides architecture, conventions, and development guidance for the Unified Transcript Analyzer project.

## Quick Reference

- **Language:** TypeScript (Node.js 18+)
- **Package Manager:** npm
- **Testing:** Jest with ts-jest
- **Code Style:** Clarity over cleverness
- **API:** Anthropic (@anthropic-ai/sdk)

## Architecture Overview

### System Design

```
User Input (input/)
    ↓
[Conversion Pipeline]
  - Read .txt files
  - Extract date/concepts from content
  - Generate markdown with frontmatter
    ↓
Processing Files (processing/)
    ↓
[Manifest Manager]
  - Track file hashes (detect changes)
  - Cache per-model analyses
  - Persist state
    ↓
[Analysis Pipeline]
  - Three specialist agents
  - Send markdown to Claude
  - Generate strategic reports
    ↓
Output Reports (output/)
```

### Key Components

#### 1. Type System (src/types.ts)
Central location for all shared type definitions:
```typescript
// Metadata extracted from transcript
interface TranscriptMetadata {
  date: string;          // YYYY-MM-DD or "Unknown"
  concepts: string[];    // Key concepts/topics
}

// Result of file conversion
interface ConversionResult {
  inputFile: string;
  outputFile: string;
  metadata: TranscriptMetadata;
}

// State tracking structure
interface Manifest {
  version: number;
  last_run: string;      // ISO timestamp
  processed_files: ProcessedFile[];
}
```

#### 2. Conversion Pipeline (src/conversion/)

**converter.ts** - Main conversion logic
- `convertTranscripts()` - Full pipeline for .txt → .md
- `convertSingleFile()` - Per-file conversion with error handling
- Per-stage error handling (6 stages with rollback)

**metadata.ts** - Metadata extraction
- `extractMetadata()` - Uses Claude to extract date and concepts
- `createMarkdownContent()` - Generates markdown with YAML frontmatter
- Exponential backoff retry on timeouts/rate limits
- MAX_RETRIES = 3, RETRY_DELAY_MS = 1000 (exponential)

**manifest.ts** - State tracking
- `loadManifest()` - Load from disk, regenerate if corrupted
- `saveManifest()` - Persist with atomic write (temp → rename)
- `isConversionNeeded()` - Check file hash vs manifest
- `isAnalysisNeeded()` - Check if model has cached result
- `recordConversion()` - Update manifest after successful conversion
- `recordAnalysis()` - Track per-model analyses

#### 3. Analysis Pipeline (src/analysis/)

**orchestrator.ts** - Coordinates analysis
- `analyzeConvertedFiles()` - Main analysis loop
- Checks manifest before analysis
- Records results per-model

**agents/** - Specialist agents
- **Synthesizer**: Extract key points and recommendations
- **Strategist**: Strategic implications and long-term impact
- **Impact Analyst**: Measurable outcomes and success metrics

**synthesizer.ts** - Report generation
- Combines agent outputs
- Formats into markdown report

#### 4. Utilities (src/utils/)

**client.ts** - Anthropic API client
- `getClient()` - Singleton Anthropic instance
- `getModel()` - Returns current MODEL_ID

**validation.ts** - Input validation
- `validateFile()` - Check readability, size, no symlinks
- `validateDirectory()` - Check permissions
- `validateApiKey()` - Required minimum length
- `validateModelId()` - Must be Claude model

**logging.ts** - Structured logging
- Levels: debug, info, warn, error
- File + console output
- Context support

## Development Conventions

### Code Style

1. **Clarity First** - Code should be obvious what it does
2. **No Clever Tricks** - Use straightforward patterns
3. **Type Safety** - Prefer types over comments
4. **Error Handling at Boundaries** - Validate at system entry points only

### File Organization

```
src/
├── cli.ts              # Command routing (not orchestration)
├── index.ts            # Main entry point
├── types.ts            # All shared types (single source of truth)
├── conversion/
│   ├── converter.ts    # Pipeline coordination
│   ├── metadata.ts     # Metadata extraction
│   ├── manifest.ts     # State management
│   └── __tests__/      # Tests in same directory
├── analysis/
│   ├── orchestrator.ts # Analysis coordination
│   ├── agents/
│   │   ├── synthesizer.ts
│   │   ├── strategist.ts
│   │   └── impact_analyst.ts
│   └── synthesizer.ts  # Report generation
└── utils/
    ├── client.ts       # API client
    ├── logging.ts      # Logging
    ├── validation.ts   # Input validation
    └── __tests__/      # Tests
```

### Function Design

```typescript
// Good: Clear name, single responsibility
async function extractMetadata(content: string): Promise<TranscriptMetadata>

// Good: Side effects clear in name
function saveManifest(manifest: Manifest): void

// Bad: Does too much
async function processAndAnalyzeAndReport()

// Bad: Unclear what it does
async function doStuff(x: any): Promise<any>
```

### Error Handling

**Validate at Boundaries:**
```typescript
// In converter.ts (system entry point)
async function convertTranscripts(): Promise<ConversionStats> {
  const validation = validateStartupRequirements();
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Now we know inputs are safe
  // Handle errors gracefully for individual files
}
```

**Recover Gracefully in Pipelines:**
```typescript
// Single file failure shouldn't halt batch
for (const file of files) {
  try {
    await convertSingleFile(file);
  } catch (error) {
    stats.failed++;
    logger.warn(`Failed: ${file}`, error);
    // Continue with next file
  }
}
```

### Testing Patterns

**Unit Tests** - Single responsibility
```typescript
test("should compute consistent hash", () => {
  const hash1 = computeFileHash(file);
  const hash2 = computeFileHash(file);
  expect(hash1).toBe(hash2);
});
```

**Integration Tests** - Full pipeline
```typescript
test("should skip analysis if cached", () => {
  const manifest = manifestManager.loadManifest();
  manifestManager.recordAnalysis(manifest, file, model, report);

  const needed = manifestManager.isAnalysisNeeded(file, model, manifest);
  expect(needed).toBe(false);
});
```

**Edge Cases** - Boundary conditions
```typescript
test("should handle corrupted manifest", () => {
  fs.writeFileSync(manifestPath, "{ invalid json }");
  const manifest = manifestManager.loadManifest();
  expect(manifest.processed_files).toEqual([]);
});
```

## Key Technical Decisions

### 1. Manifest-Based State Management
**Decision:** Single `.processed_manifest.json` tracking both conversions and analyses

**Why:**
- Supports offline operation (no external state)
- Fast cache hits (<1ms)
- Per-model analysis caching without duplication

**Trade-off:** Must rebuild if manifest corrupts (handled automatically)

### 2. Per-Model Caching
**Decision:** Analyses cached by model name separately

**Why:**
- Users can run Haiku (cheap) then Opus (better quality)
- Each model has independent cache
- No duplicate API calls

**Manifest Structure:**
```json
{
  "analyses": {
    "claude-haiku-4-5-20251001": { "report_file": "report_haiku.md" },
    "claude-opus-4-6": { "report_file": "report_opus.md" }
  }
}
```

### 3. Exponential Backoff Retry
**Decision:** RETRY_DELAY_MS * Math.pow(2, retryCount)

**Why:**
- Handles API rate limiting gracefully
- Avoids overwhelming service during timeouts
- 3 retries: 1s, 2s, 4s = max 7 seconds total

**Configuration:**
- MAX_RETRIES = 3
- RETRY_DELAY_MS = 1000

### 4. Atomic Manifest Saves
**Decision:** Write to temp file, then rename

**Why:**
- Process crash during write won't corrupt manifest
- Rename is atomic at OS level
- Auto-recovery if rename fails

**Implementation:**
```typescript
fs.writeFileSync(tempPath, JSON.stringify(manifest));
fs.renameSync(tempPath, manifestPath);
```

### 5. Three Commands for Flexibility
**Decision:** Full pipeline vs. Convert-only vs. Analyze-only

**Commands:**
- `npm run analyze` - Full pipeline (99% of users)
- `npm run convert` - Inspect before analysis
- `npm run analyze-existing` - Reuse converted files

**Why:** Simplicity for most users, flexibility for power users

## CLI Commands

### Entry Point: src/cli.ts

Routing logic for commands:
```typescript
switch (command) {
  case "analyze":
    return await analyzeFullPipeline();
  case "convert":
    return await convertOnly();
  case "analyze-existing":
    return await analyzeOnlyPipeline();
}
```

### Three Public Commands

1. **npm run analyze**
   - Calls convertTranscripts()
   - Calls analyzeConvertedFiles()
   - Uses manifest to skip unchanged files
   - Time: 1-2 min per file

2. **npm run convert**
   - Calls convertTranscripts()
   - Skips analysis entirely
   - User can inspect processing/ directory
   - Time: <1 min per file

3. **npm run analyze-existing**
   - Skips conversion entirely
   - Reads from processing/ directory
   - Calls analyzeConvertedFiles()
   - Time: 1-2 min per file

## Type System

All types defined in `src/types.ts` (single source of truth):

```typescript
// Extracted metadata
interface TranscriptMetadata {
  date: string;
  concepts: string[];
}

// Conversion result
interface ConversionResult {
  inputFile: string;
  outputFile: string;
  metadata: TranscriptMetadata;
}

// Manifest structure
interface Manifest {
  version: number;
  last_run: string;
  processed_files: ProcessedFile[];
}

interface ProcessedFile {
  input_file: string;
  output_file: string;
  conversions: {
    file_hash: string;
    converted_at: string;
    source_file: string;
    output_file: string;
  };
  analyses: Record<string, {
    model: string;
    analyzed_at: string;
    report_file: string;
  }>;
}

// Statistics
interface ConversionStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  exitCode: 0 | 1 | 2;  // 0: all success, 1: partial, 2: all failed
}

interface AnalysisStats extends ConversionStats {
  exitCode: 0 | 1 | 2;
}
```

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk_ant_...

# Optional with defaults
MODEL_ID=claude-haiku-4-5-20251001
MAX_FILE_SIZE=10485760              # 10MB
MAX_TOTAL_SIZE=104857600            # 100MB
LOG_LEVEL=info                      # debug, info, warn, error
```

### Loading Order

1. .env file (if exists)
2. Environment variables
3. Hardcoded defaults

## Testing

### Test Structure

- **Unit tests**: Single module, fast, isolated
- **Integration tests**: Multi-module, full pipeline
- **Edge cases**: Boundary conditions and error scenarios

### Running Tests

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode during development
npm test -- --coverage  # Coverage report
```

### Test Coverage Targets

- >= 80% line coverage (measured by jest)
- All critical paths tested
- Edge cases covered

## Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| Single file | 1-2 min | ✓ Achieved |
| Cache hit | <1 sec | ✓ Achieved |
| 10-file batch | 10-20 min | ✓ Achieved |
| Model switch | ~30 sec | ✓ Achieved |

## Common Patterns

### Adding a New Feature

1. **Define types** in src/types.ts
2. **Write unit tests** first (TDD)
3. **Implement** following existing patterns
4. **Write integration tests** for pipeline impact
5. **Update manifest** if state needed
6. **Run full test suite** before committing

### Handling Errors

```typescript
// At entry point: validate inputs
const validation = validateFile(inputPath);
if (!validation.valid) {
  throw new Error(validation.error);
}

// In pipeline: recover gracefully
try {
  await processFile(file);
} catch (error) {
  stats.failed++;
  logger.warn(`File failed: ${file}`, error);
  // Continue processing
}

// Never: suppress errors silently
// try { doSomething(); } catch { }  // ❌ NO
```

### Adding a New Validation

1. Add function to src/utils/validation.ts
2. Export from types (if needed)
3. Use at system entry points only
4. Add tests to src/utils/__tests__/validation.test.ts

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run analyze

# Output in ~/.transcript-analyzer/logs.txt
```

### Check Manifest State

```bash
cat .processed_manifest.json | jq .
```

### Trace File Processing

```bash
# Add explicit logger calls
logger.debug(`Processing file: ${path}`);
logger.debug(`File hash: ${hash}`);
```

## Extending the System

### Adding a New Specialist Agent

1. Create src/analysis/agents/new_agent.ts
2. Implement interface matching existing agents
3. Add to synthesizer.ts coordination
4. Test with integration tests
5. Update documentation

### Adding Configuration Option

1. Add to .env.example
2. Load in src/utils/client.ts getConfig()
3. Use throughout system
4. Add validation if needed
5. Document in README

## Release Checklist

- [ ] All tests pass (79/79)
- [ ] No TypeScript errors
- [ ] README updated
- [ ] CLAUDE.md updated
- [ ] No console.log statements (use logger)
- [ ] Error messages are helpful
- [ ] Git history is clean

## References

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Jest**: https://jestjs.io/docs/getting-started
- **Anthropic API**: https://docs.anthropic.com/
- **Node.js**: https://nodejs.org/docs/

---

**Last Updated:** March 2, 2026
**Maintainer:** Claude AI Assistant
