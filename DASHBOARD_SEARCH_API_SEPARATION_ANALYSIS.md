# Dashboard Search API Separation - READ-ONLY ANALYSIS

**Status**: ANALYSIS COMPLETE - AWAITING APPROVAL  
**Issue**: Dashboard search calls external API (x-api-key auth) instead of internal dashboard API  
**Solution**: Create `/api/dashboard/search` with Supabase session auth, keep `/api/search` unchanged

---

## CURRENT PROBLEMATIC FLOW

### Dashboard Search Page
**File**: `/app/dashboard/search/page.tsx` (lines 124-140)

```typescript
const credential = getUserCredential() ?? undefined;  // Returns null - no API key stored
const client = new ApiClient(credential);              // Creates client with no credential

const result = await client.post<SearchResponse>(
  '/api/search',                                        // Calls EXTERNAL API
  searchPayload
);
```

**Problem**: 
- Dashboard gets no API key from `getUserCredential()` (returns null)
- Calls `/api/search` which uses `withAuth()` middleware (x-api-key required)
- Request fails with 401 because no x-api-key header sent

### External Search API
**File**: `/app/api/search/route.ts`

```typescript
export const POST = withAuth(withRateLimit(withBilling(handler)));
```

**Current State**: 
- Requires x-api-key header (designed for external developers)
- Works correctly for external API calls
- Also wrapped with rate limiting and billing middleware

---

## ARCHITECTURE PROBLEM

### Current (Broken)
```
Dashboard Search UI
  ↓
dashboard/search/page.tsx (getUserCredential() → null)
  ↓
ApiClient with no credential
  ↓
POST /api/search with no x-api-key
  ↓
withAuth() checks header → 401 ✗
```

### Required (Proper Separation)
```
Dashboard Search UI
  ↓
dashboard/search/page.tsx (use native fetch)
  ↓
fetch() with credentials: 'include'
  ↓
POST /api/dashboard/search (NEW) with Supabase session
  ↓
withDashboardAuth() validates session → 200 ✓

External Developer
  ↓
curl -H "x-api-key: sk_live_xxx"
  ↓
POST /api/search with x-api-key
  ↓
withAuth() validates key → 200 ✓
```

---

## FILES TO CREATE

### 1. `/app/api/dashboard/search/route.ts` (NEW)

**Purpose**: Internal dashboard search API authenticated with Supabase sessions

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withDashboardAuth, DashboardAuthRequest } from '@/lib/auth/middleware-dashboard';
import {
  performSearch,
  performAdvancedSearch,
  validateSearchRequest,
  validateAdvancedSearchRequest,
} from '@/lib/search/search-service';
import { googleConfig } from '@/lib/config/google';

