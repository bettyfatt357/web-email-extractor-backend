# API Authentication Issue Investigation Report

**Status**: READ-ONLY INVESTIGATION COMPLETE  
**Finding**: Authentication Mismatch Between Supabase Auth and API Credential System  
**Severity**: CRITICAL - Dashboard breaks after successful Supabase login

---

## A. CURRENT DATA FLOW

### User Login Flow
```
1. User navigates to /login
2. useAuth.handleSignIn() calls authApi.signIn(email, password)
3. Supabase authentication succeeds
4. Supabase returns: { user, session }
5. useAuth sets user state and router.refresh() syncs with server
6. User redirected to /dashboard (middleware allows access - session validated)
7. Dashboard renders successfully ✓
```

### Dashboard Data Fetching Flow
```
1. Dashboard renders with useUsage() and useMetrics() hooks
2. useUsage() calls: getUserCredential() from localStorage
3. getUserCredential() returns: null (NO API KEY IN STORAGE)
4. useUsage() creates ApiClient with undefined credential
5. ApiClient.get('/api/billing/status') sends request with NO x-api-key header
6. /api/billing/status route uses withAuth() middleware
7. withAuth() looks for x-api-key header
8. No x-api-key found AND ALLOW_ANONYMOUS !== 'true'
9. Returns: 401 Unauthorized - "API key required"
10. Dashboard shows error in console ✗
```

### Parallel: Metrics Fetching
```
Same issue:
1. useMetrics() calls getUserCredential() → null
2. ApiClient sends request without x-api-key
3. /api/metrics GET route (no authentication required - just accesses Redis)
4. But ApiClient still sends empty x-api-key header
5. Works because /api/metrics has no withAuth() middleware
6. Returns metrics successfully ✓
```

---

## B. ROOT CAUSE - AUTHENTICATION SYSTEM MISMATCH

### The Problem

**Two incompatible authentication systems are running in parallel:**

**System 1: Supabase Authentication** (Server-side, Session-based)
- User logs in with email/password
- Supabase validates credentials
- Session created in httpOnly cookies
- Middleware validates session before allowing dashboard access
- User object available on request via Supabase session
- Works correctly ✓

**System 2: API Credential System** (Client-side, API-key-based)
- APIs expect x-api-key header
- Credentials stored in localStorage
- No API key exists after Supabase authentication
- Dashboard immediately tries to fetch data
- API calls fail with 401 ✗

### Why This Is Happening

**Phase 2A (Supabase Auth Implementation)**:
- Added Supabase authentication for user login
- Sessions stored in httpOnly cookies
- Middleware validates Supabase sessions
- Users successfully authenticate ✓

**Pre-existing API System**:
- Dashboard components use useUsage() and useMetrics()
- These hooks call getUserCredential() looking for API keys
- API keys never created during login flow
- APIs guarded by withAuth() expecting x-api-key header
- 401 error when API key missing ✗

**No Integration Between Systems**:
- Supabase session NOT converted to API credential
- API routes still demand x-api-key, not Supabase session
- Two separate auth systems with no bridge

---

## C. RECOMMENDED FIX OPTIONS

### Option A: Migrate APIs to Use Supabase Session (RECOMMENDED)

**Architecture**: Use Supabase session for API authentication  
**Pros**: Single auth system, clean architecture, no API keys needed  
**Cons**: Requires updating all API routes and auth middleware  
**Effort**: 6-8 hours

**What Changes**:
1. Create Supabase-based authentication middleware (instead of API key)
2. API routes extract Supabase session from cookies
3. Remove dependency on x-api-key header
4. useUsage() and useMetrics() don't need credentials
5. Billing/usage APIs authenticate via Supabase session

**Flow After**:
```
User logs in
→ Supabase session in cookies
→ Dashboard renders
→ useUsage() calls /api/billing/status (no credential needed)
→ API middleware extracts Supabase session
→ Validates user is authenticated
→ Returns usage data ✓
```

**Files That Need Changes**:
- `lib/auth/middleware.ts` - Replace API key auth with Supabase session auth
- `app/api/billing/status/route.ts` - Use new Supabase middleware
- `app/api/metrics/route.ts` - Use new Supabase middleware
- All other API routes in `/app/api/**` using withAuth()
- `hooks/useUsage.ts` - Remove credential requirement
- `hooks/useMetrics.ts` - Remove credential requirement
- `lib/api/client.ts` - Remove credential from headers

---

### Option B: Keep API Key System, Show "Create API Key First"

**Architecture**: Keep existing API key system, improve UX  
**Pros**: Minimal code changes, leverages existing infrastructure  
**Cons**: Users must create API key before accessing dashboard  
**Effort**: 2-3 hours

**What Changes**:
1. After login, redirect to /dashboard/api-keys instead of /dashboard
2. Show instructions to create first API key
3. Store returned API key in localStorage
4. Redirect to dashboard
5. Dashboard data now loads with API key

**Flow After**:
```
User logs in
→ Redirect to /dashboard/api-keys (new logic in login)
→ User creates first API key
→ Key stored in localStorage via setUserCredential()
→ Redirect to /dashboard
→ useUsage() finds key in localStorage
→ API calls work ✓
```

**Files That Need Changes**:
- `app/(auth)/login/page.tsx` - Add redirect to API keys page
- `/app/dashboard/page.tsx` - Add early return if no API key
- `/app/dashboard/api-keys/page.tsx` - Add "Create first key" flow
- UX components - Add onboarding messaging

