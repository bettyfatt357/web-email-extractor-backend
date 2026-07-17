# Phase 1 Implementation Plan: Separate Dashboard & External API Authentication

**Objective**: Separate internal dashboard authentication from external API key authentication.  
**Scope**: 6 files total (1 new, 5 modified)  
**Estimated Duration**: 2-3 hours  
**Risk Level**: LOW

---

## CHANGES OVERVIEW

### 1. NEW FILE: `lib/auth/middleware-dashboard.ts`

**Purpose**: Authenticate dashboard API requests using Supabase sessions from httpOnly cookies.

**Location**: `/vercel/share/v0-project/lib/auth/middleware-dashboard.ts`

**Implementation Details**:
- Extract Supabase session from request cookies
- Validate user is authenticated (session exists)
- Return 401 if no session or session invalid
- Attach user info to request object
- Compatible with existing Supabase SSR setup

**Code Overview** (~80 lines):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/supabase/server'

export interface DashboardAuthRequest extends NextRequest {
  user?: {
    id: string
    email: string
    role: 'user' | 'admin'
  }
}

export function withDashboardAuth(
  handler: (req: DashboardAuthRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const { session } = await getServerSession(request)

      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized - session required' },
          { status: 401 }
        )
      }

      const dashboardRequest = request as DashboardAuthRequest
      dashboardRequest.user = {
        id: session.user.id,
        email: session.user.email || '',
        role: 'user', // Can extend to support admin roles
      }

      return handler(dashboardRequest)
    } catch (error) {
      console.error('[Dashboard Auth] Error:', error)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
  }
}
```

---

### 2. MODIFY: `/app/api/billing/status/route.ts`

**Current State**:
```typescript
export const GET = withAuth(handler);  // Uses x-api-key
```

**New State**:
```typescript
export const GET = withDashboardAuth(handler);  // Uses Supabase session
```

**Additional Changes**:
- Replace `import { withAuth } from '@/lib/auth/middleware'` with `import { withDashboardAuth } from '@/lib/auth/middleware-dashboard'`
- Handler function remains the same (no logic changes)
- User info still available via `request.user`

**Files Lines Changed**: 2 lines
- Line 1: Update import
- Line ~40: Update middleware wrapper

---

### 3. MODIFY: `/app/api/metrics/route.ts`

**Current State**:
- No authentication middleware (endpoint is currently public)
- Routes handler directly: `export async function GET(request: NextRequest)`

**New State**:
- Add Supabase session authentication
- Requires active dashboard session to access

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withDashboardAuth } from '@/lib/auth/middleware-dashboard'
import { Redis } from '@upstash/redis'
import { DashboardAuthRequest } from '@/lib/auth/middleware-dashboard'

async function handler(request: DashboardAuthRequest): Promise<NextResponse> {
  // ... existing implementation stays the same
  // Just use 'request' instead of 'request: NextRequest'
}

export const GET = withDashboardAuth(handler)
export const OPTIONS = withDashboardAuth(async (request) => {
  // ... return OPTIONS documentation
})
```

**Files Lines Changed**: ~50 lines
- Add import for middleware and types
- Wrap handler function with withDashboardAuth
- Create separate OPTIONS handler (also wrapped)

---

### 4. MODIFY: `hooks/useUsage.ts`

**Current State**:
```typescript
const credential = getUserCredential() ?? undefined;
const client = new ApiClient(credential);
const data = await client.get<Usage>('/api/billing/status');
```

**New State**:
```typescript
const response = await fetch('/api/billing/status', {
  method: 'GET',
  credentials: 'include', // Include httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
})

if (!response.ok) {
  throw new Error(`Failed to fetch usage: ${response.status}`)
}

const data = await response.json()
```

**Changes**:
- Remove: `import { getUserCredential } from '@/lib/auth/storage'`
- Remove: `import { ApiClient, ApiError } from '@/lib/api/client'`
- Remove: `getUserCredential()` call
- Replace ApiClient with native fetch
- Handle response.ok check instead of try/catch ApiError

**Files Lines Changed**: ~25 lines
- Remove 2 imports (~2 lines)
- Replace 3 lines with fetch (~8 lines)
- Update error handling (~5 lines)

---

### 5. MODIFY: `hooks/useMetrics.ts`

**Current State**:
```typescript
const credential = getUserCredential() ?? undefined;
const client = new ApiClient(credential);
const data = await client.get<Metrics>('/api/metrics');
```

**New State**:
```typescript
const response = await fetch('/api/metrics', {
  method: 'GET',
  credentials: 'include', // Include httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
})

if (!response.ok) {
  throw new Error(`Failed to fetch metrics: ${response.status}`)
}

const data = await response.json()
```

**Changes**: Identical to useUsage.ts

**Files Lines Changed**: ~25 lines

---

## EXACT FILES TO MODIFY

| File | Type | Lines Changed | Impact |
|------|------|---------------|--------|
| `lib/auth/middleware-dashboard.ts` | CREATE | +80 | New file, dashboard auth |
| `app/api/billing/status/route.ts` | MODIFY | 2 | Change middleware import + wrapper |
| `app/api/metrics/route.ts` | MODIFY | ~50 | Add auth middleware to existing route |
| `hooks/useUsage.ts` | MODIFY | ~25 | Remove credential, use fetch |
| `hooks/useMetrics.ts` | MODIFY | ~25 | Remove credential, use fetch |

**Total**: 1 new file + 4 modified files = ~180 lines of changes

---

## RISK ASSESSMENT

### Risk 1: Breaking Dashboard Data Loading

