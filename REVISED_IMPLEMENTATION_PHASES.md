# Revised Implementation Plan: Separate Phases with Managed Authentication

**Date**: July 16, 2026  
**Architecture**: Supabase Auth + Redis Queue + Next.js UI  
**Approach**: Hybrid authentication (Supabase for web UI, API keys for API consumers)

---

## OVERVIEW

### Three Distinct Products

1. **Public Website** (Public, no auth)
   - Landing page
   - Marketing content
   - Pricing information

2. **Authentication System** (Web-based)
   - Login/Register
   - Password reset
   - Session management
   - Using Supabase Auth

3. **Business Discovery Dashboard** (Authenticated web UI)
   - Search interface
   - Results display
   - Job management
   - Search history

### Four Distinct User Types

1. **Anonymous Visitor** → Public website
2. **Web User** → Login with email/password via Supabase → Dashboard
3. **API Consumer** → Use API key → Search API (existing)
4. **Admin** → Manage users, quotas, settings → Admin panel

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                     │
├─────────────────────────────────────────────────────────┤
│  Landing    │    Auth Pages    │    Dashboard Pages    │
│  (public)   │  (public)        │   (protected)         │
└─────────────────────────────────────────────────────────┘
              │                           │
              ↓                           ↓
    ┌─────────────────┐      ┌──────────────────────┐
    │  Supabase Auth  │      │   Next.js API Routes │
    │                 │      │                      │
    │ • User accounts │      │ • /api/search        │
    │ • Sessions      │      │ • /api/jobs          │
    │ • Email reset   │      │ • /api/auth/logout   │
    └─────────────────┘      └──────────────────────┘
              │                           │
              ↓                           ↓
    ┌─────────────────┐      ┌──────────────────────┐
    │   PostgreSQL    │      │   Redis Queue        │
    │   (Supabase)    │      │   (Upstash)          │
    │                 │      │                      │
    │ users table     │      │ search jobs          │
    │ sessions table  │      │ worker tasks         │
    └─────────────────┘      └──────────────────────┘
                                       │
                                       ↓
                            ┌──────────────────────┐
                            │  Worker Processes    │
                            │                      │
                            │ • Page crawling      │
                            │ • Email extraction   │
                            │ • Result processing  │
                            └──────────────────────┘

BACKWARD COMPATIBLE WITH:
├─ Existing API key authentication (x-api-key header)
├─ Existing queue system (unchanged)
├─ Existing worker processes (unchanged)
├─ Existing search API (unchanged)
└─ All external integrations (unchanged)
```

---

## SUPABASE AUTHENTICATION: WHAT'S PROVIDED vs CUSTOM

### What Supabase Handles

**User Management**:
- ✓ User account creation
- ✓ Email/password hashing (bcrypt with 12 rounds)
- ✓ User profile storage
- ✓ Metadata fields (custom claims, roles)

**Session Management**:
- ✓ Session token generation
- ✓ Session validation
- ✓ Session expiry (default 1 hour, refresh tokens)
- ✓ httpOnly cookie support
- ✓ CSRF protection

**Password Recovery**:
- ✓ Password reset email generation
- ✓ Reset token creation
- ✓ Reset token validation
- ✓ Password update

**Email Verification** (Optional):
- ✓ Verification email sending
- ✓ Verification token generation
- ✓ Token validation
- ✓ Email confirmation status

**Security**:
- ✓ Rate limiting on auth endpoints (built-in)
- ✓ Account lockout after failed attempts
- ✓ Email confirmation for suspicious activity
- ✓ Audit logs

**Optional Features** (Can add later):
- ✓ OAuth (Google, GitHub, Microsoft, etc.)
- ✓ Two-factor authentication (TOTP)
- ✓ Magic links (passwordless)
- ✓ Phone authentication

---

### What We Build Ourselves

**UI Components**:
- Landing page (design + HTML/CSS/React)
- Login form
- Register form
- Forgot password form
- Reset password form
- Navigation
- Dashboard pages

**Next.js Integration**:
- Middleware for session validation
- Protected route wrappers
- Logout endpoint
- User data fetching

**API Key System** (Optional):
- API key generation UI
- API key storage (optional: in Supabase)
- API key revocation
- Usage tracking per API key

**Dashboard Features**:
- Search interface (connects to existing /api/search)
- Job status display
- Results management
- Search history
- User settings

---

### What NOT to Build

- ✗ Password hashing (Supabase does it)
- ✗ Session storage (Supabase does it)
- ✗ Email sending for password reset (Supabase does it)
- ✗ Token generation (Supabase does it)
- ✗ Rate limiting (Supabase does it)
- ✗ Account lockout logic (Supabase does it)

---

## PHASE 1: INFRASTRUCTURE SETUP

**Duration**: 1-2 hours  
**Complexity**: LOW  
**Risk**: NONE (only adds new services)

### Objectives
- Set up Supabase project
- Get credentials
- Verify connection from Next.js
- NO changes to existing code

### Tasks

1. **Request Supabase Integration**
   - Use GetOrRequestIntegration tool
   - Get SUPABASE_URL
   - Get SUPABASE_ANON_KEY
   - Get SUPABASE_SERVICE_KEY

2. **Install Supabase Client**
   ```
   pnpm add @supabase/supabase-js
   ```

3. **Create Supabase Client** (`lib/supabase/client.ts`)
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   
   export const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_ANON_KEY!
   )
   ```

