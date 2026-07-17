# Phase 2 Backend Diagnosis - Business Discovery Search Integration

**Date**: July 16, 2026  
**Status**: Analysis Complete - Ready for Implementation  
**Scope**: API Enhancement for Multi-Keyword Business Discovery  

---

## 1. CURRENT BACKEND ARCHITECTURE

### API Route Flow
**File**: `app/api/search/route.ts`

**Middleware Stack** (in order):
1. `withAuth` - Validates user credentials
2. `withRateLimit` - Enforces rate limits by plan (free/pro/enterprise)
3. `withBilling` - Checks billing status
4. `handler` - Request processing

**Current Request Format**:
```typescript
POST /api/search
{
  query: string,        // required, 3+ chars
  pages: number         // optional, 1-5 (default 1)
}
```

**Current Response Format**:
```typescript
{
  query: string,
  enhancedQuery: string,
  searchId: string,
  totalUrlsFound: number,
  totalQueued: number,
  duplicatesRemoved: number,
  skipped: number,
  jobIds: string[]
}
```

**Error Handling**:
- 400: Invalid JSON or validation errors
- 403: Google API quota exceeded
- 500: Configuration or search errors
- 503: Google API quota exhausted

**Usage Tracking**:
- Logs to `trackUsageEvent()` with jobsCreated and success status

### Search Service Workflow
**File**: `lib/search/search-service.ts`

**Current Single-Keyword Workflow**:
```
1. Generate searchId
2. enhanceQuery(query)
3. googleSearch(enhancedQuery, pages)
4. extractUrlsFromResults()
5. filterUrls()
6. Add to queue:
   - Normalize URLs
   - Check duplicates
   - Create jobs
7. Return results
```

**Key Functions**:
- `performSearch(query, pages)` - Main entry point
- `validateSearchRequest(query, pages)` - Input validation
- `generateSearchId()` - Unique ID generation

**Queue Integration**:
- `queue.addJob(url, source, query)` - Adds extraction job
- Handles queue overflow (max 1000 jobs)
- Tracks duplicate URLs per search

### Google PSE Integration
**File**: `lib/search/google-client.ts`

**Key Features**:
- Pagination support (1-5 pages, 10 results per page)
- Retry logic with exponential backoff (1s, 2s, 4s)
- Quota detection and error handling
- Rate limiting (200-500ms between pages)
- 10-second timeout per request

**Functions**:
- `googleSearch(query, pages)` - Multi-page search
- `callGoogleAPI(query, startIndex, maxRetries)` - Single API call
- `extractUrlsFromResults(results)` - Extract links

