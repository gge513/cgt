# Documented Solutions Quick Reference

**Project:** Unified Transcript Analyzer
**Last Updated:** March 2, 2026

---

## Three Key Solutions Documented

### 1. CLI Wiring & SDK Upgrade
**Status:** ✅ Fully Implemented
**File:** `docs/solutions/integration-issues/cli-wiring-and-sdk-dependency-upgrade.md`
**Key Issue Fixed:** Three CLI commands were stubbed with TODO comments
**Solution:** Wired commands to orchestration + upgraded SDK v0.13.1 → v0.78.0

**What to Remember:**
- All CLI commands route through orchestration functions
- `npm run analyze` = conversion + analysis
- `npm run convert` = conversion only
- `npm run analyze-existing` = analysis only
- SDK v0.78.0 provides stable `messages.create()` API

**When You Need This:** Adding new CLI commands or updating SDK

---

### 2. Next.js Integration
**Status:** ✅ Fully Implemented
**File:** `docs/solutions/integration-issues/next-web-dashboard-cli-integration.md`
**Key Issue Fixed:** Integrating web framework into CLI project without breaking tests or type safety
**Solution:** Unified tsconfig + minimal next.config + API routes boundary

**What to Remember:**
- Single `tsconfig.json` serves both CLI and web layers
- Path aliases `@/*` scoped to `app/` only (web layer)
- CLI code uses relative imports
- API routes handle file I/O (server-side only)
- Zustand for client UI state, file-based for CLI state

**Type System Split:**
```
src/types.ts    ← CLI layer types
app/types.ts    ← Web layer types (manually sync with src/types.ts)
```

**When You Need This:** Adding new web components or API routes

**Known Limitations:**
- Type definitions must be manually synchronized
- File-based state won't scale beyond ~1000 decisions
- Not suitable for serverless platforms

---

### 3. System Consolidation Pattern
**Status:** ✅ Production Ready
**File:** `docs/solutions/architecture_patterns/unified-transcript-analyzer-system-consolidation.md`
**Key Achievement:** Unified Python converter + Node.js analyzer into single TypeScript system
**Pattern:** Manifest-based state, per-model caching, atomic persistence

**7 Architectural Decisions:**

1. **Manifest-Based State** → `.processed_manifest.json` tracks all processing
2. **Per-Model Caching** → Separate cache for Haiku vs Opus (A/B testing support)
3. **File Hash Detection** → MD5-based change detection (only reprocess changed files)
4. **Atomic Writes** → Write-to-temp → rename (crash-safe)
5. **Exponential Backoff** → Retry API errors with 1s, 2s, 4s delays
6. **Three Commands** → Flexibility for different workflows
7. **Graceful Degradation** → One bad file doesn't halt batch

**When You Need This:** Understanding caching strategy, adding file processing, batch operations

---

## Pattern Quick Lookup

### Manifest Pattern
**Location:** `src/conversion/manifest.ts`
**What It Does:**
- Tracks file hashes for change detection
- Caches analyses per-model
- Auto-recovers from corruption

**Usage:**
```typescript
const manifest = manifestManager.loadManifest();
if (manifestManager.isConversionNeeded(file, manifest)) {
  // Reprocess file
}
```

**Key Files:**
- Input: `.processed_manifest.json`
- Source: `src/conversion/manifest.ts` (207 lines)
- Tests: 21 tests covering all scenarios

---

### Per-Model Caching
**Location:** `src/analysis/orchestrator.ts`
**What It Does:**
- Separate cache entries for each Claude model
- Enables cost optimization (Haiku cheaper than Opus)
- Supports A/B testing

**Manifest Structure:**
```json
{
  "analyses": {
    "claude-haiku-4-5-20251001": {
      "analyzed_at": "...",
      "report_file": "..."
    },
    "claude-opus-4-6": {
      "analyzed_at": "...",
      "report_file": "..."
    }
  }
}
```

**Usage:**
```bash
# Run with Haiku (cheap)
npm run analyze

# Run with Opus (expensive but better)
MODEL_ID=claude-opus-4-6 npm run analyze
```

---

### Exponential Backoff Retry
**Location:** `src/conversion/metadata.ts`
**Configuration:**
```typescript
MAX_RETRIES = 3
RETRY_DELAY_MS = 1000
// Attempts: 1s, 2s, 4s = max 7 seconds total
```

**When It's Used:**
- API timeouts
- Rate limiting
- Transient failures

**When It's NOT Used:**
- File I/O errors (permanent)
- Permission errors (permanent)
- Invalid API keys (permanent)

---