4. **Environment Variables** (.env.local)
   ```
   SUPABASE_URL=https://...supabase.co
   SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_KEY=eyJhbGc...
   ```

5. **Verify Setup**
   ```
   - Connect to Supabase
   - Run test query
   - Confirm database access
   ```

### Changes to Existing Code
- NONE

### Database Schema Created (Automatic)
- `auth.users` (managed by Supabase)
- `auth.sessions` (managed by Supabase)
- `auth.refresh_tokens` (managed by Supabase)

---

## PHASE 2: PUBLIC WEBSITE

**Duration**: 2-4 hours  
**Complexity**: LOW  
**Risk**: MINIMAL (UI only)

### Objectives
- Build marketing website
- Create landing page
- Add navigation
- Deploy public site

### Tasks

1. **Create Landing Page** (`app/page.tsx`)
   - Hero section with CTA
   - Features overview
   - Pricing information
   - "Get Started" button → /auth/register
   - "Sign In" button → /auth/login

2. **Create Public Layout** (`app/(public)/layout.tsx`)
   - Navigation bar
   - Logo
   - "Sign In" link
   - "Get Started" button
   - Footer

3. **Design System**
   - Define color scheme
   - Typography
   - Component library
   - Layout patterns

4. **Navigation**
   - Home → /
   - Pricing → /pricing (optional Phase 2)
   - Sign In → /auth/login
   - Get Started → /auth/register

### Changes to Existing Code
- Replace `app/page.tsx` (currently placeholder)
- All other code untouched

### Database Changes
- NONE

---

## PHASE 3: AUTHENTICATION SYSTEM

**Duration**: 3-4 hours  
**Complexity**: MEDIUM  
**Risk**: LOW (isolated to auth pages)

### Objectives
- Build authentication pages
- Integrate with Supabase Auth
- Create login/register flow
- Implement password reset
- Test all auth flows

### Tasks

1. **Create Auth Layout** (`app/(public)/auth/layout.tsx`)
   - Centered form layout
   - Back to home link
   - Form styling
   - Error/success messages

2. **Create Login Page** (`app/(public)/auth/login/page.tsx`)
   - Email input
   - Password input
   - "Sign In" button
   - "Forgot Password?" link
   - "Don't have account? Register" link
   - Client-side form validation

3. **Create Register Page** (`app/(public)/auth/register/page.tsx`)
   - Full Name input
   - Email input
   - Password input (with strength indicator)
   - Confirm password input
   - "I agree to Terms" checkbox
   - "Sign Up" button
   - Existing account link
   - Terms of Service link

4. **Create Forgot Password Page** (`app/(public)/auth/forgot-password/page.tsx`)
   - Email input
   - "Send Reset Email" button
   - Success message
   - Back to login link

5. **Create Reset Password Page** (`app/(public)/auth/reset-password/page.tsx`)
   - Extract token from URL
   - New password input
   - Confirm password input
   - "Reset Password" button
   - Error handling for invalid/expired tokens

