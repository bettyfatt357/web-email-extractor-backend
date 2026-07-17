# Public Application Flow - Decision Matrix

**Purpose**: Summarize key architectural decisions requiring approval before implementation.

---

## DECISION 1: Session Management Approach

### Option A: httpOnly Cookies + Server Sessions (RECOMMENDED)
**How it works**:
- User logs in, server creates session token
- Session stored in database + as httpOnly cookie
- Browser automatically sends cookie with requests
- Server validates session on each request

**Pros**:
- ✓ Most secure (JS can't access cookie)
- ✓ Standard web auth pattern
- ✓ Works without localStorage
- ✓ CSRF protection built-in with SameSite

**Cons**:
- ✗ Requires database for sessions
- ✗ Slightly more complex than JWT

**Recommendation**: YES - Use this

---

### Option B: Short-lived JWT Tokens (ALTERNATIVE)
**How it works**:
- User logs in, server returns JWT token (10 min expiry)
- Frontend stores in localStorage or memory
- Frontend includes in Authorization header
- Refresh token endpoint for new tokens

**Pros**:
- ✓ Stateless (no session DB needed)
- ✓ Works with distributed systems

**Cons**:
- ✗ localStorage vulnerable to XSS
- ✗ More complex client logic
- ✗ Token management overhead
- ✗ Can't revoke easily

**Recommendation**: NO - Skip for web UI (keep for API)

---

### Option C: Hybrid (Cookies + API Keys)
**How it works**:
- Sessions for web UI (cookies)
- API keys for programmatic access
- Both point to same user record

**Pros**:
- ✓ Supports both use cases
- ✓ Maintains existing API

**Cons**:
- ✗ More complex to implement
- ✗ More auth code to maintain

**Recommendation**: PHASE 2+ - Can add later

---

## DECISION 2: Database Provider

### Option A: Supabase (RECOMMENDED)
**What it is**: PostgreSQL + built-in auth + real-time + storage

**Pros**:
- ✓ Has auth system built-in
- ✓ PostgreSQL (familiar, powerful)
- ✓ Free tier generous (2 projects)
- ✓ Great for rapid development

**Cons**:
- ✗ Managed service (less control)
- ✗ Pricing scales with usage

**Cost**: Free tier: 2 projects, 500MB storage, 50k API calls/month
**Setup time**: 15 mins

**Recommendation**: YES - Best for speed

---

### Option B: Neon (PostgreSQL)
**What it is**: Serverless PostgreSQL database

**Pros**:
- ✓ Serverless (scales automatically)
- ✓ PostgreSQL (full control)
- ✓ Works great with Next.js
- ✓ Good pricing

**Cons**:
- ✗ No built-in auth (must implement ourselves)
- ✗ Slightly more setup

**Cost**: Free tier: 3 projects, 3 GB storage, 10M compute units
**Setup time**: 20 mins

**Recommendation**: Alternative - If want more control

---

### Option C: AWS Aurora / RDS
**What it is**: Managed relational database

**Pros**:
- ✓ Enterprise-grade
- ✓ Highly scalable

**Cons**:
- ✗ Expensive
- ✗ Complex setup
- ✗ Overkill for this project

**Recommendation**: NO - Skip for now

---

### Decision Summary
| | Supabase | Neon | AWS |
|---|----------|------|-----|
| Built-in auth | ✓ Yes | ✗ No | ✗ No |
| Setup time | 15 min | 20 min | 1+ hr |
| Cost | Free tier | Free tier | $$$$ |
| Recommendation | ✓ Use | Alternative | Skip |

**ACTION**: Choose Supabase or Neon

---

## DECISION 3: Email Service

### Option A: Resend (RECOMMENDED)
**What it is**: Modern email API for developers

**Pros**:
- ✓ Next.js native
- ✓ Easy to use
- ✓ Good templates
- ✓ $20/month for 50k emails

**Cons**:
- ✗ Paid service
- ✗ Need API key

**Recommendation**: YES - Best for this use case

---

### Option B: SendGrid
**What it is**: Enterprise email service

**Pros**:
- ✓ Industry standard
- ✓ Reliable
- ✓ Free tier: 100 emails/day

**Cons**:
- ✗ More complex setup
- ✗ Enterprise-focused

**Recommendation**: Alternative - If already have account

---

### Option C: Mailgun
**What it is**: Email API

**Pros**:
- ✓ Good API
- ✓ Free tier available

**Cons**:
- ✗ Requires domain verification
- ✗ More setup

**Recommendation**: Alternative

---

### Option D: In-house (nodemailer)
**What it is**: Use own email server

**Pros**:
- ✓ No external service
- ✓ Free

**Cons**:
- ✗ Complex to set up
- ✗ Emails often marked as spam
- ✗ Need SMTP server

**Recommendation**: NO - Not recommended

---

### Decision Summary
| | Resend | SendGrid | Mailgun | In-house |
|---|--------|----------|---------|----------|
| Setup time | 5 min | 15 min | 20 min | 1+ hr |
| Cost | $20/mo | Free (limited) | Free (limited) | Free |
| Reliability | ✓ ✓ ✓ | ✓ ✓ ✓ | ✓ ✓ | ✗ Low |
| Recommendation | ✓ Use | Alternative | Alternative | Skip |

**ACTION**: Choose Resend (recommended) or SendGrid

---

## DECISION 4: Password Requirements

### Option A: Strong Requirements (RECOMMENDED)
```
Minimum 12 characters
Must include: UPPERCASE, lowercase, number, symbol (!@#$%^&*)
Examples of valid:
  - MyPassword123!
  - SecurePass@456
  - P@ssw0rd-Secure
```

**Pros**:
- ✓ More secure
- ✓ Better protection against brute force

**Cons**:
- ✗ Users complain
- ✗ More forgotten passwords

**Recommendation**: YES - Worth it for security

---

### Option B: Moderate Requirements
```
Minimum 8 characters
Must include: UPPERCASE or number
Examples:
  - Password1
  - Secure1
```

**Pros**:
- ✓ Less frustrating for users
- ✓ Still reasonably secure

**Cons**:
- ✗ Easier to guess

**Recommendation**: Alternative

---

### Option C: Minimal Requirements
```
Minimum 6 characters
No other requirements
```

**Pros**:
- ✓ User-friendly

**Cons**:
- ✗ Very insecure
- ✗ Easy to brute force

**Recommendation**: NO - Not acceptable

---

**Decision**: Strong (Option A) - 12 chars, UPPERCASE, lowercase, number, symbol

---

## DECISION 5: Session Duration

### Option A: 24 Hours (RECOMMENDED)
- User logs in, valid for 24 hours
- After 24 hours, must log in again
- "Remember Me" checkbox → extends to 30 days

**Pros**:
- ✓ Good security/UX balance
- ✓ Users not logged out too soon
- ✓ Can add "Remember Me" later

**Cons**:
- ✗ Long session if device stolen

**Recommendation**: YES - Start with this

---

### Option B: 7 Days
- User logs in, valid for 7 days
- More convenient for users

**Pros**:
- ✓ Better UX (less frequent login)

**Cons**:
- ✗ Security risk if device stolen
- ✗ Too long for shared devices

**Recommendation**: NO - Too long

---

### Option C: 1 Hour
- Short session, frequent re-authentication

**Pros**:
- ✓ Highest security

**Cons**:
- ✗ Very annoying for users
- ✗ Bad UX

**Recommendation**: NO - Too short

---

**Decision**: 24 hours (Option A), with optional "Remember Me"

---

## DECISION 6: Email Verification

### Option A: Required (Most Secure)
- User registers with email
- Must click verification link before can use account
- Prevents fake/spam emails

**Pros**:
- ✓ Ensures real email
- ✓ Can use email for password reset

**Cons**:
- ✗ Extra step for users
- ✗ May increase drop-off

**Recommendation**: Phase 2 - Can add later if needed

---

### Option B: Not Required (Faster)
- User registers and can use immediately
- Email not verified until first password reset

**Pros**:
- ✓ Faster onboarding
- ✓ Better UX

**Cons**:
- ✗ Can register with invalid emails
- ✗ Bounce emails on password reset

**Recommendation**: YES - Start with this, add verification Phase 2

---

**Decision**: Not required initially (Option B), add in Phase 2

---

## DECISION 7: Social Login

### Include Google/GitHub OAuth?

**Option A: Yes**
- Users can sign in with Google or GitHub

**Pros**:
- ✓ Faster signup
- ✓ No password to remember

**Cons**:
- ✗ Complex implementation
- ✗ More dependencies
- ✗ Privacy concerns

**Recommendation**: NO - Phase 2+ feature

---

**Decision**: Skip initially, add in Phase 2

---

## DECISION 8: Rate Limiting

### Recommended Limits
```
Login attempts:
  - 5 failures in 15 minutes → lock account
  - Display: "Account locked, try again in 15 mins"

Registration:
  - 3 new accounts per IP in 1 hour
  - Display: "Too many signups from this IP"

Password reset:
  - 5 requests per email in 1 hour
  - Display: "Too many reset requests, try again later"

Email verification (Phase 2):
  - 5 requests per hour
  - Display: "Too many verification emails sent"
```

**Pros**:
- ✓ Prevents brute force attacks
- ✓ Prevents spam registrations
- ✓ Protects against email bomb

**Cons**:
- ✗ Legitimate users may get locked out

**Recommendation**: YES - Implement all above

---

**Decision**: Implement all rate limits as specified

---

## DECISION SUMMARY TABLE

| Decision | Option | Recommendation | Action |
|----------|--------|------------------|---------|
| Session Management | Cookies + Sessions | ✓ Use (Option A) | Approved |
| Database | Supabase or Neon | ✓ Choose Supabase | Need approval |
| Email Service | Resend | ✓ Use (Option A) | Need approval |
| Password Strength | Strong (12+ chars) | ✓ Use (Option A) | Approved |
| Session Duration | 24 hours | ✓ Use (Option A) | Approved |
| Email Verification | Not required | ✓ Skip for now | Approved |
| Social Login | Not included | ✓ Skip for now | Approved |
| Rate Limiting | As specified | ✓ Implement all | Approved |

---

## REQUIRED APPROVALS

Please confirm:

1. **Database**: Choose Supabase or Neon (or other)
2. **Email**: Choose Resend or SendGrid (or other)
3. **Password Requirements**: Accept 12+ chars, UPPERCASE, lowercase, number, symbol
4. **Session**: Accept 24 hours with optional "Remember Me"
5. **Everything else**: Accept all recommendations above

---

## NEXT STEPS UPON APPROVAL

1. Set up Supabase/Neon account (5 mins)
2. Set up Resend/SendGrid account (5 mins)
3. Create database schema (already provided)
4. Begin Phase A implementation

---

**AWAITING YOUR DECISIONS** on database and email service.

