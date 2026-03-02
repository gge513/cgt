# Agent-Native Quick Reference

## System Overview

```
User/Agent Input          Conversion Pipeline        Analysis Pipeline        Output & KMS
─────────────────────┬─────────────────────────┬──────────────────────┬──────────────────
input/                │ .txt → .md conversion  │  Multi-agent analysis │ output/
 ├─ meeting.txt ─────→│ • Extract metadata     │  • Synthesizer ──────→│  report.md
 └─ strategy.txt      │ • Generate markdown    │  • Strategist        │
                      │ • Track via manifest   │  • Impact Analyst    │
                      ↓                        ↓                       ↓
              processing/                                        .processed_kms.json
               ├─ meeting.md                                    (Decisions, Actions,
               └─ strategy.md                                    Commitments, Risks)
```

## Agent Capabilities (Current vs Needed)

### ✅ FULLY SUPPORTED TODAY

**CLI Commands** (Non-interactive, fully automatable)
```bash
npm run analyze              # Full pipeline
npm run convert              # Conversion only
npm run analyze-existing     # Analysis only
npm run kms --summary        # KMS statistics
npm run kms --type decision  # Query by type
npm run kms -k "keyword"     # Keyword search
```

**REST APIs** (Fully functional)
```
GET /api/kms/summary                    # Statistics
GET /api/kms/decisions?status=pending   # Filter by status
GET /api/kms/decisions?owner=Alice      # Filter by owner
GET /api/kms/decisions?keyword=X        # Filter by keyword
POST /api/kms/validate                  # Validate relationships
POST /api/kms/actions                   # Mark escalated/resolved
```

### ⚠️ PARTIALLY SUPPORTED (Requires Workaround)

**File Operations**
```bash
# Agent must use bash:
cat .processed_manifest.json  # Check manifest (manual JSON parsing)
ls input/                      # List files (bash command)
cp file.txt input/             # Upload (bash command)
```

**Analysis Trigger**
```bash
# Agent must subprocess npm and parse exit codes:
npm run analyze  # Works but not ideal for error handling
```

### ❌ NOT YET SUPPORTED (Critical Gaps)

**File Upload API**
```
POST /api/kms/transcripts         # MISSING - needed for autonomous operation
```

**Analysis Trigger API**
```
POST /api/analysis/analyze         # MISSING - would improve error handling
```

**System State API**
```
GET /api/analysis/state            # MISSING - agent can't verify readiness
```

---

## Decision Tree: Can Agent Do X?

```
┌─ "Upload a transcript?"
│  ├─ Programmatically (API)? ❌ NO → Need POST /api/kms/transcripts
│  └─ Via bash? ⚠️ YES → Works but not ideal
│
├─ "Query decisions by status?"
│  └─ Via API? ✅ YES → GET /api/kms/decisions?status=pending
│
├─ "Trigger analysis?"
│  ├─ Programmatically (API)? ❌ NO → Need POST /api/analysis/analyze
│  └─ Via CLI? ⚠️ YES → npm run analyze (subprocess)
│
├─ "Check system readiness?"
│  ├─ Programmatically (API)? ❌ NO → Need GET /api/analysis/state
│  └─ Manually (JSON)? ⚠️ YES → cat .processed_manifest.json
│
├─ "Search by keyword?"
│  ├─ Via API? ❌ NO → Need REST endpoint
│  └─ Via CLI? ✅ YES → npm run kms -k "keyword"
│
├─ "Validate relationships?"
│  └─ Via API? ✅ YES → POST /api/kms/validate
│
└─ "Mark decision escalated?"
   └─ Via API? ✅ YES → POST /api/kms/actions
```

---

## API Endpoint Coverage

### Complete (Full CRUD)
| Endpoint | GET | POST | PUT | DELETE | Status |
|----------|-----|------|-----|--------|--------|
| /api/kms/summary | ✅ | - | - | - | Complete |
| /api/kms/decisions | ✅ (filtered) | - | - | - | Complete |
| /api/kms/validate | ✅ | ✅ | - | - | Complete |
| /api/kms/actions | ✅ | ✅ | - | - | Partial (no filtering) |

