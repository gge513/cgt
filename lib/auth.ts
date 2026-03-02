import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from './jwt';

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Validate request has valid JWT token
 * Returns authentication result or error response
 */
export function validateAuth(request: NextRequest): AuthResult {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return {
        authenticated: false,
        error: 'Authorization header missing',
      };
    }

    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return {
        authenticated: false,
        error: 'Invalid authorization header format. Expected: "Bearer <token>"',
      };
    }

    const payload = verifyToken(token);

    return {
      authenticated: true,
      userId: payload.sub,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      authenticated: false,
      error: message,
    };
  }
}

/**
 * Middleware wrapper for API routes
 * Returns error response if not authenticated
 */
export function authMiddleware(request: NextRequest): NextResponse | null {
  const result = validateAuth(request);

  if (!result.authenticated) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: result.error,
      },
      { status: 401 }
    );
  }

  return null;  // No error, continue
}

/**
 * Extract user ID from request if authenticated
 * Throws error if not authenticated
 */
export function getUserId(request: NextRequest): string {
  const result = validateAuth(request);

  if (!result.authenticated || !result.userId) {
    throw new Error('Not authenticated');
  }

  return result.userId;
}
