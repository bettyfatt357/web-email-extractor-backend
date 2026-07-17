## Authentication Flow Diagrams - Visual Reference

---

## 1. Current Flow (Broken with Email Verification Enabled)

```
User signup request
        ↓
  /register page
        ↓
  form.onSubmit()
        ↓
  useAuth.signUp()
        ↓
  authApi.signUp(email, password)
        ↓
  Supabase API
  ├─ Create user (unverified)
  ├─ Send email to /auth/callback?code=xyz
  └─ Return: { user, session: null }
        ↓
  useAuth.handleSignUp()
  ├─ Set user state ✓
  ├─ Detect: no session ✗
  └─ Return (wait for redirect)
        ↓
  Register page calls router.push('/dashboard')
        ↓
  Middleware intercepts request
  ├─ Check: has session? NO ✗
  ├─ Check: path is /dashboard? YES
  └─ Redirect to /login
        ↓
  ✗ BROKEN: User redirected to login
  ✗ User never sees "check email" message
  ✗ User confused
```

---

## 2. Required New Flow (With Email Verification)

### Phase A: Signup to Verification Message

```
User signup request
        ↓
  /register page
        ↓
  form.onSubmit()
        ↓
  useAuth.signUp()
        ↓
  authApi.signUp(email, password)
        ↓
  Supabase API
  ├─ Create user (email_verified_at = null)
  ├─ Send verification email:
  │  └─ Link: https://domain/auth/callback?code=xyz&email=user@...
  └─ Return: { user, session: null }
        ↓
  useAuth.handleSignUp()
  ├─ Set user state
  ├─ Detect: session is null
  └─ Set verificationPending = true
        ↓
  /register page conditional render
  ├─ If verificationPending:
  │  ├─ Hide form
  │  └─ Show verification message:
  │     ├─ ✓ Account created!
  │     ├─ 📧 Email sent to: user@example.com
  │     ├─ Check your email for verification link
  │     └─ [Resend button - optional]
  └─ User sees message and checks email
```

**Timeline**: User sees message immediately, email arrives in seconds

---

### Phase B: Email Verification Link Clicked

```
User clicks email verification link
        ↓
  Browser navigates to:
  https://domain/auth/callback?code=xyz&email=user@example.com
        ↓
  Middleware checks:
  ├─ Is path /auth/callback? YES ✓
  ├─ Is it in public routes? YES ✓
  └─ Allow access (don't require session)
        ↓
  /auth/callback/page.tsx (NEW)
  ├─ useSearchParams() extracts:
  │  ├─ code: "xyz"
  │  └─ email: "user@example.com"
  └─ useEffect() runs immediately
        ↓
  verifyEmailOtp(email, code)
        ↓
  authApi.verifyEmailOtp()
  └─ Calls Supabase auth.verifyOtp()
        ↓
  Supabase API
  ├─ Validate OTP token (checks expiry, format)
  ├─ Update user: email_verified_at = now
  ├─ Create session
  └─ Return: { user, session { access_token, ... } }
        ↓
  useAuth hook:
  ├─ Receives session
  ├─ Session saved to httpOnly cookie (automatic)
  ├─ user state updated
  └─ isAuthenticated = true
        ↓
  /auth/callback page shows:
  ├─ ✓ Email verified successfully!
  ├─ Redirecting to dashboard...
  └─ setTimeout(() => router.push('/dashboard'), 2000)
        ↓
  Browser redirects to /dashboard
        ↓
  Middleware checks session:
  ├─ Has session? YES ✓
  └─ Allow access
        ↓
  Dashboard layout shows user content
  ├─ User email in header
  ├─ Sidebar menu accessible
  └─ User can use app
```

**Timeline**: User clicks link, verifies in ~1 second, redirects to dashboard

---

## 3. Error Scenarios

### Scenario A: User Clicks Expired Link (>24 hours)

```
User clicks verification link (expired)
        ↓
  /auth/callback?code=old_code
        ↓
  verifyEmailOtp(email, old_code)
        ↓
  Supabase API
  ├─ Validate code
  ├─ Check: expiry time? > 24 hours AGO ✗
  └─ Return error: "Invalid or expired verification code"
        ↓
  /auth/callback catches error
        ↓
  Page displays error UI:
  ├─ ❌ Verification link expired
  ├─ ⏱️ Links expire after 24 hours
  ├─ [Resend verification email button]
  └─ [Back to sign in link]
        ↓
  User clicks [Resend]
        ↓
  New verification email sent
  └─ User gets fresh link
```

