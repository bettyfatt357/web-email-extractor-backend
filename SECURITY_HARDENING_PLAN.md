# SECURITY_HARDENING_PLAN.md - Production Security Recommendations

**Status:** Recommendations Only (No Implementation Yet)  
**Date:** July 15, 2026  

---

## CRITICAL SECURITY GAPS REQUIRING FIXES

### 1. SECURITY HEADERS (CRITICAL)
**Recommendation:** Implement security headers middleware

**Suggested Implementation:**
```typescript
// middleware.ts (New file)
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS (only for production HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // CSP
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
  );
  
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/dashboard/:path*'],
};
```

**Also recommend in `next.config.mjs`:**
```javascript
const nextConfig = {
  // ... existing config
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },
};
```

---

### 2. TYPESCRIPT STRICT MODE (CRITICAL)
**Recommendation:** Remove `ignoreBuildErrors: true`

**Current (Dangerous):**
```javascript
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,  // ❌ This hides errors!
  },
};
```

**Recommended:**
```javascript
const nextConfig = {
  // Remove ignoreBuildErrors entirely
  // Let TypeScript errors fail the build
};
```

**Action:** Fix all TypeScript errors, then remove the ignore flag.

---

### 3. INPUT VALIDATION MIDDLEWARE (CRITICAL)
**Recommendation:** Standardize input validation

**Suggested Implementation:**
```typescript
// lib/auth/input-validation.ts (New file)
import { NextResponse } from 'next/server';
import { AuthedRequest } from './middleware';

export function withInputValidation(
  handler: (req: AuthedRequest) => Promise<NextResponse>
) {
  return async (request: AuthedRequest) => {
    try {
      // Check content length
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Request body too large (max 10MB)' },
          { status: 413 }
        );
      }

      // Check content type if POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          return NextResponse.json(
            { error: 'Content-Type must be application/json' },
            { status: 415 }
          );
        }
      }

      // Add request timeout
      const timeoutPromise = new Promise<NextResponse>((resolve) => {
        setTimeout(() => {
          resolve(NextResponse.json(
            { error: 'Request timeout' },
            { status: 504 }
          ));
        }, 30000); // 30 second timeout
      });

      return Promise.race([handler(request), timeoutPromise]);
    } catch (error) {
      console.error('[INPUT_VALIDATION] Error:', error);
      return NextResponse.json(
        { error: 'Validation error' },
        { status: 400 }
      );
    }
  };
}
```

---

### 4. BRUTE FORCE PROTECTION (CRITICAL)
**Recommendation:** Add protection against auth failure attacks

**Suggested Implementation:**
```typescript
// lib/auth/brute-force-protection.ts (New file)
import { NextResponse } from 'next/server';
import { AuthedRequest } from './middleware';

const failedAttempts = new Map<string, { count: number; resetTime: number }>();

export async function checkBruteForceProtection(
  identifier: string // IP or user ID
): Promise<{ allowed: boolean; remainingAttempts: number }> {
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15 minute window
  const maxAttempts = 5;

  let attempt = failedAttempts.get(identifier);

  // Reset if window expired
  if (!attempt || now > attempt.resetTime) {
    attempt = { count: 0, resetTime: now + window };
    failedAttempts.set(identifier, attempt);
  }

  const allowed = attempt.count < maxAttempts;
  const remaining = Math.max(0, maxAttempts - attempt.count);

  return { allowed, remainingAttempts: remaining };
}

export async function recordAuthFailure(identifier: string) {
  const attempt = failedAttempts.get(identifier) || {
    count: 0,
    resetTime: Date.now() + 15 * 60 * 1000,
  };
  attempt.count++;
  failedAttempts.set(identifier, attempt);
}

export async function clearAuthFailures(identifier: string) {
  failedAttempts.delete(identifier);
}
```

**Use in withAuth middleware:**
```typescript
// Before validating API key
const ip = request.headers.get('x-forwarded-for') || 'unknown';
const { allowed } = await checkBruteForceProtection(ip);

if (!allowed) {
  return NextResponse.json(
    { error: 'Too many auth failures. Try again later.' },
    { status: 429 }
  );
}

// After auth failure
if (!user) {
  await recordAuthFailure(ip);
  return NextResponse.json(
    { error: 'Invalid API key' },
    { status: 401 }
  );
}

// After successful auth
await clearAuthFailures(ip);
```

