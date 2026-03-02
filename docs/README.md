# Codebase Documentation Index

This directory contains comprehensive analysis of the Transcript Converter and Analyzer codebases.

## Documents

### 1. **CODEBASE_ANALYSIS.md** (Primary Reference)
**Comprehensive analysis of both projects**

- Architecture & structure overview
- File I/O patterns (validation, symlink detection, size limits)
- API client setup and configuration
- Error handling approaches
- Utility structure and shared code patterns
- Type system and contracts
- Cross-cutting concerns (logging, environment variables, configuration)
- Data flow visualization
- Technology stack comparison
- File paths and line counts reference

**Use this when:** Understanding how the projects are organized and how patterns are implemented.

### 2. **IMPLEMENTATION_PATTERNS.md** (Code Reference)
**Copy-paste ready code patterns from both projects**

- Pattern 1: Safe API Client Management (TypeScript)
- Pattern 2: Safe JSON Parsing (TypeScript)
- Pattern 3: Content Sanitization (TypeScript)
- Pattern 4: File Validation with Size Limits (TypeScript)
- Pattern 5: Atomic File Operations (Python)
- Pattern 6: Idempotent Processing with State Tracking (Python)
- Pattern 7: Graceful Error Handling in Batch Processing (TypeScript)
- Pattern 8: Configuration via Environment Variables
- Pattern 9: Report Generation with Templates (TypeScript)
- Pattern 10: Logging with Structured Output (Python)

Each pattern includes:
- Complete code example
- Usage pattern
- Key benefits
- Quick reference table

**Use this when:** Implementing similar functionality in the unified system.

### 3. **UNIFIED_SYSTEM_RECOMMENDATIONS.md** (Strategy)
**Detailed recommendations for integrating both systems**

- System overview diagram
- Shared data contracts and interfaces
- Integration points between converter and analyzer
- Configuration management approach
- State management strategy
- Implementation phases (5 phases over 1 week)
- Security considerations
- Performance optimization
- Testing strategy
- Rollout plan with success criteria

**Use this when:** Planning the unified system architecture.

---

## Quick Navigation

### For Understanding the Code

1. Start with **CODEBASE_ANALYSIS.md** - "Key Implementation Details for Reuse" section
2. Review **IMPLEMENTATION_PATTERNS.md** - specific pattern you're implementing
3. Check source files directly for complete context

### For Implementation

1. Check **IMPLEMENTATION_PATTERNS.md** for the specific pattern
2. Copy the code example
3. Adjust for your use case
4. Refer back to **CODEBASE_ANALYSIS.md** for context

### For Architecture Design

1. Read **UNIFIED_SYSTEM_RECOMMENDATIONS.md**
2. Review "Integration Points" section
3. Check "Detailed Recommendations by Component"
4. Follow the implementation phases

---

## Key Takeaways

### Architecture

**Transcript Converter (Python):**
- Single file: `convert.py` (~650 lines)
- Manifest-based state tracking (.processed_manifest.json)
- Idempotent processing (hash-based change detection)
- Atomic file operations (temp file + rename)
- Auto-copies to analyzer

**Transcript Analyzer (TypeScript/Node):**
- Multi-agent system (4 agents + synthesis coordinator)
- Parallel + sequential execution pattern
- Type-safe with zero `any` types
- Safe JSON parsing (boundary detection)
- Content sanitization (prompt injection prevention)

### Critical Patterns to Reuse

1. **Safe JSON Parsing** - Use boundary detection (indexOf/lastIndexOf), not regex
2. **Input Validation** - Check file size, symlinks (lstat), permissions
3. **Atomic Writes** - Write to temp file, then rename atomically
4. **Graceful Degradation** - One error doesn't stop batch processing
5. **Content Sanitization** - Remove injection patterns before API calls
6. **Idempotent Processing** - Use hashes to detect if reprocessing needed
7. **Flexible Configuration** - Environment variables with defaults

### Security Best Practices

- Validate all file inputs (size, type, symlinks)
- Sanitize all transcript content before API calls
- Use safe JSON parsing (no regex)
- Implement graceful error handling
- Use environment variables for secrets (no hardcoding)
- Validate environment variables on startup
- Log security events (validation failures)

### Configuration Approach

Both projects support configuration via environment variables:

