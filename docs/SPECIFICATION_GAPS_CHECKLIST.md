# Implementation Specification Checklist

**Purpose:** Formal checklist of all items requiring specification before implementation

**Status:** INCOMPLETE - Requires clarification and decision on all items

---

## Section 1: CLI Interface Specification

### Required: Command Definitions

- [ ] **Command: `npm run analyze` (or ts-node src/cli.ts analyze)**
  - **Purpose:** Full pipeline - convert .txt to .md, then analyze
  - **Behavior:** ?NEEDS DEFINITION
    - [ ] Accepts input from input/ directory
    - [ ] Converts .txt files (if not already in manifest)
    - [ ] Analyzes converted .md files (if not already cached)
    - [ ] Generates report_[MODEL].md
  - **Exit codes:** ?NEEDS DEFINITION
    - [ ] 0 = Success (all files processed)
    - [ ] 1 = Failure (no files processed)
    - [ ] 2 = Partial success (some files failed)
  - **Output:** ?NEEDS DEFINITION
    - [ ] Console summary with file counts
    - [ ] Path to generated report
    - [ ] Warning about partial failures (if any)

- [ ] **Command: `npm run convert`**
  - **Purpose:** Conversion only (no analysis)
  - **Behavior:** ?NEEDS DEFINITION
    - [ ] Converts .txt files in input/
    - [ ] Outputs .md files to output/ or processing/?
    - [ ] Updates .processed_manifest.json
    - [ ] Does NOT analyze or generate reports
  - **Output:** ?NEEDS DEFINITION
    - [ ] Console summary with conversion counts
    - [ ] Path(s) to converted files

- [ ] **Command: `npm run analyze-existing`**
  - **Purpose:** Analysis only (skip conversion)
  - **Behavior:** ?NEEDS DEFINITION
    - [ ] Reads .md files from output/ or processing/?
    - [ ] Runs analysis agents
    - [ ] Generates report_[MODEL].md
    - [ ] Updates .analysis-manifest-[MODEL].json
    - [ ] Does NOT convert .txt files
  - **Input:** ?NEEDS DEFINITION
    - [ ] Read from output/ directory?
    - [ ] Read from processing/ directory?
    - [ ] User-configurable?

### Required: Flags & Parameters

- [ ] **Flag: `--force` (CRITICAL)**
  - **Effect:** ?NEEDS DEFINITION
    - [ ] Force re-convert all .txt files?
    - [ ] Force re-analyze all .md files?
    - [ ] Both?
  - **Manifest impact:** ?NEEDS DEFINITION
    - [ ] Clear .processed_manifest.json?
    - [ ] Clear .analysis-manifest-*.json?
    - [ ] Both?
  - **File handling:** ?NEEDS DEFINITION
    - [ ] Overwrite existing output/?
    - [ ] Append with timestamps?
  - **Examples:**
    ```bash
    # ?UNDEFINED
    npm run analyze --force
    npm run convert --force
    npm run analyze-existing --force
    ```

- [ ] **Flag: `--force-convert`**
  - **Effect:** ?NEEDS DEFINITION
    - [ ] Force re-convert all .txt files only?
    - [ ] Keep existing analysis caches?
  - **Rationale:** Granular control over reprocessing

- [ ] **Flag: `--force-analyze`**
  - **Effect:** ?NEEDS DEFINITION
    - [ ] Force re-analyze all .md files only?
    - [ ] Keep conversion manifest?
  - **Rationale:** Re-analyze without re-converting

- [ ] **Flag: `--model=MODEL_ID`**
  - **Effect:** Select Claude model for analysis
  - **Examples:** ?NEEDS DEFINITION
    - [ ] `--model=claude-opus-4-6`
    - [ ] `--model=claude-sonnet-4-6`
    - [ ] `--model=claude-haiku-4-5-20251001` (default)
  - **Impact on caching:**
    - [ ] Different model = different cache key?
    - [ ] Cached results used per-model?

- [ ] **Flag: `--no-cache`**
  - **Effect:** ?NEEDS DEFINITION
    - [ ] Ignore .analysis-manifest-*.json?
    - [ ] Re-run analysis even if cached?
    - [ ] Clear caches after run?
  - **Examples:** ?NEEDS DEFINITION
    ```bash
    npm run analyze --no-cache
    npm run analyze --no-cache --model=claude-opus-4-6
    ```

