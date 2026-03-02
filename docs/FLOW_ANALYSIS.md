# Unified System Flow Analysis & Gap Identification

**Analysis Date:** March 1, 2026
**Project:** Transcript Converter + Analyzer Unified System
**Scope:** Three CLI commands with staged directory processing and per-model caching

---

## Executive Summary

This analysis examines a unified Node.js/TypeScript system combining a Python transcript converter and Node.js analyzer. The specification proposes three CLI commands (`analyze`, `convert`, `analyze-existing`) with staged processing directories and per-model caching.

**Key Findings:**
- Core architectural patterns are well-designed but CLI interface specification is incomplete
- State management across systems has significant gaps around manifest handling
- Error recovery scenarios are under-specified, especially for partial failures
- Model-switching cache isolation is mentioned but not defined
- Accept/reject criteria for success are ambiguous
- Multiple edge cases lack explicit handling requirements

**Critical Blockers (before implementation):** 7 areas requiring clarification
**Important Questions (affects UX/maintainability):** 14 areas needing definition
**Nice-to-Have Clarifications:** 8 areas with reasonable defaults

---

## User Flow Overview

### Flow 1: Full Pipeline (Complete End-to-End)

```
User Action: npm run analyze (full pipeline)
              OR: ts-node src/cli.ts analyze

START
  ↓
STEP 1: Discovery
  • Scan input/ directory for .txt files
  • Log count of files found
  ↓
STEP 2: Conversion
  • For each .txt file:
    - Check manifest for prior processing
    - If already processed + file hash matches: SKIP
    - If new or modified: CONVERT via Python converter
    - Extract date, concepts via Claude API
    - Write .md file to output/
    - Update manifest
  • If conversion fails on file: Continue with next file
  ↓
STEP 3: Move to Processing Stage
  • Move successfully converted .md files from output/ → processing/
  • Files now ready for analysis
  ↓
STEP 4: Analysis
  • Read .md files from processing/
  • Parse YAML frontmatter metadata
  • Run multi-agent analysis system
  • Generate model-specific report (report_haiku.md by default)
  ↓
STEP 5: Move to Output Stage
  • Move analyzed .md files from processing/ → output/
  • Move generated report to output/
  ↓
COMPLETION
  • Exit with success message
  • List artifacts: analysis report, metadata
```

**Success Criteria (Unspecified):**
- All files processed without error? (Partial success acceptable?)
- All files require conversion? (Or can skip already-converted?)
- Report must include all transcripts? (Or continue with partial set?)

**Current State in Codebase:**
- Converter: Idempotent (skips already-processed files based on manifest)
- Analyzer: Stateless (generates new report every run)
- **Missing:** Integration between the two, CLI interface, directory staging

---

### Flow 2: Advanced Flow (User Inspection Between Stages)

```
User Action: MANUAL inspection of converted .md files

STEP 1: Run conversion only
  npm run convert
    ↓ Produces: output/*.md files with YAML frontmatter

STEP 2: User action (30 minutes later)
  • User opens output/*.md in editor
  • Reviews frontmatter (date, concepts)
  • Optionally modifies metadata or content
  • Saves files

STEP 3: Run analysis on existing .md files
  npm run analyze-existing
    ↓ Reads from output/
    ↓ Analyzes modified .md files
    ↓ Generates report

Expected Behavior:
  • Analysis uses modified metadata and content
  • Manifest is NOT updated (files already processed)
  • User edits are reflected in report
```

**Questions Raised:**
- Should `analyze-existing` read from `output/` or `processing/`?
- Are the .md files supposed to be staged (moved to processing/) during conversion?
- Does modifying frontmatter after conversion affect analysis?
- Should manifest be regenerated or left as-is?
- What if user deletes a file they previously analyzed?

---

### Flow 3: Model Switching Flow (Same Data, Multiple Models)

```
User Action: Run analysis with different models for comparison

STEP 1: Run with Haiku (default, cached)
  npm run analyze
    ↓ Uses MODEL_ID=claude-haiku-4-5-20251001 (default)
    ↓ Generates: output/report_haiku.md
    ↓ Caches: .analysis-manifest-haiku.json

STEP 2: User examines report (30 minutes later)

STEP 3: Run same data through Opus (separate cache)
  MODEL_ID=claude-opus-4-6 npm run analyze
    ↓ Should use SAME input files (processing/ or output/)
    ↓ Cache keyed by: manifest version + model ID
    ↓ Generates: output/report_opus.md
    ↓ Caches: .analysis-manifest-opus.json

STEP 4: User compares reports
  • report_haiku.md vs report_opus.md
  • Each model's cache isolated

Expected Behavior:
  • Both analyses use identical input
  • Cache prevents re-analysis of same files with same model
  • Report naming indicates model used
  • No cross-model cache pollution
```

