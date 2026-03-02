# Architecture Diagrams & Visual Reference

## 1. System Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED TRANSCRIPT ANALYZER                  │
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                          WEB LAYER (Next.js)                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Browser Clients                                             │  │
│  │  ├─ Dashboard (KPI Cards, Charts)                          │  │
│  │  ├─ Decisions Explorer (Table, Filters, Relationships)    │  │
│  │  └─ Action Buttons (Escalate, Resolve, Prioritize)        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                            ↓ React Query                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ API Routes (app/api/kms/*)                                 │  │
│  │  ├─ /api/kms/summary ──→ Dashboard metrics                │  │
│  │  ├─ /api/kms/decisions → Decisions list                    │  │
│  │  ├─ /api/kms/actions ──→ Action history                    │  │
│  │  ├─ /api/kms/relationships → Inferred relationships        │  │
│  │  └─ /api/kms/validate ──→ Relationship validation          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│              ↑              ↑              ↑              ↑        │
└──────────────┼──────────────┼──────────────┼──────────────┼────────┘
               │              │              │              │
          Direct Read/Write via filesystem (⚠️ Coupling Point)
               │              │              │              │
┌──────────────┼──────────────┼──────────────┼──────────────┼────────┐
│              ↓              ↓              ↓              ↓         │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │                 BATCH PROCESSING LAYER (Node.js)            │  │
│ │                                                              │  │
│ │  ┌─────────────────────────────────────────────────────┐   │  │
│ │  │ CLI Router (src/cli.ts)                             │   │  │
│ │  │  • analyze                                          │   │  │
│ │  │  • convert                                          │   │  │
│ │  │  • analyze-existing                                 │   │  │
│ │  └─────────────────────────────────────────────────────┘   │  │
│ │      ↓              ↓              ↓                        │  │
│ │  ┌──────────────────────────────────────────────────────┐  │  │
│ │  │  CONVERSION PIPELINE (src/conversion/)              │  │  │
│ │  │                                                      │  │  │
│ │  │  [discover] → [read] → [extract] → [generate] →    │  │  │
│ │  │  [write] → [hash] → [record in manifest]            │  │  │
│ │  │                                                      │  │  │
│ │  │  Key: ManifestManager (atomic state management)     │  │  │
│ │  └──────────────────────────────────────────────────────┘  │  │
│ │      ↓                                                      │  │
│ │  ┌──────────────────────────────────────────────────────┐  │  │
│ │  │  ANALYSIS PIPELINE (src/analysis/)                  │  │  │
│ │  │                                                      │  │  │
│ │  │  [read .md files] → [synthesize] → [format report] │  │  │
│ │  │           ↓                ↓                          │  │  │
│ │  │     [extract KMS data]  [infer relationships]        │  │  │
│ │  │           ↓                ↓                          │  │  │
│ │  │     [update KMS store]  [write inferred.json]        │  │  │
│ │  └──────────────────────────────────────────────────────┘  │  │
│ │  ┌──────────────────────────────────────────────────────┐  │  │
│ │  │  MULTI-AGENT ANALYSIS (src/analysis/agents/)        │  │  │
│ │  │                                                      │  │  │
│ │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐      │  │  │
│ │  │  │Strategic │  │Stakeholder │Financial &    │      │  │  │
│ │  │  │Analyst   │→ │ Analyzer  │→ Ops Analyzer │      │  │  │
│ │  │  └──────────┘  └──────────┘  └──────────────┘      │  │  │
│ │  │       ↓              ↓              ↓               │  │  │
│ │  │  [Synthesize into unified report]                   │  │  │
│ │  └──────────────────────────────────────────────────────┘  │  │
│ │      ↓                                                      │  │
│ │  ┌──────────────────────────────────────────────────────┐  │  │
│ │  │  KNOWLEDGE MANAGEMENT SYSTEM (src/kms/)             │  │  │
│ │  │                                                      │  │  │
│ │  │  [extract] → [decisions, actions, risks]            │  │  │
│ │  │     ↓                                                 │  │  │
│ │  │  [infer relationships with DSPy]                     │  │  │
│ │  │     ↓                                                 │  │  │
│ │  │  [store in .processed_kms.json]                      │  │  │
│ │  └──────────────────────────────────────────────────────┘  │  │
│ │                                                             │  │
│ └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ SHARED INFRASTRUCTURE                                       │  │
│ │  • Type Definitions (src/types.ts) - centralized          │  │
│ │  • Logging (src/utils/logging.ts) - structured            │  │
│ │  • Validation (src/utils/validation.ts) - input safety    │  │
│ │  • Client (src/utils/client.ts) - Anthropic API singleton │  │
│ │  • Parsing (src/utils/parsing.ts) - content extraction    │  │
│ └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                      PERSISTENT STATE                             │
│                                                                   │
│  input/                 ← User uploads transcripts (.txt)         │
│  processing/            ← Converted markdown files (.md)          │
│  output/                ← Analysis reports (.md)                  │
│  .processed_manifest.json        ← State tracking                │
│  .processed_kms.json             ← Decisions, actions, risks     │
│  .processed_kms_inferred.json    ← Inferred relationships        │
│  .processed_kms_actions.json     ← User actions on decisions     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Diagrams

### Conversion Pipeline

```
.txt Input File
      ↓
┌─────────────────────────────────┐
│ File Discovery (glob pattern)   │
│ - Find all .txt in input/       │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ Cache Check (Manifest)          │
│ - Compare file hash             │
│ - Decide: process or skip?      │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ Read File Content               │
│ - UTF-8 encoding                │
│ - Empty file check              │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ Extract Metadata (Claude API)   │
│ - Date: from content            │
│ - Concepts: key themes          │
│ - Retry: exponential backoff    │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ Generate Markdown               │
│ - YAML frontmatter              │
│ - Content body                  │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ Compute File Hash (MD5)         │
│ - Detect future modifications   │
└─────────────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ Record in Manifest              │
│ - Input filename                │
│ - Output filename               │
│ - Hash + timestamp              │
└─────────────────────────────────┘
      ↓
.md Output (processing/)
```

### Analysis Pipeline

```
.md Converted File
      ↓
┌──────────────────────────────────┐
│ File Discovery                   │
│ - Find all .md in processing/    │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Cache Check (per-model)          │
│ - Has this model analyzed this?  │
│ - Decide: process or skip        │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Extract Metadata & Content       │
│ - Parse YAML frontmatter         │
│ - Get body text                  │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Multi-Agent Synthesis (Claude)   │
│                                  │
│ Parallel Analysis:               │
│ • Strategic Analyst              │
│ • Stakeholder Analyzer           │
│ • Financial/Ops Analyzer         │
│                                  │
│ Returns: AnalysisReport          │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Format Markdown Report           │
│ - Structure sections             │
│ - Add recommendations            │
│ - Add timeline                   │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Extract KMS Data                 │
│ - Decisions                      │
│ - Action Items                   │
│ - Commitments                    │
│ - Risks                          │
│ Update: .processed_kms.json      │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Infer Relationships (DSPy)       │
│ - Cross-item dependencies        │
│ - Confidence scoring             │
│ Update: .processed_kms_inferred  │
└──────────────────────────────────┘
      ↓
┌──────────────────────────────────┐
│ Record Analysis in Manifest      │
│ - Model used                     │
│ - Report filename                │
│ - Timestamp                      │
└──────────────────────────────────┘
      ↓
Output Report (.md) + KMS Data Updated
```

---

## 3. Dependency Graph

### Import Chains (Healthy)

```
src/cli.ts
  ├─→ src/conversion/converter.ts
  │   ├─→ src/conversion/manifest.ts
  │   │   ├─→ src/types.ts
  │   │   └─→ src/utils/logging.ts
  │   ├─→ src/conversion/metadata.ts
  │   │   ├─→ src/types.ts
  │   │   └─→ src/utils/client.ts
  │   └─→ src/utils/validation.ts
  │
  ├─→ src/analysis/orchestrator.ts
  │   ├─→ src/analysis/synthesisCoordinator.ts
  │   │   ├─→ src/analysis/agents/strategicAnalyst.ts
  │   │   ├─→ src/analysis/agents/stakeholderAnalyzer.ts
  │   │   ├─→ src/analysis/agents/financialOpsAnalyzer.ts
  │   │   └─→ src/utils/client.ts
  │   ├─→ src/analysis/reportGenerator.ts
  │   ├─→ src/kms/extractor.ts
  │   │   └─→ src/kms/store.ts
  │   ├─→ src/kms/relationshipInferencerDSPy.ts
  │   └─→ src/conversion/manifest.ts
  │
  ├─→ src/conversion/manifest.ts
  │   └─→ src/types.ts
  │
  └─→ src/utils/validation.ts
      └─→ src/utils/logging.ts

✓ NO CIRCULAR DEPENDENCIES DETECTED
```

### Problem Areas

```
app/api/kms/summary/route.ts
  ├─→ fs (Node.js filesystem)
  ├─→ path (Node.js path)
  ├─→ DIRECT READS: .processed_kms.json
  └─→ ⚠️ TIGHT COUPLING - Should use KMSFileStore abstraction

app/api/kms/decisions/route.ts
  ├─→ DUPLICATE: fs, path
  ├─→ DUPLICATE: DIRECT READS from .processed_kms.json
  └─→ ⚠️ CODE DUPLICATION

app/api/kms/actions/route.ts
  ├─→ DUPLICATE: fs, path
  ├─→ DUPLICATE: DIRECT READS
  ├─→ DUPLICATE: DIRECT WRITES with mutation logic
  └─→ ⚠️ CODE DUPLICATION + STATE MUTATION

app/types.ts
  └─→ ⚠️ DUPLICATE TYPES: Should import from src/types.ts
```

---

## 4. Type System Dependencies

```
src/types.ts (Single Source of Truth)
  ├─→ ConversionTypes
  │   ├─ ConversionState
  │   ├─ TranscriptMetadata
  │   └─ ConversionResult
  │
  ├─→ AnalysisTypes
  │   ├─ AnalysisReport
  │   ├─ StrategicAnalysis
  │   ├─ StakeholderAnalysis
  │   └─ FinancialOpsAnalysis
  │
  ├─→ ManifestTypes
  │   ├─ ProcessedFile
  │   └─ Manifest
  │
  ├─→ KMSTypes
  │   ├─ KMSDecision
  │   ├─ KMSActionItem
  │   ├─ KMSCommitment
  │   ├─ KMSRisk
  │   ├─ KMSData
  │   └─ KMSStore
  │
  └─→ RelationshipTypes
      ├─ InferredRelationship
      └─ InferredRelationshipsStore

app/types.ts (⚠️ DUPLICATE)
  └─→ InferredRelationship
      └─ InferredRelationshipsStore

  ❌ PROBLEM: Should import from src/types.ts
```

---

## 5. State Management Architecture

```
Runtime State (In-Memory)
  │
  ├─ CLI Process State
  │  ├─ args parsed
  │  ├─ environment validated
  │  └─ [sent to orchestrators]
  │
  ├─ Web Session State (Zustand)
  │  └─ app/lib/stores/validations.ts
  │     └─ relationship validations (in-memory, not persisted)
  │
  └─ React Query Cache
     └─ Cached API responses in browser


Persistent State (Disk)
  │
  ├─ .processed_manifest.json
  │  ├─ Version: 1
  │  ├─ Last run: ISO timestamp
  │  └─ processed_files[]
  │     ├─ input_file: string
  │     ├─ output_file: string
  │     ├─ conversions: {hash, timestamp, files}
  │     └─ analyses: {model → {timestamp, report_file}}
  │
  ├─ .processed_kms.json
  │  ├─ Version: 1
  │  ├─ Last updated: ISO timestamp
  │  └─ meetings: {meetingName → KMSData}
  │     └─ KMSData
  │        ├─ decisions[]
  │        ├─ actionItems[]
  │        ├─ commitments[]
  │        └─ risks[]
  │
  ├─ .processed_kms_inferred.json
  │  ├─ Version: 1
  │  ├─ Inferred at: ISO timestamp
  │  └─ relationships[]
  │     ├─ fromId, fromType
  │     ├─ toId, toType
  │     ├─ relationshipType
  │     └─ confidence score
  │
  └─ .processed_kms_actions.json
     ├─ Version: 1
     ├─ Last updated: ISO timestamp
     └─ actions[]
        ├─ decisionId
        ├─ action: 'escalate' | 'resolve' | 'high-priority'
        └─ executedAt: ISO timestamp


File System
  │
  ├─ input/
  │  └─ *.txt (user transcripts)
  │
  ├─ processing/
  │  └─ YYYY-MM-DD_*.md (converted with frontmatter)
  │
  └─ output/
     └─ YYYY-MM-DD_*_report_*.md (analysis reports)
```

---

## 6. Layer Interaction Matrix

```
         │ CLI | Conv | Analysis | KMS | Web |
─────────┼─────┼──────┼──────────┼─────┼─────┤
CLI      │  -  │  →   │    →     │  -  │  -  │
Conv     │  ←  │  -   │    -     │  -  │  -  │
Analysis │  ←  │  ←   │    -     │  →  │  -  │
KMS      │  -  │  -   │    ←     │  -  │  ←  │
Web      │  -  │  -   │    -     │  ←  │  -  │

Legend:
  → = Calls/Depends on
  ← = Called by
  - = No interaction

Assessment:
  ✓ CLI and Web are completely independent
  ✓ No circular dependencies
  ⚠️ Web-to-KMS should use abstraction layer (currently direct FS)
```

---

## 7. Risk Heat Map

```
                    IMPACT
                    ▲
                    │
            HIGH    │    [File I/O]   [Orchestrator]
                    │    in Web APIs   Complexity
                    │
        MEDIUM      │  [Type Duplication]
                    │  [CLI Duplication]
                    │  [Agent Interface]
                    │
            LOW     │     [Error Msgs]
                    │     [Metadata Path]
                    │
                    └─────────────────────────────→ PROBABILITY

Quadrants:
  Upper-Left:  Rare but catastrophic (prevent at all costs)
  Upper-Right: Common and serious (fix soon)  ← We are here
  Lower-Left:  Rare and minor (monitor)
  Lower-Right: Common but minor (nice-to-have)
```

---

## 8. Build & Deployment Topology

```
Source Code
  ├─ src/ (TypeScript)
  │  ├─ Compiled to dist/ via tsc
  │  └─ Run via ts-node (development)
  │
  └─ app/ (Next.js)
     ├─ Compiled to .next/ via next build
     └─ Run via next dev (development) or next start (production)

Build Process:
  npm run build  →  next build && tsc
                    ├─ Next.js compilation (.next/)
                    └─ TypeScript compilation (dist/)

Execution:
  Development:
    npm run dev      → next dev (port 3000)
    npm run dev:cli  → ts-node src/cli.ts

  CLI Commands:
    npm run analyze              → ts-node src/cli.ts analyze
    npm run convert              → ts-node src/cli.ts convert
    npm run analyze-existing     → ts-node src/cli.ts analyze-existing
    npm run kms                  → ts-node src/kms-query.ts

  Web Production:
    npm start        → next start (port 3000)

Testing:
  npm test         → jest with ts-jest
```

---

## 9. Manifest State Machine

```
Initial State:
  .processed_manifest.json doesn't exist
            │
            ↓
  [Create empty manifest]
            │
            ├─→ version: 1
            ├─→ last_run: ISO timestamp
            └─→ processed_files: []

File Processing States:

NEW FILE:
  [File discovered] →
    [Compute hash] →
    [Extract metadata] →
    [Write .md] →
    [Record in manifest] →
  ✓ File in manifest with hash

MODIFIED FILE:
  [File discovered] →
  [Compute hash] →
  [Hash != manifest hash?] →
    YES: [Re-process] → [Update manifest]
    NO: [Skip] → [Already processed]

ANALYSIS CACHING:

Per-Model Cache:
  {
    model_id: {
      analyzed_at: timestamp,
      report_file: filename
    }
  }

Model Switch:
  Haiku analyzed → Stored in manifest
  [User switches to Opus] →
  [Check manifest for Opus cache] →
  [Cache miss] →
  [Re-analyze with Opus] →
  [Both results in manifest]
```

---

## 10. Testing Architecture

```
Test Pyramid:

           ▲
          /\              E2E Tests (Integration)
         /  \            • Full pipeline tests
        /    \           • 4 test suites
       /──────\          • 79 passing
      /        \
     /          \        Unit Tests
    /   ──────   \       • Manifest operations
   /   /        \  \     • Metadata extraction
  /   /          \  \    • Validation rules
 / ──/            \── \
/______________________ \

Test Coverage:
  ✓ Manifest: hash computation, corruption recovery
  ✓ Metadata: date extraction, concept identification
  ✓ Validation: API key, model ID, file size
  ✓ Integration: full convert + analyze pipeline
  ⚠️ Not tested: Web API routes, component rendering
  ⚠️ Not tested: KMS relationship inference
```

---

## 11. Performance Profile

```
Single File Conversion:
  File Read:          1-2 sec
  API Call (Claude):  10-30 sec (with retries)
  Markdown Gen:       <1 sec
  File Write:         <1 sec
  Hash Compute:       <1 sec
  ────────────────────────────
  Total:              10-30 sec (bottleneck: API)

Batch (10 files):
  Sequential:         100-300 sec
  Per-file caching:   -10 sec if unchanged ✓

Single File Analysis:
  File Read:          <1 sec
  Metadata Extract:   <1 sec
  API Calls (3 agents): 30-60 sec (bottleneck: API)
  Report Generate:    <1 sec
  KMS Extract:        <1 sec
  Relationships:      5-10 sec
  File Write:         <1 sec
  ────────────────────────────
  Total:              30-60 sec (bottleneck: API)

Manifest Operations:
  Load:               <1 ms
  Save:               <10 ms
  Cache Check:        <1 ms
```

---

Last Updated: March 2, 2026

