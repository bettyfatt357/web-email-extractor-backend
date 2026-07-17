# Job Status & Progress Tracking API

Complete API for real-time job status tracking built on top of the Redis-based queue system.

## Overview

This API allows external clients to track email extraction jobs in real-time, monitor progress, and retrieve results.

### Key Features

- Real-time job status tracking
- Progress percentage calculation
- Duration tracking (elapsed time)
- Email results retrieval
- All jobs list view
- Direct Redis reads (no caching)

## API Endpoints

### 1. GET /api/job/:id

Returns the complete job object with all details.

**Response (200 OK):**
```json
{
  "id": "628c9195",
  "url": "https://github.com",
  "status": "completed",
  "emails": ["email1@domain.com", "email2@domain.com"],
  "retries": 0,
  "maxRetries": 3,
  "createdAt": 1784102667684,
  "startedAt": 1784102668100,
  "completedAt": 1784102669400,
  "error": null
}
```

**Error Response (404):**
```json
{
  "error": "Job 628c9195 not found"
}
```

---

### 2. GET /api/job/:id/status

Lightweight endpoint returning status with progress and duration.

**Response (200 OK):**
```json
{
  "id": "628c9195",
  "status": "completed",
  "retries": 0,
  "progress": 100,
  "duration": 1300
}
```

**Status Codes:**
- `pending` → progress = 0%
- `processing` → progress = 50%
- `completed` → progress = 100%
- `failed` → progress = 100%

**Duration:**
- If processing: `now - startedAt` (milliseconds)
- If completed: `completedAt - startedAt` (milliseconds)

**Error Response (404):**
```json
{
  "error": "Job 628c9195 not found"
}
```

---

### 3. GET /api/job/:id/result

Returns only the email results. Available after job completion.

**Response (200 OK) - Completed:**
```json
{
  "id": "628c9195",
  "emails": ["email1@domain.com", "email2@domain.com"],
  "totalEmails": 2
}
```

**Response (200 OK) - Failed:**
```json
{
  "id": "628c9195",
  "error": "Failed to load page",
  "emails": [],
  "totalEmails": 0
}
```

**Response (202 Accepted) - Not Finished:**
```json
{
  "error": "Job not finished",
  "status": "processing",
  "message": "Job is still processing. Please wait for completion."
}
```

**Response (404) - Not Found:**
```json
{
  "error": "Job 628c9195 not found"
}
```

---

### 4. GET /api/jobs

Debug endpoint returning all jobs grouped by status.

**Response (200 OK):**
```json
{
  "total": 3,
  "pending": [
    {
      "id": "976e5608",
      "url": "https://example.com",
      "status": "pending",
      "emails": [],
      "retries": 0,
      "maxRetries": 3,
      "createdAt": 1784102667652,
      "startedAt": null,
      "completedAt": null,
      "error": null
    }
  ],
  "processing": [
    {
      "id": "e6d7b1d1",
      "url": "https://github.com",
      "status": "processing",
      "emails": [],
      "retries": 0,
      "maxRetries": 3,
      "createdAt": 1784102667684,
      "startedAt": 1784102668100,
      "completedAt": null,
      "error": null
    }
  ],
  "completed": [
    {
      "id": "adff35b8",
      "url": "https://vercel.com",
      "status": "completed",
      "emails": ["contact@vercel.com"],
      "retries": 0,
      "maxRetries": 3,
      "createdAt": 1784102667716,
      "startedAt": 1784102668200,
      "completedAt": 1784102669500,
      "error": null
    }
  ],
  "failed": []
}
```

---

## Usage Examples

### Polling for Job Completion

```javascript
async function pollJobStatus(jobId) {
  const maxAttempts = 30;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const response = await fetch(`/api/job/${jobId}/status`);
    const { status, progress, duration } = await response.json();

    console.log(`Status: ${status}, Progress: ${progress}%, Duration: ${duration}ms`);

    if (status === 'completed' || status === 'failed') {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    attempt++;
  }
}
```

### Getting Results After Completion

```javascript
async function getJobResults(jobId) {
  const response = await fetch(`/api/job/${jobId}/result`);

  if (response.status === 202) {
    console.log('Job still processing');
    return null;
  }

  const { emails, totalEmails, error } = await response.json();
  
  if (error) {
    console.log(`Job failed: ${error}`);
    return null;
  }

  return { emails, totalEmails };
}
```

### Real-time Status Tracking UI

```javascript
async function trackJobProgress(jobId, onUpdate) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/job/${jobId}/status`);
      const data = await response.json();

      onUpdate(data);

      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(pollInterval);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 2000);
}
```

---

## Integration with Existing System

### Compatibility

- ✓ Uses same Redis instance as worker
- ✓ Reads JSON-serialized job data
- ✓ No caching (always fresh data)
- ✓ Doesn't interfere with atomic locking
- ✓ Works with worker processing and watchdog

### Data Source

All endpoints read directly from Redis keys:
- Job key format: `job:{jobId}`
- Returns JSON-parsed job object
- Timestamp fields in milliseconds

---

## Error Handling

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Successful response |
| 202 | Job still processing (result endpoint only) |
| 404 | Job not found |
| 500 | Internal server error |

### Error Responses

```json
{
  "error": "Human-readable error message"
}
```

---

## Performance Considerations

- Direct Redis reads (minimal latency)
- No database queries or caching
- Suitable for real-time dashboards
- Each request hits Redis once per endpoint

---

## Testing

See `scripts/testAPI.mjs` for comprehensive test that:
1. Adds jobs to queue
2. Starts worker and Next.js server
3. Polls job status in real-time
4. Tracks progress from pending → processing → completed
5. Retrieves final email results

Run test:
```bash
node scripts/testAPI.mjs
```

---

## Implementation Details

### File Structure

```
app/api/
├── job/[id]/
│   ├── route.ts              # GET /api/job/:id
│   ├── status/route.ts        # GET /api/job/:id/status
│   └── result/route.ts        # GET /api/job/:id/result
└── jobs/route.ts             # GET /api/jobs
```

### Next.js 16 Compatibility

Uses `async params` for dynamic route segments:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

---

## Future Enhancements

- WebSocket support for real-time updates
- Job filtering by status/date range
- Pagination for large job lists
- Job creation API endpoint
- Job cancellation endpoint
- Rate limiting per client