**Cache Design Questions:**
- How are caches keyed? (Manifest version? File hashes? Model?)
- Are caches per-model or per-run?
- If files change between Haiku and Opus runs, what happens?
- Does changing metadata between runs invalidate cache?
- Should there be a cache version number in manifest?
- How to handle user clearing cache (--no-cache flag)?

---

### Flow 4: Partial Failure Recovery Scenario

```
User Action: Run full pipeline with 10 files, 1 fails during conversion

START: User runs npm run analyze with 10 .txt files

CONVERSION STAGE (Files 1-10):
  File 1: ✓ Converted successfully
  File 2: ✓ Converted successfully
  ...
  File 5: ✗ API timeout during extraction
         (Claude API takes >30s, client timeout)
  File 6: ✓ Converted successfully
  ...
  File 10: ✓ Converted successfully

Current System State:
  • Manifest: Has entries for files 1-4, 6-10 (not 5)
  • output/: Contains .md files for files 1-4, 6-10 (9 files)
  • processing/: Empty (conversion stage failed mid-run)

User sees: ⚠️ Conversion failed on file_5.txt. Continue? [Y/n]

CASE A: User chooses Y (continue to analysis)
  • Analyze 9 successfully converted files
  • Generate report without file 5
  • Move files 1-4, 6-10 to processing/ then output/
  • ✓ Report generated (incomplete but valid)

CASE B: User chooses N (retry conversion)
  • Retry conversion of file 5 only
  • If succeeds: Continue to analysis with all 10 files
  • If fails again: Stop or prompt for manual intervention?

Questions Without Answers:
  1. Who decides the recovery action? (User or system?)
  2. What if user force-exits during conversion?
  3. Are partially converted files moved to processing/?
  4. Does the manifest get partially updated or rolled back?
  5. Can user resume from partial state?
  6. What's the timeout strategy (retry? skip? halt)?
  7. How many retries before giving up?
```

**Current State:**
- Converter: Continues on individual file errors, updates manifest atomically
- Analyzer: Returns empty results if parsing fails, continues
- **Missing:** Recovery logic, user prompts, intermediate state management

---

### Flow 5: Force Reprocessing (Ignore Manifest)

```
User Action: npm run analyze --force (bypass manifest, reprocess everything)

Expected Behavior:
  • Ignore .processed_manifest.json
  • Ignore .analysis-manifest-*.json
  • Reprocess ALL .txt files even if previously converted
  • Reanalyze ALL .md files even if previously analyzed

Design Questions:
  1. Does --force affect both conversion AND analysis?
     - Or does --force-convert and --force-analyze provide granularity?
  2. If files were modified during force reprocessing, overwrite existing output/?
  3. Should manifest be cleared, updated, or preserved?
  4. What about manifests for caching?
     - Should old analysis caches be invalidated?
     - Or preserved for comparison?
  5. If user runs --force twice in succession, does second run take zero time?
     - (If files weren't modified, should it skip?)

Current Implementation Capability:
  - Converter: Could skip manifest check with flag
  - Analyzer: No manifest/caching yet (proposed feature)
  - **Missing:** CLI flag definition, caching mechanism, overwrite strategy
```

---

## Flow Permutations Matrix

### Directory & File States During Processing

| Flow Stage | input/ | output/ | processing/ | Manifest State |
|-----------|--------|---------|-------------|----------------|
| **Initial** | *.txt files | empty | empty | Not created |
| **After Conversion** | *.txt | *.md (converted) | empty | Updated |
| **After Stage Move** | *.txt | empty | *.md (staged) | Unchanged |
| **After Analysis** | *.txt | *.md + report | empty | Analysis entry added |
| **After Output Move** | *.txt | *.md + report | empty | Unchanged |

### Model Switching Permutations

