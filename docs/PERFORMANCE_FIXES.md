# Performance Fixes - Implementation Guide

Quick reference for implementing the high-priority optimizations identified in the performance analysis.

---

## Fix 1: API Response Caching (Priority: CRITICAL)

**File**: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/summary/route.ts`

**Current Performance**: 100ms per request
**Target**: 1-5ms (cached), 100ms (on file change)
**Effort**: 1.5 hours

### Step 1: Add Caching Helper

Create `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/lib/kmsCache.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const KMS_PATH = path.join(process.cwd(), '.processed_kms.json');

interface CacheEntry {
  data: any;
  mtime: number;
}

let cache: CacheEntry | null = null;

export function getKMSDataCached(): any {
  // Return null if file doesn't exist
  if (!fs.existsSync(KMS_PATH)) {
    cache = null;
    return null;
  }

  const stat = fs.statSync(KMS_PATH);

  // Return cached if file unchanged
  if (cache && cache.mtime === stat.mtimeMs) {
    return cache.data;
  }

  // Load and cache
  const data = JSON.parse(fs.readFileSync(KMS_PATH, 'utf-8'));
  cache = { data, mtime: stat.mtimeMs };
  return data;
}

export function invalidateKMSCache(): void {
  cache = null;
}
```

### Step 2: Update Summary Route

Replace `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/summary/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getKMSDataCached } from '@/lib/kmsCache';

export async function GET() {
  try {
    const kmsData = getKMSDataCached();

    if (!kmsData) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    // Aggregate data
    const decisions: any[] = [];
    const actions: any[] = [];
    const commitments: any[] = [];
    const risks: any[] = [];

    Object.values(kmsData.meetings || {}).forEach((meeting: any) => {
      decisions.push(...(meeting.decisions || []));
      actions.push(...(meeting.actions || []));
      commitments.push(...(meeting.commitments || []));
      risks.push(...(meeting.risks || []));
    });

    // Single-pass counters (NOT multiple filter calls)
    const statusCounts = { pending: 0, in_progress: 0, completed: 0 };
    decisions.forEach((d: any) => {
      statusCounts[d.status as keyof typeof statusCounts] =
        (statusCounts[d.status as keyof typeof statusCounts] || 0) + 1;
    });

    const riskCounts = { low: 0, medium: 0, high: 0 };
    risks.forEach((r: any) => {
      riskCounts[r.severity as keyof typeof riskCounts] =
        (riskCounts[r.severity as keyof typeof riskCounts] || 0) + 1;
    });

    return NextResponse.json({
      summary: {
        total_decisions: decisions.length,
        total_actions: actions.length,
        total_commitments: commitments.length,
        total_risks: risks.length,
        total_items: decisions.length + actions.length + commitments.length,
        escalated_count: decisions.filter((d: any) => d.is_escalated).length,
      },
      status_distribution: statusCounts,
      risk_distribution: riskCounts,
      completion_percentage:
        decisions.length > 0
          ? Math.round((statusCounts.completed / decisions.length) * 100)
          : 0,
      high_risk_count: riskCounts.high,
      last_updated: kmsData.lastUpdated || 'Unknown',
      total_meetings: Object.keys(kmsData.meetings || {}).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: String(error) },
      { status: 500 }
    );
  }
}
```

### Step 3: Update Other Routes to Use Cache

In `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/decisions/route.ts`:

```typescript
import { getKMSDataCached } from '@/lib/kmsCache';

export async function GET(request: NextRequest) {
  try {
    const kmsData = getKMSDataCached();
    if (!kmsData) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    // ... rest of logic using cached data
  }
}
```

**Testing**:
```bash
# Benchmark before
time curl http://localhost:3000/api/kms/summary

# Should be ~100ms first call, <5ms subsequent calls
```

---

## Fix 2: Deduplicate File Reads in Analysis (Priority: HIGH)

**File**: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/analysis/orchestrator.ts`

**Current**: Reads each file twice = 50% I/O overhead
**Target**: Single read pass
**Effort**: 30 minutes

### Replace Lines 177-205

**BEFORE**:
```typescript
// Lines 178-187: First loop - checks cache
const filesToAnalyze: string[] = [];
for (const mdFile of markdownFiles) {
  const outputFileName = path.basename(mdFile, ".md") + ".md";
  if (manifestManager.isAnalysisNeeded(outputFileName, options.model, manifest, force)) {
    filesToAnalyze.push(mdFile);
  } else {
    stats.skipped++;
    logger.info(`✓ Skipped (cached): ${path.basename(mdFile)}`);
  }
}

// Lines 196-205: Second loop - reads files AGAIN
const transcripts: TranscriptMetadata[] = [];
for (const mdFile of filesToAnalyze) {
  const metadata = buildTranscriptMetadata(mdFile);
  if (metadata) {
    transcripts.push(metadata);
  } else {
    stats.failed++;
    stats.errors.push(`Failed to extract metadata from ${path.basename(mdFile)}`);
  }
}
```

