# Quick Reference Guide

## File Locations

### Analyzer (TypeScript)
```
transcript-analyzer copy/
├── src/
│   ├── index.ts              Entry point
│   ├── types.ts              Type definitions
│   ├── utils/
│   │   ├── client.ts         API client (PATTERN: Safe API Client)
│   │   ├── parsing.ts        JSON parsing (PATTERN: Safe Parsing)
│   │   ├── fileHandler.ts    File I/O (PATTERN: File Validation)
│   │   └── reportGenerator.ts Report formatting (PATTERN: Report Generation)
│   └── agents/
│       ├── strategicAnalyst.ts      Agent pattern example
│       ├── stakeholderAnalyzer.ts   Agent pattern
│       ├── financialOpsAnalyzer.ts  Agent pattern
│       └── synthesisCoordinator.ts  Orchestration pattern
├── package.json
└── tsconfig.json
```

### Converter (Python)
```
transcript-converter copy/
├── convert.py                Main script
│   ├── compute_file_hash()   (PATTERN: Change Detection)
│   ├── load_manifest()       (PATTERN: State Management)
│   ├── save_manifest()       (PATTERN: Atomic File Operations)
│   ├── is_file_processed()   (PATTERN: Idempotent Processing)
│   ├── extract_metadata()    (PATTERN: Error Handling)
│   └── copy_to_analyzer()    Auto-integration
├── projects.json             Config
└── batches.json              Config
```

---

## Pattern Quick Lookup

### Safe JSON Parsing
**File:** `src/utils/parsing.ts` (lines 35-54)
**Language:** TypeScript
**Key Pattern:** Use `indexOf("{")` and `lastIndexOf("}")` instead of regex
```typescript
const start = text.indexOf("{");
const end = text.lastIndexOf("}");
if (start === -1 || end === -1 || start >= end) return null;
return JSON.parse(text.substring(start, end + 1)) as T;
```

### File Validation
**File:** `src/utils/fileHandler.ts` (lines 15-51)
**Language:** TypeScript
**Key Pattern:** Use `fs.lstatSync()` to detect symlinks, check sizes, permissions
```typescript
const stats = fs.lstatSync(filePath);
if (stats.isSymbolicLink()) return { valid: false };
if (stats.size > MAX_FILE_SIZE) return { valid: false };
fs.accessSync(filePath, fs.constants.R_OK);
```

### Content Sanitization
**File:** `src/utils/parsing.ts` (lines 90-108)
**Language:** TypeScript
**Key Pattern:** Remove injection patterns + control chars + truncate long lines
```typescript
.replace(/ignore\s+previous\s+instructions?/gi, "[removed]")
.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, " ")
.split("\n").map(line => line.length > 10000 ? line.substring(0, 10000) : line)
```

### Atomic File Operations
**File:** `convert.py` (lines 121-157)
**Language:** Python
**Key Pattern:** Write to temp file, atomic rename, cleanup in finally
```python
temp_path = Path(".tmp")
with open(temp_path, 'w') as f:
    json.dump(data, f)
temp_path.replace(final_path)  # Atomic
finally:
    if temp_path.exists(): temp_path.unlink()
```

### Idempotent Processing
**File:** `convert.py` (lines 158-178)
**Language:** Python
**Key Pattern:** Hash comparison to detect modifications
```python
current_hash = compute_file_hash(input_file)
if current_hash == entry["file_hash"]:
    return True  # Skip, unchanged
else:
    return False  # Reprocess, modified
```

### Graceful Degradation
**File:** `src/utils/fileHandler.ts` (lines 99-129)
**Language:** TypeScript
**Key Pattern:** Per-item error handling in batch loops
```typescript
for (const file of files) {
    const item = readFile(file);
    if (item) {
        items.push(item);
    } else {
        errors.push({file, error: "Failed"});  // Log, don't throw
    }
}
return items;  // Return whatever succeeded
```

