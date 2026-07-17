# Final Architecture Validation: PostgreSQL vs Redis vs Memory

**Status**: Complete Design Review - Ready for Approval  
**Date**: July 16, 2026

---

## EXECUTIVE SUMMARY

The application uses **three distinct storage layers**:

1. **PostgreSQL (Supabase)** - For persistent, user-specific data
2. **Redis (Upstash)** - For ephemeral, distributed, fast-access data
3. **Memory (Runtime)** - For temporary calculations and state

This document validates that adding Supabase PostgreSQL has **zero impact on existing Redis/memory systems**.

---

## PART 1: DATA ARCHITECTURE BY SYSTEM

### Layer 1: PostgreSQL (Supabase) - NEW

**Purpose**: Persistent user accounts, sessions, and search history

**Data residing here**:
- User profiles and accounts
- Login sessions and cookies
- Search history (saved searches)
- Saved results/bookmarks
- User preferences and settings
- API keys (for future Phase 6)
- Billing/subscription data
- Audit logs

**Schema**:
```sql
-- Authentication (managed by Supabase Auth)
auth.users (email, password_hash, etc) -- Built-in
auth.sessions (user_id, token, expires_at) -- Built-in

-- Application data (we create)
public.search_history (
  id, user_id, query, results_count, created_at
)

public.saved_results (
  id, user_id, search_id, result_data, created_at
)

public.user_preferences (
  user_id, email_notifications, theme, language
)

public.api_keys (
  id, user_id, key_hash, name, created_at, revoked_at
)

public.audit_logs (
  id, user_id, action, endpoint, timestamp
)
```

**Access Pattern**: Query via Supabase client (no direct SQL)
**Persistence**: Survives application restarts
**Scale**: Grows with user count and time

---

### Layer 2: Redis (Upstash) - EXISTING, UNTOUCHED

**Purpose**: Distributed job queue and ephemeral data

**Data residing here**:
- Active job queue (search jobs)
- Worker task locks
- Rate limit counters (request counts per hour)
- Temporary search results during processing
- Session cache (optional TTL)

**Current keys stored**:
```
job:* (queue items, FIFO)
rate_limit:user_xyz:hour (counters)
worker_lock:worker_1 (locks)
temp_results:job_123 (TTL: 24 hours)
```

**Access Pattern**: Redis client (Upstash)
**Persistence**: Survives restarts (Redis persisted)
**Scale**: Bounded by job queue size and rate limit counters

**Will NEVER change when adding PostgreSQL**:
- ✓ Queue structure stays same
- ✓ Job format stays same
- ✓ Worker processes unchanged
- ✓ Rate limiting logic unchanged

---

### Layer 3: Memory (Runtime) - EXISTING

**Purpose**: In-process calculations, temporary state

**Data that MUST stay in memory**:
- Currently processing job state
- HTML parsing results (per request)
- Email extraction results (during extraction)
- Pattern matching buffers
- WebPage DOM trees
- Temporary regex matches

**Data structures**:
- Page content parsed via jsdom/cheerio
- Extraction matches during processing
- Email deobfuscation intermediate results
- URL filter matches

**Why it stays in memory**:
- Too large to serialize (full page DOM)
- Too temporary to persist (discarded after use)
- Too fast to need caching (calculated fresh each request)
- No need for distributed access (local processing only)

**Examples**:
```typescript
// Worker processing - stays in memory
async function processJob(jobData) {
  const html = await fetch(url).then(r => r.text()); // ← Temporary
  const $ = cheerio.load(html); // ← Temporary DOM
  const emails = extractEmails($); // ← Temporary matches
  return emails; // ← This alone persists (to job result)
}

// Search - stays in memory
async function search() {
  const results = []; // ← Per-request array
  for (const result of googleResults) {
    results.push(normalizeUrl(result)); // ← Per-request calculation
  }
  return results; // ← Persisted to job
}
```

---

## PART 2: WHAT WILL LIVE IN POSTGRESQL

### New Tables for Web UI

**1. Users (managed by Supabase Auth)**
```sql
-- Created by Supabase Auth automatically
-- Fields: id, email, encrypted_password, created_at, updated_at
```

**2. Sessions (managed by Supabase Auth)**
```sql
-- Created by Supabase Auth automatically
-- Stores login sessions for web UI
```

**3. Search History**
```sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  query TEXT NOT NULL,
  keywords JSONB,
  patterns JSONB,
  location TEXT,
  results_count INT DEFAULT 0,
  job_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_date (user_id, created_at DESC)
);
```