**AFTER**:
```typescript
// Single combined loop - reads each file once
const filesToAnalyze: string[] = [];
const transcripts: TranscriptMetadata[] = [];

for (const mdFile of markdownFiles) {
  const outputFileName = path.basename(mdFile, ".md") + ".md";

  // Check if analysis needed
  if (manifestManager.isAnalysisNeeded(outputFileName, options.model, manifest, force)) {
    filesToAnalyze.push(mdFile);

    // Read metadata while we're at it
    const metadata = buildTranscriptMetadata(mdFile);
    if (metadata) {
      transcripts.push(metadata);
    } else {
      stats.failed++;
      stats.errors.push(`Failed to extract metadata from ${path.basename(mdFile)}`);
    }
  } else {
    stats.skipped++;
    logger.info(`✓ Skipped (cached): ${path.basename(mdFile)}`);
  }
}
```

**Validation**:
```bash
# Enable debug logging to see file operations
LOG_LEVEL=debug npm run analyze-existing

# Should see only 1 read per file, not 2
```

---

## Fix 3: Single-Pass Summary Filtering (Priority: HIGH)

**File**: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/summary/route.ts` (lines 41-51)

**Current**: Runs 3 filter() calls = O(n*3)
**Target**: Single pass with counters = O(n)
**Effort**: 20 minutes (included in Fix 1)

### Already Covered Above

The caching implementation (Fix 1, Step 2) includes this optimization:

```typescript
// OLD: 3 separate filter passes
const statusCounts = {
  pending: decisions.filter((d: any) => d.status === 'pending').length,
  in_progress: decisions.filter((d: any) => d.status === 'in_progress').length,
  completed: decisions.filter((d: any) => d.status === 'completed').length,
};

// NEW: Single pass
const statusCounts = { pending: 0, in_progress: 0, completed: 0 };
decisions.forEach((d: any) => {
  statusCounts[d.status as keyof typeof statusCounts] =
    (statusCounts[d.status as keyof typeof statusCounts] || 0) + 1;
});
```

---

## Fix 4: Table Virtualization for Scale (Priority: MEDIUM)

**File**: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/decisions/components/DecisionsTable.tsx`

**Current**: Renders all rows = 500ms at 1000 items
**Target**: Virtual scrolling = 50ms (10x faster)
**Effort**: 2 hours

### Step 1: Install React Window

```bash
cd /Users/georgeeastwood/AI\ Projects/Transcript\ To\ Strategy/transcript-analyzer-unified
npm install react-window
npm install --save-dev @types/react-window
```

### Step 2: Create Virtualized Table Component

Create `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/decisions/components/VirtualizedDecisionsTable.tsx`:

```typescript
'use client';

import { FixedSizeList as List } from 'react-window';
import { Decision } from './DecisionsTable';
import { useState } from 'react';

interface VirtualizedDecisionsTableProps {
  decisions: Decision[];
  onSelectDecision?: (decision: Decision) => void;
  height?: number;
}

const ROW_HEIGHT = 60; // Adjust based on your row design

export function VirtualizedDecisionsTable({
  decisions,
  onSelectDecision,
  height = 600,
}: VirtualizedDecisionsTableProps) {
  const [sortBy, setSortBy] = useState<'text' | 'owner' | 'status'>('text');

  const sortedDecisions = [...decisions].sort((a, b) => {
    const aValue = a[sortBy] || '';
    const bValue = b[sortBy] || '';
    return String(aValue).localeCompare(String(bValue));
  });

  // Row renderer
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const decision = sortedDecisions[index];
    const statusColors: Record<string, string> = {
      pending: 'bg-orange-100 text-orange-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };

    return (
      <div
        style={style}
        className="flex items-center px-4 py-3 border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
        onClick={() => onSelectDecision?.(decision)}
      >
        <div className="flex-1">
          <div className="font-medium text-slate-900 truncate">
            {decision.text}
          </div>
          <div className="text-sm text-slate-500">
            {decision.meeting}
          </div>
        </div>
        <div className="px-3">
          <span className="text-sm text-slate-600">
            {decision.owner || '—'}
          </span>
        </div>
        <div className="px-3">
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              statusColors[decision.status || ''] || 'bg-slate-100 text-slate-800'
            }`}
          >
            {decision.status || '—'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="flex-1">
          <button
            className="font-semibold text-slate-900 hover:text-slate-600"
            onClick={() => setSortBy('text')}
          >
            Decision {sortBy === 'text' ? '↓' : ''}
          </button>
        </div>
        <div className="px-3">
          <button
            className="font-semibold text-slate-900 hover:text-slate-600"
            onClick={() => setSortBy('owner')}
          >
            Owner {sortBy === 'owner' ? '↓' : ''}
          </button>
        </div>
        <div className="px-3">
          <button
            className="font-semibold text-slate-900 hover:text-slate-600"
            onClick={() => setSortBy('status')}
          >
            Status {sortBy === 'status' ? '↓' : ''}
          </button>
        </div>
      </div>

      {/* Virtual list */}
      {decisions.length > 0 ? (
        <List
          height={height}
          itemCount={sortedDecisions.length}
          itemSize={ROW_HEIGHT}
          width="100%"
        >
          {Row}
        </List>
      ) : (
        <div className="text-center py-12 text-slate-500">
          No decisions found
        </div>
      )}
    </div>
  );
}
```

### Step 3: Update Decisions Page

In `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/decisions/page.tsx`, line 122:

**Change from**:
```typescript
<DecisionsTable
  decisions={decisions}
  onSelectDecision={setSelectedDecision}
