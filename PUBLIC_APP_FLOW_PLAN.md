# Public Application Flow Architecture Plan

**Status**: Diagnosis Complete - Ready for Approval  
**Date**: July 16, 2026  
**Scope**: Landing page, authentication pages, and protected routing

---

## CURRENT STATE ANALYSIS

### Existing Infrastructure

**Authentication Layer** (`lib/auth/middleware.ts`):
- ✓ `withAuth()` middleware validates x-api-key header
- ✓ Loads user from credential (API key format: `sk_test_*` or `sk_live_*`)
- ✓ Supports ADMIN_CREDENTIAL in development
- ✓ Sets user.role, user.isAdmin, user.plan properties

**Authorization Layer** (`lib/auth/admin-auth.ts`):
- ✓ `withAdminAuth()` checks user.isAdmin or user.role
- ✓ Returns 403 Forbidden if unauthorized
- ✓ Works with any auth provider that sets isAdmin flag

**Routing Structure** (Current):
- `/app/page.tsx` - Placeholder (will be landing page)
- `/app/dashboard/layout.tsx` - Protected dashboard layout (no auth guard yet)
- `/app/dashboard/*` - Dashboard pages
- `/app/admin/*` - Admin pages

**Current Issues**:
- ⚠ No login/registration pages exist
- ⚠ No authentication guarding on routes (any request can access /dashboard)
- ⚠ No session management or cookies
- ⚠ API key format not suitable for web UI (too long, not copyable)
- ⚠ Dashboard layout not protected - needs auth guard
- ⚠ No way for users to log in/log out from UI

---

## PROPOSED ARCHITECTURE

### Authentication Flow Design

```
User visits site
  ↓
┌─ Public Route (no auth needed)
│  ├─ Landing page (/landing or /)
│  ├─ Login page (/auth/login)
│  ├─ Register page (/auth/register)
│  ├─ Forgot password page (/auth/forgot-password)
│  └─ Reset password page (/auth/reset-password)
│
└─ Protected Route (auth required)
   ├─ Redirect to login if not authenticated
   ├─ Dashboard pages (/dashboard/*)
   └─ Admin pages (/admin/*)
```

### Session Management Strategy

**Option A: Cookies + Server Sessions** (RECOMMENDED)
- User logs in with email/password
- Server validates credentials against database
- Creates session token (encrypted, httpOnly cookie)
- Frontend sends cookie automatically with requests
- Server validates session on each request
- **Pros**: Secure, works without API keys, standard web auth
- **Cons**: Requires database for users/sessions

**Option B: Short-lived JWT** (ALTERNATIVE)
- User logs in with email/password
- Server returns JWT token (10 min expiry)
- Frontend stores in localStorage or memory
- Frontend includes JWT in Authorization header
- Refresh token endpoint returns new JWT
- **Pros**: Stateless, can work without session storage
- **Cons**: More complex client logic, localStorage security considerations

**Option C: API Keys with Web UI** (BRIDGE)
- Keep current API key system for programmatic access
- Add separate session system for web UI
- Users can have both API keys and session cookies
- **Pros**: Maintains current API, adds web auth
- **Cons**: More complex to implement

**Recommendation**: Start with Option A (Cookies + Sessions) - most standard, secure, user-friendly

---

## REQUIRED FILES

### New Files to Create (7 files)

#### 1. Authentication Pages
- `app/page.tsx` → **Landing Page** (replaces placeholder)
- `app/(public)/layout.tsx` → Public layout (no sidebar)
- `app/(public)/auth/layout.tsx` → Auth pages layout
- `app/(public)/auth/login/page.tsx` → Login page
- `app/(public)/auth/register/page.tsx` → Register page
- `app/(public)/auth/forgot-password/page.tsx` → Forgot password
- `app/(public)/auth/reset-password/page.tsx` → Reset password