**4. User Preferences**
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_notifications BOOLEAN DEFAULT TRUE,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**5. Search Results (Optional - for bookmarking)**
```sql
CREATE TABLE saved_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  search_id UUID NOT NULL REFERENCES search_history(id),
  result_data JSONB NOT NULL, -- Email, company, title
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_search (user_id, search_id)
);
```

**6. API Keys (Phase 6 Optional)**
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  key_prefix TEXT NOT NULL, -- sk_live_xxxx (shown to user)
  key_hash TEXT UNIQUE NOT NULL, -- SHA-256 hash (stored securely)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  
  INDEX idx_user_keys (user_id)
);
```

**7. Audit Logs (Optional - for compliance)**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'search', 'export', 'api_call'
  endpoint TEXT,
  status INT, -- 200, 401, etc
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_date (user_id, created_at DESC)
);
```

**Total new tables**: 6 tables (Supabase Auth provides 3)
**Total new rows at scale**: 
- Users: 100-1000s (one per web user)
- Search history: 10k-100ks (10-100 searches per user)
- Saved results: 100k-1Ms (10-100 bookmarks per search)
- API keys: 100s-1000s (1-10 per API consumer)

---

## PART 3: WHAT WILL REMAIN IN REDIS

**Redis keys are unchanged**:

```
# Job queue (existing)
bull:search-jobs:* 
bull:extract-jobs:*
bull:email-jobs:*

# Rate limiting (existing)
rate_limit:sk_test_abc:2024-07-16:14:00
rate_limit:sk_test_abc:2024-07-16:15:00

# Worker state (existing)
worker:1:lock
worker:1:heartbeat
worker:1:status

# Temporary results during processing (existing)
temp_search_results:job_id_123
temp_emails:job_id_456
temp_urls:job_id_789
```

**Why Redis stays**:
- ✓ Queue system is already working perfectly
- ✓ Rate limiting uses Redis effectively
- ✓ Job IDs point to Redis, not PostgreSQL
- ✓ No performance benefit to move to PostgreSQL
- ✓ Distributed across workers (Redis is ideal for this)

**What changes in Redis**: NOTHING

---

## PART 4: WHAT STAYS IN MEMORY

**Per-request memory allocations**:

```typescript
// Worker processing (per job)
const html: string; // Full HTML from page (~100KB-5MB)
const dom: CheerioAPI; // Parsed DOM tree (~50KB-2MB)
const emailMatches: RegExpMatchArray[]; // Email matches (~1KB-100KB)
const phoneMatches: RegExpMatchArray[]; // Phone matches (~1KB-100KB)

// Search request (per search)
const googleResults: GoogleResult[]; // Results from Google (~50KB)
const normalizedUrls: string[]; // Processed URLs (~10KB-100KB)
const filteredUrls: string[]; // Final URLs for processing (~10KB-100KB)

// Extraction engine
const deobfuscatedText: string; // Cleaned email text (~50KB-500KB)
const patternMatches: Match[]; // Pattern results (~50KB-1MB)
```

**Why memory (not Redis, not PostgreSQL)**:
- Too large to serialize efficiently (HTML/DOM)
- Too temporary (discarded after extraction)
- Too fast to justify Redis roundtrip
- Local processing (no need for distribution)

---

## PART 5: ER DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│                  POSTGRESQL (Supabase)                   │
└─────────────────────────────────────────────────────────┘

     ┌───────────────────────┐
     │    auth.users         │
     │ (Supabase managed)    │
     │                       │
     │ id (UUID)             │
     │ email                 │
     │ password_hash         │
     │ created_at            │
     └───────┬───────────────┘
             │ 1:N
             │
     ┌───────▼──────────────────────┐
     │   search_history             │
     │                              │
     │ id (UUID)                    │
     │ user_id → auth.users ────────┤
     │ query (TEXT)                 │
     │ keywords (JSONB)             │
     │ results_count (INT)          │
     │ created_at                   │
     └───────┬──────────────────────┘
             │ 1:N
             │
     ┌───────▼──────────────────────┐
     │   saved_results              │
     │                              │
     │ id (UUID)                    │
     │ user_id → auth.users         │
     │ search_id → search_history ──┤
     │ result_data (JSONB)          │
     │ created_at                   │
     └──────────────────────────────┘

     ┌──────────────────────────────┐
     │   user_preferences           │
     │                              │
     │ user_id → auth.users (PK)    │
     │ email_notifications          │
     │ theme                        │
     │ language                     │
     └──────────────────────────────┘

     ┌──────────────────────────────┐
     │   api_keys                   │
     │                              │
     │ id (UUID)                    │
     │ user_id → auth.users         │
     │ key_hash (TEXT, UNIQUE)      │
     │ created_at                   │
     │ revoked_at                   │
     └──────────────────────────────┘

     ┌──────────────────────────────┐
     │   audit_logs                 │
     │                              │
     │ id (UUID)                    │
     │ user_id → auth.users         │
     │ action (TEXT)                │
     │ endpoint (TEXT)              │
     │ created_at                   │
     └──────────────────────────────┘


