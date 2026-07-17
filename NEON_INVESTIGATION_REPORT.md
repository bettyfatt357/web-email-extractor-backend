# Neon Investigation Report

**Date**: July 16, 2026  
**Status**: COMPLETE - Neon is NOT installed, NOT connected, and NOT referenced in active code  
**Conclusion**: Neon exists only as a recommendation in planning documents

---

## EXECUTIVE SUMMARY

**Is Neon present in the project?**
- ✗ **NO**

**In what form does it appear?**
- **Only in planning/recommendation documents** (5 files)
- **NOT installed as npm package**
- **NOT configured in environment variables**
- **NOT referenced in any active code files**
- **NOT connected as a Vercel integration**

**What should you do?**
- Start fresh with Supabase (better integrated, has built-in auth)
- Or if you prefer Neon, install it manually from scratch
- Either way, Neon is not blocking anything

---

## DETAILED FINDINGS

### 1. NPM Package Status

**Is `@neon/client` or similar installed?**
- ✗ **NO**

**Full package.json dependencies analysis**:
```json
{
  "@upstash/redis": "^1.38.0",     ✓ (for queue jobs)
  "@vercel/analytics": "1.6.1",    ✓ (tracking)
  "puppeteer": "^25.3.0",          ✓ (crawling)
  "jsdom": "^29.1.1",              ✓ (extraction)
  "cheerio": "^1.2.0",             ✓ (parsing)
  // ... no database packages
}
```

**Database/ORM packages found**: NONE

---

### 2. Environment Variables

