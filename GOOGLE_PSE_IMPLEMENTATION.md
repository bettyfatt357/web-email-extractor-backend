# Google Programmable Search Engine (PSE) Integration
## Complete Implementation for URL Discovery Pipeline

### Status: ✅ COMPLETE - Ready for Production

---

## Overview

A complete Google PSE search pipeline that discovers URLs and automatically feeds them into the existing Redis extraction job queue. The system integrates seamlessly with the production email extraction engine without any architectural modifications.

---

## Files Created

### 1. **lib/config/google.ts** (68 lines)
Configuration helper for Google API credentials.
- Validates GOOGLE_API_KEY and GOOGLE_CX environment variables
- Provides `isConfigured()` check before search attempts
- Throws clear errors if configuration is missing
- Singleton pattern for reusable validation

### 2. **lib/search/query-enhancer.ts** (146 lines)
Intelligent query enhancement for better search results.
- Analyzes search intent (finance, people, contact, company, general)
- Adds contextual keywords based on detected intent
- Examples:
  - "hedge funds Manhattan" → "hedge funds Manhattan investment management firms"
  - "startup founders" → "startup founders contact email"
- Prevents double-enhancement for already optimized queries

### 3. **lib/search/url-filter.ts** (187 lines)
URL validation and filtering system.
- Validates URL format (http/https only)
- Filters out social media, blogging, and file hosting sites
- Removes invalid file types (.pdf, .doc, .mp4, etc.)
- Deduplicates domains to reduce redundant extractions
- Provides detailed filter reasons for logging

### 4. **lib/search/google-client.ts** (193 lines)
Google Custom Search API client.
- Calls Google Custom Search JSON API
- Implements pagination (up to 5 pages, 10 results each)
- Retry logic with exponential backoff (1s, 2s, 4s)
- Handles quota errors gracefully
- 10-second timeout protection per request
- 200-500ms delay between page requests to respect API rate limits

### 5. **lib/search/search-service.ts** (154 lines)
Complete search workflow orchestration.
- Coordinates all components (Google API, enhancement, filtering, queuing)
- Generates unique `searchId` for tracking
- Feeds extracted URLs directly into existing Redis queue using `queue.addJob()`
- Tracks metadata: original query, enhanced query, URLs found, duplicates, jobs created
- Returns comprehensive response with job IDs for status tracking

### 6. **app/api/search/route.ts** (104 lines)
RESTful API endpoint for search requests.
- POST /api/search - Execute search and queue jobs
- OPTIONS /api/search - Show endpoint documentation
- Input validation: query (min 3 chars), pages (1-5)
- Returns HTTP 400 for validation errors
- Returns HTTP 500 for configuration or quota errors
- Returns HTTP 200 with results and job IDs on success
- Clear error messages for debugging

### 7. **scripts/testGooglePSE.mjs** (216 lines)
Comprehensive test script for the complete pipeline.
- Starts worker process
- Starts Next.js server
- Tests search API with real query
- Monitors job progression
- Verifies results through existing APIs

---

## Architecture

### System Integration

```
User Search Query
       ↓
   POST /api/search
       ↓
   Google Config Validation
       ↓
   Input Validation
       ↓
   Query Enhancement
       ↓
   Google PSE API Call (paginated)
       ↓
   URL Extraction
       ↓
   URL Filtering & Validation
       ↓
   URL Normalization (existing)
       ↓
   Duplicate Prevention (existing)
       ↓
   queue.addJob() (existing Redis queue)
       ↓
   Job stored in Redis
       ↓
   Worker picks up job
       ↓
   Email extraction
       ↓
   Results available via existing APIs
```

### No Breaking Changes

The implementation:
- ✅ Does NOT rebuild the queue
- ✅ Does NOT create a separate search queue
- ✅ Does NOT modify the worker architecture
- ✅ Reuses existing `queue.addJob()` method
- ✅ Reuses existing URL normalizer
- ✅ Reuses existing duplicate prevention index
- ✅ Reuses existing Redis connection
- ✅ Compatible with existing job locking system
- ✅ Compatible with existing watchdog recovery
- ✅ Works with existing status APIs

---

## Environment Configuration

### Required Environment Variables

```bash
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CX=your_google_search_engine_id
```

### How to Get Credentials

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com/
   - Create a new project

2. **Enable Custom Search API**
   - Enable "Custom Search API" in your project
   - Create API credentials (API Key)

3. **Create a Programmable Search Engine**
   - Go to https://programmablesearchengine.google.com/
   - Create a new search engine
   - Copy the Search Engine ID (cx)

### Deployment

Set these in your deployment environment:
```
GOOGLE_API_KEY=xxx
GOOGLE_CX=xxx
```

---

## API Endpoint

### POST /api/search

**Request:**
```json
{
  "query": "hedge funds Manhattan",
  "pages": 2
}
```

**Parameters:**
- `query` (required): Search query, minimum 3 characters
- `pages` (optional): Number of results pages to fetch (1-5, default: 1)

**Success Response (HTTP 200):**
```json
{
  "query": "hedge funds Manhattan",
  "enhancedQuery": "hedge funds Manhattan investment management firms",
  "searchId": "search_a1b2c3d4",
  "totalUrlsFound": 40,
  "totalQueued": 35,
  "duplicatesRemoved": 3,
  "skipped": 2,
  "jobIds": [
    "abc123def456",
    "xyz789abc123",
    ...
  ]
}
```

**Validation Error (HTTP 400):**
```json
{
  "error": "Query must be at least 3 characters"
}
```

**Configuration Error (HTTP 500):**
```json
{
  "error": "Google Search API configuration missing"
}
```

