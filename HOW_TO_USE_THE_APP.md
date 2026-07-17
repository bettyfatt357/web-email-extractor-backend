# Application Access & Testing Guide

**NO MODIFICATIONS MADE - INSPECTION ONLY**

This guide explains how to access and test the existing application without any code changes.

---

## Quick Start

### Prerequisites
1. Node.js 18+ installed
2. pnpm installed (`npm install -g pnpm`)
3. Redis connection (already configured in .env.development.local)
4. Google Search API credentials (already configured)

### Starting the Application

**Terminal 1 - API Server:**
```bash
cd /vercel/share/v0-project
npm run dev
```
Starts on: http://localhost:3000

**Terminal 2 - Background Worker:**
```bash
cd /vercel/share/v0-project
npm run worker
```
Processes extraction jobs from the queue

**Terminal 3 - Benchmark (optional):**
```bash
cd /vercel/share/v0-project
npx tsx scripts/load-test.ts
```
Runs the load test benchmark suite

---

## User Accounts

### Authentication Method
The application uses **API key-based authentication** (no traditional user login).

Every request requires the `x-api-key` header with a valid API key.

### Creating a User Account

**Step 1: Generate an API Key**

API keys follow the pattern: `sk_test_*` or `sk_live_*`

Example test keys (already in .env.development.local):
```
sk_live_XXXX
```

**Step 2: Determine User Plan**

Plan is automatically assigned based on the API key:
- Keys containing "pro" → pro plan (5,000 queries/month)
- Keys without "pro" → free plan (100 queries/month)

Example:
```
sk_test_user_pro_12345678      # Will be assigned "pro" plan
sk_test_user_free_87654321     # Will be assigned "free" plan
```

**Step 3: Use the API Key**

Every API request must include:
```bash
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_pro_12345678" \
  -H "Content-Type: application/json" \
  -d '{"query": "contact us form github.com", "pages": 1}'
```

The user is automatically created and identified by their API key on first use.

---

## Normal User Access

### URLs

| Page | URL | Purpose |
|------|-----|---------|
| **Dashboard** | http://localhost:3000/dashboard | Main user dashboard (metrics, stats) |
| **New Search** | http://localhost:3000/dashboard/search | Submit new search jobs |
| **Jobs** | http://localhost:3000/dashboard/jobs | View job history and status |
| **API Keys** | http://localhost:3000/dashboard/api-keys | Manage user's API keys |
| **Usage** | http://localhost:3000/dashboard/usage | View quota usage |
| **Billing** | http://localhost:3000/dashboard/billing | Billing information and plans |
| **Settings** | http://localhost:3000/dashboard/settings | User settings |
| **Profile** | http://localhost:3000/dashboard/profile | User profile information |

### Normal User Login Process

**The application does NOT have a traditional login flow.** Instead:

1. **Access any dashboard URL** (e.g., http://localhost:3000/dashboard)
2. **Add API key header** in browser request:
   - Open browser DevTools (F12)
   - Go to Console
   - Add API key to all requests manually, OR
   - Use the browser extension to add headers, OR
   - Use curl/Postman to test with proper headers

**Testing with curl:**
```bash
# Get dashboard metrics
curl -X GET http://localhost:3000/dashboard/api/metrics \
  -H "x-api-key: sk_test_user_pro_12345678"

# Get user's jobs
curl -X GET http://localhost:3000/api/jobs-paginated \
  -H "x-api-key: sk_test_user_pro_12345678"
```

### Example User Testing Flow

**User 1 - Free Plan:**
```bash
# Key: sk_test_user_free_12345678
# Plan: free (100 queries/month)

# Submit search
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_free_12345678" \
  -H "Content-Type: application/json" \
  -d '{"query": "contact github.com", "pages": 1}'

# Response:
# {
#   "searchId": "search_xxx",
#   "totalQueued": 5,
#   "duplicatesRemoved": 0,
#   "jobs": [...]
# }

# Monitor jobs
curl -X GET http://localhost:3000/api/jobs-paginated \
  -H "x-api-key: sk_test_user_free_12345678"
```

**User 2 - Pro Plan:**
```bash
# Key: sk_test_user_pro_87654321
# Plan: pro (5,000 queries/month)

# Submit larger search
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_pro_87654321" \
  -H "Content-Type: application/json" \
  -d '{"query": "sales team email", "pages": 2}'
```

---

## Admin Account Access

### How Admin Accounts Work

Admins are identified by:
1. **Username prefix**: Any API key starting with `admin_` becomes an admin
2. **Hardcoded admin list**: Two hardcoded admins with specific roles:
   - `admin_user_001` → **super_admin** (full access)
   - `admin_user_002` → **admin** (standard admin access)

### Creating an Admin API Key

Generate an API key starting with `admin_`:
```
admin_test_key_super_admin      # Super admin (full access)
admin_test_key_admin_user       # Admin (standard admin)
admin_any_test_key              # Admin (standard admin)
```

### Admin Dashboard Access

**URLs:**

| Page | URL | Admin Level | Purpose |
|------|-----|-------------|---------|
| **Overview** | http://localhost:3000/admin | admin | Main admin dashboard (system metrics) |
| **Users** | http://localhost:3000/admin/users | admin | User management and list |
| **Jobs** | http://localhost:3000/admin/jobs | admin | System-wide job monitoring |
| **Queue** | http://localhost:3000/admin/queue | admin | Queue health and status |
| **Workers** | http://localhost:3000/admin/workers | admin | Worker status (placeholder) |
| **Analytics** | http://localhost:3000/admin/analytics | admin | System analytics (placeholder) |
| **Security** | http://localhost:3000/admin/security | admin | Security monitoring (placeholder) |
| **Settings** | http://localhost:3000/admin/settings | admin | Admin settings (placeholder) |

**Super Admin URLs (stricter access):**
- Currently uses same URLs, but requires `super_admin` role
- Only `admin_user_001` qualifies

### Admin Login Process

**There is NO dedicated admin login page.** Instead:

1. **Access admin dashboard URL** (e.g., http://localhost:3000/admin)
2. **Provide admin API key** in request header:
   ```bash
   curl -X GET http://localhost:3000/admin/api/admin/dashboard \
     -H "x-api-key: admin_user_001"
   ```

### Testing Admin Features with curl

**Super Admin (Full Access):**
```bash
# View dashboard metrics
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: admin_user_001"

# Response includes:
# {
#   "queue": { "pending": 45, "processing": 12, "completed": 1234, "failed": 5 },
#   "successRate": 99.6,
#   "workers": { "active": 2, "idle": 0, "total": 2 },
#   "today": { "jobsProcessed": 156, "emailsExtracted": 4823 }
# }

# View all users
curl -X GET http://localhost:3000/api/admin/users \
  -H "x-api-key: admin_user_001"

# View all jobs
curl -X GET http://localhost:3000/api/admin/jobs \
  -H "x-api-key: admin_user_001"

# View queue health
curl -X GET http://localhost:3000/api/admin/queue/health \
  -H "x-api-key: admin_user_001"
```

**Standard Admin:**
```bash
# Same endpoints work for admin_user_002
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: admin_user_002"
```

---

## Required Environment Variables

All required environment variables are already configured in `.env.development.local`:

### Google Search API
```
GOOGLE_API_KEY=AIzaSyABReA6-rLFHVGfiuJmcw05gu7r7guWTCY
GOOGLE_CX=0463a96710444477c
```

### Redis/Upstash
```
REDIS_URL=rediss://default:...@tidy-liger-104431.upstash.io:6379
KV_REST_API_URL=https://tidy-liger-104431.upstash.io
KV_REST_API_TOKEN=gQAAAA...
```

### Optional Configuration
```
PROXY_URL=http://user:pass@host:port          # For proxy requests
ALLOW_ANONYMOUS=false                          # Allow requests without API key
```

**Note:** All required env vars are already set. No additional setup needed.

---

## Seed Data & Bootstrap

### Automatic Data Initialization
The application **creates data on-demand**:
- First search request with a user → user account created
- First admin request → admin validated
- Jobs created → stored in Redis automatically

### No Database Seeding Required
The system uses Redis for all data storage. No seed scripts needed.

### Pre-Populated Admin Accounts
Two admin accounts are hardcoded (for demo purposes):
```typescript
// From lib/auth/admin-auth.ts
const adminUsers = {
  'admin_user_001': 'super_admin',
  'admin_user_002': 'admin'
};
```

### Billing Plans (Fixed)
```
free:       100 queries/month
pro:        5,000 queries/month
enterprise: 1,000,000 queries/month
```

---

## Testing Workflow

### Complete User Flow

**Step 1: Create Test User**
```bash
# Generate key: sk_test_demo_user_12345
# (Any key starting with sk_test_ or sk_live_ is valid)
API_KEY="sk_test_demo_user_12345"
```

**Step 2: Submit Search Job**
```bash
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "contact us form github.com",
    "pages": 1
  }'
```

Expected response:
```json
{
  "searchId": "search_1234567890",
  "totalQueued": 5,
  "duplicatesRemoved": 0,
  "jobs": [
    {
      "id": "job_1",
      "status": "pending",
      "url": "https://github.com/contact",
      "createdAt": "2026-07-15T14:30:00Z"
    }
  ]
}
```

**Step 3: Monitor Jobs**
```bash
# Check job status
curl -X GET "http://localhost:3000/api/jobs-paginated?limit=10" \
  -H "x-api-key: $API_KEY"
```

**Step 4: View Dashboard**
```bash
# Get metrics
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: admin_user_001"
```

### Complete Admin Flow

**Step 1: Authenticate as Admin**
```bash
ADMIN_KEY="admin_user_001"
```

**Step 2: View System Dashboard**
```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: $ADMIN_KEY"
```

**Step 3: View All Users**
```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "x-api-key: $ADMIN_KEY"
```

**Step 4: View All Jobs**
```bash
curl -X GET http://localhost:3000/api/admin/jobs \
  -H "x-api-key: $ADMIN_KEY"
```

**Step 5: Check Queue Health**
```bash
curl -X GET http://localhost:3000/api/admin/queue/health \
  -H "x-api-key: $ADMIN_KEY"
```

---

## Browser-Based Testing

### Using Postman or Thunder Client

1. **Create new request** → POST http://localhost:3000/api/search
2. **Headers tab:**
   - Key: `x-api-key`
   - Value: `sk_test_demo_user_12345`
   - Key: `Content-Type`
   - Value: `application/json`
3. **Body tab (raw JSON):**
   ```json
   {
     "query": "contact us form github.com",
     "pages": 1
   }
   ```
4. **Send** → View response

### Using Browser DevTools Console

```javascript
// Add this to your browser console
fetch('http://localhost:3000/api/search', {
  method: 'POST',
  headers: {
    'x-api-key': 'sk_test_demo_user_12345',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'contact github.com',
    pages: 1
  })
})
.then(r => r.json())
.then(data => console.log(data))
```

---

## Billing & Rate Limiting

### Query Limits

**Free Plan:**
- 100 queries/month
- Rate limit: 10 queries/day
- Message for key: `sk_test_*` or any key without 'pro'

**Pro Plan:**
- 5,000 queries/month
- Rate limit: 200 queries/day
- Message for key: Any key containing 'pro'

**Enterprise Plan:**
- 1,000,000 queries/month
- Unlimited rate
- Message for key: Any key containing 'enterprise'

### Testing Rate Limits

```bash
# This will consume quota
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/search \
    -H "x-api-key: sk_test_user_free_12345" \
    -H "Content-Type: application/json" \
    -d '{"query": "contact github.com", "pages": 1}'
done

# After exceeding limit, you'll get:
# {
#   "error": "Rate limit exceeded"
# }
```

---

## Accessing Results

### User Can View Jobs
```bash
curl -X GET "http://localhost:3000/api/jobs-paginated?limit=100&offset=0" \
  -H "x-api-key: sk_test_demo_user_12345"
```

### Admin Can View All System Data
```bash
curl -X GET http://localhost:3000/api/admin/jobs \
  -H "x-api-key: admin_user_001"
```

### Benchmark Results
```bash
# After running: npm run benchmark
ls -la benchmark-results-*.json
cat benchmark-results-10.json | jq .results
cat BENCHMARK_REPORT.md
```

---

## Common Test Cases

### Test Case 1: Basic Search
**Objective:** Submit and track a search job

```bash
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_12345" \
  -H "Content-Type: application/json" \
  -d '{"query": "contact github.com", "pages": 1}'
```

### Test Case 2: Admin Monitoring
**Objective:** View system-wide metrics

```bash
curl -X GET http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: admin_user_001"
```

### Test Case 3: Rate Limiting
**Objective:** Hit quota and verify enforcement

```bash
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/search \
    -H "x-api-key: sk_test_free_user" \
    -H "Content-Type: application/json" \
    -d '{"query": "test", "pages": 1}'
done
# Should fail on query 101 with rate limit error
```

### Test Case 4: Job Failure Handling
**Objective:** Verify failed job tracking

Worker will automatically handle extraction errors and mark jobs as failed in Redis.

### Test Case 5: Concurrent Users
**Objective:** Test multiple users simultaneously

```bash
# User 1
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_1" \
  -d '{"query": "query1", "pages": 1}' &

# User 2
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_user_2" \
  -d '{"query": "query2", "pages": 1}' &

# Wait for both
wait
```

---

## Notes & Limitations

### Current Limitations
- No traditional user login/password system
- All data stored in Redis (not persistent after restart)
- Admin list is hardcoded (cannot be dynamically changed)
- User database integration is not implemented (simulated only)
- Benchmark viewer not integrated into admin dashboard

### For Production Use
- Integrate with real database (replace Redis hardcoded lists)
- Implement proper user authentication system
- Add persistent data storage
- Implement audit logging
- Connect to user billing database

---

## Support

For more details, see:
- Benchmark implementation: `BENCHMARK_README.md`
- Admin portal audit: `ADMIN_PORTAL_AUDIT.md`
- Benchmark verification: `BENCHMARK_VERIFICATION.md`

---

**Last Updated:** July 15, 2026  
**Status:** INSPECTION ONLY - NO MODIFICATIONS MADE