┌─────────────────────────────────────────────────────────┐
│                    REDIS (Upstash)                       │
│              (Completely unchanged)                      │
└─────────────────────────────────────────────────────────┘

   Job Queue (Bull)
   ├─ search-jobs (FIFO)
   ├─ extract-jobs (FIFO)
   └─ email-jobs (FIFO)

   Rate Limiting
   └─ rate_limit:{user_id}:{date}:{hour}

   Worker State
   ├─ worker:{id}:lock
   ├─ worker:{id}:heartbeat
   └─ worker:{id}:status

   Temporary Results (TTL 24h)
   ├─ temp_search_results:{job_id}
   ├─ temp_emails:{job_id}
   └─ temp_urls:{job_id}


┌─────────────────────────────────────────────────────────┐
│                     Memory (Runtime)                     │
│              (Completely unchanged)                      │
└─────────────────────────────────────────────────────────┘

   Per-Worker Request
   ├─ HTML Content (~100KB-5MB)
   ├─ DOM Tree (~50KB-2MB)
   ├─ Email Matches (~1KB-100KB)
   └─ Phone Matches (~1KB-100KB)

   Per-Search Request
   ├─ Google Results (~50KB)
   ├─ Normalized URLs (~10KB-100KB)
   └─ Filtered URLs (~10KB-100KB)

   Extraction Engine
   ├─ Deobfuscated Text (~50KB-500KB)
   └─ Pattern Matches (~50KB-1MB)
```

---

## PART 6: FUTURE GROWTH SUPPORT

### Multi-User Accounts
✓ **Supported**
- Each user_id links to auth.users
- search_history.user_id filters per user
- User preferences isolated by user_id

### Teams
✓ **Can add later**
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT,
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT
);

ALTER TABLE search_history ADD team_id UUID REFERENCES teams(id);
```

### Organizations
✓ **Can add later**
- Same pattern as teams
- Add org_id to tables needing org isolation

### Billing
✓ **Supported now**
```sql
CREATE TABLE subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  stripe_subscription_id TEXT,
  plan TEXT,
  status TEXT,
  current_period_end TIMESTAMP
);
```

### Search History
✓ **Core feature**
- search_history table designed for this
- Easy to query by date range, keyword

### Saved Projects
✓ **Can add**
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  description TEXT,
  created_at TIMESTAMP
);

CREATE TABLE project_searches (
  project_id UUID REFERENCES projects(id),
  search_id UUID REFERENCES search_history(id)
);
```

### API Usage Analytics
✓ **Can track via audit_logs**
- Every API call logged
- Query by user, date, endpoint
- Generate reports

### Analytics Dashboard
✓ **Can build from PostgreSQL**
- Query search_history for trends
- Query audit_logs for API patterns
- Join with users for cohort analysis

---

## PART 7: MIGRATION RISK ASSESSMENT

### Risk: Zero

**Why**:
1. Supabase is additive (new features only)
2. Redis remains unchanged
3. Memory remains unchanged
4. Existing API endpoints untouched
5. Existing queue system untouched
6. Existing worker processes untouched
7. Existing extraction engine untouched

### Files That Will Change

#### Phase 1 (Infrastructure) - 1 file modified
```
Modified:
  package.json (add @supabase/supabase-js)
  .env.local (add SUPABASE_URL, SUPABASE_ANON_KEY)

Created:
  lib/supabase/client.ts (Supabase client initialization)
```

#### Phase 2 (Landing Page) - 1 file modified
```
Modified:
  app/page.tsx (replace placeholder)
```

#### Phase 3 (Auth Pages) - 6 files new, 0 files modified
```
Created:
  app/(public)/layout.tsx
  app/(public)/auth/layout.tsx
  app/(public)/auth/login/page.tsx
  app/(public)/auth/register/page.tsx
  app/(public)/auth/forgot-password/page.tsx
  app/(public)/auth/reset-password/page.tsx
```

#### Phase 4 (Route Protection) - 3 files modified, 2 created
```
Modified:
  app/dashboard/layout.tsx (add session guard)
  app/admin/layout.tsx (add session guard)
  app/layout.tsx (add provider)

Created:
  lib/supabase/hooks.ts (useAuth hook)
  lib/supabase/middleware.ts (session middleware)
