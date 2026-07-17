# Authentication Separation Investigation Report

**Status**: READ-ONLY INVESTIGATION - NO CODE CHANGES  
**Date**: Current session  
**Priority**: CRITICAL - Blocks dashboard and provider integrations

---

## ROOT CAUSE

The application has **two incompatible authentication systems conflating internal and external APIs**:

### System 1: Supabase Auth (Phase 2A Implementation)
- ✓ Users log in with email/password
- ✓ Sessions stored in httpOnly cookies
- ✓ Middleware validates Supabase sessions correctly
- ✓ Dashboard pages protected correctly
- ✓ User state captured correctly in React

**Status**: Working correctly for dashboard access

### System 2: API Key Auth (Pre-existing)
- ✓ External developers authenticate with x-api-key header
- ✓ withAuth() middleware validates credentials
- ✓ User object created from API key
- ✓ Admin authorization checks credentials

**Status**: Working correctly for external API access

### THE PROBLEM: Dashboard Uses Wrong Auth System

```
User logs in with Supabase
  ↓
Supabase session created in httpOnly cookies ✓
  ↓
Dashboard page loads ✓
  ↓
useUsage() hook needs data
  ↓
Tries to call /api/billing/status
  ↓
ApiClient looks for x-api-key in localStorage
  ↓
No API key found (user logged in via Supabase, not API key)
  ↓
Request sent WITHOUT x-api-key header ✗
  ↓
/api/billing/status receives request
  ↓
withAuth() middleware looks for x-api-key header
  ↓
No header found → rejects with 401 ✗
  ↓
Dashboard API call fails ✗
```

---

## FILES INVOLVED

### Authentication/Middleware Layer

**File**: `lib/auth/middleware.ts`
- **Current Role**: Validates API keys via x-api-key header
- **Issue**: Used for all API routes, including internal dashboard ones
- **Function**: `withAuth(handler)` - checks for x-api-key, creates user object
- **Lines**: ~40 lines

**File**: `lib/auth/storage.ts`
- **Current Role**: Manages API key storage (localStorage)
- **Issue**: Dashboard doesn't populate this - users log in via Supabase
- **Function**: `getUserCredential()` - returns API key from localStorage (null for Supabase users)
- **Lines**: ~15 lines

**File**: `middleware.ts` (root level)
- **Current Role**: Validates Supabase sessions
- **Status**: Working correctly
- **Issue**: No connection between this and API route auth

### Dashboard Hooks

**File**: `hooks/useUsage.ts`
- **Current Role**: Fetches billing/usage data
- **Issue**: Calls `getUserCredential()` expecting API key
- **Problem**: Returns null for Supabase users, so x-api-key header never sent
- **Lines**: ~30 lines

**File**: `hooks/useMetrics.ts`
- **Current Role**: Fetches job metrics
- **Issue**: Same as useUsage - calls `getUserCredential()`
- **Lines**: ~30 lines

### API Client

**File**: `lib/api/client.ts`
- **Current Role**: Makes HTTP requests
- **Issue**: Expects credential parameter, adds x-api-key header
- **Problem**: Used by dashboard hooks, but dashboard has no API key credential
- **Lines**: ~20 lines

### API Routes (Internal Dashboard APIs)

**File**: `/app/api/billing/status/route.ts`
- **Type**: INTERNAL - only called by dashboard useUsage() hook
- **Auth**: Currently using `withAuth()` expecting x-api-key
- **Issue**: Should accept Supabase session, not API key
- **Lines**: ~40 lines

**File**: `/app/api/metrics/route.ts`
- **Type**: INTERNAL - only called by dashboard useMetrics() hook
- **Auth**: Currently using `withAuth()` expecting x-api-key
- **Issue**: Should accept Supabase session, not API key
- **Lines**: ~30 lines

### API Routes (External Developer APIs)