- [ ] **Flag: `--input-dir=PATH`**
  - **Effect:** Override input directory
  - **Default:** `input/`
  - **Required:** Yes/No?
  - **Example:** `npm run analyze --input-dir=/path/to/transcripts`

- [ ] **Flag: `--output-dir=PATH`**
  - **Effect:** Override output directory
  - **Default:** `output/`
  - **Required:** Yes/No?
  - **Example:** `npm run analyze --output-dir=/path/to/reports`

- [ ] **Flag: `--help`**
  - **Effect:** Display help text and usage examples
  - **Content required:** ?NEEDS DEFINITION

### Required: Help Text & Examples

- [ ] **Help text for `analyze` command**
  ```bash
  npm run analyze --help
  ```
  Should display:
    - [ ] One-line description
    - [ ] Usage syntax with all flags
    - [ ] Flag descriptions (purpose, default, required)
    - [ ] Examples (3-5 common use cases)

- [ ] **Help text for `convert` command**

- [ ] **Help text for `analyze-existing` command**

---

## Section 2: Directory & File Management

### Required: Directory Lifecycle Definition

- [ ] **Directory: `input/`**
  - [ ] Purpose: Source .txt files for conversion
  - [ ] Lifecycle: Never modified by system?
  - [ ] Cleanup: User responsibility?
  - [ ] Permissions: Read-only after processing?

- [ ] **Directory: `output/`**
  - [ ] Purpose: ?NEEDS DEFINITION
    - [ ] Final home for .md files after analysis?
    - [ ] Temporary staging during analysis?
    - [ ] Where reports are written?
  - [ ] Lifecycle: ?NEEDS DEFINITION
    - [ ] Cleared at start of run?
    - [ ] Appended to?
    - [ ] Files moved out during processing?

- [ ] **Directory: `processing/`**
  - [ ] Purpose: ?NEEDS DEFINITION
    - [ ] Staging area for files between conversion and analysis?
    - [ ] Optional or mandatory?
    - [ ] Used at all?
  - [ ] Lifecycle: ?NEEDS DEFINITION
    - [ ] Files moved here after conversion?
    - [ ] Files moved to output/ after analysis?
    - [ ] Cleared between runs?

### Required: File Movement Rules

