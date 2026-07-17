# SYSTEM_DESIGN.md - Detailed System Design Patterns

## Design Principles

### 1. Layered Architecture
- **Presentation Layer**: API endpoints + UI pages
- **Business Logic Layer**: Core extraction, queue, worker
- **Data Layer**: Redis for persistence and state
- **External Layer**: Third-party services (Google PSE, Stripe)

### 2. Single Responsibility
- Each module has one primary purpose
- Queue manages state, worker processes jobs
- Auth validates, rate limiting throttles
- Extraction extracts, deobfuscation deobfuscates

### 3. Middleware Composition
- Middleware wraps handlers, doesn't replace
- Each middleware adds functionality
- Order matters (auth before rate limit before billing)
- Admin auth adds to customer auth, not replaces

### 4. Read-Write Separation
- Admin endpoints are read-only
- Customer endpoints modify state
- Billing logic only on customer side
- Admin gets aggregate view only

---

## Middleware Architecture

### Middleware Stack (Customer)

```typescript
withAuth(
  withRateLimit(
    withBilling(
      customerHandler
    )
  )
)
```

**Execution Order:**
1. `withAuth` - Validate API key, extract user
2. `withRateLimit` - Check hourly quota
3. `withBilling` - Check monthly quota
4. `customerHandler` - Process request
5. `trackUsageEvent` - Log activity (after success)

### Middleware Stack (Admin)

```typescript
withAuth(
  withAdminAuth(
    adminHandler
  )
)
```

**Key Difference:**
- No `withRateLimit` (admin has no quotas)
- No `withBilling` (admin has no billing)
- Adds `withAdminAuth` for role check
- No usage tracking (admin reads are free)

### Each Middleware

**withAuth (lib/auth/middleware.ts)**
```typescript
export const withAuth = (handler) => async (request) => {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) return 401; // Unauthorized
  
  const user = await validateApiKey(apiKey);
  if (!user) return 401; // Invalid key
  
  request.user = user; // Attach to request
  return handler(request);
};
```

**withRateLimit (lib/auth/rate-limit.ts)**
```typescript
export const withRateLimit = (handler) => async (request) => {
  const userId = request.user.id;
  const limit = getRateLimitForPlan(request.user.plan);
  
  const usage = await redis.incr(`rate:${userId}:${hour}`);
  if (usage > limit) return 429; // Too many requests
  
  return handler(request);
};
```

**withBilling (lib/auth/billing.ts)**
```typescript
export const withBilling = (handler) => async (request) => {
  const userId = request.user.id;
  const quota = getQuotaForPlan(request.user.plan);
  
  const usage = await getMonthlyUsage(userId);
  if (usage >= quota) return 403; // Quota exceeded
  
  return handler(request);
};
```

**withAdminAuth (lib/auth/admin-auth.ts)**
```typescript
export const withAdminAuth = (handler) => async (request) => {
  if (!request.user?.id) return 401; // From withAuth
  
  const isAdmin = await validateAdminRole(request.user.id);
  if (!isAdmin) return 403; // Forbidden
  
  request.user.isAdmin = true;
  return handler(request);
};
```

---

## Job Queue Design

### Job State Machine

```
         pending ──(worker claims)──> processing
           ↑                               │
           │                               ├──(success)──> completed
           │                               │
           └──(watchdog finds stuck)       ├──(error)──────┐
                                          └──(timeout)────┤
                                                           ├──> failed
                   (if retries < 3)                       │
                           ↑                              │
                           └──(retry)────────────────────┘
```

### Job Structure in Redis

**String key: `job:{jobId}`**
```json
{
  "id": "job_abc123",
  "userId": "user_001",
  "url": "https://example.com",
  "status": "processing",
  "emails": [],
  "retries": 1,
  "maxRetries": 3,
  "createdAt": 1689350000000,
  "startedAt": 1689350005000,
  "completedAt": null,
  "error": null,
  "emailCount": 0,
  "processingTimeMs": 0
}
```

### Set Keys for Fast Queries

- `jobs:pending` → SET of job IDs in pending state
- `jobs:processing` → SET of job IDs in processing state
- `jobs:completed` → SET of job IDs in completed state
- `jobs:failed` → SET of job IDs in failed state
- `user:{userId}:jobs` → SET of all jobs for user

### Atomic Job Claiming (SETNX)

**Problem:** Two workers might claim same job

**Solution:** Redis SETNX (Set if Not eXists)

