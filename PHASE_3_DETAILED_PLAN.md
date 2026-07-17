# Phase 3: Supabase Authentication - Comprehensive Implementation Plan

**Status**: INSPECTION COMPLETE - AWAITING APPROVAL  
**Date**: July 16, 2026  
**Scope**: Website user authentication via Supabase Auth (NOT admin or API key auth)

---

## SECTION 1: CURRENT PROJECT INSPECTION

### Project Foundation

**Framework Stack**:
- Next.js 16.2.6 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (with custom theme variables)
- shadcn/ui (Button, Card components)
- Lucide React icons

**Phase 1 & 2 Deliverables**:
- Phase 1: Supabase integration (client.ts, server.ts already configured)
- Phase 2: Landing page complete (8 landing components, navbar, hero, features, etc.)

**Installed Dependencies**:
- @supabase/supabase-js@^2.110.7 ✓ (already installed)
- Supabase environment variables configured in .env.example ✓
- Redis queue (@upstash/redis) ✓
- Stripe integration ✓
- Google Search integration ✓

### Current Authentication Systems

**System 1: Admin Authentication**
- Uses: `ADMIN_CREDENTIAL` environment variable
- Protects: `/app/admin/*` routes
- Middleware: `lib/auth/middleware.ts` with `withAuth()` and `withAdminAuth()`
- Status: Production code - **MUST NOT BE MODIFIED**

**System 2: API Key Authentication**
- Uses: `x-api-key` header
- Protects: `/app/api/*` endpoints (search, jobs, metrics, etc.)
- Middleware: `lib/auth/middleware.ts` with `loadUserFromCredential()` validation
- Valid keys: `sk_test_*` and `sk_live_*` format
- Status: Production code - **MUST NOT BE MODIFIED**

**System 3: NEW - Supabase Auth** (Phase 3)
- Protects: `/dashboard/*` routes (customer website users only)
- Uses: Supabase Auth (registration, login, session management)
- Does NOT affect admin or API key authentication
- Completely isolated from existing systems

### Existing Supabase Configuration (Phase 1)

**Client Setup** (`lib/supabase/client.ts`):
- Lazy-loaded Supabase client
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- No authentication features used yet

**Server Setup** (`lib/supabase/server.ts`):
- Server-side Supabase client with service key
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Auth persistence disabled by design

**Both clients are ready for Phase 3**:
```
lib/supabase/client.ts    ← Use for browser-based auth
lib/supabase/server.ts    ← Use for server-side session validation
```

### Current UI Component Structure

**Available Components**:
- `components/ui/button.tsx` - shadcn Button with variants
- `components/ui/card.tsx` - shadcn Card component
- `components/landing/*` - 9 landing page components (navbar, hero, features, etc.)
- `components/admin/sidebar.tsx` - Admin navigation
- Lucide icons available (Mail, AlertCircle, Eye, EyeOff, etc.)

**Navbar Status** (`components/landing/navbar.tsx`):
- Currently links `/dashboard` for "Sign In" and "Get Started"
- Placeholder logout button exists (no handler)
- Will be updated in Phase 3 to integrate Supabase

### Dashboard & Admin Structure

**Dashboard** (`app/dashboard/layout.tsx`):
- 'use client' component with theme toggle
- Sidebar with 8 menu items
- Top navigation with user info placeholder
- Logout button placeholder
- NO authentication protection currently

**Admin Dashboard** (`app/admin/layout.tsx`):
- AdminSidebar component
- Protected by ADMIN_CREDENTIAL (unchanged in Phase 3)

### Theme System

**CSS Variables** (`app/globals.css`):
```
Light Mode:
  --background: oklch(1 0 0)        (white)
  --foreground: oklch(0.145 0 0)    (dark gray/black)
  --primary: oklch(0.205 0 0)       (dark navy)
  --muted: oklch(0.97 0 0)          (light gray)
  
Dark Mode:
  --background: oklch(0.125 0 0)    (near black)
  --foreground: oklch(0.985 0 0)    (white)
  --primary: oklch(0.205 0 0)       (dark navy - same)
```

**Already supports**:
- Light/dark mode toggle in dashboard
- Custom CSS variables for all UI elements
- Tailwind v4 with semantic tokens

---

## SECTION 2: ARCHITECTURE REVIEW

### Integration Strategy

**Goal**: Add Supabase Auth for website users WITHOUT modifying existing systems