---

### Option C: Hybrid - Migrate Gradually

**Architecture**: Use Supabase for dashboard APIs, keep API key system for external API access  
**Pros**: Incremental migration, works immediately  
**Cons**: Two systems for longer  
**Effort**: 4-5 hours

**What Changes**:
1. Create new Supabase-based middleware for internal dashboard APIs
2. Dashboard uses Supabase session for /api/billing/*, /api/metrics, etc.
3. External API routes (job creation, etc.) keep API key system for now
4. Eventually sunset API key requirement for internal APIs

**Flow After**:
```
User logs in
→ Supabase session in cookies
→ Dashboard APIs: /api/billing/*, /api/metrics use Supabase auth ✓
→ External APIs: /api/search, /api/jobs still use x-api-key
→ Both work correctly
```

---

## D. EXACT FILES NEEDING CHANGES FOR OPTION A (RECOMMENDED)

### Create/Modify - Supabase Authentication Middleware

**File**: `lib/auth/middleware-supabase.ts` (CREATE NEW)
- New middleware function: `withSupabaseAuth(handler)`
- Extracts Supabase session from cookies
- Validates user is authenticated
- Attaches user ID to request for logging/tracking
- Returns 401 if session invalid/missing

### Modify - All API Routes Using withAuth()

**Files Affected**: 14 API routes
```
/app/api/billing/status/route.ts
/app/api/billing/webhook/route.ts
/app/api/metrics/route.ts
/app/api/jobs/route.ts
/app/api/jobs-paginated/route.ts
/app/api/job/[id]/route.ts
/app/api/job/[id]/status/route.ts
/app/api/job/[id]/result/route.ts
/app/api/search/route.ts
/app/api/admin/dashboard/route.ts
/app/api/admin/jobs/route.ts
/app/api/admin/queue/health/route.ts
/app/api/admin/users/route.ts
/app/api/health/supabase/route.ts
```

**Change**: Replace `withAuth()` with `withSupabaseAuth()`

### Modify - Remove Credential from Client Hooks

**Files**:
- `hooks/useUsage.ts` - Remove `getUserCredential()` call, remove ApiClient credential
- `hooks/useMetrics.ts` - Remove `getUserCredential()` call, remove ApiClient credential
- `hooks/useAuth.ts` - No changes (Supabase auth is correct)

### Modify - Simplify API Client

**File**: `lib/api/client.ts`
- Remove credential parameter from constructor
- Remove x-api-key header attachment
- Rely on cookies for Supabase session auth

### Keep Unchanged - Credential Storage (for backward compatibility)

**Files**: 
- `lib/auth/storage.ts` - Keep for future API key management
- API key management pages can still work

---

## E. EXPECTED BEHAVIOR AFTER IMPLEMENTATION

### Scenario 1: New User Signs Up
```
1. Register page → Create account
2. Email verification → Verify email via callback
3. Redirect to /dashboard (Supabase session in cookies)
4. Dashboard loads
5. useUsage() calls /api/billing/status
6. API validates Supabase session from cookie
7. Returns usage data (quota_used: 0, quota_limit: 100)
8. Dashboard renders successfully ✓
9. No 401 errors
```

### Scenario 2: User Logs In
```
1. Login page → Enter credentials
2. Supabase authenticates
3. Session created in httpOnly cookie
4. Redirect to /dashboard
5. Dashboard loads
6. useUsage() calls /api/billing/status
7. API validates Supabase session from cookie
8. Returns usage data
9. Dashboard renders successfully ✓
9. No 401 errors
```

---

## F. RISK ASSESSMENT FOR OPTION A

### Risk 1: Breaking External API Access
**Probability**: HIGH  
**Impact**: Users can't access APIs outside browser  
**Mitigation**: Plan separate auth system for external API access (API keys) or add server-to-server auth

### Risk 2: Session Validation Performance
**Probability**: LOW  
**Impact**: API responses slow down  
**Mitigation**: Supabase session validation is fast; middleware runs before business logic

### Risk 3: CORS Issues with Credential Cookies
**Probability**: LOW  
**Impact**: Cross-origin requests fail  
**Mitigation**: Configure CORS properly for httpOnly cookies in production

### Risk 4: Incomplete Session Validation
**Probability**: MEDIUM  
**Impact**: Unauthenticated users get access to APIs  
**Mitigation**: Test all auth scenarios thoroughly before deploy

---

## G. RECOMMENDED IMPLEMENTATION APPROACH

**Option A - Migrate to Supabase Session**

**Reasoning**:
- Phase 2A already implemented Supabase auth correctly
- Natural extension: use same Supabase session for APIs
- Eliminates API key requirement for dashboard features
- Cleaner architecture - single auth system
- Better security - no API keys in localStorage
- Aligns with production best practices

**Implementation Order**:
1. Create `lib/auth/middleware-supabase.ts` with Supabase session validation
2. Update API routes one at a time (billing, metrics, then others)
3. Remove credential requirement from useUsage and useMetrics
4. Test each API route after changes
5. Deploy to production

**Timeline**: 6-8 hours

---

## NO CODE CHANGES MADE

This investigation is READ-ONLY. No implementation started.

**Next Steps**:
1. Choose between Option A, B, or C
2. Review recommended files to change
3. Provide approval to proceed with implementation