### Flexible Configuration
**File:** `src/utils/client.ts` (lines 28-40)
**Language:** TypeScript
**Key Pattern:** Environment variable with default, validation
```typescript
const model = process.env.MODEL_ID || "claude-haiku-4-5-20251001";
if (!model.includes("claude-")) {
    throw new Error(`Invalid MODEL_ID: "${model}"`);
}
return model;
```

### Safe API Client
**File:** `src/utils/client.ts` (lines 1-16)
**Language:** TypeScript
**Key Pattern:** Singleton with lazy initialization
```typescript
let client: Anthropic | null = null;
export function getClient(): Anthropic {
    if (!client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error("API key not set");
        client = new Anthropic({ apiKey });
    }
    return client;
}
```

---

## Code Template: Adding a New Agent

```typescript
// src/agents/newAnalysis.ts
import { getClient, getModel } from "../utils/client";
import { TranscriptMetadata, YourResultType } from "../types";
import {
  extractTextContent,
  parseJSON,
  sanitizeTranscriptContent,
} from "../utils/parsing";

export async function analyzeNewTopic(
  transcripts: TranscriptMetadata[]
): Promise<YourResultType> {
  const client = getClient();
  const model = getModel();

  // Sanitize input
  const combinedTranscripts = transcripts
    .map((t) => `[${t.date}]\n${sanitizeTranscriptContent(t.content)}`)
    .join("\n\n");

  // Build prompt
  const prompt = `...your prompt...

<transcripts>
${combinedTranscripts}
</transcripts>`;

  // Call API
  const message = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  // Parse response safely
  const responseText = extractTextContent(message);
  const analysis = parseJSON<YourResultType>(responseText);

  // Return with safe defaults
  return {
    field1: analysis?.field1 || [],
    field2: analysis?.field2 || [],
  };
}
```

---

## Code Template: Adding New File I/O

```typescript
// In src/utils/fileHandler.ts or new module
import * as fs from "fs";
import * as path from "path";

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760");

function validateFile(filePath: string): { valid: boolean; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: "File not found" };
    }

    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink()) {
      return { valid: false, error: "Symlinks not supported" };
    }
    if (stats.size > MAX_FILE_SIZE) {
      return { valid: false, error: "File too large" };
    }

    fs.accessSync(filePath, fs.constants.R_OK);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

export function readCustomFile(filePath: string): CustomType | null {
  const validation = validateFile(filePath);
  if (!validation.valid) {
    console.warn(`⚠️ Skipping ${path.basename(filePath)}: ${validation.error}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return { /* parse content */ };
  } catch (error) {
    console.error(`❌ Error reading ${path.basename(filePath)}`);
    return null;
  }
}
```

---

## Configuration Cheat Sheet

### Run with Different Models
```bash
# Default (Haiku, cheapest)
npm run analyze

# Balanced
MODEL_ID=claude-sonnet-4-6 npm run analyze

# Best quality
MODEL_ID=claude-opus-4-6 npm run analyze

# Custom model
MODEL_ID=claude-3-5-sonnet-20241022 npm run analyze
```

### Adjust File Size Limits
```bash
# Increase both limits
MAX_FILE_SIZE=52428800 MAX_TOTAL_SIZE=524288000 npm run analyze

# 50MB per file, 500MB total
export MAX_FILE_SIZE=52428800
export MAX_TOTAL_SIZE=524288000
npm run analyze
```

### Python Converter
```bash
# Basic usage
python3 convert.py

# Specify analyzer input path
TRANSCRIPT_ANALYZER_INPUT=/path/to/input python3 convert.py

# View log
tail .conversion.log
```

---

## Type Definitions Cheat Sheet

### Core Types
```typescript
interface TranscriptMetadata {
  date: string;
  filename: string;
  content: string;
}

interface AnalysisReport {
  executive_summary: string;
  strategic_analysis: StrategicAnalysis;
  stakeholder_analysis: StakeholderAnalysis;
  financial_ops_analysis: FinancialOpsAnalysis;
  strategic_recommendations: StrategicRecommendation[];
  implementation_timeline: TimelineItem[];
}

interface StrategicAnalysis {
  themes: string[];
  patterns: string[];
  opportunities: string[];
  risks: string[];
}