```bash
# API key (required, same for both)
export ANTHROPIC_API_KEY="sk-ant-..."

# Model selection (optional, Analyzer only)
export MODEL_ID=claude-opus-4-6

# File size limits (optional, Analyzer only)
export MAX_FILE_SIZE=52428800
export MAX_TOTAL_SIZE=524288000
```

---

## File Paths Reference

### TypeScript/Node.js (Analyzer)

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point |
| `src/types.ts` | Type definitions (AnalysisReport, TranscriptMetadata, etc.) |
| `src/utils/client.ts` | API client singleton + model selection |
| `src/utils/parsing.ts` | Safe JSON parsing, sanitization |
| `src/utils/fileHandler.ts` | File I/O with validation |
| `src/utils/reportGenerator.ts` | Markdown report formatting |
| `src/agents/strategicAnalyst.ts` | Agent implementation pattern |
| `src/agents/synthesisCoordinator.ts` | Orchestration pattern |
| `tsconfig.json` | TypeScript config (ES2020, strict mode) |
| `package.json` | Dependencies: @anthropic-ai/sdk, dotenv, ts-node |

### Python (Converter)

| File | Purpose |
|------|---------|
| `convert.py` | Main script (manifest, metadata extraction, file I/O) |
| `projects.json` | Project mapping config |
| `batches.json` | Batch assignment config |
| `.processed_manifest.json` | State tracking (generated) |
| `.conversion.log` | Append-only activity log (generated) |

---

## Development Setup

### Transcript Analyzer (TypeScript)

```bash
# Install
npm install

# Development (recommended)
npm run dev          # ts-node (direct execution)

# Production
npm run build        # Compile to dist/
npm start            # Run compiled version
```

**Configuration:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
npm run dev

# Or with environment variables
MODEL_ID=claude-opus-4-6 MAX_FILE_SIZE=52428800 npm run dev
```

### Transcript Converter (Python)

```bash
# Install
pip install anthropic

# Run
python3 convert.py

# Or with environment variables
TRANSCRIPT_ANALYZER_INPUT=/path/to/analyzer/input python3 convert.py
```

---

## Common Patterns Comparison

| Aspect | TypeScript/Node | Python |
|--------|-----------------|--------|
| **API Client** | Singleton, lazy init | Global instance |
| **Configuration** | Env vars at usage site | Env vars at startup |
| **Error Handling** | Return null + defaults | Exceptions + retry |
| **Logging** | Console only | File + console |
| **State** | In-memory per run | Persistent manifest |
| **Type Safety** | Full (strict mode) | Optional (hints) |
| **JSON Parsing** | Boundary detection | try/except |

---

## Integration Checklist

- [ ] **Data Format:** Agree on metadata frontmatter structure
- [ ] **Configuration:** Centralize settings (API key, models, paths)
- [ ] **Error Handling:** Standardize error codes and messages
- [ ] **Logging:** Unified log format and output
- [ ] **Testing:** Unit + integration + end-to-end tests
- [ ] **Security:** Review for prompt injection, path traversal
- [ ] **Documentation:** User guide, architecture docs, API docs
- [ ] **CLI Tools:** Combined workflow for users

---

## Recent Updates (March 2026)

Both projects have been updated with:

**Analyzer (TypeScript):**
- 8 comprehensive security and reliability fixes
- Safe JSON parsing (replaced regex)
- File validation (size, symlinks, permissions)
- Type safety (no `any` types)
- Error handling improvements

**Converter (Python):**
- Manifest tracking implementation
- Path validation (directory traversal prevention)
- Logging suppression (prevents transcript exposure)
- Atomic file operations
- Comprehensive type hints

---

## Next Steps

1. **Review CODEBASE_ANALYSIS.md** for complete understanding
2. **Check IMPLEMENTATION_PATTERNS.md** for specific patterns you need
3. **Follow UNIFIED_SYSTEM_RECOMMENDATIONS.md** for integration planning
4. **Examine source files** for complete context and implementation details

---

## Questions or Issues?

Refer to:
- **CLAUDE.md** files in each project (comprehensive guidance)
- **ARCHITECTURE_ISSUES_SUMMARY.md** in analyzer (known issues)
- Source code directly (well-commented with examples)

---

**Documentation Generated:** March 2026
**Source Projects:**
- `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer copy/`
- `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-converter copy/`