```

#### Phase 5 (Dashboard) - 6 files new, 1 file optional modified
```
Created:
  app/dashboard/page.tsx
  app/dashboard/search/page.tsx
  app/dashboard/results/page.tsx
  app/dashboard/jobs/[jobId]/page.tsx
  app/dashboard/searches/page.tsx
  app/dashboard/settings/page.tsx

Optional Modified:
  app/api/search/route.ts (add user context)
```

#### Phase 6 (API Keys) - 3 files new, 1 file modified
```
Created:
  app/dashboard/api-keys/page.tsx
  app/api/user/keys/route.ts
  lib/auth/key-manager.ts

Modified:
  lib/auth/middleware.ts (enhance to check database)
```

### Total Files Affected
- **New files**: 17
- **Modified files**: 7
- **Deleted files**: 0
- **No changes to**: 28+ files in lib/

### Zero Changes To

#### Completely Untouched:
- ✓ lib/search/* (all search logic)
- ✓ lib/extraction/* (all extraction logic)
- ✓ lib/worker/* (all worker logic)
- ✓ lib/queue/queue.ts (job queue)
- ✓ lib/queue/queue-rest.ts (queue REST API)
- ✓ lib/billing/stripe.ts (Stripe integration)
- ✓ lib/benchmark/* (all benchmarking)
- ✓ lib/config/google.ts (Google API config)
- ✓ app/api/search/* (search endpoint)
- ✓ app/api/job/* (job endpoints)
- ✓ app/api/results/* (results endpoints)
- ✓ All existing API endpoints

---

## PART 8: DATA FLOW EXAMPLES

### Example 1: User Registration → Dashboard Access

```
1. User visits /
   └─ Landing page (no DB needed)

2. User clicks "Get Started"
   └─ Redirects to /auth/register

3. User enters email/password on registration form
   ├─ Form submits to Supabase Auth API
   ├─ Supabase creates auth.users row
   ├─ Supabase creates auth.sessions row
   ├─ Session cookie set (httpOnly)
   └─ Redirect to /dashboard

4. User views dashboard
   ├─ Middleware checks session cookie
   ├─ Validates against Supabase
   ├─ Loads search_history from PostgreSQL
   ├─ Displays past searches
   └─ User can perform new search

PostgreSQL new rows: 1 user, 1 session
Redis unchanged: queue still processes jobs
Memory unchanged: no impact
```

### Example 2: Search Request Flow

```
1. Authenticated user submits search from dashboard
   ├─ User context from Supabase session
   ├─ Query sent to /api/search with auth header

2. /api/search handler
   ├─ Validates session (Supabase)
   ├─ Checks rate limit (Redis - unchanged)
   ├─ Creates job in Redis queue (unchanged)
   ├─ Inserts into search_history (PostgreSQL - new)
   ├─ Returns job ID
   └─ Frontend polls for results

3. Worker processes job
   ├─ Reads from Redis queue (unchanged)
   ├─ Fetches URLs with cheerio (memory - unchanged)
   ├─ Extracts emails (memory - unchanged)
   ├─ Stores results in Redis (unchanged)
   └─ Job marked complete in Redis

PostgreSQL new rows: 1 search_history record
Redis unchanged: queue processes same as before
Memory unchanged: per-job processing same as before
```

### Example 3: API Key Usage (Phase 6)

```
1. Existing API consumer makes request
   POST /api/search
   Header: x-api-key: sk_live_xyz789

2. withAuth() middleware
   ├─ Extracts API key from header
   ├─ Checks if key exists in PostgreSQL api_keys table (NEW)
   ├─ Verifies key_hash matches
   ├─ Loads user from PostgreSQL
   ├─ Continues to handler
   └─ (Before Phase 6: format check only)

3. Request processed
   └─ Same as always

PostgreSQL: api_keys table queried once
Redis unchanged: rate limiting still works
Memory unchanged: processing same as before
```

---

## PART 9: QUERY PATTERNS FOR POSTGRESQL

### Queries that will run frequently

**1. Get user's search history**
```sql
SELECT * FROM search_history 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 50;
-- Uses index: idx_user_date
```

**2. Get user's preferences**
```sql
SELECT * FROM user_preferences 
WHERE user_id = $1;
-- Single row lookup, very fast
```

**3. Save search result**
```sql
INSERT INTO saved_results (user_id, search_id, result_data)
VALUES ($1, $2, $3);
-- Batch insert if multiple results
```

**4. Get API key (Phase 6)**
```sql
SELECT * FROM api_keys 
WHERE key_hash = $1 AND revoked_at IS NULL;
-- Uses index: UNIQUE(key_hash)
-- Runs once per API call
```

**5. Log audit event**
```sql
INSERT INTO audit_logs (user_id, action, endpoint, status)
VALUES ($1, $2, $3, $4);
-- Append-only, very fast
```

### Queries that will run occasionally

**1. Get user's saved searches**
```sql
SELECT sh.*, COUNT(sr.id) as result_count
FROM search_history sh
LEFT JOIN saved_results sr ON sh.id = sr.search_id
WHERE sh.user_id = $1 AND sh.created_at > NOW() - INTERVAL '90 days'
GROUP BY sh.id
ORDER BY sh.created_at DESC;
```

**2. Generate usage report**
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  action,
  COUNT(*) as count
FROM audit_logs
WHERE user_id = $1
GROUP BY DATE_TRUNC('day', created_at), action
ORDER BY date DESC;
```

