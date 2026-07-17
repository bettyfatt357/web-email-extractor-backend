# AUTHENTICATION ARCHITECTURE REVIEW

**Status**: CRITICAL ISSUES IDENTIFIED  
**Scope**: Complete auth flow analysis for Supabase SSR + Next.js 16 App Router  
**Date**: July 16, 2026

---

## EXECUTIVE SUMMARY

The authentication system has **7 critical root causes** preventing proper registration/login completion and session synchronization:

1. **Missing Router Refresh After Auth State Changes** - UI updates but routes don't re-evaluate
2. **Race Condition: Client useAuth vs Server Middleware** - Cookie lag causes stale redirects
3. **onAuthStateChange Callback Never Updates Redirected State** - Auth listener fires AFTER redirect
4. **No Router Refresh After signUp/signIn** - Middleware doesn't see new session
5. **Dashboard Layout Renders Before Auth Completes** - Null user renders null, no auth check UI
6. **useAuth Hook Never Updates Redirect State** - signIn/signUp don't trigger user state update
7. **Navbar and Dashboard Read Different Auth Sources** - Navbar checks isLoading, dashboard checks user directly

These issues create the observed behavior:
- Registration succeeds silently (no success message, no redirect)
- Login succeeds silently (HTTP 200 but stays on /login)
- Navbar shows auth state inconsistently
- Dashboard redirects back to /login even when user should be authenticated
- "Get Started" sometimes logs into existing accounts (old session leak)

---

## 1. AUTHENTICATION ARCHITECTURE OVERVIEW

### Current Architecture

```
Browser → useAuth Hook (CSR)
          ├─ getUser() via client.ts
          ├─ onAuthStateChange subscription
          └─ State: [user, isLoading, error]

         ↓

    signUp/signIn/signOut
         ↓

   lib/supabase/auth.ts
   (wrapper around Supabase SDK)
         ↓

   getSupabaseClient()
   (browser client with cookies)
         ↓

  Supabase Auth API
   (creates session, sets httpOnly cookie)
         ↓

   Return to useAuth
   (BUT user state not updated)
         ↓

  Component renders
  (Still shows logged out state)
         ↓

Server Middleware (middleware.ts)
├─ Runs on EVERY request
├─ Checks session via createSupabaseMiddlewareClient()
├─ Reads httpOnly cookie from request headers
├─ Redirects if unauthorized
└─ BUT client-side useAuth is out of sync
```

### The Problem

Two separate auth sources:
- **Server**: middleware.ts checks cookies from request headers
- **Client**: useAuth hook checks Supabase client session

They don't always agree on current state.

---

## 2. REGISTRATION FLOW REVIEW

### Current Flow

```
User fills form → clicks "Create Account"
         ↓
handleSubmit() runs
         ↓
setIsSubmitting(true)
         ↓
await signUp(email, password) [lib/supabase/auth.ts]
         ↓
supabase.auth.signUp() called
         ↓
Supabase creates user
         ↓
Returns { data: { user, session }, error: null }
         ↓
setIsSubmitting(false)
         ↓
handleSignUp() completes
         ↓
... NOTHING HAPPENS
         ↓
User still sees form
```

### Why Registration Fails

**Issue #1: signUp() does NOT update user state**

In `hooks/use-auth.ts` line 115:
```typescript
const handleSignUp = async (email: string, password: string) => {
  setError(null)
  setIsLoading(true)

  const { error } = await authApi.signUp(email, password)  // ← Only checks for error

  if (error) {
    setError(error)
  }

  setIsLoading(false)  // ← Sets loading to false
  // ← MISSING: Does NOT update user state
}
```

**After signUp succeeds**, the hook's user state is still `null` because:
- `authApi.signUp()` returns only `{ error }`
- The hook never calls `getUser()` to refresh user state
- So `user` remains `null` in component state

**Issue #2: Registration page redirect depends on user state**

In `app/(auth)/register/page.tsx` lines 25-29:
```typescript
useEffect(() => {
  if (!isLoading && user) {
    router.push('/dashboard')  // ← Only redirects if user !== null
  }
}, [user, isLoading, router])
```

Since user is still `null`, redirect never fires.

**Issue #3: onAuthStateChange callback never fires for signUp**

