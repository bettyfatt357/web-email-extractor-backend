# Phase 3 Implementation Plan: Supabase Authentication

**Status**: INSPECTION COMPLETE - AWAITING APPROVAL  
**Date**: July 16, 2026  
**Scope**: Authentication UI and Session Management Only

---

## PART 1: PROJECT INSPECTION SUMMARY

### Current State

**Infrastructure**:
- Next.js 16 with App Router
- React 19 with TypeScript
- Tailwind CSS v4 with CSS variables
- Supabase (@supabase/supabase-js@^2.110.7) already installed and connected
- Environment variables configured: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

**Existing Authentication System**:
- API key-based authentication via x-api-key header
- Admin credential system (ADMIN_CREDENTIAL in .env.local)
- lib/auth/middleware.ts - withAuth() and withAdminAuth() middleware
- lib/auth/admin-auth.ts - Admin role validation
- /app/api/auth/me endpoint - Returns user info

**Protected Routes**:
- /app/dashboard/* - 8 pages (dashboard, search, jobs, api-keys, usage, billing, settings, profile)
- /app/admin/* - 8 pages (dashboard, analytics, jobs, queue, security, settings, users, workers)

**UI Components**:
- shadcn/ui: Button and Card components
- Landing page: Navbar, Hero, Features, Workflow, Industries, Stats, Pricing, FAQ, Footer
- Dashboard layout: Sidebar, top navigation, theme toggle, logout button placeholder
- Admin layout: AdminSidebar component

**Design System**:
- 2 font families (system/Inter)
- 3-5 colors: primary dark navy, accent blue, backgrounds, text colors
- Dark mode support via CSS variables
- Responsive layout with Tailwind v4
- Semantic HTML and accessibility patterns

### What Exists

✓ Supabase integration (Phase 1)
✓ Landing page with marketing content (Phase 2)
✓ Existing dashboard and admin systems
✓ API key authentication middleware
✓ Styling system with dark mode
✓ UI components (Button, Card, Icons)
✓ Environment variables configured

### What Does NOT Exist

❌ Supabase Auth UI pages (/login, /register, /forgot-password, /reset-password)
❌ Session persistence/cookies for web users
❌ Protected route middleware for web routes
❌ Auth context/hooks for web UI
❌ Logout functionality for web users
❌ Auth-aware navigation updates
❌ Email verification UI
❌ Password reset flow UI
❌ Loading and error states for auth
❌ Auth state persistence across refreshes

---

## PART 2: AUTHENTICATION ARCHITECTURE

### Design Principles

1. **Separation of Concerns**
   - API authentication (x-api-key header) - REMAINS UNCHANGED
   - Web authentication (Supabase Auth) - NEW
   - Admin authentication (ADMIN_CREDENTIAL) - REMAINS UNCHANGED

2. **Non-Breaking**
   - Existing API key authentication continues working
   - Existing admin authentication continues working
   - No changes to /app/api/*
   - No changes to /app/admin/*
   - No changes to search, extraction, worker, queue systems

3. **Supabase Auth Handles**
   - User registration with email/password
   - User login with email/password
   - Session management (JWT tokens)
   - Password reset flow
   - Email verification (optional)
   - Refresh token management
   - Secure httpOnly cookies
   - User ID tracking

### Authentication Flow

```
Landing Page (/login button)
    ↓
/login page (Supabase login form)
    ↓
User enters email/password
    ↓
Supabase Auth validates & creates session
    ↓
Session cookie set (httpOnly)
    ↓
Redirect to /dashboard
    ↓
Protected middleware checks session
    ↓
Access granted, render dashboard
```

### Session Management Architecture

```
Browser (Client-Side)
├─ Session Cookie (httpOnly, Secure)
│  └─ Created by Supabase on login
│  └─ Auto-managed by browser
│  └─ Cannot be accessed by JavaScript (secure)
│
└─ App State (Optional)
   └─ useAuth() hook tracks login status
   └─ Used for UI updates (navbar, redirects)

Server-Side (Route Handlers & Middleware)
├─ Read session from cookies
├─ Validate session with Supabase
├─ Attach user context to request
└─ Check protected routes
```

### Two-Track Authentication System

**Track 1: API Key Authentication (UNCHANGED)**
```
API Consumer (external)
    ↓
POST /api/search with x-api-key header
    ↓
withAuth() middleware validates key
    ↓
User object created from API key
    ↓
Handler processes request
    ↓
Response returned

Admin:
    GET /api/admin/dashboard with x-api-key: ADMIN_CREDENTIAL
    ↓
withAuth() validates
    ↓
withAdminAuth() checks isAdmin flag
    ↓
Admin data returned
```

**Track 2: Web Session Authentication (NEW)**
```
Web User (browser)
    ↓
Sign in at /login with email/password
    ↓
Supabase creates session
    ↓
Session cookie set (httpOnly)
    ↓
Access /dashboard
    ↓
Middleware reads session cookie
    ↓
Session validated with Supabase
    ↓
User context attached to request
    ↓
Page rendered
```

---

## PART 3: HOW SUPABASE AUTH INTEGRATES

### Supabase Auth Services Used

1. **User Registration** - `supabase.auth.signUp()`
   - Create account with email/password
   - Optional email verification
   - Returns user object with user_id

2. **User Login** - `supabase.auth.signInWithPassword()`
   - Authenticate with email/password
   - Creates session with access token + refresh token
   - Returns user object

3. **Session Management** - `supabase.auth.getSession()`
   - Retrieve current session from cookie
   - Check if user is authenticated
   - Get user_id for logged-in user

4. **Logout** - `supabase.auth.signOut()`
   - Clear session
   - Remove httpOnly cookie
   - Clear local state

5. **Password Reset** - `supabase.auth.resetPasswordForEmail()`
   - Send reset email with link
   - Reset handled by /reset-password page

6. **Auth State Listener** - `supabase.auth.onAuthStateChange()`
   - Subscribe to auth state changes
   - Triggered on login, logout, session refresh
   - Used to update UI and persist state

### Integration Points

**Phase 1 Infrastructure (Already Done)**
- `lib/supabase/client.ts` - Lazy-loaded Supabase client
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/supabase/utils.ts` - Connectivity verification
- Environment variables configured

**Phase 3 Additions (This Phase)**
- `lib/supabase/auth.ts` (NEW) - Auth-specific functions (signUp, signIn, signOut, getUser, etc.)
- `lib/supabase/server-auth.ts` (NEW) - Server-side session validation
- `hooks/use-auth.ts` (NEW) - Client-side auth hook
- `app/(public)/layout.tsx` (NEW) - Public routes layout
- `app/(public)/login/page.tsx` (NEW) - Login form
- `app/(public)/register/page.tsx` (NEW) - Registration form
- `app/(public)/forgot-password/page.tsx` (NEW) - Forgot password form
- `app/(public)/reset-password/page.tsx` (NEW) - Reset password form
- `components/auth/auth-form.tsx` (NEW) - Reusable auth form component
- `middleware.ts` (MODIFIED) - Add Supabase session refresh

---

## PART 4: EVERY FILE THAT WILL BE CREATED

### New Supabase Auth Utilities

**1. lib/supabase/auth.ts** (120 lines)
```
Purpose: Supabase Auth API wrapper
Exports:
  - signUp(email, password) - Register new user
  - signIn(email, password) - Login user
  - signOut() - Logout user
  - getUser() - Get current user
  - resetPasswordForEmail(email) - Send reset email
  - updatePassword(newPassword) - Change password
```

**2. lib/supabase/server-auth.ts** (80 lines)
```
Purpose: Server-side session handling
Exports:
  - getServerSession() - Get session from request cookies
  - validateServerSession() - Verify session with Supabase
  - refreshServerSession() - Refresh expired session
```

**3. hooks/use-auth.ts** (100 lines)
```
Purpose: Client-side auth hook for components
Exports:
  - useAuth() - Returns { user, isLoading, signIn, signOut, signUp }
  - useProtectedRoute() - Redirect if not authenticated
```

### New Authentication Pages

**4. app/(public)/layout.tsx** (60 lines)
```
Purpose: Layout for public auth routes
Features:
  - No sidebar/navigation (just nav back to home)
  - Centered card layout
  - Responsive design
  - Dark mode support
```

**5. app/(public)/login/page.tsx** (80 lines)
```
Purpose: Login page
Features:
  - Email input
  - Password input
  - "Sign In" button
  - Loading state
  - Error message display
  - "Forgot password?" link
  - "Don't have account? Register" link
  - Form validation
  - Submit handler
```

**6. app/(public)/register/page.tsx** (100 lines)
```
Purpose: Registration page
Features:
  - Email input
  - Password input
  - Confirm password input
  - "Create Account" button
  - Loading state
  - Error message display
  - Password strength indicator
  - "Already have account? Sign In" link
  - Terms & conditions checkbox
  - Form validation
  - Submit handler
```

**7. app/(public)/forgot-password/page.tsx** (70 lines)
```
Purpose: Forgot password page
Features:
  - Email input
  - "Send Reset Email" button
  - Loading state
  - Success message after email sent
  - "Back to Login" link
  - Form validation
```

**8. app/(public)/reset-password/page.tsx** (90 lines)
```
Purpose: Reset password page (from email link)
Features:
  - New password input
  - Confirm password input
  - "Update Password" button
  - Loading state
  - Success message
  - Error handling (invalid/expired token)
  - Redirect to login after success
  - Form validation
```

### New Reusable Components

**9. components/auth/auth-form.tsx** (120 lines)
```
Purpose: Shared form component for auth pages
Features:
  - Form fields (email, password, etc.)
  - Validation feedback
  - Error display
  - Loading state with disabled button
  - Submit handler
  - Variant support (login, register, forgot-password, reset)
```

**10. components/auth/error-alert.tsx** (40 lines)
```
Purpose: Reusable error display component
Features:
  - Error message display
  - Clearable state
  - Styled with destructive color
```

**11. components/auth/loading-spinner.tsx** (30 lines)
```
Purpose: Loading indicator for form submission
Features:
  - Spinner animation
  - Optional text label
```

### Protected Routes Wrapper

**12. components/protected-route.tsx** (60 lines)
```
Purpose: Client-side route protection component
Features:
  - Check if user is authenticated
  - Show loading while checking
  - Redirect to /login if not authenticated
  - Render children if authenticated
```

**13. middleware.ts** (100 lines - MODIFIED to add)
```
Purpose: Route protection at request level
Features:
  - Refresh Supabase session on each request
  - Redirect unauthenticated users from /dashboard to /login
  - Allow public routes
  - Allow API routes
```

### Total New Files: 13

---

## PART 5: EVERY FILE THAT WILL BE MODIFIED

### 1. **app/layout.tsx** (MINIMAL CHANGE - +5 lines)
```
Current: Root layout with Vercel Analytics
Changes:
  - Import Supabase auth provider (NEW)
  - Wrap children with <AuthProvider> (NEW)
  - Rest unchanged
```

### 2. **components/landing/navbar.tsx** (MODIFIED - +15 lines)
```
Current: Navigation with hardcoded /dashboard links
Changes:
  - Import useAuth() hook (NEW)
  - Show "Sign Out" if authenticated (NEW)
  - Show "Sign In / Get Started" if not authenticated (NEW)
  - Update logout handler to call auth.signOut() (NEW)
  - Conditional rendering based on auth state
```

### 3. **app/dashboard/layout.tsx** (MODIFIED - +10 lines)
```
Current: Dashboard layout with placeholder logout
Changes:
  - Import useAuth() hook (NEW)
  - Update logout button handler to call auth.signOut() (NEW)
  - Show current user email in header (NEW)
  - Redirect to /login if not authenticated (uses protected-route wrapper)
```

### 4. **middleware.ts** (NEW FILE - 100 lines)
```
Purpose: Request-level route protection
Responsibilities:
  - Refresh Supabase session on each request
  - Protect /dashboard/* routes
  - Redirect /dashboard to /login if not authenticated
  - Allow /login, /register, /forgot-password, /reset-password
  - Allow public routes (/, /features, etc.)
  - Allow API routes /api/*
```

### Total Modified Files: 4

---

## PART 6: EVERY ROUTE ADDED

### Public Routes (NEW)

1. **GET /login**
   - Display login form
   - Allow unauthenticated access
   - Redirect to /dashboard if already logged in

2. **GET /register**
   - Display registration form
   - Allow unauthenticated access
   - Redirect to /dashboard if already logged in

3. **GET /forgot-password**
   - Display forgot password form
   - Allow unauthenticated access

4. **GET /reset-password**
   - Display reset password form
   - Allow unauthenticated access
   - Query params: token, email (from email link)

### Route Changes

- **GET / (root)** - UNCHANGED (landing page still accessible)
- **GET /dashboard** - PROTECTED (redirect to /login if not authenticated)
- **GET /dashboard/*** - PROTECTED (redirect to /login if not authenticated)
- **GET /admin/*** - UNCHANGED (still uses API key auth)
- **GET /api/*** - UNCHANGED (still uses x-api-key header)

---

## PART 7: MIDDLEWARE ARCHITECTURE

### middleware.ts (NEW FILE)

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // 1. Create Supabase server client
  let response = NextResponse.next()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getSetCookie() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  
  // 2. Refresh session (auto-refreshes if needed)
  await supabase.auth.getSession()
  
  // 3. Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  // 4. Redirect authenticated users from auth pages to dashboard
  if (request.nextUrl.pathname === '/login' || 
      request.nextUrl.pathname === '/register') {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
```

**Responsibilities**:
- Refresh Supabase session on every request
- Protect /dashboard routes
- Redirect authenticated users from /login to /dashboard
- Allow public routes and API routes
- Update response cookies

---

## PART 8: SESSION MANAGEMENT

### How Session Persistence Works

**On Login**:
1. User submits email/password at /login
2. Supabase.auth.signInWithPassword() called
3. Session created with access token + refresh token
4. Supabase sets httpOnly cookie (Secure, SameSite)
5. Redirect to /dashboard

**On Page Reload**:
1. Browser sends httpOnly cookie with request
2. middleware.ts receives request
3. Supabase reads cookie, validates session
4. Session auto-refreshed if needed
5. Request proceeds to page handler

**On Tab Switch**:
1. useAuth hook listens for auth state changes
2. If session expired, hook refreshes it
3. UI updated with new state

**On Logout**:
1. User clicks logout button
2. useAuth.signOut() called
3. Supabase.auth.signOut() clears session
4. Cookie removed by Supabase
5. Redirect to /login

---

## PART 9: PROTECTED ROUTES IMPLEMENTATION

### Strategy 1: Route-Level Protection (middleware.ts)

```
// middleware.ts redirects /dashboard → /login if not authenticated
```

**Pros**:
- Server-side, cannot be bypassed
- Single source of truth
- No multiple checks needed

**Cons**:
- All /dashboard routes protected together
- Cannot have selective protection

### Strategy 2: Component-Level Protection (protectedRoute wrapper)

```
// components/protected-route.tsx wraps page components
```

**Pros**:
- Fine-grained control per page
- Can show custom loading/error UI
- Client-side user experience

**Cons**:
- Can be bypassed if implemented incorrectly
- Requires wrapper on each page

### Implementation (BOTH)

1. **Server-side** (middleware.ts) - Primary protection
   - Redirects to /login at request level
   - Cannot be bypassed
   - Handles session validation

2. **Client-side** (useAuth hook + redirects in page components)
   - Shows loading state while auth check happens
   - Better user experience
   - Shows error if auth fails
   - Complements server-side protection

**Flow**:
```
User requests /dashboard
    ↓
middleware.ts checks session
    ↓
If no session: Redirect to /login
If session: Allow request to page
    ↓
Dashboard page component loads
    ↓
useAuth() hook loads user data
    ↓
Page renders with user info
```

---

## PART 10: LOGIN PERSISTENCE

### Persistence Strategy

**httpOnly Cookies** (Primary):
- Supabase automatically sets httpOnly cookie on login
- Browser auto-sends cookie on each request
- Cannot be accessed by JavaScript (secure)
- Survives page reload and tab close
- Survives browser restart (if "Remember me" implemented)

**Refresh Token Flow**:
- Access token: Short-lived (1 hour)
- Refresh token: Stored in httpOnly cookie
- Automatic refresh: middleware.ts calls getSession() on each request
- If access token expired: Supabase auto-refreshes using refresh token

**Session Sync Across Tabs**:
- Supabase auth.onAuthStateChange() listener notifies all tabs
- useAuth hook subscribes to changes
- UI updates immediately when auth state changes

### No localStorage for Sensitive Data

- Session tokens NOT stored in localStorage (secure)
- Only non-sensitive metadata stored in localStorage (optional)
- All sensitive operations use Supabase managed cookies

---

## PART 11: LOGOUT IMPLEMENTATION

**Logout Handler**:
```typescript
async function handleLogout() {
  setLoading(true)
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    setError('Logout failed')
  } else {
    router.push('/login')
  }
  setLoading(false)
}
```

**What Happens**:
1. signOut() called
2. Supabase clears session
3. httpOnly cookie deleted
4. Local state cleared
5. Redirect to /login
6. middleware.ts prevents accessing /dashboard

---

## PART 12: PASSWORD RESET IMPLEMENTATION

### Password Reset Flow

1. **User at /forgot-password page**
   - Enters email address
   - Clicks "Send Reset Email"

2. **Backend**
   - Supabase.auth.resetPasswordForEmail(email) called
   - Supabase sends email with reset link
   - Link contains token: `/reset-password?token=xxx&email=user@example.com`

3. **User clicks link in email**
   - Redirected to `/reset-password?token=xxx&email=user@example.com`
   - Page shows "New Password" form

4. **User submits new password**
   - Supabase.auth.updateUser({ password: newPassword }) called
   - Supabase verifies token (embedded in session from link)
   - Password updated
   - Session cleared
   - Redirect to /login

### Security**:
- Token embedded in URL is one-time use
- Token expires after 24 hours
- Password hashing handled by Supabase
- No plain text passwords transmitted

---

## PART 13: EMAIL VERIFICATION IMPLEMENTATION

### Email Verification Flow (Optional)

**If email verification enabled in Supabase**:
1. User registers → Supabase sends verification email
2. User clicks link in email
3. Email verified
4. User can now login

**If email verification disabled** (recommended for MVP):
1. User registers → Account immediately active
2. User can login immediately
3. No email verification step

**Implementation**:
- Configuration in Supabase dashboard (not in code)
- Supabase handles verification emails
- We only display: "Check your email" message on register page

---

## PART 14: ERROR HANDLING STRATEGY

### Error Types & Responses

**1. Invalid Credentials**
```
User enters wrong email/password
    ↓
Supabase returns: invalid_grant error
    ↓
Display: "Invalid email or password"
```

**2. Account Not Found**
```
User enters email that doesn't exist
    ↓
Supabase returns: invalid_grant error
    ↓
Display: "Invalid email or password" (generic for security)
```

**3. Email Already Registered**
```
User tries to register with existing email
    ↓
Supabase returns: user_already_exists error
    ↓
Display: "Email already registered. Sign in instead?"
```

**4. Weak Password**
```
User enters password < 6 characters
    ↓
Supabase returns: weak_password error
    ↓
Display: "Password must be at least 6 characters"
```

**5. Session Expired**
```
User's access token expired
    ↓
Middleware calls getSession()
    ↓
Supabase auto-refreshes using refresh token
    ↓
Session continues
OR
    ↓
If refresh token also expired: Redirect to /login
    ↓
Display: "Session expired. Please sign in again."
```

**6. Network Error**
```
User loses internet connection
    ↓
Try-catch in auth function
    ↓
Display: "Network error. Please check your connection."
```

### Error Display Component

```typescript
// components/auth/error-alert.tsx
export function ErrorAlert({ error, onDismiss }: Props) {
  if (!error) return null
  
  return (
    <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex justify-between">
      <span>{error}</span>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  )
}
```

---

## PART 15: LOADING STATES STRATEGY

### Loading States

1. **Form Submission**
   - Button disabled
   - Loading spinner shown
   - "Creating account..." text
   - Form inputs disabled

2. **Route Protection**
   - Loading spinner shown
   - "Checking authentication..." message
   - Redirect after check completes

3. **Password Reset Email Send**
   - Button disabled
   - Loading spinner
   - Success message: "Check your email for reset link"

4. **Session Refresh**
   - Silent background refresh
   - No loading indicator shown
   - User unaware of refresh unless it fails

### Implementation Pattern

```typescript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

async function handleSubmit() {
  setIsLoading(true)
  setError(null)
  
  try {
    await someAuthFunction()
  } catch (err) {
    setError(err.message)
  } finally {
    setIsLoading(false)
  }
}

return (
  <form onSubmit={handleSubmit}>
    <input disabled={isLoading} />
    <button disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Submit'}
    </button>
    {error && <ErrorAlert error={error} />}
  </form>
)
```

---

## PART 16: SECURITY CONSIDERATIONS

### What Supabase Handles

✓ Password hashing (bcrypt)
✓ Secure token generation
✓ httpOnly cookie security
✓ CSRF protection (token in request)
✓ Rate limiting on auth endpoints
✓ Email verification (if enabled)
✓ Password reset token expiration
✓ Refresh token rotation

### What We Must Do

✓ Never log passwords
✓ Never store tokens in localStorage
✓ Always use HTTPS in production
✓ Validate input on forms (client-side)
✓ Validate input on backend (server-side)
✓ Never expose sensitive errors ("user not found" vs "invalid credentials")
✓ Use middleware to protect routes (not just client-side redirects)

### Attack Vectors Mitigated

**SQL Injection**: Supabase ORM prevents this
**XSS**: httpOnly cookies prevent JavaScript access
**CSRF**: Supabase includes CSRF tokens
**Session Hijacking**: Short-lived tokens + refresh token rotation
**Brute Force**: Supabase rate limits login attempts
**Credential Exposure**: Client-side validation catches obvious mistakes

---

## PART 17: RISK ASSESSMENT

### Risk Level: LOW

**Why Low Risk**:
1. No changes to API authentication (API key auth remains intact)
2. No changes to admin authentication (ADMIN_CREDENTIAL remains intact)
3. No changes to backend business logic
4. No changes to search/extraction/worker systems
5. No database schema changes needed (Supabase Auth tables auto-created)
6. Isolated to new files in app/(public)/*
7. Middleware only adds session refresh + route redirects

### Potential Issues & Mitigation

**Issue**: User cannot logout properly
- **Risk**: Low (Supabase handles logout)
- **Mitigation**: Test logout flow thoroughly, verify cookie is deleted

**Issue**: Session doesn't persist across page reloads
- **Risk**: Low (Supabase auto-manages cookies)
- **Mitigation**: Test browser refresh, verify middleware works

**Issue**: API key auth breaks after adding Supabase auth
- **Risk**: Very Low (API auth completely separate)
- **Mitigation**: Test API endpoints with x-api-key header after deployment

**Issue**: Admin dashboard broken
- **Risk**: Very Low (uses different auth track)
- **Mitigation**: Test admin access with ADMIN_CREDENTIAL after deployment

**Issue**: Existing users cannot login (API key users)
- **Risk**: Non-issue (web and API users separate)
- **Mitigation**: Document difference between API users and web users

---

## PART 18: BACKWARD COMPATIBILITY ASSESSMENT

### What Remains 100% Unchanged

✓ **API Layer** (/app/api/*)
  - All endpoints still work with x-api-key header
  - No changes to request/response format
  - No changes to authorization logic
  - Admin endpoints still use ADMIN_CREDENTIAL

✓ **Admin Dashboard** (/app/admin/*)
  - Still uses ADMIN_CREDENTIAL authentication
  - Still accessible at same URL
  - No UI changes
  - No functionality changes

✓ **Dashboard** (/app/dashboard/*)
  - Pages themselves unchanged
  - Only navbar updated to show user email + logout button
  - Logout handler changed (now calls Supabase)

✓ **Search System** (/lib/search/*)
  - Completely untouched
  - Still works via API routes
  - No integration with auth system

✓ **Extraction Engine** (/lib/extraction/*)
  - Completely untouched
  - Still works via workers
  - No integration with auth system

✓ **Worker System** (/lib/worker/*, /lib/queue/*)
  - Completely untouched
  - Still processes jobs
  - No integration with auth system

✓ **Redis** (Upstash)
  - Completely untouched
  - Still manages queue
  - No integration with auth system

### Backward Compatibility: 100% MAINTAINED

---

## PART 19: TESTING STRATEGY

### Manual Testing Checklist

**Authentication Flow**:
- [ ] Can register new account at /register
- [ ] Registration form validates (empty fields, weak password)
- [ ] After registration, auto-logged in (redirected to /dashboard)
- [ ] Can logout from dashboard
- [ ] After logout, redirected to /login
- [ ] Cannot access /dashboard without login (redirected to /login)

**Login Flow**:
- [ ] Can login at /login with correct credentials
- [ ] After login, redirected to /dashboard
- [ ] Login form rejects wrong credentials
- [ ] Login form shows error message

**Password Reset**:
- [ ] Can request password reset at /forgot-password
- [ ] Email received with reset link
- [ ] Can click link and reset password
- [ ] Can login with new password

**Session Persistence**:
- [ ] After login, can refresh page without losing session
- [ ] Session persists across tabs/windows
- [ ] Logout on one tab logs out all tabs

**Existing Systems**:
- [ ] API key authentication still works (test with curl)
- [ ] Admin dashboard still accessible with ADMIN_CREDENTIAL
- [ ] Search API still works via API key
- [ ] Jobs still process
- [ ] Workers still running

**Dark Mode**:
- [ ] Auth pages work in light mode
- [ ] Auth pages work in dark mode
- [ ] Theme persists across pages

**Responsive**:
- [ ] Auth forms work on mobile
- [ ] Auth forms work on tablet
- [ ] Auth forms work on desktop

### Automated Testing (Out of Scope for Phase 3)
- Unit tests for auth functions
- Integration tests for Supabase API
- End-to-end tests for auth flows

---

## PART 20: ROLLBACK STRATEGY

### If Phase 3 Causes Issues

**Rollback Steps**:

1. **Remove Supabase Auth**
   - Delete /app/(public)/* files
   - Remove middleware.ts
   - Revert navbar.tsx changes
   - Revert dashboard layout changes

2. **Restore API Key Auth Only**
   - /dashboard still accessible via API key in localStorage
   - /admin still works with ADMIN_CREDENTIAL
   - All systems back to pre-Phase 3 state

3. **Time to Rollback**: 5 minutes (simple file deletions)

4. **No Data Loss**:
   - Supabase users created during testing can remain or be deleted
   - No database schema changes
   - API data untouched
   - Job queue untouched

### No Breaking Changes by Design

- Rollback is clean because Phase 3 is purely additive
- No existing files modified except navbar + layouts (easy to revert)
- No database migrations
- No API changes

---

## PART 21: IMPLEMENTATION SUMMARY

### Files to Create (13)

Supabase utilities (3):
- lib/supabase/auth.ts
- lib/supabase/server-auth.ts
- hooks/use-auth.ts

Authentication pages (4):
- app/(public)/layout.tsx
- app/(public)/login/page.tsx
- app/(public)/register/page.tsx
- app/(public)/forgot-password/page.tsx
- app/(public)/reset-password/page.tsx

Components (3):
- components/auth/auth-form.tsx
- components/auth/error-alert.tsx
- components/auth/loading-spinner.tsx
- components/protected-route.tsx

Middleware (1):
- middleware.ts

### Files to Modify (4)

- app/layout.tsx (+5 lines)
- components/landing/navbar.tsx (+15 lines)
- app/dashboard/layout.tsx (+10 lines)
- middleware.ts (NEW - 100 lines)

### Routes Added (4 Public, 1 Middleware Layer)

- /login
- /register
- /forgot-password
- /reset-password
- Middleware protects /dashboard/*

### No Breaking Changes

✓ 100% backward compatible
✓ All existing systems unchanged
✓ Zero impact on API authentication
✓ Zero impact on admin authentication
✓ Zero impact on search/workers/extraction
✓ Easy rollback if needed

---

## APPROVAL GATES

**Confirm before implementation**:

- [ ] Supabase Auth handles registration, login, logout, password reset
- [ ] Session managed via httpOnly cookies (not localStorage)
- [ ] Protected routes via middleware.ts + component wrappers
- [ ] New files in app/(public)/* for auth pages
- [ ] API key authentication completely untouched
- [ ] Admin authentication completely untouched
- [ ] No database schema changes
- [ ] Dark mode support included
- [ ] Responsive design included
- [ ] Error handling for all failure cases
- [ ] Loading states for all async operations
- [ ] Security best practices followed
- [ ] Backward compatible 100%
- [ ] Easy to rollback if needed

---

## NEXT STEPS

### Upon Approval

1. Create Supabase auth utility functions
2. Create authentication pages (/login, /register, etc.)
3. Create reusable auth components
4. Add middleware.ts for route protection
5. Update navbar to use auth
6. Update dashboard layout to use auth
7. Update root layout with auth provider
8. Manual testing of all flows
9. Verify existing systems still work
10. Deploy to production

### Do NOT Proceed Until Approved

- Do not write code
- Do not modify files
- Do not create routes
- Do not add middleware
- Do not change navbar

---

**STATUS**: INSPECTION AND PLANNING COMPLETE

Plan is comprehensive and ready for user review and approval.

