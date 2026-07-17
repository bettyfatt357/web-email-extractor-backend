# Runtime Validation Checklist - End-to-End Testing

**IMPORTANT: NO CODE CHANGES - INSPECTION ONLY**

This guide provides exact steps to validate the entire application at runtime without any code modifications.

---

## Part 1: Starting the Application

### Prerequisites Check

Before starting, verify:

```bash
# Check Node.js version (need 18+)
node --version
# Expected: v18.x.x or higher

# Check pnpm installed
pnpm --version
# Expected: 8.x.x or higher

# Navigate to project
cd /vercel/share/v0-project

# Verify .env.development.local exists
cat .env.development.local | head -5
# Expected: GOOGLE_API_KEY=AIzaSyABReA6-...
# Expected: REDIS_URL=rediss://...
```

### Terminal 1: Start Development Server

**Command:**
```bash
cd /vercel/share/v0-project
npm run dev
```

**Expected Output (Terminal 1):**
```
> v0-project@1.0.0 dev
> next dev

  ▲ Next.js 16.0.0
  - Local:        http://localhost:3000
  - Environments: .env.development.local

✓ Ready in 3.2s
✓ Compiled client successfully
✓ API routes loaded: 14 routes
```

**Success Signs:**
- ✓ Server starts on port 3000
- ✓ Next.js version displayed (16.x)
- ✓ No red error messages
- ✓ "Ready in X seconds" message
- ✓ Hot reload enabled (can modify files and see changes)

**Failure Signs:**
- ✗ "EADDRINUSE" - Port 3000 already in use
- ✗ "Cannot find module" - Missing dependencies
- ✗ "Cannot read properties of undefined" - Env var missing
- ✗ Red error stack trace - Code error

**If Failed:**
1. Check port: `lsof -i :3000` (kill process if needed: `kill -9 <PID>`)
2. Install deps: `pnpm install`
3. Check env vars: `cat .env.development.local`
4. Check Node version: `node --version`

---

### Terminal 2: Start Background Worker

**Command:**
```bash
cd /vercel/share/v0-project
npm run worker
```

**Expected Output (Terminal 2):**
```
> v0-project@1.0.0 worker
> node dist/lib/worker/worker.js

[WORKER] Initializing email extraction worker...
[WORKER] Connected to Redis at rediss://tidy-liger-104431.upstash.io:6379
[WORKER] Listening for jobs in queue: jobs:pending
[WORKER] Ready and waiting for jobs
```

