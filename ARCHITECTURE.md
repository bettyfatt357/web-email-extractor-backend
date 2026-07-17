# ARCHITECTURE.md - System Architecture Overview

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Layers](#core-layers)
3. [Data Flow](#data-flow)
4. [Component Interaction](#component-interaction)
5. [Security Architecture](#security-architecture)
6. [Scalability Architecture](#scalability-architecture)

---

## System Overview

This is a **complete SaaS platform** for email extraction from websites with authentication, billing, customer dashboards, and administrative tools.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PUBLIC ENDPOINTS                         │
│  POST /api/search    GET /api/metrics    GET /api/jobs-paginated │
└─────────────────────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │         CUSTOMER DASHBOARD (/dashboard/*)          │
        │  - Search management                              │
        │  - Job tracking                                   │
        │  - API key management                            │
        │  - Usage analytics                               │
        │  - Billing management                            │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │          ADMIN PLATFORM (/admin/*)                 │
        │  - System metrics                                 │
        │  - Queue monitoring                               │
        │  - User management                                │
        │  - System health                                  │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │            BACKEND SYSTEMS (Core Logic)            │
        │  ┌─────────────────────────────────────────┐      │
        │  │ Authentication & Authorization          │      │
        │  │ - API key validation (customer)         │      │
        │  │ - Admin role validation (admin)         │      │
        │  └─────────────────────────────────────────┘      │
        │  ┌─────────────────────────────────────────┐      │
        │  │ Rate Limiting & Billing                 │      │
        │  │ - Hourly rate limits (per plan)        │      │
        │  │ - Monthly quotas (per plan)            │      │
        │  │ - Stripe integration                   │      │
        │  └─────────────────────────────────────────┘      │
        │  ┌─────────────────────────────────────────┐      │
        │  │ Email Extraction Pipeline               │      │
        │  │ - URL discovery (Google PSE)            │      │
        │  │ - Email extraction (jsdom/Puppeteer)   │      │
        │  │ - Deobfuscation (10+ patterns)         │      │
        │  │ - Deduplication                         │      │
        │  └─────────────────────────────────────────┘      │
        │  ┌─────────────────────────────────────────┐      │
        │  │ Queue System                            │      │
        │  │ - Job management (Upstash Redis)       │      │
        │  │ - SETNX atomic locking                 │      │
        │  │ - Job state persistence                │      │
        │  └─────────────────────────────────────────┘      │
        │  ┌─────────────────────────────────────────┐      │
        │  │ Worker System                           │      │
        │  │ - Real-time job processing             │      │
        │  │ - Watchdog for stuck jobs              │      │
        │  │ - Retry logic (max 3 attempts)        │      │
        │  └─────────────────────────────────────────┘      │
        └───────────────────────────────────────────────────┘
                                ↓
        ┌───────────────────────────────────────────────────┐
        │              EXTERNAL SERVICES                     │
        │  - Google PSE API (URL discovery)                 │
        │  - Upstash Redis (queue & cache)                 │
        │  - Stripe API (billing)                          │
        └───────────────────────────────────────────────────┘
```

---

## Core Layers

### Layer 1: API & Presentation

**Customer Endpoints:**
- `POST /api/search` - Initiate email search
- `GET /api/metrics` - Get system metrics
- `GET /api/jobs-paginated` - Paginated job list
- `GET /api/job/:id` - Single job details
- `GET /api/job/:id/status` - Job status
- `GET /api/job/:id/result` - Email results

**Admin Endpoints:**
- `GET /api/admin/dashboard` - System metrics
- `GET /api/admin/jobs` - All jobs
- `GET /api/admin/queue/health` - Queue health
- `GET /api/admin/users` - User list

**Billing Endpoints:**
- `GET /api/billing/status` - User billing info
- `POST /api/billing/webhook` - Stripe webhooks

### Layer 2: Authentication & Authorization

**Middleware Chain (Customer):**
```
Request
  ↓
withAuth (validate x-api-key header)
  ├─ Extract user ID and plan
  ├─ Return 401 if invalid
  └─ Attach user to request
  ↓
withRateLimit (hourly quotas)
  ├─ Check hourly limit (free: 10, pro: 100, enterprise: 1000)
  ├─ Return 429 if exceeded
  └─ Continue if within limit
  ↓
withBilling (monthly quotas)
  ├─ Check monthly quota (per plan)
  ├─ Return 403 if exceeded
  └─ Continue if within quota
  ↓
Handler (process request)
```

**Middleware Chain (Admin):**
```
Request
  ↓
withAuth (validate x-api-key header) ← SAME as customer
  ├─ Extract user ID and plan
  ├─ Return 401 if invalid
  └─ Attach user to request
  ↓
withAdminAuth (admin role check - NEW LAYER)
  ├─ Check if user ID is in admin list
  ├─ Return 403 if not admin
  └─ Attach admin flag to request
  ↓
Admin Handler (READ-ONLY, no quotas)
```

**Key Design:**
- Admin auth is LAYERED ON TOP of existing auth, NOT replacing it
- Admin routes bypass rate limiting and billing (intentional)
- All operations are read-only in admin endpoints

### Layer 3: Business Logic

**Search & Extraction:**
1. User initiates search via `POST /api/search`
2. Google PSE discovery returns URLs (max 50)
3. Each URL becomes a job in queue (status: `pending`)
4. Worker claims jobs and processes them
5. Emails extracted and stored with job results

**Job Lifecycle:**
```
pending → processing → completed/failed
                ↑              ↓
                └─ (retry, max 3) ─┘
           (watchdog recovery if stuck)
```

**Queue Locking:**
- Uses Redis SETNX for atomic job claiming
- Only one worker can claim a job simultaneously
- Lock expires after 35 seconds (prevents permanent locks)

**Watchdog:**
- Runs every 10 seconds
- Detects jobs stuck in `processing` state (>30 seconds)
- Recovers by: resetting to `pending` + incrementing retry count
- Permanently fails job if retry count > 3

### Layer 4: Data Persistence

**Redis (Upstash):**
- Queue state (job metadata)
- Rate limit counters (hourly)
- Cache (session, metrics)

**Data Structure:**
```
jobs:{status}        → SET of job IDs (e.g., jobs:pending)
job:{id}             → STRING (JSON job object)
jobs:lock:{id}       → STRING (worker ID who claimed job)
metrics:*            → HASH/STRING (queue statistics)
ratelimit:*          → HASH/STRING (per-user hourly counts)
```

---

## Data Flow

### Search & Extraction Flow

```
1. Customer API Request
   POST /api/search { query: "tech startups" }
   
2. Authentication
   withAuth checks x-api-key header
   
3. Rate Limiting
   withRateLimit checks hourly quota
   
4. Billing Check
   withBilling checks monthly quota
   
5. Search Execution
   /api/search handler:
   └─ Call Google PSE discovery
   └─ Get list of URLs (max 50)
   └─ For each URL: create job in Redis queue
   └─ Return job IDs to customer
   
6. Queue State After /api/search
   Redis SET jobs:pending = [job1, job2, ..., job50]
   Redis STRING job:1 = { id, url, status: 'pending', ... }
   
7. Worker Processing (Background)
   Worker polls: getNextJob() every 1 second
   If job found:
     └─ Try SETNX lock to claim job
     └─ If locked: mark processing, start extraction
     └─ Extract emails using jsdom + Puppeteer
     └─ Deobfuscate emails
     └─ Mark completed + store results
     └─ Release lock
   
8. Customer Checks Progress
   GET /api/metrics → see queue status
   GET /api/jobs-paginated → see job list
   GET /api/job/:id/status → see single job status
   GET /api/job/:id/result → get extracted emails
   
9. Result Delivery
   Customer receives:
   {
     jobId: "job_123",
     status: "completed",
     url: "https://example.com",
     emailsFound: 42,
     emails: ["contact@example.com", ...],
     processingTimeMs: 3500
   }
```

### Admin Monitoring Flow

```
1. Admin Request
   GET /api/admin/dashboard
   
2. Authentication (Layer 1)
   withAuth validates x-api-key
   
3. Authorization (Layer 2 - NEW)
   withAdminAuth checks admin role
   
4. Read-Only Query
   Admin handler reads:
   └─ SCARD jobs:pending (cardinality = count)
   └─ SCARD jobs:processing
   └─ SCARD jobs:completed
   └─ SCARD jobs:failed
   └─ Sample 50 completed jobs for metrics
   
5. Response
   Admin sees:
   {
     queueStats: {
       pending: 150,
       processing: 3,
       completed: 8900,
       failed: 45
     },
     health: "healthy",
     avgProcessingTime: 3200,
     workerStatus: "active"
   }
```

---

## Component Interaction

### Queue System (`lib/queue/queue.ts`)

**Methods:**
- `addJob(url)` - Add URL as pending job
- `getNextJob()` - Claim next job with SETNX lock
- `markProcessing(jobId)` - Set status to processing
- `markCompleted(jobId, emails)` - Complete job with results
- `markFailed(jobId, error)` - Mark job as failed
- `retryJob(jobId)` - Reset to pending, increment retries
- `getJobsInState(status)` - Get all jobs in state

**Thread Safety:**
- `getNextJob()` uses SETNX for atomic claiming
- Only one worker can claim per job
- Lock timeout prevents permanent locks

### Worker System (`lib/worker/worker.ts`)

**Execution:**
```bash
npm run worker  # Starts continuous polling loop
```

**Flow:**
1. Infinite while loop
2. Poll queue every 1 second
3. For each job:
   - Try atomic lock (SETNX)
   - If locked: process extraction
   - If failed: retry or mark failed
4. Log every action with [WORKER] prefix

### Watchdog System (`lib/worker/watchdog.ts`)

**Execution:**
- Runs every 10 seconds (setInterval)
- Detects stuck jobs (processing > 30 seconds)
- Recovers: reset to pending + increment retries
- Max 3 retries per job

### Extraction Engine (`lib/extraction/engine.ts`)

**Strategy:**
1. Try jsdom first (fast, 5-second timeout)
2. If timeout/error: fallback to Puppeteer (10-second timeout)
3. Combine results from both methods
4. Pass through deobfuscator
5. Deduplicate

**Timeout Cascade:**
- jsdom attempt: 5 seconds
- Puppeteer attempt: 10 seconds
- Job-level timeout: 20 seconds

---

## Security Architecture

### Authentication

**Customer Authentication:**
- API keys: `sk_test_*` or `sk_live_*` format
- Passed via `x-api-key` header
- Validated in `withAuth` middleware
- Plan extracted from key prefix

**Admin Authentication:**
- Uses same API key validation (withAuth)
- PLUS additional admin role check (withAdminAuth)
- Admin users stored in in-memory list
- Role: `admin` or `super_admin`

### Authorization

**Customer Authorization:**
- Rate limits enforced (hourly quota)
- Billing quotas enforced (monthly quota)
- Each user can only see their own jobs
- Each user limited to their own quotas

**Admin Authorization:**
- 403 Forbidden for non-admins
- Read-only operations only
- No state modification allowed
- Full system visibility

### Data Isolation

**Customer Data:**
- Jobs scoped to user
- Quotas tracked per user
- Billing tracked per user

**Admin Data:**
- Aggregate metrics only
- No individual customer data exposure
- User list anonymized (no email/password)

---

## Scalability Architecture

### Horizontal Scaling

**Workers:**
- Multiple worker processes can run simultaneously
- Each claims jobs via SETNX atomic locking
- No duplicate processing (lock prevents it)
- Scales linearly with worker count

**Queue:**
- Upstash Redis handles distributed locking
- SETNX provides atomicity across instances
- No coordination needed between workers

### Rate Limiting

**Per-User Hourly Limits:**
- Free: 10 requests/hour
- Pro: 100 requests/hour
- Enterprise: 1000 requests/hour
- Tracked in Redis with expiring keys

**Per-User Monthly Quotas:**
- Checked before job queuing
- Prevents over-processing
- Enforced for billing accuracy

### Caching

**Metrics Caching:**
- Dashboard metrics cached (10-second TTL)
- Reduces Redis query load
- Admin reads use fresh data (no cache)

**Job Results Caching:**
- Completed job results cached
- 24-hour TTL
- Reduces extraction re-runs

---

## Deployment Architecture

### Environment Variables

**Required:**
```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
GOOGLE_PSE_API_KEY=...
STRIPE_SECRET_KEY=...
```

**Optional:**
```
ALLOW_ANONYMOUS=true
RATE_LIMIT_FREE=10
RATE_LIMIT_PRO=100
RATE_LIMIT_ENTERPRISE=1000
```

### Database Schema

**Queue Management:**
```
jobs:pending    → SET { job1, job2, ... }
jobs:processing → SET { job3, job4, ... }
jobs:completed  → SET { job5, job6, ... }
jobs:failed     → SET { job7, job8, ... }

job:{id}        → JSON {
                   id: string,
                   url: string,
                   status: 'pending' | 'processing' | 'completed' | 'failed',
                   emails: string[],
                   retries: number,
                   maxRetries: 3,
                   createdAt: number,
                   startedAt: number,
                   completedAt: number,
                   error: string | null,
                   userId: string
                }
```

### Monitoring

**Metrics Tracked:**
- Queue length (per status)
- Job processing time (average)
- Success/failure rate
- Worker status
- System health

**Admin Dashboard:**
- Real-time metrics (10-second refresh)
- Queue visualization
- User statistics
- System alerts