**Files**: (14 total)
- `/app/api/search/route.ts` - External: POST request to search
- `/app/api/jobs/route.ts` - External: Create/list jobs
- `/app/api/job/[id]/route.ts` - External: Get job details
- `/app/api/job/[id]/result/route.ts` - External: Get results
- `/app/api/job/[id]/status/route.ts` - External: Check status
- `/app/api/admin/**` - External: Admin operations (8 routes)

**Auth**: All correctly use `withAuth()` with x-api-key  
**Status**: Working correctly

---

## RECOMMENDED MIDDLEWARE SEPARATION

### New Architecture: Two Auth Paths

Create **two separate authentication middlewares**:

#### 1. Dashboard Authentication Middleware

**File to Create**: `lib/auth/middleware-dashboard.ts`

**Responsibility**: Authenticate internal dashboard API calls using Supabase session

```typescript
// Extract Supabase session from httpOnly cookies
// Validate session is valid
// Attach user object to request from Supabase user data
// Return 401 if no valid session
```

**Usage**: Internal dashboard API routes only
- `/api/billing/status`
- `/api/metrics`
- `/api/usage` (if created)

**Middleware Function**:
```typescript
export async function withDashboardAuth(handler) {
  return async (request) => {
    // 1. Extract session from cookies using Supabase server client
    // 2. Validate session
    // 3. Get user from session
    // 4. Attach user to request
    // 5. Call handler
  }
}
```

**How It Gets Supabase Session**:
- Use cookies() from next/headers
- Create Supabase server client with cookies
- Extract session from auth.getSession()
- Validate user exists

#### 2. External API Authentication Middleware

**File Existing**: `lib/auth/middleware.ts`

**Keep As-Is**: For external developer APIs using x-api-key

**Usage**: External developer API routes only
- `/api/search`
- `/api/jobs`
- `/api/admin/**`

---

## IMPLEMENTATION STRATEGY

### Step 1: Create Dashboard Auth Middleware

**File**: `lib/auth/middleware-dashboard.ts` (CREATE NEW)

Validates Supabase sessions from httpOnly cookies.

```typescript
export async function withDashboardAuth(handler) {
  return async (request: NextRequest) => {
    try {
      // Get Supabase server client
      const supabase = await createSupabaseServerClient()
      
      // Get session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      // Validate session exists
      if (!session?.user) {
        return new Response('Unauthorized', { status: 401 })
      }
      
      // Attach user to request (same interface as withAuth for consistency)
      ;(request as any).user = {
        id: session.user.id,
        email: session.user.email,
        isAdmin: false, // Can enhance later with user metadata
      }
      
      return handler(request)
    } catch (error) {
      return new Response('Authentication error', { status: 500 })
    }
  }
}
```

**Key Points**:
- Uses existing `createSupabaseServerClient()` from Phase 2A
- Extracts session from httpOnly cookies automatically
- Same interface as `withAuth()` (attaches user to request)
- Returns 401 if no session
- No x-api-key header required

### Step 2: Update Internal Dashboard API Routes

**Files to Modify** (3 routes):
- `/app/api/billing/status/route.ts`
- `/app/api/metrics/route.ts`
- Any other internal-only routes

**Change**:
```typescript
// Before
import { withAuth } from '@/lib/auth/middleware'
export const GET = withAuth(handler)

// After
import { withDashboardAuth } from '@/lib/auth/middleware-dashboard'
export const GET = withDashboardAuth(handler)
```

**Result**:
- Route now accepts Supabase session from cookies
- No x-api-key header required
- Dashboard API calls work

### Step 3: Update Dashboard Hooks

**Files to Modify** (2 hooks):
- `hooks/useUsage.ts`
- `hooks/useMetrics.ts`

**Current Pattern**:
```typescript
const credential = getUserCredential() // Returns null for Supabase users
const client = new ApiClient(credential)
const data = await client.get('/api/billing/status')
```

**New Pattern**:
```typescript
// No credential needed - browser sends cookies automatically
const response = await fetch('/api/billing/status')
const data = await response.json()
```

