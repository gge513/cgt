---
status: complete
priority: p1
issue_id: "003"
tags:
  - code-review
  - security
  - path-traversal
  - critical
dependencies:
  - "001"
---

# 003: Fix Path Traversal Vulnerability in API File Access

## Problem Statement

All API routes read/write files without path validation. An attacker can use path traversal sequences (`../`) to:
- Read arbitrary files outside the KMS directory (config, source code, secrets)
- Write files to arbitrary locations on the filesystem
- Overwrite system files
- Access neighboring projects or infrastructure

**Why it matters:** Allows attackers to escape the intended directory and access sensitive files.

**Affected Code:**
```typescript
// VULNERABLE: No path validation
const kmsPath = path.join(process.cwd(), '.processed_kms.json');
fs.readFileSync(kmsPath, 'utf-8');  // If user controls kmsPath, they can traverse
```

**Attack Example:**
```
GET /api/kms/summary?file=../../../../etc/passwd
```

---

## Findings

**Vulnerable Locations:**
- `app/api/kms/decisions/route.ts` - Hardcoded `.processed_kms.json` (safe currently)
- `app/api/kms/actions/route.ts` - Hardcoded `.processed_manifest.json` (safe currently)
- `src/conversion/converter.ts` - File operations with user input
- `src/analysis/orchestrator.ts` - File operations with user input

**Current Pattern (Partially Safe):**
```typescript
const kmsPath = path.join(process.cwd(), '.processed_kms.json');
const manifest = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));
```

**Why This Can Fail:**
```typescript
// If inputPath comes from user (hypothetically)
const filePath = path.join(baseDir, userInput);

// Attack: userInput = '../../etc/passwd'
// Result: filePath = '/path/to/project/../../etc/passwd' = '/etc/passwd'
```

**Severity:** 🔴 CRITICAL - Potential file disclosure/corruption

**OWASP Category:** A01:2021 – Broken Access Control (Path Traversal)

---

## Proposed Solutions

### Solution 1: Resolve and Validate Against Base Directory (RECOMMENDED)
**Effort:** 2-3 hours | **Risk:** Low | **Security:** Excellent

```typescript
import path from 'path';
import fs from 'fs';

const ALLOWED_BASE_DIR = path.resolve(process.cwd());

/**
 * Safely resolve a file path within the allowed directory
 * @throws Error if path tries to escape the base directory
 */
export function resolveSafePath(basePath: string, requestedPath: string): string {
  // Resolve to absolute path
  const resolved = path.resolve(basePath, requestedPath);

  // Ensure it's within the base directory
  if (!resolved.startsWith(basePath)) {
    throw new Error('Path traversal detected');
  }

  return resolved;
}

// Usage
try {
  const safePath = resolveSafePath(ALLOWED_BASE_DIR, '.processed_kms.json');
  const content = fs.readFileSync(safePath, 'utf-8');
} catch (error) {
  // Path traversal attempt detected
  return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
}
```

**Pros:**
- Simple and effective
- No dependencies
- Catches all traversal patterns
- Clear error handling

**Cons:**
- Must be used everywhere
- Easy to miss in some locations

---

### Solution 2: Whitelist Allowed Files
**Effort:** 1-2 hours | **Risk:** Low | **Security:** Excellent

```typescript
const ALLOWED_FILES = new Set([
  '.processed_kms.json',
  '.processed_manifest.json',
  '.pipeline.log',
]);

export function isAllowedFile(filename: string): boolean {
  return ALLOWED_FILES.has(filename);
}

// Usage
export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('file') || '.processed_kms.json';

  if (!isAllowedFile(filename)) {
    return NextResponse.json(
      { error: 'File not allowed' },
      { status: 403 }
    );
  }

  const filePath = path.join(process.cwd(), filename);
  // ... rest of handler
}
```

**Pros:**
- Explicit allow-list
- Very clear security boundary
- Fast validation

**Cons:**
- Less flexible
- Must update whitelist for new files

---

### Solution 3: Strict Path Segment Validation
**Effort:** 1-2 hours | **Risk:** Low | **Security:** Good

```typescript
/**
 * Validates that a path contains no traversal sequences
 */
export function isValidPath(inputPath: string): boolean {
  // Reject paths with traversal sequences
  if (inputPath.includes('..') || inputPath.includes('//')) {
    return false;
  }

  // Reject absolute paths
  if (path.isAbsolute(inputPath)) {
    return false;
  }

  // Ensure only allowed characters
  const ALLOWED_CHARS = /^[a-zA-Z0-9._/-]*$/;
  return ALLOWED_CHARS.test(inputPath);
}

// Usage
if (!isValidPath(userProvidedPath)) {
  return NextResponse.json(
    { error: 'Invalid path' },
    { status: 400 }
  );
}
```

**Pros:**
- Simple pattern matching
- No dependencies
- Fast

**Cons:**
- Can be bypassed with encoding tricks
- Less robust than Solution 1

---

## Recommended Action

**Implement Solution 1 (Resolve and Validate)** - Most robust and handles all edge cases.

---

## Technical Details

**Current Safe State:**
Currently, all file paths are hardcoded:
```typescript
const kmsPath = path.join(process.cwd(), '.processed_kms.json');
```

This is safe because there's no user input. However, to prevent future vulnerabilities:

**Create utility function:**
- `lib/security/paths.ts` - Path validation utilities

**Audit all file operations:**
- Check if any user input flows into file paths
- Apply validation function to all external file access

**Files to audit:**
- `app/api/kms/*.ts` (all API routes)
- `src/conversion/converter.ts`
- `src/analysis/orchestrator.ts`
- `src/analysis/synthesizer.ts`

---

## Acceptance Criteria

- [ ] `resolveSafePath()` function created
- [ ] Path validation applied to all file operations
- [ ] Hardcoded paths verified safe
- [ ] Unit tests verify path traversal blocked
- [ ] Tests verify legitimate paths work
- [ ] Code review confirms no user input in paths
- [ ] Documentation updated with security guidelines
- [ ] Integration tests for edge cases (../../, ..%2F, etc.)

---

## Work Log

- [ ] **Phase 1 (1h):** Create utility functions
- [ ] **Phase 2 (1h):** Audit file operations
- [ ] **Phase 3 (1h):** Write tests
- [ ] **Phase 4 (30m):** Code review and verification

---

## Resources

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [CWE-22: Improper Limitation of a Pathname](https://cwe.mitre.org/data/definitions/22.html)
- [Node.js Path Security](https://nodejs.org/en/knowledge/file-system/security/introduction/)
- [Security Audit Report - Path Traversal](./../../SECURITY_AUDIT_REPORT.md#7-unrestricted-file-system-access)

---

## Related Todos

- `001-pending-p1-security-auth-missing.md` - Add authentication
- `002-pending-p1-security-json-injection.md` - Fix JSON injection