**Three Separate Auth Tracks**:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Track 1: ADMIN AUTHENTICATION (UNCHANGED)                │
│  ├─ Path: /admin/*                                        │
│  ├─ Method: ADMIN_CREDENTIAL                              │
│  ├─ Middleware: lib/auth/middleware.ts                    │
│  └─ Status: Production - No changes                       │
│                                                             │
│  Track 2: API KEY AUTHENTICATION (UNCHANGED)              │
│  ├─ Path: /api/*                                          │
│  ├─ Method: x-api-key header                              │
│  ├─ Valid Keys: sk_test_*, sk_live_*                      │
│  ├─ Middleware: lib/auth/middleware.ts                    │
│  └─ Status: Production - No changes                       │
│                                                             │
│  Track 3: SUPABASE WEB AUTH (NEW)                         │
│  ├─ Path: / → /login → /register → /dashboard/*          │
│  ├─ Method: Email/password via Supabase                  │
│  ├─ Session: Secure httpOnly cookies                      │
│  ├─ Middleware: middleware.ts (NEW)                       │
│  └─ Status: Customer website users only                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why This Architecture

**Isolation**:
- Each auth system completely separate
- No cross-contamination
- Admin system unaffected
- API key system unaffected

**Simplicity**:
- Supabase handles all auth complexity
- We only integrate, not build custom auth
- Middleware is minimal (session refresh + redirect logic)

**Security**:
- httpOnly cookies for session storage
- Supabase manages tokens & refresh
- No JWT handling in application code
- Rate limiting handled by Supabase

**Scalability**:
- Can later add SSO, magic links, etc. (Supabase supports all)
- Can migrate admin/API auth to Supabase later if desired
- Currently independent systems = low risk

### How Supabase Auth Works

**Session Lifecycle**:

1. **Registration** (`/register` page)
   - User enters email + password
   - Call: `supabase.auth.signUp({ email, password })`
   - Supabase creates user account
   - Session token generated
   - httpOnly cookie set by browser
   - Redirect to /dashboard

2. **Login** (`/login` page)
   - User enters email + password
   - Call: `supabase.auth.signInWithPassword({ email, password })`
   - Supabase validates credentials
   - Session token generated
   - httpOnly cookie set by browser
   - Redirect to /dashboard

3. **Session Persistence** (Every page load)
   - Browser sends httpOnly cookie with request
   - `middleware.ts` receives request
   - Call: `supabase.auth.getSession()` reads cookie
   - Supabase validates session
   - If expired: Refresh token used automatically
   - Request proceeds to page

4. **Logout** (Dashboard logout button)
   - User clicks logout
   - Call: `supabase.auth.signOut()`
   - Supabase clears session
   - httpOnly cookie deleted
   - Redirect to /login

### Supabase API Functions We'll Use

**Authentication**:
```typescript
// Registration
supabase.auth.signUp({ email, password })

// Login
supabase.auth.signInWithPassword({ email, password })

// Logout
supabase.auth.signOut()

// Get current user
supabase.auth.getUser()

// Get session
supabase.auth.getSession()

// Listen for auth changes
supabase.auth.onAuthStateChange()

// Password reset
supabase.auth.resetPasswordForEmail(email)

// Update password
supabase.auth.updateUser({ password: newPassword })
```

---

## SECTION 3: FILES TO CREATE

### Total: 12 Files to Create

#### Auth Utilities (3 files)

**1. `lib/supabase/browser.ts`** (rename from client.ts functionality)
- **Purpose**: Client-side Supabase auth functions
- **Size**: ~150 lines
- **Exports**:
  - `signUp(email: string, password: string)` - Register new user
  - `signIn(email: string, password: string)` - Login user
  - `signOut()` - Logout (clear session)
  - `getUser()` - Get current authenticated user
  - `onAuthStateChange(callback)` - Subscribe to auth state changes
  - `resetPasswordForEmail(email: string)` - Send password reset email
  - `updatePassword(password: string)` - Update user password
  - Error handling for all auth failures
- **Dependencies**: @supabase/supabase-js, lib/supabase/client.ts
- **Notes**: Used in browser components and pages (use 'use client')

**2. `lib/supabase/server.ts`** (extend existing)
- **Purpose**: Server-side session validation
- **Size**: ~120 lines
- **Exports**:
  - `getServerSession()` - Extract session from request cookies (for middleware)
  - `validateSession(session)` - Verify session with Supabase
  - `refreshSession(token)` - Manually refresh expired token
- **Dependencies**: @supabase/supabase-js, NextRequest/NextResponse
- **Notes**: Used in middleware.ts and route handlers

**3. `hooks/use-auth.ts`** (NEW)
- **Purpose**: Client-side auth hook for components
- **Size**: ~180 lines
- **Exports**:
  - `useAuth()` hook returning:
    - `user` - Current user object (null if not authenticated)
    - `isLoading` - Boolean loading state
    - `isAuthenticated` - Boolean (user !== null)
    - `signIn(email, password)` - Login function
    - `signUp(email, password)` - Register function
    - `signOut()` - Logout function
    - `error` - Error message if auth fails
- **Features**:
  - Auto-loads session on component mount
  - Subscribes to auth state changes
  - Handles loading/error states
  - Auto-clears error after 5 seconds
- **Usage**: `const { user, signIn, signOut } = useAuth()`

#### Authentication Pages (5 files)

**4. `app/(public)/layout.tsx`** (NEW)
- **Purpose**: Layout for public auth routes
- **Size**: ~80 lines
- **Features**:
  - No sidebar (unlike dashboard)
  - Centered card container (max-w-md)
  - Navbar with back-to-home link
  - Footer with Nastech branding
  - Responsive: full-width on mobile
  - Dark mode support
  - Theme toggle button (top right)
- **Structure**:
  ```
  <nav> Nastech | Back to Home </nav>
  <main>
    <div className="centered-card">
      {children}
    </div>
  </main>
  <footer> Nastech © 2024 </footer>
  ```

**5. `app/(public)/login/page.tsx`** (NEW)
- **Purpose**: Email/password login form
- **Size**: ~140 lines
- **Features**:
  - Email input field
  - Password input field (with show/hide toggle)
  - "Sign In" button (disabled during submission)
  - Loading spinner while submitting
  - Error message display (red alert box)
  - "Forgot password?" link → /forgot-password
  - "Don't have account? Register" link → /register
  - Form validation (email format, password required)
  - Auto-redirect to /dashboard if already logged in
  - Remember me checkbox (optional enhancement)
- **On Submit**:
  - Call `useAuth().signIn(email, password)`
  - Show loading spinner
  - Redirect to /dashboard on success
  - Show error message on failure

**6. `app/(public)/register/page.tsx`** (NEW)
- **Purpose**: Email/password registration form
- **Size**: ~160 lines
- **Features**:
  - Email input field
  - Password input field (with show/hide toggle)
  - Confirm password input field
  - "Create Account" button (disabled during submission)
  - Loading spinner while submitting
  - Error message display (red alert box)
  - Password strength indicator (optional: weak/medium/strong)
  - "Terms & Conditions" checkbox (required)
  - "Already have account? Sign In" link → /login
  - Form validation:
    - Email format validation
    - Password min 8 characters
    - Passwords match
    - Terms accepted
  - Auto-redirect to /dashboard if already logged in
- **On Submit**:
  - Validate form client-side first
  - Call `useAuth().signUp(email, password)`
  - Show loading spinner
  - Redirect to /dashboard on success
  - Show error message on failure (e.g., "Email already registered")

**7. `app/(public)/forgot-password/page.tsx`** (NEW)
- **Purpose**: Send password reset email
- **Size**: ~120 lines
- **Features**:
  - Email input field
  - "Send Reset Email" button
  - Loading spinner while submitting
  - Success message: "Check your email for reset link"
  - Error message display
  - "Back to Sign In" link
  - Auto-redirect to /dashboard if already logged in
- **On Submit**:
  - Call `supabase.auth.resetPasswordForEmail(email)`
  - Show success message (hide form)
  - Keep email visible for reference

**8. `app/(public)/reset-password/page.tsx`** (NEW)
- **Purpose**: Reset password from email link
- **Size**: ~150 lines
- **Features**:
  - New password input field
  - Confirm password input field
  - "Update Password" button
  - Loading spinner
  - Error message display
  - Success message: "Password updated! Redirecting to login..."
  - Query params: `?token=xxx` and `?email=user@example.com` (from email link)
  - Validates token before showing form
- **On Mount**:
  - Extract token from URL query params
  - Verify token is valid with Supabase
  - If invalid: Show error "Link expired or invalid"
- **On Submit**:
  - Call `supabase.auth.updateUser({ password: newPassword })`
  - Show success message
  - Redirect to /login after 2 seconds

#### Reusable Components (4 files)

**9. `components/auth/AuthCard.tsx`** (NEW)
- **Purpose**: Shared card wrapper for auth pages
- **Size**: ~50 lines
- **Features**:
  - Card container with max-width
  - Title and subtitle display
  - Footer text/link
  - Responsive padding
  - Dark mode support
- **Props**:
  ```typescript
  {
    title: string
    subtitle?: string
    footer?: ReactNode
    children: ReactNode
  }
  ```

**10. `components/auth/AuthInput.tsx`** (NEW)
- **Purpose**: Reusable form input with validation
- **Size**: ~120 lines
- **Features**:
  - Text input (email, password, text)
  - Label display
  - Error message below input
  - Floating label on focus (optional enhancement)
  - Show/hide toggle for password fields
  - Disabled state during submission
  - Focus ring styling
  - Dark mode support
- **Props**:
  ```typescript
  {
    type: 'email' | 'password' | 'text'
    label: string
    placeholder?: string
    error?: string
    disabled?: boolean
    value: string
    onChange: (value: string) => void
    required?: boolean
  }
  ```

**11. `components/auth/ErrorAlert.tsx`** (NEW)
- **Purpose**: Error message display component
- **Size**: ~50 lines
- **Features**:
  - Red background with border
  - Error icon (AlertCircle from lucide)
  - Dismissible X button
  - Fade out animation
  - Dark mode support
  - Auto-dismiss after 5 seconds (optional)
- **Props**:
  ```typescript
  {
    message: string
    onDismiss?: () => void
  }
  ```

**12. `components/auth/LoadingSpinner.tsx`** (NEW)
- **Purpose**: Loading indicator for form submission
- **Size**: ~50 lines
- **Features**:
  - Animated spinner (CSS or SVG)
  - Optional text label
  - Centered display
  - Dark mode support
- **Props**:
  ```typescript
  {
    text?: string
    size?: 'sm' | 'md' | 'lg'
  }
  ```

#### Middleware (1 file)

**13. `middleware.ts`** (NEW - in project root)
- **Purpose**: Route protection and session management
- **Size**: ~150 lines
- **Responsibilities**:
  1. Refresh Supabase session on every request
  2. Protect `/dashboard/*` routes (redirect to /login if not authenticated)
  3. Redirect authenticated users away from `/login` and `/register` (→ /dashboard)
  4. Allow public routes (/, /forgot-password, /reset-password)
  5. Allow API routes (/api/*)
- **Implementation**:
  ```typescript
  export async function middleware(request: NextRequest) {
    // 1. Create Supabase client
    // 2. Refresh session
    // 3. Check if route needs protection
    // 4. Get session from cookie
    // 5. Redirect if needed
    // 6. Return response
  }
  
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
  }
  ```
- **No Business Logic**: Only handles auth redirect, nothing else

---

## SECTION 4: FILES TO MODIFY

### Total: 5 Files to Modify

**1. `app/layout.tsx`** (ROOT LAYOUT)
- **Current State**: 
  - Imports Analytics
  - Sets metadata
  - Renders children
- **Changes Required** (+10 lines):
  - Add auth provider (optional in Phase 3)
  - Consider: `<AuthProvider>{children}</AuthProvider>` wrapper
  - Actually: Better to keep minimal, handle auth in (public)/ and /dashboard/
  - **Recommendation**: NO CHANGES to root layout
  - Auth provider can live in dashboard/layout.tsx and (public)/layout.tsx separately
- **Lines Changed**: 0 (no changes recommended)

**2. `components/landing/navbar.tsx`** (UPDATE CTA BUTTONS)
- **Current State**:
  - "Sign In" button links to `/dashboard`
  - "Get Started" button links to `/dashboard`
  - Mobile menu buttons same
  - Placeholder logout button (no handler)
- **Changes Required** (~30 lines):
  - Import `useAuth()` hook
  - Add client-side auth state check
  - Show "Signed In" or "Sign Out" if authenticated
  - Show "Sign In / Get Started" if not authenticated
  - "Sign Out" button calls `useAuth().signOut()`
  - "Sign In" links to `/login`
  - "Get Started" links to `/register` (or `/login`)
  - Show user email if authenticated (optional)
- **Lines Changed**: ~+30 lines (mostly conditional rendering)

**3. `app/dashboard/layout.tsx`** (UPDATE WITH USER INFO & LOGOUT)
- **Current State**:
  - Placeholder "User" text in header
  - Placeholder "Pro Plan" text
  - Logout button with no handler
  - Shows first tab as "Dashboard"
- **Changes Required** (~40 lines):
  - Import `useAuth()` hook
  - Get user info from `useAuth().user`
  - Display user email instead of "User"
  - Update logout button handler to call `useAuth().signOut()`
  - Add loading state while checking auth
  - Optional: Show plan from database
  - Optional: Show subscription status
  - Add useEffect to redirect if not authenticated
- **Lines Changed**: ~+40 lines (user info display + logout handler)

**4. `lib/supabase/client.ts`** (RENAME TO browser.ts OR KEEP AS-IS)
- **Current State**: 
  - Lazy-loaded Supabase client
  - Used for browser-side queries
- **Changes Required**:
  - OPTION A: Keep as-is (no changes) + create browser.ts that wraps it
  - OPTION B: Rename to browser.ts
  - **Recommendation**: OPTION A - Keep client.ts, add auth functions to it
  - **Actually**: Create lib/supabase/browser.ts that re-exports client + adds auth functions
- **Lines Changed**: 0 (no breaking changes)

**5. `middleware.ts`** (CREATE NEW - NOT MODIFY EXISTING)
- **Current State**: Does not exist
- **Action**: CREATE middleware.ts in project root
- **Purpose**: Route protection and session refresh

---

## SECTION 5: FILES THAT MUST REMAIN UNTOUCHED

### Protected Systems Table

| System | Location | Status | Why Protected |
|--------|----------|--------|---------------|
| Admin Dashboard | /app/admin/* | Production | Uses ADMIN_CREDENTIAL - different auth system |
| Admin Sidebar | components/admin/sidebar.tsx | Production | Admin UI - not for web users |
| Admin Auth Middleware | lib/auth/admin-auth.ts | Production | Validates admin role - keep as-is |
| API Authentication | lib/auth/middleware.ts (partial) | Production | Validates API keys - keep x-api-key logic |
| Search Engine | lib/search/* | Production | Business logic - zero changes |
| Extraction Engine | lib/extraction/* | Production | Business logic - zero changes |
| Worker System | lib/worker/* | Production | Background jobs - zero changes |
| Queue System | lib/queue/* | Production | Redis queue - zero changes |
| Google Search | Google API integration | Production | Third-party - zero changes |
| Redis Cache | Upstash Redis | Production | Infrastructure - zero changes |
| Stripe Billing | Stripe integration | Production | Payment processing - zero changes |
| API Routes | /app/api/* | Production | All endpoints - only auth header may be added |

### Why Not Modified

**Admin Dashboard** (`/app/admin/*`):
- Uses ADMIN_CREDENTIAL authentication
- Completely separate from website user auth
- Has its own layout and sidebar
- Admin users are NOT website users
- Keep ADMIN_CREDENTIAL working as-is

**API Routes** (`/app/api/*`):
- Uses x-api-key header authentication
- For external API consumers
- No website users access these
- Keep x-api-key validation as-is
- Can optionally add session-based auth later, but not in Phase 3

**Search/Extraction/Queue/Worker Systems**:
- Pure business logic
- Not authentication related
- Production-critical
- Zero changes needed
- Accessed via API routes

**Third-Party Services** (Google, Stripe, Redis):
- External integrations
- No authentication changes needed
- Still work via existing API routes

---

## SECTION 6: AUTHENTICATION FLOWS

### Flow 1: Registration

```
User visits landing page /
    ↓
Clicks "Get Started" button
    ↓
Redirect to /register
    ↓
middleware.ts checks: user not authenticated → allow
    ↓
/register page loads
    ↓
useAuth() hook checks auth state → not logged in → show form
    ↓
User enters:
  - Email: user@example.com
  - Password: MyPassword123!
  - Confirm: MyPassword123!
  - Checkbox: Terms accepted
    ↓
User clicks "Create Account"
    ↓
Form validates client-side
    ↓
Call: useAuth().signUp(email, password)
    ↓
→ supabase.auth.signUp() API call
    ↓
Supabase creates user account
    ↓
Returns: session with access_token + refresh_token
    ↓
Browser receives: httpOnly cookie (Supabase sets this)
    ↓
Redirect to /dashboard
    ↓
middleware.ts receives request:
  ├─ Reads httpOnly cookie
  ├─ Validates session with Supabase
  ├─ User authenticated → allow access
  └─ Attach user context
    ↓
/dashboard page loads
    ↓
useAuth() hook checks auth state → logged in → show dashboard
    ↓
Display: Sidebar, menu, user email "user@example.com"
```

### Flow 2: Login

```
User visits /login
    ↓
middleware.ts checks: user not authenticated → allow
    ↓
/login page loads
    ↓
useAuth() hook checks auth state → not logged in → show form
    ↓
User enters:
  - Email: user@example.com
  - Password: MyPassword123!
    ↓
User clicks "Sign In"
    ↓
Form validates client-side
    ↓
Call: useAuth().signIn(email, password)
    ↓
→ supabase.auth.signInWithPassword() API call
    ↓
Supabase validates credentials
    ↓
If invalid:
  ├─ Returns error: "Invalid email or password"
  ├─ Show error in ErrorAlert component
  └─ User stays on /login
    ↓
If valid:
  ├─ Returns: session with tokens
  ├─ Browser receives: httpOnly cookie
  ├─ Show loading spinner
  ├─ Redirect to /dashboard
  └─ middleware.ts validates session → allow
    ↓
/dashboard page loads
    ↓
Display user info and dashboard content
```

### Flow 3: Logout

```
User is on /dashboard
    ↓
Clicks "Logout" button in sidebar
    ↓
Button click handler calls: useAuth().signOut()
    ↓
→ supabase.auth.signOut() API call
    ↓
Supabase clears session
    ↓
Browser httpOnly cookie deleted
    ↓
Show loading spinner
    ↓
Redirect to /login
    ↓
middleware.ts receives request to /login:
  ├─ Checks: user not authenticated
  ├─ Checks: route is /login (allowed for unauthenticated)
  └─ Allow access
    ↓
/login page loads
    ↓
useAuth() hook checks auth state → not logged in → show form
    ↓
User back at login form, ready to sign in again
```

### Flow 4: Session Refresh (Automatic)

```
User logged in, browsing /dashboard
    ↓
User makes any request (page navigation, API call, etc.)
    ↓
middleware.ts intercepts request
    ↓
Calls: supabase.auth.getSession()
    ↓
Supabase reads httpOnly cookie
    ↓
If session valid:
  ├─ Return session object
  └─ Request continues normally
    ↓
If access_token expired (>1 hour old):
  ├─ Supabase reads refresh_token from cookie
  ├─ Exchanges refresh_token for new access_token
  ├─ Updates httpOnly cookie
  └─ Request continues normally
    ↓
If both tokens expired:
  ├─ Session becomes null
  ├─ middleware.ts redirects to /login
  ├─ Show: "Session expired. Please sign in again."
  └─ User re-authenticates
```

### Flow 5: Protected Routes

```
Unauthenticated user tries to access /dashboard
    ↓
Browser sends request
    ↓
middleware.ts intercepts:
  ├─ Check: Is path /dashboard/* ?
  ├─ Get session via supabase.auth.getSession()
  ├─ Session is null (user not logged in)
  ├─ Redirect to /login
  └─ Stop - prevent page load
    ↓
/login page loads (redirected)
    ↓
User sees login form
    ↓
"Sign In" to proceed to /dashboard
```

### Flow 6: Already Logged In User Accesses /login

```
Authenticated user tries to access /login
    ↓
Browser sends request
    ↓
middleware.ts intercepts:
  ├─ Check: Is path /login or /register ?
  ├─ Get session via supabase.auth.getSession()
  ├─ Session exists (user logged in)
  ├─ Redirect to /dashboard
  └─ Stop - prevent login page load
    ↓
/dashboard page loads (redirected)
    ↓
User stays on dashboard (no need to login again)
```

---

## SECTION 7: MIDDLEWARE DESIGN

### Middleware Architecture

**File**: `middleware.ts` (project root, Next.js standard)

**Size**: ~150 lines

**Responsibility**: Route-level authentication only (no business logic)

### Middleware Request Flow

```
Browser Request
    ↓
middleware.ts intercepts
    ↓
1. CREATE SUPABASE CLIENT
   └─ Use createServerClient with cookies from request
    ↓
2. REFRESH SESSION
   └─ Call supabase.auth.getSession()
      (Auto-refreshes if refresh_token exists and valid)
    ↓
3. ROUTE CHECK
   ├─ If /dashboard/* → Require authentication
   ├─ If /login or /register → Redirect if authenticated
   ├─ If /forgot-password or /reset-password → Allow all
   ├─ If /api/* → Allow all (API uses x-api-key)
   └─ If / (home) or other public → Allow all
    ↓
4. DECISION
   ├─ Protected route + no session → Redirect to /login
   ├─ Auth page + session exists → Redirect to /dashboard
   ├─ All other cases → Allow request
    ↓
5. UPDATE COOKIES
   └─ Set new cookies in response (Supabase refresh tokens)
    ↓
6. RETURN RESPONSE
   └─ NextResponse with updated cookies
    ↓
Request continues to page or handler
```

### Middleware Code Structure

```typescript
// middleware.ts

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // 1. Create response we'll modify
  let response = NextResponse.next()
  
  // 2. Create Supabase server client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from request
        getAll() { return request.cookies.getSetCookie() },
        // Set cookies in response
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  
  // 3. Refresh session
  await supabase.auth.getSession()
  
  // 4. Check protected routes
  const { pathname } = request.nextUrl
  
  // Protect /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  // Redirect authenticated users away from auth pages
  if (pathname === '/login' || pathname === '/register') {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    // Match all paths except:
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
```

### Middleware Rules

**DO**:
- ✓ Refresh session on every request
- ✓ Redirect if no session on protected routes
- ✓ Redirect if session exists on auth pages
- ✓ Update response cookies
- ✓ Keep middleware minimal and fast

**DON'T**:
- ✗ Add business logic
- ✗ Query user data from database
- ✗ Log anything non-critical
- ✗ Throw exceptions (catch and handle)
- ✗ Call external APIs
- ✗ Modify admin or API key logic

---

## SECTION 8: RISK ASSESSMENT

### Risk Level: LOW

**Why Low Risk**:
1. Completely isolated from existing systems
2. No modifications to production code
3. New auth is parallel to existing systems
4. Easy to rollback if needed
5. Supabase handles all complexity

### Risk Areas

**LOW RISK - No breaking changes possible**:
- ✓ Adding /login, /register, /forgot-password, /reset-password routes (new routes, no conflicts)
- ✓ Creating auth components (new components, no conflicts)
- ✓ Adding middleware.ts (new file, non-breaking)
- ✓ Adding (public)/ route group (new folder, no conflicts)

**LOW-MEDIUM RISK - Minimal changes, tested thoroughly**:
- ~ Updating navbar with useAuth() hook (conditional rendering, can be tested in isolation)
- ~ Updating dashboard layout with user info (display-only change, no logic)
- ~ Updating logout button (single function call)

**ZERO RISK - Completely untouched**:
- ✓ Admin authentication (ADMIN_CREDENTIAL)
- ✓ API authentication (x-api-key)
- ✓ Admin dashboard
- ✓ API routes
- ✓ Search engine
- ✓ Extraction engine
- ✓ Worker system
- ✓ Queue system

### Potential Issues & Mitigation

**Issue**: Session cookie not persisting across page refreshes
- **Cause**: Browser not accepting httpOnly cookie
- **Mitigation**: Test in real browser, verify Supabase cookie settings
- **Likelihood**: Very low (Supabase handles this)

**Issue**: Navigation links break
- **Cause**: Navbar redirect logic incorrect
- **Mitigation**: Test all navigation paths, verify useAuth() state checks
- **Likelihood**: Low (straightforward conditional rendering)

**Issue**: Admin dashboard stops working
- **Cause**: Middleware blocks /admin routes
- **Mitigation**: Configure middleware matcher to exclude /admin, test with ADMIN_CREDENTIAL
- **Likelihood**: Very low (easy to fix in matcher config)

**Issue**: API authentication breaks
- **Cause**: Middleware interferes with x-api-key header
- **Mitigation**: Middleware only checks cookies for session, doesn't touch headers, test API with key
- **Likelihood**: Very low (separate systems)

**Issue**: Dashboard layout crashes
- **Cause**: useAuth() hook returns undefined
- **Mitigation**: Add error boundaries, default values, test auth state
- **Likelihood**: Low (proper TypeScript types prevent this)

### No Data Loss

- Phase 3 adds features only
- No database schema changes
- No deletions of existing data
- If rolled back: Just remove Phase 3 files
- Existing systems operate independently

---

## SECTION 9: BACKWARD COMPATIBILITY

### API Authentication Remains 100% Functional

**Current**: External consumers call API with x-api-key header
```
curl -X POST https://nastech.com/api/search \
  -H "x-api-key: sk_test_demo" \
  -H "Content-Type: application/json" \
  -d '{"query":"..."}'
```

**After Phase 3**: Same request still works
- middleware.ts DOES NOT touch /api/* routes
- Request skips middleware entirely
- lib/auth/middleware.ts validates x-api-key as before
- Response identical to pre-Phase 3

**Why**: /api/* routes handled by lib/auth/middleware.ts (not Next.js middleware.ts)

### Admin Authentication Remains 100% Functional

**Current**: Admin users access /admin with ADMIN_CREDENTIAL in header
```
GET https://nastech.com/admin?ADMIN_CREDENTIAL=env_value
```

**After Phase 3**: Same admin access still works
- middleware.ts can exclude /admin routes from session checks
- lib/auth/admin-auth.ts validates ADMIN_CREDENTIAL as before
- Admin dashboard layout unchanged
- Admin UI identical to pre-Phase 3

**Why**: Admin uses separate authentication system, completely untouched

### Search Engine Remains 100% Functional

**Current**: Dashboard users run searches via /api/search
```
POST /api/search {
  query: "software engineers in SF",
  location: "San Francisco"
}
```

**After Phase 3**: Same search still works
- API authentication unchanged (x-api-key)
- Search logic unchanged (lib/search/*)
- Queue system unchanged (lib/queue/*)
- Workers unchanged (lib/worker/*)
- Results identical

**Why**: Search is independent business logic, zero changes

### Queue System Remains 100% Functional

**Current**: Background jobs process search requests
```
Job submitted → queued → worker processes → results stored
```

**After Phase 3**: Same job processing still works
- Queue system (Upstash Redis) unchanged
- Worker logic unchanged
- Job format unchanged
- Processing identical

**Why**: Queue/workers independent from authentication

### Extraction Engine Remains 100% Functional

**Current**: Extraction engine filters and extracts company data
```
Search results → filter by pattern → extract emails → store
```

**After Phase 3**: Same extraction still works
- Extraction logic unchanged
- Database queries unchanged
- Pattern matching unchanged
- Results identical

**Why**: Extraction is independent business logic

### Google Search Integration Remains 100% Functional

**Current**: Google Custom Search Engine provides results
```
Query → Google CSE API → results
```

**After Phase 3**: Same Google integration still works
- Google API calls unchanged
- API key unchanged
- Rate limiting unchanged
- Results identical

**Why**: Google integration independent from authentication

---

## SECTION 10: TESTING PLAN

### Pre-Implementation Testing

**Build Test**:
- [ ] Run `npm run build` - should succeed
- [ ] Check for TypeScript errors - should be zero
- [ ] Check for console warnings - should be none

### Phase 3.1 Testing: Components

**Auth Components**:
- [ ] AuthCard renders with title and footer
- [ ] AuthInput renders with label and validation error
- [ ] ErrorAlert displays message and dismisses on click
- [ ] LoadingSpinner displays with text label

### Phase 3.2 Testing: Login

**Registration Flow**:
- [ ] Can visit /register
- [ ] Form displays: email, password, confirm password, terms checkbox
- [ ] Form validates email format
- [ ] Form validates password minimum length
- [ ] Form validates passwords match
- [ ] Form requires terms checkbox
- [ ] Can submit form
- [ ] Loading spinner shows while submitting
- [ ] Error shows if email already registered
- [ ] Success: Redirected to /dashboard after registration
- [ ] Success: User email displayed in dashboard

**Login Flow**:
- [ ] Can visit /login
- [ ] Form displays: email, password, forgot password link, register link
- [ ] Form validates email format
- [ ] Form validates password not empty
- [ ] Can submit form
- [ ] Loading spinner shows while submitting
- [ ] Error shows for invalid credentials
- [ ] Error shows for non-existent email
- [ ] Success: Redirected to /dashboard after login
- [ ] Success: User email displayed in dashboard
- [ ] "Forgot password?" link goes to /forgot-password

**Logout**:
- [ ] Logout button visible in dashboard
- [ ] Click logout shows loading spinner
- [ ] Session cleared after logout
- [ ] Redirected to /login after logout
- [ ] Cannot access /dashboard after logout (redirected to /login)

### Phase 3.3 Testing: Session Persistence

**Session Across Page Reloads**:
- [ ] After login, refresh page - still logged in
- [ ] After login, navigate between dashboard pages - still logged in
- [ ] After logout, refresh page - still logged out

**Session Across Tabs**:
- [ ] Login in tab 1
- [ ] Open tab 2, navigate to /dashboard
- [ ] Tab 2 also logged in
- [ ] Logout in tab 1
- [ ] Refresh tab 2 - now logged out

**Session Expiration**:
- [ ] Manually expire token (modify cookie)
- [ ] Next request should use refresh token
- [ ] Session continues without user action

### Phase 3.4 Testing: Protected Routes

**Protected Routes**:
- [ ] Cannot access /dashboard without login
  - Expected: Redirected to /login
- [ ] Cannot access /dashboard/search without login
  - Expected: Redirected to /login
- [ ] Cannot access /dashboard/settings without login
  - Expected: Redirected to /login
- [ ] Can access /dashboard with login
  - Expected: Dashboard displays
- [ ] Can access /dashboard/search with login
  - Expected: Search page displays

**Public Routes**:
- [ ] Can access / without login
- [ ] Can access /login without login
- [ ] Can access /register without login
- [ ] Can access /forgot-password without login
- [ ] Can access /api/* with API key (no login required)

**Redirect Authenticated Users**:
- [ ] After login, visit /login
  - Expected: Redirected to /dashboard
- [ ] After login, visit /register
  - Expected: Redirected to /dashboard

### Phase 3.5 Testing: Dark Mode

**Light/Dark Mode Toggle**:
- [ ] Dashboard has theme toggle button
- [ ] Toggle switches between light/dark
- [ ] Auth pages show correctly in light mode
- [ ] Auth pages show correctly in dark mode
- [ ] Theme persists in localStorage
- [ ] Colors contrast is sufficient (accessibility)

### Phase 3.6 Testing: Responsive Design

**Mobile Layout**:
- [ ] Auth forms display correctly on mobile (<640px)
- [ ] Input fields are large enough to tap
- [ ] Buttons are accessible on mobile
- [ ] Navbar is responsive on mobile

**Tablet Layout**:
- [ ] Auth forms display correctly on tablet (640-1024px)
- [ ] Dashboard sidebar works on tablet
- [ ] All content visible

**Desktop Layout**:
- [ ] Auth forms display correctly on desktop (>1024px)
- [ ] Dashboard layout proper
- [ ] Spacing and alignment correct

### Phase 3.7 Testing: Existing Systems

**API Authentication**:
- [ ] API key authentication still works
- [ ] Can call /api/search with x-api-key
- [ ] Can call /api/admin/dashboard with ADMIN_CREDENTIAL
- [ ] API responses identical to pre-Phase 3

**Admin Dashboard**:
- [ ] Can access /admin with ADMIN_CREDENTIAL
- [ ] Admin dashboard displays
- [ ] Admin features work (view jobs, queue, etc.)
- [ ] Admin authentication unchanged

**Search Engine**:
- [ ] Can run searches from dashboard
- [ ] Search results display correctly
- [ ] Jobs are queued and processed
- [ ] Results stored in database

**Queue System**:
- [ ] Background jobs process
- [ ] Job status updates
- [ ] Failed jobs retry
- [ ] Queue health check works

**Workers**:
- [ ] Workers process jobs
- [ ] Extraction completes
- [ ] Results available
- [ ] Logs display correctly

### Phase 3.8 Testing: Edge Cases

**Invalid Token**:
- [ ] Session expires while user on page
- [ ] Next action prompts re-login
- [ ] No data corruption

**Network Error During Login**:
- [ ] Show error message
- [ ] Allow retry
- [ ] Form data preserved

**Rapid Form Submission**:
- [ ] Submit button disables after first click
- [ ] Only one request sent
- [ ] No duplicate accounts/logins

**Special Characters in Email**:
- [ ] Accept valid email formats
- [ ] Reject invalid formats

---

## SECTION 11: ROLLBACK STRATEGY

### Complete Rollback (If Phase 3 Has Issues)

**Step 1: Remove All New Files** (5 minutes)
```bash
rm -rf app/(public)
rm -rf components/auth
rm -rf hooks/use-auth.ts
rm middleware.ts
```

**Step 2: Revert File Changes** (2 minutes)
```
components/landing/navbar.tsx → Restore to Phase 2 version
app/dashboard/layout.tsx → Restore to Phase 2 version
```

**Step 3: Verify Existing Systems** (2 minutes)
- Test API key authentication
- Test admin authentication
- Test search functionality

**Step 4: Deploy** (1 minute)
- Git commit and push
- Vercel auto-deploys
- Site restored to pre-Phase 3

**Total Time**: ~10 minutes

### Why Rollback Is Safe

**No Database Changes**:
- No schema modifications
- No migrations run
- No data deleted
- Supabase users created during testing can remain or be deleted manually

**No Breaking Changes**:
- Only additions, no deletions of existing functionality
- Existing systems completely separate
- Can remove Phase 3 without side effects

**No Dependencies**:
- Phase 3 code is isolated
- No other code depends on Phase 3 files
- Safe to delete

---

## SECTION 12: IMPLEMENTATION PHASES

### PHASE 3.1: Authentication Components

**Duration**: 2-3 hours

**Files**: Create
- components/auth/AuthCard.tsx
- components/auth/AuthInput.tsx
- components/auth/ErrorAlert.tsx
- components/auth/LoadingSpinner.tsx

**Testing**:
- Component renders
- Props work correctly
- Responsive design
- Dark mode support

**Deployable**: Yes (components only, not integrated yet)

### PHASE 3.2: Auth Utilities

**Duration**: 2 hours

**Files**: Create
- lib/supabase/browser.ts (auth functions)
- hooks/use-auth.ts (auth hook)

**Testing**:
- signUp() works
- signIn() works
- signOut() works
- getUser() returns correct data
- onAuthStateChange() fires correctly
- Hook manages loading/error states

**Deployable**: Yes (logic complete, UI not integrated yet)

### PHASE 3.3: Public Routes Layout

**Duration**: 1 hour

**Files**: Create
- app/(public)/layout.tsx

**Testing**:
- Layout renders
- Back-to-home link works
- Theme toggle works
- Responsive design

**Deployable**: Yes (layout only, no pages yet)

### PHASE 3.4: Registration Page

**Duration**: 2 hours

**Files**: Create
- app/(public)/register/page.tsx

**Testing**:
- Form displays
- Validation works
- Can register new account
- Redirects to dashboard
- Error handling works
- Already logged in users redirected

**Deployable**: Yes (can register accounts)

### PHASE 3.5: Login Page

**Duration**: 2 hours

**Files**: Create
- app/(public)/login/page.tsx

**Testing**:
- Form displays
- Validation works
- Can login with existing account
- Redirects to dashboard
- Error handling works
- Already logged in users redirected

**Deployable**: Yes (can login accounts)

### PHASE 3.6: Middleware

**Duration**: 1-2 hours

**Files**: Create
- middleware.ts

**Testing**:
- Session refreshes on each request
- Protected routes redirect to /login
- Authenticated users redirected from /login
- Public routes accessible
- Admin routes unaffected
- API routes unaffected

**Deployable**: Yes (now fully protected)

### PHASE 3.7: Dashboard Integration

**Duration**: 1-2 hours

**Files**: Modify
- app/dashboard/layout.tsx (update logout, show user email)
- components/landing/navbar.tsx (update auth buttons)

**Testing**:
- User email displays in dashboard
- Logout button works
- Navbar shows "Sign Out" when logged in
- Navbar shows "Sign In" when logged out
- Navigation works

**Deployable**: Yes (dashboard integrated)

### PHASE 3.8: Password Reset

**Duration**: 2-3 hours (OPTIONAL - can be Phase 3.5)

**Files**: Create
- app/(public)/forgot-password/page.tsx
- app/(public)/reset-password/page.tsx

**Testing**:
- Can request password reset
- Email sent with link
- Can click link and reset password
- Validation works
- Redirects to login after reset

**Deployable**: Yes (but optional for MVP)

### Phase Breakdown

**MVP (Required for launch)**:
- Phase 3.1: Components
- Phase 3.2: Utilities
- Phase 3.3: Layout
- Phase 3.4: Register
- Phase 3.5: Login
- Phase 3.6: Middleware
- Phase 3.7: Dashboard
- Total: ~13-15 hours

**Enhancement (Post-MVP)**:
- Phase 3.8: Password Reset
- Total: +2-3 hours

**Each phase is independently testable and deployable**

---

## SIGN-OFF

**Inspection Complete**: Yes
**Plan Comprehensive**: Yes
**Risk Assessment**: Low
**Backward Compatibility**: 100%
**All 12 Sections Provided**: Yes

**Status**: AWAITING APPROVAL TO PROCEED WITH IMPLEMENTATION