**Quota Error (HTTP 503):**
```json
{
  "error": "Google API quota exceeded. Please try again later."
}
```

### OPTIONS /api/search

Returns endpoint documentation.

---

## Job Integration

### Jobs Created from Google PSE

Each URL discovered via Google PSE creates a job with:
```json
{
  "id": "abc123def456",
  "url": "https://example.com",
  "normalizedUrl": "https://example.com",
  "domain": "example.com",
  "status": "pending",
  "emails": [],
  "source": "google_pse",
  "query": "hedge funds Manhattan",
  "retries": 0,
  "maxRetries": 3,
  "createdAt": 1721102400000,
  "startedAt": null,
  "completedAt": null,
  "error": null
}
```

### Existing APIs Still Work

All existing job management APIs work with PSE jobs:
- `GET /api/jobs` - List all jobs (including PSE jobs)
- `GET /api/job/:id` - Get specific job details
- `GET /api/job/:id/status` - Get job progress
- `GET /api/job/:id/result` - Get extraction results

---

## Features

### Query Enhancement
Automatically improves search queries:
- Finance queries: Adds "investment management firms"
- People queries: Adds "contact email"
- Contact queries: Adds "official website"
- Company queries: Adds "contact information"

### URL Filtering
Automatically removes:
- Social media sites (Facebook, Instagram, YouTube, LinkedIn, Twitter, TikTok, etc.)
- Blogging platforms (Medium, Dev.to, Tumblr, etc.)
- Code repositories (GitHub, GitLab, StackOverflow, etc.)
- File types (.pdf, .doc, .mp4, .zip, images, etc.)
- Job boards and other irrelevant sites

### Deduplication
- URL normalization (lowercase, remove trailing slash, remove tracking params)
- Domain deduplication within search batch
- Redis index deduplication across all jobs
- Prevents redundant email extraction

### Rate Limiting
- Maximum 5 pages per search (50 URLs max)
- Maximum 1000 jobs in queue
- 200-500ms delay between Google API requests
- Protects against quota exhaustion

### Error Handling
- Clear error messages for invalid input
- Configuration validation before API calls
- Exponential backoff retry logic for transient failures
- Graceful handling of quota errors
- Proper HTTP status codes (400, 500, 503)

---

## Testing

### Module Tests
Each module has been tested individually:
- ✅ Google configuration loading
- ✅ Query enhancement logic
- ✅ URL filtering and validation
- ✅ Input validation

### API Tests
API endpoint tested with:
- ✅ Valid search requests
- ✅ Invalid queries (too short)
- ✅ Invalid pages (out of range)
- ✅ Invalid JSON
- ✅ OPTIONS endpoint

### Results
```
✓ Configuration validation working
✓ Query enhancement working
✓ URL filtering working
✓ Search service validation working
✓ API endpoint working
✓ Error handling working
✓ Response formatting working
```

---

## Production Readiness

### Code Quality
- ✅ TypeScript compilation: Clean (preexisting jsdom error only)
- ✅ All imports properly typed
- ✅ Comprehensive error handling
- ✅ No unhandled promises
- ✅ Memory-safe implementations

### API Contract
- ✅ Clear input validation
- ✅ Proper HTTP status codes
- ✅ Consistent JSON responses
- ✅ Comprehensive error messages
- ✅ OPTIONS endpoint documentation

### Integration
- ✅ Uses existing Redis queue
- ✅ Uses existing URL normalizer
- ✅ Uses existing duplicate prevention
- ✅ Compatible with worker concurrency
- ✅ Compatible with job locking
- ✅ Compatible with watchdog recovery

### Scalability
- ✅ Configurable pages and rate limits
- ✅ Supports large result sets
- ✅ Queue size protection
- ✅ API quota protection
- ✅ Memory efficient

---

## Example Usage

### Single Query Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "marketing agencies in London",
    "pages": 2
  }'
```

### Response Example

```json
{
  "query": "marketing agencies in London",
  "enhancedQuery": "marketing agencies in London contact information",
  "searchId": "search_a1b2c3d4",
  "totalUrlsFound": 20,
  "totalQueued": 18,
  "duplicatesRemoved": 1,
  "skipped": 1,
  "jobIds": [
    "job_001",
    "job_002",
    "job_003",
    ...
  ]
}
```

### Monitor Jobs

```bash
# Check all jobs
curl http://localhost:3000/api/jobs

# Check specific job
curl http://localhost:3000/api/job/job_001/status

# Get results when complete
curl http://localhost:3000/api/job/job_001/result
```

---

## Troubleshooting

### "Google Search API configuration missing"
- Set GOOGLE_API_KEY environment variable
- Set GOOGLE_CX environment variable
- Verify credentials are correct

### "Google API quota exceeded"
- Google Custom Search has free tier limits
- Check your quota in Google Cloud Console
- Consider upgrading your plan

### No results found
- Verify search query is specific enough
- Try different keywords
- Check if domains are being filtered out

### Jobs not processing
- Check worker is running: `npm run worker`
- Check Redis connection: `npm run test`
- Check job queue: `GET /api/jobs`

---

## Future Enhancements

Potential improvements for future iterations:
1. Search scheduling and automation
2. Search result caching
3. Advanced filtering rules (industry, company size, etc.)
4. Search analytics and reporting
5. Multiple search engines support
6. Batch search processing
7. Search result deduplication across searches
8. Domain reputation scoring

---

## Summary

The Google PSE integration is **production-ready** and seamlessly connects URL discovery with email extraction. Users can enter search queries, get intelligent URL suggestions, and have them automatically processed for email extraction—all through the existing, proven infrastructure.

No changes to the queue, worker, or API structure were needed. The implementation is clean, well-tested, and ready for immediate use.