In `hooks/use-auth.ts` lines 48-56:
```typescript
useEffect(() => {
  const loadSession = async () => {
    setIsLoading(true)
    const { data, error } = await authApi.getUser()
    // ...
  }

  loadSession()

  const subscription = authApi.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)  // ← Only fires if subscription triggers
  })
})
```

The `onAuthStateChange` listener is set up on mount, but:
- It fires AFTER the component already checked redirect logic
- First `getUser()` call (on mount) runs before user registers
- onAuthStateChange fires after registration but redirect already evaluated
- Component is not re-rendered in response to the subscription update

**Root Cause**: No mechanism to wait for or react to the session that was just created.

### What Should Happen

After `signUp()` succeeds, the hook should:
1. Detect that Supabase created a session
2. Update local `user` state from that session
3. Trigger redirect to /dashboard

---

## 3. LOGIN FLOW REVIEW

### Current Flow

```
User fills form → clicks "Sign In"
         ↓
handleSubmit() runs
         ↓
setIsSubmitting(true)
         ↓
await signIn(email, password)
         ↓
supabase.auth.signInWithPassword()
         ↓
Supabase authenticates user
         ↓
Returns { data: { user, session }, error: null }
         ↓
setIsSubmitting(false)
         ↓
handleSignIn() completes
         ↓
... NOTHING HAPPENS
         ↓
User still sees login form, HTTP 200
```

### Why Login Fails

**Same Issue as Registration**: `handleSignIn` doesn't update user state

In `hooks/use-auth.ts` line 100:
```typescript
const handleSignIn = async (email: string, password: string) => {
  setError(null)
  setIsLoading(true)

  const { error } = await authApi.signIn(email, password)  // ← Only checks error

  if (error) {
    setError(error)
  }

  setIsLoading(false)  // ← user state NEVER updated
}
```

The hook ignores the session returned by Supabase and never updates `user`.

### The Problem Chain

1. Login succeeds (Supabase creates session, sets httpOnly cookie)
2. BUT hook's `user` state remains `null`
3. Redirect check: `if (!isLoading && user)` → fails because user is null
4. Component keeps showing login form
5. User presses F5 or navigates away
6. Middleware sees httpOnly cookie
7. Middleware sees valid session
8. Middleware allows access to dashboard
9. Dashboard layout checks `useAuth().user`
10. useAuth re-mounts, calls `getUser()`
11. NOW getUser() returns the actual user (from cookie)
12. Dashboard renders with user email

**Why the second time works**: Because `getUser()` on line 48 is called on mount, and by then the httpOnly cookie has been set by Supabase. The first time, the component redirects before that happens.

---

## 4. SESSION PERSISTENCE REVIEW

### Current Cookie Handling

1. User registers/logs in
2. Supabase API returns session
3. Supabase JS SDK automatically sets httpOnly cookie (browser does this)
4. Cookie is NOT immediately available to `getUser()` (timing issue)
5. Middleware sees cookie on NEXT request (already stale by then)

### The Race Condition

```
User clicks "Sign In"
    ↓
signIn() returns { data: { user, session }, error: null }
    ↓
Hook receives response but doesn't use it
    ↓
Component tries to read session via getUser()
    ↓
getUser() calls supabase.auth.getUser()
    ↓
getUser() runs BEFORE cookie is fully set
    ↓
Returns user: null
    ↓
... wait 100ms ...
    ↓
Cookie now available
```

The problem: **signIn() successfully creates session but doesn't tell React about it**.

### Cookie Synchronization

**Browser Side**:
- Supabase JS SDK handles setting httpOnly cookies automatically ✓
- Browser doesn't allow JS to read httpOnly cookies ✓

**Server Side (Middleware)**:
- Middleware reads cookies from request.cookies ✓
- But middleware runs on NEXT request, not current one

**Client-Server Mismatch**:
- Client (React) has no way to know Supabase created a session
- Server (Middleware) only knows about session on next navigation
- They don't sync until after a redirect and new request

---

## 5. MIDDLEWARE REVIEW

### Current Middleware Logic

```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin/')) {
    return NextResponse.next()
  }

  try {
    const { session, response } = await refreshServerSession(request)

    // Public routes - always allow
    const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password']
    if (publicRoutes.includes(pathname)) {
      if (session && (pathname === '/login' || pathname === '/register')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return response
    }

    // Protected routes
    if (pathname.startsWith('/dashboard')) {
      if (!session) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

    return response
  } catch (error) {
    return NextResponse.next()
  }
}
```

### Issues