#### 2. API Routes (Backend)
- `app/api/auth/login/route.ts` → Login endpoint
- `app/api/auth/register/route.ts` → Register endpoint
- `app/api/auth/logout/route.ts` → Logout endpoint
- `app/api/auth/forgot-password/route.ts` → Send reset email
- `app/api/auth/reset-password/route.ts` → Reset with token
- `app/api/auth/verify-email/route.ts` → Verify email (optional)

#### 3. Authentication Utilities
- `lib/auth/session.ts` → Session management (NEW)
- `lib/auth/password.ts` → Password hashing/verification (NEW)
- `lib/auth/email.ts` → Email sending utilities (NEW)
- `lib/auth/session-middleware.ts` → Session validation middleware (NEW)

#### 4. Database Schema
- User accounts table
- Sessions table
- Password reset tokens table
- Email verification tokens table

### Modified Files (3 files)

#### 1. `app/dashboard/layout.tsx`
- Add session guard: redirect to login if not authenticated
- Update navigation with logout button

#### 2. `app/admin/layout.tsx`
- Add session guard + admin check
- Redirect non-admins to dashboard

#### 3. `app/layout.tsx`
- Update metadata for landing page
- Possibly add theme provider if needed

---

## ROUTING STRUCTURE

### File-based Routing (Next.js App Router)

```
/app
├── (public)                    # Public routes - no auth required
│   ├── layout.tsx             # Public layout (no sidebar)
│   ├── auth
│   │   ├── layout.tsx         # Auth form layout
│   │   ├── login
│   │   │   └── page.tsx       # GET/POST /auth/login
│   │   ├── register
│   │   │   └── page.tsx       # GET/POST /auth/register
│   │   ├── forgot-password
│   │   │   └── page.tsx       # Forgot password flow
│   │   └── reset-password
│   │       └── page.tsx       # Reset password with token
│   └── pricing                # (future: pricing page)
│       └── page.tsx
│
├── (protected)                 # Protected routes - auth required
│   ├── dashboard
│   │   ├── layout.tsx         # Dashboard layout (with sidebar)
│   │   ├── page.tsx           # Dashboard home
│   │   ├── search/page.tsx
│   │   ├── jobs/page.tsx
│   │   └── ...
│   └── admin                   # Admin-only routes
│       ├── layout.tsx         # Admin layout
│       ├── page.tsx           # Admin dashboard
│       └── ...
│
├── api
│   └── auth
│       ├── login/route.ts
│       ├── register/route.ts
│       ├── logout/route.ts
│       ├── forgot-password/route.ts
│       ├── reset-password/route.ts
│       ├── verify-email/route.ts
│       └── me/route.ts        # (existing)
│
├── layout.tsx                 # Root layout
├── page.tsx                   # Landing page (replaces placeholder)
└── not-found.tsx             # 404 page (optional)
```

### Route Groups Explanation

**`(public)`** - Layout group for public pages
- Shares same layout (no sidebar, public navbar)
- Routes inside are NOT protected
- `/auth/login`, `/auth/register`, etc.

**`(protected)`** - Layout group for authenticated pages
- Requires authentication middleware
- Shares dashboard sidebar layout
- `/dashboard/*`, `/admin/*`

---

## AUTHENTICATION MIDDLEWARE

### New Session Middleware (`lib/auth/session-middleware.ts`)

```typescript
// Check if request has valid session
async function validateSession(request: NextRequest): Promise<Session | null>

// Middleware for protected routes
export function withSession(handler): NextResponse

// Middleware for protected routes + admin check
export function withSessionAdmin(handler): NextResponse
```

### Protected Layout Guard

**`app/(protected)/layout.tsx`**:
```typescript
'use server'

export default async function ProtectedLayout({ children }) {
  // Check if user has session
  const session = await getSession()
  
  if (!session) {
    // Redirect to login
    redirect('/auth/login')
  }
  
  return <DashboardLayout>{children}</DashboardLayout>
}
```

---