interface StrategicRecommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  expected_impact: string;
}

interface TimelineItem {
  initiative: string;
  suggested_timeline: string;
  dependencies: string[];
  owner: string;
}
```

---

## Logging Cheat Sheet

### TypeScript (Console)
```typescript
console.log("ℹ️ Info message");
console.warn("⚠️ Warning message");
console.error("❌ Error message");
console.log("✓ Success message");
console.log("📊 Data visualization");
```

### Python (Dual-level)
```python
logger.info("Summary message to console and file")
logger.debug("Detailed diagnostic info to file only")
logger.warning("Non-critical issue")
logger.error("Critical error")

# View recent activity
# tail .conversion.log
```

---

## Security Checklist

When adding new code:
- [ ] Input validation (file size, type, symlinks)
- [ ] Content sanitization (before API calls)
- [ ] Safe JSON parsing (no regex)
- [ ] Error handling (graceful, no throw)
- [ ] Environment validation (on startup)
- [ ] Type safety (no `any` in TypeScript)
- [ ] No hardcoded secrets
- [ ] Logging of security events

---

## Testing Mental Model

**Happy Path:**
- File exists, valid format, passes validation
- API responds with valid JSON
- Report generated successfully

**Error Paths:**
- File doesn't exist → Skip with warning
- File too large → Skip with warning
- File is symlink → Skip with warning
- API fails → Return safe defaults
- JSON parse fails → Return safe defaults
- One file fails → Continue with others

**Security:**
- Injection attempt in transcript → Sanitized
- Directory traversal attempt → Rejected
- Missing API key → Error on startup
- Invalid model name → Error on startup

---

## Common Gotchas

### TypeScript/Node
- Use `lstat` not `stat` for symlink detection
- Use `indexOf/lastIndexOf` not regex for JSON parsing
- Return null instead of throwing on parse errors
- Use safe defaults (`|| []` not `|| throw`)

### Python
- Always clean up temp files in finally blocks
- Use `Path().replace()` for atomic renames
- Compute hash before modifying files
- Don't hardcode API model (make it configurable)

### Both
- Sanitize content before API calls
- Validate configuration on startup
- Log security events (validation, errors)
- Use environment variables for secrets

---

## Debugging Tips

### TypeScript
```typescript
// Enable detailed logging
console.log("Raw response:", JSON.stringify(response, null, 2));

// Check parsing
const parsed = parseJSON<YourType>(text);
if (!parsed) {
  console.log("Parse failed, raw text:", text.substring(0, 200));
}

// Validate file
const validation = validateInputFile(path);
if (!validation.valid) {
  console.log("Validation error:", validation.error);
}
```

### Python
```python
# View detailed logs
tail -f .conversion.log

# Check manifest
python3 -c "import json; print(json.dumps(json.load(open('.processed_manifest.json')), indent=2))"

# Verify API key
echo $ANTHROPIC_API_KEY

# Test file hash
python3 -c "import hashlib; print(hashlib.md5(open('file.txt', 'rb').read()).hexdigest())"
```

---

## Documentation Quick Links

**For Understanding:**
- CODEBASE_ANALYSIS.md → "Key Implementation Details" section
- Source code with line numbers reference

**For Implementation:**
- IMPLEMENTATION_PATTERNS.md → Specific pattern section
- Copy code example, adapt to use case

**For Architecture:**
- UNIFIED_SYSTEM_RECOMMENDATIONS.md → Integration strategy
- Follow 5-phase implementation plan

---

## Metrics at a Glance

| Metric | Value |
|--------|-------|
| TypeScript code | ~500 lines |
| Python code | ~650 lines |
| Documentation | ~3000 lines |
| API calls per analysis | 6 (analyzer) + 1 per file (converter) |
| Cost per analysis | ~$0.10-0.15 (Haiku) |
| Processing time | ~5-8 minutes for 15 transcripts |
| Type safety | 100% (TypeScript strict mode) |
| Error handling | Graceful degradation |

---

**Last Updated:** March 1, 2026
**For Full Documentation:** See README.md