6. **Create API Routes**
   - `app/api/auth/logout/route.ts` - Logout endpoint
   - No other auth endpoints needed (Supabase handles auth API)

7. **Session Middleware** (`lib/auth/session-middleware.ts`)
   ```typescript
   export async function validateSession(request: NextRequest) {
     // Check for session cookie
     // Validate with Supabase
     // Return user or null
   }
   
   export function withSession(handler) {
     // Middleware wrapper
   }
   ```

8. **Styling**
   - Create auth form components
   - Button styles
   - Input field styles
   - Error messages
   - Loading states

### API Endpoints Provided by Supabase

These work automatically, no custom code needed:

```
POST /auth/v1/signup
POST /auth/v1/signin
POST /auth/v1/logout
POST /auth/v1/password
POST /auth/v1/token
POST /auth/v1/refresh
```

### Changes to Existing Code
- NONE (auth pages are new)

### Database Changes
- Supabase automatically manages users/sessions tables

---

## PHASE 4: PROTECT ROUTES & ADD NAVIGATION

**Duration**: 1-2 hours  
**Complexity**: LOW  
**Risk**: LOW

### Objectives
- Add route protection
- Require authentication for dashboard
- Add logout functionality
- Update navigation based on auth state

### Tasks

1. **Create Protected Layout** (`app/(protected)/layout.tsx`)
   - Check if user is authenticated
   - Redirect to login if not
   - Show dashboard layout if yes
   - Sidebar with navigation

2. **Protect Dashboard** (`app/dashboard/layout.tsx`)
   - Use session middleware
   - Redirect to /auth/login if no session
   - Show navigation

3. **Protect Admin** (`app/admin/layout.tsx`)
   - Check if user is authenticated
   - Check if user is admin
   - Redirect if not authorized

4. **Add Logout Button**
   - In navigation bar
   - POST to /api/auth/logout
   - Clear session
   - Redirect to home

5. **Update Navigation**
   - Show different nav for authenticated users
   - Show "Welcome, [name]" and logout button
   - Hide "Sign In" when authenticated

6. **Test Auth Flows**
   - Register new user
   - Log in
   - Session persists across pages
   - Log out
   - Can't access /dashboard without login

### Changes to Existing Code
- Modify `app/dashboard/layout.tsx`
- Modify `app/admin/layout.tsx`
- Modify `app/layout.tsx` (optional: add user context)
- All other code untouched

### Database Changes
- NONE

---

## PHASE 5: BUSINESS DISCOVERY DASHBOARD

**Duration**: 3-4 hours  
**Complexity**: MEDIUM  
**Risk**: LOW (connects to existing API)

### Objectives
- Build search interface
- Display results
- Save search history
- Create dashboard home

### Tasks

1. **Create Dashboard Home** (`app/dashboard/page.tsx`)
   - Welcome message
   - Quick stats (searches performed, jobs processed)
   - Recent searches
   - Quick search box
   - Link to advanced search

2. **Create Search Page** (`app/dashboard/search/page.tsx`)
   - Simple mode: Single search bar
   - Advanced mode: Multi-keyword search
   - Pattern/location options
   - Execute search button
   - Connect to existing `/api/search`

3. **Create Results Page** (`app/dashboard/results/page.tsx`)
   - Display results from search
   - Show job status
   - Link to individual job details

4. **Create Job Details Page** (`app/dashboard/jobs/[jobId]/page.tsx`)
   - Show job status
   - Display extracted data
   - Show discovered companies
   - Extracted emails

5. **Create Search History Page** (`app/dashboard/searches/page.tsx`)
   - List of past searches
   - Search parameters shown
   - Date, status, results
   - Ability to re-run search

6. **Create User Settings Page** (`app/dashboard/settings/page.tsx`)
   - User profile
   - Email
   - Password change
   - API key management (optional)
   - Preferences

7. **Connect to Existing API**
   - Use existing `/api/search` endpoint
   - Send user ID in session
   - Display queue job status
   - Track results by user

8. **Database Schema** (New tables in Supabase)
   ```sql
   -- Search history
   CREATE TABLE searches (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     query_params JSONB,
     created_at TIMESTAMP,
     updated_at TIMESTAMP
   );
   
   -- Saved results
   CREATE TABLE results (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     search_id UUID REFERENCES searches(id),
     data JSONB,
     created_at TIMESTAMP
   );
   ```