## DATABASE SCHEMA

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',  -- free, pro, enterprise
  is_admin BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent VARCHAR(500),
  ip_address VARCHAR(45)
);
```

### Password Reset Tokens Table
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Email Verification Tokens Table
```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API ENDPOINTS

### Authentication Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/auth/login` | POST | Login user | No |
| `/api/auth/register` | POST | Create new user account | No |
| `/api/auth/logout` | POST | Logout current user | Yes |
| `/api/auth/me` | GET | Get current user info | Yes |
| `/api/auth/forgot-password` | POST | Send reset email | No |
| `/api/auth/reset-password` | POST | Reset with token | No |
| `/api/auth/verify-email` | POST | Verify email address | No |

### Request/Response Examples

**POST /api/auth/register**
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe"
}

Response (201):
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "fullName": "John Doe",
    "plan": "free"
  },
  "session": {
    "token": "session_abc123",
    "expiresAt": "2024-07-23T15:44:00Z"
  }
}
```

**POST /api/auth/login**
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response (200):
{
  "success": true,
  "user": { ... },
  "session": { ... }
}

Response (401):
{
  "success": false,
  "error": "Invalid email or password"
}
```

---

## AUTHENTICATION FLOW DIAGRAM

### Login Flow
```
1. User visits /auth/login
2. Fills email + password
3. Clicks "Sign In"
   ↓
4. Frontend POST /api/auth/login with email/password
   ↓
5. Server:
   - Finds user by email
   - Validates password hash
   - Creates session token
   - Sets httpOnly cookie (session=token)
   - Returns user info + redirect URL
   ↓
6. Frontend redirects to /dashboard
   ↓
7. Browser automatically includes cookie
8. Dashboard layout checks session validity
9. Renders dashboard
```

### Protected Route Access
```
1. User visits /dashboard
   ↓
2. Dashboard layout runs (server component)
   ↓
3. getSession() reads httpOnly cookie
   ↓
4. Validates session in database
   ↓
5. If valid → render dashboard
6. If invalid → redirect to /auth/login
```

### Logout Flow
```
1. User clicks "Logout"
   ↓
2. POST /api/auth/logout (includes cookie)
   ↓
3. Server:
   - Deletes session from database
   - Clears httpOnly cookie
   - Returns success
   ↓
4. Frontend redirects to landing page
```

---

## SECURITY CONSIDERATIONS

### Password Security
- ✓ Hash passwords with bcrypt (12 rounds min)
- ✓ Never store plain-text passwords
- ✓ Use constant-time comparison for validation
- ✓ Minimum 8 chars, mix of upper/lower/numbers/symbols

### Session Security
- ✓ httpOnly cookies (cannot be accessed from JavaScript)
- ✓ Secure flag (HTTPS only)
- ✓ SameSite=Strict (CSRF protection)
- ✓ Session expiry (default 24 hours)
- ✓ Rotate tokens on sensitive operations

### Password Reset
- ✓ Tokens expire in 1 hour
- ✓ Tokens are cryptographically random (32 bytes)
- ✓ Send reset link only to verified email
- ✓ Tokens one-time use only
- ✓ Rate limit reset requests (5 per hour per email)

### Email Verification
- ✓ Require email verification before account active (optional)
- ✓ Verification tokens expire in 24 hours
- ✓ Resend verification email option

### Rate Limiting
- ✓ Login attempts: 5 fails in 15 mins → lock for 15 mins
- ✓ Registration: 3 accounts per IP in 1 hour
- ✓ Password reset: 5 requests per email in 1 hour
- ✓ Email verification: 5 attempts per hour

---

## PAGES DESIGN OUTLINE

### Landing Page (`/` or `/landing`)
**Components**:
- Hero section with CTA
- Features overview
- Pricing info (link to pricing page)
- Call-to-action: "Get Started" → /auth/register
- Navigation: "Sign In" → /auth/login

