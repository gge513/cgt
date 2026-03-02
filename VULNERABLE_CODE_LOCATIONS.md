# Vulnerable Code Locations - Quick Reference

**Generated:** March 2, 2026
**Purpose:** Pinpoint exact line numbers and code snippets of security vulnerabilities

---

## Critical Vulnerability #1: Missing Authentication

### Location: ALL API ROUTES

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/decisions/route.ts`

**Lines:** 1-66

**Vulnerable Code:**
```typescript
export async function GET(request: NextRequest) {
  // NO AUTHENTICATION CHECK - ACCEPTS ANY REQUEST
  try {
    const kmsPath = path.join(process.cwd(), '.processed_kms.json');
    // ... rest of function reads and returns all decisions
  } catch (error) {
    // ... error handling
  }
}
```

**Fix Required:**
- [ ] Add middleware that validates JWT token
- [ ] Check request.headers.get('authorization')
- [ ] Return 401 if not authenticated

**Affected Endpoints:**
- `/api/kms/decisions` (GET)
- `/api/kms/actions` (GET/POST)
- `/api/kms/relationships` (GET)
- `/api/kms/summary` (GET)
- `/api/kms/validate` (GET/POST)

---

## Critical Vulnerability #2: Arbitrary File Write / JSON Injection

### Location: app/api/kms/validate/route.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/validate/route.ts`

**Lines:** 57-106 (POST handler)

**Vulnerable Code:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { relationshipId, validated, userFeedback } = body;

    if (!relationshipId || validated === undefined) {
      return NextResponse.json(
        { error: 'Missing relationshipId or validated field' },
        { status: 400 }
      );
    }

    // VULNERABILITY: NO VALIDATION ON relationshipId
    // Could contain: "../../malicious", "'./../", "<script>", etc.

    const store = loadValidations();

    const validation: ValidationRecord = {
      relationshipId,  // UNSAFE - DIRECTLY USED
      validated,
      validatedAt: new Date().toISOString(),
      userFeedback,
    };

    store.validations.push(validation);

    // VULNERABILITY: WRITTEN TO DISK WITHOUT SANITIZATION
    saveValidations(store);  // Line 93

    return NextResponse.json({
      success: true,
      validation,
      totalValidations: store.validations.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save validation', details: String(error) },
      { status: 500 }  // ALSO EXPOSES ERROR DETAILS
    );
  }
}
```

**Attack Example:**
```bash
curl -X POST http://localhost:3000/api/kms/validate \
  -H "Content-Type: application/json" \
  -d '{
    "relationshipId": "invalid\"},{\"malicious\":\"data\"}",
    "validated": true
  }'
```

**Result:** Corrupted or injected JSON in `.processed_kms_validations.json`

**Required Fixes:**
- [ ] Validate relationshipId format using regex: `^[a-zA-Z0-9_-]+$`
- [ ] Limit length to 256 characters
- [ ] Sanitize userFeedback (max 5000 chars)
- [ ] Use schema validation (Zod)
- [ ] Return generic error messages only

---

## Critical Vulnerability #3: Unrestricted File System Access

### Location: app/api/kms/validate/route.ts (saveValidations function)

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/validate/route.ts`

**Lines:** 48-55

**Vulnerable Code:**
```typescript
const VALIDATIONS_PATH = '.processed_kms_validations.json';

function saveValidations(store: ValidationStore): void {
  try {
    store.lastUpdated = new Date().toISOString();
    // VULNERABILITY: Path is hardcoded, no validation
    // But user input (relationshipId) ends up in the file content
    fs.writeFileSync(VALIDATIONS_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save validations:', error);
  }
}
```

**Similar Issues In:**
- `/api/kms/decisions/route.ts` (Line 16): `const kmsPath = path.join(process.cwd(), '.processed_kms.json')`
- `/api/kms/actions/route.ts` (Line 61): `const kmsPath = '.processed_kms.json'`
- `/api/kms/summary/route.ts` (Line 7): `const kmsPath = path.join(process.cwd(), '.processed_kms.json')`
- `/api/kms/relationships/route.ts` (Line 5): `const INFERRED_PATH = '.processed_kms_inferred.json'`

**Issues:**
1. No path validation or boundary checks
2. Files written without checking destination
3. No atomic write operations (can be corrupted if process crashes)
4. No schema validation of parsed JSON

**Required Fixes:**
- [ ] Create safe file path resolution utility
- [ ] Validate all paths are within allowed directory
- [ ] Implement atomic writes (temp file + rename)
- [ ] Validate JSON schema after parsing
- [ ] Use `.gitignore` to prevent committing sensitive data

---

## High Vulnerability #4: Information Disclosure in Error Messages

### Location: app/api/kms/decisions/route.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/decisions/route.ts`

**Lines:** 59-65

**Vulnerable Code:**
```typescript
} catch (error) {
  return NextResponse.json(
    { error: 'Failed to fetch decisions', details: String(error) },
    { status: 500 }
  );
  // VULNERABILITY: Exposes full error message to client
  // Example response:
  // {
  //   "error": "Failed to fetch decisions",
  //   "details": "ENOENT: no such file or directory, open '/Users/georgeeastwood/.../.processed_kms.json'"
  // }
}
```

