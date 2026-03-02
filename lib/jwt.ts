import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';

export interface TokenPayload extends JwtPayload {
  sub: string;  // Subject (user ID)
  iat?: number;  // Issued at
  exp?: number;  // Expiration
}

/**
 * Sign a JWT token with the configured secret
 */
export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn = '24h'): string {
  const secret = getJWTSecret();

  return jwt.sign(payload as object, secret, {
    expiresIn: expiresIn as string | number,
    algorithm: 'HS256',
  } as SignOptions);
}

/**
 * Verify and decode a JWT token
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload {
  const secret = getJWTSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Extract token from Authorization header
 * Expected format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);  // Remove "Bearer " prefix
}

/**
 * Get JWT secret from environment or throw error
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. ' +
      'Set it to a secure random string (e.g., 256+ bits of entropy)'
    );
  }

  if (secret.length < 32) {
    console.warn(
      'WARNING: JWT_SECRET is less than 32 characters. ' +
      'This is weak. Use at least 256 bits (64 hex characters) in production.'
    );
  }

  return secret;
}

/**
 * Generate a random JWT secret for development
 * DO NOT use this in production
 */
export function generateDevSecret(): string {
  return require('crypto').randomBytes(32).toString('hex');
}