---

### 5. AUDIT LOGGING (HIGH)
**Recommendation:** Add audit trail for security events

**Suggested Implementation:**
```typescript
// lib/audit/audit-logger.ts (New file)
import { NextRequest } from 'next/server';

export interface AuditEvent {
  timestamp: number;
  eventType: 'AUTH_ATTEMPT' | 'AUTH_SUCCESS' | 'AUTH_FAILURE' | 'ADMIN_ACTION' | 'BILLING_CHECK';
  userId?: string;
  ip: string;
  endpoint: string;
  status: number;
  details: Record<string, any>;
}

const auditLog: AuditEvent[] = [];

export async function logAuditEvent(event: AuditEvent) {
  auditLog.push(event);
  
  // In production, send to external audit log service
  // (e.g., CloudWatch, DataDog, Splunk)
  
  console.log('[AUDIT]', JSON.stringify(event));
  
  // Keep only last 10,000 events in memory
  if (auditLog.length > 10000) {
    auditLog.shift();
  }
}

export function getAuditLog(
  eventType?: string,
  limit: number = 100
): AuditEvent[] {
  let filtered = auditLog;
  
  if (eventType) {
    filtered = filtered.filter(e => e.eventType === eventType);
  }
  
  return filtered.slice(-limit);
}
```

---

### 6. STANDARDIZED ERROR RESPONSES (HIGH)
**Recommendation:** Create consistent error format

**Suggested Implementation:**
```typescript
// lib/errors/error-response.ts (New file)
import { NextResponse } from 'next/server';

export enum ErrorCode {
  // Auth
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_ADMIN = 'NOT_ADMIN',
  BRUTE_FORCE = 'BRUTE_FORCE',

  // Validation
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: number;
  requestId?: string;
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, any>,
  requestId?: string
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: { code, message, ...(details && { details }) },
      timestamp: Date.now(),
      ...(requestId && { requestId }),
    },
    { status }
  );
}

// Helper functions
export const Errors = {
  invalidApiKey: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.INVALID_API_KEY,
      'Invalid or missing API key',
      401,
      undefined,
      requestId
    ),
  unauthorized: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      'Unauthorized',
      401,
      undefined,
      requestId
    ),
  notAdmin: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.NOT_ADMIN,
      'Admin access required',
      403,
      undefined,
      requestId
    ),
  quotaExceeded: (remaining: number, requestId?: string) =>
    createErrorResponse(
      ErrorCode.QUOTA_EXCEEDED,
      'Monthly quota exceeded',
      403,
      { remaining },
      requestId
    ),
  notFound: (resource: string, requestId?: string) =>
    createErrorResponse(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      404,
      undefined,
      requestId
    ),
  internalError: (requestId?: string) =>
    createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      500,
      undefined,
      requestId
    ),
};
```

---

### 7. REQUEST CORRELATION IDS (HIGH)
**Recommendation:** Add request tracking

**Suggested Implementation:**
```typescript
// lib/tracking/correlation-id.ts (New file)
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export function generateCorrelationId(): string {
  return randomUUID();
}

export function withCorrelationId(
  handler: (req: any) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // Check for existing correlation ID
    let correlationId = request.headers.get('x-correlation-id');
    
    if (!correlationId) {
      correlationId = generateCorrelationId();
    }

    // Attach to request
    (request as any).correlationId = correlationId;

    // Process request
    const response = await handler(request);

    // Add to response headers
    response.headers.set('x-correlation-id', correlationId);

    return response;
  };
}
```

---

### 8. HEALTH ENDPOINTS (MEDIUM)
**Recommendation:** Create standardized health checks

**Suggested Files:**

`app/api/health/route.ts` - Public health endpoint
`app/api/health/live/route.ts` - Liveness probe
`app/api/health/ready/route.ts` - Readiness probe

See next section for full implementation.

---

## RECOMMENDED MIDDLEWARE STACK

**New recommended middleware order:**