### Changes to Existing Code
- Modify `app/api/search` route (optional: add user context to search payload)
- All other code untouched

### Database Changes
- Add `searches` table
- Add `results` table
- Optional: Add `search_jobs` table to link jobs to searches

---

## PHASE 6: API KEY SYSTEM (OPTIONAL)

**Duration**: 2-3 hours  
**Complexity**: MEDIUM  
**Risk**: LOW (optional)

### Objectives
- Let users generate API keys
- Store API keys securely
- Revoke API keys
- Track API usage

### When to Do This
- After Phase 5 is complete
- When you want to offer programmatic access to API consumers

### Tasks

1. **Create API Key Schema** (Supabase)
   ```sql
   CREATE TABLE api_keys (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     key_hash TEXT UNIQUE NOT NULL,
     key_prefix TEXT, -- sk_live_xxxx (shown to user)
     name TEXT,
     created_at TIMESTAMP,
     last_used_at TIMESTAMP,
     revoked_at TIMESTAMP
   );
   ```

2. **Create API Key UI** (`app/dashboard/api-keys/page.tsx`)
   - List API keys
   - Copy to clipboard
   - Revoke key button
   - Generate new key button

3. **Update Middleware** (`lib/auth/middleware.ts`)
   - Check if API key exists in database
   - Verify key hash
   - Load user from database

4. **Create API Key Endpoints**
   - `POST /api/user/keys` - Generate new key
   - `DELETE /api/user/keys/:id` - Revoke key

### Why Make This Optional
- Phase 1-5 work without it
- Can be added incrementally
- Existing API key system still works
- Not needed for web users

---

## KEEPING EXISTING API KEY SYSTEM

### Current API Key Flow
```
API Consumer sends: x-api-key: sk_test_abc123
↓
Middleware validates format only (no database)
↓
Allow/deny based on quota
↓
Process request
↓
Track usage
```

### Still Works After Phase 6
```
API Consumer sends: x-api-key: sk_live_xyz789
↓
Middleware checks database (new)
↓
Validates key hash
↓
Loads user
↓
Checks quota
↓
Process request
↓
Track usage
```

### What Doesn't Change
- API endpoint URLs
- Request format
- Response format
- Queue system
- Worker processes
- Extraction logic

### What Changes
- Key validation now queries database (instead of format check only)
- Better security (keys can be revoked)
- Better tracking (know which key was used)

---

## IMPLEMENTATION SEQUENCE SUMMARY

```
TODAY: Phase 1 (Infrastructure)
  ↓
WEEK 1: Phase 2 (Landing Page)
  + Phase 3 (Authentication)
  ↓
WEEK 2: Phase 4 (Route Protection)
  + Phase 5 (Dashboard)
  ↓
WEEK 3+: Phase 6 (API Keys) - OPTIONAL
```

---

## AUTHENTICATION COMPONENTS BREAKDOWN

### Provided by Supabase Auth

| Component | Supabase | Custom |
|-----------|----------|--------|
| User registration | ✓ | - |
| Email/password login | ✓ | - |
| Session management | ✓ | - |
| Session cookies | ✓ | - |
| Password reset email | ✓ | - |
| Reset token validation | ✓ | - |
| Password update | ✓ | - |
| User metadata | ✓ | - |
| Email verification | ✓ | - |
| Rate limiting | ✓ | - |
| Logout | ✓ | - |

### Provided by Custom Code

| Component | Custom |
|-----------|--------|
| Login form UI | ✓ |
| Register form UI | ✓ |
| Forgot password form UI | ✓ |
| Reset password form UI | ✓ |
| Form validation | ✓ |
| Error messages | ✓ |
| Success messages | ✓ |
| Navigation | ✓ |
| Dashboard pages | ✓ |
| Route protection middleware | ✓ |
| API key management UI | ✓ (optional) |
| Search history | ✓ |
| Results display | ✓ |

---

## FILES MODIFIED/CREATED BY PHASE

### Phase 1
**New**:
- `lib/supabase/client.ts`

**Modified**:
- `.env.local` (add variables)
- `package.json` (add @supabase/supabase-js)

---

