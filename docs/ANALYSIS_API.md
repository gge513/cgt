# Analysis Trigger API

Agents can start transcript analysis asynchronously via REST API without using `npm run` commands.

## Quick Start

### 1. Start Analysis Job

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}'
```

**Response (202 Accepted):**
```json
{
  "jobId": "abc-123-def-456",
  "status": "queued",
  "mode": "full",
  "pollUrl": "/api/analyze/status?jobId=abc-123-def-456",
  "message": "Analysis job full queued. Poll the status URL to monitor progress."
}
```

### 2. Poll Job Status

```bash
curl http://localhost:3000/api/analyze/status?jobId=abc-123-def-456 \
  -H "Authorization: Bearer <token>"
```

**Response (Job In Progress):**
```json
{
  "jobId": "abc-123-def-456",
  "mode": "full",
  "status": "analyzing",
  "progress": 75,
  "startedAt": "2026-03-02T12:34:56.000Z"
}
```

**Response (Job Completed):**
```json
{
  "jobId": "abc-123-def-456",
  "mode": "full",
  "status": "completed",
  "progress": 100,
  "startedAt": "2026-03-02T12:34:56.000Z",
  "completedAt": "2026-03-02T12:36:45.000Z",
  "durationSeconds": 109,
  "results": {
    "filesConverted": 5,
    "filesAnalyzed": 5
  }
}
```

## API Endpoints

### POST /api/analyze - Start Analysis

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```typescript
{
  mode?: 'full' | 'convert' | 'existing'  // default: 'full'
}
```

**Response: 202 Accepted**
```typescript
{
  jobId: string;
  status: 'queued';
  mode: 'full' | 'convert' | 'existing';
  pollUrl: string;
  message: string;
}
```

**Response: 400 Bad Request**
```json
{
  "error": "Invalid mode. Must be: full, convert, or existing"
}
```

**Response: 401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "details": "Authorization header missing"
}
```

### GET /api/analyze/status - Poll Job Status

**Authentication:** Required (JWT Bearer token)

**Query Parameters:**
- `jobId` (required): Job ID returned from POST /api/analyze

**Response: 200 OK**
```typescript
{
  jobId: string;
  mode: 'full' | 'convert' | 'existing';
  status: 'pending' | 'converting' | 'analyzing' | 'completed' | 'failed';
  progress: number;  // 0-100
  startedAt: string;  // ISO 8601
  completedAt?: string;  // ISO 8601 (if complete)
  durationSeconds?: number;  // Total execution time
  results?: {
    filesConverted?: number;
    filesAnalyzed?: number;
    filesFailed?: number;
  };
  error?: string;  // If status is 'failed'
}
```

**Response: 400 Bad Request**
```json
{
  "error": "Missing jobId parameter"
}
```

**Response: 404 Not Found**
```json
{
  "error": "Job not found",
  "details": "Job ID abc-123 not found"
}
```

## Analysis Modes

### Mode: 'full' (Default)

Complete pipeline: Convert transcripts → Analyze → Generate reports

```
Conversion (0-50%)
  ↓
Analysis (50-100%)
  ↓
Reports generated
```

**Use when:**
- Processing new transcripts for the first time
- Want complete end-to-end processing

**Duration:** 1-2 minutes per file

### Mode: 'convert'

Convert transcripts to markdown only, skip analysis

```
Conversion (0-100%)
  ↓
Files ready in processing/
```

**Use when:**
- Want to inspect converted files before analysis
- Need to process in stages
- Want to test with small sample first

**Duration:** <1 minute per file

### Mode: 'existing'

Analyze already-converted files, skip conversion

```
Analysis (0-100%)
  ↓
Reports generated
```

**Use when:**
- Analyzing previously converted files
- Re-analyzing with different model
- Processing large batches in stages

**Duration:** 1-2 minutes per file

## Job Status Flow

### Full Pipeline (mode: 'full')

```
pending
  ↓
converting (progress: 10-50%)
  ↓
analyzing (progress: 50-100%)
  ↓
completed (progress: 100%)
```

### Convert Only (mode: 'convert')

```
pending
  ↓
converting (progress: 10-100%)
  ↓
completed (progress: 100%)
```

### Analyze Only (mode: 'existing')

```
pending
  ↓
analyzing (progress: 10-100%)
  ↓
completed (progress: 100%)
```

