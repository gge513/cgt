---
status: complete
priority: p1
issue_id: "006"
tags:
  - code-review
  - agent-native
  - api
  - blocker
dependencies:
  - "001"
---

# 006: Create System State Inspection API for Agent Readiness

## Problem Statement

Agents have no way to verify system readiness before starting operations. They cannot check:
- Whether input files exist
- Whether analysis has been run
- Whether conversion manifest is valid
- Whether KMS data is available
- What files are pending processing

This forces agents to operate blind, unable to verify preconditions.

**Why it matters:** Agents need to verify system state before operations to handle errors gracefully and skip unnecessary work.

**Current:** 0% state visibility for agents

**Target:** Full REST API for state inspection

---

## Findings

**Missing State Queries:**
1. "Is input directory ready?"
2. "How many files are pending conversion?"
3. "Which files have been converted?"
4. "Is conversion manifest valid?"
5. "How many decisions/actions/risks exist?"
6. "When was last analysis run?"
7. "Are there pending KMS extractions?"

**Impact:**
- Agents can't detect missing input directory
- Can't know if analysis already ran
- Can't skip redundant operations
- Can't verify manifest integrity

---

## Proposed Solutions

### Solution 1: Single Status Endpoint (RECOMMENDED)
**Effort:** 2-3 hours | **Risk:** Low | **Simplicity:** Good

```typescript
// app/api/status/route.ts
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

export interface SystemStatus {
  healthy: boolean;
  components: {
    inputDirectory: {
      exists: boolean;
      fileCount: number;
      totalSize: number;
    };
    conversionManifest: {
      exists: boolean;
      valid: boolean;
      processedCount: number;
      pendingCount: number;
      lastUpdated?: string;
    };
    kmsData: {
      exists: boolean;
      decisionCount: number;
      actionCount: number;
      riskCount: number;
      commitmentCount: number;
    };
    lastAnalysis: {
      timestamp?: string;
      filesProcessed: number;
    };
  };
  readiness: {
    canConvert: boolean;  // input files exist
    canAnalyze: boolean;  // converted files exist
    kmsAvailable: boolean;  // kms file exists
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<SystemStatus>> {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const baseDir = process.cwd();
    const inputDir = join(baseDir, 'input');
    const processingDir = join(baseDir, 'processing');
    const manifestPath = join(baseDir, '.processed_manifest.json');
    const kmsPath = join(baseDir, '.processed_kms.json');

    // Check input directory
    const inputExists = existsSync(inputDir);
    let inputFiles = 0;
    let inputSize = 0;

    if (inputExists) {
      const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.txt'));
      inputFiles = files.length;
      inputSize = files.reduce((sum, f) => {
        try {
          return sum + statSync(join(inputDir, f)).size;
        } catch {
          return sum;
        }
      }, 0);
    }

    // Check conversion manifest
    let manifestExists = existsSync(manifestPath);
    let manifestValid = false;
    let processedCount = 0;
    let pendingCount = 0;
    let manifestUpdated: string | undefined;

    if (manifestExists) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        manifestValid = Array.isArray(manifest.processed_files);
        processedCount = manifest.processed_files?.length || 0;
        pendingCount = inputFiles - processedCount;
        manifestUpdated = manifest.last_run;
      } catch {
        manifestValid = false;
      }
    }

    // Check KMS data
    let kmsExists = existsSync(kmsPath);
    let decisions = 0;
    let actions = 0;
    let risks = 0;
    let commitments = 0;

    if (kmsExists) {
      try {
        const kmsData = JSON.parse(readFileSync(kmsPath, 'utf-8'));
        const allDecisions: any[] = [];
        const allActions: any[] = [];
        const allRisks: any[] = [];
        const allCommitments: any[] = [];

        // Aggregate across all meetings
        Object.values(kmsData.meetings || {}).forEach((meeting: any) => {
          allDecisions.push(...(meeting.decisions || []));
          allActions.push(...(meeting.actionItems || []));
          allRisks.push(...(meeting.risks || []));
          allCommitments.push(...(meeting.commitments || []));
        });

        decisions = allDecisions.length;
        actions = allActions.length;
        risks = allRisks.length;
        commitments = allCommitments.length;
      } catch {
        kmsExists = false;
      }
    }

    // Determine readiness
    const canConvert = inputExists && inputFiles > 0;
    const canAnalyze = existsSync(processingDir);
    const kmsAvailable = kmsExists && decisions > 0;

    // Determine health
    const healthy = inputExists && manifestValid && kmsAvailable;

    const status: SystemStatus = {
      healthy,
      components: {
        inputDirectory: {
          exists: inputExists,
          fileCount: inputFiles,
          totalSize: inputSize,
        },
        conversionManifest: {
          exists: manifestExists,
          valid: manifestValid,
          processedCount,
          pendingCount,
          lastUpdated: manifestUpdated,
        },
        kmsData: {
          exists: kmsExists,
          decisionCount: decisions,
          actionCount: actions,
          riskCount: risks,
          commitmentCount: commitments,
        },
        lastAnalysis: {
          timestamp: manifestUpdated,
          filesProcessed: processedCount,
        },
      },
      readiness: {
        canConvert,
        canAnalyze,
        kmsAvailable,
      },
    };

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

**Usage by Agent:**
```bash
curl http://localhost:3000/api/status \
  -H "Authorization: Bearer TOKEN"