**Affected Files:**
- `/api/kms/decisions/route.ts` (Line 61)
- `/api/kms/actions/route.ts` (Line 146)
- `/api/kms/validate/route.ts` (Line 102)
- `/api/kms/relationships/route.ts` (Line 41)
- `/api/kms/summary/route.ts` (Line 76)

**Attacker Gains:**
- File system path structure
- Node.js version information
- Internal directory layout
- Potential to map out system

**Required Fix:**
```typescript
// INSTEAD OF:
details: String(error)

// DO THIS:
// Log internally
logger.error('Failed to fetch decisions', {
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
});

// Return generic message
{ error: 'Failed to fetch decisions' }
```

---

## High Vulnerability #5: Missing Input Validation on Query Parameters

### Location: app/api/kms/decisions/route.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/decisions/route.ts`

**Lines:** 28-52

**Vulnerable Code:**
```typescript
// Get query parameters for filtering
const { searchParams } = new URL(request.url);
const status = searchParams.get('status');        // NO VALIDATION
const severity = searchParams.get('severity');    // NO VALIDATION
const keyword = searchParams.get('keyword');      // NO VALIDATION

// Filter decisions
let filtered = decisions;

if (status) {
  filtered = filtered.filter((d: any) => d.status === status);
  // If status can be anything, attacker could pass:
  // status='pending\n\n{"malicious":true}' or similar
}

if (severity) {
  filtered = filtered.filter((d: any) => d.severity === severity);
  // Similarly vulnerable
}

if (keyword) {
  const lowerKeyword = keyword.toLowerCase();
  filtered = filtered.filter((d: any) =>
    d.text.toLowerCase().includes(lowerKeyword) ||  // No length check
    d.owner?.toLowerCase().includes(lowerKeyword) ||
    d.meeting?.toLowerCase().includes(lowerKeyword)
  );
  // Attacker could send 1MB+ keyword string causing DoS
}
```

**Attack Examples:**
```bash
# Case sensitivity bypass (if auth existed)
curl 'http://localhost:3000/api/kms/decisions?status=PENDING'

# Resource exhaustion via long string
curl 'http://localhost:3000/api/kms/decisions?keyword=aaaa....(1MB string)...aaaa'

# ReDoS via special characters
curl 'http://localhost:3000/api/kms/decisions?keyword=(a+)*b'
```

**Required Fixes:**
- [ ] Whitelist valid status values: ['pending', 'in_progress', 'completed']
- [ ] Whitelist valid severity values: ['low', 'medium', 'high']
- [ ] Limit keyword length to 500 characters
- [ ] Escape special characters in keyword searches

---

## High Vulnerability #6: Unvalidated JSON Parsing

### Location: app/api/kms/decisions/route.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/decisions/route.ts`

**Lines:** 16-26

**Vulnerable Code:**
```typescript
const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));
// VULNERABILITY: No schema validation
// If file is corrupted, this could crash or behave unexpectedly

// Extract decisions from all meetings
const decisions: any[] = [];
if (kmsData.meetings && typeof kmsData.meetings === 'object') {
  Object.values(kmsData.meetings).forEach((meeting: any) => {
    // type 'any' - no type safety
    if (meeting.decisions && Array.isArray(meeting.decisions)) {
      decisions.push(...meeting.decisions);
    }
  });
}
```

**Similar Issues In:**
- `/api/kms/actions/route.ts` (Line 69): `const kmsStore = JSON.parse(content)`
- `/api/kms/summary/route.ts` (Line 16): `const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'))`
- `/api/kms/validate/route.ts` (Line 34): `return JSON.parse(content)`
- `/api/kms/relationships/route.ts` (Line 27): `const inferredStore = JSON.parse(content)`

**Risks:**
1. Corrupted JSON crashes the API
2. No validation of expected structure
3. Using `any` type bypasses TypeScript safety
4. No recovery mechanism

**Required Fix:**
```typescript
import { z } from 'zod';

const KMSDataSchema = z.object({
  version: z.number().optional(),
  meetings: z.record(z.object({
    decisions: z.array(z.object({
      id: z.string(),
      text: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    })).optional(),
  })).optional(),
});

try {
  const parsed = JSON.parse(content);
  const validated = KMSDataSchema.parse(parsed);
  // Now safe to use
} catch (error) {
  logger.error('Invalid KMS data', { error });
  return { meetings: {} }; // Safe default
}
```

---

## Medium Vulnerability #7: Console Logging in Production Code

### Location: src/analysis/synthesisCoordinator.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/analysis/synthesisCoordinator.ts`

**Lines:** Throughout file

**Vulnerable Code:**
```typescript
console.log("\n📊 Starting multi-agent analysis...\n");
console.log("  → Running Strategic Analysis...");
console.log("  → Running Stakeholder Dynamics Analysis...");
console.log("  → Running Financial & Operations Analysis...");
console.log("  ✓ All analyses complete\n");
console.log("  → Generating executive summary...");
console.log("  → Developing strategic recommendations...");
console.log("  → Creating implementation timeline...");
console.log("  ✓ Synthesis complete\n");
```

