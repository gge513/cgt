# JWT Authentication for KMS API

All `/api/kms/*` endpoints require JWT (JSON Web Token) authentication.

## Quick Start

### 1. Set JWT_SECRET in .env

Generate a secure secret (recommended: 256 bits of entropy):

```bash
openssl rand -hex 32
```

Add to `.env`:
```env
JWT_SECRET=your_generated_secret_here
```

### 2. Generate a Token

Use the JWT utility to create a token:

```typescript
import { signToken } from '@/lib/jwt';

// Create a token for a user
const token = signToken({ sub: 'user-id' }, '24h');
console.log(token);  // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Use Token in API Requests

Include the token in the `Authorization` header:

```bash
curl -X GET http://localhost:3000/api/kms/decisions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

```javascript
const response = await fetch('/api/kms/decisions', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Environment Setup

### Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Generate and set `JWT_SECRET`:
   ```bash
   openssl rand -hex 32 > /tmp/jwt_secret.txt
   cat /tmp/jwt_secret.txt  # Copy this value to JWT_SECRET in .env
   ```

3. The secret must be at least 32 characters (warning will show if shorter)

### Production

1. **Generate a strong secret:**
   ```bash
   # Use 256 bits of entropy (64 hex characters)
   openssl rand -hex 32
   ```

2. **Store securely:**
   - Use environment variable management (never commit secrets)
   - Use secrets management service (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Rotate regularly (at least annually)

3. **Example with Docker:**
   ```dockerfile
   ENV JWT_SECRET=${JWT_SECRET}  # Set at runtime, never at build time
   ```

## API Authentication Flow

### Successful Authentication

```
GET /api/kms/decisions
Authorization: Bearer <valid_token>
↓
[Middleware validates token]
↓
Token valid & not expired
↓
200 OK - Return decisions
```

### Failed Authentication

```
GET /api/kms/decisions
Authorization: Bearer <invalid_token>
↓
[Middleware validates token]
↓
Token invalid/expired/missing
↓
401 Unauthorized
{
  "error": "Unauthorized",
  "details": "Token has expired"
}
```

## Token Structure

### JWT Payload

```typescript
interface TokenPayload {
  sub: string;      // Subject (user ID)
  iat: number;      // Issued at (Unix timestamp)
  exp: number;      // Expiration (Unix timestamp)
}
```

### Example Token Decoded

```json
{
  "sub": "user-123",
  "iat": 1709383200,
  "exp": 1709469600,
  "iat": "2026-03-02T07:00:00Z",
  "exp": "2026-03-03T07:00:00Z"
}
```

## API Endpoints

All KMS endpoints require authentication:

### GET Endpoints (Read)

- `GET /api/kms/decisions` - Fetch all decisions
- `GET /api/kms/actions` - Fetch all actions
- `GET /api/kms/summary` - Get KMS statistics
- `GET /api/kms/relationships` - Get decision relationships
- `GET /api/kms/validate` - Get validation records

### POST/PUT Endpoints (Write)

- `POST /api/kms/actions` - Execute an action (escalate, resolve, etc.)
- `POST /api/kms/validate` - Submit relationship validation

## Error Messages

### Missing Authorization Header

```json
{
  "error": "Unauthorized",
  "details": "Authorization header missing"
}
```

**Fix:** Add `Authorization: Bearer <token>` header

### Malformed Authorization Header

```json
{
  "error": "Unauthorized",
  "details": "Invalid authorization header format. Expected: \"Bearer <token>\""
}
```

**Fix:** Use format `Authorization: Bearer <token>` (case-sensitive)

### Token Expired

```json
{
  "error": "Unauthorized",
  "details": "Token has expired"
}
```

**Fix:** Generate a new token with `signToken()`

### Invalid Token

```json
{
  "error": "Unauthorized",
  "details": "Invalid token"
}
```

**Fix:** Verify token was generated with the same `JWT_SECRET`

## Code Examples

### Node.js with Fetch

```typescript
import { signToken } from './lib/jwt';

// Generate token
const token = signToken({ sub: 'user-123' }, '24h');

// Make API request
const response = await fetch('http://localhost:3000/api/kms/decisions', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const decisions = await response.json();
```

### cURL

```bash
# Generate token
TOKEN=$(node -e "
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ sub: 'user-123' }, process.env.JWT_SECRET);
  console.log(token);
")

# Use token
curl -X GET http://localhost:3000/api/kms/decisions \
  -H "Authorization: Bearer $TOKEN"
```

### Python

```python
import requests
import jwt
import os

# Generate token
secret = os.getenv('JWT_SECRET')
token = jwt.encode({'sub': 'user-123'}, secret, algorithm='HS256')