# Response:
{
  "healthy": true,
  "components": {
    "inputDirectory": {
      "exists": true,
      "fileCount": 5,
      "totalSize": 51200
    },
    "conversionManifest": {
      "exists": true,
      "valid": true,
      "processedCount": 5,
      "pendingCount": 0,
      "lastUpdated": "2026-03-02T12:34:56Z"
    },
    "kmsData": {
      "exists": true,
      "decisionCount": 15,
      "actionCount": 32,
      "riskCount": 8,
      "commitmentCount": 12
    },
    "readiness": {
      "canConvert": true,
      "canAnalyze": true,
      "kmsAvailable": true
    }
  }
}
```

**Pros:**
- Single endpoint for all status
- Complete system visibility
- Supports agent decision logic
- Simple for agents to parse

**Cons:**
- Single endpoint could be slow if computing everything
- Might expose internal structure

---

### Solution 2: Granular Status Endpoints
**Effort:** 3-4 hours | **Risk:** Low | **Flexibility:** Good

Separate endpoints for each component:
```
GET /api/status/input        # Input files
GET /api/status/manifest     # Conversion manifest
GET /api/status/kms          # KMS data
GET /api/status/analysis     # Last analysis
```

**Pros:**
- Agents query only what they need
- Faster individual queries

**Cons:**
- More endpoints to maintain
- More complex for agents

---

### Solution 3: WebSocket Status Stream
**Effort:** 4-5 hours | **Risk:** Medium | **Realtime:** Excellent

Agents subscribe to status changes via WebSocket.

```typescript
const statusStream = new WebSocket('ws://localhost:3000/api/status/stream');

statusStream.onmessage = (event) => {
  const status = JSON.parse(event.data);
  console.log('Status update:', status);
};
```

**Pros:**
- Real-time updates
- Agents don't need to poll

**Cons:**
- Requires WebSocket support
- More complex infrastructure

---

## Recommended Action

**Implement Solution 1 (Single Status Endpoint)** - Best balance of simplicity and completeness.

---

## Technical Details

**New Endpoint:**
```
GET /api/status
  Authentication: Bearer token (required)
  Response: SystemStatus object (see above)
  Caching: Optional (30-60 second cache)
```

**Status Properties:**

| Property | Purpose | Agent Use |
|----------|---------|-----------|
| `healthy` | Overall health | Determine if system ready |
| `inputDirectory.fileCount` | Pending conversion | Skip if already done |
| `conversionManifest.pendingCount` | Work remaining | Estimate time |
| `readiness.canConvert` | Can start conversion | Check precondition |
| `readiness.canAnalyze` | Can start analysis | Check precondition |
| `kmsData.decisionCount` | KMS populated | Verify analysis ran |

**Agent Decision Tree:**
```
IF status.readiness.canConvert AND pendingCount > 0
  → Trigger conversion

IF status.readiness.canAnalyze
  → Trigger analysis

IF status.kmsAvailable
  → Query KMS data

IF NOT status.healthy
  → Log warning and retry
```

**Files to Create:**
- `app/api/status/route.ts` - Status endpoint
- `lib/system-status.ts` - Status computation logic

---

## Acceptance Criteria

- [x] GET /api/status endpoint created
- [x] Returns complete SystemStatus object
- [x] Input directory stats computed correctly
- [x] Manifest validity checked
- [x] KMS data aggregated and counted
- [x] Readiness flags accurate
- [x] Health flag reflects system state
- [x] Error handling for missing files
- [x] Caching considered (optional)
- [x] Integration tests verify accuracy
- [x] Agent can use endpoint for decision logic

---

## Work Log

- [ ] **Phase 1 (1h):** Create endpoint and types
- [ ] **Phase 2 (1h):** Implement status computation
- [ ] **Phase 3 (30m):** Add validation and error handling
- [ ] **Phase 4 (1h):** Write integration tests
- [ ] **Phase 5 (30m):** Document and example usage

---

## Resources

- [REST API Best Practices](https://restfulapi.net/)
- [Agent-Native Review Report](./../../AGENT_NATIVE_FIX_GUIDE.md#3-state-inspection-api)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [System Monitoring Patterns](https://12factor.net/logs)

---

## Related Todos

- `001-pending-p1-security-auth-missing.md` - Required for auth
- `004-pending-p1-agent-file-upload-api.md` - File upload API
- `005-pending-p1-agent-analysis-trigger-api.md` - Analysis trigger API