async function handler(request: DashboardAuthRequest): Promise<NextResponse> {
  try {
    // User authentication is already validated by withDashboardAuth
    const user = (request as DashboardAuthRequest).user;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Google configuration
    if (!googleConfig.isConfigured()) {
      return NextResponse.json(
        { error: 'Search provider not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { query, pages = 1, keywords, patterns, location, searchDepth = 1, delayMs = 200 } = body;

    let result;

    // Determine search mode
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // Advanced mode
      const validationError = validateAdvancedSearchRequest(keywords, patterns, location, searchDepth, delayMs);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
      result = await performAdvancedSearch(keywords, location, patterns, searchDepth, delayMs);
    } else {
      // Simple mode
      const validationError = validateSearchRequest(query, pages);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
      result = await performSearch(query, pages);
    }

    console.log('[Dashboard Search] User:', user.id, 'Jobs queued:', result.totalQueued);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Dashboard Search] Error:', message);

    if (message.includes('quota')) {
      return NextResponse.json(
        { error: 'Search provider quota exceeded' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

export const POST = withDashboardAuth(handler);

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({
    methods: ['POST'],
    description: 'Dashboard Search API - Internal use only',
    authentication: 'Supabase session (httpOnly cookies)',
    modes: {
      simple: {
        body: { query: 'string', pages: 'number (1-5)' }
      },
      advanced: {
        body: {
          keywords: 'string[]',
          location: 'string?',
          patterns: 'string[]?',
          searchDepth: 'number (1-5)',
          delayMs: 'number (100-2000)'
        }
      }
    }
  }, { status: 200 });
}
```

**Size**: ~100 lines  
**Reuses**: All search service logic, google client, queue  
**Auth**: Dashboard Supabase session via `withDashboardAuth`

---

## FILES TO MODIFY

### 1. `/app/dashboard/search/page.tsx` (MODIFY)

**Current** (lines 124-140):
```typescript
const credential = getUserCredential() ?? undefined;
const client = new ApiClient(credential);

const result = await client.post<SearchResponse>(
  '/api/search',
  searchPayload
);
```

**Changed To**:
```typescript
// Use native fetch with automatic cookie handling
const response = await fetch('/api/dashboard/search', {
  method: 'POST',
  credentials: 'include', // Send httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(searchPayload),
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || `HTTP ${response.status}`);
}

const result = await response.json();
```

**Changes**:
- Remove `ApiClient` usage
- Remove `getUserCredential()` call
- Use native `fetch()` with `/api/dashboard/search`
- Add `credentials: 'include'` to send cookies
- Same error handling pattern as useUsage hook

**Imports to Remove**:
- `import { ApiClient, ApiError } from '@/lib/api/client'`
- `import { getUserCredential } from '@/lib/auth/storage'`

**Lines Changed**: ~15 lines in handleSubmit()

### 2. `/app/api/search/route.ts` (NO CHANGE NEEDED)

**Status**: UNCHANGED ✓

**Reason**: External API should continue using x-api-key authentication. No modifications required.

---

## DATA FLOW AFTER CHANGES

### Dashboard User Starts Search
```
1. User enters search query on /dashboard/search
2. Click submit
3. handleSubmit() called
4. Create searchPayload
5. fetch('/api/dashboard/search', {
     method: 'POST',
     credentials: 'include',
     body: JSON.stringify(searchPayload)
   })
6. Browser automatically includes httpOnly cookies
7. Request sent to /api/dashboard/search
```

### Server Validates & Processes
```
1. POST /api/dashboard/search received
2. withDashboardAuth() middleware:
   - Extract session from cookies
   - Validate session exists and is valid
   - Attach user to request
   - Call handler()
3. handler():
   - Receive DashboardAuthRequest with user
   - Parse body (same as before)
   - Call performSearch() or performAdvancedSearch()
   - Reuse existing search service logic
   - Return results
4. Response sent to client
5. Client displays results
```

### External Developer Calls API (Unchanged)
```
1. curl -X POST https://api.nastech.com/api/search \
     -H "x-api-key: sk_live_xxx" \
     -d '{"query": "..."}'
2. POST /api/search received
3. withAuth() middleware validates x-api-key
4. withRateLimit() checks rate limit
5. withBilling() tracks usage
6. handler() processes search
7. Results returned
```

---

## FILES NOT MODIFIED

| File | Reason |
|------|--------|
| `/app/api/search/route.ts` | External API - keep unchanged with x-api-key auth |
| `/lib/search/search-service.ts` | Reused by both APIs - no changes needed |
| `/lib/search/google-client.ts` | Reused by both APIs - no changes needed |
| `/lib/config/google.ts` | Reused by both APIs - no changes needed |
| `/lib/auth/middleware.ts` | Original API key auth - keep unchanged |

---

## TESTING PLAN

### Test 1: Dashboard Search Works with Session
**Setup**:
1. Register new user
2. Login (creates Supabase session in httpOnly cookies)
3. Navigate to `/dashboard/search`
4. Enter "tech startups san francisco"
5. Click "Quick Search"

**Expected**:
- Request sent to `/api/dashboard/search` (not `/api/search`)
- Supabase session validated by `withDashboardAuth`
- Search executes successfully
- Results display on page
- No 401 errors ✓

### Test 2: Dashboard API Requires Session
**Setup**: Use curl without authentication

```bash
curl -X POST http://localhost:3000/api/dashboard/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

**Expected**: 401 Unauthorized - session required ✓

### Test 3: External API Still Works with x-api-key
**Setup**: Use curl with x-api-key (existing behavior)

```bash
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_123" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

**Expected**: 200 OK with search results (unchanged) ✓

### Test 4: Dashboard API Rejects x-api-key
**Setup**:

```bash
curl -X POST http://localhost:3000/api/dashboard/search \
  -H "x-api-key: sk_test_123" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

**Expected**: 401 Unauthorized - session required ✓

### Test 5: Advanced Search Works
**Setup**: Dashboard user performs advanced search

**Expected**:
- Multi-keyword search processes correctly
- Advanced search sent to `/api/dashboard/search`
- All keywords processed
- Jobs queued for all keywords
- Results display correctly ✓

### Test 6: Search Service Logic Unchanged
**Expected**:
- Same search results from `/api/dashboard/search` as `/api/search`
- Identical job queueing logic
- Same email extraction behavior
- No performance difference ✓

---

## EXACT CHANGES SUMMARY

| File | Type | Changes | Lines |
|------|------|---------|-------|
| `/app/api/dashboard/search/route.ts` | CREATE | New dashboard search API with Supabase auth | ~120 |
| `/app/dashboard/search/page.tsx` | MODIFY | Switch to native fetch, remove ApiClient | ~15 |

**Total**: 1 new file, 1 modified file, ~135 lines changed

**External APIs**: NO CHANGES ✓  
**Search Service**: NO CHANGES ✓  
**Backward Compatibility**: MAINTAINED ✓

---

## IMPLEMENTATION READINESS

✓ Dashboard auth middleware created (Phase 1)  
✓ Pattern established for Supabase session auth  
✓ External API separation proven (x-api-key works)  
✓ Native fetch pattern working (useUsage, useMetrics)  
✓ Search service stable and reusable  

**Ready to implement**: YES  
**Risk Level**: LOW  
**Testing Complexity**: MEDIUM  

---

## BEFORE/AFTER COMPARISON

### BEFORE
```
Dashboard → ApiClient(null) → /api/search (x-api-key) → 401 ✗
External   → ApiClient(key)  → /api/search (x-api-key) → 200 ✓
```

### AFTER
```
Dashboard → fetch + cookies  → /api/dashboard/search (session) → 200 ✓
External  → curl + x-api-key → /api/search (x-api-key)        → 200 ✓
```

---

## APPROVAL CHECKLIST

- [ ] Approach approved (create dashboard API vs modify existing)
- [ ] Authentication method approved (Supabase session for dashboard)
- [ ] File structure approved (route location: `/api/dashboard/search`)
- [ ] Client update approved (use native fetch instead of ApiClient)
- [ ] No changes to external API approved
- [ ] No changes to search service approved
- [ ] Testing plan approved

---

## READY FOR IMPLEMENTATION

All analysis complete. Awaiting approval to proceed with creating `/api/dashboard/search` and updating dashboard search page.

