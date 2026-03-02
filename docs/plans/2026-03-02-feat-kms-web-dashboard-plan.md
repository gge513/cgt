---
title: feat: KMS Web Dashboard
type: feat
status: active
date: 2026-03-02
origin: docs/brainstorms/2026-03-02-kms-web-dashboard-brainstorm.md
---

# KMS Web Dashboard

## Overview

Build an interactive web dashboard for executives and strategists to visualize, explore, and validate strategic decisions, action items, commitments, and risks extracted from meeting transcripts. The dashboard provides high-level strategic visibility with AI-inferred decision relationships, pattern detection across meetings, and lightweight action capabilities (escalate, resolve, prioritize).

**Scope:** MVP with 3 screens, 1-2 days development, deployed in same Next.js project as existing CLI analyzer.

## Problem Statement / Motivation

**Current state:** KMS CLI outputs raw text (decisions, actions, risks, commitments). Executives must:
- Read text-only output - no visualization
- Manually search for patterns across meetings
- Understand dependencies by reading text (tedious, error-prone)
- No way to quickly take strategic action

**Impact:** Executives can't see strategic insights at a glance. No way to spot cascading impacts of decisions or recurring issues across meetings.

**Solution:** Interactive web dashboard providing visualization, drill-down, cross-meeting patterns, and AI-inferred relationships.

## Proposed Solution

Create a Next.js web dashboard embedded in the existing `transcript-analyzer-unified` project that:

1. **Visualizes KMS data** - KPI cards, pie charts, risk distribution (executives can see strategic state in seconds)
2. **Enables drill-down** - Click summary numbers → see underlying decisions/actions/risks
3. **Surfaces patterns** - Keyword-based grouping shows recurring topics across meetings (e.g., "financial" issues in 3 meetings)
4. **Infers relationships** - Claude analyzes decision text to find dependencies ("Decision A blocks Action B in different meeting")
5. **Validates inferences** - Executives confirm/reject relationships (builds AI trust, trains model)
6. **Enables strategic action** - Mark decisions as Escalated, Resolved, or High Priority

**Architecture:**
- Add Next.js App Router to existing project (`app/` directory)
- API routes read `.processed_kms.json` and pre-computed relationships
- React components with shadcn/ui, Recharts for visualization, TanStack Table for lists
- Zustand for UI state (filters, search), TanStack Query for data fetching
- Relationship inference added to analysis orchestrator (runs during `npm run analyze`)

## Technical Considerations

### Architecture Impacts
- **Next.js integration:** Add to existing TypeScript project without breaking CLI
- **Shared types:** Reuse KMS types from `src/types.ts` (no duplication)
- **API layer:** New routes read from KMS store (no database changes)
- **Relationship inference:** Added to `src/analysis/orchestrator.ts` during analysis run

### Performance Implications
- Dashboard queries `.processed_kms.json` (~100KB for 100+ decisions) - instant loads
- TanStack Query caches aggressively, refetches every 30s
- Recharts renders efficiently up to 1000 data points
- TanStack Table with virtual scrolling handles 100+ rows

### Data Flow
```
npm run analyze
  ↓
Extract KMS (decisions, actions, risks, commitments)
  ↓
Infer relationships via Claude API
  ↓
Write .processed_kms.json + .processed_kms_inferred.json
  ↓
Dashboard fetches from API routes
  ↓
Executives view, filter, validate relationships
  ↓
Validation feedback stored in .processed_kms_validations.json
```

## System-Wide Impact

### Interaction Graph
- **Analysis Orchestrator** (`src/analysis/orchestrator.ts`) runs relationship inference after KMS extraction
  - Calls Claude API to analyze decision/action text
  - Stores inferred relationships in `.processed_kms_inferred.json`
  - On error, logs warning but continues (non-fatal)
- **Next.js API routes** (`app/api/kms/`) read from KMS store and inference files
- **React components** fetch via TanStack Query, display with shadcn/ui

### Error Propagation
- **Relationship inference failure** - Non-fatal, skip inference, dashboard shows KMS data without relationships
- **API route errors** - 500 response, dashboard shows error toast (TanStack Query)
- **Invalid relationship data** - Validation UI gracefully handles missing/malformed data
- **No cascading failures** - Each layer handles errors independently