**Severity**: MEDIUM  
**Probability**: LOW  
**Mitigation**:
- Supabase sessions work automatically via httpOnly cookies
- Browser automatically includes cookies in fetch requests
- Session validation logic already proven in middleware
- No breaking change to session mechanism

**Confidence**: HIGH - Phase 2A already validated Supabase sessions work correctly

---

### Risk 2: API Error Handling Changes

**Severity**: LOW  
**Probability**: MEDIUM  
**Mitigation**:
- Replace try/catch ApiError with response.ok check
- Error handling is simpler and more transparent
- Existing error UI will show 401/403/500 responses
- Console logging preserved

**Confidence**: HIGH - Native fetch has clear error contract

---

### Risk 3: External APIs Break

**Severity**: HIGH  
**Probability**: ZERO  
**Mitigation**:
- External APIs (search, jobs, admin) use x-api-key - NO CHANGES
- Only internal dashboard APIs switch to sessions
- withAuth() middleware stays unchanged
- Can be verified before merge

**Confidence**: VERY HIGH - External APIs completely isolated

---

### Risk 4: Session Cookie Not Sent

**Severity**: HIGH  
**Probability**: VERY LOW  
**Mitigation**:
- Setting `credentials: 'include'` in fetch ensures cookies sent
- Cookies set by Supabase with httpOnly + Secure flags
- Browser automatically includes in same-origin requests
- Middleware already handles session refresh

**Confidence**: VERY HIGH - Same mechanism Phase 2A relies on

---

### Risk 5: Undefined User Object in Route Handlers

**Severity**: MEDIUM  
**Probability**: LOW  
**Mitigation**:
- DashboardAuthRequest type ensures user property exists
- withDashboardAuth() always sets user if session valid
- Router handlers already destructure user safely
- TypeScript will catch missing user access

**Confidence**: HIGH - Type safety ensures correctness

---

## TESTING PLAN

### Pre-Deployment Tests (Required)

**Test 1: Dashboard Login Flow**
```
1. User registers/logs in
2. Dashboard redirects to /dashboard
3. Middleware validates Supabase session
4. User can access dashboard pages
5. useUsage() hook calls /api/billing/status
6. Response: 200 OK with billing data
   (NOT 401 "API key required")
```

**Test 2: Metrics Endpoint**
```
1. Authenticated user on dashboard
2. /api/metrics endpoint called
3. withDashboardAuth validates session
4. Response: 200 OK with metrics
   (NOT public response, requires session)
```

**Test 3: Unauthenticated Access to Dashboard APIs**
```
1. New browser window (no session cookies)
2. Direct request to /api/billing/status
3. Response: 401 "Unauthorized - session required"
   (NOT 200 or "API key required")
```

**Test 4: External APIs Still Work**
```
1. Authenticated request to /api/search
2. With x-api-key header
3. Response: Works exactly as before
   (External APIs unaffected)
```

**Test 5: No Session Token in Request**
```
1. useUsage() called without getUserCredential()
2. Fetch with credentials: 'include'
3. Browser sends httpOnly cookies automatically
4. Server receives session in request
5. withDashboardAuth validates session
6. Handler executes successfully
```

---

## BACKWARD COMPATIBILITY

### Dashboard Users (Upgraded)
- ✓ No action required
- ✓ Sessions already in httpOnly cookies (Phase 2A)
- ✓ Fetch with `credentials: 'include'` automatically sends cookies
- ✓ All dashboard features continue working

### API Key Users (External Developers)
- ✓ ZERO CHANGES to external APIs
- ✓ External API routes still use x-api-key
- ✓ withAuth() middleware unchanged
- ✓ All external API features continue working

### Deployment Path
- ✓ Can deploy with zero downtime
- ✓ No database migrations required
- ✓ No environment variable changes required
- ✓ Can rollback by reverting 6 file changes

---

## SUCCESS CRITERIA

✓ Dashboard loads without 401 errors  
✓ useUsage() returns valid data  
✓ useMetrics() returns valid data  
✓ External APIs still accept x-api-key  
✓ Unauthenticated requests get 401  
✓ No console errors related to authentication  
✓ Session cookies properly set and sent  

---

## DEPENDENCIES

**Required for This Phase**:
- Supabase SSR client setup (already exists)
- httpOnly cookies working (Phase 2A verified)
- Session refresh logic (already in middleware.ts)

**Not Required**:
- Database migrations
- Environment variable changes
- User provider integrations
- Search provider architecture

**Future Phases Depend On**:
- This separation enables Phase 2 (provider integrations)
- This enables Phase 3 (payment integrations)

---

## DEPLOYMENT CHECKLIST

- [ ] Create `lib/auth/middleware-dashboard.ts`
- [ ] Update `/app/api/billing/status/route.ts`
- [ ] Update `/app/api/metrics/route.ts`
- [ ] Update `hooks/useUsage.ts`
- [ ] Update `hooks/useMetrics.ts`
- [ ] Build succeeds: `npm run build`
- [ ] Run Test 1-5 above
- [ ] Verify no external API breaks
- [ ] Deploy to staging
- [ ] Smoke test dashboard
- [ ] Deploy to production

---

## APPROVAL NEEDED

Please confirm:
1. ✓ Ready to proceed with creating `lib/auth/middleware-dashboard.ts`
2. ✓ Ready to modify billing/status route to use Supabase auth
3. ✓ Ready to modify metrics route to use Supabase auth
4. ✓ Ready to simplify useUsage/useMetrics hooks
5. ✓ Risk assessment is acceptable
6. ✓ Testing plan covers your needs

Once approved, implementation will proceed in sequence.
