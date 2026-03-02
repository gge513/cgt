# File Upload API

Agents can upload transcript files via REST API without using filesystem operations.

## Quick Start

### 1. Upload a File

```bash
curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer <token>" \
  -F "file=@meeting.txt"
```

**Response (201 Created):**
```json
{
  "success": true,
  "file": {
    "name": "meeting.txt",
    "originalName": "meeting.txt",
    "size": 2048,
    "path": "input/meeting.txt",
    "uploadedAt": "2026-03-02T12:34:56.000Z"
  },
  "message": "File uploaded successfully. Ready for analysis with /api/analyze",
  "nextSteps": [
    "Use POST /api/analyze to start analysis",
    "Poll GET /api/analyze/status?jobId=<id> to monitor progress"
  ]
}
```

### 2. Start Analysis

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}'
```

## API Endpoint

### POST /api/upload/transcript - Upload File

**Authentication:** Required (JWT Bearer token)

**Content Type:** `multipart/form-data`

**Form Fields:**
- `file` (required) - The .txt file to upload

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@transcript.txt"
```

**Response: 201 Created**
```typescript
{
  success: true;
  file: {
    name: string;              // Sanitized filename
    originalName: string;      // Original filename from upload
    size: number;              // File size in bytes
    path: string;              // Relative path in input/
    uploadedAt: string;        // ISO 8601 timestamp
  };
  message: string;
  nextSteps: string[];
}
```

**Response: 400 Bad Request**
```json
{
  "error": "Invalid file type",
  "details": "Only .txt files are supported. Received: pdf"
}
```

**Response: 401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "details": "Authorization header missing"
}
```

**Response: 500 Server Error**
```json
{
  "error": "Upload failed",
  "details": "Disk write failed"
}
```

### GET /api/upload/transcript - Check Endpoint Status

**Authentication:** Required (JWT Bearer token)

**Response: 200 OK**
```json
{
  "status": "ready",
  "endpoint": "/api/upload/transcript",
  "method": "POST",
  "contentType": "multipart/form-data",
  "requirements": {
    "authentication": "Required (Bearer JWT token)",
    "fileField": "file (form field name)",
    "fileType": ".txt only",
    "maxSize": "10.0MB"
  },
  "example": {
    "curl": "curl -X POST ...",
    "javascript": "const formData = new FormData(); ..."
  }
}
```

## File Requirements

### Supported Format
- **Type:** Plain text (`.txt`)
- **Encoding:** UTF-8 recommended
- **Max Size:** 10MB (configurable via `MAX_FILE_SIZE`)
- **Empty Files:** Not allowed

### Example Transcript

```
Meeting: Q1 2026 Planning Session
Date: March 2, 2026
Attendees: Alice, Bob, Carol

Discussion Points:
- Q1 revenue targets
- New product launch timeline
- Team hiring plans

Decisions:
- Approved budget increase for marketing
- Launch date set for Q2
- Hire 3 engineers this month

Action Items:
- Alice: Prepare detailed budget breakdown (Due: March 10)
- Bob: Create product roadmap (Due: March 15)
- Carol: Post job listings (Due: March 5)

Risks:
- Supply chain delays could impact launch
- Competition increased in target market
```

## File Validation

### Filename Sanitization

Filenames are automatically sanitized to prevent security issues:

```
Original          → Sanitized
────────────────────────────
meeting.txt       → meeting.txt
2026_Q1.txt       → 2026_Q1.txt
../../../etc/passwd → etc-passwd.txt
file@#$%.txt      → file.txt
.hidden.txt       → hidden.txt
```

### Size Limits

| File Type | Default | Min | Max |
|-----------|---------|-----|-----|
| .txt | 10MB | 1 byte | 100MB* |

*Configurable via `MAX_FILE_SIZE` environment variable

## Code Examples

### cURL - Simple Upload

```bash
#!/bin/bash

TOKEN="<your_jwt_token>"
FILE="transcript.txt"

curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$FILE" | jq .
```

### Node.js - File Upload

```typescript
import { signToken } from '@/lib/jwt';

async function uploadTranscript(filePath: string) {
  const token = signToken({ sub: 'agent-123' });

  const formData = new FormData();
  const fileBlob = await fetch(`file://${filePath}`).then(r => r.blob());
  formData.append('file', fileBlob, 'transcript.txt');

  const response = await fetch('http://localhost:3000/api/upload/transcript', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('File uploaded:', result.file.name);

  return result;
}

// Run
uploadTranscript('./meeting.txt').catch(console.error);
```

### Python - File Upload

```python
import requests
import jwt
import os

def upload_transcript(file_path):
    secret = os.getenv('JWT_SECRET')
    token = jwt.encode({'sub': 'agent-123'}, secret, algorithm='HS256')

    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(
            'http://localhost:3000/api/upload/transcript',
            headers={'Authorization': f'Bearer {token}'},
            files=files
        )

    if response.status_code != 201:
        raise Exception(f'Upload failed: {response.text}')

    result = response.json()
    print(f'File uploaded: {result["file"]["name"]}')

    return result

# Run
try:
    upload_transcript('./meeting.txt')
except Exception as e:
    print(f'Error: {e}')
```

### React - File Upload Component

```typescript
import { useState } from 'react';
import { signToken } from '@/lib/jwt';

export function TranscriptUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = signToken({ sub: 'user-123' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/transcript', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setSuccess(`File uploaded: ${result.file.name}`);

      // Now analyze the file
      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'full' }),
      });

      const analysisJob = await analysisResponse.json();
      console.log('Analysis started:', analysisJob.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2>Upload Transcript</h2>

      <input
        type="file"
        accept=".txt"
        onChange={handleUpload}
        disabled={uploading}
      />

      {uploading && <p>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
    </div>
  );
}
```

### Batch Upload Script

```bash
#!/bin/bash

