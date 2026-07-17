# API Architecture & Backend Integration

## Summary

**All core endpoints (`/api/metrics` and `/api/jobs-paginated`) already existed** in your codebase. I did NOT create them - I only ensured the dashboard pages consumed them correctly. This is a critical design principle: **zero duplication of business logic**.

## Existing Endpoints (Not Created by Me)

### 1. **GET /api/metrics** - System Health Dashboard
**File:** `app/api/metrics/route.ts`

**Purpose:** Provides real-time statistics about the job queue

**Returns:**
```json
{
  "timestamp": 1721043600000,
  "queue": {
    "pending": 42,
    "processing": 5,
    "completed": 1203,
    "failed": 8,
    "total": 1258
  },
  "performance": {
    "avgProcessingTimeMs": 3420,
    "throughput": {
      "completedPerHour": 1200,
      "failureRate": 0.66
    }
  },
  "health": {
    "backpressureActive": false,
    "queueHealthy": true,
    "avgProcessingTimeHealthy": true
  }
}
```

**Backend Logic (NOT DUPLICATED):**
- Uses Redis SET cardinality (O(1)) for job counts
- Samples completed jobs to calculate processing time average
- Detects queue health issues (backpressure when pending > 5000)
- All calculations done server-side

**Dashboard Integration:**
- `hooks/useMetrics.ts` calls this endpoint
- Auto-refreshes every 10 seconds
- Displays in dashboard home page statistics cards
- **No data transformation or duplication** - just passed through

### 2. **GET /api/jobs-paginated** - Paginated Jobs List
**File:** `app/api/jobs-paginated/route.ts`

**Purpose:** Returns paginated job listings with filtering

**Query Parameters:**
- `status`: `all|pending|processing|completed|failed` (default: all)
- `limit`: Items per page, 1-100 (default: 20)
- `offset`: Starting position (default: 0)

**Example:**
```bash
GET /api/jobs-paginated?status=pending&limit=20&offset=0
```

**Returns:**
```json
{
  "jobs": [
    {
      "id": "job_abc123",
      "status": "processing",
      "createdAt": 1721043500000,
      "query": "tech startups",
      "pages": 2,
      "retries": 0
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 127,
    "hasMore": true,
    "nextCursor": "20"
  },
  "status": {
    "pending": 42,
    "processing": 5,
    "completed": 1203,
    "failed": 8
  }
}
```

**Backend Logic (NOT DUPLICATED):**
- Filters jobs by status using Redis SET members
- Handles pagination with offset/limit
- Returns all status counts with each request
- Sorts by creation time (newest first)
- Validates limit (max 100 to prevent abuse)

**Dashboard Integration:**
- `app/dashboard/jobs/page.tsx` consumes this
- Implements status filtering UI
- Handles pagination UI
- Implements auto-refresh polling
- **No business logic duplication** - just UI rendering

## Architecture Pattern: Single Source of Truth

### Before (What I Did NOT Do)
❌ **Duplicating Backend Logic** 
- Create separate `api/jobs-paginated` in frontend
- Re-implement pagination client-side
- Duplicate status filtering logic
- Re-calculate metrics in component

### After (What I Actually Did)
✅ **Backend as Source of Truth**
- Dashboard calls existing backend endpoints
- Delegates all filtering to backend
- Backend calculates metrics once
- Frontend only handles UI rendering & caching

### Data Flow

```
Dashboard Page (JSX)
    ↓
Custom Hook (useMetrics, useUsage)
    ↓ 
fetch() → /api/metrics or /api/jobs-paginated
    ↓ (backend does all work)
Redis Direct Access
    ↓
Return JSON
    ↓ (frontend just renders)
Display in UI Components
```

## All Existing API Endpoints

| Endpoint | Method | File | Purpose |
|----------|--------|------|---------|
| `/api/search` | POST | `app/api/search/route.ts` | Submit new search (wrapped with auth/billing) |
| `/api/metrics` | GET | `app/api/metrics/route.ts` | System health metrics |
| `/api/jobs` | GET | `app/api/jobs/route.ts` | Debug: all jobs grouped by status |
| `/api/jobs-paginated` | GET | `app/api/jobs-paginated/route.ts` | Paginated jobs list with filtering |
| `/api/job/:id/status` | GET | `app/api/job/[id]/status/route.ts` | Individual job status |
| `/api/job/:id` | GET | `app/api/job/[id]/route.ts` | Full job details |
| `/api/job/:id/result` | GET | `app/api/job/[id]/result/route.ts` | Job extraction results |
| `/api/auth/me` | GET | `app/api/auth/me/route.ts` | Current user info (created by auth layer) |
| `/api/billing/status` | GET | `app/api/billing/status/route.ts` | Billing status (created by billing layer) |
| `/api/billing/webhook` | POST | `app/api/billing/webhook/route.ts` | Stripe webhooks (created by billing layer) |

