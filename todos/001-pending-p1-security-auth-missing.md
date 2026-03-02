---
status: pending
priority: p1
issue_id: "001"
tags:
  - code-review
  - security
  - authentication
  - critical
dependencies: []
---

# 001: Add Authentication to All `/api/kms/*` Endpoints

## Problem Statement

All REST API endpoints under `/api/kms/*` are completely open with no authentication or authorization. Any user with network access can:
- Read all strategic decisions, actions, risks, and commitments
- Modify or delete data via POST/PUT endpoints
- Extract competitive intelligence and strategic plans
- Compromise meeting confidentiality

**Why it matters:** This is a critical security breach exposing sensitive business intelligence. Production deployment is blocked until authentication is implemented.

**Affected endpoints:**
- `GET /api/kms/decisions`
- `GET /api/kms/actions`
- `GET /api/kms/risks`
- `GET /api/kms/summary`
- `GET /api/kms/relationships`
- `POST /api/kms/validate`

---

## Findings

**Location:** `app/api/kms/*/route.ts` (all endpoints)

**Evidence:**
- No auth checks in any route handler
- No middleware protecting `/api/kms` prefix
- No API keys or session validation
- No role-based access control

**Severity:** 🔴 CRITICAL - Blocks production deployment

**OWASP Category:** A01:2021 – Broken Access Control

---

## Proposed Solutions

### Solution 1: JWT Authentication with Middleware (RECOMMENDED)
**Effort:** 6-8 hours | **Risk:** Low | **Scalability:** Excellent

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/kms')) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const verified = verifyJWT(token);

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/kms/:path*'],
};
```

**Pros:**
- Stateless, scalable across serverless
- Industry standard (JWT)
- Allows fine-grained permissions
- Works with SPA and mobile

**Cons:**
- Requires JWT library
- Token refresh logic needed
- Client must manage tokens

---

### Solution 2: API Key Authentication
**Effort:** 3-4 hours | **Risk:** Low | **Scalability:** Good

```typescript
// lib/auth.ts
const VALID_API_KEYS = new Set(
  process.env.API_KEYS?.split(',') || []
);

export function validateApiKey(key: string | null): boolean {
  return key ? VALID_API_KEYS.has(key) : false;
}

// app/api/kms/decisions/route.ts
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // ... rest of handler
}
```

**Pros:**
- Simple to implement
- Good for backend-to-backend
- No token refresh needed

**Cons:**
- Not suitable for browser clients
- Key rotation is manual
- Less flexible than JWT

---

### Solution 3: Next.js Auth with next-auth
**Effort:** 8-10 hours | **Risk:** Medium | **Scalability:** Good

Use `next-auth` for full authentication with session management.

**Pros:**
- Complete auth solution
- Multiple providers (GitHub, Google, etc.)
- Built-in session management
- Role-based access control

**Cons:**
- Additional dependency
- More complex setup
- Overkill for API-only access

---

## Recommended Action

**Implement Solution 1 (JWT Middleware)** - Best balance of security, scalability, and implementation time.

---

## Technical Details

**Files to Create:**
- `middleware.ts` - Auth middleware
- `lib/auth.ts` - Auth utilities
- `lib/jwt.ts` - JWT signing/verification

**Files to Modify:**
- All 6 route handlers in `app/api/kms/*`
- `next.config.js` - Configure middleware if needed

**Dependencies to Add:**
```bash
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

**Environment Variables:**
```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=24h
```

---

## Acceptance Criteria

- [ ] Middleware created and protecting `/api/kms/*` prefix
- [ ] JWT validation implemented and working
- [ ] Unauthorized requests return 401
- [ ] Valid JWT tokens grant access
- [ ] Token expiration is enforced
- [ ] All 6 endpoints protected
- [ ] New integration tests added
- [ ] Documentation updated with auth requirements
- [ ] Error messages don't leak implementation details

---

## Work Log

- [ ] **Phase 1 (2h):** Create middleware and JWT utilities
- [ ] **Phase 2 (1h):** Add auth checks to all 6 endpoints
- [ ] **Phase 3 (2h):** Write integration tests
- [ ] **Phase 4 (1-2h):** Update documentation
- [ ] **Phase 5 (1h):** Verify all endpoints are protected

---

## Resources

- [Next.js Middleware Documentation](https://nextjs.org/docs/advanced-features/middleware)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Security Audit Report](./../../SECURITY_AUDIT_REPORT.md#1-complete-lack-of-authentication)

---

## Related Todos

- `002-pending-p1-security-json-injection.md` - JSON injection in validate endpoint
- `003-pending-p1-security-path-traversal.md` - Path traversal in file access