| Run # | Model | Input Files | Cache State | Output | Manifest |
|------|-------|-------------|------------|--------|----------|
| 1 | Haiku | processing/2 files | Empty | report_haiku.md | .manifest-haiku.json created |
| 2 | Haiku | processing/2 files (unchanged) | Hits cache | report_haiku.md | .manifest-haiku.json unchanged |
| 3 | Opus | processing/2 files | Empty | report_opus.md | .manifest-opus.json created |
| 4 | Sonnet | processing/1 new file | Partial | report_sonnet.md | .manifest-sonnet.json partial |

### Failure Mode Permutations

| Stage | Failure Type | Files Affected | System State | Recovery |
|-------|-------------|-----------------|--------------|----------|
| **Conversion** | API timeout | 1 of 5 | 4 converted, 1 failed | Retry? Skip? Halt? |
| **Conversion** | File encoding | 1 of 5 | 4 in manifest, 1 not | Continue or stop? |
| **Staging** | Permission denied | 2 of 9 | Partial move | Rollback or continue? |
| **Analysis** | Large file | 1 of 10 | 9 analyzed, 1 skipped | Report with 9 or fail? |
| **Analysis** | Malformed JSON | All | Analysis started, failed mid-run | Retry, halt, or return fallback? |

### User Interaction Permutations

| User Action | Expected System State | Manifest Impact | Cache Impact | Report Status |
|------------|----------------------|-----------------|--------------|---------------|
| `analyze` | Convert + analyze | Create/update | Create | Generated |
| `analyze --force` | Force convert + analyze | Regenerate | Invalidate | Generated |
| `analyze --force-convert` | Force convert, smart analyze | Update conversion | Invalidate analysis | Generated |
| `convert` | Conversion only | Update | None | None |
| `analyze-existing` | Analyze from output/ | None | Create | Generated |
| Ctrl+C during conversion | Half-converted | Partial update | None | Interrupted |
| Ctrl+C during analysis | Incomplete report | Unchanged | Partial | Incomplete |

---

## Missing Elements & Gaps

### CATEGORY 1: CLI Interface & Command Specification

#### Gap 1.1: Command Definitions Underspecified
**Current State:** Specification mentions "three CLI commands" but provides no formal definition.

**Missing Details:**
- Exact command signatures (`analyze`, `convert`, `analyze-existing` - but what are the full names?)
- Required vs optional arguments/flags
- Help text and usage examples
- Default values for all parameters
- How to invoke (npm run, ts-node, compiled binary?)

**Example of ambiguity:**
```bash
# Which of these is correct?
npm run analyze
ts-node src/cli.ts analyze
node dist/cli.js analyze
./transcript-analyzer analyze

# What about flags?
analyze --model=opus
analyze --model opus
analyze --force-convert
analyze --force-convert --no-cache
```

**Impact:** Without formal CLI spec, developers have to make assumptions. Implementation may not match user expectations.

---

#### Gap 1.2: Flag/Parameter Documentation Missing
**What's undefined:**
- `--force` (affects what? both stages? just conversion? just analysis?)
- `--force-convert` vs `--force-analyze` (are these separate flags?)
- `--no-cache` (clears what caches? just analysis? conversion too?)
- `--model` (can it be changed between runs? for which operations?)
- `--input-dir` / `--output-dir` (configurable?)
- `--batch-size` (should there be one?)
- `--timeout` (api timeout? stage timeout?)
- `--retry-count` (how many times to retry failed conversions?)

**Impact:** Users won't know what options are available. Implementation complexity unclear.

---

### CATEGORY 2: State Management Across Systems

#### Gap 2.1: Manifest Strategy Unclear
**Current Implementation:**
- Converter: Single `.processed_manifest.json` tracking converted files
- Analyzer: No manifest yet (proposed in recommendations)

**Missing Specification:**
- Should conversion and analysis use same manifest or separate ones?
- If separate, how do they reference each other?
- What happens if conversion manifest is corrupted?
- If manifests disagree on file state, which is source of truth?
- Can manifest be manually edited by users?
- What's the manifest schema version strategy?

**Scenario without clarity:**
1. User converts 10 files → manifest has 10 entries
2. User modifies 3 .md files manually
3. User runs analyze → manifest says all 10 already analyzed
4. User expects report with modified content → gets stale report

**Impact:** Silent failures where system thinks work is done when it's not.

---

#### Gap 2.2: Directory Staging Lifecycle Undefined
**Specification Says:** "Staged directories: input/ → processing/ → output/"

