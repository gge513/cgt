# Unified System Architecture Recommendations

**Objective:** Design a cohesive system integrating transcript converter and analyzer

---

## System Overview

```
User's .txt transcript files
  ↓
┌─────────────────────────────────────────┐
│  Transcript Converter (Python)           │
│  - Convert .txt to .md                  │
│  - Extract date & concepts via AI       │
│  - Track state in manifest              │
│  - Copy to analyzer input folder        │
└─────────────────────────────────────────┘
  ↓
.md files with frontmatter metadata
  ↓
┌─────────────────────────────────────────┐
│  Transcript Analyzer (TypeScript/Node)  │
│  - Multi-agent analysis system          │
│  - Generate strategic report            │
│  - Produce markdown output              │
└─────────────────────────────────────────┘
  ↓
Strategic analysis report
```

---

## Shared Data Contracts

### 1. Metadata Format

**Current:** Converter produces YAML frontmatter, Analyzer reads content

**Unified Format (Markdown frontmatter):**

```markdown
---
date: 2025-11-22
concepts: strategy, budget, operations
source: danielle_george_weekly
batch: Budget_Review_2026
project: Danielle_George_PZC
---

# Meeting Transcript

[Original transcript content...]
```

**Converter Responsibility:**
- Extract `date` from transcript using AI (YYYY-MM-DD format)
- Extract `concepts` using AI (5-10 comma-separated tags)
- Derive `source` from input filename
- Determine `batch` from batches.json
- Determine `project` from projects.json

**Analyzer Responsibility:**
- Parse YAML frontmatter into TranscriptMetadata
- Use metadata for report context (date, project, batch)
- Include metadata in analysis output

### 2. TranscriptMetadata Interface

```typescript
interface TranscriptMetadata {
  // Core content
  date: string;           // YYYY-MM-DD format
  filename: string;       // Original filename
  content: string;        // Markdown content (without frontmatter)

  // Metadata extracted by converter
  concepts?: string[];    // Comma-separated tags from frontmatter
  source?: string;        // Source identifier
  batch?: string;         // Batch assignment
  project?: string;       // Project assignment
}
```

### 3. Analysis Output Format

**Unified Report Should Include:**

```markdown
# Strategic Analysis Report

**Report Generated:** 2025-11-22
**Analyzed Transcripts:** 5 files
**Date Range:** 2025-08-08 to 2025-11-22
**Projects:** Danielle_George_PZC, Finance, General
**Batches:** Budget_Review_2026, Strategic_Planning_Q1_2026

---

## Executive Summary

[Synthesis of all analyses]

---

## Transcript Overview

- **Total Transcripts:** 5
- **Date Range:** 2025-08-08 to 2025-11-22
- **Concept Tags:** [list of all unique concepts from metadata]

| Filename | Date | Project | Batch |
|----------|------|---------|-------|
| ... | ... | ... | ... |

---

[Rest of analysis...]
```

---

## Integration Points

### 1. Converter → Analyzer Handoff

**Current Approach:**
- Converter auto-copies files to `../transcript-analyzer/input/`
- Uses folder structure / batch / project mapping

**Unified Approach:**
- Same auto-copy mechanism
- Converter adds frontmatter metadata
- Analyzer parses frontmatter

**Config Files Used:**
- `projects.json` - Pattern to project mapping
- `batches.json` - File to batch assignment

**Example projects.json:**
```json
{
  "projects": {
    "Danielle-George": "Danielle_George_PZC",
    "Budget": "Finance",
    "Strategic": "Strategic_Planning_Q1",
    "*": "General"
  }
}
```

**Example batches.json:**
```json
{
  "batches": {
    "Budget_Review_2026": [
      "Danielle-George Weekly Meeting transcript (5)",
      "Budget discussion"
    ],
    "Strategic_Planning_Q1_2026": [
      "Danielle-George Weekly Meeting transcript (1)",
      "Danielle-George Weekly Meeting transcript (2)"
    ]
  }
}
```

### 2. Shared Configuration System

**Create: `config/unified.json`**