## Code Examples

### Node.js Agent

```typescript
import { signToken } from '@/lib/jwt';

async function analyzeTranscripts() {
  const token = signToken({ sub: 'agent-123' }, '24h');

  // Start analysis job
  const startResponse = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode: 'full' }),
  });

  if (!startResponse.ok) {
    throw new Error(`Failed to start analysis: ${startResponse.statusText}`);
  }

  const { jobId } = await startResponse.json();
  console.log(`Started analysis job: ${jobId}`);

  // Poll until complete
  return pollAnalysisJob(token, jobId);
}

async function pollAnalysisJob(token: string, jobId: string): Promise<any> {
  const maxAttempts = 120;  // 5 minutes with 2.5s interval
  let attempts = 0;

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(
      `http://localhost:3000/api/analyze/status?jobId=${jobId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to get status: ${statusResponse.statusText}`);
    }

    const job = await statusResponse.json();
    console.log(`Job ${jobId}: ${job.status} (${job.progress}%)`);

    if (job.status === 'completed') {
      console.log(`Analysis complete!`, job.results);
      return job;
    }

    if (job.status === 'failed') {
      throw new Error(`Analysis failed: ${job.error}`);
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, 2500));
    attempts++;
  }

  throw new Error('Analysis timeout - exceeded max polling attempts');
}

// Run
analyzeTranscripts().catch(console.error);
```

### Python Agent

```python
import requests
import json
import time
import jwt
import os

def analyze_transcripts():
    secret = os.getenv('JWT_SECRET')
    token = jwt.encode({'sub': 'agent-123'}, secret, algorithm='HS256')

    # Start analysis job
    start_response = requests.post(
        'http://localhost:3000/api/analyze',
        headers={'Authorization': f'Bearer {token}'},
        json={'mode': 'full'}
    )

    if start_response.status_code != 202:
        raise Exception(f'Failed to start: {start_response.text}')

    job_id = start_response.json()['jobId']
    print(f'Started analysis job: {job_id}')

    # Poll until complete
    return poll_analysis_job(token, job_id)

def poll_analysis_job(token, job_id):
    max_attempts = 120
    attempts = 0

    while attempts < max_attempts:
        response = requests.get(
            f'http://localhost:3000/api/analyze/status',
            params={'jobId': job_id},
            headers={'Authorization': f'Bearer {token}'}
        )

        if response.status_code != 200:
            raise Exception(f'Failed to get status: {response.text}')

        job = response.json()
        print(f'Job {job_id}: {job["status"]} ({job["progress"]}%)')

        if job['status'] == 'completed':
            print(f'Analysis complete!', job['results'])
            return job

        if job['status'] == 'failed':
            raise Exception(f'Analysis failed: {job["error"]}')

        time.sleep(2.5)
        attempts += 1

    raise Exception('Analysis timeout - exceeded max polling attempts')

# Run
try:
    analyze_transcripts()
except Exception as e:
    print(f'Error: {e}')
```

### cURL Polling Loop

```bash
#!/bin/bash

TOKEN="<your_jwt_token>"

# Start analysis
RESPONSE=$(curl -s -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}')

JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
echo "Started job: $JOB_ID"

# Poll until complete
while true; do
  STATUS=$(curl -s "http://localhost:3000/api/analyze/status?jobId=$JOB_ID" \
    -H "Authorization: Bearer $TOKEN")

  PROGRESS=$(echo $STATUS | jq -r '.progress')
  STATE=$(echo $STATUS | jq -r '.status')

  echo "Job: $STATE ($PROGRESS%)"

  if [ "$STATE" = "completed" ]; then
    echo "Analysis complete!"
    echo $STATUS | jq '.results'
    break
  fi

  if [ "$STATE" = "failed" ]; then
    echo "Analysis failed!"
    echo $STATUS | jq '.error'
    exit 1
  fi

  sleep 2.5
done
```

## Error Handling

### Missing Authentication

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}'
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized",
  "details": "Authorization header missing"
}
```

### Invalid Mode

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "invalid"}'
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid mode. Must be: full, convert, or existing"
}
```

### Job Not Found

```bash
curl "http://localhost:3000/api/analyze/status?jobId=nonexistent" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (404 Not Found):**
```json
{
  "error": "Job not found",
  "details": "Job ID nonexistent not found"
}
```

## Polling Best Practices

