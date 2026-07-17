# Phase 1 Implementation Summary

## Files to Modify

### 1. CREATE: `lib/auth/middleware-dashboard.ts` (~80 lines)
- New middleware for dashboard Supabase session authentication
- Extracts session from httpOnly cookies
- Returns 401 if no session
- Attaches user info to request

### 2. MODIFY: `/app/api/billing/status/route.ts` (2 lines)
```diff
- import { withAuth } from '@/lib/auth/middleware'
+ import { withDashboardAuth } from '@/lib/auth/middleware-dashboard'

- export const GET = withAuth(handler)
+ export const GET = withDashboardAuth(handler)
```

### 3. MODIFY: `/app/api/metrics/route.ts` (~50 lines)
```diff
+ import { withDashboardAuth } from '@/lib/auth/middleware-dashboard'
+ import { DashboardAuthRequest } from '@/lib/auth/middleware-dashboard'
+ 
- export async function GET(request: NextRequest) {
+ async function handler(request: DashboardAuthRequest) {
    // ... existing implementation

- export async function OPTIONS(request: NextRequest) {
+ async function optionsHandler(request: DashboardAuthRequest) {
    // ... existing implementation
+
+ export const GET = withDashboardAuth(handler)
+ export const OPTIONS = withDashboardAuth(optionsHandler)
```

### 4. MODIFY: `hooks/useUsage.ts` (~25 lines)
```diff
- import { ApiClient, ApiError } from '@/lib/api/client'
- import { getUserCredential } from '@/lib/auth/storage'

  useEffect(() => {
    async function fetchUsage() {
      try {
-       const credential = getUserCredential() ?? undefined
-       const client = new ApiClient(credential)
-       const data = await client.get<Usage>('/api/billing/status')
+       const response = await fetch('/api/billing/status', {
+         credentials: 'include',
+       })
+       if (!response.ok) throw new Error(`${response.status}`)
+       const data = await response.json()
```

### 5. MODIFY: `hooks/useMetrics.ts` (~25 lines)
```diff
- import { ApiClient, ApiError } from '@/lib/api/client'
- import { getUserCredential } from '@/lib/auth/storage'

  useEffect(() => {
    async function fetchMetrics() {
      try {
-       const credential = getUserCredential() ?? undefined
-       const client = new ApiClient(credential)
-       const data = await client.get<Metrics>('/api/metrics')
+       const response = await fetch('/api/metrics', {
+         credentials: 'include',
+       })
+       if (!response.ok) throw new Error(`${response.status}`)
+       const data = await response.json()
```

## What This Achieves

✓ Dashboard APIs use Supabase sessions (secure, automatic cookies)  
✓ External APIs still use x-api-key (unchanged, unaffected)  
✓ No database migrations needed  
✓ No environment variable changes needed  
✓ Zero breaking changes to external APIs  
✓ Clean separation of concerns  

## What Stays the Same

✓ External API authentication (withAuth, x-api-key)  
✓ Stripe billing integration  
✓ Job queue system  
✓ All external routes  
✓ Rate limiting logic  
✓ User billing logic  

## Risk Assessment

| Risk | Probability | Severity | Mitigation |
|------|-------------|----------|-----------|
| Session not sent | VERY LOW | HIGH | credentials: 'include' ensures cookies sent |
| API breaks | ZERO | HIGH | Only internal APIs change, external isolated |
| Error handling | LOW | LOW | Simpler, more transparent error contract |
| Type safety | LOW | MEDIUM | TypeScript ensures user object exists |

## Testing Requirements

1. Dashboard loads after login (useUsage, useMetrics work)
2. /api/billing/status returns 200 with session, 401 without
3. /api/metrics returns 200 with session
4. External APIs still accept x-api-key
5. No console errors

## Deployment

- No downtime required
- No database changes
- Can rollback instantly (6 file revert)
- Staging → Production is straightforward

## Approval

Please review `PHASE_1_IMPLEMENTATION_PLAN.md` for full details, then confirm:
- Ready to proceed with implementation
- Testing plan is acceptable
- Risk assessment is acceptable