---

### Scenario B: User Enters Wrong Email Address

```
User manually types URL wrong:
  /auth/callback?code=xyz&email=wrong@example.com
        ↓
  verifyEmailOtp(wrong@example.com, xyz)
        ↓
  Supabase API
  ├─ Code xyz is valid
  ├─ But: email mismatch with code
  └─ Return error: "Email does not match verification code"
        ↓
  /auth/callback shows:
  ├─ ❌ Verification failed
  ├─ This link is for a different email address
  ├─ [Try again with correct email]
  └─ [Contact support]
```

---

### Scenario C: User Signs Up, Deletes Account, Clicks Old Link

```
User 1 signs up as user@example.com
        ↓
Verification email sent
        ↓
User 1 deletes account before verifying
        ↓
User 2 signs up as user@example.com (same email)
        ↓
User 1 clicks old verification link
        ↓
Supabase API:
├─ Code xyz is valid (old code for old user)
├─ But: code bound to old user (now deleted)
└─ Return error: "User not found"
        ↓
/auth/callback shows:
├─ ❌ Account not found
├─ This account was deleted or doesn't exist
└─ [Sign up again] [Contact support]
```

---

## 4. Component State Diagram

```
/register page state:

┌─────────────────────────────────────┐
│      INITIAL STATE                  │
│  ├─ formData: empty                 │
│  ├─ isSubmitting: false             │
│  ├─ verificationPending: false      │
│  ├─ error: null                     │
│  └─ Display: FORM                   │
└────────────┬────────────────────────┘
             │
             ▼ [User submits form]
┌─────────────────────────────────────┐
│      SUBMITTING STATE               │
│  ├─ formData: filled                │
│  ├─ isSubmitting: true              │
│  ├─ verificationPending: false      │
│  ├─ error: null                     │
│  └─ Display: LOADING BUTTON         │
└────────────┬────────────────────────┘
             │
             ▼ [signUp() returns]
┌──────────────────────────────────────┐
│      SUCCESS - WAITING VERIFICATION  │
│  ├─ formData: filled                 │
│  ├─ isSubmitting: false              │
│  ├─ verificationPending: true        │
│  ├─ error: null                      │
│  └─ Display: VERIFICATION MESSAGE   │
│             "Check your email..."    │
└──────────────────────────────────────┘

            OR

┌──────────────────────────────────────┐
│      ERROR STATE                     │
│  ├─ formData: filled                 │
│  ├─ isSubmitting: false              │
│  ├─ verificationPending: false       │
│  ├─ error: "Email already in use"    │
│  └─ Display: FORM + ERROR ALERT      │
└──────────────────────────────────────┘
```

---

## 5. /auth/callback Component State Diagram

```
/auth/callback/page.tsx state:

┌─────────────────────────────────────┐
│      MOUNTING                       │
│  ├─ searchParams loaded             │
│  ├─ code extracted                  │
│  ├─ email extracted                 │
│  └─ Display: LOADING STATE          │
│             "Verifying email..."    │
└────────────┬────────────────────────┘
             │
             ▼ [verifyEmailOtp() called]
┌─────────────────────────────────────┐
│      VERIFYING                      │
│  ├─ Loading: true                   │
│  ├─ Error: null                     │
│  └─ Display: "Verifying..."         │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐    ┌──────────────┐
│ SUCCESS │    │    ERROR     │
└────┬────┘    └──────┬───────┘
     │                 │
     ▼                 ▼
┌──────────────┐ ┌───────────────┐
│ Email        │ │ Error Alert   │
│ Verified!    │ │ ├─ Message    │
│ [Redirect]   │ │ ├─ Retry btn  │
│              │ │ └─ Back link  │
└──────────────┘ └───────────────┘
     │
     ▼ [2 second delay]
  /dashboard
```

---

## 6. Session Management Throughout Flow

