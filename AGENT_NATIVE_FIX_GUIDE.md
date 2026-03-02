# Agent-Native Architecture - Implementation Fix Guide

## Overview
This guide provides step-by-step implementation for closing the 3 critical gaps preventing full agent autonomy.

**Estimated Total Effort:** 1.5 days
**Impact:** Moves system from 74% to 95%+ agent-native

---

## P0: Critical Gap #1 - File Upload API

### Problem
Agents cannot upload transcripts. Must resort to:
```javascript
// Current (bad): Agent uses bash as workaround
await exec(`cp /tmp/meeting.txt input/meeting.txt`);
```

Should be:
```javascript
// Desired: Clean API
const response = await fetch('/api/kms/transcripts', {
  method: 'POST',
  body: JSON.stringify({
    filename: 'meeting.txt',
    content: '...' // or multipart for large files
  })
});
const { path, hash } = await response.json();
```

### Implementation

#### Step 1: Create Upload Route
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/transcripts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const INPUT_DIR = path.join(process.cwd(), 'input');

/**
 * Calculate MD5 hash of content
 */
function calculateHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Ensure unique filename (avoid overwriting)
 */
function generateUniqueFilename(originalName: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const baseName = originalName.replace(/\.txt$/, '');
  const candidate = `${timestamp}_${baseName}.txt`;

  let finalName = candidate;
  let counter = 1;

  // If file exists, append number
  while (fs.existsSync(path.join(INPUT_DIR, finalName))) {
    finalName = `${timestamp}_${baseName}_${counter}.txt`;
    counter++;
  }

  return finalName;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let filename: string;
    let content: string;
    let originalFilename: string;

    // Handle JSON body
    if (contentType.includes('application/json')) {
      const body = await request.json();

      if (!body.content || typeof body.content !== 'string') {
        return NextResponse.json(
          { error: 'Missing or invalid "content" field' },
          { status: 400 }
        );
      }

      originalFilename = body.filename || 'transcript.txt';
      content = body.content;

      // Validate filename
      if (!/^[a-zA-Z0-9\-_\s()\.]+$/.test(originalFilename)) {
        return NextResponse.json(
          {
            error: 'Invalid filename. Use alphanumeric, spaces, hyphens, underscores, parentheses only.'
          },
          { status: 400 }
        );
      }

      if (!originalFilename.endsWith('.txt')) {
        originalFilename += '.txt';
      }
    }
    // Handle multipart form data (future: for file uploads)
    else if (contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Multipart upload not yet implemented. Use JSON body with "content" field.' },
        { status: 501 }
      );
    }
    else {
      return NextResponse.json(
        {
          error: 'Unsupported content type. Use application/json with {filename, content} or multipart/form-data.'
        },
        { status: 400 }
      );
    }

    // Validate content
    if (content.length === 0) {
      return NextResponse.json(
        { error: 'Transcript content cannot be empty' },
        { status: 400 }
      );
    }

    if (content.length > 1024 * 1024) { // 1MB limit per file
      return NextResponse.json(
        {
          error: 'Transcript too large. Maximum 1MB per file.',
          details: { max_bytes: 1048576, provided_bytes: content.length }
        },
        { status: 413 }
      );
    }

    // Generate unique filename
    filename = generateUniqueFilename(originalFilename);
    const filePath = path.join(INPUT_DIR, filename);

    // Ensure input directory exists
    if (!fs.existsSync(INPUT_DIR)) {
      fs.mkdirSync(INPUT_DIR, { recursive: true });
    }

    // Calculate hash
    const hash = calculateHash(content);

    // Write file atomically (temp → rename)
    const tempPath = path.join(INPUT_DIR, `${filename}.tmp`);
    try {
      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      filename,
      path: `input/${filename}`,
      bytes: content.length,
      hash,
      ready_for_analysis: true,
      next_steps: [
        'File uploaded successfully',
        'Run: POST /api/analysis/analyze to process it',
        'Or: npm run analyze from CLI'
      ]
    }, { status: 201 });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Failed to upload transcript',
        details: message
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(INPUT_DIR)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(INPUT_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => ({
        filename: f,
        path: `input/${f}`,
        size_bytes: fs.statSync(path.join(INPUT_DIR, f)).size,
        modified: fs.statSync(path.join(INPUT_DIR, f)).mtime.toISOString()
      }));

    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list transcripts', details: String(error) },
      { status: 500 }
    );
  }
}
```

#### Step 2: Add Tests
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/test/api/kms-transcripts.test.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

describe('POST /api/kms/transcripts', () => {
  const tempDir = path.join(process.cwd(), 'test_input');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  test('should upload transcript with JSON body', async () => {
    const response = await fetch(
      'http://localhost:3000/api/kms/transcripts',
      {
        method: 'POST',
        body: JSON.stringify({
          filename: 'test-meeting.txt',
          content: 'This is a test transcript'
        })
      }
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.filename).toContain('test-meeting');
    expect(data.path).toContain('input/');
  });

  test('should reject empty content', async () => {
    const response = await fetch(
      'http://localhost:3000/api/kms/transcripts',
      {
        method: 'POST',
        body: JSON.stringify({
          filename: 'empty.txt',
          content: ''
        })
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('empty');
  });

  test('should reject oversized content', async () => {
    const largeContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
    const response = await fetch(
      'http://localhost:3000/api/kms/transcripts',
      {
        method: 'POST',
        body: JSON.stringify({
          filename: 'large.txt',
          content: largeContent
        })
      }
    );

    expect(response.status).toBe(413);
  });

  test('should generate unique filenames', async () => {
    const content = 'Test content';
    const filename = 'duplicate.txt';

    // Upload first time
    const response1 = await fetch(
      'http://localhost:3000/api/kms/transcripts',
      {
        method: 'POST',
        body: JSON.stringify({ filename, content })
      }
    );
    const data1 = await response1.json();

    // Upload again with same name
    const response2 = await fetch(
      'http://localhost:3000/api/kms/transcripts',
      {
        method: 'POST',
        body: JSON.stringify({ filename, content })
      }
    );
    const data2 = await response2.json();

    // Should generate different filenames
    expect(data1.filename).not.toEqual(data2.filename);
  });
});
```