**Success Signs:**
- ✓ Shows "[WORKER]" prefix
- ✓ "Connected to Redis" message
- ✓ "Listening for jobs" message
- ✓ "Ready and waiting for jobs" message
- ✓ Worker stays running (doesn't exit)

**Failure Signs:**
- ✗ "Cannot connect to Redis" - Redis connection failed
- ✗ "ENOTFOUND" - DNS resolution error
- ✗ Worker exits with code 1 - Crash
- ✗ "Timeout" - Redis unreachable

**If Failed:**
1. Verify Redis connection: `echo "ping" | nc tidy-liger-104431.upstash.io 6379`
2. Check env vars: `echo $REDIS_URL`
3. Check internet connection: `curl https://tidy-liger-104431.upstash.io`
4. Check firewall/VPN

---

### Verification: Both Services Running

**In Terminal 1 (Dev Server):**
- Shows "Ready in X seconds"
- Shows hot reload capability
- Listening on http://localhost:3000

**In Terminal 2 (Worker):**
- Shows "[WORKER] Ready and waiting for jobs"
- Shows Redis connection established
- Worker process is active (not exiting)

**Success Criteria:**
- ✓ Both terminals show no errors
- ✓ Both show "Ready" or "Listening" messages
- ✓ Neither process has exited
- ✓ Can access http://localhost:3000 in browser

---

## Part 2: User Flow Testing

### Step 1: Access Landing Page

**Action:**
```
Open browser → http://localhost:3000
```

**Expected UI:**
- Landing page displays
- Header/navigation visible
- No console errors (F12 → Console tab)
- Page loads within 2 seconds

**Success Signs:**
- ✓ Page loads without errors
- ✓ Content visible
- ✓ No red errors in browser console
- ✓ Links are clickable

**What You Should See:**
- Navigation menu (if present)
- Call-to-action buttons
- Logo/branding
- Information about the service

**Failure Signs:**
- ✗ Blank page
- ✗ "Connection refused" error
- ✗ Red errors in console
- ✗ 500 error page
- ✗ Page takes >5 seconds to load

**If Failed:**
1. Check dev server terminal (Terminal 1) for errors
2. Check browser console (F12)
3. Verify http://localhost:3000 is accessible: `curl http://localhost:3000`

---

### Step 2: Access User Dashboard

**Action:**
```
In browser, navigate to: http://localhost:3000/dashboard
```

**Expected Behavior:**
- Dashboard page loads
- Shows metrics/stats (if you're an authenticated user)
- Or shows login/auth prompt

**Note:** Authentication uses API key in header (x-api-key). Since you're using browser, you may see:
- Either: Redirect to login
- Or: Public dashboard if ALLOW_ANONYMOUS=true

**Success Signs:**
- ✓ Page loads (either dashboard or auth prompt)
- ✓ No 500 errors
- ✓ No connection errors
- ✓ Page structure visible

**Expected Response:**
If not authenticated:
```
Expected: Auth error or redirect, OR
Dashboard shows "Please provide API key" message
```

If you have auth:
```
Dashboard displays:
- User metrics
- Query count
- Jobs processed
- Storage used
```

**Failure Signs:**
- ✗ 500 Internal Server Error
- ✗ "Cannot read properties" error
- ✗ Blank page
- ✗ Infinite loading

**If Failed:**
1. Check dev server logs (Terminal 1) for stack trace
2. Open browser DevTools (F12) → Network tab → refresh
3. Look at failed requests and their responses
4. Check if middleware is throwing error

---

### Step 3: Submit Email Extraction Job (API Only)

**Using curl** (since browser auth is complex):

```bash
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_pro_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "contact us form github.com",
    "pages": 1
  }'
```

**Expected Response:**
```json
{
  "searchId": "search_1721052600000_sk_test_user_pro_12345",
  "totalQueued": 5,
  "duplicatesRemoved": 0,
  "jobs": [
    {
      "id": "job_1_github.com/contact",
      "status": "pending",
      "url": "https://github.com/contact",
      "createdAt": "2026-07-15T14:30:00.000Z"
    },
    // ... more jobs
  ]
}
```

**Success Signs:**
- ✓ HTTP 200 response
- ✓ Returns searchId
- ✓ Returns jobs array with status "pending"
- ✓ createdAt timestamp present
- ✓ Jobs have unique IDs

**Failure Signs:**
- ✗ HTTP 401 - "Unauthorized" (bad API key)
- ✗ HTTP 429 - "Rate limited" (exceeded quota)
- ✗ HTTP 400 - "Bad request" (invalid JSON)
- ✗ HTTP 500 - "Internal server error"
- ✗ Empty response or null

**What Success Looks Like:**
- Terminal 1 shows: `POST /api/search 200 in 234ms`
- Terminal 2 shows: `[WORKER] Processing job_1_github.com/contact`
- Response includes 5 URLs extracted from "github.com"
- Each job has status: "pending"

**If Failed:**
1. Check curl command syntax
2. Verify API key: `echo "sk_test_user_pro_12345" | grep "sk_test"`
3. Check Terminal 1 for error stack trace
4. Verify Content-Type header is correct

---

### Step 4: Check Job Status (Queued)

**Using curl:**

```bash
curl -X GET "http://localhost:3000/api/jobs-paginated?limit=10&offset=0" \
  -H "x-api-key: sk_test_user_pro_12345"
```

**Expected Response (Jobs are queued, not yet processing):**
```json
{
  "jobs": [
    {
      "id": "job_1_github.com/contact",
      "status": "pending",
      "url": "https://github.com/contact",
      "emailCount": 0,
      "createdAt": "2026-07-15T14:30:00.000Z",
      "startedAt": null,
      "completedAt": null
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

**Success Signs:**
- ✓ HTTP 200 response
- ✓ jobs array is not empty
- ✓ Each job has status: "pending" or "processing" or "completed"
- ✓ createdAt is populated
- ✓ IDs match the IDs from Step 3

**Failure Signs:**
- ✗ Empty jobs array (jobs not created)
- ✗ HTTP 401 (auth failed)
- ✗ HTTP 500 (server error)

**What Success Looks Like:**
- Jobs appear in the list
- Status is "pending" (waiting for worker to pick up)
- createdAt timestamp shows recent time
- emailCount is 0 (job not processed yet)

**If Failed:**
1. Verify API key is the same as Step 3
2. Check Terminal 2 (worker) for errors
3. Verify Redis connection in worker logs

---

### Step 5: Wait for Worker to Process

**Time:** Typically 5-15 seconds per job

**Check Worker Output (Terminal 2):**

Watch Terminal 2 for:
```
[WORKER] Processing job_1_github.com/contact
[WORKER] Extracting emails from https://github.com/contact
[WORKER] Found X emails: [email1@github.com, ...]
[WORKER] Job completed: job_1_github.com/contact
```

**Success Signs in Terminal 2:**
- ✓ "Processing job_*" message
- ✓ "Extracting emails from" message
- ✓ "Found X emails" message
- ✓ "Job completed" message
- ✓ Shows email addresses found

**Failure Signs in Terminal 2:**
- ✗ "Error processing" message
- ✗ "Connection timeout" message
- ✗ "Rate limited" message
- ✗ Job is stuck (no new output for >30 seconds)

**What to Watch For:**
- Monitor Terminal 2 for activity
- Should see "Processing" message within 5 seconds of API call
- Email extraction should complete within 10-15 seconds
- Watch for any [ERROR] messages

**If No Activity:**
1. Check if worker process is still running (Terminal 2)
2. Verify worker is listening: "Ready and waiting for jobs"
3. Check Terminal 1 for API errors
4. Verify Redis connection: `redis-cli ping`

---

### Step 6: Check Job Status (Completed)

**Using curl (after waiting 15+ seconds):**

```bash
curl -X GET "http://localhost:3000/api/jobs-paginated?limit=10&offset=0" \
  -H "x-api-key: sk_test_user_pro_12345"
```

**Expected Response (After Worker Processes):**
```json
{
  "jobs": [
    {
      "id": "job_1_github.com/contact",
      "status": "completed",
      "url": "https://github.com/contact",
      "emailCount": 3,
      "createdAt": "2026-07-15T14:30:00.000Z",
      "startedAt": "2026-07-15T14:30:02.000Z",
      "completedAt": "2026-07-15T14:30:15.000Z",
      "emails": [
        "contact@github.com",
        "support@github.com",
        "legal@github.com"
      ]
    }
  ]
}
```

**Success Signs:**
- ✓ status changed from "pending" to "completed"
- ✓ emailCount > 0 (emails were found)
- ✓ emails array populated with actual addresses
- ✓ completedAt timestamp is set
- ✓ startedAt timestamp is set

**Failure Signs:**
- ✗ status is still "pending" after 30 seconds
- ✗ status is "failed"
- ✗ emailCount is 0 (no emails found)
- ✗ completedAt is null

**What Success Looks Like:**
- Job status progressed: pending → processing → completed
- Processing time was 10-20 seconds
- Found 1-10 emails
- Emails are valid format (contain @ symbol)

**If Job Status is Still "Pending":**
1. Check Terminal 2 (worker) for errors
2. Verify worker received the job
3. Check if worker process crashed
4. Verify Redis connection

**If Job Status is "Failed":**
1. Check Terminal 2 for error messages
2. Look for "Error processing" or "Failed to extract"
3. Verify URL is reachable: `curl -I https://github.com/contact`

**If emailCount is 0:**
1. Website may not have contact form or emails
2. Extraction may have failed silently
3. Check Terminal 2 logs for warnings

---

### Step 7: Verify UI Response (Browser Dashboard)

**Action:**
```
Browser → http://localhost:3000/dashboard/jobs
```

**Expected UI:**
- Jobs list visible
- Shows recently submitted jobs
- Shows status (pending/processing/completed)
- Shows email count
- Shows timestamps

**Note:** May require API key in header via browser DevTools or Postman

**Success Signs:**
- ✓ Page loads
- ✓ Jobs are displayed
- ✓ Statuses are accurate
- ✓ Email counts match API response
- ✓ No errors in console

**Failure Signs:**
- ✗ Empty table/list
- ✗ Authentication errors
- ✗ Layout broken
- ✗ Data doesn't match API

---

## Part 3: Worker Validation

### Verifying Worker is Processing

**In Terminal 2 (Worker Process):**

Watch for these log patterns:

```
[WORKER] Processing job_ID_HOSTNAME
[WORKER] Extracting emails from URL
[WORKER] Found X emails: [list]
[WORKER] Job completed successfully
```

**Success Indicators:**
- ✓ "[WORKER]" prefix on all messages
- ✓ "Processing" messages appear after API calls
- ✓ "Found X emails" shows > 0
- ✓ "Job completed successfully" appears
- ✓ New jobs appear after each API call

**Example Successful Worker Output:**
```
[WORKER] Ready and waiting for jobs
[WORKER] Processing job_1_github.com/contact
[WORKER] Extracting emails from https://github.com/contact
[WORKER] Found 3 emails: [contact@github.com, support@github.com, legal@github.com]
[WORKER] Job completed successfully: job_1_github.com/contact
[WORKER] Processing job_2_github.com/security
[WORKER] Extracting emails from https://github.com/security
[WORKER] Found 1 emails: [security@github.com]
[WORKER] Job completed successfully: job_2_github.com/security
```

### Detecting Worker Failures

**Failure Log Patterns:**

```
[WORKER] Error: Connection timeout
[WORKER] Failed to process job: REASON
[ERROR] Unexpected token in JSON
[WORKER] No jobs found
```

**Common Failures:**

1. **Connection Timeout**
   ```
   [WORKER] Error: Network timeout after 30000ms
   ```
   - Cause: URL unreachable or slow
   - Fix: Website may be down or blocking bot

2. **Invalid Job Format**
   ```
   [WORKER] Error: Cannot parse job JSON
   ```
   - Cause: Corrupted data in Redis
   - Fix: Clear Redis cache and re-submit

3. **Redis Disconnection**
   ```
   [WORKER] Error: Redis connection lost
   [WORKER] Reconnecting...
   ```
   - Cause: Network issue or Redis down
   - Fix: Check Redis status: `curl https://tidy-liger-104431.upstash.io`

4. **Rate Limited**
   ```
   [WORKER] Error: Rate limited - try again later
   ```
   - Cause: Too many requests to target website
   - Fix: Wait or try different website

### Confirming Worker Health

**Check Worker Status via API:**

```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: admin_user_001"
```

**Expected Response:**
```json
{
  "queue": {
    "pending": 0,
    "processing": 0,
    "completed": 23,
    "failed": 1
  },
  "workers": {
    "active": 1,
    "idle": 0,
    "total": 1
  }
}
```

**Success Signs:**
- ✓ queue.completed > 0 (jobs finished)
- ✓ queue.pending or queue.processing (jobs processed)
- ✓ workers.total >= 1 (worker is running)
- ✓ workers.active = 1 (worker is actively working)

---

## Part 4: Admin Validation

### Step 1: Access Admin Dashboard Overview

**Using curl:**

```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: admin_user_001"
```

**Expected Response:**
```json
{
  "queue": {
    "pending": 5,
    "processing": 2,
    "completed": 150,
    "failed": 3
  },
  "successRate": 98.04,
  "averageProcessingTime": 12500,
  "workers": {
    "active": 1,
    "idle": 0,
    "total": 1
  },
  "today": {
    "jobsProcessed": 42,
    "emailsExtracted": 1245
  }
}
```

**Success Signs:**
- ✓ HTTP 200 response
- ✓ All queue metrics present
- ✓ workers object shows running workers
- ✓ today metrics show current data
- ✓ successRate is between 0-100

**Failure Signs:**
- ✗ HTTP 403 - "Forbidden" (not admin)
- ✗ HTTP 401 - "Unauthorized" (auth failed)
- ✗ Null or empty response
- ✗ Missing fields

**What Success Looks Like:**
- Queue shows recent job counts
- Workers show 1 active
- Success rate high (>90%)
- Today's metrics show processed jobs

---

### Step 2: Access Admin Jobs Page

**Using curl:**

```bash
curl -X GET "http://localhost:3000/api/admin/jobs?limit=10&offset=0&status=completed" \
  -H "x-api-key: admin_user_001"
```

**Expected Response:**
```json
{
  "jobs": [
    {
      "id": "job_1_github.com/contact",
      "status": "completed",
      "url": "https://github.com/contact",
      "emailCount": 3,
      "createdAt": "2026-07-15T14:30:00.000Z",
      "completedAt": "2026-07-15T14:30:15.000Z"
    }
    // ... more jobs
  ],
  "statusCounts": {
    "pending": 5,
    "processing": 2,
    "completed": 150,
    "failed": 3
  }
}
```

**Success Signs:**
- ✓ HTTP 200 response
- ✓ jobs array contains job records
- ✓ statusCounts show distribution
- ✓ Each job has id, status, url, emailCount

**Failure Signs:**
- ✗ HTTP 403 (not admin)
- ✗ Empty jobs array
- ✗ statusCounts are null

**Browser Access:**
```
http://localhost:3000/admin/jobs
```

**Expected UI:**
- Jobs displayed in a table
- Status badges (pending, processing, completed, failed)
- Email count visible
- Pagination controls (if >10 jobs)

---

### Step 3: Access Admin Users Page

**Using curl:**

```bash
curl -X GET "http://localhost:3000/api/admin/users?limit=10&offset=0" \
  -H "x-api-key: admin_user_001"
```

**Expected Response:**
```json
{
  "users": [
    {
      "id": "sk_test_user_pro_12345",
      "email": "user@example.com",
      "plan": "pro",
      "status": "active",
      "createdAt": "2026-07-01T10:00:00.000Z",
      "lastActive": "2026-07-15T14:30:00.000Z",
      "apiKeysCount": 1,
      "usagePercent": 45,
      "usageThisMonth": 2250,
      "limit": 5000
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 10,
    "offset": 0
  },
  "summary": {
    "totalUsers": 3,
    "activeUsers": 2,
    "byPlan": {
      "free": 1,
      "pro": 2,
      "enterprise": 0
    }
  }
}
```

**Success Signs:**
- ✓ HTTP 200 response
- ✓ users array populated
- ✓ Each user has plan, status, usage
- ✓ summary shows user breakdown

**Failure Signs:**
- ✗ HTTP 403 (not admin)
- ✗ users array empty
- ✗ summary is null

**Browser Access:**
```
http://localhost:3000/admin/users
```

**Expected UI:**
- Users listed in table
- Columns: Email, Plan, Status, Usage, Last Active
- Search/filter options
- Pagination

**Note:** Users are simulated/hardcoded. No actual user data in current system.

---

### Step 4: Access Admin Queue Health

**Using curl:**

```bash
curl -X GET http://localhost:3000/api/admin/queue/health \
  -H "x-api-key: admin_user_001"
```

**Expected Response:**
```json
{
  "health": "healthy",
  "alerts": [],
  "queue": {
    "pending": 5,
    "processing": 2,
    "completed": 150,
    "failed": 3,
    "total": 160
  },
  "utilization": 4,
  "successRate": 98.04,
  "averageProcessingTime": 12500,
  "recentFailures": []
}
```

**Success Indicators:**

| health | Meaning | Utilization |
|--------|---------|------------|
| healthy | All good | < 70% |
| warning | Monitor | 70-90% |
| critical | Take action | > 90% |

**Success Signs:**
- ✓ health is "healthy" or "warning" (not "critical")
- ✓ utilization < 100%
- ✓ successRate > 90%
- ✓ recentFailures array exists (may be empty)

**Failure Signs:**
- ✗ health is "critical"
- ✗ utilization > 100%
- ✗ successRate < 50%

**Browser Access:**
```
http://localhost:3000/admin/queue
```

**Expected UI:**
- Health status displayed prominently
- Queue metrics in cards
- Performance graphs (if implemented)
- Recent failures list

---

### Step 5: Identify Placeholder Pages

**These pages are "Coming Soon" placeholders:**

1. **Workers Page:**
   - URL: http://localhost:3000/admin/workers
   - Expected: "Coming soon" or empty state
   - Status: ⚠️ Not implemented

2. **Analytics Page:**
   - URL: http://localhost:3000/admin/analytics
   - Expected: "Coming soon" or empty state
   - Status: ⚠️ Not implemented

3. **Security Page:**
   - URL: http://localhost:3000/admin/security
   - Expected: "Coming soon" or empty state
   - Status: ⚠️ Not implemented

4. **Settings Page:**
   - URL: http://localhost:3000/admin/settings
   - Expected: "Coming soon" or empty state
   - Status: ⚠️ Not implemented

**Fully Implemented Pages:**
- ✓ Overview (Dashboard)
- ✓ Users
- ✓ Jobs
- ✓ Queue

---

## Part 5: Comprehensive Validation Checklist

### Pre-Flight Checks
```
☐ Node.js version >= 18 (node --version)
☐ pnpm installed (pnpm --version)
☐ .env.development.local exists and has values
☐ Internet connection working
☐ No other services on port 3000
```

### Development Server (Terminal 1)
```
☐ npm run dev started without errors
☐ Shows "Ready in X seconds"
☐ Shows "API routes loaded"
☐ Shows "Listening on http://localhost:3000"
☐ No red error messages
☐ Can access http://localhost:3000 in browser
```

### Background Worker (Terminal 2)
```
☐ npm run worker started without errors
☐ Shows "[WORKER] Initializing..."
☐ Shows "Connected to Redis"
☐ Shows "Listening for jobs"
☐ Shows "[WORKER] Ready and waiting for jobs"
☐ Process remains active (doesn't exit)
```

### Landing Page
```
☐ http://localhost:3000 loads successfully
☐ Page renders without errors
☐ Browser console shows no errors (F12)
☐ Page loads within 2 seconds
☐ Navigation links are clickable
```

### User Dashboard
```
☐ http://localhost:3000/dashboard loads
☐ No authentication errors
☐ Dashboard metrics visible (or login prompt)
☐ No 500 errors
☐ Page structure intact
```

### Email Extraction (API Test)
```
☐ curl POST to /api/search returns 200
☐ Response includes searchId
☐ Response includes jobs array
☐ Jobs have status "pending"
☐ Jobs have unique IDs
☐ Email count is >= 1
```

### Job Queuing
```
☐ GET /api/jobs-paginated returns 200
☐ Jobs array is populated
☐ Status shows "pending" initially
☐ createdAt timestamp is present
☐ Job count matches API response
```

### Worker Processing
```
☐ Terminal 2 shows "Processing job_*"
☐ Terminal 2 shows "Extracting emails from URL"
☐ Terminal 2 shows "Found X emails"
☐ Terminal 2 shows "Job completed"
☐ Processing takes 10-30 seconds
☐ No [ERROR] messages
```

### Job Completion
```
☐ GET /api/jobs-paginated shows status "completed"
☐ emailCount > 0
☐ emails array is populated
☐ startedAt timestamp is set
☐ completedAt timestamp is set
☐ Emails are valid format (contain @)
```

### Browser Dashboard
```
☐ http://localhost:3000/dashboard/jobs loads
☐ Jobs are displayed in UI
☐ Status matches API response
☐ Email counts are accurate
☐ No console errors
```

### Admin Dashboard Overview
```
☐ GET /api/admin/dashboard returns 200
☐ Response includes queue metrics
☐ queue.completed > 0
☐ workers.total >= 1
☐ successRate is 0-100
☐ today metrics show processed jobs
```

### Admin Jobs Page
```
☐ GET /api/admin/jobs returns 200
☐ jobs array contains records
☐ statusCounts shows distribution
☐ HTTP 403 if not admin (auth check works)
☐ http://localhost:3000/admin/jobs loads
```

### Admin Users Page
```
☐ GET /api/admin/users returns 200
☐ users array populated
☐ summary shows user counts by plan
☐ pagination object present
☐ http://localhost:3000/admin/users loads
☐ Users table displays correctly
```

### Admin Queue Monitoring
```
☐ GET /api/admin/queue/health returns 200
☐ health status is displayed
☐ alerts array exists
☐ utilization < 100%
☐ successRate displayed
☐ http://localhost:3000/admin/queue loads
```

### Admin Sidebar Navigation
```
☐ http://localhost:3000/admin shows sidebar
☐ All 8 menu items present
☐ Current page highlighted
☐ Links navigate correctly
☐ Active state updates
```

### Placeholder Pages
```
☐ http://localhost:3000/admin/workers shows "Coming soon"
☐ http://localhost:3000/admin/analytics shows "Coming soon"
☐ http://localhost:3000/admin/security shows "Coming soon"
☐ http://localhost:3000/admin/settings shows "Coming soon"
☐ No 404 errors on placeholders
```

### Error Handling
```
☐ Invalid API key returns 401
☐ Missing API key returns 401
☐ Non-admin accessing /api/admin/* returns 403
☐ Malformed JSON returns 400
☐ Rate limited returns 429
```

### Performance
```
☐ /api/search responds in < 500ms
☐ /api/jobs-paginated responds in < 200ms
☐ /api/admin/dashboard responds in < 500ms
☐ Browser pages load in < 2 seconds
☐ No memory leaks (processes stable)
```

---

## Part 6: Troubleshooting Guide

### Development Server Won't Start

**Symptom:** `npm run dev` fails immediately

**What Success Looks Like:**
```
✓ Ready in 3.2s
✓ Compiled client successfully
```

**Common Causes & Fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `EADDRINUSE` | Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| `Cannot find module` | Missing dependencies | `pnpm install` |
| `Cannot read properties` | Env var missing | Check `.env.development.local` |
| `SyntaxError` | Invalid code | Check Terminal 1 for line number |
| Hangs forever | Stuck process | Ctrl+C and retry |

**First Thing to Check:**
1. Look at Terminal 1 error message
2. Check .env.development.local exists
3. Verify pnpm install completed
4. Try: `pnpm install && npm run dev`

---

### Worker Won't Start

**Symptom:** `npm run worker` fails or exits immediately

**What Success Looks Like:**
```
[WORKER] Initializing email extraction worker...
[WORKER] Connected to Redis at rediss://...
[WORKER] Listening for jobs in queue: jobs:pending
[WORKER] Ready and waiting for jobs
```

**Common Causes & Fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot connect to Redis` | No Redis connection | Check internet, verify REDIS_URL |
| `ENOTFOUND` | DNS failure | Check internet, try VPN |
| `ETIMEDOUT` | Timeout connecting | Check firewall, Redis may be down |
| Process exits with code 1 | Crash in worker | Check error message in logs |
| Hangs forever | Stuck waiting | Ctrl+C and retry |

**First Thing to Check:**
1. Look at Terminal 2 error message
2. Verify internet connection
3. Check REDIS_URL is valid
4. Try: `curl https://tidy-liger-104431.upstash.io/ping`

---

### API Returns 500 Error

**Symptom:** API call returns HTTP 500

**What Success Looks Like:**
```
HTTP/1.1 200 OK
{...response data...}
```

**Common Causes & Fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| Redis error in response | Redis down | Check worker Terminal 2 |
| Cannot read properties of undefined | Missing env var | Check .env.development.local |
| Rate limit error | Too many requests | Wait 1 minute |
| Invalid job format | Corrupted data | Restart and retry |

**First Thing to Check:**
1. Check Terminal 1 for stack trace
2. Look for "Error:" message in response
3. Verify API key is correct
4. Check if worker is running

---

### Jobs Not Processing

**Symptom:** Jobs stay in "pending" status, not moving to "processing" or "completed"

**What Success Looks Like:**
```
Submit job → Status: pending → (5-15 seconds) → Status: completed
Terminal 2 shows: [WORKER] Processing job_*
```

**Common Causes & Fixes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| No activity in Terminal 2 | Worker crashed | Check Terminal 2, restart worker |
| Worker shows errors | Job failure | Read error message in Terminal 2 |
| Jobs stuck >30 seconds | Timeout or hang | Restart worker |
| Jobs marked failed | Extraction error | Website may be blocking or down |

**First Thing to Check:**
1. Is Terminal 2 (worker) showing activity?
2. Are there [ERROR] messages?
3. Did worker get stuck? (no output for >30 seconds)
4. Check internet connection
5. Try a different website URL

---

### Admin Dashboard Returns 403

**Symptom:** API returns `HTTP 403 Forbidden`

**What Success Looks Like:**
```
HTTP/1.1 200 OK
{"queue": {...}}
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Not using admin API key | Use: `admin_user_001` |
| Using user key instead | Admin keys start with `admin_` |
| Key typo | Verify key exactly matches |
| Wrong header | Check header is `x-api-key` |

**First Thing to Check:**
1. Verify API key starts with `admin_`
2. Check header name is exactly `x-api-key`
3. Verify no spaces in key
4. Try hardcoded: `admin_user_001`

---

### Worker Processes Nothing

**Symptom:** Worker shows "Ready and waiting for jobs" but never receives jobs

**What Success Looks Like:**
```
[WORKER] Ready and waiting for jobs
[WORKER] Processing job_ID_HOSTNAME  ← Should see this
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| API call failed | Check /api/search returns 200 |
| Wrong worker queue | Check worker is listening to correct queue |
| Redis not connected | Check "Connected to Redis" message |
| Jobs never submitted | Submit job via /api/search |

**First Thing to Check:**
1. Did /api/search call return 200?
2. Is worker showing "Connected to Redis"?
3. Try submitting again: `curl POST /api/search ...`
4. Watch Terminal 2 closely for any output

---

### No Emails Found

**Symptom:** Jobs complete but emailCount is 0

**What Success Looks Like:**
```json
{"emailCount": 3, "emails": ["contact@github.com", ...]}
```

**Possible Causes:**

| Cause | Solution |
|-------|----------|
| Website has no contact form | Try different website |
| Website blocks bots | Try public website (github.com) |
| Extraction failed silently | Check Terminal 2 for warnings |
| Proxy needed | May require PROXY_URL env var |

**First Thing to Check:**
1. Is website reachable? Try in browser
2. Does website have contact information?
3. Check Terminal 2 for error messages
4. Try: `github.com` (known to work)

---

### High Failure Rate

**Symptom:** Many jobs have status "failed"

**What Success Looks Like:**
```
successRate: 95+
failed: < 5%
```

**Common Causes:**

| Cause | Fix |
|-------|-----|
| Rate limiting | Space out requests, try different websites |
| Website blocks bots | Use legitimate websites |
| Network timeout | Check internet, try again |
| Invalid URLs | Verify URL format |

**First Thing to Check:**
1. Check Terminal 2 for error patterns
2. Look for "Rate limited" messages
3. Are all websites returning errors?
4. Try single URL: `curl ... -d '{"query": "github.com", "pages": 1}'`

---

### Browser Dashboard Shows Errors

**Symptom:** http://localhost:3000/dashboard shows red errors or blank

**What Success Looks Like:**
```
Dashboard displays:
- Metrics cards
- Job list
- No console errors (F12)
```

**Common Causes:**

| Cause | Fix |
|-------|-----|
| No API key in header | Add x-api-key header via Postman |
| Page load error | Check Terminal 1 for errors |
| Auth failed | Verify API key is valid |
| Layout broken | Hard refresh: Ctrl+Shift+R |

**First Thing to Check:**
1. Open F12 → Console tab → Check for red errors
2. Check Network tab → Look for 401/403 responses
3. Check Terminal 1 for server errors
4. Try hard refresh: Ctrl+Shift+R

---

### Benchmark Suite Issues

**Symptom:** `npx tsx scripts/load-test.ts` fails or doesn't run

**What Success Looks Like:**
```
Pre-flight validation: PASS
Concurrency 1: COMPLETED ✓
Concurrency 5: COMPLETED ✓
...
```

**Common Causes:**

| Error | Fix |
|-------|-----|
| Cannot find module | Run `pnpm install` first |
| Pre-flight fails | Ensure dev server and worker running |
| Timeout | Network too slow, may need to wait |
| Exit code 1 | Check error output above |

**First Thing to Check:**
1. Is dev server running? (Terminal 1)
2. Is worker running? (Terminal 2)
3. Are they both showing "Ready"?
4. Check Terminal 1 and 2 for errors

---

## Summary

**Core Validation Flow:**

```
1. Start dev server (Terminal 1)
2. Start worker (Terminal 2)
3. Submit job via /api/search
4. Wait 10-20 seconds
5. Check job status via /api/jobs-paginated
6. Verify status changed to "completed"
7. Verify emailCount > 0
8. Check admin via /api/admin/dashboard
9. Verify metrics updated
```

**Key Signs of Success:**

✓ Both Terminal 1 and Terminal 2 show "Ready"  
✓ API call returns 200 with job IDs  
✓ Terminal 2 shows "Processing" message  
✓ Job status changes from "pending" to "completed"  
✓ emailCount > 0  
✓ Admin API returns correct metrics  
✓ Admin pages load without errors  

**If Anything Fails:**

1. Check error message in relevant Terminal
2. Verify both servers are running
3. Check .env.development.local has values
4. Verify internet connection
5. Try restart: Ctrl+C both terminals, run again