```json
{
  "converter": {
    "input_dir": "input",
    "output_dir": "output",
    "manifest_file": ".processed_manifest.json",
    "log_file": ".conversion.log",
    "model": "claude-opus-4-1-20250805",
    "api_timeout": 30
  },
  "analyzer": {
    "input_dir": "input",
    "output_dir": "output",
    "model": "claude-haiku-4-5-20251001",
    "max_file_size": 10485760,
    "max_total_size": 104857600,
    "api_timeout": 60
  },
  "shared": {
    "api_key_env": "ANTHROPIC_API_KEY",
    "analyzer_input_env": "TRANSCRIPT_ANALYZER_INPUT",
    "projects_file": "projects.json",
    "batches_file": "batches.json"
  }
}
```

### 3. State Management Across Systems

**Manifest Tracking (Converter):**

```python
manifest = {
  "version": 1,
  "last_run": "2025-11-22T10:30:00Z",
  "processed_files": [
    {
      "input_file": "transcript1.txt",
      "output_file": "2025-11-22_transcript1.md",
      "processed_at": "2025-11-22T10:30:00Z",
      "file_hash": "abc123...",
      "date": "2025-11-22",           # NEW: From AI extraction
      "concepts": ["strategy", "ops"], # NEW: From AI extraction
      "batch": "Budget_Review_2026",
      "project": "Finance"
    }
  ]
}
```

**Analysis State (Analyzer):**

Could track what analyses have been run, but currently stateless (generates new report each run).

---

## Recommended Implementation Strategy

### Phase 1: Standardize Data Format

**Changes to Converter:**
1. Extract `concepts` list from AI response
2. Format frontmatter metadata
3. Use projects.json and batches.json for metadata enrichment
4. Update manifest structure

**Changes to Analyzer:**
1. Parse YAML frontmatter
2. Extract metadata fields
3. Use metadata in report context
4. Update TranscriptMetadata interface

**Timeline:** 1-2 days

### Phase 2: Unified Configuration

**Create centralized config:**
1. Single source of truth for settings
2. Environment variable override system
3. Configuration validation on startup

**Timeline:** 1 day

### Phase 3: Error Handling Standardization

**Adopt unified error handling:**
1. Both systems use consistent error codes
2. Both systems use consistent error messages
3. Both systems implement graceful degradation
4. Both systems log security events

**Timeline:** 1-2 days

### Phase 4: Logging Integration

**Create unified logging:**
1. Consistent timestamp format (ISO 8601 UTC)
2. Structured log format (JSON optional)
3. Both systems write to central log file
4. Log rotation strategy

**Timeline:** 1 day

### Phase 5: Documentation & CLI Integration

**Create user-facing tools:**
1. Combined CLI: `./scripts/process-transcripts.sh`
2. Unified documentation
3. Single setup guide
4. Configuration wizard

**Timeline:** 1-2 days

**Total:** ~1 week for full integration

---

## Detailed Recommendations by Component

### 1. API Client Management

**Recommendation:** Keep separate, but use same pattern

**Converter (Python):**
```python
def get_api_client():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")
    return Anthropic(api_key=api_key)

def get_model():
    return os.getenv("CONVERTER_MODEL", "claude-opus-4-1-20250805")

client = get_api_client()
model = get_model()
```

**Analyzer (TypeScript):**
```typescript
// Already implements flexible model selection via getModel()
// Consider same approach for converter
```

### 2. Configuration Management

**Create unified config module:**

```typescript
// src/config/index.ts
interface UnifiedConfig {
  converter: {
    inputDir: string;
    outputDir: string;
    model: string;
  };
  analyzer: {
    inputDir: string;
    outputDir: string;
    model: string;
    maxFileSize: number;
  };
  shared: {
    apiKey: string;
    logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  };
}

export function loadConfig(): UnifiedConfig {
  return {
    converter: {
      inputDir: process.env.CONVERTER_INPUT_DIR || "input",
      outputDir: process.env.CONVERTER_OUTPUT_DIR || "output",
      model: process.env.CONVERTER_MODEL || "claude-opus-4-1-20250805"
    },
    analyzer: {
      inputDir: process.env.ANALYZER_INPUT_DIR || "input",
      outputDir: process.env.ANALYZER_OUTPUT_DIR || "output",
      model: process.env.ANALYZER_MODEL || "claude-haiku-4-5-20251001",
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760")
    },
    shared: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      logLevel: (process.env.LOG_LEVEL || "INFO") as "DEBUG" | "INFO" | "WARN" | "ERROR"
    }
  };
}
```