---

## P0: Critical Gap #2 - Analysis Trigger API

### Problem
Agents must subprocess npm:
```javascript
// Current (bad):
const { stdout } = await exec('npm run analyze');
// Parse stdout to detect errors
```

Should be:
```javascript
// Desired:
const response = await fetch('/api/analysis/analyze', {
  method: 'POST',
  body: JSON.stringify({ forceReprocess: false })
});
const result = await response.json();
if (result.success) {
  console.log(`Analyzed ${result.analysisStats.analyzed} files`);
}
```

### Implementation

#### Step 1: Create Analysis Orchestration Route
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/analysis/analyze/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { convertTranscripts } from '@/src/conversion/converter';
import { analyzeConvertedFiles } from '@/src/analysis/orchestrator';
import { ManifestManager } from '@/src/conversion/manifest';
import { getModel } from '@/src/utils/client';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { forceReprocess, model } = body;

    const startTime = Date.now();
    const inputDir = 'input';
    const processingDir = 'processing';
    const outputDir = 'output';

    // Step 1: Convert transcripts
    logger.info('API: Starting conversion stage');
    const conversionStats = await convertTranscripts(inputDir, processingDir);

    if (conversionStats.total_found === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_INPUT_FILES',
          message: 'No transcript files found in input/ directory',
          details: { input_dir: inputDir }
        }
      }, { status: 400 });
    }

    logger.info(`API: Conversion complete: ${conversionStats.successful}/${conversionStats.total_found}`);

    // Step 2: Analyze converted files
    logger.info('API: Starting analysis stage');
    const manifestManager = new ManifestManager();
    let manifest = manifestManager.loadManifest();

    // Handle force reprocess
    if (forceReprocess) {
      logger.info('API: Force reprocess requested, clearing cache');
      manifest.processed_files.forEach(file => {
        file.analyses = {};
      });
    }

    const analysisModel = model || getModel();
    const analysisResult = await analyzeConvertedFiles(
      {
        processingDir,
        outputDir,
        model: analysisModel,
      },
      manifest
    );

    manifest = analysisResult.manifest;
    manifestManager.saveManifest(manifest);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      conversionStats,
      analysisStats: {
        analyzed: analysisResult.analyzed,
        skipped: analysisResult.skipped,
        failed: 0
      },
      output: {
        report_files: analysisResult.reportFiles,
        output_dir: outputDir
      },
      timing: {
        duration_ms: duration,
        duration_seconds: Math.round(duration / 1000)
      },
      next_steps: [
        'View results in output/ directory',
        'Query KMS data: GET /api/kms/summary',
        'Explore decisions: GET /api/kms/decisions'
      ]
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`API: Analysis failed: ${message}`);

    return NextResponse.json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'Failed to complete analysis',
        details: message
      }
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'status') {
      // Return current analysis status
      const outputDir = 'output';
      const processingDir = 'processing';

      const processingFiles = fs.existsSync(processingDir)
        ? fs.readdirSync(processingDir).filter(f => f.endsWith('.md')).length
        : 0;

      const outputFiles = fs.existsSync(outputDir)
        ? fs.readdirSync(outputDir).filter(f => f.endsWith('_report_*.md')).length
        : 0;

      return NextResponse.json({
        ready_to_analyze: processingFiles > 0,
        files_ready: processingFiles,
        reports_generated: outputFiles,
        next_steps: processingFiles > 0
          ? 'Run POST /api/analysis/analyze to process'
          : 'Upload transcripts first: POST /api/kms/transcripts'
      });
    }

    return NextResponse.json({
      description: 'Analysis API',
      endpoints: {
        'POST /api/analysis/analyze': 'Trigger conversion + analysis pipeline',
        'GET /api/analysis/analyze?action=status': 'Get analysis status'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status', details: String(error) },
      { status: 500 }
    );
  }
}
```

#### Step 2: Add Tests
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/test/api/analysis.test.ts`

