# System Flow Diagrams & State Machines

**Purpose:** Visual representation of flows, state transitions, and failure modes

---

## 1. Full Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ npm run analyze (Full Pipeline: Convert + Analyze + Report)     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────┐
    │  DISCOVERY PHASE    │
    │  Scan input/*.txt   │
    └─────────────────────┘
         │
    Found 0 files? ──YES──> WARN: Empty input/ → EXIT
         │
        NO
         │
         ▼
    ┌──────────────────────────────────────┐
    │  CONVERSION PHASE                    │
    │  For each .txt file:                 │
    │  1. Check manifest for prior work    │
    │  2. If new/modified: CONVERT         │
    │  3. Extract date + concepts (API)    │
    │  4. Write .md to output/             │
    │  5. Update manifest                  │
    └──────────────────────────────────────┘
         │
    Error on file? ──YES──> ? SKIP / RETRY / HALT ?
         │                    (UNDEFINED)
        NO (or partial success)
         │
         ▼
    ┌──────────────────────────────────────┐
    │  STAGING PHASE                       │
    │  Move output/*.md → processing/      │
    │  (Or stay in output/?)               │
    │  (SPEC UNCLEAR)                      │
    └──────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────┐
    │  ANALYSIS PHASE                      │
    │  For each .md in processing/:        │
    │  1. Read file                        │
    │  2. Parse YAML frontmatter           │
    │  3. Run multi-agent analysis         │
    │  4. Generate report_[MODEL].md       │
    │  5. Update analysis manifest         │
    └──────────────────────────────────────┘
         │
    Error on file? ──YES──> ? SKIP / HALT / PARTIAL REPORT ?
         │                    (UNDEFINED)
        NO (or partial success)
         │
         ▼
    ┌──────────────────────────────────────┐
    │  OUTPUT PHASE                        │
    │  Move processing/*.md → output/      │
    │  Ensure report is in output/         │
    └──────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────┐
    │  COMPLETION                          │
    │  ✓ Files processed: N                │
    │  ✓ Report: output/report_haiku.md    │
    │  ✓ Manifests updated                 │
    └──────────────────────────────────────┘

DECISION POINTS (UNSPECIFIED):
  • [A] If 0 files discovered: Fail or warn and exit?
  • [B] If conversion fails on some files: Skip and continue, or halt?
  • [C] What happens to processing/ directory after analysis?
  • [D] If analysis fails on some files: Generate partial report or halt?
  • [E] Success criteria: All files succeed, or partial success OK?
```

---

## 2. Model Switching & Caching Flow

```
Run 1: MODEL_ID=claude-haiku-4-5-20251001 npm run analyze
  │
  ▼
┌──────────────────────────────────────┐
│ Check analysis cache for Haiku       │
│ Cache key = ? (UNDEFINED)            │
└──────────────────────────────────────┘
  │
  ├─MISS─> Run 3 agents in parallel
  │         Haiku analysis on files A,B,C
  │         Generate report_haiku.md
  │         Save to .analysis-manifest-haiku.json
  │
  └─HIT──> Return cached report_haiku.md (instant)

                            30 minutes later...

Run 2: MODEL_ID=claude-opus-4-6 npm run analyze
  │
  ▼
┌──────────────────────────────────────┐
│ Check analysis cache for Opus        │
│ Cache key = ? (UNDEFINED)            │
└──────────────────────────────────────┘
  │
  ├─MISS─> Run 3 agents in parallel
  │         Opus analysis on files A,B,C
  │         Generate report_opus.md
  │         Save to .analysis-manifest-opus.json
  │
  └─HIT──> Return cached report_opus.md (instant)

                            User modifies file B...

Run 3: MODEL_ID=claude-haiku-4-5-20251001 npm run analyze
  │
  ▼
┌──────────────────────────────────────┐
│ Check analysis cache for Haiku       │
│ File B was modified!                 │
│ Cache invalidation = ? (UNDEFINED)   │
└──────────────────────────────────────┘
  │
  ├─INVALIDATE─> Re-run analysis
  │               Updated report_haiku.md
  │
  └─USE STALE──> Return old report_haiku.md (WRONG!)


QUESTIONS:
  • How to detect if cache is stale?
  • Should cache key include file hashes?
  • What if file modified between model runs?
  • Should both caches be cleared on any file modification?
```

---

## 3. Error Handling Decision Trees

### Conversion Stage Error Tree

```
convert_file(transcript.txt)
  │
  ├─ FILE_NOT_FOUND
  │  └─ SKIP? RETRY? HALT?
  │
  ├─ FILE_ENCODING_INVALID
  │  └─ SKIP? TRY_ALTERNATE_ENCODING? HALT?
  │
  ├─ FILE_TOO_LARGE
  │  └─ SKIP? RESIZE? HALT?
  │
  ├─ API_KEY_MISSING
  │  └─ HALT (can't continue)
  │
  ├─ API_TIMEOUT (> 30s)
  │  ├─ RETRY? (how many times?)
  │  ├─ SKIP?
  │  └─ HALT?
  │
  ├─ API_RATE_LIMIT (429)
  │  ├─ EXPONENTIAL_BACKOFF? (how long to wait?)
  │  ├─ SKIP?
  │  └─ HALT?
  │
  ├─ API_ERROR (500, 503)
  │  ├─ RETRY?
  │  ├─ SKIP?
  │  └─ HALT?
  │
  ├─ MANIFEST_CORRUPTED
  │  └─ REGENERATE? HALT?
  │
  ├─ OUTPUT_WRITE_FAILED
  │  ├─ SKIP? (data loss)
  │  └─ HALT? (prevents corruption)
  │
  └─ UNEXPECTED_ERROR
     └─ SKIP_WITH_WARNING? HALT? RETRY?

CURRENT BEHAVIOR:
  • Continues with next file on error
  • Logs warning/error
  • No user prompts

SPECIFIED BEHAVIOR:
  • (NONE)

RECOMMENDATION:
  • Non-fatal errors → Skip with warning
  • Fatal errors (API key missing) → Halt
  • Retryable errors (timeout) → Retry 3x with exponential backoff
```

### Analysis Stage Error Tree

```
analyze_file(file.md)
  │
  ├─ FILE_NOT_FOUND
  │  └─ SKIP (file moved?)
  │
  ├─ FILE_TOO_LARGE
  │  ├─ SKIP (within size limits?)
  │  └─ HALT? (system config error)
  │
  ├─ FRONTMATTER_PARSE_ERROR
  │  ├─ USE_DEFAULTS?
  │  ├─ SKIP?
  │  └─ HALT?
  │
  ├─ PROMPT_INJECTION_DETECTED
  │  ├─ SKIP? (sanitization failed)
  │  └─ HALT? (security risk)
  │
  ├─ API_AGENT_FAILURE (1 of 3 agents fails)
  │  ├─ CONTINUE_WITH_2_AGENTS? (report incomplete)
  │  ├─ SKIP_FILE?
  │  └─ HALT_ANALYSIS?
  │
  ├─ API_ALL_AGENTS_FAIL
  │  ├─ RETURN_EMPTY_REPORT?
  │  ├─ SKIP_FILE?
  │  └─ HALT?
  │
  ├─ REPORT_GENERATION_FAILED
  │  ├─ DISCARD_PARTIAL_RESULTS?
  │  ├─ WRITE_INCOMPLETE_REPORT?
  │  └─ HALT?
  │
  └─ CACHE_CORRUPTION
     └─ REGENERATE_CACHE?

CURRENT BEHAVIOR:
  • Agents return empty results on parse failure
  • Report still generated with fallback data
  • No file-level skipping

SPECIFIED BEHAVIOR:
  • (NONE)

RECOMMENDATION:
  • Skippable errors (file not found) → Skip with warning
  • Recoverable errors (1 agent fails) → Continue with partial results
  • Fatal errors (all agents fail) → Skip file, warn user
  • Report generation errors → Discard report, halt
```

---

## 4. Manifest State Machine

### Current (Converter Only)

```
STATE: No manifest
  │
  ├─ LOAD: File doesn't exist
  ├─ ACTION: Create empty manifest
  │
  ▼
STATE: Manifest v1, empty processed_files list
  │
  ├─ TRIGGER: Process file A
  ├─ ACTION: Add entry to processed_files
  │
  ▼
STATE: Manifest v1, with file A entry
  │
  ├─ TRIGGER: Process file A again (unchanged)
  ├─ CHECK: Hash matches?
  │  ├─ YES → SKIP (idempotent)
  │  └─ NO → REPROCESS (modified)
  │
  ▼
STATE: Updated manifest with all entries
  │
  ├─ SAVE: Atomic write (temp file + rename)
  ├─ RECOVER: If corrupted, regenerate from scratch
  │
  ▼
STATE: .processed_manifest.json on disk
```

### Proposed (With Analysis Caching)

```
OPTION A: Single Manifest (Converter + Analysis)

  STATE: No manifest
    │
    ├─ INIT: Create empty with version=1
    │
    ▼
  STATE: Manifest with "processed_files" (conversion tracking)
    │
    ├─ TRIGGER: Convert file A
    ├─ ENTRY: {file: A, status: CONVERTED, hash: xyz}
    │
    ▼
  STATE: Manifest with analysis sections
    │
    ├─ TRIGGER: Analyze files A,B,C with Haiku
    ├─ ADD: analysis_cache_haiku: {files: [A,B,C], hash: abc}
    ├─ ADD: analysis_cache_opus: {} (empty)
    │
    ▼
  STATE: Multiple model caches in one manifest
    │
    ├─ ISSUE: Large manifest if many models tried
    ├─ ISSUE: Complex merging logic
    │
    └─> ? ACCEPTABLE ? (UNDEFINED)


OPTION B: Separate Manifests (Conversion + Per-Model Analysis)

  .processed_manifest.json (conversion)
    ├─ version: 1
    ├─ processed_files: [{file: A, hash: xyz}, ...]
    │
    .analysis-manifest-haiku.json
    ├─ version: 1
    ├─ model: claude-haiku-4-5-20251001
    ├─ cache_key: ? (UNDEFINED)
    ├─ cached_analyses: [...]
    │
    .analysis-manifest-opus.json
    ├─ version: 1
    ├─ model: claude-opus-4-6
    ├─ cache_key: ? (UNDEFINED)
    ├─ cached_analyses: [...]

  ISSUE: Three files to manage, sync between them?

  └─> ? PREFERRED ? (UNDEFINED)


RECOVERY FROM CORRUPTION:

  IF .processed_manifest.json corrupted:
    ├─ OPTION A: Regenerate from scratch (reprocess all files)
    ├─ OPTION B: Use file hashes to verify already-processed
    └─> ? WHICH ? (UNDEFINED)

  IF .analysis-manifest-haiku.json corrupted:
    ├─ OPTION A: Regenerate cache for Haiku only
    ├─ OPTION B: Keep Opus cache, regenerate Haiku
    └─> ? WHICH ? (UNDEFINED)
```

---

## 5. Directory Lifecycle (Staging)

### Current Understanding (from spec)

```
INITIAL STATE:
  input/
    ├─ transcript_1.txt
    ├─ transcript_2.txt
    └─ transcript_3.txt
  output/
    └─ (empty)
  processing/
    └─ (empty)


AFTER CONVERSION:
  input/
    ├─ transcript_1.txt
    ├─ transcript_2.txt
    └─ transcript_3.txt
  output/
    ├─ 2025-01-01_transcript_1.md
    ├─ 2025-01-02_transcript_2.md
    └─ 2025-01-03_transcript_3.md
  processing/
    └─ (empty)


QUESTION 1: Should converted files move to processing/?

  Scenario A: No movement
    output/ = where converted files live
    processing/ = where files go during analysis? Or unused?

  Scenario B: Move to processing/
    output/ = cleared after moving to processing/
    processing/ = workspace for analysis
    → But then what about .txt files in input/?


AFTER STAGING (IF MOVING):
  input/
    ├─ transcript_1.txt
    ├─ transcript_2.txt
    └─ transcript_3.txt
  output/
    └─ (empty, files moved)
  processing/
    ├─ 2025-01-01_transcript_1.md
    ├─ 2025-01-02_transcript_2.md
    └─ 2025-01-03_transcript_3.md


AFTER ANALYSIS:
  input/
    ├─ transcript_1.txt
    ├─ transcript_2.txt
    └─ transcript_3.txt
  output/
    ├─ 2025-01-01_transcript_1.md (moved from processing/)
    ├─ 2025-01-02_transcript_2.md (moved from processing/)
    ├─ 2025-01-03_transcript_3.md (moved from processing/)
    └─ report_haiku.md (generated)
  processing/
    └─ (empty, files moved)


RACE CONDITION:
  What if user adds new .txt files to input/ while analysis is running?

  Timeline:
    T0: Conversion of file_1, file_2 starts
    T5: file_1 moved to processing/
    T10: User adds file_3.txt to input/
    T15: file_2 moved to processing/
    T20: Analysis starts on file_1, file_2 in processing/
    T25: file_3 is in input/, never converted!

  Expected: file_3 included in next run? Or user manually moves it?
  UNDEFINED.
```

---

## 6. Parallel vs. Sequential Execution

### Current Implementation (Analyzer)

```
AGENTS:

  strategicAnalyzer      stakeholderAnalyzer      financialOpsAnalyzer
       │                         │                        │
       ├─────────── Promise.all() ────────────────────────┤
       │                         │                        │
       ▼                         ▼                        ▼
     (API Call)               (API Call)               (API Call)
     ~20s each                ~20s each                ~20s each
     (Parallel = ~20s total, not 60s)
       │                         │                        │
       └─────────── await all ───┴────────────────────────┘
                         │
                         ▼
              [All 3 results available]
                         │
                         ├─ generateExecutiveSummary(all 3 results)
                         ├─ generateRecommendations(all 3 results)
                         └─ generateTimeline(all 3 results)
                         │
                         ├─ [Sequential, depends on agent results]
                         │
                         ▼
                    [Final Report]


QUESTION: If 1 agent fails mid-run (e.g., strategicAnalyzer times out):

  Scenario A: Fail entire analysis
    └─ All 3 agents must succeed

  Scenario B: Continue with 2 agents
    └─ Report incomplete but valid
    └─ Executive summary generated from 2 perspectives

  Scenario C: Return empty results for failed agent
    └─ Report includes "insufficient data" sections
    └─ Recommendations based on 2 agents

  CURRENT: Scenario C (agents return empty on failure)
  SPECIFIED: (NONE)
```

---

## 7. Failure Recovery: Conversion Interruption

```
USER RUNS: npm run analyze

T0:   convert_file(1.txt) → .md generated, manifest updated
T1:   convert_file(2.txt) → .md generated, manifest updated
T2:   convert_file(3.txt) → in progress...
T3:   [USER HITS CTRL+C]
      └─> Process interrupted

SYSTEM STATE AT INTERRUPTION:
  .processed_manifest.json
    ├─ file_1: ✓ processed
    ├─ file_2: ✓ processed
    ├─ file_3: ? (in progress)
    └─ file_4-10: not started

  output/
    ├─ 2025-01-01_file_1.md ✓
    ├─ 2025-01-02_file_2.md ✓
    ├─ 2025-01-03_file_3.md ? (incomplete?)
    └─ file_4-10: not created


QUESTION: What happens on next run?

  Option A: Resume from file 3
    → Only process file_3-10
    → Faster recovery
    → Requires state tracking (e.g., "last_completed_file")

  Option B: Start from beginning
    → Manifest says 1,2 already done (idempotent skip)
    → Process 3-10
    → Safe but slower

  Option C: Ask user what to do
    → "Resume from file 3? [Y/n]"
    → User decides

  CURRENT: Option B (implicit, based on idempotent hash checking)
  SPECIFIED: (NONE)


BEST PRACTICE:
  → Option B (idempotent) is safest
  → Conversion idempotency handles it automatically
  → No special recovery code needed
```

---

## 8. Force Reprocessing Flag Semantics

```
SCENARIO: User wants to re-analyze existing files

RUN 1: npm run analyze
  ├─ Converts all .txt files
  ├─ Analyzes all .md files
  └─ Generates report_haiku.md


30 MINUTES LATER: User decides to regenerate report with Opus


RUN 2: npm run analyze --force

QUESTION: What should --force do?

  Option A: --force = Force conversion + force analysis
    └─ Clear both manifests
    └─ Reprocess all .txt files
    └─ Re-analyze all .md files
    └─ Generate new reports (cost: high, time: long)

  Option B: --force = Force conversion only
    └─ Clear conversion manifest
    └─ Reprocess all .txt files
    └─ Use existing analysis if possible
    └─ Generate new reports (cost: medium)

  Option C: --force-convert and --force-analyze separate
    └─ --force-convert: Reprocess conversions
    └─ --force-analyze: Reanalyze with all models
    └─ User has fine-grained control

  CURRENT: (Not implemented)
  SPECIFIED: (UNDEFINED)


ALTERNATIVE APPROACH: Smart reprocessing

  RUN 2: npm run analyze --model=claude-opus-4-6

  SYSTEM:
    ├─ Conversion: Skip (manifests match, files unchanged)
    ├─ Analysis: Cache miss for Opus
    ├─ Action: Analyze existing .md files with Opus
    ├─ Result: Generate report_opus.md
    └─ No --force needed! (Implicit smart behavior)

  BENEFIT:
    ├─ Cost-effective (don't reconvert)
    ├─ Fast (skip unchanged files)
    ├─ Intuitive (user just changes model)
    └─ Cache-aware (per-model caches)


RECOMMENDATION:
  → Implement smart per-model behavior
  → Reserve --force for "regenerate everything"
  → Document when --force is actually needed
```

---

## 9. Complete State Diagram (All Stages)

```
┌────────────────────────────────────────────────────────────────────┐
│                    FULL PIPELINE STATE MACHINE                     │
└────────────────────────────────────────────────────────────────────┘

START
  │
  ▼
[READY] ─no files──> [WARN_EMPTY] ──> EXIT
  │
  │ files discovered
  ▼
[CONVERTING]
  ├─ Each file: Check manifest
  ├─ Skip if processed (hash match)
  ├─ Convert if new/modified
  ├─ Update manifest atomically
  │
  ├─ File fails? ──> [CONVERSION_ERROR]
  │                  (skip / retry / halt?)
  │
  ▼
[CONVERSION_COMPLETE]
  │ (some or all files converted/skipped)
  │
  ├─ No converted files? ──> [WARN_NO_NEW] ──> EXIT (or continue with existing?)
  │
  ▼
[STAGING] (unclear if needed)
  ├─ Move output/ files to processing/ ?
  │ Or keep in output/ ?
  │
  ▼
[ANALYZING]
  ├─ For each .md file:
  │  ├─ Check cache for model
  │  ├─ Hit? Return cached report
  │  ├─ Miss? Run agents (parallel)
  │  ├─ Save to analysis manifest
  │  │
  │  ├─ Agent fails? ──> [ANALYSIS_ERROR]
  │  │                  (skip / halt / partial?)
  │  │
  ▼
[ANALYSIS_COMPLETE]
  │ (report generated, may be partial)
  │
  ├─ Report valid? ──> No ──> [REPORT_INVALID] ──> EXIT
  │
  ▼
[OUTPUT_STAGING] (unclear if needed)
  ├─ Move processing/ files to output/ ?
  │ Or already in output/ ?
  │
  ▼
[SUCCESS]
  ├─ Report written: output/report_[MODEL].md
  ├─ Manifests updated: .processed_manifest.json, .analysis-manifest-[MODEL].json
  └─ Summary printed
      │
      └──> EXIT (0)


ERROR STATES:
  [CONVERSION_ERROR] ──> ? Skip & continue / Halt ?
  [ANALYSIS_ERROR] ───> ? Skip & continue / Halt / Partial report ?
  [REPORT_INVALID] ──> Halt (don't write broken report)
  [WARN_EMPTY] ────> Exit with warning (no files to process)
  [WARN_NO_NEW] ───> Exit with info (all files already processed)
```

---

## 10. Cache Hit/Miss Timeline

```
FILES: A.md (1000 chars), B.md (2000 chars), C.md (500 chars)
MODEL: claude-haiku-4-5-20251001

RUN 1: npm run analyze
┌───────────────────────────────────────────────┐
│ T0: Start analysis                            │
│ T2: Analyze A.md (API call) → Strategic analysis       │
│ T7: Agent results for A → Synthesis           │
│ T10: Save cache entry: {files: [A,B,C], model: haiku} │
│ T11: Report generated                         │
│ T12: Exit                                     │
│ TOTAL TIME: 12s                               │
│ CACHE STATE: .analysis-manifest-haiku.json created  │
└───────────────────────────────────────────────┘

30 SECONDS LATER (files unchanged)

RUN 2: npm run analyze
┌───────────────────────────────────────────────┐
│ T0: Start analysis                            │
│ T1: Check cache for [A,B,C] with haiku model │
│     → Cache KEY matches! CACHE HIT!           │
│ T2: Return cached report from manifest        │
│ T3: Exit                                      │
│ TOTAL TIME: 3s (90% faster!)                  │
│ COST: $0 (no API calls)                       │
└───────────────────────────────────────────────┘

USER MODIFIES B.md (adds 1 line)

RUN 3: npm run analyze
┌───────────────────────────────────────────────┐
│ T0: Start analysis                            │
│ T1: Check cache for [A,B,C] with haiku model │
│     → Cache KEY doesn't match (B modified!)  │
│ T2: CACHE MISS                                │
│ T3-10: Analyze A.md (API call)                │
│ T11-18: Analyze B.md (API call, modified!)    │
│ T19-26: Analyze C.md (API call)               │
│ T27: Synthesis (3 agents in parallel, ~5s)   │
│ T32: Save updated cache                       │
│ T33: Report generated (NEW, includes B changes) │
│ T34: Exit                                     │
│ TOTAL TIME: 34s (normal analysis)             │
│ COST: ~$0.15 (API calls for all 3 files)     │
└───────────────────────────────────────────────┘

QUESTION: How does system detect B.md was modified?
  Option A: File content hash in cache key
    └─ Cache key = SHA256(A+B+C content + model)
    └─ Any change in any file invalidates all

  Option B: Individual file hashes
    └─ Cache entries per file
    └─ Only re-analyze modified files
    └─ More complex to implement

  Option C: File modification time
    └─ Cache + (mtime from manifest)
    └─ Fallible (clock skew, copying files)

  CURRENT: (UNDEFINED)
  RECOMMENDATION: Option A (simplest, safest)
```

---

**Diagrams Complete:** March 1, 2026