### 3. Error Handling Standardization

**Create unified error codes:**

```typescript
enum ErrorCode {
  // File I/O
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_INVALID_FORMAT = "FILE_INVALID_FORMAT",

  // API
  API_KEY_MISSING = "API_KEY_MISSING",
  API_KEY_INVALID = "API_KEY_INVALID",
  API_REQUEST_FAILED = "API_REQUEST_FAILED",
  API_RATE_LIMIT = "API_RATE_LIMIT",

  // Processing
  PROCESSING_FAILED = "PROCESSING_FAILED",
  MANIFEST_CORRUPTED = "MANIFEST_CORRUPTED",
  OUTPUT_WRITE_FAILED = "OUTPUT_WRITE_FAILED"
}

interface SystemError extends Error {
  code: ErrorCode;
  context?: Record<string, any>;
}
```

### 4. Logging Integration

**Create unified logger:**

```typescript
// src/logging/index.ts
interface LogEntry {
  timestamp: string;     // ISO 8601 UTC
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  component: string;     // "converter" or "analyzer"
  message: string;
  context?: Record<string, any>;
}

export function createLogger(component: string): Logger {
  // Log to both console (user-friendly) and file (detailed)
  // With timestamps and structured format
}
```

### 5. Metadata Extraction

**Enhance Converter's extract_metadata() function:**

```python
def extract_metadata(content: str) -> Tuple[str, List[str], Dict[str, str]]:
    """
    Extract date, concepts, and additional metadata.

    Returns:
        Tuple of (date, concepts, additional_metadata)
    """
    # Call AI to extract:
    # 1. date (YYYY-MM-DD)
    # 2. concepts (list of 5-10 tags)
    # 3. sentiment (positive, neutral, negative)
    # 4. key_decisions (list of decisions made)
    # 5. action_items (list of action items)

    return date, concepts, {
        "sentiment": sentiment,
        "key_decisions": key_decisions,
        "action_items": action_items
    }

def convert_txt_to_markdown(input_file: Path, output_dir: Path) -> Tuple[bool, Optional[str]]:
    content = read_file(input_file)

    # Extract all metadata in single API call
    date, concepts, additional = extract_metadata(content)

    # Create frontmatter
    frontmatter = f"""---
date: {date}
concepts: {", ".join(concepts)}
sentiment: {additional["sentiment"]}
key_decisions: {", ".join(additional["key_decisions"])}
---
"""

    # Write with frontmatter + content
    markdown = frontmatter + "\n# Meeting Transcript\n\n" + content
    return write_file(output_file, markdown), output_filename
```

### 6. Report Enhancement

**Analyzer should include converter metadata in report:**

```typescript
function generateMarkdownReport(report: AnalysisReport): string {
  return `# Strategic Analysis Report

**Report Generated:** ${new Date().toLocaleDateString()}
**Analyzed Transcripts:** ${report.transcripts.length}
**Date Range:** ${report.dateRange.start} to ${report.dateRange.end}
**Projects:** ${[...new Set(report.transcripts.map(t => t.project))].join(", ")}
**Batches:** ${[...new Set(report.transcripts.filter(t => t.batch).map(t => t.batch))].join(", ")}
**Unique Concepts:** ${[...new Set(report.transcripts.flatMap(t => t.concepts || []))].join(", ")}

---

## Transcript Summary

| Filename | Date | Project | Batch | Concepts |
|----------|------|---------|-------|----------|
${report.transcripts.map(t =>
  `| ${t.filename} | ${t.date} | ${t.project} | ${t.batch || "-"} | ${(t.concepts || []).join(", ")} |`
).join("\n")}

---

[Rest of analysis...]
`;
}
```

---

## Security Considerations

### 1. API Key Management

**Recommendation:**
- Both systems use same env var: `ANTHROPIC_API_KEY`
- Never commit `.env` file
- Add to `.gitignore`
- Document in `SETUP.md`