```
Timeline of Session State:

SIGNUP PAGE:
├─ User not authenticated
├─ session: null
├─ user: null
├─ Can view: /register ✓
└─ Can view: /dashboard ✗ (redirected to /login)

AFTER SIGNUP (before verification):
├─ User profile created in Supabase
├─ session: null (email not verified)
├─ user: { id, email } (from signup response)
├─ Can view: /register ✓
└─ Can view: /dashboard ✗ (redirected to /login)

VERIFICATION PAGE:
├─ User clicks email link
├─ Enters /auth/callback
├─ session: null (still, before verification completes)
├─ Can view: /auth/callback ✓ (public route)
└─ Can view: /dashboard ✗ (no session yet)

AFTER VERIFICATION COMPLETES:
├─ Supabase creates session
├─ session: { access_token, refresh_token, ... }
├─ user: { id, email, email_verified_at: now }
├─ Cookie saved: httpOnly, secure
├─ Can view: /dashboard ✓ (middleware checks session)

AFTER REDIRECT TO DASHBOARD:
├─ Browser has session cookie
├─ Middleware validates on every request
├─ Can view: /dashboard ✓
├─ Can view: /login ✗ (already authenticated, redirect to /dashboard)
└─ User fully authenticated

AFTER LOGOUT:
├─ Session cleared
├─ Cookie deleted
├─ user: null
├─ Can view: /register ✓
└─ Can view: /dashboard ✗ (redirected to /login)
```

---

## 7. Data Flow Through Components

```
USER DATA FLOW:

signUp() function
├─ Input: email, password
├─ Output: { user, session }
└─ Stored in: useAuth state

useAuth hook
├─ Stores: user, isLoading, error
├─ Triggers: onAuthStateChange subscription
└─ Provides: signUp, signIn, signOut methods

useAuth state in /register
├─ user → triggers redirect if authenticated
├─ error → shows error alert if signup fails
└─ When signup returns without session:
   └─ verificationPending state set to true

/register page render
├─ If verificationPending:
│  └─ Show: "Check your email" message
└─ Else:
   └─ Show: signup form

/auth/callback page
├─ Reads: searchParams (code, email)
├─ Calls: verifyEmailOtp(email, code)
├─ Gets: { user, session }
├─ Middleware detects session
├─ Updates: useAuth state
└─ Redirects: to /dashboard

Dashboard
├─ Checks: useAuth user state
├─ If no user → redirects to /login
├─ If user exists → shows dashboard
└─ Displays: user.email in header
```

---

## 8. Key Routes and Their Requirements

```
ROUTE MATRIX:

/              (Landing)
├─ Session required: NO
├─ Public: YES
└─ Authenticated user sees: redirect to /dashboard

/register      (Signup form)
├─ Session required: NO
├─ Public: YES
└─ Authenticated user sees: redirect to /dashboard

/login         (Login form)
├─ Session required: NO
├─ Public: YES
└─ Authenticated user sees: redirect to /dashboard

/auth/callback (Email verification - NEW)
├─ Session required: NO
├─ Public: YES
├─ Query params: code, email
└─ After success: creates session → redirects to /dashboard

/dashboard     (Protected)
├─ Session required: YES
├─ Public: NO
├─ No session → redirect to /login
└─ Authenticated user sees: dashboard content

/forgot-password (Password reset)
├─ Session required: NO
├─ Public: YES
└─ Not in current scope
```

---

## 9. Error Message Hierarchy

```
SIGNUP ERRORS:

Email validation
├─ "Please enter a valid email"
└─ Type: validation

Email already exists
├─ "This email is already registered"
├─ "Go to login" link
└─ Type: business logic

Password validation
├─ "Password must be at least 8 characters"
├─ "Passwords must match"
└─ Type: validation

Network/Server errors
├─ "Something went wrong. Please try again."
├─ Retry button
└─ Type: system

After signup (if verification pending):
├─ No error - shows success message
└─ Type: success state


VERIFICATION ERRORS:

Expired code
├─ "Verification link expired (24 hour limit)"
├─ Resend button
└─ Type: expected failure

Invalid code
├─ "Verification link is invalid"
├─ Resend button
└─ Type: unexpected failure

Email mismatch
├─ "This link is for a different email"
├─ No resend (user action needed)
└─ Type: user error

User not found
├─ "Account not found or already deleted"
├─ Sign up again link
└─ Type: account issue

Network errors
├─ "Unable to verify email. Please try again."
├─ Retry button
└─ Type: system
```

---

## Summary

**Current Problem**: Signup assumes session → breaks if email verification enabled

**Solution**: 
1. Detect no session after signup → show "check email" message
2. Create /auth/callback route → handle verification link
3. Exchange OTP for session → user gets authenticated
4. Redirect to dashboard → user can access app

**Key New Component**: `/auth/callback/page.tsx` (the missing piece)