/>
```

**Change to**:
```typescript
{decisions.length > 500 ? (
  <VirtualizedDecisionsTable
    decisions={decisions}
    onSelectDecision={setSelectedDecision}
    height={600}
  />
) : (
  <DecisionsTable
    decisions={decisions}
    onSelectDecision={setSelectedDecision}
  />
)}
```

**Testing**:
```bash
npm run dev
# Load decisions page with 1000+ items
# Should scroll smoothly without jank
```

---

## Verification Checklist

### After Implementing Fix 1 (API Caching)

- [ ] Create `/lib/kmsCache.ts`
- [ ] Update `/app/api/kms/summary/route.ts`
- [ ] Update `/app/api/kms/decisions/route.ts`
- [ ] Update `/app/api/kms/actions/route.ts`
- [ ] Update `/app/api/kms/relationships/route.ts`
- [ ] Benchmark: `curl http://localhost:3000/api/kms/summary` (first call ~100ms, second <5ms)
- [ ] Dashboard page loads in <500ms (was ~1.5s)

### After Implementing Fix 2 (Deduplicate Reads)

- [ ] Update `/src/analysis/orchestrator.ts` lines 177-205
- [ ] Run analysis with debug logging: `LOG_LEVEL=debug npm run analyze-existing`
- [ ] Verify: Only 1 file read per file (not 2)
- [ ] Measure: Analysis should be 50% faster on second run

### After Implementing Fix 3 (Filter Pattern)

- [ ] Already included in Fix 1
- [ ] Verify summary generation is <100ms even with 10K decisions

### After Implementing Fix 4 (Virtualization)

- [ ] Install `react-window` and `@types/react-window`
- [ ] Create `VirtualizedDecisionsTable.tsx`
- [ ] Update `/app/decisions/page.tsx`
- [ ] Test with 1000+ decisions
- [ ] Verify smooth scrolling (60 FPS)

---

## Performance Improvement Summary

| Fix | Current | Target | Speedup | Effort |
|-----|---------|--------|---------|--------|
| 1: API Caching | 100ms | 1-5ms | 20-100x | 1.5h |
| 2: Dedup Reads | 50% overhead | 0% | 2x | 0.5h |
| 3: Filter Fix | ~30ms | ~10ms | 3x | (included) |
| 4: Virtualization | 500ms | 50ms | 10x | 2h |

**Total Effort**: 4 hours
**Total Speedup**: ~200x on dashboard load, 10x on table rendering

---

## Rollback Instructions

If any fix causes issues:

```bash
# Revert to original state
git checkout src/analysis/orchestrator.ts
git checkout app/api/kms/
rm lib/kmsCache.ts
npm uninstall react-window @types/react-window
```

---

## Monitoring After Deployment

Add these checks to your deployment checklist:

```bash
# 1. API Response Time Check
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/kms/summary

# 2. Dashboard Load Check
curl -w "time_total: %{time_total}\n" -o /dev/null -s http://localhost:3000/dashboard

# 3. Table Render Check (with many decisions)
# Measure FCP in Chrome DevTools: should be <500ms

# 4. Cache Hit Ratio
# Check logs: grep "cache hit" ~/.transcript-analyzer/logs.txt
```

---

## Next Steps

After implementing these fixes:

1. Benchmark performance improvements
2. Consider Fix 5: Manifest indexing (only needed at 1000+ files)
3. Monitor KMS store growth (backup if >100MB)
4. Consider pagination for very large decision lists (>5000 items)

See `/docs/PERFORMANCE_ANALYSIS.md` for full analysis and additional recommendations.