### 2. Content Sanitization

**Recommendation:**
- Converter sanitizes content before passing to analyzer
- Analyzer re-sanitizes before API calls
- Defense in depth approach

**Converter (Python):**
```python
def sanitize_content(content: str) -> str:
    # Shared sanitization logic
    # Remove injection patterns
    # Remove control characters
    return cleaned_content
```

**Analyzer (TypeScript):**
```typescript
// Already implements sanitizeTranscriptContent()
// Keep as-is
```

### 3. File Validation

**Recommendation:**
- Converter validates input files before processing
- Analyzer validates input files before reading
- Both enforce size limits

### 4. Path Validation

**Recommendation:**
- Both systems validate paths against safe base directories
- Both detect and reject symlinks
- Both prevent directory traversal

---

## Performance Considerations

### 1. API Calls

**Current:**
- Converter: 1 API call per file (metadata extraction)
- Analyzer: 6 API calls per batch (3 agents × 2 sequential calls)

**Optimization Opportunity:**
- Batch multiple files together in single converter run
- Cache converter metadata to avoid re-extraction

### 2. Processing Time

**Typical Runtime:**
- Converter: ~5-10 seconds per file (depends on file size + API latency)
- Analyzer: ~2-3 minutes for 10-15 files

**Improvement:**
- Parallel file processing in converter (Python's asyncio)
- Batch API requests

### 3. Model Selection for Cost Optimization

**Converter (always use Opus):**
- Reason: Only 1 call per file, quality important for metadata
- Cost: ~$0.50-1.00 per file

**Analyzer (flexible via MODEL_ID):**
- Default (Haiku): ~$0.10-0.15 per analysis (10 files)
- Sonnet: ~$0.50-0.75 per analysis
- Opus: ~$2.50-4.00 per analysis

**Recommendation:**
- Converter: Keep Opus (better metadata quality)
- Analyzer: Default to Haiku (cost-optimized), allow override

---

## Testing Strategy

### 1. Unit Tests

**Converter:**
- Metadata extraction
- File hashing
- Manifest state transitions
- Path validation

**Analyzer:**
- JSON parsing (safe boundary detection)
- Content sanitization
- Report generation
- Type system

### 2. Integration Tests

**Converter → Analyzer:**
- Converter output format
- Metadata completeness
- File organization
- Auto-copy functionality

### 3. End-to-End Tests

**Full Pipeline:**
- Converter processes sample files
- Analyzer reads output
- Report generated successfully
- Metadata included in report

### 4. Security Tests

- Prompt injection attempts blocked
- Large files rejected
- Symlinks rejected
- Directory traversal prevented
- API key required

---

## Rollout Plan

### Week 1: Foundation
- [ ] Create shared data contracts
- [ ] Implement unified error handling
- [ ] Add configuration system
- [ ] Update documentation

### Week 2: Integration
- [ ] Update converter to extract metadata
- [ ] Update analyzer to parse metadata
- [ ] Implement unified logging
- [ ] Add integration tests

### Week 3: Polish
- [ ] Create CLI tools
- [ ] Write user documentation
- [ ] Performance optimization
- [ ] Security review

### Week 4: Release
- [ ] Final testing
- [ ] Documentation review
- [ ] Create release notes
- [ ] Tag version 1.0

---

## Success Criteria

- [ ] Single transcript flows from converter to analyzer without manual steps
- [ ] Metadata from converter appears in analyzer output
- [ ] Error messages are user-friendly and actionable
- [ ] System handles edge cases gracefully
- [ ] Performance is acceptable (< 5 minutes for 15 transcripts)
- [ ] Security review passes (no prompt injection, no directory traversal)
- [ ] Documentation is complete and accurate
- [ ] All tests pass

---

## References

**Converter Source:**
`/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-converter copy/convert.py`

**Analyzer Source:**
`/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer copy/src/`

**Configuration Examples:**
- `projects.json` - Project mapping patterns
- `batches.json` - Batch assignments

**Documentation:**
- `CLAUDE.md` files in both projects
- `CODEBASE_ANALYSIS.md` (comprehensive analysis)
- `IMPLEMENTATION_PATTERNS.md` (code patterns)

