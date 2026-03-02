# Unified Transcript Analyzer Brainstorm
**Date:** March 1, 2026

## What We're Building

A single unified Node.js/TypeScript project that combines the transcript converter and analyzer into one cohesive system. Users can go from raw `.txt` meeting transcripts to strategic analysis reports with simple CLI commands.

**Current state:** Two separate tools (Python converter + Node.js analyzer) requiring manual workflow orchestration.

**Future state:** One project with flexible CLI that supports both simple (one-command) and advanced (multi-stage) workflows.

## Why This Approach

**Workflow Simplification:** Users move from "run converter, then run analyzer" to a single mental model with flexible entry points.

**Single Language Stack:** Eliminates Python/Node.js runtime complexity, shared utilities across stages, easier maintenance.

**Better Integration:** Direct data passing between conversion and analysis stages, no file I/O coordination overhead between processes.

**Flexibility:** Supports both simple use cases (one command) and power users (inspect/modify between stages).

## Key Decisions

### 1. Unified Node.js/TypeScript Codebase
- Rewrite Python converter in TypeScript (port `convert.py` logic)
- Merge both projects into single `package.json`
- Share utilities: parsing, API calls, error handling, logging
- One git repository, one build process

### 2. Staged Directory Structure
```
input/          → Raw .txt transcript files
processing/     → Converted .md files (intermediate stage)
output/         → Final analysis reports
```

Enables users to inspect converted `.md` files before analysis if desired.

### 3. Three CLI Commands (Hybrid Approach)
- **`npm run analyze`** - Full pipeline (default): `.txt` → `.md` → report
  - Best for: Most users, simple workflows, set-it-and-forget-it
- **`npm run convert`** - Conversion only: `.txt` → `.md`
  - Best for: Inspecting conversions, quality review, advanced workflows
- **`npm run analyze-existing`** - Analysis only: `.md` → report
  - Best for: Reusing converted transcripts, iterating on analysis settings

### 4. Preserve Folder Organization
Maintain current converter behavior where action folders flow through stages:
```
input/
├── Strategic_Planning_Q1/
│   ├── meeting_1.txt
│   └── meeting_2.txt
└── Budget_Review_2026/
    └── budget_q1.txt

↓

processing/
├── Strategic_Planning_Q1/
│   ├── 2025-11-22_meeting_1.md
│   └── 2025-11-23_meeting_2.md
└── Budget_Review_2026/
    └── 2025-11-20_budget_q1.md

↓

output/
├── Strategic_Planning_Q1_strategic-analysis-report.md
└── Budget_Review_2026_strategic-analysis-report.md
```

### 5. Manifest-Based State Tracking
Continue converter's approach:
- `.processed_manifest.json` tracks converted files and their hashes
- Prevents re-conversion of unchanged files
- Separate tracking for analysis runs (new manifest or extend existing?)
- Users can force re-processing by deleting manifest if needed

### 6. Unified API Configuration
- Single `ANTHROPIC_API_KEY` environment variable
- Model selection via `MODEL_ID` environment variable
- Separate model choices for conversion vs. analysis? (e.g., Haiku for conversion, Opus for analysis)

### 7. Shared Utilities Architecture
```
src/
├── conversion/           # Port from Python convert.py
│   ├── converter.ts      # Main conversion logic
│   ├── metadata.ts       # Date/concept extraction
│   └── manifest.ts       # State tracking
├── analysis/             # Existing analyzer code
│   ├── agents/
│   ├── synthesis/
│   └── ...
├── utils/                # Shared across both
│   ├── client.ts         # Anthropic API client
│   ├── fileHandler.ts    # File I/O
│   ├── parsing.ts        # JSON parsing, sanitization
│   ├── logging.ts        # Structured logging
│   └── orchestrator.ts   # Pipeline coordination
└── cli.ts               # Command routing
```

## Technical Approach

### Phase 1: Port Python Converter to TypeScript
- Translate `convert.py` metadata extraction logic to `src/conversion/metadata.ts`
- Implement manifest tracking with `src/conversion/manifest.ts`
- Create file I/O utilities in `src/conversion/converter.ts`
- Reuse existing `src/utils/client.ts` for Anthropic API

### Phase 2: Merge Projects
- Copy analyzer source from `transcript-analyzer/src/` to unified `src/analysis/`
- Combine dependencies in single `package.json`
- Create `src/cli.ts` to route commands (`analyze`, `convert`, `analyze-existing`)
- Update `src/utils/fileHandler.ts` to work with new directory structure

### Phase 3: Test & Documentation
- Create combined README with all three CLI commands
- Update setup instructions
- Add examples for each workflow

## Resolved Decisions

### 1. Model Selection Strategy ✓
**Decision:** User-configurable via `MODEL_ID` environment variable
- Users can run same transcripts with different models
- Default: `claude-haiku-4-5-20251001` (cheap, fast)
- Advanced: `MODEL_ID=claude-opus-4-6 npm run analyze` (high-value material)

### 2. Manifest Tracking with Model Support ✓
**Decision:** Single manifest that tracks analyses by model
- One `.processed_manifest.json` file
- Conversions tracked once (no re-conversion)
- Analyses tracked per-model (Haiku results cached separately from Opus results)
- Output reports named by model: `report_haiku.md`, `report_opus.md`

**Manifest structure:**
```json
{
  "processed_files": [
    {
      "input_file": "meeting.txt",
      "output_file": "2025-11-22_meeting.md",
      "conversions": {
        "file_hash": "abc123",
        "converted_at": "2026-03-01T..."
      },
      "analyses": {
        "haiku": {
          "model": "claude-haiku-4-5-20251001",
          "analyzed_at": "2026-03-01T...",
          "report_file": "2025-11-22_report_haiku.md"
        },
        "opus": {
          "model": "claude-opus-4-6",
          "analyzed_at": "2026-03-01T...",
          "report_file": "2025-11-22_report_opus.md"
        }
      }
    }
  ]
}
```

**Use case:** Users can run routine analyses on Haiku (cached cheaply) and occasional high-value material on Opus (cached separately), never re-paying for the same model analysis.

## Remaining Open Questions

1. **Error Handling in Pipeline**
   - If conversion succeeds but analysis fails partway through, what happens?
   - Should we track partial completion or require full re-run?

2. **Force Reprocessing**
   - Should CLI support `--force` or `--no-cache` flags to skip manifest checks?
   - Should be optional or required for some workflows?

3. **Backward Compatibility**
   - Should this new unified project completely replace both old projects?
   - Or keep old projects for reference/fallback?

## Success Criteria

- ✅ Single `npm run analyze` command goes from `.txt` to report with no manual intervention
- ✅ Users can optionally inspect/modify `.md` files between stages
- ✅ Folder organization preserved through all stages
- ✅ Performance comparable to current two-tool approach
- ✅ Setup and installation simplified (one project, one `package.json`)
- ✅ Clear documentation on when to use each CLI command

## Next Steps

1. **Review & clarify:** Answer open questions above
2. **Plan implementation:** Create detailed technical plan with file structure, migration strategy, testing approach
3. **Execute:** Port converter, merge projects, test all three CLI workflows
4. **Deploy:** Update documentation, retire old projects if desired

---

**Recommendation:** This approach provides the simplicity and flexibility you're looking for. The hybrid CLI lets users choose their path: simple one-command workflows or advanced multi-stage workflows with inspection/modification.
