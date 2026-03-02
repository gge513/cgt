import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect all /api/kms/* routes
 *
 * Note: Auth validation is performed in the route handlers themselves
 * because middleware runs in Edge Runtime which doesn't support Node.js crypto
 * (required by JWT verification).
 */
export function middleware(request: NextRequest) {
  // Auth is validated in each route handler instead
  // This allows JWT verification to use Node.js crypto APIs
  return NextResponse.next();
}

/**
 * Configure which routes the middleware applies to
 * Only protects /api/kms/* routes
 */
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
};