- [ ] **Conversion output location**
  - [ ] input/*.txt → output/*.md ? or processing/*.md ?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Staging between conversion and analysis**
  - [ ] After conversion, files stay in output/?
  - [ ] Or moved to processing/?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Analysis output location**
  - [ ] Analyze from output/ or processing/?
  - [ ] After analysis, files moved to output/?
  - [ ] Or stay where they are?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Report file location**
  - [ ] Written to output/?
  - [ ] Naming convention: `report_[MODEL].md` or `[TIMESTAMP]_report.md`?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Atomic file operations**
  - [ ] Use temp file + rename for atomicity?
  - [ ] Ensure no partial writes?
  - [ ] **Requirement:** Yes/No?

### Required: File Naming Convention

- [ ] **Converted .md files**
  - [ ] Pattern: `YYYY-MM-DD_originalname.md` ?
  - [ ] Date from: Converter extraction or filename?
  - [ ] **Convention:** ?NEEDS DEFINITION

- [ ] **Report files**
  - [ ] Pattern: `report_[MODEL].md` ?
  - [ ] Should include timestamp?
  - [ ] Should overwrite previous or append?
  - [ ] **Convention:** ?NEEDS DEFINITION

- [ ] **Manifest files**
  - [ ] Conversion: `.processed_manifest.json` (decided ✓)
  - [ ] Analysis: `.analysis-manifest-[MODEL].json` ?
  - [ ] Or `.analysis-manifest.json` with per-model entries?
  - [ ] **Convention:** ?NEEDS DEFINITION

---

## Section 3: Manifest & State Management

### Critical: Manifest Strategy

- [ ] **Decision: Single vs. Multiple Manifests**
  - **Option A: Single manifest**
    ```json
    {
      "version": 1,
      "processed_files": [...],
      "analysis_cache_haiku": {...},
      "analysis_cache_opus": {...}
    }
    ```
  - **Option B: Multiple manifests**
    ```
    .processed_manifest.json (conversion)
    .analysis-manifest-haiku.json (Haiku analysis)
    .analysis-manifest-opus.json (Opus analysis)
    ```
  - [ ] **DECISION:** ?NEEDS DEFINITION

- [ ] **Manifest schema for conversion**
  - [ ] Required fields: input_file, output_file, processed_at, file_hash
  - [ ] Optional fields: date, concepts, project, batch
  - [ ] **Schema:** ?NEEDS FORMAL DEFINITION

- [ ] **Manifest schema for analysis caching**
  - [ ] Cache key computation: How? SHA256(files + model)?
  - [ ] Cached content: Full report? Structured data?
  - [ ] Timestamp: For cache invalidation?
  - [ ] **Schema:** ?NEEDS FORMAL DEFINITION

### Required: Manifest Corruption Recovery

- [ ] **If .processed_manifest.json corrupted**
  - [ ] Option A: Regenerate from scratch (reprocess all)
  - [ ] Option B: Use file hashes to verify state
  - [ ] Option C: Ask user for manual recovery
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **If .analysis-manifest-[MODEL].json corrupted**
  - [ ] Clear it and regenerate?
  - [ ] Keep other models' caches?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Recovery procedure on startup**
  - [ ] Validate manifest on load?
  - [ ] Repair if possible or regenerate?
  - [ ] **Procedure:** ?NEEDS DEFINITION

### Required: Manifest Versioning

- [ ] **Schema version field**
  - [ ] Allows future format changes
  - [ ] Current version: 1
  - [ ] Upgrade/downgrade logic: ?NEEDS DEFINITION

- [ ] **Cache invalidation on version change**
  - [ ] Automatically clear cache on version bump?
  - [ ] Or require user to clear?
  - [ ] **Policy:** ?NEEDS DEFINITION

---

## Section 4: Error Handling & Recovery

### Critical: Conversion Stage Errors

- [ ] **File not found**
  - [ ] Behavior: Skip / Retry / Halt?
  - [ ] Log level: Warning / Error?
  - [ ] Continue next file: Yes / No?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **File too large (exceeds size limit)**
  - [ ] Behavior: Skip / Reject / Resize?
  - [ ] Size limit value: ?NEEDS DEFINITION
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **File encoding invalid (UTF-8 decode fails)**
  - [ ] Behavior: Skip / Retry with fallback encoding / Halt?
  - [ ] Fallback encodings: ISO-8859-1? CP1252?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **API timeout (conversion takes >30s)**
  - [ ] Behavior: Skip / Retry / Halt?
  - [ ] Retry strategy: Immediate? Exponential backoff?
  - [ ] Max retries: 3? 5? Unlimited?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **API rate limiting (429 Too Many Requests)**
  - [ ] Behavior: Skip / Retry with backoff / Halt?
  - [ ] Backoff strategy: Exponential? Linear? Wait time?
  - [ ] Max wait: 60s? 5 min? Until quota reset?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **API server error (500, 503)**
  - [ ] Behavior: Skip / Retry / Halt?
  - [ ] Retry strategy: Exponential backoff?
  - [ ] Max retries: ?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Manifest update failure (write error)**
  - [ ] Behavior: Continue (data loss risk) / Halt?
  - [ ] Recovery: Atomic write with temp file?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Output write failure (permission denied)**
  - [ ] Behavior: Skip / Halt?
  - [ ] Fallback directory: Temp? CWD?
  - [ ] **Decision:** ?NEEDS DEFINITION

### Critical: Analysis Stage Errors

- [ ] **File not found (deleted during analysis)**
  - [ ] Behavior: Skip / Halt / Warn?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **File too large (exceeds size limit)**
  - [ ] Behavior: Skip / Halt?
  - [ ] Size limit: ?NEEDS DEFINITION
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Frontmatter parsing error (malformed YAML)**
  - [ ] Behavior: Skip / Use defaults / Halt?
  - [ ] Default values: date="Unknown", concepts=[]?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Single agent fails (1 of 3 agents fails)**
  - [ ] Continue with 2 agents: Yes / No?
  - [ ] Report incomplete sections: Yes / No?
  - [ ] Recommendations without full data: Acceptable / No?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **All agents fail (analysis cannot proceed)**
  - [ ] Behavior: Skip file / Skip analysis / Halt?
  - [ ] Generate empty report: Yes / No?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Report generation fails (template error)**
  - [ ] Discard partial results: Yes / No?
  - [ ] Write incomplete report: Yes / No?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Cache corruption (analysis manifest malformed)**
  - [ ] Clear cache and regenerate: Yes / No?
  - [ ] Preserve other model caches: Yes / No?
  - [ ] **Decision:** ?NEEDS DEFINITION

### Required: User Prompting Strategy

- [ ] **Conversion fails on some files**
  - [ ] Option A: Automatically skip, warn user, continue
  - [ ] Option B: Prompt user: "Skip file X? [Y/n]"
  - [ ] Option C: Halt and require manual intervention
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Analysis fails on some files**
  - [ ] Same options as conversion?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Large batch operations**
  - [ ] Prompt before expensive operations (convert 100 files)?
  - [ ] Show estimated cost/time?
  - [ ] **Decision:** ?NEEDS DEFINITION

### Required: Interrupted Process Recovery

- [ ] **If user Ctrl+C during conversion**
  - [ ] Can resume from partial state: Yes / No?
  - [ ] How to identify where it stopped?
  - [ ] **Strategy:** ?NEEDS DEFINITION

- [ ] **If user Ctrl+C during analysis**
  - [ ] Save partial analysis caches?
  - [ ] Resume next time?
  - [ ] **Strategy:** ?NEEDS DEFINITION

- [ ] **On next run after interruption**
  - [ ] Idempotent restart (process everything, skip unchanged)?
  - [ ] Smart resume (resume from interruption point)?
  - [ ] User selectable?
  - [ ] **Strategy:** ?NEEDS DEFINITION

---

## Section 5: Caching Strategy

### Critical: Cache Key Design

- [ ] **How is cache key computed?**
  - [ ] Option A: SHA256(all input files + model ID)
  - [ ] Option B: SHA256(manifest version + model ID)
  - [ ] Option C: Per-file hashes (complex)
  - [ ] **DECISION:** ?NEEDS DEFINITION

- [ ] **Does cache key include:**
  - [ ] [ ] File content (any change = cache miss)
  - [ ] [ ] File list (file added/removed = cache miss)
  - [ ] [ ] File order (order change = cache miss)
  - [ ] [ ] File metadata (date, concepts)
  - [ ] [ ] Model ID (different model = different cache)
  - [ ] [ ] Model version (claude-3 vs claude-3.5 = different cache)

- [ ] **Cache key format**
  - [ ] Plain text or hashed?
  - [ ] How is it stored in manifest?
  - [ ] **Format:** ?NEEDS DEFINITION

### Required: Cache Invalidation Rules

- [ ] **Any file in input/ is modified**
  - [ ] Automatically invalidate cache?
  - [ ] Check file hashes on each run?
  - [ ] **Rule:** ?NEEDS DEFINITION

- [ ] **File added to input/**
  - [ ] Invalidate entire cache?
  - [ ] Only re-analyze new file?
  - [ ] Merge results?
  - [ ] **Rule:** ?NEEDS DEFINITION

- [ ] **File deleted from input/**
  - [ ] Invalidate cache?
  - [ ] Update report without that file?
  - [ ] **Rule:** ?NEEDS DEFINITION

- [ ] **Metadata in frontmatter changed**
  - [ ] Invalidate cache?
  - [ ] Re-analyze?
  - [ ] **Rule:** ?NEEDS DEFINITION

- [ ] **Model version updated (API model changes)**
  - [ ] Invalidate cache?
  - [ ] Require --no-cache flag?
  - [ ] Automatic retry?
  - [ ] **Rule:** ?NEEDS DEFINITION

### Required: Cache Retention Policy

- [ ] **How long are caches kept?**
  - [ ] Forever?
  - [ ] 30 days?
  - [ ] User-configurable?
  - [ ] **Policy:** ?NEEDS DEFINITION

- [ ] **Max cache size**
  - [ ] Unlimited?
  - [ ] 1GB? 10GB?
  - [ ] Per-model or total?
  - [ ] **Policy:** ?NEEDS DEFINITION

- [ ] **Cache cleanup**
  - [ ] Automatic on old entries?
  - [ ] Manual via `--clear-cache` flag?
  - [ ] Per-model clearing?
  - [ ] **Policy:** ?NEEDS DEFINITION

---

## Section 6: Data Format & Metadata

### Required: Frontmatter Schema

- [ ] **YAML frontmatter format**
  ```yaml
  ---
  date: 2025-01-15
  concepts: strategy, operations, budget
  source: danielle_george_weekly
  batch: Budget_Review_2026
  project: Danielle_George_PZC
  ---
  ```
  - [ ] Required fields: date, concepts?
  - [ ] Optional fields: source, batch, project?
  - [ ] Additional fields allowed?
  - [ ] **Schema:** ?NEEDS FORMAL DEFINITION

- [ ] **Date field format**
  - [ ] ISO 8601 (YYYY-MM-DD)?
  - [ ] Natural language (extracted by AI)?
  - [ ] Fallback if missing: "Unknown"?
  - [ ] **Format:** ?NEEDS DEFINITION

- [ ] **Concepts field format**
  - [ ] Comma-separated string?
  - [ ] JSON array?
  - [ ] How many: 5-10 concepts?
  - [ ] Fallback if missing: empty list?
  - [ ] **Format:** ?NEEDS DEFINITION

- [ ] **How frontmatter is parsed**
  - [ ] YAML library?
  - [ ] Manual regex?
  - [ ] Error handling on malformed?
  - [ ] Fallback values?
  - [ ] **Implementation:** ?NEEDS DEFINITION

- [ ] **Files without frontmatter**
  - [ ] Treated as error?
  - [ ] Process with defaults?
  - [ ] Skip?
  - [ ] **Behavior:** ?NEEDS DEFINITION

### Required: Model-Specific Report Format

- [ ] **Should different models generate different report content?**
  - [ ] Option A: Same structure, different depth (Haiku brief, Opus detailed)
  - [ ] Option B: Same structure, same content (only cost differs)
  - [ ] **DECISION:** ?NEEDS DEFINITION

- [ ] **Report file naming**
  - [ ] Pattern: `report_[MODEL].md` (report_haiku.md, report_opus.md)
  - [ ] Pattern: `[MODEL]-report.md` (haiku-report.md, opus-report.md)
  - [ ] Include timestamp: `report_[MODEL]_[TIMESTAMP].md`?
  - [ ] **Convention:** ?NEEDS DEFINITION

- [ ] **Multi-model comparison report**
  - [ ] Should there be a comparison view?
  - [ ] Show differences between Haiku and Opus?
  - [ ] Single "consensus" report?
  - [ ] **Requirement:** Yes / No / Optional?

### Required: Analysis Output Format

- [ ] **What metadata should appear in report?**
  - [ ] [ ] Date range of transcripts
  - [ ] [ ] Project names
  - [ ] [ ] Batch names
  - [ ] [ ] Concept tags
  - [ ] [ ] All file names
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Should report include transcripts or just analysis?**
  - [ ] Full transcripts in report?
  - [ ] Snippets in report?
  - [ ] Just analysis summaries?
  - [ ] **Decision:** ?NEEDS DEFINITION

---

## Section 7: Configuration & Environment

### Required: Configuration Loading

- [ ] **Environment variables supported**
  - [ ] `ANTHROPIC_API_KEY` (required)
  - [ ] `MODEL_ID` (optional, default=haiku)
  - [ ] `MAX_FILE_SIZE` (optional, default=10MB)
  - [ ] `MAX_TOTAL_SIZE` (optional, default=100MB)
  - [ ] Others: ?NEEDS DEFINITION

- [ ] **Configuration file support**
  - [ ] `config.json` or `config.yaml`?
  - [ ] Required or optional?
  - [ ] What settings can be configured?
  - [ ] **Support:** Yes / No?

- [ ] **Command-line arguments override env vars**
  - [ ] `--model=opus` overrides `MODEL_ID` env var?
  - [ ] `--input-dir` overrides default?
  - [ ] **Precedence:** CLI > Env > Config > Defaults?

### Required: Startup Validation

- [ ] **Validate environment on startup**
  - [ ] Check `ANTHROPIC_API_KEY` set?
  - [ ] Validate API key format?
  - [ ] Test API connectivity before processing?
  - [ ] **Requirements:** ?NEEDS DEFINITION

- [ ] **Validate directories on startup**
  - [ ] Check input/ exists and readable?
  - [ ] Check output/ writable (create if missing)?
  - [ ] Check processing/ permissions?
  - [ ] **Requirements:** ?NEEDS DEFINITION

- [ ] **Validate disk space**
  - [ ] Check available space before conversion?
  - [ ] Estimate required space?
  - [ ] Warn if low on space?
  - [ ] **Requirement:** Yes / No?

### Required: Timeout Configuration

- [ ] **API call timeout**
  - [ ] Default: 30s? 60s? 120s?
  - [ ] Configurable: Yes / No?
  - [ ] **Value:** ?NEEDS DEFINITION

- [ ] **Stage timeout (all files in stage)**
  - [ ] Default: 5 min? 30 min? Unlimited?
  - [ ] Configurable: Yes / No?
  - [ ] **Value:** ?NEEDS DEFINITION

- [ ] **Total run timeout**
  - [ ] Default: Unlimited?
  - [ ] Configurable: Yes / No?
  - [ ] **Value:** ?NEEDS DEFINITION

---

## Section 8: Logging & Monitoring

### Required: Log Output

- [ ] **Console output (user-facing)**
  - [ ] INFO level: File counts, progress, summary
  - [ ] WARN level: Recoverable errors
  - [ ] ERROR level: Fatal errors
  - [ ] **Levels:** ?NEEDS DEFINITION

- [ ] **File logging (audit trail)**
  - [ ] Log file location: `.conversion.log`, `.analysis.log`, etc.?
  - [ ] Format: Human-readable or JSON?
  - [ ] Content: Include timestamps, file names, API costs?
  - [ ] **Requirement:** ?NEEDS DEFINITION

- [ ] **Logging security considerations**
  - [ ] Should transcript content be logged? (Privacy!)
  - [ ] Should API keys be logged?
  - [ ] Should API responses be logged?
  - [ ] **Policy:** ?NEEDS DEFINITION

- [ ] **Log rotation**
  - [ ] Append to file or rotate?
  - [ ] Max file size before rotation?
  - [ ] Retention period?
  - [ ] **Policy:** ?NEEDS DEFINITION

### Required: User Progress Feedback

- [ ] **Progress indication during processing**
  - [ ] Show "N of M files processed"?
  - [ ] Show estimated time remaining?
  - [ ] Show current file being processed?
  - [ ] **Features:** ?NEEDS DEFINITION

- [ ] **Cost estimation**
  - [ ] Show estimated API cost before processing?
  - [ ] Show actual cost after processing?
  - [ ] Warn about high-cost operations?
  - [ ] **Features:** ?NEEDS DEFINITION

- [ ] **Performance metrics**
  - [ ] Show elapsed time?
  - [ ] Show processing speed (files/sec)?
  - [ ] Show API latency?
  - [ ] **Features:** ?NEEDS DEFINITION

---

## Section 9: Testing & Acceptance

### Required: Success Criteria

- [ ] **Full pipeline success criteria**
  - [ ] All files processed successfully?
  - [ ] Partial success (some files failed) acceptable?
  - [ ] At least 1 file must be analyzed?
  - [ ] Report must be valid markdown?
  - [ ] **Criteria:** ?NEEDS FORMAL DEFINITION

- [ ] **Conversion success criteria**
  - [ ] All .txt files must convert?
  - [ ] Partial success acceptable?
  - [ ] Output files must exist and be valid markdown?
  - [ ] Manifest must be updated?
  - [ ] **Criteria:** ?NEEDS FORMAL DEFINITION

- [ ] **Analysis success criteria**
  - [ ] All .md files must be analyzed?
  - [ ] Partial success acceptable?
  - [ ] Report must include all agents' perspectives?
  - [ ] Missing sections acceptable?
  - [ ] **Criteria:** ?NEEDS FORMAL DEFINITION

- [ ] **Exit codes mapping**
  - [ ] 0 = Full success
  - [ ] 1 = Partial success or warnings?
  - [ ] 2 = Total failure?
  - [ ] **Mapping:** ?NEEDS DEFINITION

### Required: Edge Case Coverage

- [ ] **Empty input/**
  - [ ] Expected behavior: Warn and exit?
  - [ ] Exit code: 0 or 1?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Zero files to analyze**
  - [ ] All files already processed, cached?
  - [ ] Expected behavior: Return cached report?
  - [ ] Generate new report anyway?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Single very large file (10MB+)**
  - [ ] Conversion succeeds?
  - [ ] Analysis fails on size limit?
  - [ ] Expected behavior: Skip and continue?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Files with non-ASCII characters**
  - [ ] UTF-8 supported: Yes / No?
  - [ ] Other encodings: Yes / No?
  - [ ] Fallback if invalid: Skip / Error?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Permission denied on directories**
  - [ ] input/ not readable: Stop or skip?
  - [ ] output/ not writable: Stop or use temp?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Symlinks in input/**
  - [ ] Follow symlinks: Yes / No?
  - [ ] Reject symlinks: Skip / Error?
  - [ ] **Decision:** ?NEEDS DEFINITION (Current: Reject)

- [ ] **File deleted during processing**
  - [ ] Detect and skip?
  - [ ] Error and halt?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Files added during processing**
  - [ ] Include in current run?
  - [ ] Process in next run?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Clock skew (system time changes)**
  - [ ] Timestamp-based caching affected?
  - [ ] Manifests affected?
  - [ ] **Consideration:** Yes / No?

- [ ] **Disk full during processing**
  - [ ] Detect before writing?
  - [ ] Graceful error: Yes / No?
  - [ ] Rollback partial writes?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **API rate limiting (429)**
  - [ ] Automatic retry: Yes / No?
  - [ ] Max wait time?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **API overload (503)**
  - [ ] Automatic retry: Yes / No?
  - [ ] Backoff strategy?
  - [ ] **Decision:** ?NEEDS DEFINITION

- [ ] **Network timeout (no response)**
  - [ ] Retry: Yes / No?
  - [ ] Timeout value?
  - [ ] **Decision:** ?NEEDS DEFINITION

### Required: Test Scenarios

#### Happy Path Tests
- [ ] Test 1: Convert 1 file, analyze, generate report
- [ ] Test 2: Convert 10 files, analyze all, generate report
- [ ] Test 3: Convert only (no analysis)
- [ ] Test 4: Analyze only (skip conversion)
- [ ] Test 5: Idempotent (run twice, second is fast)

#### Model Switching Tests
- [ ] Test 6: Run with Haiku, then Opus (separate reports)
- [ ] Test 7: Run with Haiku twice (cache hit, instant)
- [ ] Test 8: Modify file, run again (cache miss, re-analyze)
- [ ] Test 9: Multiple models, compare reports

#### Error Recovery Tests
- [ ] Test 10: Conversion fails on 1 of 5 files (skip, continue)
- [ ] Test 11: Analysis fails on 1 of 5 files (skip, continue)
- [ ] Test 12: API timeout (retry mechanism)
- [ ] Test 13: API rate limiting (backoff, retry)
- [ ] Test 14: Disk full during report write (graceful error)

#### Edge Case Tests
- [ ] Test 15: Empty input/ directory (warn, exit)
- [ ] Test 16: Large file (10MB+) (handle/skip appropriately)
- [ ] Test 17: Non-ASCII characters (process correctly)
- [ ] Test 18: Corrupted manifest (recover or regenerate)
- [ ] Test 19: Permission denied on output/ (error handling)
- [ ] Test 20: Symlinks in input/ (skip with warning)

#### Force Reprocessing Tests
- [ ] Test 21: `--force` flag (reprocess everything)
- [ ] Test 22: `--force-convert` (re-convert, smart analyze)
- [ ] Test 23: `--force-analyze` (re-analyze, skip conversion)

#### Interruption Tests
- [ ] Test 24: Ctrl+C during conversion (graceful cleanup)
- [ ] Test 25: Ctrl+C during analysis (save partial caches)
- [ ] Test 26: Resume after interruption (idempotent restart)

---

## Section 10: Integration & Deployment

### Required: Python ↔ Node.js Integration

- [ ] **Python converter invocation**
  - [ ] How does Node.js call Python converter?
  - [ ] Subprocess? Child process? Shell command?
  - [ ] Error handling if Python not installed?
  - [ ] **Method:** ?NEEDS DEFINITION

- [ ] **File handoff mechanism**
  - [ ] Python writes .md to output/
  - [ ] Node.js reads from output/ or intermediate location?
  - [ ] Synchronization: Does Node wait for Python?
  - [ ] **Mechanism:** ?NEEDS DEFINITION

- [ ] **Manifest synchronization**
  - [ ] Python writes .processed_manifest.json
  - [ ] Node.js reads the same file?
  - [ ] Lock/wait mechanism?
  - [ ] **Synchronization:** ?NEEDS DEFINITION

### Required: Setup & Installation

- [ ] **Initial setup steps**
  1. [ ] Clone/download repository
  2. [ ] Install Python (version: 3.8+?)
  3. [ ] Install Node.js (version: 16+?)
  4. [ ] `pip install anthropic`
  5. [ ] `npm install`
  6. [ ] Set `ANTHROPIC_API_KEY`
  7. [ ] Run `npm run analyze`
  - [ ] **Checklist:** ?NEEDS DOCUMENTATION

- [ ] **First-run checklist**
  - [ ] API key validation
  - [ ] Directory creation
  - [ ] Sample data (included or user-provided?)
  - [ ] **Checklist:** ?NEEDS DEFINITION

### Required: Deployment Considerations

- [ ] **Docker support**
  - [ ] Dockerfile included: Yes / No?
  - [ ] Docker Compose: Yes / No?
  - [ ] Volume mounts for input/output directories?
  - [ ] **Support:** ?NEEDS DEFINITION

- [ ] **GitHub Actions / CI/CD**
  - [ ] Automated testing: Yes / No?
  - [ ] Test on multiple Node versions?
  - [ ] Test on multiple Python versions?
  - [ ] **Support:** ?NEEDS DEFINITION

- [ ] **Concurrent runs**
  - [ ] Lock file to prevent simultaneous runs: Yes / No?
  - [ ] Error if already running: Yes / No?
  - [ ] Queue runs: Yes / No?
  - [ ] **Policy:** ?NEEDS DEFINITION

---

## Completion Checklist

Before implementation begins, the following must be completed:

### Phase 0: Specification Finalization (BLOCKING)
- [ ] Answer all **CRITICAL TIER** questions (Q1-Q7)
- [ ] Create formal CLI specification with all commands and flags
- [ ] Define directory lifecycle (input/ → output/ → processing/, or alternative)
- [ ] Define manifest strategy (single vs. multiple, schema)
- [ ] Define error handling decision trees for each error type
- [ ] Define per-model cache design and keys
- [ ] Create state machine diagrams for full pipeline
- [ ] Define success/failure criteria for each flow

### Phase 1: Implementation Planning
- [ ] Design document with all specifications locked
- [ ] Test case checklist (minimum 26 test scenarios)
- [ ] Data flow diagrams (ASCII or Mermaid)
- [ ] Code architecture sketch (entry points, module structure)
- [ ] Dependency decisions (libraries, frameworks)

### Phase 2: Implementation
- [ ] CLI module (commands, flags, help)
- [ ] Manifest management (load, save, recovery)
- [ ] Directory operations (staging, file moves)
- [ ] Error handling (per-error recovery)
- [ ] Cache management (keys, invalidation, persistence)
- [ ] Logging (console, file, structured)

### Phase 3: Testing
- [ ] All 26+ test scenarios passing
- [ ] Edge cases handled gracefully
- [ ] Error messages user-friendly
- [ ] Performance acceptable (<5 min for 15 files)

### Phase 4: Documentation
- [ ] User guide (commands, examples, troubleshooting)
- [ ] Architecture guide (design decisions, data flow)
- [ ] API documentation (if modular)
- [ ] Deployment guide (setup, configuration, Docker)

---

**Total Decisions Required:** ~120 items
**Estimated Time to Complete:** 2-3 days of analysis and decision-making
**Critical Blockers:** 7 questions
**Implementation Complexity:** Moderate-High (state management is complex)

---

**Last Updated:** March 1, 2026
**Status:** REQUIRES STAKEHOLDER DECISIONS