# Make request
response = requests.get(
    'http://localhost:3000/api/kms/decisions',
    headers={'Authorization': f'Bearer {token}'}
)

decisions = response.json()
```

### JavaScript/React

```typescript
import { signToken } from '@/lib/jwt';

export function useKMSAPI() {
  const [decisions, setDecisions] = useState([]);

  useEffect(() => {
    const fetchDecisions = async () => {
      // Generate token (in production, would come from server)
      const token = signToken({ sub: 'user-123' });

      const response = await fetch('/api/kms/decisions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setDecisions(data.decisions);
    };

    fetchDecisions();
  }, []);

  return { decisions };
}
```

## Token Expiration

### Setting Custom Expiration

```typescript
// 1 hour
signToken({ sub: 'user' }, '1h')

// 7 days
signToken({ sub: 'user' }, '7d')

// Seconds (3600 = 1 hour)
signToken({ sub: 'user' }, 3600)
```

### Recommended Expiration Times

| Use Case | Duration | Notes |
|----------|----------|-------|
| API Testing | 24h | Short-lived for security |
| CLI Tools | 7d | Balance security/convenience |
| Service Accounts | 30d | Requires rotation plan |
| User Sessions | 1h | Refresh tokens recommended |

## Middleware Configuration

The authentication middleware in `middleware.ts` protects all `/api/kms` routes:

```typescript
export const config = {
  matcher: ['/api/:path*'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/kms routes
  if (pathname.startsWith('/api/kms')) {
    const authError = authMiddleware(request);
    if (authError) {
      return authError;
    }
  }

  return NextResponse.next();
}
```

### To add auth to other routes:

```typescript
if (pathname.startsWith('/api/other-route')) {
  const authError = authMiddleware(request);
  if (authError) return authError;
}
```

## Security Best Practices

1. **Secret Management:**
   - Never commit `JWT_SECRET` to git
   - Use environment variables or secrets manager
   - Rotate periodically (annual minimum)

2. **Token Handling:**
   - Keep tokens in memory, not localStorage (XSS attack vector)
   - Use short expiration times (1-24 hours)
   - Implement token refresh mechanism for long sessions

3. **HTTPS Only:**
   - Always use HTTPS in production
   - Never send tokens over unencrypted HTTP
   - Include `Secure` flag on cookies if using them

4. **Header Validation:**
   - Always validate Authorization header format
   - Reject malformed tokens early
   - Log failed authentication attempts

5. **Error Messages:**
   - Don't leak implementation details
   - Use generic messages for unauthorized
   - Log detailed errors server-side

## Troubleshooting

### "JWT_SECRET environment variable is not set"

**Problem:** Server can't find JWT_SECRET

**Solution:**
```bash
# Check if .env exists and has JWT_SECRET
cat .env | grep JWT_SECRET

# If not set, add it
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

### "Token has expired"

**Problem:** Token is older than expiration time

**Solution:**
```typescript
// Generate a fresh token
const newToken = signToken({ sub: 'user' }, '24h');
```

### "Invalid token"

**Problem:** Token is corrupted or uses different secret

**Solution:**
1. Verify `JWT_SECRET` matches between token generation and verification
2. Check token wasn't modified in transit
3. Regenerate with correct secret

### Auth works locally but fails on production

**Problem:** Different `JWT_SECRET` between environments

**Solution:**
1. Verify production `.env` has `JWT_SECRET` set
2. Ensure it's the same secret used to generate tokens
3. Use secrets management service for consistency

## Testing

### Unit Tests

```bash
npm test -- app/api/kms/__tests__/auth.test.ts
```

### Integration Testing

```bash
# Generate token
TOKEN=$(npm run -s generate-token)

# Test protected endpoint
curl -X GET http://localhost:3000/api/kms/decisions \
  -H "Authorization: Bearer $TOKEN"

# Test without token (should fail with 401)
curl -X GET http://localhost:3000/api/kms/decisions
```

## Migration Guide

### From No Auth to JWT Auth

1. **Deploy middleware and auth utilities** (don't require token yet)
2. **Clients add auth headers** to all KMS requests
3. **Enable authentication enforcement**
4. **Monitor and debug any issues**
5. **Update documentation**

### Backwards Compatibility

Currently, all clients must implement authentication. To support both authenticated and unauthenticated requests temporarily:

```typescript
if (pathname.startsWith('/api/kms/public')) {
  // Public endpoints - no auth required
  return NextResponse.next();
} else if (pathname.startsWith('/api/kms')) {
  // Protected endpoints - require auth
  const authError = authMiddleware(request);
  if (authError) return authError;
}
```

## Reference

- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [jsonwebtoken npm docs](https://www.npmjs.com/package/jsonwebtoken)
- [Next.js Middleware](https://nextjs.org/docs/advanced-features/middleware)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