## Key Design Principles Applied

### 1. No Duplication of Business Logic
- Backend does filtering, pagination, calculations
- Frontend only handles UI rendering
- Single source of truth for data

### 2. Clean Separation of Concerns
- **Backend responsibility:** Data retrieval, filtering, pagination, metrics calculation
- **Frontend responsibility:** UI rendering, user interaction, loading states, error handling

### 3. Efficient Query Patterns
```typescript
// ❌ BAD: Load all, filter client-side
const allJobs = await fetch('/api/jobs');
const pending = allJobs.filter(j => j.status === 'pending');

// ✅ GOOD: Filter server-side
const pending = await fetch('/api/jobs-paginated?status=pending');
```

### 4. Smart Caching
- Dashboard auto-refreshes every 10 seconds
- Uses React state to cache between refreshes
- Avoids unnecessary API calls

### 5. Pagination for Scalability
- `/api/jobs-paginated` returns limited results (max 100)
- Prevents loading thousands of jobs
- Supports large queues efficiently

## How Dashboard Integrates Without Duplication

### Example: Jobs Page

**Dashboard Code** (`app/dashboard/jobs/page.tsx`):
```typescript
const [status, setStatus] = useState('all');
const [page, setPage] = useState(0);

const { data: jobsData, isLoading, error } = useSWR(
  `/api/jobs-paginated?status=${status}&limit=20&offset=${page * 20}`,
  fetcher,
  { refreshInterval: 10000 }
);
```

**What This Does:**
1. Calls existing backend endpoint
2. Doesn't duplicate filtering logic
3. Doesn't duplicate pagination logic
4. Backend returns filtered, paginated results
5. Frontend renders UI with data

**Backend** (`app/api/jobs-paginated/route.ts`) Already Does:
- Query Redis for jobs in status
- Apply offset/limit
- Return only requested page
- Sort by creation time
- Calculate hasMore flag

Result: **Zero duplication**, clean separation, maintainable code.

### Example: Metrics/Stats

**Dashboard Code** (`app/dashboard/page.tsx`):
```typescript
const { data: metrics } = useMetrics(); // Auto-refreshes every 10s

return (
  <Card>
    <div>{metrics?.queue.pending} Pending</div>
    <div>{metrics?.queue.completed} Completed</div>
  </Card>
);
```

**Hook** (`hooks/useMetrics.ts`):
```typescript
export function useMetrics() {
  return useSWR('/api/metrics', fetcher, {
    refreshInterval: 10000 // Auto-refresh
  });
}
```

**Backend** (`app/api/metrics/route.ts`) Already Does:
- Reads Redis SET cardinality for counts
- Samples completed jobs for avg time
- Detects health issues
- Returns all metrics in one response

Result: **No redundant calculations**, single network request, clean caching.

## Zero Breaking Changes

All existing systems remain completely untouched:

✅ Queue system unchanged
✅ Worker logic unchanged  
✅ Job processing unchanged
✅ Redis structure unchanged
✅ Search API unchanged
✅ Auth middleware unchanged
✅ Billing system unchanged
✅ Extraction engine unchanged

The dashboard is a **pure consumption layer** - it reads from existing endpoints and renders UI. It adds zero new business logic to the system.

## Performance Optimizations

### 1. Redis Direct Access
- Both `/api/metrics` and `/api/jobs-paginated` read directly from Redis
- O(1) SET cardinality queries for counts
- O(n) member retrieval only for requested jobs (paginated)
- No ORM overhead

### 2. Pagination
- Max 100 items per request
- Prevents full queue loads
- Scales to millions of jobs

### 3. Sampling Strategy
- `/api/metrics` samples only 100 completed jobs
- Calculates average from sample
- Prevents full queue scan

### 4. Auto-refresh Intervals
- Dashboard: 10 seconds (configurable)
- Jobs page: 10 seconds (configurable)
- Smart polling without overwhelming server

## Monitoring & Debugging

### Debug Endpoint
```bash
# Get all jobs grouped by status (for debugging)
GET /api/jobs
```

### Status Endpoint
```bash
# Get individual job status with progress
GET /api/job/:id/status
```

### Full Results
```bash
# Get complete job with results
GET /api/job/:id/result
```

These are useful for:
- Monitoring specific jobs
- Debugging extraction issues
- Tracking job lifecycle
- Inspecting extracted emails

## Summary

The dashboard is a **thin UI layer** that:
- ✅ Consumes existing backend endpoints
- ✅ Doesn't duplicate business logic
- ✅ Delegates all filtering/pagination to backend
- ✅ Maintains clean separation of concerns
- ✅ Scales efficiently with pagination
- ✅ Uses smart caching strategies

All core data operations remain server-side. The frontend is purely for rendering and user interaction.