**Also In:**
- `src/analysis/fileHandler.ts` (Lines 58, 77, 86, 113, 134, etc.)
- Many other places

**Issues:**
1. Bypasses centralized logging
2. Can't control with LOG_LEVEL environment variable
3. No structured logging (no timestamps, severity levels)
4. Difficult to audit or forward to logging service
5. Emoji characters may not render in all environments

**Required Fix:**
```typescript
const logger = getLogger();

// Instead of:
console.log("message");

// Use:
logger.info("message");
logger.warn("warning");
logger.error("error");
```

---

## Medium Vulnerability #8: Path Traversal in Conversion Pipeline

### Location: src/conversion/converter.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/conversion/converter.ts`

**Lines:** 47-112

**Vulnerable Code:**
```typescript
function getRelativeFolderPath(filePath: string, inputDir: string): string {
  const dir = path.dirname(filePath);
  const relative = path.relative(inputDir, dir);
  // VULNERABILITY: No validation of relative path
  // path.relative can return paths with '..' sequences
  return relative === "." ? "" : relative;
}

// Usage:
const relativeFolderPath = getRelativeFolderPath(inputFile,
  path.dirname(inputFile).replace(/\/[^/]*$/, ""));
  // VULNERABILITY: Fragile path manipulation with regex

let outputFile = path.join(processingDir, outputFileName);

if (relativeFolderPath) {
  const folderDir = path.join(processingDir, relativeFolderPath);
  // VULNERABILITY: No check that folderDir is within processingDir
  const dirCheck = ensureDirectoryExists(folderDir);
  if (!dirCheck.valid) {
    logger.error(`Could not create directory: ${dirCheck.error}`);
    return { success: false, error: `Directory creation failed: ${dirCheck.error}` };
  }
  outputFile = path.join(folderDir, outputFileName);
}

fs.writeFileSync(outputFile, markdownContent, "utf-8");
// VULNERABILITY: outputFile could escape processingDir
```

**Attack Example:**
Craft input file path: `/input/../../sensitive/location/file.txt`

This could potentially write to `/sensitive/location/...` instead of just `/processing/...`

**Required Fix:**
```typescript
// Safely resolve paths
const outputPath = path.normalize(path.join(processingDir, relativeFolderPath));
const expectedRoot = path.normalize(processingDir);

// Prevent directory traversal
if (!outputPath.startsWith(expectedRoot) || outputPath.includes('..')) {
  throw new Error(`Output path escapes processing directory: ${outputPath}`);
}

// Now safe to write
fs.writeFileSync(outputPath, content, 'utf-8');
```

---

## Missing Implementation: middleware.ts

**Path:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/middleware.ts`

**Status:** DOES NOT EXIST - NEEDS CREATION

**Required Content:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');

export async function middleware(request: NextRequest) {
  // Protect all /api/kms routes
  if (request.nextUrl.pathname.startsWith('/api/kms')) {
    // TODO: Add JWT verification
    // TODO: Add rate limiting
    // TODO: Add security headers
    // TODO: Add audit logging
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/kms/:path*'],
};
```

---

## Summary Table

| Vulnerability | File | Lines | Severity | Status |
|---------------|------|-------|----------|--------|
| No Auth | All /api/kms/* | Varies | CRITICAL | Not Fixed |
| JSON Injection | validate/route.ts | 60-90 | CRITICAL | Not Fixed |
| File Access | All /api/kms/* | Varies | CRITICAL | Not Fixed |
| Info Disclosure | All /api/kms/* | error handlers | HIGH | Not Fixed |
| Query Validation | decisions/route.ts | 28-52 | HIGH | Not Fixed |
| JSON Parsing | All /api/kms/* | Varies | HIGH | Not Fixed |
| Console Logging | synthesis*.ts | Throughout | MEDIUM | Not Fixed |
| Path Traversal | converter.ts | 47-112 | MEDIUM | Not Fixed |
| Rate Limiting | All /api/kms/* | N/A | LOW | Not Fixed |
| CORS Config | middleware | N/A | LOW | Not Fixed |
| Access Logging | All /api/kms/* | N/A | LOW | Not Fixed |
| Security Headers | middleware | N/A | LOW | Not Fixed |

---

## Quick Action Items

1. [ ] Create middleware.ts with authentication
2. [ ] Add Zod schemas for all input validation
3. [ ] Update ALL /api/kms route files to use validation
4. [ ] Replace all console.log with logger calls
5. [ ] Fix error message disclosure
6. [ ] Add path traversal checks in converter.ts
7. [ ] Add schema validation for JSON parsing
8. [ ] Run tests: npm test
9. [ ] Security review of fixed code
10. [ ] Deploy fixes only after comprehensive testing

---

**Audit Date:** March 2, 2026
**Auditor:** Claude Code Security Team
**Next Review:** Upon Phase 1 completion