### Graceful Batch Error Recovery
**Location:** `src/conversion/converter.ts` and `src/analysis/orchestrator.ts`
**Exit Codes:**
- `0` = All files successful
- `1` = Partial success (some files failed)
- `2` = Complete failure (all files failed)

**Batch Resilience:**
```typescript
for (const file of files) {
  try {
    await processFile(file);
  } catch (error) {
    stats.failed++;
    logger.warn(`File failed: ${file}`);
    // Continue with next file
  }
}
```

---

### API Routes as Data Gateway
**Locations:** `app/api/kms/*`
**Pattern:**
```
CLI Layer → Writes .processed_kms_*.json files
      ↓
API Routes → Read files, serve via HTTP
      ↓
Web Components → Fetch via useQuery hooks
      ↓
User Validation → POST feedback to API
      ↓
Persistence → .processed_kms_validations.json
```

**Benefits:**
- Clear boundary between CLI and web
- Easy to migrate to database later
- No direct file access from browser

---

### Validation at Boundaries Only
**Location:** `src/cli.ts` entry point (lines 72-77)
**Pattern:**
1. Validate all inputs at system entry
2. Early exit with helpful error message
3. Downstream modules assume valid inputs

**Exit Code 2:** Indicates startup/validation failure

---

## Common Scenarios

### I Need to Add a New CLI Command
**Reference:** CLI Wiring Solution
**Steps:**
1. Add case in `src/cli.ts` switch statement
2. Call appropriate orchestration function
3. Set exit code (0/1/2)
4. Add tests in `src/__tests__/integration.test.ts`

**Files to Edit:**
- `src/cli.ts`
- Test file

---

### I Need to Add a Web Component
**Reference:** Next.js Integration Solution
**Steps:**
1. Create component in `app/[page]/components/YourComponent.tsx`
2. Use path alias: `import { useStore } from '@/lib/stores/...'`
3. Fetch data from API routes via `useQuery()`
4. Don't access files directly
5. Synchronize types if needed from `src/types.ts` to `app/types.ts`

**Files to Edit:**
- New component file
- `app/types.ts` (if new types needed)
- API route file (if new endpoint)

---

### I Need to Add an Analysis Agent
**Reference:** System Consolidation Solution
**Steps:**
1. Create `src/analysis/agents/newAgent.ts`
2. Implement interface matching existing agents
3. Add to `synthesisCoordinator.ts` in `Promise.all()`
4. Add tests in `src/analysis/__tests__/`

**Files to Edit:**
- New agent file
- `src/analysis/synthesizer.ts` (integrate results)
- Test file

---

### I Need to Change Caching Behavior
**Reference:** System Consolidation Solution
**Manifest-Based Caching:**
- Change detection: `src/conversion/manifest.ts` `computeFileHash()`
- Cache invalidation: `src/conversion/manifest.ts` `isConversionNeeded()`
- Per-model logic: `src/analysis/orchestrator.ts` `isAnalysisNeeded()`

**Key Decision:** MD5 hashing is currently used; specialist review suggests file stat check as optimization

---

### I Need to Handle API Errors Better
**Reference:** CLI Wiring Solution (Prevention Strategies section)
**Pattern:**
1. Always catch API errors with context
2. Log with file/operation details
3. For batch processing: count failed, continue
4. Set appropriate exit code

**Example:**
```typescript
try {
  const result = await client.messages.create(...);
} catch (error) {
  logger.error(`API call failed for file ${file}`, error);
  stats.failed++;
  // Continue processing other files
}
```

---

### I Need to Understand Type Safety Issues
**Reference:** System Consolidation Solution (Specialist Review section)
**Issues Identified:** 6+ instances of `(client as any)` type casts
**Impact:** Type checker can't validate API response handling
**Fix:** Replace with proper SDK types from `@anthropic-ai/sdk`

**Example:**
```typescript
// Bad: Any type cast
const message = await (client as any).messages.create({...});

// Good: Proper typing
import { Message } from "@anthropic-ai/sdk/resources";
const message: Message = await client.messages.create({...});
```

---

## Prevention Checklists

### Before Committing Code
- [ ] No TODO/FIXME in command handlers
- [ ] All console.log replaced with logger.* calls
- [ ] Tests updated/passing
- [ ] tsc --noEmit succeeds
- [ ] Exit codes properly set (0/1/2)

### Before Merging PR
- [ ] npm test passes (79/79)
- [ ] npm run lint succeeds
- [ ] npm run build succeeds
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Related solutions reviewed

### Before Deploying
- [ ] All tests passing
- [ ] Zero build warnings
- [ ] Manifest corruption recovery verified
- [ ] Error logging working
- [ ] Exit codes in CI/CD pipeline