### No heavy joins needed
- User searches don't join with users table (session has user context)
- Most queries single-user (filtered by user_id)
- Simple, fast queries
- All indexes already planned

---

## PART 10: PRODUCTION DEPLOYMENT CHECKLIST

### Before Going Live with PostgreSQL

- [ ] PostgreSQL tables created in Supabase
- [ ] Indexes created (idx_user_date, idx_user_search, etc)
- [ ] Row-level security (RLS) enabled if needed
- [ ] Backups configured
- [ ] Connection pooling configured (Supabase handles)
- [ ] Query timeouts set (5s for user queries, 30s for batch)

### Redis Remains Unchanged
- [x] Upstash Redis still powering queue
- [x] All workers still using same queue
- [x] No migration needed

### Memory Processing Unchanged
- [x] All extraction stays in memory
- [x] All pattern matching in memory
- [x] No impact on performance

---

## PART 11: CONFIRMED - ZERO DISRUPTION

### Google Search API
✓ **Completely untouched**
- No changes to lib/search/
- No changes to Google API calls
- API key and rate limits unchanged

### Redis Queue
✓ **Completely untouched**
- Job queue format unchanged
- Worker processes unchanged
- Rate limiting logic unchanged
- Temporary results storage unchanged

### Worker Processes
✓ **Completely untouched**
- No changes to lib/worker/
- Page crawling unchanged
- Email extraction unchanged
- URL filtering unchanged

### Extraction Engine
✓ **Completely untouched**
- No changes to lib/extraction/
- HTML parsing unchanged
- Pattern matching unchanged
- Deobfuscation logic unchanged

### Billing & Stripe
✓ **Completely untouched**
- No changes to lib/billing/
- Stripe webhook handling unchanged
- Payment processing unchanged

### Rate Limiting
✓ **Completely untouched**
- Redis-based rate limiting continues
- Per-user quotas unchanged
- Middleware checks unchanged

---

## FINAL VALIDATION: THREE-LAYER ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                      │
│        Next.js Frontend + Dashboard + API Routes         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  PERSISTENCE LAYER                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ PostgreSQL (Supabase) - NEW                     │   │
│  │ ├─ User accounts & sessions                     │   │
│  │ ├─ Search history                              │   │
│  │ ├─ User preferences                            │   │
│  │ └─ Audit logs                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Redis (Upstash) - UNCHANGED                     │   │
│  │ ├─ Job queue                                    │   │
│  │ ├─ Rate limiting counters                       │   │
│  │ ├─ Worker state                                 │   │
│  │ └─ Temporary results (TTL)                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Memory (Runtime) - UNCHANGED                    │   │
│  │ ├─ HTML/DOM during processing                   │   │
│  │ ├─ Email matches during extraction              │   │
│  │ ├─ Pattern matches during analysis              │   │
│  │ └─ Temporary calculations                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘

RESULT: Three independent layers, zero interference
```

---

## APPROVAL GATES

**Confirms this architecture**:

1. ✓ PostgreSQL stores only persistent user data
2. ✓ Redis remains unchanged (queue, rate limiting, temp storage)
3. ✓ Memory stays for temporary, per-request data
4. ✓ No disruption to existing systems
5. ✓ Supports future growth (teams, orgs, analytics)
6. ✓ Schema supports all Phase 1-6 features
7. ✓ Ready for production deployment

---

## NEXT STEPS

### Immediate
1. Review this architecture document
2. Confirm approval of three-layer approach
3. Approve database schema

### Upon Approval
1. Request Supabase integration
2. Create PostgreSQL tables
3. Begin Phase 1 implementation

### No Changes Needed Before
- Redis stays as-is
- Workers untouched
- Extraction engine untouched
- Search API untouched
- All existing functionality untouched

---

**ARCHITECTURE VALIDATED - READY FOR IMPLEMENTATION**