TOKEN="<your_jwt_token>"
INPUT_DIR="./transcripts"

echo "Starting batch upload..."

for file in "$INPUT_DIR"/*.txt; do
  [ -f "$file" ] || continue

  echo "Uploading: $(basename "$file")"

  curl -X POST http://localhost:3000/api/upload/transcript \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$file" > /dev/null

  echo "✓ Done"
done

echo "Batch upload complete"
```

## Error Handling

### Missing File

```bash
curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN"
```

**Response (400 Bad Request):**
```json
{
  "error": "No file provided",
  "details": "Form must include \"file\" field"
}
```

### Invalid File Type

```bash
curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf"
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid file type",
  "details": "Only .txt files are supported. Received: pdf"
}
```

### File Too Large

```bash
# 50MB file
curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@large.txt"
```

**Response (400 Bad Request):**
```json
{
  "error": "File too large",
  "details": "File exceeds size limit (10.0MB). Current: 50.0MB"
}
```

### Empty File

```bash
touch empty.txt
curl -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@empty.txt"
```

**Response (400 Bad Request):**
```json
{
  "error": "File is empty",
  "details": "File is empty"
}
```

## Security Features

### Path Traversal Prevention

Filenames are validated to prevent directory traversal attacks:

```bash
# These are prevented:
../../../etc/passwd
..\\..\\windows\\system32
/etc/passwd
C:\Windows\System32\file.txt
```

All are sanitized and stored safely in the `input/` directory.

### Filename Sanitization

Unsafe characters are removed or replaced:
- Path separators (`/`, `\`) removed
- Leading dots (hidden files) removed
- Special characters replaced with hyphens
- Null bytes removed

### File Type Validation

- Only `.txt` files accepted
- Checked by extension (case-insensitive)
- Prevents executable uploads

### Size Limits

- Default: 10MB max
- Configurable via `MAX_FILE_SIZE` env var
- Prevents disk exhaustion attacks
- Checked before and after upload

### Authentication Required

- All uploads require JWT token
- User ID logged for audit trail
- Unauthorized requests return 401

## Integration with Analysis

After uploading, start analysis immediately:

```bash
#!/bin/bash

TOKEN="<your_jwt_token>"

# 1. Upload file
UPLOAD=$(curl -s -X POST http://localhost:3000/api/upload/transcript \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@transcript.txt")

echo "Upload response: $UPLOAD"

# 2. Start analysis
ANALYSIS=$(curl -s -X POST http://localhost:3000/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}')

JOB_ID=$(echo $ANALYSIS | jq -r '.jobId')
echo "Analysis started with job ID: $JOB_ID"

# 3. Poll status
while true; do
  STATUS=$(curl -s "http://localhost:3000/api/analyze/status?jobId=$JOB_ID" \
    -H "Authorization: Bearer $TOKEN")

  PROGRESS=$(echo $STATUS | jq -r '.progress')
  STATE=$(echo $STATUS | jq -r '.status')

  echo "Progress: $PROGRESS% - Status: $STATE"

  if [ "$STATE" = "completed" ]; then
    echo "Analysis complete!"
    break
  fi

  sleep 5
done
```

## Configuration

### Environment Variables

```bash
# Max file size in bytes (default: 10MB)
MAX_FILE_SIZE=10485760

# Allowed file extensions (default: .txt)
ALLOWED_EXTENSIONS=.txt

# Upload directory (default: input)
UPLOAD_DIR=input
```

### Security Checklist

- ✅ All uploads require JWT authentication
- ✅ Filename sanitization prevents attacks
- ✅ Path validation prevents directory traversal
- ✅ File type validation prevents executables
- ✅ Size limits prevent disk exhaustion
- ✅ User ID logged for audit trail
- ✅ Clear error messages (no info leakage)

## Monitoring

### Logs

Uploads are logged with user context:

```
[2026-03-02] [INFO] Transcript uploaded by user-123
  filename: meeting.txt
  size: 2048
  originalName: meeting.txt
```

### Errors

Upload errors are logged:

```
[2026-03-02] [WARN] Upload rejected: invalid file type from user-123
  filename: document.pdf

[2026-03-02] [WARN] Upload rejected: file size from user-123
  filename: large.txt
  size: 52428800
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing token | Add Authorization header with JWT token |
| 400 No file provided | Missing form field | Use `-F "file=@<path>"` in curl |
| 400 Invalid file type | Not a .txt file | Upload only .txt files |
| 400 File too large | Exceeds max size | Use smaller file or increase MAX_FILE_SIZE |
| 400 File is empty | Empty file uploaded | Provide file with content |
| 500 Upload failed | Disk write error | Check file permissions and disk space |

## Reference

- [JWT Authentication Guide](./AUTHENTICATION.md)
- [Analysis Trigger API](./ANALYSIS_API.md)
- [System Status Check API](./STATUS_API.md) (Todo 006)