### Login Page (`/auth/login`)
**Components**:
- Email input field
- Password input field
- "Forgot Password?" link
- "Sign In" button
- "Don't have an account? Register" link
- Optional: Social login buttons

### Register Page (`/auth/register`)
**Components**:
- Full Name input
- Email input
- Password input (with strength indicator)
- Confirm Password input
- "I agree to Terms" checkbox
- "Sign Up" button
- "Already have account? Sign In" link

### Forgot Password Page (`/auth/forgot-password`)
**Components**:
- Email input
- "Send Reset Link" button
- "Back to Sign In" link
- Success message: "Check your email for reset link"

### Reset Password Page (`/auth/reset-password?token=xyz`)
**Components**:
- New Password input
- Confirm Password input
- "Reset Password" button
- Token validation message
- Success redirect to login

---

## IMPLEMENTATION PHASES

### Phase A: Set Up Database & Auth Utilities
1. Create users, sessions tables
2. Implement password hashing utilities
3. Implement session management utilities
4. Add email sending setup

### Phase B: Implement Backend Auth Endpoints
1. `/api/auth/register` endpoint
2. `/api/auth/login` endpoint
3. `/api/auth/logout` endpoint
4. Session middleware
5. Error handling

### Phase C: Create Frontend Pages
1. Landing page
2. Login page
3. Register page
4. Forgot/reset password pages
5. Success/error messages

### Phase D: Protect Routes
1. Add session guard to dashboard layout
2. Add admin check to admin layout
3. Update navigation with login/logout
4. Redirect logic

### Phase E: Polish & Security
1. Rate limiting
2. Email verification (optional)
3. Password complexity rules
4. Security headers
5. CSRF protection

---

## BACKWARD COMPATIBILITY

### Maintain API Key System
- Current `/api/search` endpoint still accepts x-api-key header
- API key users unchanged
- Web UI users use session cookies
- Two auth systems can coexist

### Migration Path
- Phase 1-2: Add session-based auth
- Phase 3-4: Create public web UI
- Phase 5+: Optional: Allow API keys to be managed in dashboard

---

## DEPENDENCIES NEEDED

### Already Available
- ✓ Next.js 16 (App Router)
- ✓ React 19

### Need to Add
- `bcryptjs` - Password hashing
- `jose` - JWT/token utilities
- `nodemailer` - Email sending (or use email service)
- `zod` - Request validation

### Optional
- `next-auth` - Full auth solution (if want managed auth)
- `clerk` - Managed auth + user management

---

## DECISION POINTS FOR APPROVAL

1. **Database**: Use Supabase, Neon, or other?
   - Recommendation: Supabase (has auth built-in) or Neon

2. **Email Service**: Resend, SendGrid, Mailgun, or in-house?
   - Recommendation: Resend (works great with Next.js)

3. **Password Reset Flow**: Email link or SMS code?
   - Recommendation: Email link (more common)

4. **Email Verification**: Required or optional?
   - Recommendation: Optional (can add later)

5. **Social Login**: Include Google/GitHub?
   - Recommendation: Phase 2+ feature

6. **Session Duration**: 24 hours, 7 days, or 30 days?
   - Recommendation: 24 hours (users can "Remember me")

---

## SUCCESS CRITERIA

- ✓ Users can register with email/password
- ✓ Users can log in with email/password
- ✓ Session persists across page reloads
- ✓ Logout clears session
- ✓ Protected routes redirect to login if not authenticated
- ✓ Dashboard/admin require authentication
- ✓ Password reset works via email
- ✓ Passwords properly hashed (bcrypt)
- ✓ No TypeScript errors
- ✓ Security headers present
- ✓ Rate limiting prevents brute force

---

## NEXT STEPS

1. Review and approve architecture plan
2. Decide on database (Supabase, Neon, or other)
3. Decide on email service (Resend, SendGrid, etc.)
4. Approve design for pages
5. Begin Phase A implementation

---

**AWAITING APPROVAL** to proceed with implementation.

