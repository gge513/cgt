# KMS Web Dashboard Brainstorm
**Date:** March 2, 2026

## What We're Building

A strategic executive dashboard for the Knowledge Management System that visualizes decisions, action items, commitments, and risks extracted from meeting transcripts. The dashboard helps executives and strategists:
- **See patterns** across multiple meetings (e.g., "financial" issues appearing repeatedly)
- **Understand decision dependencies** (what's blocking what across meetings)
- **Validate AI inferences** about decision relationships
- **Take strategic action** (escalate, mark resolved, prioritize)

**Current state:** CLI-based KMS query system (text-only output)

**Future state:** Interactive dashboard with visualization, drill-down, cross-meeting insights, and AI-powered relationship discovery

## Primary Users

**Executives and Strategists** - Not individual contributors or task managers. They need high-level strategic visibility and decision-making capability, not operational task management.

## Why This Approach

**Strategic Focus:** Dashboard is read-only with validation + lightweight action buttons. Executives make strategic decisions ("escalate," "resolve," "prioritize") without editing operational details.

**AI-Powered Insights:** Claude infers relationships between decisions across meetings, executives validate. Over time, system learns what connections matter.

**Pattern Detection:** Keyword-based grouping surfaces recurring issues ("financial," "hiring," "risk") across multiple meetings automatically.

**Lightweight & Fast:** Focus on 3 MVP features, not comprehensive task management. Executives can review strategic state in minutes.

## Key Decisions

### 1. User Personas: Executives & Strategists Only
- Not individual contributors (they use CLI)
- Not operational task managers
- Need strategic visibility across all meetings
- Make high-level decisions, not day-to-day work

**Why:** Keeps dashboard focused on strategy, not operations. Different use case requires different UI.

### 2. Read-Only + Validation + Action Buttons
**Three-tier interaction model:**

1. **View** - See decisions, actions, risks, commitments, inferred relationships
2. **Validate** - Click ✓/✗ on AI-inferred connections (builds trust, improves AI over time)
3. **Act Strategically** - Lightweight buttons:
   - Mark as "Escalated"
   - Mark as "Resolved"
   - Set as "High Priority"
   - (Status changes only, no text editing)

**What executives CANNOT do:**
- Edit decision/action text
- Add detailed notes or meeting context
- Create new decisions (that's for meetings)
- Assign or delegate to people (that's operational)

**Why:** Keeps scope tight. Operational details belong in the meeting. Executives make strategic calls.

### 3. AI Inference for Decision Relationships
**How it works:**
1. Claude analyzes decision/action text from all meetings
2. Infers relationships: "Decision A blocks Decision B," "Risk C could affect Decision D"
3. Dashboard shows inferred connections with confidence scores
4. Executives validate (confirm = trains model, reject = provides negative example)

**Two types of insights:**
- **Decision Ripples** - "This decision is blocking 2 action items in other meetings"
- **Pattern Detection** - "Financial issues discussed in 3 meetings, keyword: 'financial'"

**Why:** Executives need to spot cascading effects and recurring themes. AI inference finds connections humans would miss.

### 4. Three MVP Screens (Quick & Functional)

**Screen 1: Strategic Dashboard (Homepage)**
- KPI cards: # decisions, # high-risk items, # escalated, % resolved
- Status pie chart: Pending / In-Progress / Completed
- Risk distribution: Low / Medium / High

**Screen 2: Decisions Explorer (Drill-down)**
- List of all decisions across all meetings
- Column filters: Status, Owner, Date Range, Risk Level
- Click decision → see full context + inferred blockers/impacts
- Validation UI: Confirm/reject each inferred relationship
- Action buttons: Mark Escalated, Mark Resolved, Set High Priority

**Screen 3: Patterns & Insights (Cross-meeting view)**
- Tag cloud or grouped list of topics (keyword-based): "Financial," "Hiring," "Risk Management," etc.
- Click topic → see all decisions/actions/risks with that keyword across meetings
- Show meeting context (which meetings, when)
- Drill into each instance

**Optional Phase 2 (if scope expands):**
- Timeline view of decisions over time
- Dependency graph (visual relationship map)
- Export strategic summary report
- Team/person views

### 5. AI-Powered Relationship Discovery (Not Manual Linking)
**Decision:** Use Claude to infer relationships, not manual linking

**Why:**
- Faster to implement (no complex UI for relationship management)
- More powerful (AI sees patterns humans miss)
- Executives validate decisions, not define relationships
- Scales to 100s of decisions without manual overhead

**Future enhancement:** Executives could manually add relationships if needed, but MVP is AI inference + validation.

### 6. Integration with Existing KMS
**Data source:** `.processed_kms.json` (existing KMS store)
**New capability:** Relationship inference via Claude API (pre-computed during `npm run analyze`)
**Architecture:** Next.js dashboard in same project
- `npm run analyze` extracts KMS data + computes inferred relationships
- Dashboard API routes read pre-computed relationships from `.processed_kms_inferred.json`
- Executives validate relationships in dashboard UI
- Validation feedback stored in `.processed_kms_validations.json` for future improvement

### 7. Non-Goals for MVP

**NOT included:**
- User authentication/permissions (single-user strategic tool)
- Real-time updates (checks data every 30s, good enough)
- Detailed notes/comments (executives use email for that)
- Task assignment/delegation (use existing task system)
- Export/PDF reports (Phase 2)
- Mobile optimization (desktop-first)

**Why:** Keep MVP focused. These are nice-to-have, not essential for strategic decision-making.

## Technical Approach

### Architecture
- **Framework:** Next.js (full-stack TypeScript in existing project)
- **Frontend Components:** React + shadcn/ui + Recharts
- **State Management:** Zustand (filter state), TanStack Query (data fetching)
- **Data:** Read from `.processed_kms.json`, inference calls to Claude API
- **API Routes:** `/api/kms/decisions`, `/api/kms/patterns`, `/api/kms/infer-relationships`

### Implementation Phases

**Phase 1 (Days 1-2): MVP - Dashboard + Decisions List**
- Strategic Dashboard screen (KPI cards + charts)
- Decisions Explorer (table with basic filtering + validation UI for relationships)
- API routes for decision fetching and relationship reading
- Relationship inference added to analysis orchestrator (pre-computed during `npm run analyze`)

**Phase 2 (If time): Patterns + Live Inference**
- Patterns & Insights screen (keyword grouping)
- Real-time relationship inference with validation UI
- Validation feedback storage

## Resolved Decisions

### 1. Read-Only vs. Editable ✓
**Decision:** Read-only with validation + lightweight action buttons (no text editing)

**Reasoning:** Executives make strategic decisions, not operational edits. Keeps scope tight and focused.

### 2. Manual vs. AI Relationship Discovery ✓
**Decision:** AI inference with validation (executives validate/reject connections)

**Reasoning:** Faster to implement, more powerful, scales better than manual linking.

### 3. Same Project vs. Separate ✓
**Decision:** Add Next.js dashboard to existing transcript-analyzer-unified project

**Reasoning:** Shared types, direct data access, single deployment unit, faster development.

## Open Questions

None! All key design decisions have been made.

## Success Criteria

- ✅ Executives can see KMS data visualized on dashboard (not CLI text)
- ✅ Can drill-down from summary to detail (click count → see actual decisions)
- ✅ Can see patterns across meetings (keyword grouping like "financial" across 3 meetings)
- ✅ Can see inferred decision relationships with validation UI
- ✅ Can take strategic action (escalate, resolve, prioritize) from dashboard
- ✅ MVP dashboard shows 3 screens in 1-2 days of development
- ✅ Executives prefer this over CLI for strategic review

## Next Steps

1. **Review & refine** - Any adjustments to the design above?
2. **Plan implementation** - Create detailed technical plan with file structure, routes, components
3. **Execute** - Build the MVP dashboard (1-2 days)
4. **Deploy** - Make available to executives for testing

---

**Summary:** This is a strategic executive dashboard that surfaces patterns, reveals dependencies, and enables quick strategic action. It's read-only by design (executives don't edit operational details) but interactive for validation (building AI trust). AI inference discovers relationships, executives validate them. Focus: visualization, drill-down, cross-meeting insights. MVP: 3 screens in 1-2 days.

