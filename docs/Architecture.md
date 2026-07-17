# Email Extraction Platform - Architecture Guide

## System Overview

The Email Extraction Platform is a distributed system for searching emails on the web and extracting email addresses from search results. It combines a customer-facing API, admin dashboard, and background job processing with Redis-based queue management.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                      │
│  (Web App, Mobile, Third-party Integrations)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js 16 Application Layer                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Routes:                                                │ │
│  │ • /api/* - RESTful API endpoints (14 endpoints)        │ │
│  │ • /admin/* - Admin dashboard (8 pages)                │ │
│  │ • /dashboard/* - Customer dashboard (7 pages)         │ │
│  │ • / - Marketing & auth pages                          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Middleware Stack:                                      │ │
│  │ • withAuth() - API key validation                      │ │
│  │ • withAdminAuth() - Admin role enforcement            │ │
│  │ • withRateLimit() - Quota enforcement                  │ │
│  │ • withBilling() - Usage quota checks                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Redis-Based Queue System                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Email Job Queue:                                       │ │
│  │ • Max 1000 queued jobs                                │ │
│  │ • Status: pending → processing → completed/failed      │ │
│  │ • TTL: 24 hours for completed, 48 hours for failed    │ │
│  │ • Distributed locking to prevent duplicates            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Additional Redis Data:                                 │ │
│  │ • Rate limit counters (per user, per plan)            │ │
│  │ • Job locks (35 second TTL)                           │ │
│  │ • Processing progress metrics                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           Background Worker Process                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Email Extraction Workers:                              │ │
│  │ • Configurable concurrency (default: 1, max: 10)      │ │
│  │ • Pulls jobs from Redis queue                          │ │
│  │ • Executes extraction pipeline                         │ │
│  │ • Stores results back in Redis                         │ │
│  │ • Handles retries (max 3 per job)                     │ │
│  │ • Graceful shutdown on SIGTERM/SIGINT                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Extraction Pipeline:                                   │ │
│  │ 1. Google Programmable Search Engine query            │ │
│  │ 2. Fetch each result URL                              │ │
│  │ 3. Parse HTML with JSDOM or Puppeteer                 │ │
│  │ 4. Extract email addresses using regex                │ │
│  │ 5. Deduplicate and validate                           │ │
│  │ 6. Store results in Redis                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services                               │
│  • Google Programmable Search Engine (email search)         │
│  • Stripe (billing management)                              │
│  • Redis (Upstash - hosted Redis)                           │
│  • Vercel (hosting & deployment)                            │
└─────────────────────────────────────────────────────────────┘
```

## System Components

### 1. API Layer (`/app/api`)

#### Authentication Endpoints
- `GET /api/auth/me` - Get current authenticated user info

#### Search & Job Endpoints
- `POST /api/search` - Create new email extraction job
- `GET /api/jobs` - List jobs with pagination
- `GET /api/jobs-paginated` - Paginated job list
- `GET /api/job/:id` - Get single job details
- `GET /api/job/:id/result` - Get job extraction results
- `GET /api/job/:id/status` - Get job status with progress

#### Admin Endpoints
- `GET /api/admin/dashboard` - System metrics and stats
- `GET /api/admin/users` - List all users with usage stats
- `GET /api/admin/jobs` - List all jobs across system
- `GET /api/admin/queue/health` - Queue health and metrics

#### Billing Endpoints
- `GET /api/billing/status` - Current customer billing status
- `POST /api/billing/webhook` - Stripe webhook receiver

### 2. Middleware Layer (`/lib/auth`)

#### Authentication (`withAuth`)
- Validates `x-api-key` header
- Loads user from credential
- Attaches user to request
- Returns 401 on missing/invalid key

#### Authorization (`withAdminAuth`)
- Checks user admin role
- Returns 403 if not admin
- Used for all /api/admin/* routes

#### Rate Limiting (`withRateLimit`)
- Enforces per-plan quotas:
  - Free: 10 concurrent jobs max
  - Pro: 100 concurrent jobs max
  - Enterprise: 500 concurrent jobs max
- Checks rate limit status before allowing operation
- Returns 429 if quota exceeded

#### Billing Checks (`withBilling`)
- Verifies user has active subscription
- Checks usage limits
- Allows free tier with limits

### 3. Queue System (`/lib/queue`)

#### EmailQueue Class
```typescript
class EmailQueue {
  async addJob(urls: string[]): Promise<string> // Creates new job
  async getJob(jobId: string): Promise<Job | null> // Retrieves job
  async updateJobStatus(jobId: string, status: JobStatus): Promise<void>
  async getJobs(filters): Promise<Job[]> // List with filtering
  async getMetrics(): Promise<QueueMetrics> // Health metrics
}
```

#### Job Lifecycle
1. **Creation** - `POST /api/search` creates new job
2. **Queueing** - Job stored in Redis with "pending" status
3. **Processing** - Worker claims job, sets status to "processing"
4. **Completion** - Results stored, status set to "completed"
5. **Failure** - If error, retry up to 3 times, then mark "failed"
6. **Cleanup** - Completed jobs expire after 24 hours, failed after 48

#### Data Structure (Redis)
```
Job Document:
{
  id: "uuid",
  status: "pending" | "processing" | "completed" | "failed",
  urls: ["url1", "url2"],
  emails: ["email1@example.com"],
  errorMessage: null | "error details",
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: null | timestamp,
  retryCount: 0-3
}

Queue:
- jobs:{jobId} → Job document
- jobs:list → Sorted set of all job IDs
- jobs:pending → Set of pending job IDs
- jobs:processing → Set of processing job IDs
- jobs:{urlHash}:lock → Distributed lock (35s TTL)

Metadata:
- user:{userId}:jobs → User's job list
- user:{userId}:usage → Current usage stats
- ratelimit:{userId} → Rate limit counter
```

### 4. Worker System (`/lib/worker`)

#### Worker Process
- Runs as separate Node.js process
- Polls Redis for pending jobs
- Configurable concurrency (default 1, scalable to 10+)
- Graceful shutdown handling

#### Extraction Pipeline
1. **Search** - Query Google PSE with search terms
2. **Fetch** - Download HTML from each result URL
3. **Parse** - Extract text using JSDOM or Puppeteer
4. **Extract** - Find emails using regex patterns
5. **Validate** - Confirm email format and deliverability
6. **Store** - Save results to Redis

#### Error Handling
- Try-catch on each step
- Exponential backoff for retries (recommended)
- Max 3 retries per job
- Failed jobs stored with error message

### 5. Admin Dashboard (`/app/admin`)

#### Pages
- `/admin` - Dashboard with metrics
- `/admin/users` - User management with search/filter
- `/admin/jobs` - Job monitoring
- `/admin/queue` - Queue health status
- `/admin/analytics` - Performance analytics
- `/admin/security` - Security settings
- `/admin/settings` - System settings
- `/admin/workers` - Worker status

#### Features
- Real-time metrics
- Pagination support
- Search and filtering
- Job monitoring
- User quota management

### 6. Customer Dashboard (`/app/dashboard`)

#### Pages
- `/dashboard` - User home
- `/dashboard/search` - Email search interface
- `/dashboard/jobs` - Job history
- `/dashboard/billing` - Subscription management
- `/dashboard/profile` - User profile
- `/dashboard/settings` - User settings
- `/dashboard/usage` - API usage dashboard
- `/dashboard/api-keys` - API key management

## Data Flow

### Email Search Flow
```
1. User → POST /api/search
2. API validates request
3. Check rate limit (withRateLimit)
4. Check billing status (withBilling)
5. Create Job in Redis
6. Add to pending queue
7. Return job ID
8. Worker picks up job
9. Executes extraction pipeline
10. Stores results in Redis
11. Updates job status
12. User → GET /api/job/{id}/result
13. Return extracted emails
```

### Admin Metrics Flow
```
1. Admin → GET /api/admin/queue/health
2. Query Redis for queue stats
3. Calculate metrics (pending, processing, completed, failed)
4. Calculate failure rate and avg processing time
5. Check backpressure status
6. Return metrics JSON
```

## Scalability & Performance

### Horizontal Scaling
- **Workers**: Add more worker processes to increase throughput
  - Each worker: ~3-5 jobs/second
  - Max 10 concurrent Puppeteer instances per worker
  - Can run on separate containers/machines

- **Redis**: Upstash Redis handles horizontal scaling
  - Connection pooling via @upstash/redis
  - Automatic backup and failover
  - REST API for reliability across network boundaries

- **API**: Next.js on Vercel auto-scales
  - Serverless functions per endpoint
  - CDN caching for static content
  - Automatic load balancing

### Performance Optimization
- **Caching**: Job results cached in Redis (24 hours)
- **Deduplication**: Same query within window skips re-extraction
- **Batch Processing**: Multiple URLs per job
- **Connection Pooling**: Reuse HTTP and browser connections
- **Pagination**: Limit and offset for large datasets

## Security Architecture

### Authentication
- API key based (sk_test_* or sk_live_*)
- Admin credential for admin access
- Validated on every request

### Authorization
- Role-based: user, admin, super_admin
- Endpoint-level checks
- Middleware-enforced

### Data Protection
- Admin credential never logged (removed debug statements)
- Sensitive data not in error messages
- Input validation on all endpoints
- No SQL injection vectors (Redis used, no SQL)

## Monitoring & Observability

### Health Endpoints
- `GET /api/admin/queue/health` - Queue metrics
- `GET /api/metrics` - System performance
- Logs for debugging (structured recommended)

### Key Metrics
- Queue size (pending, processing, completed, failed)
- Failure rate
- Average processing time
- Backpressure status
- User quota usage

## Deployment Architecture

### Development
- Local Redis (or Upstash remote)
- Local Next.js dev server
- Local worker process
- All on single machine

### Production
- Vercel serverless for API & dashboard
- Upstash Redis for persistence
- Separate worker container(s)
- Admin access via credentials

## Dependencies

### Runtime
- `next` (16.2.6) - Web framework
- `@upstash/redis` - Redis client with REST API
- `jsdom` - DOM parsing
- `puppeteer` - Browser automation (for complex extractions)
- `stripe` - Billing integration
- `google-search-results` - Search API

### Development
- `typescript` - Type safety
- `tailwindcss` - Styling
- `eslint` - Code quality

## Future Enhancements

1. **Exponential Backoff** - Improve retry resilience
2. **Dead Letter Queue** - Enhanced failed job handling
3. **API Key Revocation** - Security enhancement
4. **Distributed Worker Tracing** - Better observability
5. **GraphQL API** - Alternative query interface
6. **Caching Layer** - Redis-based result caching
7. **Analytics** - Advanced usage analytics
8. **Machine Learning** - Email quality scoring