**Files checked**:
- ✓ `.env.local` - No database URL
- ✓ `.env.example` - Not found (doesn't exist)
- ✓ All `*env*` files - No Neon references

**Environment variables that exist**:
- ✓ `REDIS_URL` - For Upstash queue
- ✓ `GOOGLE_API_KEY` - For search
- ✓ `STRIPE_SECRET_KEY` - For billing
- ✓ `STRIPE_WEBHOOK_SECRET` - For billing
- ✓ `ADMIN_CREDENTIAL` - For dev auth
- ✗ `DATABASE_URL` - Does not exist
- ✗ Any Neon-specific vars - Do not exist

---

### 3. Configuration Files

**Vercel Integration Status**:
- ✓ `.vercel/project.json` exists
- ✗ No Neon integration listed
- ✗ No database integrations connected

**Checked locations**:
- `.vercel/project.json` - No Neon
- `vercel.json` - Doesn't exist
- Any integration configs - None found for Neon

---

### 4. Code References to Neon

**Result**: NO active code references

**Files checked for "neon" keyword**:
- ✗ No matches in `/lib` code files
- ✗ No matches in `/app` code files
- ✗ No matches in TypeScript files
- ✗ No matches in route handlers
- ✗ No matches in middleware
- ✓ Only found in planning documents (see section 5)

**Database/ORM references**:
- ✗ No Prisma imports
- ✗ No Drizzle imports
- ✗ No pg/postgres client imports
- ✗ No database connection strings
- ✓ Only API client for Google Custom Search

---

### 5. Neon References in Documentation/Planning

**Files that mention Neon**:

1. **`PROJECT_DIAGNOSIS.md`** (Early planning)
   - Mentions: "Neon PostgreSQL recommended"
   - Location: Phase 2 planning section
   - Status: **Outdated recommendation**

2. **`STATUS_DASHBOARD.txt`** (Early planning)
   - Mentions: "Phase 2: Database Persistence (Neon PostgreSQL + Drizzle)"
   - Status: **Old phase document**

3. **`PUBLIC_APP_FLOW_PLAN.md`** (Earlier design phase)
   - Decision point: "Choose Supabase, Neon, or other?"
   - Status: **Under consideration only**

4. **`PUBLIC_APP_FLOW_DECISIONS.md`** (Comparison analysis)
   - Lists Neon as Option B (alternative to Supabase)
   - Status: **Comparative analysis, not implemented**

5. **`PUBLIC_APP_FLOW_QUICK_REF.txt`** (Quick reference)
   - Mentions: "Choose Supabase (has auth) or Neon (PostgreSQL)"
   - Status: **Recommendation, not implemented**

6. **`DATABASE_AUTH_DIAGNOSIS.md`** (Latest analysis)
   - Conclusion: "Neon doesn't exist to replace"
   - Recommendation: "Use Supabase instead"
   - Status: **Explicitly NOT recommending Neon**

---

## NEON USAGE ANALYSIS

### Is Neon Installed?
✗ **NO**
- Not in dependencies
- Not in devDependencies
- Not in node_modules

### Is Neon Configured?
✗ **NO**
- No DATABASE_URL env var
- No .prisma schema file
- No Neon-specific config files

### Is Neon Used in Code?
✗ **NO**
- No imports from Neon
- No database queries
- No ORM usage
- No pool connections

### Is Neon Connected as Integration?
✗ **NO**
- Not in Vercel project.json
- No integration keys/credentials
- Not in environment configuration

---

## ARCHITECTURE CONFIRMATION

The project architecture is:

```
┌─────────────────────────────────────────┐
│   Next.js Frontend + API Routes         │
├─────────────────────────────────────────┤
│  • Google Custom Search API integration │
│  • Puppeteer for page crawling          │
│  • Cheerio for HTML parsing             │
│  • JSDOM for DOM simulation             │
└─────────────────────────────────────────┘
              ↓
    ┌─────────────────┐
    │   Redis Queue   │
    │    (Upstash)    │
    │                 │
    │ • Jobs storage  │
    │ • Rate limiting │
    └─────────────────┘

✗ NO SQL DATABASE LAYER
✗ NO NEON
✗ NO POSTGRES
✗ NO ORM
```

---

## WHAT DOES EXIST

### Authentication System (Current)
- **Method**: API key validation (format only)
- **Storage**: In-memory Map (localhost) + Stripe (production)
- **Credential format**: `sk_test_*` or `sk_live_*`
- **Admin credential**: Environment variable (development)
- **User inference**: From API key format, not database

### Rate Limiting
- **Storage**: Redis (Upstash)
- **Mechanism**: Per-user hourly limits
- **Persistence**: Redis (survives restarts)

### Billing/Quotas
- **Storage**: In-memory (currently) + Stripe hooks
- **Stripe Integration**: Yes (webhooks configured)
- **Persistence**: Stripe (source of truth for billing)

### Job Queue
- **System**: Custom queue implementation
- **Storage**: Redis (Upstash)
- **Worker**: Node.js process (tsx runner)
- **Status**: Production-ready

---

## WHAT DOESN'T EXIST (But Is Needed)

For the web UI + authentication:
- ✗ User accounts table
- ✗ Sessions table
- ✗ Password reset tokens table
- ✗ Email verification table
- ✗ Persistent user data storage
- ✗ SQL database of any kind
- ✗ ORM or database client

**This is why Supabase is recommended**: It provides all of this.

---

## DECISION MATRIX

### If You Want to Use Neon
**Setup Required**:
1. Create Neon account
2. Create PostgreSQL database
3. Install `@prisma/client` or `drizzle-orm`
4. Write database schema
5. Implement authentication from scratch
6. Wire everything together

**Effort**: 2-3 weeks  
**Advantage**: Full control  
**Disadvantage**: More code to maintain

---

### If You Want to Use Supabase (RECOMMENDED)
**Setup Required**:
1. Create Supabase account (1 project)
2. Get credentials
3. Install `@supabase/supabase-js`
4. Build UI components (forms, pages)
5. Wire UI to Supabase Auth API

**Effort**: 1-1.5 weeks  
**Advantage**: Auth already built, faster  
**Disadvantage**: Vendor lock-in (minor)

---

## CONCLUSION

### Neon Status
✗ **Neon is completely unused**
- Not installed
- Not configured
- Not connected
- Only mentioned in old planning documents

### Neon Path Forward
- **Option A**: Ignore Neon, use Supabase (recommended)
- **Option B**: Install Neon from scratch if you prefer PostgreSQL control
- **Option C**: Use a different database entirely

### Next Step
Choose your database and proceed:
- Supabase → Approve `REVISED_IMPLEMENTATION_PHASES.md`
- Neon → Adapt Phase 1 to Neon setup
- Other → Choose your provider

---

## FILES AFFECTED BY NEON STATUS

### Code Files (Active)
- ✗ `/lib/auth/*.ts` - No database dependency
- ✗ `/lib/queue/*.ts` - Uses Redis only
- ✗ `/lib/search/*.ts` - Uses Google API only
- ✗ `/app/api/*` - No database calls
- ✓ All 28 TypeScript files in `/lib` - Zero Neon references

### Configuration Files
- ✗ `package.json` - No Neon packages
- ✗ `.env.local` - No database URL
- ✗ `.vercel/project.json` - No Neon integration
- ✗ `tsconfig.json` - No database setup
- ✗ `next.config.mjs` - No database setup

### Documentation Files (Planning Only)
- `PROJECT_DIAGNOSIS.md` - Old recommendation
- `STATUS_DASHBOARD.txt` - Old phase planning
- `PUBLIC_APP_FLOW_PLAN.md` - Under consideration
- `PUBLIC_APP_FLOW_DECISIONS.md` - Comparison analysis
- `PUBLIC_APP_FLOW_QUICK_REF.txt` - Quick reference
- `DATABASE_AUTH_DIAGNOSIS.md` - Latest conclusion

---

## FINAL VERDICT

**Neon is neither installed nor connected. It exists only as a historical recommendation in planning documents from earlier analysis phases.**

You are starting completely fresh with database selection.

**Recommended**: Use Supabase for fastest implementation.

---

**READY TO PROCEED** with Supabase integration.