### Incomplete (Missing Endpoints)
| Endpoint | Needed | Reason |
|----------|--------|--------|
| /api/kms/transcripts | POST | File upload |
| /api/kms/transcripts | GET | List uploaded files |
| /api/analysis/analyze | POST | Trigger analysis |
| /api/analysis/state | GET | Check readiness |
| /api/kms/decisions/{id} | GET | Single item detail |
| /api/kms/search | GET | Keyword search API |

---

## Implementation Roadmap

### Phase 1: Critical Gaps (1.5 Days) → 90% Agent-Native
```
Day 1:
  □ POST /api/kms/transcripts          [3 hours]
  □ POST /api/analysis/analyze         [4 hours]
  □ GET /api/analysis/state            [2 hours]
  
Day 2:
  □ Write & run tests                  [3 hours]
  □ Integration test (full workflow)   [1 hour]
  □ Update docs                        [1 hour]

Result: Agent can autonomously upload, analyze, and query
```

### Phase 2: High Value (1 Day) → 95% Agent-Native
```
□ Complete /api/kms/actions filtering  [1 hour]
□ Add /api/kms/{type}/{id} endpoints   [3 hours]
□ Add /api/kms/search endpoint         [1 hour]

Result: Web UI and CLI fully API-equivalent
```

### Phase 3: Polish (Optional)
```
□ File management API                  [3 hours]
□ Context injection endpoint           [2 hours]
□ Comprehensive API tests              [4 hours]
```

---

## Current Workflow: User vs Agent

### USER WORKFLOW (100% Supported)
```
1. Add transcript to input/
2. Click "Analyze" (or run npm run analyze)
3. Browse results in web dashboard
4. Drill down into decisions
5. Validate relationships via UI
6. Mark decisions as escalated
7. View KMS summary
```

### AGENT WORKFLOW TODAY (74% Supported)
```
1. ⚠️  Upload via bash or REST (PARTIAL - no REST yet)
2. ✅ Trigger analysis (WORKS - npm run analyze)
3. ✅ Query results via API (WORKS - GET /api/kms/decisions)
4. ❌ Verify system state (BLOCKED - need /api/analysis/state)
5. ✅ Search by keyword (WORKS - npm run kms -k)
6. ✅ Validate relationships (WORKS - POST /api/kms/validate)
7. ✅ Mark decisions escalated (WORKS - POST /api/kms/actions)
```

### AGENT WORKFLOW AFTER FIXES (95% Supported)
```
1. ✅ Upload via REST (FIXED - POST /api/kms/transcripts)
2. ✅ Trigger analysis (FIXED - POST /api/analysis/analyze)
3. ✅ Query results via API (WORKS - GET /api/kms/decisions)
4. ✅ Verify system state (FIXED - GET /api/analysis/state)
5. ✅ Search by keyword (WORKS - GET /api/kms/search)
6. ✅ Validate relationships (WORKS - POST /api/kms/validate)
7. ✅ Mark decisions escalated (WORKS - POST /api/kms/actions)
```

---

## Error Handling: Current vs Needed

### Current (Exit Codes + Stderr)
```javascript
const { stdout, stderr, exitCode } = await exec('npm run analyze');
if (exitCode === 0) { /* success */ }
else if (stderr.includes("No files")) { /* handle */ }
else { /* unknown error */ }
```

### Needed (Structured JSON)
```javascript
const response = await fetch('/api/analysis/analyze', { method: 'POST' });
const { success, error } = await response.json();
if (!success) {
  console.log(error.code);        // Structured error code
  console.log(error.message);     // Human-readable message
  console.log(error.details);     // Technical details
}
```

---

## System State Inspection

### What Agent Needs to Know
```
✓ Is API key configured?
✓ Which model is configured?
✓ How many files in input/ directory?
✓ How many files already converted (processing/)?
✓ How many reports generated (output/)?
✓ What was last analysis run?
✓ How many decisions/actions/risks extracted?
✓ What models have cached analyses?
```