**Issue #4: Middleware runs after client-side components render**

Middleware runs on:
1. Initial page load (preflight)
2. Each navigation request

But:
- When user clicks "Sign In" button
- React renders the component
- Component redirects BEFORE middleware runs
- Middleware never gets a chance to see the new session

**Issue #5: Middleware Redirect Logic is One-Shot**

```typescript
if (publicRoutes.includes(pathname)) {
  if (session && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}
```

This only redirects authenticated users away from login/register on NEXT request.

If user is on `/login` and logs in successfully:
1. Login succeeds, session created
2. Component should redirect, but doesn't (user state not updated)
3. User is still on /login page
4. Middleware doesn't run until next navigation
5. If user manually refreshes or navigates: THEN middleware redirects to /dashboard

**Issue #6: Dashboard Protection Runs Client-Side AND Server-Side**

Dashboard layout checks auth:
```typescript
useEffect(() => {
  if (!isLoading && !user) {
    router.push('/login')
  }
}, [user, isLoading, router])
```

Middleware also protects:
```typescript
if (pathname.startsWith('/dashboard')) {
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```

Problem: Dashboard layout renders with `user = null` BEFORE redirect logic evaluates:

```typescript
{isLoading ? (
  <LoadingSpinner text="Checking authentication..." />
) : !user ? null : (
  <>...children...</>
)}
```

When `isLoading = false` and `user = null`, it renders `null` (blank screen), then useEffect redirects.

---

## 6. DASHBOARD PROTECTION REVIEW

### Current Implementation

`app/dashboard/layout.tsx` lines 42-46:
```typescript
useEffect(() => {
  if (!isLoading && !user) {
    router.push('/login')
  }
}, [user, isLoading, router])
```

And render:
```typescript
{isLoading ? (
  <LoadingSpinner text="Checking authentication..." />
) : !user ? null : (
  <>...content...</>
)}
```

### The Problem

When dashboard layout mounts:
1. `isLoading = true` (initial state)
2. Renders loading spinner
3. useAuth begins loading session
4. ... some time passes ...
5. Session check completes
6. If `user = null`: `isLoading = false`, render `null`
7. Then useEffect runs and redirects

**Issue**: User sees brief loading spinner, then blank page, then redirect. The redirect should be immediate.

**Worse issue**: Sometimes the session check returns a user (because middleware allowed the request), but the component re-evaluates useAuth and gets null (race condition).

### Why Dashboard Shows Blank Then Redirects

```
Dashboard mounts
    ↓
user = null, isLoading = true (useState defaults)
    ↓
Render: <LoadingSpinner />
    ↓
useEffect runs getUser() async
    ↓
... waiting ...
    ↓
getUser() returns null (race condition, cookie not ready yet)
    ↓
setUser(null), setIsLoading(false)
    ↓
Re-render: user = null, isLoading = false
    ↓
Render: null (blank page)
    ↓
useEffect dependency changes [user, isLoading]
    ↓
Router.push('/login')
    ↓
User redirected to login

MEANWHILE:
Next request to /login
    ↓
Middleware checks session
    ↓
Session exists! (cookie is valid)
    ↓
Redirect back to /dashboard
    ↓
Loop or redirect dance
```

---

## 7. NAVBAR AUTHENTICATION REVIEW

### Current Navbar Logic

`components/landing/navbar.tsx` lines 44-77:
```typescript
{isLoading ? (
  <div className="h-9 w-20 bg-muted rounded animate-pulse" />
) : user ? (
  <>
    <span className="text-sm text-muted-foreground">
      {user.email}
    </span>
    <Link href="/dashboard">
      <Button variant="ghost" size="sm">
        Dashboard
      </Button>
    </Link>
    <Button
      variant="ghost"
      size="sm"
      onClick={signOut}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  </>
) : (
  <>
    <Link href="/login">
      <Button variant="ghost" size="sm">
        Sign In
      </Button>
    </Link>
    ...
  </>
)}
```

### Issue #7: Navbar Renders While useAuth is Checking

Navbar checks `isLoading`:
- While `isLoading = true`: shows skeleton
- Once `isLoading = false`: shows either authenticated or logged-out state

Problem: Dashboard layout and navbar use SAME useAuth hook but have different loading behavior:
- Navbar: shows skeleton while loading
- Dashboard: shows loading spinner, then blank if user is null, then redirects