**Unspecified Details:**
- When does conversion output move to processing/?
- When does processing/ move back to output/?
- Are files moved atomically or sequentially?
- What if user adds new files while processing/ has old files?
- Can processing/ coexist with input/ and output/?
- Should processing/ persist between runs or be cleared?

**Example Problem:**
```
Scenario: User runs analyze, it converts 5 files and moves to processing/

While analysis is running:
  • User adds 2 more .txt files to input/
  • User modifies 1 converted file in processing/

System state is now ambiguous:
  • Are the 2 new files supposed to be included?
  • Are modifications to processing/ files supposed to persist?
```

**Impact:** Race conditions, data loss, user confusion about what's processing.

---

#### Gap 2.3: Per-Model Analysis Caching Not Defined
**Specification Says:** "Single manifest with per-model analysis caching"

**What's Missing:**
- How is cache key computed? (File hash? Metadata hash? File list?)
- What happens if files are modified between Haiku and Opus runs?
- Is cache keyed on exact file content or just metadata?
- Should cache entries be timestamped?
- Can user invalidate specific model caches?
- How to handle model version changes (e.g., claude-opus-4-6 updates)?
- Storage location for cache files?
- Cache size limits?
- Cache retention policy?

**Scenario needing clarification:**
1. User converts file A with date "2025-01-15"
2. User runs analysis with Haiku → report_haiku.md cached
3. User edits file A, changes date to "2025-01-16"
4. User runs analysis with Opus → does Opus see the change?

**Current Code:** Analyzer doesn't parse frontmatter date at all currently.

**Impact:** Cache design is critical for correctness. Wrong caching strategy = data inconsistencies.

---

### CATEGORY 3: Error Handling & Recovery

#### Gap 3.1: Conversion Failure Strategy Undefined
**Specification:** Silent about what happens when conversion fails.

**Scenarios without answers:**
- Single file API timeout: Skip it? Retry? Halt entire batch?
- File encoding mismatch: Skip with warning? Try alternative encoding?
- File larger than size limit: Reject entire run or continue with others?
- Manifest corruption during update: Rollback? Re-process everything?

**Current Behavior:** Converter continues on errors, but no recovery prompts.

**Impact:** Silent failures where system appears successful but files are missing from analysis.

---

#### Gap 3.2: Analysis Failure & Partial Result Handling
**Unspecified:**
- If 1 of 10 files fails to analyze (e.g., prompt injection detected), what happens?
  - Skip file and report with 9 files?
  - Halt and require user intervention?
  - Generate report with "error" entry for that file?
- If analysis partially succeeds (e.g., 3 of 5 agents fail), what report should be generated?
- What if report generation fails after successful agent analyses?
- Should incomplete reports be written to output/ or discarded?

**Current Behavior:** Agents return empty results on failure, report still generates.

**Impact:** Users may not realize their analysis is incomplete or using fallback data.

---

#### Gap 3.3: Interrupted Process Recovery
**Unspecified:**
- If user Ctrl+C during conversion, what's the manifest state?
- Can user resume from partial state?
- If user Ctrl+C during analysis, are partial analysis caches saved?
- How does system distinguish between "in progress" and "completed with errors"?

**Scenario:**
1. User runs analyze with 100 files
2. After converting 50 and analyzing 25, user hits Ctrl+C
3. User tries to run analyze again
4. Should system resume from file 51? Or start over?

**Current Behavior:** Likely starts from beginning (lost work).

**Impact:** Large batches become painful; users may lose processing time.

---

### CATEGORY 4: Data Format & Metadata

#### Gap 4.1: Frontmatter Parsing Strategy Undefined
**Specification Says:** Analyzer should parse YAML frontmatter

**Unspecified:**
- If frontmatter is malformed, what's the fallback?
- If required fields are missing (e.g., date), how is metadata completed?
- Can analyzer modify/normalize frontmatter?
- Should converter's extracted date override manual date in frontmatter?
- How to handle files without frontmatter?

**Current Converter Behavior:** Adds frontmatter with date + concepts.

**Current Analyzer Behavior:** Doesn't parse frontmatter yet.

**Impact:** Analyzer can't use converter's extracted metadata.

---

#### Gap 4.2: Model-Specific Report Format Undefined
**Specification Says:** "Model-specific report generation (report_haiku.md, report_opus.md)"

**Unspecified:**
- Should different models generate different report content (e.g., Opus more detailed)?
- Or just same content with different accuracy/depth?
- Should there be a comparison report showing differences?
- Naming convention: `report_haiku.md` or `haiku-analysis-report.md`?
- Should both reports always be generated, or only the specified model?