**Quota Protection**:
- Throws immediately on quota error (403)
- Exits loop on error (doesn't continue searching)
- Rate limit detected (429) → 5 second delay

### Query Enhancement
**File**: `lib/search/query-enhancer.ts`

**Intent Detection** (auto-categorizes):
- `finance` - hedge funds, venture capital, equity, investors
- `people` - founders, CEOs, executives, leaders
- `contact` - emails, contact info, phone, reach
- `company` - company, agency, firm, consulting services
- `general` - default

**Enhancement Strategy**:
```
'hedge funds Manhattan' 
  → 'hedge funds Manhattan investment management firms'

'startup founders' 
  → 'startup founders contact email'
```

**Prevention of Double-Enhancement**:
- Skips if already enhanced (contains contact+email+website)

### URL Filtering
**File**: `lib/search/url-filter.ts`

**Skip Domains** (65+ total):
- Social media: Facebook, Instagram, LinkedIn, Twitter, TikTok, Reddit
- Code repos: GitHub, GitLab, Bitbucket
- Content platforms: Medium, Dev.to, StackOverflow
- Blog platforms: Blogspot, WordPress, Wix, Squarespace
- Search engines: Google, Bing, DuckDuckGo

**Skip File Extensions** (13 types):
- Documents: .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx
- Archives: .zip, .rar
- Media: .png, .jpg, .jpeg, .gif, .mp4, .mp3, .avi, .mov

**Deduplication**:
- One URL per domain maximum
- Case-insensitive domain matching
- Subdomain matching (company.linkedin.com → skipped)

### Queue System
**File**: `lib/queue/queue.ts`

**Configuration**:
- Max queued jobs: 1000
- Max concurrent processing: 10
- Request delay: 200ms (configurable)
- Job timeout: 20 seconds

**Job Format**:
```typescript
{
  id: string,           // UUID
  url: string,          // URL to extract emails from
  source: string,       // 'google_pse', etc
  query: string,        // Search query
  status: 'queued' | 'processing' | 'completed' | 'failed',
  createdAt: number,    // Timestamp
  result?: {
    emails: string[],
    success: boolean
  }
}
```

**Backpressure**:
- Rejects new jobs if queue > 1000 items
- Returns null on overflow

### Rate Limiting
**File**: `lib/auth/rate-limit.ts`

**Default Limits** (per hour):
- Free: 10 searches/hour
- Pro: 100 searches/hour
- Enterprise: 1000 searches/hour

**Implementation**:
- In-memory store (Map) - not Redis-backed yet
- Per-user tracking
- 1-hour window resets

---

## 2. PROPOSED PHASE 2 CHANGES

### 2.1 Extended Request Format (Backward Compatible)

**New `POST /api/search` Request**:
```typescript
{
  // Original fields (still supported)
  query?: string,           // legacy - for simple mode
  pages?: number,           // legacy - default 1, max 5
  
  // New fields (advanced mode)
  searchMode?: 'simple' | 'advanced',  // default 'simple'
  keywords?: string[],      // advanced mode - up to 10 keywords
  patterns?: string[],      // email domain filters - up to 10
  location?: string,        // geographic context
  searchDepth?: number,     // pages per keyword (1-5, default 1)
  delayMs?: number,         // request delay (100-2000, default 200)
  deepSearch?: boolean      // enhanced search flag (default false)
}
```

**Validation Logic**:
```
If query provided AND keywords not provided:
  → Use simple mode (original behavior)

If keywords provided:
  → Use advanced mode
  → Create search for each keyword
  → Apply patterns and location

Backward compatible:
  → Old clients using (query, pages) work unchanged
  → No breaking changes
```

**Response Format** (enhanced):
```typescript
{
  // Original fields
  query: string,
  enhancedQuery: string,
  searchId: string,
  totalUrlsFound: number,
  totalQueued: number,
  duplicatesRemoved: number,
  skipped: number,
  jobIds: string[],
  
  // New fields (advanced mode only)
  searchMode?: 'simple' | 'advanced',
  keywordsProcessed?: string[],
  patternsApplied?: string[],
  jobsByKeyword?: {
    [keyword: string]: {
      jobCount: number,
      jobIds: string[]
    }
  }
}
```

### 2.2 Updated Validation

**`lib/search/search-service.ts`**:

New function needed:
```typescript
function validateAdvancedSearchRequest(
  keywords?: string[],
  patterns?: string[],
  location?: string,
  searchDepth?: number,
  delayMs?: number
): string | null
```

Checks:
- keywords: required in advanced mode, max 10, min 2 chars each
- patterns: optional, max 10, must start with @ for domain filter
- location: optional, max 100 chars
- searchDepth: optional, 1-5 (default 1)
- delayMs: optional, 100-2000 (default 200)

### 2.3 Multi-Keyword Search Workflow

**New function in `lib/search/search-service.ts`**:

```typescript
async function performAdvancedSearch(
  keywords: string[],
  patterns: string[],
  location: string,
  searchDepth: number,
  delayMs: number
): Promise<SearchResult>
```

**Algorithm**:
```
For each keyword:
  1. Combine keyword + location → query
  2. Enhance query
  3. Google search (searchDepth pages)
  4. Extract URLs
  5. Filter URLs
  6. Apply pattern filtering (NEW)
  7. Add to queue
  8. Sleep delayMs between keywords
  
Track results by keyword:
  - Total jobs per keyword
  - Job IDs grouped by keyword
```

**Key Logic Points**:
- Delay between keywords prevents quota exhaustion
- Pattern filtering extracts emails only from matching domains
- Maintains deduplication across all keywords
- Reports results grouped by keyword

### 2.4 Pattern Filtering Logic

**New function in `lib/search/url-filter.ts`**:

```typescript
export function filterByPatterns(
  urls: string[],
  patterns: string[]
): string[]
```

**Algorithm**:
```
If patterns empty → return all URLs (no filtering)

If patterns provided:
  For each URL:
    Extract domain
    Check if domain matches any pattern
    Keep only if matches
```

**Pattern Matching Examples**:
- Pattern: `@company.com` → Match: company.com, sub.company.com
- Pattern: `@gmail.com` → Match: gmail.com (but skip personal)
- Pattern: `@startup.co` → Match: startup.co

**Implementation**:
```typescript
// Normalize pattern (remove @ if present)
const domainPattern = pattern.startsWith('@') 
  ? pattern.substring(1) 
  : pattern;

// Extract domain from URL
const urlDomain = new URL(url).hostname;

// Check for exact or subdomain match
const matches = 
  urlDomain === domainPattern ||
  urlDomain.endsWith(`.${domainPattern}`);
```

### 2.5 Deep Search Implementation (Phase 2, Future Expansion)

**Current Status**: Checkbox placeholder in UI

**Future Implementation**:
- Enhanced query enrichment
- Additional search keywords
- Secondary URL extraction
- Email pattern matching on pages

**For now**: Stored in job metadata, not processed yet

---

## 3. EXACT FILES TO MODIFY

### Must Modify (Required)

#### 1. `app/api/search/route.ts`
**Changes**:
- Line 28-30: Extract new fields from request body
- Line 33-41: Pass new fields to validation
- Line 46: Pass new fields to performSearch
- Error handling: Add pattern validation errors

**Estimated lines changed**: 15-20

#### 2. `lib/search/search-service.ts`
**Changes**:
- Add new request interface with advanced fields
- Add new validation function for advanced mode
- Modify `performSearch()` to handle both modes
- Add new `performAdvancedSearch()` function
- Add pattern filtering logic
- Update response interface to include advanced fields

**Estimated lines changed**: 80-120

#### 3. `lib/search/url-filter.ts`
**Changes**:
- Add new `filterByPatterns()` function
- Export for use in search-service

**Estimated lines changed**: 20-30

### May Modify (Optional Enhancements)

#### 4. `lib/search/query-enhancer.ts`
**Changes**:
- Add location context to enhancement
- Improve finance keywords for real estate, real estate agents, etc

**Estimated lines changed**: 10-15

#### 5. `lib/search/google-client.ts`
**Changes** (none needed for MVP):
- Already handles pagination correctly
- Already has rate limiting
- No modifications required for Phase 2

**Status**: NO CHANGES NEEDED

#### 6. `lib/queue/queue.ts`
**Changes** (none needed for MVP):
- Job structure doesn't need updating
- Already handles keywords in query field
- Can track jobs per keyword in search-service

**Status**: NO CHANGES NEEDED

---

## 4. API PAYLOAD CHANGES SUMMARY

### Request Format

**Current (Simple)**:
```json
{
  "query": "hedge funds manhattan",
  "pages": 2
}
```

**New (Simple - Still Works)**:
```json
{
  "query": "hedge funds manhattan",
  "pages": 2
}
```

**New (Advanced)**:
```json
{
  "keywords": ["hedge fund manager", "real estate agent"],
  "location": "Florida, USA",
  "patterns": ["@company.com", "@startup.co"],
  "searchDepth": 2,
  "delayMs": 300,
  "deepSearch": false
}
```

**Mixed (Auto-Converts)**:
```json
{
  "keywords": ["hedge fund manager"],
  "location": "Miami"
}
// Auto sets: searchDepth=1, delayMs=200, deepSearch=false, patterns=[]
```

### Response Format

**Simple Mode** (unchanged):
```json
{
  "query": "hedge funds manhattan",
  "enhancedQuery": "hedge funds manhattan investment management firms",
  "searchId": "search_abc123def456",
  "totalUrlsFound": 28,
  "totalQueued": 15,
  "duplicatesRemoved": 2,
  "skipped": 11,
  "jobIds": ["job_1", "job_2", "job_3", ...]
}
```

**Advanced Mode** (enhanced):
```json
{
  "query": "hedge fund manager real estate agent florida usa",
  "enhancedQuery": "hedge fund manager miami investment...",
  "searchId": "search_xyz789abc123",
  "searchMode": "advanced",
  "totalUrlsFound": 45,
  "totalQueued": 28,
  "duplicatesRemoved": 5,
  "skipped": 12,
  "keywordsProcessed": ["hedge fund manager", "real estate agent"],
  "patternsApplied": ["@company.com", "@startup.co"],
  "jobIds": ["job_1", "job_2", "job_3", ...],
  "jobsByKeyword": {
    "hedge fund manager": {
      "jobCount": 15,
      "jobIds": ["job_1", "job_2", ...]
    },
    "real estate agent": {
      "jobCount": 13,
      "jobIds": ["job_16", "job_17", ...]
    }
  }
}
```

---

## 5. SEARCH WORKFLOW DESIGN

### Decision Tree

```
User submits search
  │
  ├─ Has "query" field?
  │  ├─ YES → Simple Mode (original flow)
  │  │  ├─ validate(query, pages)
  │  │  ├─ performSearch(query, pages)
  │  │  └─ Return results
  │  │
  │  └─ NO → Advanced Mode
  │     ├─ validate(keywords, patterns, location, searchDepth, delayMs)
  │     ├─ FOR EACH keyword:
  │     │  ├─ Combine: keyword + location
  │     │  ├─ Enhance query
  │     │  ├─ Google search (searchDepth pages)
  │     │  ├─ Extract URLs
  │     │  ├─ Filter URLs (general)
  │     │  ├─ Filter by patterns (if provided)
  │     │  ├─ Add to queue
  │     │  ├─ Sleep delayMs
  │     │  └─ Track results
  │     │
  │     └─ Return grouped results
```

### Simple Mode Flow (No Changes)

```
Input: query="hedge funds manhattan", pages=2

Step 1: Enhance query
  → "hedge funds manhattan investment management firms"

Step 2: Google search (2 pages = 20 results)
  → [{link, title, snippet}, ...]

Step 3: Extract URLs
  → ['https://company1.com', 'https://company2.com', ...]

Step 4: Filter URLs
  → Remove social media, repos, blogs, duplicates
  → ['https://company1.com', 'https://company3.com', ...]

Step 5: Queue jobs
  → Create extraction jobs
  → Return jobIds

Response: {
  searchId, totalQueued: 15, jobIds: [...]
}
```

### Advanced Mode Flow (NEW)

```
Input: 
  keywords=["hedge fund manager", "real estate agent"]
  location="Florida"
  patterns=["@company.com"]
  searchDepth=2
  delayMs=300

For each keyword:
  
  Iteration 1: "hedge fund manager"
  ├─ Query: "hedge fund manager florida"
  ├─ Enhanced: "hedge fund manager florida investment management firms"
  ├─ Google search (2 pages = 20 results)
  ├─ Extract URLs (20 URLs)
  ├─ Filter general (15 URLs - remove social/repos)
  ├─ Filter patterns (3 URLs - only @company.com)
  ├─ Add to queue (3 jobs)
  ├─ Track: keyword="hedge fund manager", jobs=[job_1, job_2, job_3]
  └─ Sleep 300ms
  
  Iteration 2: "real estate agent"
  ├─ Query: "real estate agent florida"
  ├─ Enhanced: "real estate agent florida contact information"
  ├─ Google search (2 pages = 20 results)
  ├─ Extract URLs (20 URLs)
  ├─ Filter general (14 URLs)
  ├─ Filter patterns (2 URLs - only @company.com)
  ├─ Add to queue (2 jobs)
  ├─ Track: keyword="real estate agent", jobs=[job_4, job_5]
  └─ Sleep 300ms

Response: {
  searchId,
  searchMode: "advanced",
  totalQueued: 5,
  jobsByKeyword: {
    "hedge fund manager": {jobCount: 3, jobIds: [...]},
    "real estate agent": {jobCount: 2, jobIds: [...]}
  }
}
```

---

## 6. QUOTA PROTECTION STRATEGY

### Current Protection
✅ Google API client has:
- 10-second timeout per request
- Exponential backoff (1s, 2s, 4s)
- Quota detection (403 code → error)
- Rate limiting (200-500ms between pages)

### Enhanced Protection (Phase 2)

#### 1. Per-Keyword Rate Limiting
**Current Issue**: Multiple keywords might hit API quickly
**Solution**: Add configurable delay between keywords

```typescript
// User-controlled (UI already has this)
delayMs: 300  // 300ms delay between keywords

// Calculation:
// 2 keywords × 2 pages × 2 requests/page = ~8 API calls
// With 300ms delay: ~8 × 300ms = 2.4 seconds total
```

#### 2. Estimated Jobs Warning
**Current**: None
**Solution**: Pre-calculate and warn user

```typescript
// Already done in UI:
estimatedJobs = keywords.length × (15 × searchDepth)
// If > 200 jobs → ask for confirmation
```

#### 3. Queue Backpressure
**Current**: Queue rejects if > 1000 jobs
**Solution**: Already in place

```typescript
if (queue.length >= 1000) {
  return error("Queue overloaded")
}
```

#### 4. Keyword Validation
**New**: Prevent nonsensical searches

```typescript
// Validate keywords:
if (!keywords || keywords.length === 0) error("At least 1 keyword")
if (keywords.length > 10) error("Max 10 keywords")
if (searchDepth > 5) error("Max 5 pages")
if (keywords.some(k => k.length < 2)) error("Min 2 chars per keyword")
```

#### 5. Error Recovery
**Current**: Exits on error
**Proposed**: Continue with remaining keywords

```typescript
FOR EACH keyword:
  TRY:
    Perform search
    Queue jobs
  CATCH error:
    Log error
    Continue to next keyword (don't exit)

Return: {
  totalQueued,
  errors: [{keyword, error}, ...]
}
```

---

## 7. BACKWARD COMPATIBILITY PLAN

### Guarantee
**100% Backward Compatible** - No breaking changes

### Evidence

#### Original API Still Works
```json
POST /api/search
{
  "query": "my search",
  "pages": 3
}
```

✅ Will work exactly as before
✅ No changes to response format for simple mode

#### New Fields Are Optional
```json
{
  "keywords": [...],  // Optional - NEW
  "patterns": [...],  // Optional - NEW
  "location": "...",  // Optional - NEW
  "searchDepth": 1,   // Optional - NEW
  "delayMs": 200,     // Optional - NEW
  "deepSearch": false // Optional - NEW
}
```

✅ If not provided, defaults used
✅ Old clients don't need to change

#### Response Format Extended (Not Changed)
```
Simple mode response: No new fields (backward compatible)
Advanced mode response: New optional fields added

Old clients: Ignore unknown fields (standard JSON practice)
New clients: Use grouping fields
```

#### Error Messages Unchanged
```
Same HTTP status codes:
- 400: Invalid request
- 403: Quota exceeded
- 500: Error
- 503: Rate limited
```

### Migration Path
```
Phase 1: ✅ UI enhancement (complete)
Phase 2: ✅ Backend enhancement (ready to implement)
Phase 3: Database persistence (future)

Old clients keep working during all phases
New clients can use advanced features immediately
```

---

## 8. IMPLEMENTATION ORDER

### Step 1: Update Validation
- Add new request interface
- Add validation for advanced fields
- Keep existing validation for simple mode

### Step 2: Update Route Handler
- Extract new fields from request
- Route to appropriate function (simple vs advanced)

### Step 3: Add Advanced Search Function
- New `performAdvancedSearch()` function
- Implements keyword loop
- Handles delays and error recovery

### Step 4: Add Pattern Filtering
- New `filterByPatterns()` function
- Integrates with URL filtering

### Step 5: Update Response Format
- Include advanced fields when in advanced mode
- Group jobs by keyword

### Step 6: Test & Validate
- Test simple mode (backward compatibility)
- Test advanced mode (new functionality)
- Test error cases
- Test quota limits

---

## 9. RISK ASSESSMENT

### Low Risk Areas
✅ Backward compatibility maintained
✅ No database changes
✅ No auth/billing changes
✅ Pattern filtering is simple string matching
✅ Delay logic is straightforward

### Medium Risk Areas
⚠️ Multiple Google API calls (quota exposure)
   - Mitigation: User-controlled delays, warnings
   
⚠️ Queue overflow with large searches
   - Mitigation: Pre-calculation, queue backpressure

### Mitigations
- User confirmation for large searches (>200 jobs)
- Configurable delays between keywords
- Queue overflow detection
- Error recovery (continue on keyword errors)
- Rate limiting per user (existing)

---

## 10. SUCCESS CRITERIA

- [ ] Simple mode works unchanged (regression test)
- [ ] Advanced mode accepts all 6 new fields
- [ ] Multi-keyword search loops correctly
- [ ] Pattern filtering works
- [ ] Jobs grouped by keyword in response
- [ ] Backward compatibility maintained
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Rate limiting protects quota
- [ ] Error messages helpful

---

## SUMMARY

### Files to Change
1. `app/api/search/route.ts` (15-20 lines)
2. `lib/search/search-service.ts` (80-120 lines)
3. `lib/search/url-filter.ts` (20-30 lines)

### New Functionality
- Multi-keyword search looping
- Pattern-based email domain filtering
- Configurable per-keyword delays
- Results grouped by keyword

### Backward Compatibility
- ✅ 100% maintained
- ✅ Old API calls work unchanged
- ✅ No breaking changes
- ✅ Graceful field handling

### Quota Protection
- ✅ Per-keyword delays (user-configured)
- ✅ Pre-search job estimation
- ✅ Queue backpressure (max 1000)
- ✅ Error recovery (continue on errors)
- ✅ Existing Google API protections maintained

### Implementation Complexity
- **Low**: Straightforward business logic
- **Scope**: ~120-170 lines of new/modified code
- **Risk**: Low (backward compatible, well-isolated changes)
- **Time**: 2-3 hours implementation + 1 hour testing

---

**END OF PHASE 2 DIAGNOSIS**
