# API_REFERENCE.md - Complete API Documentation

## Table of Contents
1. [Customer APIs](#customer-apis)
2. [Admin APIs](#admin-apis)
3. [Billing APIs](#billing-apis)
4. [Authentication](#authentication)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Customer APIs

### POST /api/search

**Initiate email search from websites**

**Request:**
```bash
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "tech startups in silicon valley",
    "pages": 2
  }'
```

**Request Body:**
```json
{
  "query": "string, required, min 3 chars",
  "pages": "number, optional, default 1, max 5"
}
```

**Response (200 OK):**
```json
{
  "searchId": "search_abc123",
  "jobIds": ["job_1", "job_2", "job_3"],
  "totalQueued": 3,
  "duplicatesRemoved": 0,
  "estimatedDuration": "5-15 minutes"
}
```

**Errors:**
- `400 Bad Request` - Invalid query (too short)
- `401 Unauthorized` - Missing/invalid API key
- `429 Too Many Requests` - Hourly rate limit exceeded
- `403 Forbidden` - Monthly quota exceeded

**Rate Limit:** 
- Free: 10/hour
- Pro: 100/hour
- Enterprise: 1000/hour

**Middleware Chain:**
```
withAuth → withRateLimit → withBilling → handler
```

---

### GET /api/metrics

**Get current system metrics**

**Request:**
```bash
curl http://localhost:3000/api/metrics \
  -H "x-api-key: sk_test_your_key_here"
```

**Response (200 OK):**
```json
{
  "queueStats": {
    "pending": 150,
    "processing": 3,
    "completed": 8900,
    "failed": 45
  },
  "health": "healthy",
  "avgProcessingTime": 3200,
  "successRate": 0.994,
  "workerStatus": "active",
  "timestamp": 1689350000000
}
```

**Rate Limit:** Subject to plan limits (same as /api/search)

---

### GET /api/jobs-paginated

**Get paginated list of user's jobs**

**Request:**
```bash
curl "http://localhost:3000/api/jobs-paginated?status=pending&limit=20&offset=0" \
  -H "x-api-key: sk_test_your_key_here"
```

**Query Parameters:**
```
status: 'all' | 'pending' | 'processing' | 'completed' | 'failed' (default: all)
limit: 1-100 (default: 20)
offset: 0+ (default: 0)
```

**Response (200 OK):**
```json
{
  "jobs": [
    {
      "id": "job_1",
      "url": "https://example.com",
      "status": "completed",
      "emailsFound": 42,
      "processingTime": 3500,
      "createdAt": 1689349000000,
      "completedAt": 1689349003500
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  },
  "statusCounts": {
    "pending": 50,
    "processing": 3,
    "completed": 89,
    "failed": 8
  }
}
```

---

### GET /api/job/:id

**Get details for a specific job**

**Request:**
```bash
curl http://localhost:3000/api/job/job_abc123 \
  -H "x-api-key: sk_test_your_key_here"
```

**Response (200 OK):**
```json
{
  "id": "job_abc123",
  "url": "https://example.com",
  "status": "completed",
  "emails": ["contact@example.com", "info@example.com"],
  "emailCount": 42,
  "retries": 0,
  "createdAt": 1689349000000,
  "startedAt": 1689349001000,
  "completedAt": 1689349003500,
  "error": null,
  "processingTimeMs": 2500
}
```

**Errors:**
- `404 Not Found` - Job doesn't exist
- `403 Forbidden` - Job belongs to different user

---

### GET /api/job/:id/status

**Get only the status of a job (lightweight)**

**Request:**
```bash
curl http://localhost:3000/api/job/job_abc123/status \
  -H "x-api-key: sk_test_your_key_here"
```

**Response (200 OK):**
```json
{
  "jobId": "job_abc123",
  "status": "completed",
  "progress": 100,
  "emailsFound": 42,
  "error": null
}
```

---

### GET /api/job/:id/result

**Get extracted emails for a job**

**Request:**
```bash
curl http://localhost:3000/api/job/job_abc123/result \
  -H "x-api-key: sk_test_your_key_here"
```

**Response (200 OK):**
```json
{
  "jobId": "job_abc123",
  "emails": [
    "contact@example.com",
    "info@example.com",
    "support@example.com"
  ],
  "total": 3,
  "url": "https://example.com"
}
```

**Errors:**
- `404 Not Found` - Job not found
- `202 Accepted` - Job still processing (try again later)

---

## Admin APIs

### GET /api/admin/dashboard

**Get system overview metrics (admin only)**

**Request:**
```bash
curl http://localhost:3000/api/admin/dashboard \
  -H "x-api-key: sk_test_admin_key"
```

**Authorization:**
- ✅ Must be valid API key (withAuth)
- ✅ Must be admin role (withAdminAuth)
- ❌ Returns 403 Forbidden if not admin

**Response (200 OK):**
```json
{
  "queueStats": {
    "pending": 1500,
    "processing": 12,
    "completed": 89000,
    "failed": 450
  },
  "systemHealth": {
    "status": "healthy",
    "alerts": []
  },
  "performance": {
    "avgProcessingTime": 3200,
    "successRate": 0.994,
    "failureRate": 0.006
  },
  "workers": {
    "active": 3,
    "idle": 0,
    "totalJobs": 91962
  },
  "timestamp": 1689350000000
}
```

**Middleware Chain:**
```
withAuth → withAdminAuth → handler
```

---

### GET /api/admin/jobs

**Get all jobs across all users (admin only)**

**Request:**
```bash
curl "http://localhost:3000/api/admin/jobs?status=failed&limit=50" \
  -H "x-api-key: sk_test_admin_key"
```

**Query Parameters:**
```
status: 'all' | 'pending' | 'processing' | 'completed' | 'failed'
limit: 1-100 (default: 20)
offset: 0+ (default: 0)
```

**Response (200 OK):**
```json
{
  "jobs": [
    {
      "id": "job_xyz",
      "userId": "user_123",
      "url": "https://failed-site.com",
      "status": "failed",
      "emailsFound": 0,
      "retries": 3,
      "error": "Timeout after 20 seconds",
      "createdAt": 1689349000000,
      "failedAt": 1689349020000
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 450,
    "hasMore": true
  }
}
```

---

### GET /api/admin/queue/health

**Get queue health and diagnostics (admin only)**

**Request:**
```bash
curl http://localhost:3000/api/admin/queue/health \
  -H "x-api-key: sk_test_admin_key"
```

**Response (200 OK):**
```json
{
  "health": "healthy",
  "alerts": [],
  "queueDepth": {
    "pending": 1500,
    "processing": 12,
    "total": 1512
  },
  "capacity": {
    "maxProcessing": 50,
    "currentProcessing": 12,
    "utilizationPercent": 24
  },
  "performance": {
    "avgProcessingTime": 3200,
    "medianProcessingTime": 2800,
    "p95ProcessingTime": 8900
  },
  "reliability": {
    "successRate": 0.994,
    "failureRate": 0.006,
    "retryRate": 0.012
  },
  "recentFailures": [
    {
      "jobId": "job_abc",
      "url": "https://example.com",
      "error": "Timeout",
      "failedAt": 1689350000000
    }
  ],
  "timestamp": 1689350000000
}
```

---

### GET /api/admin/users

**Get user management data (admin only)**

**Request:**
```bash
curl "http://localhost:3000/api/admin/users?plan=pro&limit=50" \
  -H "x-api-key: sk_test_admin_key"
```

**Query Parameters:**
```
search: string (email or ID)
plan: 'all' | 'free' | 'pro' | 'enterprise'
status: 'active' | 'suspended'
limit: 1-100
offset: 0+
```

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "user_001",
      "email": "user@example.com",
      "plan": "pro",
      "status": "active",
      "monthlyUsage": 5000,
      "monthlyQuota": 10000,
      "apiKeyCount": 3,
      "totalJobsCompleted": 12500,
      "createdAt": 1689000000000,
      "lastActive": 1689349000000
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1200
  },
  "summary": {
    "totalUsers": 1200,
    "activeUsers": 850,
    "avgUsage": 4500,
    "topPlan": "free"
  }
}
```

---

## Billing APIs

### GET /api/billing/status

**Get user's billing and subscription status**

**Request:**
```bash
curl http://localhost:3000/api/billing/status \
  -H "x-api-key: sk_test_your_key"
```

**Response (200 OK):**
```json
{
  "userId": "user_001",
  "plan": "pro",
  "status": "active",
  "monthlyUsage": {
    "jobs": 5000,
    "quota": 10000,
    "percentUsed": 50
  },
  "billing": {
    "nextBillingDate": "2024-08-15",
    "monthlyPrice": "$29.99",
    "paymentMethod": "card ending in 4242"
  },
  "subscription": {
    "id": "sub_abc123",
    "status": "active",
    "createdAt": 1680000000000
  }
}
```

---

### POST /api/billing/webhook

**Stripe webhook endpoint (internal)**

**Handled Events:**
- `invoice.payment_succeeded` - Payment successful
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription cancelled

**Request Header:**
```
stripe-signature: t=timestamp,v1=signature
```

**Response:**
```
200 OK - Event processed
400 Bad Request - Invalid signature
```

---

## Authentication

### API Keys

**Format:** `sk_{environment}_{random}`

Example:
```
sk_test_abc123def456xyz789
sk_live_prod123prod456prod789
```

### Header Format

All authenticated requests include:
```
x-api-key: sk_test_your_key_here
```

### Testing Keys

**Free Plan Test Key:**
```
sk_test_free_001
```

**Pro Plan Test Key:**
```
sk_test_pro_001
```

**Admin Test Key:**
```
sk_test_admin_001
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded your hourly rate limit (10/hour)",
    "timestamp": 1689350000000
  }
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_API_KEY` | 401 | API key missing or invalid |
| `UNAUTHORIZED` | 401 | Request not authenticated |
| `FORBIDDEN` | 403 | User not authorized |
| `NOT_ADMIN` | 403 | Admin access required |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Hourly quota exceeded |
| `QUOTA_EXCEEDED` | 403 | Monthly quota exceeded |
| `INVALID_INPUT` | 400 | Request body invalid |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

### Hourly Limits

| Plan | Limit |
|------|-------|
| Free | 10 /hour |
| Pro | 100 /hour |
| Enterprise | 1000 /hour |

### Monthly Quotas

| Plan | Quota |
|------|-------|
| Free | 1,000 /month |
| Pro | 10,000 /month |
| Enterprise | 100,000 /month |

### Rate Limit Headers

Response includes:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1689354000
```

---

## API Client Examples

### cURL

```bash
# Search
curl -X POST http://localhost:3000/api/search \
  -H "x-api-key: sk_test_your_key" \
  -H "Content-Type: application/json" \
  -d '{"query": "tech companies"}'

# Check metrics
curl http://localhost:3000/api/metrics \
  -H "x-api-key: sk_test_your_key"
```

### JavaScript/Node.js

```javascript
const apiKey = 'sk_test_your_key';

// Search
const response = await fetch('/api/search', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'tech companies' })
});

const result = await response.json();
console.log(result.jobIds);
```

### Python

```python
import requests

headers = {'x-api-key': 'sk_test_your_key'}

# Search
response = requests.post('http://localhost:3000/api/search',
  headers=headers,
  json={'query': 'tech companies'}
)
print(response.json())
```

---

## Versioning

Current API Version: **v1.0**

All endpoints are backwards compatible. Future breaking changes will use `/v2/` prefix.