**Current Behavior:** Single report, no model differentiation.

**Impact:** Users don't know if model choice affects report content or just cost.

---

### CATEGORY 5: Configuration & Environment

#### Gap 5.1: Configuration Scope Unclear
**Currently Specified (in recommendations):**
- `ANTHROPIC_API_KEY` (required)
- `MODEL_ID` (optional, default Haiku)
- `MAX_FILE_SIZE`, `MAX_TOTAL_SIZE` (optional)

**Not Specified:**
- Should directories (input/, output/, processing/) be configurable?
- Should stage logic be optional (turn off processing/ directory)?
- Timeout values (API timeout, stage timeout, total run timeout)?
- Logging verbosity (DEBUG, INFO, WARN, ERROR)?
- Retry strategy (exponential backoff? linear? max attempts?)?
- Cache location and size limits?
- Manifest file locations?

**Impact:** Deployment in different environments will be difficult.

---

#### Gap 5.2: Validation on Startup Missing
**Questions:**
- Should system validate all environment variables on startup?
- Should system check directory permissions before processing?
- Should system verify API key is valid before starting?
- Should system check disk space before conversion/analysis?

**Current Behavior:** Converter checks API key only when needed.

**Impact:** Failures happen mid-run rather than startup, wasting time.

---

### CATEGORY 6: Logging & Monitoring

#### Gap 6.1: Log Output Strategy Undefined
**Unspecified:**
- Should there be separate logs for conversion and analysis?
- Log file locations?
- Should logs be JSON formatted or human-readable?
- Should logs be rotated or append-only?
- Should transcript content appear in logs (security risk)?
- Should API call details be logged?

**Current Behavior:** Converter logs to `.conversion.log`, Analyzer doesn't log to file.

**Impact:** No audit trail for analysis runs. Debugging difficult.

---

#### Gap 6.2: User Feedback During Processing
**Unspecified:**
- Should system show progress (1/10 files processed)?
- Should it show estimated time remaining?
- Should it show API costs as they accumulate?
- Should it prompt before expensive operations?

**Current Behavior:** Converter shows file counts, Analyzer shows summary.

**Impact:** Users don't know if system is stuck or just slow.

---

### CATEGORY 7: Testing & Acceptance Criteria

#### Gap 7.1: Success Criteria Not Defined
**Specification mentions:**
- Folder organization preserved
- Model-specific caching
- Report generation

**But doesn't specify:**
- What's the minimum viable output? (E.g., report with all transcripts or report with any transcripts?)
- All files must process successfully? Or partial success acceptable?
- Report must be valid markdown? What about content completeness?
- Are there acceptance tests that must pass?

**Current Code:** No automated tests; unclear what "passing" means.

**Impact:** Implementation might produce working but untestable code.

---

#### Gap 7.2: Edge Cases Not Listed
**Potentially missing test scenarios:**
- Empty input/ directory
- Zero files in input/
- Single very large file (10MB) → conversion succeeds, analysis fails on size limit
- Files with non-ASCII characters
- Circular symlinks in input/
- Permission denied on output/ directory
- Disk full during report generation
- API rate limiting (429 responses)
- API overload (503 responses)
- Network timeout mid-analysis
- Files deleted from input/ between conversion and analysis stages
- Same file processed in two concurrent runs
- Clock skew (system time changes during run)

**Impact:** Implementation will be brittle; edge cases will emerge in production.

---

### CATEGORY 8: Integration Points

#### Gap 8.1: Converter → Analyzer Handoff Mechanism Missing
**Specification Says:** Converter auto-copies to analyzer input folder

**But doesn't specify:**
- Exact mechanism for auto-copy (shell command? File API? npm package?)
- What happens if analyzer input folder doesn't exist?
- Should converter wait for analyzer to read files before cleaning up?
- What if analyzer is running while converter is copying?
- Should there be a "handoff" manifest confirming receipt?

**Current Behavior:** Python converter calls shutil.copy(); doesn't verify analyzer reads it.

**Impact:** Files could get lost or duplicated.

---

#### Gap 8.2: CLI Integration Unclear
**Specification mentions:**
- `npm run analyze` (full pipeline)
- `npm run convert` (conversion only)
- `npm run analyze-existing` (analysis only)