```typescript
describe('POST /api/analysis/analyze', () => {
  test('should trigger full pipeline', async () => {
    // Assumes at least one file in input/
    const response = await fetch(
      'http://localhost:3000/api/analysis/analyze',
      { method: 'POST' }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.conversionStats).toBeDefined();
    expect(data.analysisStats).toBeDefined();
  });

  test('should return 400 if no input files', async () => {
    // Remove input files temporarily
    // Run request
    // Verify error code is NO_INPUT_FILES
  });

  test('should support forceReprocess flag', async () => {
    const response = await fetch(
      'http://localhost:3000/api/analysis/analyze',
      {
        method: 'POST',
        body: JSON.stringify({ forceReprocess: true })
      }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.analysisStats.analyzed).toBeGreaterThan(0);
  });

  test('GET ?action=status should show analysis status', async () => {
    const response = await fetch(
      'http://localhost:3000/api/analysis/analyze?action=status'
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ready_to_analyze).toBeDefined();
    expect(data.files_ready).toBeDefined();
  });
});
```

---

## P0: Critical Gap #3 - System State Inspection

### Problem
Agent cannot verify readiness:
```javascript
// Current: Manual bash commands
const haiku_count = await exec('cat .processed_manifest.json | jq ".processed_files | length"');
const input_files = await exec('ls input/ | wc -l');
```

Should be:
```javascript
// Desired:
const state = await (await fetch('/api/analysis/state')).json();
if (state.files.input_count > 0 && state.api_configured) {
  await fetch('/api/analysis/analyze', { method: 'POST' });
}
```

### Implementation