---

## Key Configuration Files

| File | Purpose | Key Points |
|------|---------|-----------|
| `tsconfig.json` | TypeScript config | Unified for CLI + web, path aliases scoped |
| `next.config.js` | Next.js config | Minimal (no custom webpack/swcMinify) |
| `.env.example` | Configuration template | All environment variables documented |
| `package.json` | Dependencies | SDK pinned at 0.78.0 |
| `.processed_manifest.json` | Runtime state | Auto-created, atomic saves, corruption recovery |
| `CLAUDE.md` | Development guide | Type system, patterns, conventions |

---

## Performance Targets (Met ✅)

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Cache hit | <1s | <1s | ✅ |
| Single file | 1-2m | 1-2m | ✅ |
| 10 files (8 cached) | ~4m | ~4m | ✅ |
| Model switch | ~30s | ~30s | ✅ |

---

## When to Reference Each Solution

**CLI Wiring & SDK Upgrade Solution:**
- Adding new commands
- Updating SDK versions
- Debugging command routing issues
- Understanding KMS system integration

**Next.js Integration Solution:**
- Adding web components
- Fixing build errors
- Type system questions
- API route design
- Path alias issues

**System Consolidation Solution:**
- Understanding caching strategy
- Batch processing design
- Multi-agent architecture
- Performance optimization
- State management patterns

---

## Key Metrics

**Code Quality:**
- 3,000+ lines production code
- 1,200+ lines tests
- 79 tests, 100% pass rate
- ≥98% line coverage
- Zero TypeScript errors

**Performance:**
- Cache hit: <1 second
- Full pipeline: 1-2 min/file
- Batch (10 files): ~10-20 min
- Model switch: ~30 seconds

**Architecture:**
- 7 key design decisions documented
- 7 specialist agents (pluggable)
- 3 CLI commands (flexible)
- 2-layer type system (scoped)
- 1 manifest (idempotent)

---

## Critical Files Map

```
src/
├── cli.ts                    ← CLI routing (wired per Solution 1)
├── types.ts                  ← Type system source of truth
├── conversion/
│   ├── manifest.ts           ← Caching & state (Solution 3)
│   ├── metadata.ts           ← Exponential backoff (Solution 3)
│   └── converter.ts          ← Graceful degradation (Solution 3)
├── analysis/
│   ├── orchestrator.ts       ← Per-model caching (Solution 3)
│   └── agents/               ← Specialist agents (pluggable)
└── utils/
    ├── client.ts             ← API client
    ├── logging.ts            ← Structured logging
    └── validation.ts         ← Boundary validation

app/
├── types.ts                  ← Web types (sync with src/types.ts)
├── lib/stores/
│   └── validations.ts        ← Zustand state (Solution 2)
└── api/kms/                  ← API routes gateway (Solution 2)
```

---

## Document Locations

**Full Solutions (detailed reading):**
1. `docs/solutions/integration-issues/cli-wiring-and-sdk-dependency-upgrade.md` (640 lines)
2. `docs/solutions/integration-issues/next-web-dashboard-cli-integration.md` (1,120 lines)
3. `docs/solutions/architecture_patterns/unified-transcript-analyzer-system-consolidation.md` (695 lines)

**Supporting Documentation:**
- `CLAUDE.md` - Development conventions and architecture
- `KMS.md` - Knowledge Management System usage
- `SETUP.md` - Quick start guide
- `README.md` - User documentation
- `MEMORY.md` - Project status

**This Document:**
- `SOLUTIONS_QUICK_REFERENCE.md` (you are here)

**Comprehensive Analysis:**
- `SOLUTIONS_ANALYSIS_AND_CONSISTENCY_REPORT.md` (detailed consistency review)

---

## Next Steps

### To Understand System Architecture
1. Read `CLAUDE.md` (10 min)
2. Review `SOLUTIONS_QUICK_REFERENCE.md` (this file, 15 min)
3. Study `docs/solutions/architecture_patterns/unified-transcript-analyzer-system-consolidation.md` (30 min)

### To Start Development
1. Read `SETUP.md` for quick start
2. Check `CLAUDE.md` for conventions
3. Review relevant solution for your task
4. Reference type system in `src/types.ts`
5. Follow prevention checklist before commit

### To Understand Web Integration
1. Read `SOLUTIONS_QUICK_REFERENCE.md` Next.js section
2. Study `docs/solutions/integration-issues/next-web-dashboard-cli-integration.md`
3. Review `app/` directory structure
4. Check API route examples in `app/api/kms/`

---

**Status:** Ready for team reference
**Format:** Quick lookup guide
**Audience:** Developers, architects, new team members
