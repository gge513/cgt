import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authMiddleware } from './lib/auth';

/**
 * Middleware to protect all /api/kms/* routes with JWT authentication
 *
 * All requests must include Authorization header:
 * Authorization: Bearer <jwt_token>
 *
 * Valid token is required to access any KMS data.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/kms routes
  if (pathname.startsWith('/api/kms')) {
    const authError = authMiddleware(request);

    // If authMiddleware returns a response, send the error
    if (authError) {
      return authError;
    }
  }

  // No auth required or auth passed, continue
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