**But doesn't specify:**
- Are these npm scripts or CLI commands?
- If scripts, where's package.json with definitions?
- If CLI, what's the entry point?
- How does `npm run` trigger Python conversion?
- What's the build/compilation step?
- Is there a setup step before first run?

**Current Behavior:** Analyzer has npm scripts, but converter is standalone Python.

**Impact:** Users won't know how to invoke the unified system.

---

---

## Critical Questions Requiring Clarification

These questions block implementation or create correctness/security risks.

### CRITICAL TIER (Blocks Implementation)

#### Q1: How should manifest state be managed across conversion and analysis?
**Why Critical:** Without clear manifest strategy, the system can't track what's been done, leading to duplicate processing or missing analysis.

**Current Ambiguity:**
- Is there ONE manifest or TWO?
- If two, what's their relationship?
- How do they reference each other?
- What happens on manifest corruption?

**Assumptions if not answered:**
- Single manifest for everything
- Manifest includes conversion AND analysis metadata
- Corruption triggers full re-processing

**Examples illustrating ambiguity:**
1. User modifies converted .md file, then runs analyze
   - Should manifest recognize the modification?
   - Should it trigger re-analysis of that file?

2. Conversion succeeds for 9 of 10 files
   - Should analysis wait for all 10?
   - Or proceed with 9?
   - How does manifest track the incomplete state?

---

#### Q2: What is the lifecycle of the processing/ directory?
**Why Critical:** Without clear directory semantics, data could be lost or incorrectly staged.

**Current Ambiguity:**
- When files move to processing/, are they removed from input/ or copied?
- When analysis completes, what happens to processing/? (Deleted? Moved to output?)
- If analysis fails mid-way, are processing/ files rolled back?
- Can user add new files to input/ while processing/ has content?

**Assumptions if not answered:**
- Conversion output goes to output/
- User manually stages files to processing/ before analysis
- processing/ is not used (staging happens in output/)

**Examples illustrating ambiguity:**
1. Full pipeline converts 5 files → where do they live? output/ or processing/?
2. User wants to inspect before analysis → do they edit in output/ or staging/?
3. If analysis fails → are processing/ files cleaned up or left for retry?

---

#### Q3: How should per-model caching work and be keyed?
**Why Critical:** Incorrect cache design causes data inconsistencies or prevents valid cache hits.

**Current Ambiguity:**
- Is cache key the manifest version, file hashes, or something else?
- If files change between model runs, should cache be invalidated?
- Should there be separate manifests per model or one shared manifest?
- What if user changes API model (e.g., Claude-Sonnet 4.6 → Claude-Opus 4.6)?

**Assumptions if not answered:**
- Cache key = SHA256(file contents + model ID)
- Cache invalidated if any file changes
- Separate manifest per model
- Model version changes invalidate cache

**Examples illustrating ambiguity:**
1. Run with Haiku on files A+B → generates report_haiku.md
2. Run with Opus on files A+B → should Opus see the same input?
3. User modifies file A, run Opus again → does Opus use modified A?
4. User runs Haiku again → should it hit cache and return report_haiku.md instantly?

---

#### Q4: What is the failure recovery strategy for each stage?
**Why Critical:** Without clear error handling, partial failures are ambiguous and users lose work.

**Current Ambiguity:**
- If conversion fails on 1 of 10 files, what happens?
  - Skip it and continue? (Report warns about incomplete set)
  - Halt and require retry? (User has to restart)
  - Prompt user for decision?
- If analysis fails on 1 of 10 files, same question.
- If API rate limiting (429) occurs, retry indefinitely? With backoff? Give up?

**Assumptions if not answered:**
- Skip individual files that fail
- Continue with remaining files
- Log failures but complete the run
- Warn user about incomplete results

**Examples illustrating ambiguity:**
1. API timeout on file 5 of 10
   - Option A: Skip file 5, analyze 9, generate report with 9 files
   - Option B: Halt, require user to fix and restart
   - Option C: Prompt user: "Skip file 5? [Y/n]"
   - Which is correct?

2. User has 100 files, halfway through analysis system crashes
   - Next run should resume or start over?
   - How does system know what's already been analyzed?

---

#### Q5: What does force reprocessing (--force) actually do?
**Why Critical:** Without clarity, users might force-reprocess accidentally or not when needed.