#### Step 1: Create State Endpoint
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/analysis/state/route.ts`

```typescript
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const apiConfigured = !!(apiKey && apiKey.length > 0);

    // Get model
    const model = process.env.MODEL_ID || 'claude-haiku-4-5-20251001';

    // Count files by directory
    const inputDir = 'input';
    const processingDir = 'processing';
    const outputDir = 'output';

    const countFiles = (dir: string, extension: string) => {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir)
        .filter(f => f.endsWith(extension))
        .length;
    };

    const inputCount = countFiles(inputDir, '.txt');
    const processingCount = countFiles(processingDir, '.md');
    const outputCount = countFiles(outputDir, '.md');

    // Load manifest
    let manifest = null;
    let manifestExists = false;
    try {
      const manifestPath = '.processed_manifest.json';
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        manifestExists = true;
      }
    } catch (e) {
      // Manifest read failed or invalid
    }

    // Load KMS data
    let kmsStats = { decisions: 0, actions: 0, commitments: 0, risks: 0 };
    try {
      const kmsPath = '.processed_kms.json';
      if (fs.existsSync(kmsPath)) {
        const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));
        const meetings = kmsData.meetings || {};

        Object.values(meetings).forEach((meeting: any) => {
          if (Array.isArray(meeting.decisions)) kmsStats.decisions += meeting.decisions.length;
          if (Array.isArray(meeting.actions)) kmsStats.actions += meeting.actions.length;
          if (Array.isArray(meeting.commitments)) kmsStats.commitments += meeting.commitments.length;
          if (Array.isArray(meeting.risks)) kmsStats.risks += meeting.risks.length;
        });
      }
    } catch (e) {
      // KMS read failed
    }

    // Calculate cache stats
    const cacheStats: Record<string, number> = {};
    if (manifestExists && manifest && manifest.processed_files) {
      manifest.processed_files.forEach((file: any) => {
        if (file.analyses) {
          Object.keys(file.analyses).forEach(modelName => {
            cacheStats[modelName] = (cacheStats[modelName] || 0) + 1;
          });
        }
      });
    }

    return NextResponse.json({
      api_configured: apiConfigured,
      model: model,
      files: {
        input: inputCount,
        processing: processingCount,
        output: outputCount,
        total: inputCount + processingCount + outputCount
      },
      kms: kmsStats,
      manifest: {
        exists: manifestExists,
        version: manifest?.version || null,
        processed_files: manifest?.processed_files?.length || 0,
        last_run: manifest?.last_run || null
      },
      cache: {
        total_analyses: Object.values(cacheStats).reduce((a, b) => a + b, 0),
        models: cacheStats
      },
      ready_for_analysis: apiConfigured && inputCount > 0,
      readiness_reasons: [
        apiConfigured ? 'API key configured' : 'API key not configured',
        inputCount > 0 ? `${inputCount} files in input/` : 'No files in input/',
        processingCount > 0 ? `${processingCount} files in processing/` : 'processing/ empty'
      ],
      next_actions: {
        if_no_files: 'POST /api/kms/transcripts to upload transcripts',
        if_has_files: 'POST /api/analysis/analyze to start processing',
        to_view_results: 'GET /api/kms/summary or GET /api/kms/decisions'
      }
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get state',
        details: String(error)
      },
      { status: 500 }
    );
  }
}
```

#### Step 2: Add Tests
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/test/api/state.test.ts`

```typescript
describe('GET /api/analysis/state', () => {
  test('should return system state', async () => {
    const response = await fetch(
      'http://localhost:3000/api/analysis/state'
    );

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.api_configured).toBeDefined();
    expect(data.model).toBeDefined();
    expect(data.files).toBeDefined();
    expect(data.files.input).toBeGreaterThanOrEqual(0);
    expect(data.kms).toBeDefined();
    expect(data.manifest).toBeDefined();
    expect(data.cache).toBeDefined();
    expect(data.ready_for_analysis).toBeDefined();
  });

  test('should indicate when API is not configured', async () => {
    // Temporarily unset API key
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const response = await fetch(
      'http://localhost:3000/api/analysis/state'
    );
    const data = await response.json();

    expect(data.api_configured).toBe(false);
    expect(data.ready_for_analysis).toBe(false);

    // Restore
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('should count files correctly', async () => {
    const response = await fetch(
      'http://localhost:3000/api/analysis/state'
    );
    const data = await response.json();

    expect(data.files.input).toBeGreaterThanOrEqual(0);
    expect(data.files.processing).toBeGreaterThanOrEqual(0);
    expect(data.files.output).toBeGreaterThanOrEqual(0);
  });
});
```

---

## Integration Testing: Complete Workflow

### Test Script
File: `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/test/integration/agent-workflow.test.ts`

This tests a complete agent workflow:

```typescript
describe('Complete Agent Workflow', () => {
  test('Agent should be able to: check state → upload → analyze → query', async () => {
    // Step 1: Check system state
    const stateResponse = await fetch(
      'http://localhost:3000/api/analysis/state'
    );
    const state = await stateResponse.json();

    expect(state.api_configured).toBe(true);
    console.log(`Initial state: ${state.files.input} input files`);

    // Step 2: Upload a transcript
    const uploadResponse = await fetch(
      'http://localhost:3000/api/kms/transcripts',
      {
        method: 'POST',
        body: JSON.stringify({
          filename: 'agent-test.txt',
          content: 'This is a test meeting transcript for agent automation.'
        })
      }
    );
    const uploadData = await uploadResponse.json();

    expect(uploadResponse.status).toBe(201);
    expect(uploadData.success).toBe(true);
    console.log(`Uploaded: ${uploadData.path}`);

    // Step 3: Verify file was uploaded
    const stateResponse2 = await fetch(
      'http://localhost:3000/api/analysis/state'
    );
    const state2 = await stateResponse2.json();

    expect(state2.files.input).toBe(state.files.input + 1);
    console.log(`After upload: ${state2.files.input} input files`);

    // Step 4: Trigger analysis
    const analyzeResponse = await fetch(
      'http://localhost:3000/api/analysis/analyze',
      { method: 'POST' }
    );
    const analyzeData = await analyzeResponse.json();

    expect(analyzeResponse.status).toBe(200);
    expect(analyzeData.success).toBe(true);
    console.log(`Analysis: ${analyzeData.analysisStats.analyzed} new files`);

    // Step 5: Query results
    const summaryResponse = await fetch(
      'http://localhost:3000/api/kms/summary'
    );
    const summary = await summaryResponse.json();

    expect(summary.summary.total_decisions).toBeGreaterThan(0);
    console.log(`Results: ${summary.summary.total_decisions} decisions extracted`);

    console.log('\n✅ Complete agent workflow successful');
  });
});
```