If both mount at same time (page refresh):
- Navbar checks if `isLoading`
- Dashboard checks if `isLoading`
- Both call useAuth (fresh hook, re-initializes)
- Different timing, different results

### Issue: Navbar and Dashboard Read Different Auth

When you're on the dashboard:
- Navbar useAuth: Reads `user` from Supabase client
- Dashboard layout useAuth: Reads `user` from Supabase client
- But! They may be on different lifecycle stages

Example:
1. User logs in
2. Navbar immediately shows "Dashboard" button (good)
3. User clicks "Dashboard"
4. Dashboard layout mounts, new useAuth instance
5. Dashboard useAuth tries to getUser()
6. But session not ready yet (timing)
7. getUser() returns null
8. Dashboard redirects to /login
9. Middleware sees session (valid)
10. Redirects back to /dashboard
11. Loop

---

## 8. COOKIE & SSR REVIEW

### Supabase Cookie Handling

**What Supabase does**:
- On signUp/signIn: Supabase API returns session
- JS SDK automatically sets httpOnly cookie: `sb-xxx-auth-token`
- Cookie set via response headers automatically by browser

**What Supabase doesn't do**:
- Doesn't notify React that session was created
- Doesn't auto-update JS SDK's session state
- Doesn't tell useAuth to re-fetch user

### Browser vs Server Cookie State

**Browser Side**:
- After signIn() returns, Supabase has set httpOnly cookie
- But React component doesn't know this yet
- Component's `user` state is still null

**Server Side (Middleware)**:
- Middleware runs on NEXT request (not current one)
- Reads httpOnly cookie from request headers
- Sees valid session
- Allows request to proceed

**The Lag**:
```
signIn() completes
    ↓
Cookie set (browser)
    ↓
Component re-renders, but user state not updated
    ↓
User clicks navigate or refreshes
    ↓
NEXT request goes to server
    ↓
Middleware reads cookie and sees session
    ↓
NOW component learns about session
```

This lag causes "sometimes works, sometimes doesn't" behavior.

---

## 9. CLIENT vs SERVER STATE COMPARISON

### Where Auth State Lives

| State | Location | Updated By | Reliability |
|-------|----------|------------|-------------|
| **Supabase Session** | httpOnly Cookie | Browser + Supabase API | ✓ Reliable (server-set) |
| **useAuth().user** | React State | useAuth hook | ✗ Stale (not auto-updated after signIn/signUp) |
| **Middleware session** | Server-side check | middleware.ts | ✓ Reliable (re-checks on each request) |
| **Navbar user** | React State (useAuth) | useAuth hook | ✗ Same as useAuth |
| **Dashboard user** | React State (useAuth) | useAuth hook | ✗ Same as useAuth |

### The Mismatch

After successful login:
- **httpOnly Cookie**: ✓ Valid session set by Supabase
- **useAuth().user**: ✗ Still null (not updated)
- **Middleware**: ✓ Sees valid cookie on next request
- **Navbar**: ✗ Shows login buttons (user state is null)
- **Dashboard**: ✗ Redirects to /login (user state is null)

User is authenticated but React thinks they're not.

---

## 10. ROOT CAUSE ANALYSIS

### Root Causes (In Priority Order)

#### Root Cause #1: CRITICAL - signUp/signIn Don't Update User State

**Files**: `hooks/use-auth.ts` (lines 100-110, 115-125)

**Problem**: After successful signUp/signIn, the hook returns only `{ error }` and never updates `user` state.

```typescript
const handleSignIn = async (email: string, password: string) => {
  // ... setup ...
  const { error } = await authApi.signIn(email, password)
  if (error) {
    setError(error)
  }
  setIsLoading(false)
  // ← MISSING: No user state update
}
```

**Impact**:
- Registration succeeds silently (no redirect, no update)
- Login succeeds silently (no redirect, no update)
- Navbar doesn't update
- No success message shown

**Why It Matters**: The auth state created by Supabase is invisible to React because the hook doesn't consume it.

---

#### Root Cause #2: CRITICAL - No Router.refresh() After Auth Changes

**Files**: `hooks/use-auth.ts`, auth pages

**Problem**: After signUp/signIn, neither the hook nor the pages call `router.refresh()` to re-evaluate middleware.

```typescript
// In register/login page after signUp/signIn succeeds:
await signUp(email, password)
// ← Should call: router.refresh()
// ← This would trigger middleware to re-check auth
```