```typescript
// Worker 1 tries to claim job
const locked = await redis.set(
  `jobs:lock:job123`,
  'worker_1',
  'NX',      // Only set if doesn't exist
  'EX',      // Expiration
  35         // 35 seconds (longer than 20s timeout)
);

if (locked) {
  // Worker 1 claimed it
  await markProcessing('job123');
  await extractEmails(url);
} else {
  // Worker 2 already claimed it
  continue; // Skip to next job
}
```

### Watchdog Logic

**Runs every 10 seconds:**

```typescript
async function runWatchdog() {
  const stuckJobs = await getJobsInState('processing');
  
  for (const job of stuckJobs) {
    const elapsed = Date.now() - job.startedAt;
    
    if (elapsed > 30000) { // 30 seconds
      if (job.retries < job.maxRetries) {
        // Recover: reset to pending
        await retryJob(job.id);
        console.log(`[WATCHDOG] Recovered stuck job ${job.id}`);
      } else {
        // Failed: exceeded max retries
        await markFailed(job.id, 'Exceeded max retries (stuck)');
        console.log(`[WATCHDOG] FAILED job ${job.id} - max retries exceeded`);
      }
    }
  }
}
```

---

## Email Extraction Design

### Two-Stage Strategy

**Stage 1: jsdom (Fast)**
- Parse HTML without JavaScript
- 5-second timeout
- Suitable for: static sites, immediate content
- Fails on: JS-rendered emails, client-side content

**Stage 2: Puppeteer (Slower)**
- Launch browser, render JS
- 10-second timeout
- Suitable for: React apps, SPA sites, JS-generated emails
- Higher resource usage

### Extraction Cascade

```typescript
async function extractEmails(url) {
  let emails = [];
  
  try {
    // Try jsdom first (fast)
    emails = await extractWithJsdom(url, { timeout: 5000 });
    if (emails.length > 0) return emails; // Success
  } catch (e) {
    console.log(`[EXTRACT] jsdom failed for ${url}, trying Puppeteer`);
  }
  
  try {
    // Fallback to Puppeteer (slower)
    emails = await extractWithPuppeteer(url, { timeout: 10000 });
    if (emails.length > 0) return emails; // Success
  } catch (e) {
    console.log(`[EXTRACT] Puppeteer failed for ${url}`);
  }
  
  // Both failed
  return [];
}
```

### Deobfuscation Strategy

**10+ Patterns Handled:**

1. **Text substitution**
   - "name [at] domain [dot] com"
   - "name(at)domain(dot)com"
   - "name @ domain . com"

2. **HTML entities**
   - "&#109;&#101;" → "me"
   - Concatenate to form email

3. **URL encoding**
   - "%40" → "@"
   - "%2E" → "."

4. **Base64**
   - "aW5mb0BleGFtcGxlLmNvbQ==" → "info@example.com"

5. **Mailto links**
   - `<a href="mailto:...">` → Extract from href

6. **JavaScript obfuscation**
   - Document.write patterns
   - Eval'd strings

7. **Cloudflare protection**
   - Attempt reverse engineering of Cloudflare scripts

### Deduplication

```typescript
const emails = await extractEmails(url);
const normalized = emails
  .map(e => e.toLowerCase().trim())
  .filter(e => isValidEmail(e));

const deduplicated = [...new Set(normalized)]; // Remove duplicates
return deduplicated;
```

---

## Rate Limiting Design

### Per-User Hourly Quotas

**Redis Key Structure:**
```
ratelimit:{userId}:{hour} → INCR counter
```

**Hour Calculation:**
```typescript
const hour = Math.floor(Date.now() / 3600000);
```

**Plan-Based Limits:**
- Free: 10 requests/hour
- Pro: 100 requests/hour
- Enterprise: 1000 requests/hour

**Expiration:**
- Key auto-expires after 1 hour
- No manual cleanup needed

### Implementation

```typescript
async function checkRateLimit(userId, plan) {
  const limit = {
    'free': 10,
    'pro': 100,
    'enterprise': 1000
  }[plan];
  
  const hour = Math.floor(Date.now() / 3600000);
  const key = `ratelimit:${userId}:${hour}`;
  
  const usage = await redis.incr(key);
  await redis.expire(key, 3600); // 1 hour expiration
  
  if (usage > limit) {
    throw new Error('Rate limit exceeded');
  }
  
  return usage; // Usage count
}
```

---

## Billing Design

### Monthly Quotas

**Redis Key Structure:**
```
billing:{userId}:{year}:{month} → INCR counter
```

