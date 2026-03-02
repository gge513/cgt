# Architecture Quick Reference

## System Overview

```
User Input → Conversion Pipeline → Analysis Pipeline → Web Dashboard
  (input/)      (processing/)        (output/ + KMS)    (Next.js)
```

## Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|---|
| **CLI** | `src/cli.ts` | Command routing (analyze, convert, analyze-existing) |
| **Conversion** | `src/conversion/` | Transform .txt → .md with metadata extraction |
| **Analysis** | `src/analysis/` | Multi-agent analysis with specialist agents |
| **KMS** | `src/kms/` | Knowledge extraction and relationship inference |
| **Web** | `app/` | Dashboard, decisions explorer, KMS viewer |

## Architecture Principles

### What's Working Well ✓

1. **Clean separation of concerns** - CLI and web are completely independent
2. **Centralized types** - src/types.ts is source of truth (mostly)
3. **Atomic state management** - Manifest uses temp file + rename pattern
4. **Type safety** - TypeScript strict mode enabled throughout
5. **Error recovery** - Graceful handling of file-level failures

### What Needs Fixing ⚠️

1. **File I/O in API routes** - All 5 API routes duplicate file reading code
2. **Orchestrator complexity** - 320-line file handles too many concerns
3. **Type duplication** - InferredRelationship defined in two places
4. **CLI duplication** - Three commands have nearly identical code
5. **No agent interface** - Adding agents requires internal modifications

## Critical Files

| File | Quality | Purpose |
|------|---------|---------|
| `src/conversion/manifest.ts` | ✓ Excellent | State management with atomic writes |
| `src/analysis/orchestrator.ts` | ⚠️ Needs refactoring | Handles too many concerns (320 lines) |
| `src/types.ts` | ~ Good | Types defined here (app/types.ts duplicates!) |
| `app/api/kms/*.ts` | ⚠️ Tight coupling | All routes directly access filesystem |
| `src/conversion/converter.ts` | ✓ Good | Clean orchestration of conversion |

## Coupling Analysis

### Between Layers

| Path | Status | Notes |
|------|--------|-------|
| CLI → Conversion | ✓ Clean | Function calls with clear contracts |
| CLI → Analysis | ✓ Clean | Passes options and manifest |
| Conversion → Analysis | ✓ Clean | File-based (processing/) |
| Analysis → KMS | ~ Mixed | Data extraction, but currently in orchestrator |
| Web → CLI | ✓ None | Good separation via file system |
| Web → File System | ⚠️ Tight | API routes duplicate file I/O code |

### Circular Dependencies

**Status:** NONE DETECTED ✓

## State Files

| File | Managed By | Format | Atomicity |
|------|-----------|--------|-----------|
| `.processed_manifest.json` | ManifestManager | JSON | ✓ Atomic (temp+rename) |
| `.processed_kms.json` | KMSStoreManager | JSON | ✗ Direct write |
| `.processed_kms_inferred.json` | orchestrator.ts | JSON | ✗ Direct write |
| `.processed_kms_actions.json` | API route | JSON | ✗ Direct write |

## Extension Points

### Easy to Extend
- **New analysis output format** - Add to reportGenerator.ts
- **New web page** - Create app/newpath/page.tsx
- **New validation rule** - Add to utils/validation.ts

### Hard to Extend
- **New specialist agent** - Requires orchestrator changes
- **New pipeline stage** - CLI has hardcoded stages
- **Change state schema** - No versioning mechanism

## Key Patterns

| Pattern | Location | Quality |
|---------|----------|---------|
| Manifest-based caching | manifest.ts | ✓ Excellent |
| Multi-agent analysis | agents/ + coordinator | ~ Good |
| Orchestration | cli.ts, orchestrator.ts | ~ Good (has duplication) |
| Factory/Builder | metadata.ts, reportGenerator.ts | ✓ Good |
| Adapter | API routes | ~ Emerging (leaky abstraction) |

## Immediate Actions (Next Sprint)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| CRITICAL | Create KMS file store abstraction | 2-3h | Fixes API coupling |
| HIGH | Extract orchestrator stages | 4-5h | Reduces complexity |
| HIGH | Consolidate types | 1h | Eliminates duplication |
| MEDIUM | Add shared enums | 1h | Improves consistency |

## Scalability Limits

| Metric | Current | Limit | Solution |
|--------|---------|-------|----------|
| Files | 10-100 | 1,000 | Manifest caching works |
| Decisions | <1,000 | 1,000 | API file I/O becomes slow |
| Meetings | <100 | 100 | File I/O overhead grows |

**Beyond 1,000 decisions:** Plan for database migration

## Code Examples

### Good: Atomic Manifest Save
```typescript
// src/conversion/manifest.ts
fs.writeFileSync(this.tempPath, JSON.stringify(manifest));
fs.renameSync(this.tempPath, this.manifestPath);  // Atomic!
```

### Bad: Non-atomic KMS Mutation
```typescript
// app/api/kms/actions/route.ts
fs.writeFileSync(kmsPath, JSON.stringify(kmsStore));  // NOT atomic
```

### Good: Error Recovery in Pipeline
```typescript
// src/conversion/converter.ts
for (const file of filesToProcess) {
  const result = await convertSingleFile(file);
  if (result.success) stats.successful++;
  else { stats.failed++; continue; }  // Continue on error
}
```

### Bad: Type Duplication
```typescript
// Defined in BOTH:
// - src/types.ts (line 309-324)
// - app/types.ts (line 3-18)
export interface InferredRelationship { ... }
```

## Testing Strategy

- **Unit tests:** Single module in isolation (manifest, metadata)
- **Integration tests:** Full pipeline (conversion + analysis)
- **Snapshot tests:** Report generation
- **Currently:** 79 tests passing, 100% pass rate

## Type System

**Strength:** Strict TypeScript with centralized definitions
**Weakness:** Partial duplication between src/types.ts and app/types.ts

**Path aliases:**
```json
{
  "@/*": ["./app/*"]  // app layer only
  // Missing: @core/* for src/
}
```

## Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| Single file conversion | 30-60s | ✓ Achieved |
| Single file analysis | 60-120s | ✓ Achieved |
| Manifest cache hit | <1ms | ✓ Achieved |
| Batch (10 files) | 10-20 min | ✓ Achieved |

---

## Key Decisions & Rationales

| Decision | Location | Rationale | Trade-off |
|----------|----------|-----------|-----------|
| Manifest-based caching | manifest.ts | Offline operation, no DB | Must rebuild if corrupted |
| Per-model analysis cache | manifest.ts | Supports model flexibility | Manifest size grows |
| File system state | .processed_*.json | Simple, no dependencies | File I/O for every API call |
| Three separate commands | cli.ts | Flexibility for power users | Code duplication |
| Multi-agent pattern | agents/ | Separation of concerns | No agent interface/registry |

---

## Red Flags for Refactoring

| Flag | Location | Severity |
|------|----------|----------|
| 320-line file with 7 responsibilities | orchestrator.ts | HIGH |
| Code duplication in 3 command handlers | cli.ts | MEDIUM |
| Identical file I/O in 5 API routes | app/api/kms/* | HIGH |
| Type definitions in 2 files | src/types.ts + app/types.ts | MEDIUM |
| Direct filesystem mutations in API | app/api/kms/actions | HIGH |

---

Last Updated: March 2, 2026
