---
status: complete
priority: p1
issue_id: "004"
tags:
  - code-review
  - agent-native
  - api
  - blocker
dependencies: []
---

# 004: Create File Upload API for Agent Autonomy

## Problem Statement

Agents cannot autonomously add transcripts to the system. Currently, agents must:
1. Write files to disk using bash
2. Call `npm run analyze` via subprocess
3. Wait for completion without visibility

This breaks agent autonomy. Agents should be able to upload transcripts via REST API and get immediate feedback.

**Why it matters:** Agents need REST API access to all critical operations for true autonomy. File system access via subprocess is not suitable for agent workflows.

---

## Findings

**Current Flow (Non-Autonomous):**
```bash
# Agent must use bash subprocess (not ideal)
echo "meeting content" > input/meeting.txt
npm run analyze
```

**Desired Flow (Agent-Autonomous):**
```bash
# Agent calls REST API
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@transcript.txt"
```

**Impact:** Currently 0% of agents can perform file uploads autonomously.

---

## Proposed Solutions

### Solution 1: Multipart Form File Upload (RECOMMENDED)
**Effort:** 3-4 hours | **Risk:** Low | **Type Safety:** Good

```typescript
// app/api/upload/transcript/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { validateFile } from '@/utils/validation';

const INPUT_DIR = join(process.cwd(), 'input');

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (requires 001 to be done first)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const fileName = file.name || `transcript-${uuid()}.txt`;
    if (!fileName.endsWith('.txt')) {
      return NextResponse.json(
        { error: 'Only .txt files allowed' },
        { status: 400 }
      );
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    const content = Buffer.from(buffer).toString('utf-8');

    if (content.length === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Create input directory if needed
    mkdirSync(INPUT_DIR, { recursive: true });

    // Safe path validation
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const filePath = join(INPUT_DIR, safeFileName);

    if (!filePath.startsWith(INPUT_DIR)) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Write file
    writeFileSync(filePath, content, 'utf-8');

    return NextResponse.json(
      {
        success: true,
        fileName: safeFileName,
        size: content.length,
        message: 'File uploaded successfully. Run /api/analyze to process.',
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Upload failed', details: message },
      { status: 500 }
    );
  }
}
```

**Pros:**
- Standard multipart form data
- Browser and agent compatible
- File validation included
- Clear error messages

**Cons:**
- Requires form data parsing
- File size limits to consider

---

### Solution 2: Base64 Encoded JSON Upload
**Effort:** 2-3 hours | **Risk:** Low | **Simplicity:** Good

```typescript
// app/api/upload/transcript-json/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate schema
  const { fileName, content, encoding } = body;

  if (!fileName || !content) {
    return NextResponse.json(
      { error: 'fileName and content required' },
      { status: 400 }
    );
  }

  // Decode content if base64
  let fileContent = content;
  if (encoding === 'base64') {
    fileContent = Buffer.from(content, 'base64').toString('utf-8');
  }

  // ... rest of validation and write logic
}
```

**Usage by agent:**
```bash
curl -X POST http://localhost:3000/api/upload/transcript-json \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "meeting.txt",
    "content": "'$(cat meeting.txt | base64)'",
    "encoding": "base64"
  }'
```

**Pros:**
- Works over JSON
- Simple to implement
- Good for agents

**Cons:**
- Base64 overhead (33% larger)
- Less standard than multipart

---

### Solution 3: Streaming Upload for Large Files
**Effort:** 4-5 hours | **Risk:** Medium | **Scalability:** Excellent

```typescript
import { Readable } from 'stream';

export async function POST(request: NextRequest) {
  if (!request.body) {
    return NextResponse.json(
      { error: 'No body provided' },
      { status: 400 }
    );
  }

  // Stream to file instead of buffering
  const fileName = request.headers.get('x-file-name') || 'transcript.txt';
  const filePath = join(INPUT_DIR, sanitizeName(fileName));

  const writeStream = createWriteStream(filePath);
  const readable = Readable.from(request.body);

  return new Promise((resolve) => {
    readable.pipe(writeStream);
    writeStream.on('finish', () => {
      resolve(
        NextResponse.json(
          { success: true, fileName },
          { status: 201 }
        )
      );
    });
    writeStream.on('error', (error) => {
      resolve(
        NextResponse.json(
          { error: 'Upload failed', details: error.message },
          { status: 500 }
        )
      );
    });
  });
}
```

**Pros:**
- Handles large files efficiently
- Low memory usage
- Progress tracking possible

**Cons:**
- More complex
- Requires stream handling

---

## Recommended Action

**Implement Solution 1 (Multipart Form Upload)** - Best balance of standard approach, simplicity, and compatibility.

---

## Technical Details

**New Endpoint:**
```
POST /api/upload/transcript
Content-Type: multipart/form-data

Form field: "file" (File)

Response (201 Created):
{
  "success": true,
  "fileName": "meeting.txt",
  "size": 2048,
  "message": "File uploaded successfully"
}
```

**Validation Checks:**
- File size limits (max 10MB)
- File type (.txt only)
- File not empty
- Safe filename (sanitize special chars)
- Path validation (no traversal)

**Dependencies:**
- No new dependencies needed
- Built-in FormData handling

**Files to Create:**
- `app/api/upload/transcript/route.ts`

**Files to Modify:**
- `middleware.ts` - Protect `/api/upload` with auth (from 001)

---

## Acceptance Criteria

- [ ] POST endpoint created at `/api/upload/transcript`
- [ ] Multipart form data parsing works
- [ ] File validation implemented (size, type, content)
- [ ] Unsafe filenames sanitized
- [ ] File written to `input/` directory
- [ ] Success response includes file metadata
- [ ] Error responses are clear and actionable
- [ ] Integration tests verify upload flow
- [ ] Agent can use curl to upload
- [ ] Authentication required (via 001)

---

## Work Log

- [ ] **Phase 1 (1h):** Create endpoint and form parsing
- [ ] **Phase 2 (1h):** Implement validation and file writing
- [ ] **Phase 3 (1h):** Write integration tests
- [ ] **Phase 4 (30m):** Document API and examples

---

## Resources

- [MDN FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [Next.js API Routes - File Handling](https://nextjs.org/docs/api-routes/api-middlewares)
- [OWASP File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Agent-Native Review Report](./../../AGENT_NATIVE_FIX_GUIDE.md#1-file-upload-api)

---

## Related Todos

- `001-pending-p1-security-auth-missing.md` - Required for auth
- `005-pending-p1-agent-analysis-trigger-api.md` - Analysis trigger API
- `006-pending-p1-agent-state-inspection-api.md` - State inspection API