### State Lifecycle Risks
- **Validation feedback** stored separately in `.processed_kms_validations.json`
- **Read-only KMS data** - Dashboard cannot corrupt `.processed_kms.json`
- **Relationship inference** is append-only (no state deletion, safe to re-run)
- **No orphaned state** - If validation file corrupts, clear it and start fresh

### API Surface Parity
- **KMS data access:** Only via API routes (no direct file access from browser)
- **No other interfaces** - CLI uses direct function calls to KMSStoreManager, Web uses API routes
- **Consistent query interface** - Both CLI and API support same filters (type, owner, status, etc.)

### Integration Test Scenarios
1. **Relationship inference during analysis** - Run `npm run analyze`, verify `.processed_kms_inferred.json` created with valid relationships
2. **Dashboard displays inferred relationships** - Fetch from API route, verify structure matches expectations
3. **Validation feedback persists** - Submit validation, reload dashboard, verify persisted
4. **Pattern detection groups correctly** - Keywords like "financial" found across multiple decisions
5. **Action button state changes** - Mark decision as Escalated, verify status persists

## Acceptance Criteria

### Functional Requirements
- [ ] **Strategic Dashboard screen** displays KPI cards (# decisions, # high-risk, # escalated, % resolved)
- [ ] **Strategic Dashboard** shows status pie chart (Pending/In-Progress/Completed) and risk distribution (Low/Medium/High)
- [ ] **Decisions Explorer screen** displays table of all decisions with columns: Text, Owner, Status, Risk Level, Date
- [ ] **Decisions Explorer** supports filtering by Status, Owner, Date Range, Risk Level
- [ ] **Decisions Explorer** shows inferred relationships (Decision A blocks Action B) with confidence scores
- [ ] **Validation UI** in Decisions Explorer allows executives to confirm/reject inferred relationships
- [ ] **Action buttons** on Decisions Explorer enable: Mark Escalated, Mark Resolved, Set High Priority
- [ ] **Patterns & Insights screen** displays keyword-grouped topics (Financial, Hiring, Risk Management, etc.)
- [ ] **Patterns screen** allows drilling into each topic to see all related decisions/actions/risks
- [ ] **Relationship inference** integrated into analysis pipeline (runs during `npm run analyze`)
- [ ] **API routes** (`/api/kms/decisions`, `/api/kms/patterns`, `/api/kms/infer-relationships`) working and documented
- [ ] **Data persistence** - Relationships stored in `.processed_kms_inferred.json`, validations in `.processed_kms_validations.json`

### Non-Functional Requirements
- [ ] **Performance** - Dashboard loads in <2 seconds, filtering/search responds in <500ms
- [ ] **Accessibility** - WCAG 2.1 AA (via shadcn/ui + Radix)
- [ ] **TypeScript** - Zero TypeScript compilation errors, proper typing throughout
- [ ] **Browser support** - Chrome 120+, Safari 16+, Firefox 121+ (evergreen)

### Quality Gates
- [ ] **Tests** - Integration tests for all 3 screens + API routes
- [ ] **No console errors** - Dashboard runs clean console, no warnings
- [ ] **Documentation** - Dashboard URL, how to use, what executives can do, non-goals clearly documented
- [ ] **Code review** - Implementation follows existing patterns, uses shared types correctly

## Success Metrics

- ✅ **MVP complete in 1-2 days** - All 3 screens working, relationship inference integrated
- ✅ **Executives prefer dashboard over CLI** - Can view strategic state faster than reading text
- ✅ **Pattern detection works** - Keywords automatically group decisions across meetings
- ✅ **Relationship validation works** - Executives can confirm/reject AI inferences
- ✅ **Zero breaking changes** - CLI continues working, analysis pipeline unaffected by dashboard
- ✅ **Zero auth/permissions** - Single-user strategic tool, no login needed
- ✅ **Data integrity** - No dashboard actions corrupt KMS data

## Dependencies & Risks

### External Dependencies
- **Next.js 14+** - Need to install and configure
- **React 18+**, **TypeScript 5+** - Already in project
- **@anthropic-ai/sdk** - Already installed, used for relationship inference

### New Dependencies to Install
```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "@tanstack/react-query": "^5.0.0",
  "@tanstack/react-table": "^8.0.0",
  "zustand": "^4.4.0",
  "recharts": "^2.10.0",
  "tailwindcss": "^4.0.0",
  "class-variance-authority": "^0.7.0"
}
```

### Installation Risk
- **Low** - All packages are stable, production-ready, no version conflicts with existing deps
- **Mitigation** - Test `npm test` after adding deps to ensure no breakage

### Relationship Inference Risk
- **Prompt injection** - Executive data in decision text could confuse Claude
  - Mitigation: Use strict JSON schema, validate inference output
- **API rate limiting** - Many decisions could exceed Claude rate limit
  - Mitigation: Batch inference with retry logic, cap to 100 decisions per run
- **Cost** - Claude API calls for inference add cost per analysis run
  - Mitigation: Optional flag to skip inference if needed, can use cheaper model (Haiku) for inference

### Integration Risk
- **Analysis pipeline changes** - Adding relationship inference could break existing analysis
  - Mitigation: Wrap inference in try/catch, non-fatal errors, logging
  - Testing: Run existing test suite + new integration tests
- **File conflicts** - New `.processed_kms_inferred.json` and `.processed_kms_validations.json` could conflict with user data
  - Mitigation: Clear naming convention, document file structure

## Implementation Plan

### Phase 1 (Days 1-2): MVP - Dashboard + Decisions List

#### Step 0: Install Dependencies (Required First)
Before any development, install all required packages:

```bash
cd transcript-analyzer-unified
npm install next react react-dom @tanstack/react-query @tanstack/react-table zustand recharts tailwindcss class-variance-authority
npm install -D @types/node
```

**Verification:**
- [x] `npm run build` succeeds (TypeScript compilation)
- [x] `npm test` still passes (verify no breakage to existing tests)
- [x] `npm run analyze` and `npm run kms` still work (CLI unaffected)

#### 1a. Setup Next.js in Existing Project
- [x] Initialize Next.js App Router in root directory
- [x] Create `app/` directory structure
- [x] Configure TypeScript, Tailwind, shadcn/ui
- [x] Verify CLI still works (`npm run analyze`, `npm run kms -- --summary`)
- [x] Create initial API routes structure

**Files:**
- `app/layout.tsx` - Root layout
- `app/page.tsx` - Redirect to dashboard
- `app/dashboard/layout.tsx` - Dashboard layout
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - Updated for Next.js
- `tailwind.config.ts` - Tailwind configuration

#### 1b. Create Strategic Dashboard Screen (KPI + Charts)
- [x] Build KPI cards component (`app/dashboard/components/KpiCards.tsx`)
  - Display: # decisions, # high-risk items, # escalated, % resolved
  - Style with shadcn/ui cards
- [x] Build chart components (`app/dashboard/components/Charts.tsx`)
  - Status pie chart (Pending/In-Progress/Completed) with Recharts
  - Risk distribution bar chart (Low/Medium/High)
- [x] Create dashboard page (`app/dashboard/page.tsx`)
  - Fetch KMS summary data
  - Render KPI cards + charts
- [x] Implement API route for summary (`app/api/kms/summary/route.ts`)
  - Read `.processed_kms.json`
  - Calculate and return summary stats

**Files:**
- `app/dashboard/page.tsx`
- `app/dashboard/components/KpiCards.tsx`
- `app/dashboard/components/Charts.tsx`
- `app/api/kms/summary/route.ts`

#### 1c. Create Decisions Explorer Screen (Table + Filtering)
- [x] Build table component (`app/decisions/components/DecisionsTable.tsx`)
  - Use TanStack Table for headless logic
  - Columns: Text, Owner, Status, Risk Level, Meeting, Escalated
  - Support filtering and sorting
  - Drill-down details panel on row click
- [x] Build filter UI (`app/decisions/components/FilterBar.tsx`)
  - Filters: Status dropdown, Risk level selector, Keyword search
  - Reset filters button with active filter badges
- [x] Create explorer page (`app/decisions/page.tsx`)
  - Fetch decisions from API
  - Render table with filters
  - Click decision → show details panel
  - Back navigation to dashboard
- [x] Implement API route for decisions (`app/api/kms/decisions/route.ts`)
  - Read `.processed_kms.json`
  - Support query params: status, severity, keyword
  - Return filtered and paginated results

**Files:**
- `app/dashboard/decisions/page.tsx`
- `app/dashboard/components/KmsTable.tsx`
- `app/dashboard/components/FilterBar.tsx`
- `app/dashboard/components/DecisionDetails.tsx`
- `app/api/kms/decisions/route.ts`
- `lib/stores/filters.ts` - Zustand filter store

#### 1d. Add Relationship Inference to Analysis Pipeline
- [x] Create relationship inferencer (`src/kms/relationshipInferencer.ts`)
  - Function: `inferRelationships(kmsStore: KMSStore): InferredRelationship[]`
  - Calls Claude API with decision/action/commitment/risk text
  - Returns relationships with confidence scores (0-1)
  - Error handling: Log and continue if inference fails
- [x] Integrate into orchestrator (`src/analysis/orchestrator.ts`)
  - After KMS extraction, run relationship inference
  - Write `.processed_kms_inferred.json` with results
  - Handle inference errors gracefully (non-fatal)
- [x] Update types (`src/types.ts`)
  - Add InferredRelationship interface with full fields
  - Add InferredRelationshipsStore interface
  - Support relationship types: blocks, impacts, depends_on, related_to
- [x] Public accessor added to KMSStoreManager
  - Added `getStore()` method for orchestrator access

**Files:**
- `src/kms/relationshipInferencer.ts`
- `src/analysis/orchestrator.ts` - Modified
- `src/types.ts` - Extended
- `src/kms/__tests__/relationshipInferencer.test.ts`

#### 1e. Add Relationship Validation UI to Decisions Explorer
- [ ] Build validation component (`app/dashboard/components/RelationshipValidator.tsx`)
  - Display inferred relationships with confidence scores
  - Confirm/reject buttons for each relationship
  - Handle click events and persist validation
- [ ] Add to decision details panel
  - Show "This decision blocks 2 action items in other meetings"
  - Show "Risk: Financial may impact Decision: Hiring"
- [ ] Implement validation storage (`app/api/kms/validate/route.ts`)
  - Accept validation feedback (accept/reject relationship)
  - Store in `.processed_kms_validations.json`
- [ ] Create validation store (`lib/stores/validations.ts`)
  - Zustand store for local UI state
  - Persist to API when user validates

**Files:**
- `app/dashboard/components/RelationshipValidator.tsx`
- `app/api/kms/validate/route.ts`
- `lib/stores/validations.ts`

#### 1f. Add Strategic Action Buttons
- [ ] Add action buttons to Decisions Explorer
  - "Mark Escalated" button → changes decision status
  - "Mark Resolved" button → changes decision status
  - "Set High Priority" button → adds priority flag
- [ ] Implement action API route (`app/api/kms/actions/route.ts`)
  - Accept action (escalate/resolve/prioritize) + decision ID
  - Update `.processed_kms.json` with action status change
  - Return updated decision
- [ ] Update UX to show action feedback
  - Toast notification on action success
  - Button state change (disabled after click)
  - Dashboard refreshes after action

**Files:**
- `app/dashboard/components/ActionButtons.tsx`
- `app/api/kms/actions/route.ts`

#### 1g. Testing & Verification
- [ ] Unit tests for relationship inferencer
- [ ] Integration tests for dashboard API routes
- [ ] Manual testing: Load dashboard, verify KPI cards, filters, relationships load
- [ ] Verify no breaking changes to CLI (`npm run analyze`, `npm run kms`)
- [ ] Performance check: Dashboard loads in <2s

### Phase 2 (If Time): Patterns & Insights Screen

#### 2a. Create Patterns & Insights Screen
- [ ] Build patterns page (`app/dashboard/patterns/page.tsx`)
- [ ] Implement keyword extraction and grouping
- [ ] Create tag cloud or grouped list UI
- [ ] Add drill-down capability (click topic → see all related items)
- [ ] Implement API route (`app/api/kms/patterns/route.ts`)

#### 2b. Real-Time Relationship Inference (Optional)
- [ ] Add on-demand inference API route
- [ ] Implement UI for manual relationship definition (if needed)
- [ ] Add webhooks for analysis completion notifications

## Alternative Approaches Considered

### 1. Separate Next.js Project vs. Same Project
**Considered:** Create new separate `kms-dashboard` Next.js project, have it call analyzer as API backend

**Why rejected:**
- Increases complexity: need to set up API auth, coordinate deployments
- Duplicates types: KMS types in two projects = sync problems
- Slower development: context switching, separate git repos
- Harder data access: file-based KMS store not designed for HTTP API

**Chosen:** Add Next.js to existing project (shared types, same deployment)

### 2. Pre-Computed vs. On-Demand Relationship Inference
**Considered:** Compute relationships on-demand when dashboard loads (every 30s)

**Why rejected:**
- Adds latency: every dashboard view triggers Claude API call
- Inefficient: same relationships computed repeatedly
- Complex: need to cache inference results anyway
- Cost: more API calls per day

**Chosen:** Pre-compute during `npm run analyze` (instant dashboard loads, computed once per analysis)

### 3. Dashboard Features
**Considered:** Full CRUD operations, export to PDF, team/person views, real-time updates via WebSocket

**Why rejected:** Scope creep. MVP is strategic visibility + validation, not operational management.

**Chosen:** Read-only with validation + lightweight actions only (escalate, resolve, prioritize)

## Success Criteria Recap

(From brainstorm, carried forward)

- ✅ Executives can see KMS data visualized on dashboard (not CLI text)
- ✅ Can drill-down from summary to detail (click count → see actual decisions)
- ✅ Can see patterns across meetings (keyword grouping like "financial" across 3 meetings)
- ✅ Can see inferred decision relationships with validation UI
- ✅ Can take strategic action (escalate, resolve, prioritize) from dashboard
- ✅ MVP dashboard shows 3 screens in 1-2 days of development
- ✅ Executives prefer this over CLI for strategic review

## Future Considerations

- **Team/Person Views** - "Show me all decisions where Alice is the owner" (Phase 2)
- **Timeline View** - Chronological view of decisions over time (Phase 2)
- **Dependency Graph** - Visual network showing decision relationships (Phase 2)
- **Export Reports** - Generate strategic summary PDF (Phase 2)
- **User Preferences** - Save filter preferences, theme toggle (Phase 2)
- **Mobile App** - Native app for on-the-go strategic review (Phase 3)
- **Integration** - Slack notifications, email summaries, Jira/Linear sync (Phase 3)
- **Advanced Analytics** - Decision velocity trends, risk patterns, prediction (Phase 3)

## Documentation Plan

**What needs updating:**
- [ ] Add section to README explaining dashboard access (localhost:3000)
- [ ] Create DASHBOARD.md with screenshots and user guide
- [ ] Update CLAUDE.md with Next.js + dashboard architecture notes
- [ ] Document API routes in code comments
- [ ] Add troubleshooting for common dashboard issues
- [ ] Document file formats (.processed_kms_inferred.json, .processed_kms_validations.json)

## Sources & References

### Origin

**Brainstorm document:** [docs/brainstorms/2026-03-02-kms-web-dashboard-brainstorm.md](../brainstorms/2026-03-02-kms-web-dashboard-brainstorm.md)

**Key decisions carried forward:**
- Executive/strategist user personas (not individual contributors)
- Read-only + validation + lightweight actions interaction model
- AI inference for relationships (pre-computed during analysis)
- 3 MVP screens: Strategic Dashboard, Decisions Explorer, Patterns & Insights
- Same Next.js project (not separate)
- Non-goals: auth/permissions, real-time updates, detailed notes, export/PDF

### Internal References

- **KMS Types:** `src/types.ts` lines 223-300 (KMSDecision, KMSActionItem, etc.)
- **KMS Store:** `src/kms/store.ts` (KMSStoreManager, querying methods)
- **Analysis Orchestrator:** `src/analysis/orchestrator.ts` (integration point for relationship inference)
- **Existing CLI patterns:** `src/cli.ts`, `src/kms-query.ts` (command routing, argument parsing)

### External References

- [Next.js App Router](https://nextjs.org/docs/app)
- [TanStack Table docs](https://tanstack.com/table/v8)
- [Recharts docs](https://recharts.org)
- [shadcn/ui components](https://ui.shadcn.com)
- [Zustand state management](https://github.com/pmndrs/zustand)

### Related Work

- Existing KMS system: `KMS.md`, `.processed_kms.json`
- Solution documentation: `docs/solutions/integration-issues/cli-wiring-and-sdk-dependency-upgrade.md`
- Project CLAUDE.md: Development conventions and patterns

---

**Status:** Ready for implementation
**Estimated Effort:** 1-2 days for MVP Phase 1
**Next Step:** Begin `/workflows:work` to implement Phase 1