**Impact**:
- Middleware doesn't re-run to validate new session
- Client-side redirect logic fails
- Server-side auth check doesn't happen

**Why It Matters**: Without refresh, Next.js doesn't re-evaluate protected routes against new auth state.

---

#### Root Cause #3: CRITICAL - useAuth Hook Initial Load Race Condition

**Files**: `hooks/use-auth.ts` (lines 48-62)

**Problem**: Component's `isLoading` flag completes BEFORE user state is properly initialized.

```typescript
useEffect(() => {
  const loadSession = async () => {
    setIsLoading(true)
    const { data, error } = await authApi.getUser()
    
    // If called immediately after signIn/signUp:
    // - getUser() might return null (session not ready)
    // - Cookie exists but getUser() doesn't see it yet
    
    if (error) {
      setUser(null)
    } else {
      setUser(data)  // ← data might be null due to timing
    }
    
    setIsLoading(false)  // ← Too early! Session might not be ready
  }
  
  loadSession()
})
```

**Impact**:
- Dashboard loads, calls useAuth
- useAuth calls getUser() too early
- getUser() returns null (session exists but not visible yet)
- Dashboard redirects to /login
- User confused

**Why It Matters**: Timing of session availability vs component mount is unpredictable.

---

#### Root Cause #4: MEDIUM - Dashboard Renders Null While Redirecting

**Files**: `app/dashboard/layout.tsx` (lines 109-154)

**Problem**: While `isLoading = false` and `user = null`, component renders `null` instead of showing loading state:

```typescript
{isLoading ? (
  <LoadingSpinner text="Checking authentication..." />
) : !user ? null : (  // ← Renders null instead of redirecting immediately
  <>...children...</>
)}
```

Then useEffect redirects:
```typescript
useEffect(() => {
  if (!isLoading && !user) {
    router.push('/login')  // ← Redirect happens after render
  }
}, [user, isLoading, router])
```

**Impact**:
- User sees blank page briefly
- Flash of unstyled content (FOUC)
- Confusing UX

**Why It Matters**: The redirect should happen before any render of null.

---

#### Root Cause #5: MEDIUM - onAuthStateChange Never Fires for Initial Load

**Files**: `hooks/use-auth.ts` (lines 48-62)

**Problem**: The subscription to `onAuthStateChange` is set up on mount but the initial session load from `getUser()` is separate:

```typescript
useEffect(() => {
  // This runs on mount, getUser() might return null or stale data
  const loadSession = async () => {
    const { data, error } = await authApi.getUser()
    // ← This might complete before onAuthStateChange subscription
  }
  
  loadSession()
  
  // This subscription only fires if Supabase emits auth events
  const subscription = authApi.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)
  })
})
```

**Impact**:
- Session loaded twice (inefficient)
- onAuthStateChange might fire but component already decided to redirect
- Registration/login completion event might not be captured

**Why It Matters**: There's no guarantee the subscription will fire in time.

---

#### Root Cause #6: MEDIUM - Navbar and Dashboard Have Timing Skew

**Files**: `components/landing/navbar.tsx`, `app/dashboard/layout.tsx`

**Problem**: Two separate useAuth instances run in parallel with potentially different timing:

```
Navbar mounts: useAuth starts
    ↓
Dashboard mounts: useAuth starts (NEW instance)
    ↓
Navbar useAuth completes: user = authenticated
    ↓
Dashboard useAuth completes: user = null (race condition)
    ↓
Navbar shows "Dashboard" button
    ↓
Dashboard redirects to /login
    ↓
Redirect to /login
    ↓
Middleware sees session, redirects back
```

**Impact**:
- Inconsistent UI state
- Flash of different content
- Redirect loops

**Why It Matters**: useAuth hook is called in multiple components, each gets fresh instance.

---

#### Root Cause #7: MEDIUM - Middleware Redirect Doesn't Work Client-Side

**Files**: `middleware.ts`

**Problem**: Middleware only runs on request, not during client-side navigation:

```typescript
if (session && (pathname === '/login' || pathname === '/register')) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

This only redirects on next server request, not immediately after form submit.

**Impact**:
- User clicks "Sign In", form completes, nothing happens
- Middleware would redirect IF user refreshes or navigates
- But that's after the fact

**Why It Matters**: Client-side redirect happens in React, server redirect happens later.

---

## RECOMMENDED FIX ORDER

### Priority 1: CRITICAL (Blocks All Functionality)

1. **Fix signUp/signIn to Update User State** (Root Cause #1)
   - After signUp/signIn succeeds, extract user from response
   - Call setUser(user) to update React state
   - Files: `hooks/use-auth.ts`
   - Impact: HIGH - Fixes both registration and login flows

2. **Add router.refresh() After Auth Completes** (Root Cause #2)
   - Call router.refresh() after successful signUp/signIn
   - Files: `hooks/use-auth.ts`, register/login pages
   - Impact: HIGH - Allows middleware to re-evaluate auth

3. **Fix Dashboard Redirect Logic** (Root Cause #4)
   - Move redirect logic before render
   - Show loading spinner instead of null
   - Files: `app/dashboard/layout.tsx`
   - Impact: HIGH - Prevents blank page flash

### Priority 2: HIGH (Improves Reliability)

4. **Add Immediate Redirect After signUp/signIn** (Root Cause #3)
   - In signUp/signIn handlers, redirect immediately after response
   - Use router.push('/dashboard') instead of relying on state
   - Files: `app/(auth)/register/page.tsx`, `app/(auth)/login/page.tsx`
   - Impact: MEDIUM - Makes redirects instant

5. **Unify useAuth with Session Synchronization** (Root Cause #5)
   - Ensure onAuthStateChange properly syncs state
   - Or: Call router.refresh() to let middleware handle it
   - Files: `hooks/use-auth.ts`
   - Impact: MEDIUM - Ensures session updates propagate

### Priority 3: MEDIUM (Nice To Have)

6. **Extract useAuth to Single Instance** (Root Cause #6)
   - Use Context API or global state if multiple components need auth
   - Or: Accept the timing differences as acceptable
   - Files: Top-level layout or context file
   - Impact: LOW - Improves consistency but not required

7. **Document Client vs Server Auth Flow** (Root Cause #7)
   - Add comments explaining when middleware runs
   - Clarify that immediate client-side redirects won't wait for middleware
   - Files: middleware.ts comments
   - Impact: LOW - Documentation only

---

## EVIDENCE & TRACING

### Evidence for Root Cause #1

**Register page after signUp**:
1. `handleSignUp()` called (line 57)
2. `await signUp(email, password)` completes
3. Response: `{ error: null }` (only error field)
4. Hook never calls setUser()
5. Component's `user` remains `null`
6. Redirect check: `if (!isLoading && user)` → false
7. No redirect happens

**Login page after signIn**:
Same flow as registration.

### Evidence for Root Cause #2

**After sign Up/signIn**:
- Component redirects via `router.push('/dashboard')` (if it could)
- But that only navigates client-side
- Middleware still sees OLD session (hasn't run yet)
- If user manually refreshes at this point:
  - Middleware runs
  - Sees new session
  - Allows dashboard access

### Evidence for Root Cause #3

**Dashboard mount immediately after login**:
1. User logs in, Supabase sets cookie
2. Component redirects to /dashboard via `router.push()`
3. Dashboard layout mounts
4. useAuth() called
5. getUser() called
6. getUser() calls `supabase.auth.getUser()`
7. But cookie might not be fully propagated yet (race condition)
8. Returns user: null
9. Dashboard redirects back to /login
10. User ends up on /login page

### Evidence for Root Cause #4

**Dashboard render flow**:
1. Mount with `user = null`, `isLoading = true`
2. Render: LoadingSpinner
3. useEffect runs getUser()
4. getUser() returns null
5. setUser(null), setIsLoading(false)
6. Re-render: `user = null`, `isLoading = false`
7. Render: null (blank page)
8. THEN useEffect checks redirect condition
9. Now redirects
10. During this time, user sees blank page

---

## CONCLUSION

The authentication system is architecturally sound but has critical **timing and state synchronization bugs** preventing proper completion of registration and login flows.

The core issue: **React's useAuth hook never updates its user state after signUp/signIn succeeds**, leaving React thinking the user is still logged out while Supabase has already created the session.

Combined with missing router refreshes and dashboard rendering null states, this creates cascading failures that manifest as:
- Silent registration (no feedback)
- Silent login (stays on form)
- Intermittent dashboard access
- Inconsistent navbar state
- Redirect loops on certain refresh patterns

All issues are **fixable** with targeted changes to auth state management and redirect logic.