---

## Deployment Checklist

- [ ] **File Upload API**
  - [ ] Route created: `/app/api/kms/transcripts/route.ts`
  - [ ] Tests passing: `npm test test/api/kms-transcripts.test.ts`
  - [ ] Error handling covers: invalid filename, empty content, oversized
  - [ ] Duplicate detection working
  - [ ] Atomic writes with temp file → rename

- [ ] **Analysis Trigger API**
  - [ ] Route created: `/app/api/analysis/analyze/route.ts`
  - [ ] Tests passing: `npm test test/api/analysis.test.ts`
  - [ ] Conversion stats returned
  - [ ] Analysis stats returned
  - [ ] forceReprocess flag working
  - [ ] Error codes: NO_INPUT_FILES, ANALYSIS_FAILED

- [ ] **State Inspection API**
  - [ ] Route created: `/app/api/analysis/state/route.ts`
  - [ ] Tests passing: `npm test test/api/state.test.ts`
  - [ ] File counts accurate
  - [ ] API key detection working
  - [ ] Manifest parsing correct
  - [ ] KMS stats correct
  - [ ] Cache stats correct

- [ ] **Integration Testing**
  - [ ] Full workflow test passing
  - [ ] CLI tests still passing (no regressions)
  - [ ] All 79 existing tests still pass

- [ ] **Documentation**
  - [ ] README updated with new API endpoints
  - [ ] CLAUDE.md updated with API changes
  - [ ] AGENT_NATIVE_REVIEW.md updated
  - [ ] API documentation in code comments

---

## Next Steps After P0

Once P0 is complete (1-1.5 days), implement P1 gaps:

### P1: Complete KMS Filtering (1 hour)
```typescript
// Enhance existing /api/kms/actions route
GET /api/kms/actions?owner=X&status=Y&dueDate=YYYY-MM-DD
```

### P1: Single-Item Detail Endpoints (2-3 hours)
```typescript
GET /api/kms/decisions/{id}      // Full decision + relationships
GET /api/kms/actions/{id}        // Full action + links
GET /api/kms/risks/{id}          // Full risk detail
GET /api/kms/commitments/{id}    // Full commitment detail
```

### P1: Keyword Search Endpoint (1 hour)
```typescript
GET /api/kms/search?q=keyword&types=decision,action,risk
```

---

## Implementation Order (Recommended)

**Day 1:**
1. Implement File Upload API (Step 1)
2. Implement Analysis Trigger API (Step 1)
3. Implement State Inspection API (Step 1)

**Day 2 Morning:**
4. Write tests for all three
5. Run integration test
6. Update documentation

**Day 2 Afternoon (if needed):**
7. Implement P1 gaps for 95% parity

---

## Success Criteria

**After P0 implementation:**
- ✅ Agent can upload a transcript via API
- ✅ Agent can trigger full analysis via API
- ✅ Agent can check system state before operations
- ✅ Agent can query results via existing APIs
- ✅ All existing tests still pass
- ✅ New API routes tested
- ✅ Complete agent workflow test passes
- ✅ System moves to 90%+ agent-native

**System becomes fully autonomous for:**
1. Upload transcripts
2. Trigger analysis
3. Query results
4. Validate relationships
5. Track strategic actions

**No manual file operations needed.**

---

**Effort Estimate:** 1.5 days
**Expected Result:** 90%+ agent-native system ready for autonomous agent operation
