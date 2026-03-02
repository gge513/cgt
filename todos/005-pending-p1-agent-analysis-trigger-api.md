---
status: pending
priority: p1
issue_id: "005"
tags:
  - code-review
  - agent-native
  - api
  - blocker
dependencies:
  - "001"
---

# 005: Create Analysis Trigger API for Agent Autonomy

## Problem Statement

Agents cannot trigger analysis via REST API. Currently, they must execute subprocess commands:
```bash
npm run analyze  # Non-ideal for agents
```

Agents need a REST endpoint to trigger analysis with visibility into:
- Completion status
- Conversion progress
- Analysis results
- Error handling

**Why it matters:** Agents need REST API for control, not subprocess execution. This is core to agent autonomy.

**Current:** 0% agent API coverage for analysis

**Target:** Full REST API for all analysis workflows

---

## Findings

**Missing Workflows:**
1. Trigger full analysis (convert + analyze)
2. Trigger conversion only
3. Trigger analysis on existing converted files
4. Poll analysis status
5. Get analysis results

**Current CLI Commands (Good for Users, Bad for Agents):**
```bash
npm run analyze              # Full pipeline
npm run convert              # Convert only
npm run analyze-existing     # Analyze only
```

**Should map to REST endpoints:**
```
POST /api/analyze              → Full pipeline
POST /api/convert              → Convert only
POST /api/analyze-existing     → Analyze existing
GET  /api/analyze/status/:id   → Poll status
GET  /api/analyze/results/:id  → Get results
```

---

## Proposed Solutions

### Solution 1: Async Analysis with Polling (RECOMMENDED)
**Effort:** 4-5 hours | **Risk:** Low | **UX:** Good

```typescript
// app/api/analyze/route.ts
import { orchestrateFullPipeline } from '@/src/conversion/orchestrator';
import { v4 as uuid } from 'uuid';

const ANALYSIS_JOBS = new Map<string, AnalysisJob>();

interface AnalysisJob {
  id: string;
  status: 'pending' | 'converting' | 'analyzing' | 'completed' | 'failed';
  progress: number;  // 0-100
  startedAt: Date;
  completedAt?: Date;
  results?: any;
  error?: string;
}

export async function POST(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Create job
    const jobId = uuid();
    const job: AnalysisJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
    };

    ANALYSIS_JOBS.set(jobId, job);

    // Start analysis asynchronously (don't wait for completion)
    runAnalysisAsync(jobId, job);

    return NextResponse.json(
      {
        jobId,
        status: 'queued',
        pollUrl: `/api/analyze/status/${jobId}`,
      },
      { status: 202 }  // Accepted
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start analysis', details: String(error) },
      { status: 500 }
    );
  }
}

// Poll endpoint
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId required' },
      { status: 400 }
    );
  }

  const job = ANALYSIS_JOBS.get(jobId);

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    results: job.status === 'completed' ? job.results : null,
    error: job.error,
  });
}

async function runAnalysisAsync(jobId: string, job: AnalysisJob) {
  try {
    job.status = 'converting';
    job.progress = 0;

    // Run conversion
    const conversionResult = await convertTranscripts();
    job.progress = 50;

    // Run analysis
    job.status = 'analyzing';
    const analysisResult = await analyzeConvertedFiles();
    job.progress = 100;

    // Store results
    job.status = 'completed';
    job.completedAt = new Date();
    job.results = {
      filesConverted: conversionResult.count,
      filesAnalyzed: analysisResult.count,
    };
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
  }
}
```

**Usage by Agent:**
```bash
# Start analysis
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer TOKEN"

# Response (202 Accepted):
{
  "jobId": "abc-123",
  "status": "queued",
  "pollUrl": "/api/analyze/status/abc-123"
}

# Poll for status
curl http://localhost:3000/api/analyze/status/abc-123?jobId=abc-123 \
  -H "Authorization: Bearer TOKEN"

# Response:
{
  "jobId": "abc-123",
  "status": "completed",
  "progress": 100,
  "results": {
    "filesConverted": 5,
    "filesAnalyzed": 5
  }
}
```

**Pros:**
- Non-blocking (202 Accepted)
- Progress visibility
- Results available on completion
- Standard polling pattern