**Alternative Pattern** (more elegant):
```typescript
// Create ApiClient without credential (for dashboard)
const client = new ApiClient() // No API key needed
const data = await client.get('/api/billing/status')
```

**Result**:
- Hooks don't need to look for API key
- Requests automatically include Supabase session cookies
- Dashboard API calls succeed

### Step 4: Keep External API Routes Unchanged

**No Changes Needed** for routes using x-api-key:
- `/api/search`
- `/api/jobs`
- `/api/admin/**`

These continue using existing `withAuth()` middleware.

---

## API ROUTE CLASSIFICATION

### Internal Dashboard APIs (Switch to withDashboardAuth)

| Route | Purpose | Current Auth | New Auth |
|-------|---------|--------------|----------|
| GET /api/billing/status | Fetch usage quota | withAuth | **withDashboardAuth** |
| GET /api/metrics | Fetch job metrics | withAuth | **withDashboardAuth** |
| GET /api/usage | Fetch usage details | withAuth | **withDashboardAuth** |

**Caller**: Dashboard hooks (useUsage, useMetrics)  
**Authentication**: Supabase session in cookies  
**Credential**: None - browser sends cookies automatically

### External Developer APIs (Keep withAuth)

| Route | Purpose | Auth |
|-------|---------|------|
| POST /api/search | Perform search | withAuth (x-api-key) |
| POST /api/jobs | Create job | withAuth (x-api-key) |
| GET /api/job/[id] | Get job details | withAuth (x-api-key) |
| GET /api/job/[id]/result | Get results | withAuth (x-api-key) |
| POST /api/job/[id]/status | Check status | withAuth (x-api-key) |
| GET /api/admin/** | Admin operations | withAuth (x-api-key) |

**Caller**: External developers, admin tools  
**Authentication**: x-api-key header  
**Credential**: API key from header

---

## EXACT FILES THAT WOULD CHANGE

### New Files (1)

1. **`lib/auth/middleware-dashboard.ts`** (CREATE)
   - Dashboard authentication middleware
   - Uses Supabase session validation
   - ~40-50 lines

### Modified Files (5)

2. **`lib/auth/middleware.ts`** (MODIFY)
   - Keep existing `withAuth()` for external APIs
   - Add comment explaining this is for external APIs only
   - Export for use in external API routes
   - ~1 line change (comment)

3. **`hooks/useUsage.ts`** (MODIFY)
   - Remove `getUserCredential()` call
   - Make direct fetch to `/api/billing/status`
   - Use `withDashboardAuth` auth (or simpler: just fetch with cookies)
   - ~5 lines change

4. **`hooks/useMetrics.ts`** (MODIFY)
   - Remove `getUserCredential()` call
   - Make direct fetch to `/api/metrics`
   - ~5 lines change

5. **`app/api/billing/status/route.ts`** (MODIFY)
   - Change `withAuth` to `withDashboardAuth`
   - ~1 line change

6. **`app/api/metrics/route.ts`** (MODIFY)
   - Change `withAuth` to `withDashboardAuth`
   - ~1 line change

### Total Impact

- **1 new file** (~45 lines)
- **5 files modified** (~15 lines total changed)
- **No changes** to external API routes
- **No changes** to middleware.ts (root level - already correct)
- **No changes** to core Supabase auth setup

---

## MIGRATION RISKS

### Risk 1: Breaking External API Compatibility (LOW)

**Issue**: Changing internal routes should not affect external APIs  
**Mitigation**: Carefully separate internal vs external in different middleware  
**Contingency**: Keep original `withAuth` untouched for external APIs

**Risk Level**: LOW - internal routes are dashboard-only, external routes untouched

---

### Risk 2: Session Cookie Handling (LOW)

**Issue**: Supabase session cookies might not be sent to same-origin API routes  
**Mitigation**: Supabase client already handles this with `credentials: 'include'`  
**Verification**: Browser should automatically send httpOnly cookies to same-origin requests

**Risk Level**: LOW - httpOnly cookies are automatically included by browser for same-origin

---

### Risk 3: CORS Issues (VERY LOW)

**Issue**: Same-origin requests shouldn't have CORS issues  
**Mitigation**: All routes are on same origin (same domain)

**Risk Level**: VERY LOW - not applicable for same-origin requests

---

### Risk 4: User Object Mismatch (LOW)

**Issue**: Dashboard auth middleware creates different user object than withAuth  
**Mitigation**: Both attach `request.user` with `{ id, email }`  
**Verification**: Ensure both return same interface

**Risk Level**: LOW - can standardize interface

---

## TESTING PLAN

### Pre-Implementation Checklist

- [ ] Confirm Supabase sessions work correctly (Phase 2A verified ✓)
- [ ] Confirm httpOnly cookies are set after login
- [ ] Confirm middleware.ts (root) correctly validates Supabase sessions

### Phase 1: New Middleware Testing

- [ ] Create `lib/auth/middleware-dashboard.ts`
- [ ] Write unit test: Session extraction works
- [ ] Write unit test: Missing session returns 401
- [ ] Write unit test: User object attached to request

### Phase 2: Route Testing

- [ ] Update `/api/billing/status` route to use new middleware
- [ ] Test in development: Dashboard useUsage() works
- [ ] Test in development: API call includes session
- [ ] Test error case: No session returns 401

- [ ] Update `/api/metrics` route to use new middleware
- [ ] Test in development: Dashboard useMetrics() works
- [ ] Test in development: Metrics load successfully

### Phase 3: Hook Testing

- [ ] Update useUsage() hook
- [ ] Test in dashboard: Usage data loads
- [ ] Test in dashboard: No 401 errors

- [ ] Update useMetrics() hook
- [ ] Test in dashboard: Metrics data loads
- [ ] Test in dashboard: No 401 errors

### Phase 4: External API Testing

- [ ] Verify `/api/search` still works (unchanged)
- [ ] Verify `/api/jobs` still works (unchanged)
- [ ] Verify `/api/admin/**` still works (unchanged)

**Test with**: API key header, external client

### Phase 5: Full Integration Testing

- [ ] User signs up with Supabase
- [ ] User logs in
- [ ] Dashboard loads
- [ ] Dashboard API calls work (useUsage, useMetrics)
- [ ] No 401 errors in console
- [ ] External APIs still accept API keys

### Phase 6: Production Readiness

- [ ] No console errors
- [ ] Performance: New middleware doesn't slow requests
- [ ] Security: No credential leaks
- [ ] No breaking changes to external API contract

---

## SUCCESS CRITERIA

✓ Dashboard API calls succeed with 200 responses (not 401)  
✓ Dashboard hooks receive data correctly  
✓ External developer APIs continue working  
✓ No 401 errors in console when logged in with Supabase  
✓ Supabase sessions properly validated  
✓ API key authentication still works for external APIs  

---

## SUMMARY

### Current Problem
- Dashboard logs in via Supabase ✓
- But API calls fail with 401 ✗
- Cause: Wrong auth middleware used for internal APIs

### Recommended Solution
- Create `withDashboardAuth()` for internal dashboard APIs
- Update 3 internal routes to use it
- Update 2 hooks to not require credentials
- Keep 14 external routes using `withAuth()` unchanged

### Expected Outcome
- Dashboard API calls work
- External developer APIs continue working
- Clean separation of concerns
- Ready for future provider integrations

### Effort & Risk
- **Effort**: 2-3 hours
- **Lines Changed**: ~65 lines across 6 files
- **Risk**: LOW - isolated changes, external APIs untouched
- **Testing**: Medium - need to verify both auth paths

---

## NO CODE CHANGES MADE

This is a READ-ONLY investigation. 

**Next Steps**:
1. Review this report
2. Confirm root cause analysis
3. Approve migration approach
4. Approve testing plan
5. Proceed with Phase 1 implementation