**Current Ambiguity:**
- Does --force skip manifest check? (Affects what? Just conversion? Just analysis?)
- Does --force invalidate caches?
- Does --force overwrite existing files?
- Is --force a global flag or per-stage (--force-convert, --force-analyze)?
- Does --force clear intermediate directories (processing/)?

**Assumptions if not answered:**
- --force-convert: Ignore manifest, reprocess all .txt files
- --force-analyze: Ignore caches, reanalyze all .md files
- Both: Overwrite existing output/
- Clear processing/ if empty

**Examples illustrating ambiguity:**
1. User runs analyze → generates report_haiku.md
2. User wants to include newly added files → run analyze again?
   - System skips already-converted files (efficient)
   - But what if user wants EVERYTHING re-analyzed?
   - --force flag?

3. User runs --force
   - Does it re-hit Claude API for all conversions? (Cost!)
   - Does it clear all caches?
   - Does it regenerate manifests?

---

#### Q6: What's the acceptance criteria for a successful full pipeline run?
**Why Critical:** Without clear success criteria, it's unclear what "done" means.

**Current Ambiguity:**
- Must ALL files process successfully?
- Or is partial success acceptable?
- Must report include analysis from ALL agents?
- Or is partial analysis acceptable?
- What's the minimum report content to be "valid"?

**Assumptions if not answered:**
- Partial success acceptable (some files fail, others succeed)
- Report generated if at least 1 file processes
- Missing sections replaced with "insufficient data"

**Examples illustrating ambiguity:**
1. Conversion succeeds for 9 of 10 files
   - Is this a success? (Partial) or failure? (Incomplete)
   - Should analysis proceed with 9?
   - Or halt and require fix of the 1 failing file?

2. Analysis runs but 3 of 5 agents fail
   - Is report valid without all agent perspectives?
   - Should it be generated or discarded?

---

#### Q7: How should frontmatter metadata be handled when present/absent?
**Why Critical:** Analyzer can't fully use converter's metadata without clear parsing rules.

**Current Ambiguity:**
- If converter adds frontmatter but analyzer doesn't parse it, that metadata is lost.
- If frontmatter is malformed, what's the fallback?
- If file has no frontmatter, can analyzer still analyze?
- Should analyzer modify frontmatter?

**Assumptions if not answered:**
- Analyzer parses YAML frontmatter if present
- Falls back to defaults if missing
- Malformed frontmatter logged, file analyzed anyway
- Analyzer doesn't modify frontmatter

---

---

## Important Questions Affecting UX/Maintainability

These questions don't block implementation but significantly affect user experience or code maintainability.

#### Q8: Should directory staging (input/ → processing/ → output/) be optional or mandatory?

**Impact:** Affects complexity and flexibility of the system.

**Unspecified Details:**
- Should users be able to disable staging and work directly in input/output/?
- Or is staging mandatory?
- If optional, what flags/settings control this?

---

#### Q9: Should different models generate different report content, or just vary in cost/depth?

**Impact:** Affects whether reports are comparable across models.

**Unspecified Details:**
- Should report_haiku.md and report_opus.md have same structure?
- Or should Opus generate more detailed sections?
- Should there be a comparison view?

---

#### Q10: What timeout values should be used for API calls, stage transitions, and total run?

**Impact:** Affects when system gives up vs. retries.

**Examples needing definition:**
- Single API call timeout: 30s? 60s? 120s?
- Stage timeout (conversion of all files): 5 min? 30 min?
- Total run timeout: No limit?

---

#### Q11: How should logging be handled? (Separate files per run? Append? JSON format?)

**Impact:** Affects auditability and debuggability.

---

#### Q12: Should system validate directories and API key on startup before processing?

**Impact:** Affects when errors are caught (early vs. mid-run).

---

#### Q13: Should system show progress during processing? (E.g., "5 of 10 files processed")

**Impact:** Affects user perception of system responsiveness.

---

#### Q14: Can/should users manually resume from partial states?

**Impact:** Affects usability for large batches.

**Example:**
- 100 files converted, analyze starts
- After analyzing 50, user interrupts
- Next run: Resume from file 51? Or start over?

---

#### Q15: How should file permissions and disk space be validated?

**Impact:** Affects reliability in restricted environments.

---

#### Q16: Should report filename include timestamp?

**Impact:** Affects whether multiple runs create separate reports or overwrite.

---

#### Q17: Should there be a --help command documenting all CLI options?

**Impact:** Affects discoverability of features.

---

#### Q18: How should concurrent runs be handled? (Lock files? Error? Warning?)