**Cons:**
- Agent must poll (vs WebSocket)
- Job storage in memory (lost on restart)

---

### Solution 2: WebSocket for Real-Time Updates
**Effort:** 6-8 hours | **Risk:** Medium | **UX:** Excellent

Uses WebSocket for real-time progress updates instead of polling.

```typescript
// lib/websocket.ts
import { WebSocket } from 'ws';

export async function handleAnalysisWebSocket(ws: WebSocket) {
  try {
    const jobId = uuid();

    ws.send(JSON.stringify({
      type: 'start',
      jobId,
    }));

    // Stream progress updates
    await orchestrateFullPipeline((progress) => {
      ws.send(JSON.stringify({
        type: 'progress',
        jobId,
        progress,
      }));
    });

    ws.send(JSON.stringify({
      type: 'complete',
      jobId,
      results: { /* ... */ },
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
}
```

**Pros:**
- Real-time updates
- No polling overhead
- Bidirectional communication

**Cons:**
- More complex
- Requires WebSocket library
- Stateful connections

---

### Solution 3: Webhook Callbacks
**Effort:** 3-4 hours | **Risk:** Medium | **Complexity:** Medium

Analysis posts results to agent-provided webhook URL.

```typescript
const jobId = uuid();
const webhookUrl = request.body.webhookUrl;

// Validate webhook URL is allowed
if (!isAllowedWebhook(webhookUrl)) {
  return NextResponse.json(
    { error: 'Webhook URL not allowed' },
    { status: 403 }
  );
}

// Run async and callback when done
runAnalysisAsync(jobId, () => {
  // POST results to webhook
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      status: 'completed',
      results: { /* ... */ },
    }),
  });
});
```

**Pros:**
- Push-based (no polling)
- Simple to integrate

**Cons:**
- Requires agent webhook
- Security considerations
- One-way communication

---

## Recommended Action

**Implement Solution 1 (Async with Polling)** - Simplest, most reliable, standard pattern.

---

## Technical Details

**New Endpoints:**
```
POST /api/analyze
  Query: ?mode=full|convert|existing (default: full)
  Response: { jobId, status: "queued", pollUrl }

GET /api/analyze/status?jobId=<id>
  Response: { jobId, status, progress, results, error }

GET /api/analyze/results?jobId=<id>
  Response: { results, completedAt } (if status=completed)
```

**Modes:**
- `full` - Convert + analyze
- `convert` - Convert only
- `existing` - Analyze existing conversions

**Files to Create:**
- `app/api/analyze/route.ts` - Analysis endpoint
- `app/api/analyze/status/route.ts` - Status polling endpoint
- `lib/analysis-jobs.ts` - Job management

**In-Memory Storage:**
- Map<jobId, AnalysisJob>
- Consider Redis for production (persistence across restarts)

---

## Acceptance Criteria

- [ ] POST /api/analyze endpoint created
- [ ] Returns 202 Accepted with jobId
- [ ] Status endpoint returns job progress
- [ ] Conversion triggers and runs async
- [ ] Analysis triggers and runs async
- [ ] Progress updates from 0 to 100
- [ ] Results available after completion
- [ ] Error messages captured and returned
- [ ] Integration tests verify full flow
- [ ] Agent can trigger and monitor analysis via API

---

## Work Log

- [ ] **Phase 1 (1.5h):** Create endpoints and routing
- [ ] **Phase 2 (1.5h):** Implement async execution
- [ ] **Phase 3 (1h):** Add progress tracking
- [ ] **Phase 4 (1h):** Write integration tests
- [ ] **Phase 5 (30m):** Document API and polling

---

## Resources

- [HTTP 202 Accepted Pattern](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/202)
- [Job Queue Best Practices](https://www.patterns.dev/posts/job-queue-pattern/)
- [Agent-Native Review Report](./../../AGENT_NATIVE_FIX_GUIDE.md#2-analysis-trigger-api)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

---

## Related Todos

- `001-pending-p1-security-auth-missing.md` - Required for auth
- `004-pending-p1-agent-file-upload-api.md` - File upload API
- `006-pending-p1-agent-state-inspection-api.md` - State inspection API