### Phase 2
**New**:
- `app/page.tsx` (landing page)
- `app/(public)/layout.tsx`

**Modified**:
- `app/layout.tsx` (metadata)

---

### Phase 3
**New**:
- `app/(public)/auth/layout.tsx`
- `app/(public)/auth/login/page.tsx`
- `app/(public)/auth/register/page.tsx`
- `app/(public)/auth/forgot-password/page.tsx`
- `app/(public)/auth/reset-password/page.tsx`
- `app/api/auth/logout/route.ts`
- `lib/auth/session-middleware.ts`
- `lib/supabase/hooks.ts` (useAuth hook)
- `lib/supabase/utils.ts` (helper functions)

---

### Phase 4
**New**:
- `app/(protected)/layout.tsx`

**Modified**:
- `app/dashboard/layout.tsx`
- `app/admin/layout.tsx`
- `app/layout.tsx` (add provider)

---

### Phase 5
**New**:
- `app/dashboard/page.tsx` (home)
- `app/dashboard/search/page.tsx`
- `app/dashboard/results/page.tsx`
- `app/dashboard/jobs/[jobId]/page.tsx`
- `app/dashboard/searches/page.tsx`
- `app/dashboard/settings/page.tsx`
- `lib/supabase/api.ts` (search history methods)

**Modified**:
- `app/api/search/route.ts` (optional: add user context)

---

### Phase 6 (Optional)
**New**:
- `app/dashboard/api-keys/page.tsx`
- `app/api/user/keys/route.ts`
- `lib/auth/key-manager.ts`

**Modified**:
- `lib/auth/middleware.ts`

---

## BACKWARD COMPATIBILITY

### Zero Breaking Changes

**Existing API**:
- ✓ `/api/search` works unchanged
- ✓ x-api-key header still works
- ✓ Response format unchanged
- ✓ Queue system unchanged

**Existing Workers**:
- ✓ All worker code unchanged
- ✓ All extraction code unchanged
- ✓ All processing logic unchanged

**Existing Users**:
- ✓ API consumers see no changes
- ✓ Web UI is entirely new
- ✓ No migration required

---

## SECURITY CONSIDERATIONS

### What Supabase Handles
- Password hashing (bcrypt, 12 rounds)
- Session encryption
- CSRF protection (SameSite=Lax)
- Account lockout (after 6 failed attempts)
- Rate limiting (built-in)
- Email verification checks
- Audit logging

### What We Add
- Input validation on forms
- Error message sanitization
- CORS configuration
- Rate limiting for custom endpoints
- Database row-level security (optional)

### Data Isolation
- Each user sees only their own data
- Query-level filtering
- Row-level security (Supabase)

---

## RISK ASSESSMENT

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 1 | NONE | New service only |
| 2 | LOW | UI only, no logic |
| 3 | LOW | Uses Supabase auth |
| 4 | LOW | Simple redirect logic |
| 5 | MEDIUM | Connects to existing API |
| 6 | LOW | Optional, isolated |

**Overall**: LOW RISK - Incremental, each phase independent

---

## SUCCESS CRITERIA

### Phase 1
- ✓ Supabase project created
- ✓ Connection tested
- ✓ Environment variables set
- ✓ No errors in logs

### Phase 2
- ✓ Landing page loads
- ✓ Navigation works
- ✓ Links to auth pages work
- ✓ Responsive design

### Phase 3
- ✓ User can register
- ✓ User can log in
- ✓ Session persists
- ✓ Password reset works
- ✓ Invalid credentials rejected

### Phase 4
- ✓ Logged-in users can access /dashboard
- ✓ Non-authenticated users redirected to login
- ✓ Logout clears session
- ✓ Navigation shows correct state

### Phase 5
- ✓ Search interface works
- ✓ Results display correctly
- ✓ Job status shows
- ✓ Search history saves
- ✓ User data persists

### Phase 6
- ✓ Users can generate API keys
- ✓ API keys work for authentication
- ✓ Users can revoke keys
- ✓ Usage tracked per key

---

## NEXT STEPS

1. **Review this plan**
2. **Approve architecture**
3. **Request Supabase integration**
4. **Begin Phase 1**

---

**READY FOR IMPLEMENTATION**

All phases defined, all files identified, all tasks clear.

