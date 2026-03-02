# Security Remediation Guide
## Unified Transcript Analyzer - Implementation Guide

**Last Updated:** March 2, 2026
**Target Completion:** 2 weeks for Phase 1

---

## Table of Contents
1. [Authentication Implementation](#authentication-implementation)
2. [Input Validation Framework](#input-validation-framework)
3. [File System Safety](#file-system-safety)
4. [Error Handling](#error-handling)
5. [API Route Refactoring](#api-route-refactoring)
6. [Testing Security Boundaries](#testing-security-boundaries)

---

## Authentication Implementation

### Step 1: Create Authentication Middleware

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
);

/**
 * Verify JWT token from Authorization header
 */
async function verifyAuth(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.substring(7);
    const verified = await jwtVerify(token, JWT_SECRET);

    return {
      valid: true,
      userId: verified.payload.sub as string,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid token',
    };
  }
}

/**
 * Middleware to protect API routes
 */
export async function middleware(request: NextRequest) {
  // Protect all /api/kms routes
  if (request.nextUrl.pathname.startsWith('/api/kms')) {
    const auth = await verifyAuth(request);

    if (!auth.valid) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Add user info to request for use in route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', auth.userId || 'unknown');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/kms/:path*'],
};
```

### Step 2: Update next.config.js

Ensure middleware is enabled:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config

  // Enable middleware
  experimental: {
    // No experimental flags needed for middleware in Next.js 13+
  },
};

module.exports = nextConfig;
```

### Step 3: Create Token Generation Endpoint

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/auth/login/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-key-change-in-production'
);

interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Simple authentication endpoint
 * In production, use proper authentication service (Auth0, AWS Cognito, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Missing username or password' },
        { status: 400 }
      );
    }

    // TODO: In production, validate against database or auth service
    // This is a placeholder - use real authentication
    const validCredentials = validateCredentials(username, password);

    if (!validCredentials) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = await new SignJWT({ sub: username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    return NextResponse.json({
      success: true,
      token,
      expiresIn: '24h',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

function validateCredentials(username: string, password: string): boolean {
  // PLACEHOLDER: In production, use bcrypt + database
  // const hashedPassword = await bcrypt.hash(password, 10);
  // const user = await db.users.findByUsername(username);
  // return user && await bcrypt.compare(password, user.password);

  // For development only:
  return (
    username === process.env.AUTH_USERNAME &&
    password === process.env.AUTH_PASSWORD
  );
}
```

### Step 4: Environment Variables

Add to `.env`:

```bash
# Authentication
JWT_SECRET=your-secret-key-min-32-chars-change-in-production
AUTH_USERNAME=admin
AUTH_PASSWORD=secure-password-change-immediately
```

---

## Input Validation Framework

### Create Validation Utilities

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/utils/inputValidation.ts`

```typescript
import { z } from 'zod';

// Define reusable schemas
export const IdSchema = z
  .string()
  .min(1, 'ID cannot be empty')
  .max(256, 'ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .max(255);

export const KeywordSchema = z
  .string()
  .min(1, 'Keyword cannot be empty')
  .max(500, 'Keyword too long')
  .refine(
    (val) => !val.includes('..'),
    'Keyword contains invalid sequences'
  );

export const StatusSchema = z
  .enum(['pending', 'in_progress', 'completed'])
  .default('pending');

export const SeveritySchema = z
  .enum(['low', 'medium', 'high'])
  .default('medium');

export const ActionSchema = z
  .enum(['escalate', 'resolve', 'high-priority']);

// Validation functions
export function validateId(value: unknown): { valid: boolean; error?: string } {
  try {
    IdSchema.parse(value);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof z.ZodError
        ? error.errors[0].message
        : 'Invalid ID',
    };
  }
}

export function validateKeyword(value: unknown): { valid: boolean; error?: string } {
  try {
    KeywordSchema.parse(value);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof z.ZodError
        ? error.errors[0].message
        : 'Invalid keyword',
    };
  }
}

export function validateStatus(value: unknown): { valid: boolean; error?: string } {
  try {
    StatusSchema.parse(value);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid status',
    };
  }
}

export function validateQueryParam(
  param: string | null,
  schema: z.ZodSchema
): { valid: boolean; value?: any; error?: string } {
  try {
    const value = schema.parse(param);
    return { valid: true, value };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof z.ZodError
        ? error.errors[0].message
        : 'Invalid parameter',
    };
  }
}
```

---

## File System Safety

### Safe File Operations Helper

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/utils/safeFileOps.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';

/**
 * Safely resolve a file path with boundary checking
 */
export function resolveFilePath(
  baseDir: string,
  userProvidedPath: string
): { valid: boolean; path?: string; error?: string } {
  try {
    // Normalize the base directory
    const normalizedBase = path.normalize(path.resolve(baseDir));

    // Prevent absolute paths from user
    if (path.isAbsolute(userProvidedPath)) {
      return {
        valid: false,
        error: 'Absolute paths are not allowed',
      };
    }

    // Resolve the full path
    const fullPath = path.normalize(path.resolve(normalizedBase, userProvidedPath));

    // Verify it's within the base directory (prevent path traversal)
    if (!fullPath.startsWith(normalizedBase)) {
      return {
        valid: false,
        error: 'Path traversal detected',
      };
    }

    return { valid: true, path: fullPath };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid path: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Safely read a JSON file with validation
 */
export function readJsonFile<T>(
  filePath: string,
  schema?: (data: unknown) => T
): { valid: boolean; data?: T; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        error: 'File not found',
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    if (schema) {
      return {
        valid: true,
        data: schema(parsed),
      };
    }

    return { valid: true, data: parsed as T };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Safely write a JSON file atomically
 */
export function writeJsonFile(
  filePath: string,
  data: unknown,
  options?: { mode?: number; atomic?: boolean }
): { valid: boolean; error?: string } {
  try {
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(data, null, 2);

    if (options?.atomic) {
      // Write to temp file first, then rename
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, filePath);
    } else {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    if (options?.mode) {
      fs.chmodSync(filePath, options.mode);
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
```

---

## Error Handling

### Create Error Handler Utility

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/utils/errorHandler.ts`

```typescript
import { NextResponse } from 'next/server';
import { getLogger } from './logging';

const logger = getLogger();

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  internal?: boolean; // Log internally but don't expose to client
}

export const ErrorCodes = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', statusCode: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', statusCode: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', statusCode: 404 },
  BAD_REQUEST: { code: 'BAD_REQUEST', statusCode: 400 },
  CONFLICT: { code: 'CONFLICT', statusCode: 409 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', statusCode: 500 },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', statusCode: 503 },
} as const;

/**
 * Format error response - never expose internals
 */
export function formatErrorResponse(
  error: ApiError,
  includeDetails: boolean = false
) {
  const response = {
    error: error.code,
    message: error.message,
  };

  // Only include details in development
  if (includeDetails && process.env.NODE_ENV === 'development') {
    return {
      ...response,
      // In production, don't include any additional details
    };
  }

  return response;
}

/**
 * Handle API errors safely
 */
export function handleApiError(
  error: unknown,
  userId: string,
  endpoint: string
): { response: NextResponse; logged: boolean } {
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  const errorStack =
    error instanceof Error ? error.stack : 'No stack trace';

  // Log internally with full details
  logger.error(`API Error on ${endpoint}`, {
    userId,
    error: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
  });

  // Return generic response to client
  return {
    response: NextResponse.json(
      formatErrorResponse({
        code: ErrorCodes.INTERNAL_ERROR.code,
        message: 'Internal server error',
        statusCode: 500,
        internal: true,
      }),
      { status: 500 }
    ),
    logged: true,
  };
}

/**
 * Validation error response
 */
export function validationError(message: string) {
  return NextResponse.json(
    formatErrorResponse({
      code: ErrorCodes.BAD_REQUEST.code,
      message,
      statusCode: 400,
    }),
    { status: 400 }
  );
}

/**
 * Authorization error response
 */
export function authorizationError(message?: string) {
  return NextResponse.json(
    formatErrorResponse({
      code: ErrorCodes.FORBIDDEN.code,
      message: message || 'Access denied',
      statusCode: 403,
    }),
    { status: 403 }
  );
}
```

---

## API Route Refactoring

### Refactored: decisions/route.ts

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/decisions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { validateQueryParam, StatusSchema, SeveritySchema, KeywordSchema } from '@/utils/inputValidation';
import { handleApiError, validationError } from '@/utils/errorHandler';
import { getLogger } from '@/utils/logging';

const logger = getLogger();

interface Decision {
  id: string;
  text: string;
  owner?: string;
  status?: string;
  severity?: string;
  meeting?: string;
  date?: string;
  is_escalated?: boolean;
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'unknown';

  try {
    // Log the request
    logger.info(`GET /api/kms/decisions from user: ${userId}`);

    const kmsPath = path.join(process.cwd(), '.processed_kms.json');

    if (!fs.existsSync(kmsPath)) {
      return NextResponse.json(
        { error: 'KMS data not found' },
        { status: 404 }
      );
    }

    // Read and parse KMS data
    const kmsContent = fs.readFileSync(kmsPath, 'utf-8');
    let kmsData: any;

    try {
      kmsData = JSON.parse(kmsContent);
    } catch (error) {
      logger.error('KMS file corrupted', { userId });
      return NextResponse.json(
        { error: 'Data integrity error' },
        { status: 500 }
      );
    }

    // Extract decisions from all meetings
    const decisions: Decision[] = [];
    if (kmsData.meetings && typeof kmsData.meetings === 'object') {
      Object.values(kmsData.meetings).forEach((meeting: any) => {
        if (meeting.decisions && Array.isArray(meeting.decisions)) {
          decisions.push(...meeting.decisions);
        }
      });
    }

    // Get and validate query parameters
    const { searchParams } = new URL(request.url);

    // Validate status parameter
    const statusParam = searchParams.get('status');
    let status: string | undefined;
    if (statusParam) {
      const statusValidation = validateQueryParam(statusParam, StatusSchema);
      if (!statusValidation.valid) {
        logger.warn(`Invalid status parameter: ${statusParam}`, { userId });
        return validationError(`Invalid status: ${statusValidation.error}`);
      }
      status = statusValidation.value;
    }

    // Validate severity parameter
    const severityParam = searchParams.get('severity');
    let severity: string | undefined;
    if (severityParam) {
      const severityValidation = validateQueryParam(severityParam, SeveritySchema);
      if (!severityValidation.valid) {
        logger.warn(`Invalid severity parameter: ${severityParam}`, { userId });
        return validationError(`Invalid severity: ${severityValidation.error}`);
      }
      severity = severityValidation.value;
    }

    // Validate keyword parameter
    const keywordParam = searchParams.get('keyword');
    let keyword: string | undefined;
    if (keywordParam) {
      const keywordValidation = validateQueryParam(keywordParam, KeywordSchema);
      if (!keywordValidation.valid) {
        logger.warn(`Invalid keyword parameter: ${keywordParam}`, { userId });
        return validationError(`Invalid keyword: ${keywordValidation.error}`);
      }
      keyword = keywordValidation.value;
    }

    // Filter decisions
    let filtered = decisions;

    if (status) {
      filtered = filtered.filter((d: any) => d.status === status);
    }

    if (severity) {
      filtered = filtered.filter((d: any) => d.severity === severity);
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter((d: any) =>
        d.text.toLowerCase().includes(lowerKeyword) ||
        d.owner?.toLowerCase().includes(lowerKeyword) ||
        d.meeting?.toLowerCase().includes(lowerKeyword)
      );
    }

    logger.info(`Decision query completed for user: ${userId}`, {
      total: decisions.length,
      filtered: filtered.length,
    });

    return NextResponse.json({
      total: decisions.length,
      filtered: filtered.length,
      decisions: filtered,
    });
  } catch (error) {
    return handleApiError(error, userId, 'GET /api/kms/decisions').response;
  }
}
```

### Refactored: validate/route.ts

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/app/api/kms/validate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import { z } from 'zod';
import { IdSchema } from '@/utils/inputValidation';
import { handleApiError, validationError } from '@/utils/errorHandler';
import { readJsonFile, writeJsonFile } from '@/utils/safeFileOps';
import { getLogger } from '@/utils/logging';

const logger = getLogger();

const VALIDATIONS_PATH = '.processed_kms_validations.json';

interface ValidationRecord {
  relationshipId: string;
  validated: boolean;
  validatedAt: string;
  userFeedback?: string;
}

interface ValidationStore {
  version: 1;
  lastUpdated: string;
  validations: ValidationRecord[];
}

// Schema validation
const ValidationStoreSchema = z.object({
  version: z.literal(1),
  lastUpdated: z.string().datetime(),
  validations: z.array(
    z.object({
      relationshipId: IdSchema,
      validated: z.boolean(),
      validatedAt: z.string().datetime(),
      userFeedback: z.string().optional(),
    })
  ),
});

const ValidationRecordSchema = z.object({
  relationshipId: IdSchema,
  validated: z.boolean(),
  userFeedback: z.string().max(5000).optional(),
});

function loadValidations(): ValidationStore {
  const result = readJsonFile(VALIDATIONS_PATH, (data) =>
    ValidationStoreSchema.parse(data)
  );

  if (!result.valid) {
    logger.warn(`Could not load validations: ${result.error}`);
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      validations: [],
    };
  }

  return result.data!;
}

function saveValidations(store: ValidationStore): { valid: boolean; error?: string } {
  return writeJsonFile(VALIDATIONS_PATH, store, { atomic: true });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'unknown';

  try {
    logger.info(`POST /api/kms/validate from user: ${userId}`);

    const body = await request.json();

    // Validate request body schema
    const validation = ValidationRecordSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');

      logger.warn(`Invalid validation request from ${userId}`, { errors });
      return validationError(`Invalid request: ${errors}`);
    }

    const { relationshipId, validated, userFeedback } = validation.data;

    // Load existing validations
    const store = loadValidations();

    // Check if validation already exists
    const existingIndex = store.validations.findIndex(
      (v) => v.relationshipId === relationshipId
    );

    const validationRecord: ValidationRecord = {
      relationshipId,
      validated,
      validatedAt: new Date().toISOString(),
      userFeedback,
    };

    if (existingIndex >= 0) {
      store.validations[existingIndex] = validationRecord;
      logger.info(`Validation updated for ${relationshipId}`, { userId });
    } else {
      store.validations.push(validationRecord);
      logger.info(`Validation created for ${relationshipId}`, { userId });
    }

    // Save updated store
    const saveResult = saveValidations(store);
    if (!saveResult.valid) {
      logger.error(`Failed to save validation: ${saveResult.error}`, { userId });
      return NextResponse.json(
        { error: 'Failed to save validation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      validation: validationRecord,
      totalValidations: store.validations.length,
    });
  } catch (error) {
    return handleApiError(error, userId, 'POST /api/kms/validate').response;
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id') || 'unknown';

  try {
    logger.info(`GET /api/kms/validate from user: ${userId}`);

    const store = loadValidations();

    return NextResponse.json({
      version: store.version,
      lastUpdated: store.lastUpdated,
      totalValidations: store.validations.length,
      validations: store.validations,
    });
  } catch (error) {
    return handleApiError(error, userId, 'GET /api/kms/validate').response;
  }
}
```

---

## Testing Security Boundaries

### Create Security Tests

**File:** `/Users/georgeeastwood/AI Projects/Transcript To Strategy/transcript-analyzer-unified/src/__tests__/security.test.ts`

```typescript
import { validateId, validateKeyword, validateStatus } from '../utils/inputValidation';
import { resolveFilePath } from '../utils/safeFileOps';

describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject IDs with path traversal sequences', () => {
      const result = validateId('../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should reject IDs with special characters', () => {
      const result = validateId('id<script>alert(1)</script>');
      expect(result.valid).toBe(false);
    });

    it('should accept valid alphanumeric IDs', () => {
      const result = validateId('valid-id_123');
      expect(result.valid).toBe(true);
    });

    it('should reject overly long keywords', () => {
      const longKeyword = 'a'.repeat(501);
      const result = validateKeyword(longKeyword);
      expect(result.valid).toBe(false);
    });

    it('should reject keywords with path traversal', () => {
      const result = validateKeyword('normal../../../etc');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid status values', () => {
      const result = validateStatus('invalid-status');
      expect(result.valid).toBe(false);
    });

    it('should accept valid status values', () => {
      expect(validateStatus('pending').valid).toBe(true);
      expect(validateStatus('in_progress').valid).toBe(true);
      expect(validateStatus('completed').valid).toBe(true);
    });
  });

  describe('File Path Safety', () => {
    it('should prevent path traversal', () => {
      const result = resolveFilePath('/safe/base', '../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should reject absolute paths', () => {
      const result = resolveFilePath('/safe/base', '/etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('should allow safe relative paths', () => {
      const result = resolveFilePath('/safe/base', 'subdir/file.json');
      expect(result.valid).toBe(true);
      expect(result.path).toContain('subdir/file.json');
    });

    it('should normalize paths correctly', () => {
      const result = resolveFilePath('/safe/base/', './subdir/file.json');
      expect(result.valid).toBe(true);
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML in output', () => {
      const malicious = '<script>alert("xss")</script>';
      const escaped = escapeHtml(malicious);
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;');
    });
  });
});

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
```

---

## Configuration Checklist

### Security Headers (middleware.ts)

Add to your middleware:

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );

  return response;
}
```

### .env Configuration

```bash
# Authentication
JWT_SECRET=minimum-32-characters-long-secret-key-here
AUTH_USERNAME=admin
AUTH_PASSWORD=securely-change-this-immediately

# File operations
MAX_FILE_SIZE=10485760
MAX_TOTAL_SIZE=104857600

# Logging
LOG_LEVEL=info

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Feature Flags
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOGGING=true
```

---

## Deployment Checklist

- [ ] All Phase 1 remediations implemented
- [ ] Security tests passing (100% coverage of /api routes)
- [ ] npm audit shows zero vulnerabilities
- [ ] JWT_SECRET is 32+ characters and unique
- [ ] All console.log() replaced with logger
- [ ] Error messages are generic (no internal details)
- [ ] Rate limiting enabled on all endpoints
- [ ] CORS properly configured
- [ ] Security headers set
- [ ] Audit logging active
- [ ] API keys rotated
- [ ] Database credentials secured
- [ ] TLS/HTTPS enforced in production
- [ ] Security team review completed
- [ ] Penetration testing scheduled

---

## Ongoing Security Practices

1. **Monthly Security Audits:** Use OWASP Top 10 checklist
2. **Dependency Updates:** `npm audit` weekly, update monthly
3. **Access Logging:** Monitor `/api/kms/*` endpoints for anomalies
4. **Incident Response:** Document and follow procedures
5. **Security Training:** Keep team updated on latest threats

---

**Estimated Implementation Time:** 40-60 hours
**Recommended Team:** 1-2 senior developers + 1 QA
**Review Frequency:** After each phase completion