### Recommended Polling Interval

```
Job Status          Recommended Interval   Reasoning
─────────────────────────────────────────────────────
pending             2-5 seconds            Quick start
converting          5-10 seconds           CPU intensive
analyzing           10-30 seconds          Slow API calls
failed/completed    Stop polling           Terminal state
```

### Exponential Backoff Example

```typescript
const pollWithBackoff = async (jobId: string, token: string) => {
  let delay = 2000;  // 2 seconds
  const maxDelay = 30000;  // 30 seconds
  const backoffFactor = 1.5;

  while (true) {
    const response = await fetch(`/api/analyze/status?jobId=${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const job = await response.json();

    if (['completed', 'failed'].includes(job.status)) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Increase delay (cap at maxDelay)
    delay = Math.min(delay * backoffFactor, maxDelay);
  }
};
```

## Progress Tracking Visualization

### CLI Progress Bar

```typescript
function displayProgress(job: any) {
  const barLength = 50;
  const filledLength = Math.round((barLength * job.progress) / 100);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  console.clear();
  console.log(`Analysis: ${job.status.toUpperCase()}`);
  console.log(`[${bar}] ${job.progress}%`);

  if (job.results) {
    console.log(`\nResults:`);
    console.log(`  Files analyzed: ${job.results.filesAnalyzed}`);
    console.log(`  Duration: ${job.durationSeconds}s`);
  }
}
```

### Web UI Progress

```typescript
export function AnalysisProgress({ jobId, token }: Props) {
  const [job, setJob] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling) return;

    const poll = async () => {
      const response = await fetch(`/api/analyze/status?jobId=${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      setJob(data);

      if (['completed', 'failed'].includes(data.status)) {
        setIsPolling(false);
      }
    };

    poll();
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [jobId, token, isPolling]);

  if (!job) return <div>Loading...</div>;

  return (
    <div>
      <h2>{job.mode.toUpperCase()} Analysis</h2>
      <progress value={job.progress} max={100} />
      <p>{job.status} - {job.progress}%</p>

      {job.status === 'completed' && (
        <div>
          <h3>Results</h3>
          <p>Files analyzed: {job.results.filesAnalyzed}</p>
          <p>Duration: {job.durationSeconds}s</p>
        </div>
      )}

      {job.status === 'failed' && (
        <div style={{ color: 'red' }}>
          Error: {job.error}
        </div>
      )}
    </div>
  );
}
```

## Performance Considerations

### Job Storage

Jobs are stored in memory with automatic cleanup:

- **Max jobs in memory:** 1,000
- **Cleanup trigger:** When limit approached
- **Retention:** Completed jobs kept for 24 hours
- **Scaling:** Consider Redis for multi-instance deployment

### Large Batch Processing

For large batches, consider:

```typescript
// Sequential processing (safer)
for (const file of files) {
  const job = startAnalysis('full');
  await waitForCompletion(job.jobId);
}

// Parallel processing (faster but uses more resources)
const jobs = files.map(() => startAnalysis('full'));
await Promise.all(jobs.map((job) => waitForCompletion(job.jobId)));

// Hybrid (batch them in groups of 5)
const batchSize = 5;
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  const jobs = batch.map(() => startAnalysis('full'));
  await Promise.all(jobs.map((job) => waitForCompletion(job.jobId)));
}
```

## Monitoring & Debugging

### Job Count Monitoring

Track job creation and completion rates to identify bottlenecks:

```bash
# Check if jobs are accumulating (memory leak)
curl "http://localhost:3000/api/analyze/status?jobId=any" \
  -H "Authorization: Bearer $TOKEN" 2>&1 | grep -i "created"

# Monitor in logs
# [2026-03-02] [INFO] Created analysis job abc-123 with mode: full
# [2026-03-02] [INFO] Job abc-123 completed successfully
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing token | Generate token and include in header |
| 400 Bad Request | Invalid mode | Use: 'full', 'convert', or 'existing' |
| 404 Not Found | Job expired | Job IDs valid for 24 hours |
| Stuck at 50% | File I/O bottleneck | Check disk space and permissions |
| Very slow | Model overloaded | Reduce batch size or use faster model |

## Reference

- [JWT Authentication Guide](./AUTHENTICATION.md)
- [Analysis Pipeline Details](./README.md)
- [Transcript Format Requirements](./README.md)