**Impact:** Prevents accidental double-processing.

---

#### Q19: Should system check for available disk space before starting large conversions?

**Impact:** Prevents "Disk full" errors mid-run.

---

#### Q20: How long should analysis caches be retained? (Forever? 30 days? User-configurable?)

**Impact:** Affects cache size over time.

---

#### Q21: Should there be a "dry run" mode to preview what would be done?

**Impact:** Affects safety for new users.

---

---

## Recommended Next Steps

### Phase 1: Clarify Critical Ambiguities (Priority)

1. **Create Formal Specification Document:**
   - Define CLI interface with all commands, flags, and defaults
   - Document manifest strategy (single vs. two, corruption handling)
   - Specify directory lifecycle and file movements
   - Define per-model caching mechanism and keys
   - Detail error handling and recovery for each stage

2. **Create CLI Reference with Examples:**
   ```bash
   # Full pipeline
   npm run analyze
   npm run analyze --force-convert      # Re-convert, smart analyze
   npm run analyze --model=claude-opus-4-6
   npm run analyze --no-cache

   # Conversion only
   npm run convert
   npm run convert --force

   # Analysis only
   npm run analyze-existing
   npm run analyze-existing --model=claude-sonnet-4-6
   ```

3. **Define Success Criteria Explicitly:**
   - Acceptance criteria for partial successes
   - Minimum viable report content
   - Required vs. optional report sections

### Phase 2: Design Error Handling Strategy

4. **Error Recovery Design Document:**
   - Decision tree for conversion failures (skip/retry/halt)
   - Decision tree for analysis failures
   - Recovery procedure for interrupted runs
   - Rollback strategy for partial failures

5. **Logging & Monitoring Design:**
   - Log file format and locations
   - What should be logged (avoid transcript exposure)
   - How to diagnose common failure modes

### Phase 3: Formalize Data Contracts

6. **Frontmatter Schema Definition:**
   - YAML structure with required vs. optional fields
   - Fallback values for missing fields
   - Validation rules

7. **Cache Key Design:**
   - Formal algorithm for cache key computation
   - Cache invalidation rules
   - Cache persistence and cleanup

### Phase 4: Implementation Guidance

8. **Create Implementation Checklist:**
   - CLI command definitions
   - Manifest state machine diagram
   - Directory operation sequences
   - Test scenarios for each flow

---

## Test Scenarios Requiring Coverage

### Happy Path Tests
- [ ] Full pipeline: 1 .txt file → .md → analysis → report
- [ ] Full pipeline: 10 .txt files → complete report
- [ ] Convert only: 5 .txt files → 5 .md files in output/
- [ ] Analyze only: 5 .md files → report

### Model Switching Tests
- [ ] Run with Haiku, then Opus → both reports generated
- [ ] Run with Haiku again → uses cache (instant)
- [ ] Modify .md file, run Opus → reflects changes

### Error Recovery Tests
- [ ] Conversion fails on 1 of 5 files → analysis continues with 4
- [ ] Analysis fails on 1 of 5 files → report generated with 4
- [ ] API timeout → system retries (verify retry count)
- [ ] Disk full during report generation → graceful error

### Edge Case Tests
- [ ] Empty input/ directory
- [ ] Single large file (10MB+)
- [ ] Files with non-ASCII characters
- [ ] Corrupted manifest → system recovers
- [ ] User Ctrl+C during conversion → can resume
- [ ] File deleted from input/ during processing

### Force Reprocessing Tests
- [ ] --force-convert → re-converts all files
- [ ] --force-analyze → re-analyzes all files
- [ ] --force → both
- [ ] Caches cleared after --force

---

## Conclusion

The unified system specification has strong architectural foundations but lacks formal definition of:

1. **CLI Interface** - Commands, flags, and examples
2. **State Management** - Manifest strategy, directory lifecycle
3. **Error Handling** - Recovery procedures for each failure mode
4. **Data Contracts** - Frontmatter schema, cache key design
5. **Success Criteria** - What constitutes a successful run

**Before implementation begins, recommend:**
- Write formal CLI specification with all commands and flags
- Define manifest state machine with error recovery paths
- Create test case checklist for all permutations and edge cases
- Document acceptance criteria for each flow

These clarifications will prevent costly rework and ensure the implementation matches user expectations.

---

**Analysis Complete:** March 1, 2026
**Next Review:** After clarification document is written