### Current Way (Manual)
```bash
# API check
echo $ANTHROPIC_API_KEY

# File counts
ls input/ | wc -l
ls processing/ | wc -l
ls output/ | wc -l

# Manifest data
cat .processed_manifest.json | jq .

# KMS stats
cat .processed_kms.json | jq '.meetings | length'
```

### After Fixes (Single API Call)
```javascript
const state = await (await fetch('/api/analysis/state')).json();
console.log(state.api_configured);      // true/false
console.log(state.model);               // "claude-haiku-4-5-20251001"
console.log(state.files.input);         // 5
console.log(state.files.processing);    // 3
console.log(state.files.output);        // 2
console.log(state.kms.decisions);       // 42
console.log(state.ready_for_analysis);  // true/false
```

---

## File Upload: Current vs Future

### Current (Bash Workaround)
```javascript
// Agent must use bash - not ideal
const fs = require('fs');
fs.writeFileSync('input/meeting.txt', transcriptContent);
// No hash verification, no atomic write, no structured response
```

### After Fix (Clean API)
```javascript
const response = await fetch('/api/kms/transcripts', {
  method: 'POST',
  body: JSON.stringify({
    filename: 'meeting.txt',
    content: transcriptContent
  })
});

const { success, filename, path, hash } = await response.json();
// Atomic write, duplicate detection, structured response
```

---

## Testing Checklist for P0 Implementation

```
□ POST /api/kms/transcripts
  □ Success: Creates file in input/
  □ Success: Returns JSON with path and hash
  □ Error: Rejects empty content
  □ Error: Rejects oversized content
  □ Edge: Handles duplicate filenames
  □ Edge: Validates filename characters

□ POST /api/analysis/analyze
  □ Success: Triggers conversion and analysis
  □ Success: Returns structured stats
  □ Error: Handles missing input files
  □ Error: Handles API key missing
  □ Option: forceReprocess flag works

□ GET /api/analysis/state
  □ Success: Returns all fields
  □ Success: Counts accurate
  □ Success: Shows readiness status
  □ Success: Lists cache statistics

□ Integration Test
  □ Upload → Analyze → Query workflow
  □ All 79 existing tests still pass
  □ No regressions in CLI commands
```

---

## Architecture Pattern: Agent-Native

**Definition:** System is agent-native when:
1. Every user action has a programmatic equivalent
2. Agent has same data visibility as user
3. All operations in shared workspace (no sandbox)
4. Tools are primitives, not workflows
5. Errors are transparent and actionable

**This System:** Currently 74% → After fixes: 90%+

---

## Key Files

### Review Documents
- `AGENT_NATIVE_REVIEW.md` - Detailed findings (70KB)
- `AGENT_NATIVE_FIX_GUIDE.md` - Step-by-step fixes (45KB)
- `AGENT_NATIVE_SUMMARY.txt` - Executive summary (20KB)
- `AGENT_NATIVE_QUICK_REFERENCE.md` - This file

### Source Code
- `/src/cli.ts` - CLI entry point (✅ Agent-native)
- `/app/api/kms/*.ts` - KMS endpoints (✅ Mostly complete)
- `/src/conversion/converter.ts` - Conversion logic
- `/src/analysis/orchestrator.ts` - Analysis logic

### Missing Implementation
- `/app/api/kms/transcripts/route.ts` (NEEDED)
- `/app/api/analysis/analyze/route.ts` (NEEDED)
- `/app/api/analysis/state/route.ts` (NEEDED)

---

## Quick Decision: Should You Implement Now?

**Use Case: Agent queries existing data**
- ✅ YES, ready today - all query APIs work

**Use Case: Agent triggers analysis on existing files**
- ⚠️ MAYBE - works but must use subprocess npm, not ideal

**Use Case: Agent uploads new transcripts and analyzes**
- ❌ NOT YET - missing upload API and direct analysis trigger

**Use Case: Production autonomous agent**
- ❌ WAIT - implement P0 gaps first (1.5 days)
- ✅ THEN ready - system becomes 90%+ agent-native

---

**Review Date:** March 2, 2026
**Status:** Ready for Agent Autonomy (with P0 implementation)
**Effort to Full Parity:** 1.5 days
**ROI:** High (enables full agent autonomy)