**Quota Limits:**
- Free: 1,000 jobs/month
- Pro: 10,000 jobs/month
- Enterprise: 100,000 jobs/month

**Implementation:**

```typescript
async function checkBillingQuota(userId, plan) {
  const quota = {
    'free': 1000,
    'pro': 10000,
    'enterprise': 100000
  }[plan];
  
  const now = new Date();
  const key = `billing:${userId}:${now.getFullYear()}:${now.getMonth()}`;
  
  const usage = await redis.get(key) || 0;
  
  if (usage >= quota) {
    throw new Error('Monthly quota exceeded');
  }
  
  return quota - usage; // Remaining quota
}
```

### Usage Tracking

**When tracked:**
- After successful job completion
- Only for customer-initiated requests
- Admin operations don't count

**What tracked:**
- User ID
- Job ID
- Timestamp
- Email count found
- Success status

---

## Admin Authorization Design

### Admin List Storage

**In-Memory (for now):**
```typescript
const ADMIN_USERS = new Set([
  'user_admin_001',
  'user_admin_002',
  'user_super_admin'
]);
```

**Future: Database**
```sql
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  role TEXT ('admin' | 'super_admin'),
  createdAt TIMESTAMP
);
```

### Authorization Check

```typescript
async function validateAdminRole(userId) {
  // Check in-memory list (can add database later)
  return ADMIN_USERS.has(userId);
}
```

### Role-Based Access (Future)

```typescript
const PERMISSIONS = {
  'admin': {
    'read:dashboard': true,
    'read:jobs': true,
    'read:queue': true,
    'read:users': true,
    'write:*': false
  },
  'super_admin': {
    'read:*': true,
    'write:*': true
  }
};
```

---

## Scalability Design

### Horizontal Worker Scaling

**Multiple Workers:**
- Worker 1 claims job via SETNX
- Worker 2 tries same job, lock fails
- Worker 2 moves to next job
- No conflicts, no duplicates

### Queue Scaling

**Upstash Redis:**
- Serverless, auto-scales
- No infrastructure management
- Atomic SETNX operations
- High throughput

### API Scaling

**Next.js Built-in:**
- Vercel auto-scales API routes
- Multiple instances run simultaneously
- Each instance can claim jobs via SETNX
- Shared Redis backend coordinates

### Cache Scaling

**Metrics Caching:**
- 10-second cache on metrics
- Reduces Redis queries 90%
- Admin reads bypass cache
- ~100ms → ~10ms response time

---

## Error Handling Design

### Extraction Errors

**Strategy:** Graceful degradation

```typescript
try {
  // Try jsdom
  return await extractWithJsdom(url);
} catch (jsdomError) {
  try {
    // Fallback to Puppeteer
    return await extractWithPuppeteer(url);
  } catch (puppeteerError) {
    // Both failed
    return { emails: [], error: puppeteerError.message };
  }
}
```

### Job Failures

**Retry Logic:**
- Retry up to 3 times
- Reset status to pending
- Increment retry counter
- Watchdog may recover stuck jobs

### Permanent Failures

**After 3 retries:**
- Mark job as failed
- Store error message
- User can see in dashboard
- No further retries

---

## Monitoring Design

### Metrics Collection

**Real-Time:**
- Queue depth (pending, processing, completed, failed)
- Processing time (average)
- Success rate (%)
- Worker status

**Stored in Redis:**
```
metrics:queue:pending    → Counter
metrics:queue:processing → Counter
metrics:queue:completed  → Counter
metrics:queue:failed     → Counter
metrics:avg_processing   → Float (ms)
metrics:worker:status    → String (active/idle)
```

### Admin Dashboard Updates

**Frequency:** 10 seconds

**Operations:**
- `SCARD jobs:pending`
- `SCARD jobs:processing`
- `SCARD jobs:completed`
- `SCARD jobs:failed`
- Calculate averages from samples

---

## Security Design

### API Key Format

**Format:** `sk_{env}_{random}`

Examples:
- `sk_test_abc123def456`
- `sk_live_xyz789uvw012`

### Key Validation

**withAuth checks:**
1. Key present in header
2. Correct format (sk_test_* or sk_live_*)
3. Maps to valid user ID
4. Extracts plan from key

### Rate Limit Attack Prevention

**Per-user limits prevent:**
- Denial of service attacks
- Quota exhaustion attacks
- Brute force attacks

### Admin Access Control

**Two layers:**
1. Valid API key required (withAuth)
2. Admin role required (withAdminAuth)

**Result:** 401 or 403 for unauthorized access