```typescript
// For customer endpoints:
export const POST = withCorrelationId(
  withInputValidation(
    withAuth(
      withRateLimit(
        withBilling(
          handler
        )
      )
    )
  )
);

// For admin endpoints:
export const GET = withCorrelationId(
  withInputValidation(
    withAuth(
      withAdminAuth(
        handler
      )
    )
  )
);
```

---

## REDIS MIGRATION RECOMMENDATION

**For rate limiting and billing:**

Move from in-memory to Redis:
- Better for distributed systems
- Survives restarts
- More scalable

**Suggested approach:**
```typescript
// lib/auth/rate-limit-redis.ts (NEW)
import { Redis } from '@upstash/redis';

export async function checkRateLimitRedis(
  userId: string,
  plan: 'free' | 'pro' | 'enterprise'
) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const limit = { free: 10, pro: 100, enterprise: 1000 }[plan];
  const key = `rate:${userId}:${Math.floor(Date.now() / 3600000)}`;

  const current = await redis.incr(key);
  
  // Set expiration if this is a new key
  if (current === 1) {
    await redis.expire(key, 3600);
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
```

---

## STRUCTURED LOGGING RECOMMENDATION

**Suggested logging format (JSON):**

```json
{
  "timestamp": "2024-07-15T10:30:00.000Z",
  "level": "INFO",
  "correlationId": "uuid",
  "endpoint": "/api/search",
  "method": "POST",
  "userId": "user_123",
  "status": 200,
  "duration_ms": 250,
  "message": "Search completed",
  "details": {
    "query": "...",
    "results": 25
  }
}
```

**Suggested implementation:**
```typescript
// lib/logging/logger.ts (NEW)
export interface LogContext {
  correlationId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  status?: number;
  duration?: number;
}

export function logStructured(
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  message: string,
  context: LogContext = {},
  details?: Record<string, any>
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...context,
    message,
    ...(details && { details }),
  };

  console.log(JSON.stringify(logEntry));
}
```

---

## PERFORMANCE & OBSERVABILITY RECOMMENDATIONS

### Metrics Endpoint
Create `app/api/metrics/route.ts` that exposes:
- API latency (p50, p95, p99)
- Queue depth
- Job success rate
- Error rates
- Redis connection status

### Performance Monitoring
Add timing to endpoints:
```typescript
const startTime = Date.now();
// ... process request ...
const duration = Date.now() - startTime;

logStructured('INFO', 'Request completed', {
  correlationId,
  endpoint,
  method,
  status,
  duration,
});
```

---

## TESTING RECOMMENDATIONS

### Unit Tests
- Authentication logic
- Rate limiting logic
- Billing logic
- Input validation

### Integration Tests
- Queue operations
- Redis connectivity
- API endpoints

### Load Tests
- Document expected throughput
- Test rate limiting
- Test queue processing

---

## DEPLOYMENT CHECKLIST

Before deploying to production:
- [ ] All security headers configured
- [ ] TypeScript strict mode passing
- [ ] Input validation in place
- [ ] Audit logging functional
- [ ] Error responses standardized
- [ ] Health endpoints working
- [ ] Correlation IDs flowing
- [ ] Structured logging enabled
- [ ] CI/CD pipeline green
- [ ] Load tests passed
- [ ] Security headers verified
- [ ] No secrets in logs
- [ ] Graceful shutdown tested

---

## ROLLBACK PROCEDURES

If security hardening breaks production:

1. Revert middleware changes
2. Check Redis connectivity
3. Verify API key validation
4. Check rate limit state
5. Monitor error rates
6. Review audit logs

---

## RECOMMENDATIONS SUMMARY

**Critical (Immediate):**
1. Add security headers
2. Fix TypeScript `ignoreBuildErrors`
3. Add input validation
4. Add brute force protection

**High Priority (1-2 days):**
1. Implement audit logging
2. Standardize errors
3. Add correlation IDs
4. Create health endpoints

**Medium Priority (2-3 days):**
1. Add structured logging
2. Move rate limiting to Redis
3. Move billing to Redis
4. Add metrics collection

**Longer Term:**
1. Implement CI/CD
2. Add comprehensive tests
3. Create load test suite
4. Document runbooks

---

**Status:** Recommendations Only  
**Next Step:** Begin Phase 1 Implementation  
**Estimated Timeline:** 5-10 days for all phases

