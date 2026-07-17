# PHASE 2A TECHNICAL SPECIFICATION
## Discovery Intelligence Core – Complete Architecture Document

**Last Updated:** 2025-07-17  
**Status:** AWAITING IMPLEMENTATION  
**Scope:** Email Extraction Engine → Business Intelligence Extraction Engine  
**Timeline:** 3-4 weeks implementation  
**Team:** 1 FTE or 2 developers

---

## EXECUTIVE SUMMARY

Phase 2A transforms the extraction engine from **"What emails exist on this URL?"** to **"What business intelligence exists on this URL?"**

The Discovery Intelligence Engine will extend all existing pipeline components (queue, worker, search, API) to capture rich intelligence records instead of just email arrays.

**Key Principle:** Every change is an EXTENSION, not a replacement. API v1 remains 100% functional.

---

## PART 1: EXISTING PIPELINE AUDIT

### 1.1 Complete Execution Flow with File Locations

```
START: Dashboard Search Form
│
├─ FILE: app/dashboard/search/page.tsx (lines 87-144)
│  ├─ User submits search (simple or advanced mode)
│  ├─ State: query, pages OR keywords[], patterns[], location, searchDepth, delayMs
│  ├─ Validation: searchMode === 'simple' OR keywords.length > 0
│  └─ POST /api/dashboard/search with JSON payload
│
v
STEP 1: Dashboard Search API Entry
│
├─ FILE: app/api/dashboard/search/route.ts (lines 21-133)
│  ├─ Handler: handler() wrapped with withDashboardAuth middleware
│  ├─ Auth: Supabase session validation required
│  ├─ Input: { query, pages } OR { keywords[], patterns[], location, searchDepth, delayMs }
│  ├─ Validation: validateSearchRequest() OR validateAdvancedSearchRequest()
│  ├─ Decision logic (line 57):
│  │  if (keywords && Array.isArray(keywords) && keywords.length > 0)
│  │    → performAdvancedSearch()
│  │  else
│  │    → performSearch()
│  └─ Output: { searchId, totalQueued, jobIds[] }
│
v
STEP 2: Search Service (Simple Mode)
│
├─ FILE: lib/search/search-service.ts → performSearch() (lines 57-160)
│  ├─ Input: query (string), pages (1-5)
│  ├─ Process:
│  │  1. enhanceQuery(query) → lib/search/query-enhancer.ts
│  │     └─ Optimizes query for Google CSE
│  │
│  │  2. googleSearch(enhancedQuery, pages) → lib/search/google-client.ts
│  │     └─ Calls: https://www.googleapis.com/customsearch/v1
│  │        ├─ Parameters: q, cx, key, start
│  │        ├─ Returns: GoogleSearchResult[] (paginated)
│  │        └─ Rate limiting: 3 retries, exponential backoff on 429
│  │
│  │  3. extractUrlsFromResults(googleResults) → lib/search/url-utils.ts
│  │     └─ Parses each result.link field
│  │
│  │  4. filterUrls(urls) → lib/search/url-filter.ts
│  │     └─ Removes junk domains, duplicates
│  │
│  │  5. queue.addJob(url, 'google_pse', query) for each URL
│  │
│  └─ Output: { searchId, totalQueued, jobIds[] }
│
v
STEP 3: Search Service (Advanced Mode)
│
├─ FILE: lib/search/search-service.ts → performAdvancedSearch() (lines 229-400+)
│  ├─ Input: keywords[] (1-10), location?, patterns[] (0-10), searchDepth (1-5), delayMs (100-2000)
│  ├─ Loop: FOR EACH keyword (with delayMs between):
│  │  ├─ generateQueries(keyword, location, patterns) → lib/search/query-generator.ts
│  │  │  ├─ Creates 3-4 query variations per keyword
│  │  │  ├─ Uses location filter if provided
│  │  │  ├─ Uses patterns for site: filtering if provided
│  │  │  └─ Returns: { queries: string[] }
│  │  │
│  │  ├─ FOR EACH generated query:
│  │  │  ├─ enhanceQuery()
│  │  │  ├─ googleSearch(enhancedQuery, searchDepth)
│  │  │  ├─ extractUrlsFromResults()
│  │  │  ├─ filterUrls()
│  │  │  └─ Collect into keywordUrls Set
│  │  │
│  │  └─ Deduplicate within keyword
│  │
│  ├─ FOR EACH unique URL found:
│  │  ├─ normalizeUrl(url) → lib/search/url-normalization.ts
│  │  ├─ Check seenUrls Set (deduplicate across keywords)
│  │  ├─ queue.addJob(url, 'google_pse', keyword) ← STORES KEYWORD METADATA
│  │  └─ Collect jobIds[]
│  │
│  └─ Output: { searchId, totalQueued, jobIds[], jobsByKeyword{}, searchPreviews[] }
│
v
STEP 4: Google Custom Search Engine
│
├─ FILE: lib/search/google-client.ts → googleSearch() (lines 42-120)
│  ├─ Endpoint: https://www.googleapis.com/customsearch/v1
│  ├─ Auth: process.env.GOOGLE_API_KEY + process.env.GOOGLE_CX
│  ├─ Query Parameters:
│  │  ├─ q: enhanced query string
│  │  ├─ cx: custom search engine ID
│  │  ├─ key: API key
│  │  ├─ start: pagination (1, 11, 21, etc.)
│  │  └─ num: results per page (10)
│  ├─ Response: GoogleSearchResult[] with:
│  │  ├─ title
│  │  ├─ link (URL)
│  │  ├─ snippet (summary)
│  │  ├─ position (ranking)
│  │  └─ Other metadata
│  ├─ Error Handling:
│  │  ├─ 403 (quota exceeded) → throw
│  │  ├─ 429 (rate limit) → retry with exponential backoff
│  │  └─ Other errors → throw
│  └─ Output: Flattened results array
│
v
STEP 5: Queue System (Job Creation)
│
├─ FILE: lib/queue/queue.ts → addJob() (lines 75-120)
│  ├─ Input: url (string), source ('google_pse'), query (keyword)
│  ├─ Process:
│  │  ├─ normalizeUrl(url)
│  │  ├─ Check deduplication index: idx:url:${normalizedUrl}
│  │  │  └─ If exists, return early (skip)
│  │  ├─ Generate jobId (UUID v4)
│  │  ├─ Create Job object:
│  │  │  {
│  │  │    id: jobId,
│  │  │    url: originalUrl,
│  │  │    normalizedUrl: normalized,
│  │  │    domain: extracted domain,
│  │  │    source: 'google_pse',
│  │  │    query: keyword (from search),
│  │  │    status: 'pending',
│  │  │    emails: [],
│  │  │    retries: 0,
│  │  │    maxRetries: 3,
│  │  │    createdAt: Date.now(),
│  │  │    startedAt: null,
│  │  │    completedAt: null,
│  │  │    error: null,
│  │  │    attempts: 0
│  │  │  }
│  │  ├─ Store in Redis: SET job:${jobId} ${JSON.stringify(job)} EX 604800 (7 days)
│  │  ├─ Add to queue list: LPUSH queue:pending ${jobId}
│  │  ├─ Add to pending set: SADD jobs:pending ${jobId}
│  │  └─ Store dedup index: SET idx:url:${normalizedUrl} ${jobId} EX 604800
│  │
│  └─ Output: jobId (string)
│
v
STEP 6: Worker Processing (Background)
│
├─ FILE: lib/worker/worker.ts → startWorkerLoop() (lines 71-160)
│  ├─ Initialization:
│  │  ├─ WORKER_CONCURRENCY: 1-5 concurrent jobs (env var)
│  │  ├─ REQUEST_DELAY_MS: 200ms delay between jobs (env var)
│  │  ├─ JOB_TIMEOUT: 20 seconds per job
│  │  └─ Each loop runs independently
│  │
│  ├─ Main loop (runs continuously):
│  │  ├─ RPOP queue:pending → get next job
│  │  ├─ If empty, wait 1 second, loop
│  │  ├─ Apply rate limiting (REQUEST_DELAY_MS)
│  │  ├─ Call processJob(job)
│  │  │  ├─ Set job.status = 'processing'
│  │  │  ├─ Set job.startedAt = Date.now()
│  │  │  ├─ Update Redis: SET job:${jobId} ${JSON.stringify(job)}
│  │  │  ├─ Call extractEmailsFromUrl(url) ← EXTRACTION ENGINE
│  │  │  ├─ Receive: emails[] (array of found emails)
│  │  │  ├─ Set job.emails = emails
│  │  │  ├─ Set job.status = 'completed'
│  │  │  ├─ Set job.completedAt = Date.now()
│  │  │  ├─ Call queue.markCompleted(jobId, emails)
│  │  │  └─ On error: set job.status = 'failed', job.error = message
│  │  │
│  │  └─ Loop again
│  │
│  └─ OUTPUT: Modified job in Redis with emails[]
│
v
STEP 7: Extraction Engine
│
├─ FILE: lib/extraction/engine.ts → extractEmails() (lines 27-78)
│  ├─ Input: url (string)
│  ├─ Timeout: 20 seconds total
│  ├─ Process:
│  │  ├─ TRY: extractWithJsdom(url) [10 second timeout]
│  │  │  ├─ axios.get(url, { timeout: 8000, maxRedirects: 5, maxContentLength: 10MB })
│  │  │  ├─ JSDOM(html, { url })
│  │  │  ├─ Serialize to innerHTML
│  │  │  ├─ Call deobfuscateEmails(html) ← DEOBFUSCATION ENGINE
│  │  │  └─ Return { emails[], html, method: 'jsdom' }
│  │  │
│  │  └─ FALLBACK: extractWithPuppeteer(url) [remaining time < 20s]
│  │     ├─ puppeteer.launch()
│  │     ├─ browser.newPage()
│  │     ├─ page.goto(url, { waitUntil: 'networkidle2' })
│  │     ├─ Get full HTML
│  │     ├─ Call deobfuscateEmails(html)
│  │     ├─ browser.close()
│  │     └─ Return { emails[], html, method: 'puppeteer' }
│  │
│  ├─ Error handling:
│  │  ├─ Timeout → throw error
│  │  ├─ Network error → rethrow
│  │  └─ HTML parsing error → rethrow
│  │
│  └─ Output: emails[] (deduplicated, lowercase)
│
v
STEP 8: Deobfuscation Engine
│
├─ FILE: lib/extraction/deobfuscate.ts → deobfuscateEmails() (lines 1-120)
│  ├─ Input: text (HTML/plain text)
│  ├─ Process (10 methods):
│  │  1. Direct email regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
│  │  2. [at]/[dot] replacement: [at] → @, [dot] → .
│  │  3. HTML entities: &#64; → @, etc.
│  │  4. Base64 decoding: Detect + decode base64 encoded emails
│  │  5. mailto: links: mailto:user@example.com
│  │  6. Reversed strings: Detect + reverse
│  │  7. ROT13: Apply rot13() cipher
│  │  8. URL encoding: %40 → @
│  │  9. JSON structures: Extract from {"email": "..."} patterns
│  │  10. String concatenation: Detect partial strings combined
│  │
│  ├─ Deduplication:
│  │  └─ Set<string> to collect unique emails
│  │
│  └─ Output: emails[] (lowercase, deduplicated)
│
v
STEP 9: Result Storage
│
├─ FILE: lib/queue/queue.ts → markCompleted() (lines 221-280)
│  ├─ Input: jobId (string), emails[] (array)
│  ├─ Process:
│  │  ├─ GET job:${jobId} from Redis
│  │  ├─ Update:
│  │  │  ├─ job.emails = emails
│  │  │  ├─ job.emailsFound = emails.length
│  │  │  ├─ job.status = 'completed'
│  │  │  ├─ job.completedAt = Date.now()
│  │  │  ├─ job.processingTime = completedAt - startedAt
│  │  │  └─ job.error = null
│  │  ├─ SET job:${jobId} ${JSON.stringify(job)} EX 604800 (7 days)
│  │  ├─ SADD jobs:completed ${jobId}
│  │  ├─ SREM jobs:pending ${jobId}
│  │  └─ Update metrics: INCR metrics:completed, etc.
│  │
│  └─ OUTPUT: Job persisted in Redis with emails[]
│
v
STEP 10: Result Retrieval (API)
│
├─ FILE: app/api/job/[id]/result/route.ts (lines 1-70)
│  ├─ Endpoint: GET /api/job/{jobId}/result
│  ├─ Process:
│  │  ├─ GET job:${jobId} from Redis
│  │  ├─ If not found → 404
│  │  ├─ If status !== 'completed' → 202 (still processing)
│  │  ├─ If status === 'completed' → return:
│  │  │  {
│  │  │    id: jobId,
│  │  │    emails: job.emails,
│  │  │    totalEmails: job.emails.length
│  │  │  }
│  │  └─ If status === 'failed' → return error with 200
│  │
│  └─ OUTPUT: JobResultResponse
│
v
STEP 11: Dashboard Results Display
│
├─ FILE: app/dashboard/jobs/page.tsx (lines 40-160)
│  ├─ Component: Jobs page (client-side)
│  ├─ Fetches: GET /api/jobs-paginated?page=1&pageSize=10
│  ├─ Displays:
│  │  ├─ Job ID
│  │  ├─ URL
│  │  ├─ Status (pending/processing/completed/failed)
│  │  ├─ Emails found count
│  │  ├─ Created at timestamp
│  │  ├─ Error message (if failed)
│  │  └─ View details button (links to individual job)
│  │
│  └─ Refresh: Every 10 seconds (setInterval)

END: Dashboard displays results
```

### 1.2 Data Flow Summary

```
Dashboard Search Form
    ↓ POST /api/dashboard/search
Dashboard Search API (withDashboardAuth)
    ↓ Routes to performSearch() or performAdvancedSearch()
Search Service
    ↓ Generates queries via generateQueries()
Query Generator
    ↓ Passes to googleSearch()
Google CSE API
    ↓ Returns search results
Extract URLs → Filter URLs → Normalize
    ↓ FOR EACH URL: queue.addJob()
Queue (Redis)
    ↓ RPOP queue:pending
Worker Loop
    ↓ extractEmailsFromUrl()
Extraction Engine (JSDOM or Puppeteer)
    ↓ deobfuscateEmails()
Deobfuscation Engine (10 methods)
    ↓ emails[]
queue.markCompleted(jobId, emails)
    ↓ UPDATE job in Redis
Result Storage (Redis: job:${jobId})
    ↓ GET /api/job/{id}/result
Dashboard Results API
    ↓ Display in Jobs page
Dashboard UI
```

### 1.3 Key Metadata Entry Points

**Where new intelligence should enter the pipeline:**

1. **Queue Job Creation** (lib/search/search-service.ts, line 324)
   - Current: `queue.addJob(url, 'google_pse', keyword)`
   - NEW: Also pass: `googleResult` (full result from Google), `generatedQuery`, `matchedPattern`
   - Store as metadata in Job object

2. **Worker Processing** (lib/worker/worker.ts, processJob())
   - Current: Calls `extractEmailsFromUrl(url)` → returns `emails[]`
   - NEW: Extract more data during this phase
   - Source: Page HTML, URL, extracted structured data

3. **Extraction Engine** (lib/extraction/engine.ts)
   - Current: Returns `{ emails[], html, method }`
   - NEW: Return full `IntelligenceRecord` object (defined in Part 2)
   - Store metadata about extraction process

4. **Result Storage** (lib/queue/queue.ts, markCompleted())
   - Current: Updates job.emails = emails[]
   - NEW: Update job with full IntelligenceRecord
   - Store all intelligence fields

---

## PART 2: NEW IntelligenceRecord DATA MODEL

### 2.1 Complete TypeScript Interface (Domain Model)

```typescript
/**
 * IntelligenceRecord
 * 
 * Core domain model for business intelligence extraction.
 * Designed to be storage-agnostic (can live in Redis, PostgreSQL, Elasticsearch, CSV, etc.)
 * 
 * Purpose: Rich, structured data about a URL and the intelligence extracted from it
 */

// ============= COMPANY INFORMATION =============

interface CompanyInfo {
  // Extracted company name
  name: string;                           // "BlackRock Inc", "OpenAI", etc.
  
  // Confidence: how certain are we? 0-100
  confidence: number;                     // 0-100 (85 = 85% confident)
  
  // How we detected it
  detectionMethod: 
    | 'schema.org'                       // From structured data
    | 'opengraph'                        // From OG meta tags
    | 'json-ld'                          // From JSON-LD
    | 'title-tag'                        // Extracted from <title>
    | 'domain-parsing'                   // company.com → company
    | 'h1-tag'                           // From <h1> heading
    | 'manual';                          // User-provided
}

// ============= WEBSITE INFORMATION =============

interface WebsiteInfo {
  // The website URL that was analyzed
  url: string;                            // https://example.com
  
  // Page-specific metadata
  pageTitle?: string;                    // <title>About Us - Company Inc</title>
  pageDescription?: string;              // <meta name="description" ...>
  pageUrl?: string;                      // Full URL with path
  
  // Open Graph metadata (if available)
  ogTitle?: string;                      // <meta property="og:title" ...>
  ogDescription?: string;                // <meta property="og:description" ...>
  ogImage?: string;                      // <meta property="og:image" ...>
  ogType?: string;                       // "website", "article", etc.
  
  // Semantic information
  h1Text?: string;                       // First <h1> on page
  canonicalUrl?: string;                 // <link rel="canonical" ...>
  language?: string;                     // Detected language code
  encoding?: string;                     // Character encoding
  
  // Extraction context
  httpStatus?: number;                   // 200, 404, etc.
  isHttps?: boolean;                     // Security
  contentLength?: number;                // Bytes
  contentType?: string;                  // "text/html", etc.
  loadTimeMs?: number;                   // How long to fetch
}

// ============= SEARCH CONTEXT =============

interface SearchContext {
  // Where we found this URL
  googlePosition?: number;                // 1-10 (first position on results)
  googleResultPage?: number;              // 1-5 (which page of results)
  searchEngineId?: string;                // Which Google CSE (GOOGLE_CX)
  
  // What query generated this result
  generatedQuery: string;                 // "company name contact email"
  originalKeyword: string;                // "company name"
  location?: string;                      // Geographic filter
  matchedPattern?: string;                // Pattern that matched (if applicable)
  
  // Metadata
  searchId?: string;                      // Links to original search
  discoveryMethod: 'google_pse' | 'direct_input' | 'api' | 'other';
}

// ============= EMAIL CONTACT INFORMATION =============

interface EmailIntelligence {
  // The email address
  email: string;                          // info@example.com
  
  // Confidence this is real/valid
  confidence: number;                     // 0-100
  
  // Classification
  type?: 
    | 'general'                           // info@, hello@, support@
    | 'sales'                             // sales@, business@
    | 'hiring'                            // careers@, jobs@, hr@
    | 'technical'                         // tech@, dev@, api@
    | 'support'                           // support@, help@
    | 'billing'                           // billing@, accounts@
    | 'personal'                          // john.smith@
    | 'unknown';
  
  // How was it extracted?
  extractionMethod: 
    | 'mailto'                            // <a href="mailto:...">
    | 'text'                              // Plain text in page
    | 'json_ld'                           // Structured data
    | 'form_field'                        // Form action
    | 'api_endpoint'                      // API response
    | 'css_hidden'                        // Hidden in CSS
    | 'javascript'                        // Generated by JS
    | 'other';
  
  // Was it obfuscated?
  obfuscationMethod?: 
    | 'none'                              // Plaintext
    | 'html_entity'                       // &#64;
    | 'at_dot_replacement'               // user [at] domain [dot] com
    | 'base64'                            // aW5mb0B...
    | 'rot13'                             // rot13 encoded
    | 'url_encoded'                       // user%40domain.com
    | 'reversed'                          // moc.niamod@resu
    | 'other';
  
  // Evidence of finding
  evidence: EvidenceObject;
}

// ============= EVIDENCE TRACKING (Minimal Storage) =============

interface EvidenceObject {
  // Where on the page was this found?
  section?: 
    | 'header'                            // In <header>
    | 'footer'                            // In <footer>
    | 'main_content'                      // In <main> or <article>
    | 'sidebar'                           // In <aside>
    | 'navigation'                        // In <nav>
    | 'contact_page'                      // On /contact route
    | 'about_page'                        // On /about route
    | 'team_page'                         // On /team route
    | 'homepage'                          // On /
    | 'other';
  
  // DOM selector (optional, for precision)
  selector?: string;                      // "footer .contact-email" (short, not full path)
  
  // HTML tag
  tag?: string;                           // "a", "input", "span", etc.
  
  // CSS classes (first 3)
  classes?: string[];                     // ["contact-link", "email-address"]
  
  // Element ID
  elementId?: string;                     // "contact_email"
  
  // Character offset in page
  offset?: number;                        // Byte position in HTML
  
  // Short context snippet (50-200 chars, NOT full HTML)
  snippet?: string;                       // "Contact: info@company.com - Open 9am-5pm EST"
  
  // Why we're confident this is real
  matchReason?: string;                   // "matched keyword 'contact'"
  
  // Confidence based on evidence
  evidenceConfidence?: number;            // 0-100
}

// ============= QUALITY & RELIABILITY =============

interface QualityMetrics {
  // Email statistics
  totalEmails: number;                    // Total emails found
  highConfidenceEmails: number;           // Emails with >80% confidence
  uniqueDomains: number;                  // How many different domains
  
  // Page relevance to search
  pageRelevance?: number;                 // 0-100 (how relevant to search?)
  
  // Extraction reliability
  extractionReliability?: number;         // 0-100 (how trustworthy?)
  
  // Flags
  isHoneypot?: boolean;                   // Detected spam/honeypot? false = good
  hasFormEmails?: boolean;                // Found emails in forms?
  hasStructuredData?: boolean;            // Has schema.org/JSON-LD?
  
  // Risk indicators
  riskFlags?: string[];                   // ["domain_mismatch", "newly_registered"]
}

// ============= PROCESSING METADATA =============

interface ProcessingMetadata {
  // When was it processed?
  extractedAt: number;                    // Unix timestamp
  
  // How long did it take?
  processingTimeMs: number;               // Total time in milliseconds
  
  // What worker processed it?
  workerId?: string;                      // "worker-abc123"
  
  // What stage are we at?
  status: 
    | 'pending'                           // Queued, not started
    | 'processing'                        // Currently extracting
    | 'completed'                         // Done
    | 'failed'                            // Error
    | 'partial';                          // Some data but not complete
  
  // If failed, why?
  error?: {
    message: string;
    code?: string;
    retries?: number;
  };
  
  // Version tracking
  engineVersion: string;                  // "2.0.0" for future upgrades
  schemaVersion: number;                  // Schema version (1)
}

// ============= PRIMARY INTELLIGENCE RECORD =============

interface IntelligenceRecord {
  // IDENTIFIER
  id: string;                             // Job ID (UUID)
  
  // COMPANY INFORMATION
  company?: CompanyInfo;
  
  // WEBSITE INFORMATION
  website: WebsiteInfo;
  
  // SEARCH CONTEXT
  discovery: SearchContext;
  
  // CONTACT INFORMATION (NEW!)
  emails: EmailIntelligence[];            // Was: string[], now rich objects
  
  // FUTURE-READY (nullable, for extensibility)
  phones?: {                              // Future phase
    number: string;
    confidence: number;
    extractionMethod?: string;
    evidence?: EvidenceObject;
  }[];
  
  socialLinks?: {                         // Future phase
    platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram';
    url: string;
    confidence: number;
  }[];
  
  addresses?: {                           // Future phase
    address: string;
    confidence: number;
    type?: 'headquarters' | 'office' | 'billing';
  }[];
  
  // QUALITY & RELIABILITY
  quality: QualityMetrics;
  
  // PROCESSING METADATA
  processing: ProcessingMetadata;
}
```

### 2.2 Storage Concerns (Not Part of Domain Model)

These are INFRASTRUCTURE decisions, not domain model decisions:

```typescript
// REDIS STORAGE (current, Phase 2A)
{
  "key": "job:${jobId}",
  "value": JSON.stringify(IntelligenceRecord),
  "ttl": 604800 (7 days)
}

// FUTURE: PostgreSQL (Phase 3+)
// Same IntelligenceRecord object, different table schema
CREATE TABLE intelligence_records (
  id UUID PRIMARY KEY,
  company_name TEXT,
  company_confidence SMALLINT,
  website_url TEXT,
  emails JSONB,  -- Array of EmailIntelligence objects
  ...
)

// FUTURE: Elasticsearch (Phase 3+)
// Same IntelligenceRecord object, fulltext indexed
{
  "_id": "${jobId}",
  "_source": IntelligenceRecord
}

// FUTURE: CSV Export (Phase 4+)
// Flattened version of IntelligenceRecord
company,email,confidence,location,url,found_at
```

**Key Point:** The IntelligenceRecord domain model is STORAGE-AGNOSTIC. The same object can be stored in Redis, PostgreSQL, Elasticsearch, or exported to CSV without changing the model.

---

## PART 3: EVIDENCE OBJECT DESIGN

### 3.1 Design Principles

- **Minimal Storage:** Store only what's necessary, not full HTML
- **Traceability:** Know WHERE each email was found
- **Confidence:** Why do we believe it's real?
- **Extensibility:** Support future intelligence types

### 3.2 Evidence Object Structure

```typescript
interface EvidenceObject {
  // LOCATION ON PAGE (50 bytes total)
  section: string;                        // e.g. "footer" (tells WHERE)
  selector?: string;                      // e.g. "footer .contact" (short path)
  offset?: number;                        // Byte position (useful for large pages)
  
  // ELEMENT METADATA (30 bytes)
  tag?: string;                           // "a", "span", "input"
  elementId?: string;                     // Element ID attribute
  classes?: string[];                     // First 2-3 classes only
  
  // CONTEXT (200 bytes max)
  snippet?: string;                       // Short context: "Contact us: info@..."
                                          // NOT full HTML, just the surrounding text
  
  // WHY CONFIDENT (50 bytes)
  matchReason?: string;                   // "matched keyword 'support'"
  evidenceConfidence?: number;            // 0-100
}

// TOTAL: ~350 bytes per email
// Compare to storing full HTML: 50KB-1MB per email
// SAVINGS: 99.3% reduction in storage!
```

### 3.3 Examples

```typescript
// Example 1: Email in footer via mailto
{
  section: "footer",
  selector: "footer .contact-email",
  tag: "a",
  classes: ["contact-email"],
  snippet: "Contact us: info@company.com - Available 24/7",
  matchReason: "mailto link",
  evidenceConfidence: 100
}

// Example 2: Email in contact page form
{
  section: "contact_page",
  selector: "form[name='contact'] input[name='email']",
  tag: "input",
  elementId: "email-field",
  snippet: "Email field in contact form",
  matchReason: "form input field",
  evidenceConfidence: 95
}

// Example 3: Email in structured data
{
  section: "main_content",
  selector: "script[type='application/ld+json']",
  tag: "script",
  classes: ["structured-data"],
  snippet: '{"email": "support@company.com"} in JSON-LD',
  matchReason: "schema.org contactPoint",
  evidenceConfidence: 98
}

// Example 4: Email hidden in CSS (found by Puppeteer)
{
  section: "main_content",
  offset: 45230,
  tag: "span",
  classes: ["hidden-email"],
  snippet: "spam-protection: display:none;",
  matchReason: "detected in CSS hidden element",
  evidenceConfidence: 75
}
```

---

## PART 4: COMPANY DETECTION STRATEGY

### 4.1 Detection Hierarchy (Priority Order)

```
STAGE 1: Schema.org StructuredData (HIGHEST CONFIDENCE)
├─ Look for: <script type="application/ld+json">
├─ Extract: organizationName, name, legalName
├─ Confidence: 98% (if validated against page title/domain)
└─ Time: <50ms

STAGE 2: JSON-LD @type:Organization (HIGH CONFIDENCE)
├─ Look for: @type: "Organization"
├─ Extract: name, alternateName
├─ Confidence: 95%
└─ Time: <50ms

STAGE 3: OpenGraph Tags (HIGH CONFIDENCE)
├─ Look for: <meta property="og:site_name" ...>
├─ Extract: og:site_name, og:title
├─ Confidence: 90%
└─ Time: <20ms

STAGE 4: Title Tag Analysis (MEDIUM CONFIDENCE)
├─ Extract <title>: "About Company Inc | Home"
├─ Parse: Remove common suffixes (| Home, - Sign In, etc.)
├─ Confidence: 80-85%
└─ Time: <10ms

STAGE 5: H1 Tag Analysis (MEDIUM CONFIDENCE)
├─ Extract first <h1>
├─ Confidence: 75%
└─ Time: <10ms

STAGE 6: Domain Parsing (FALLBACK)
├─ Extract from URL: "company.com" → "Company"
├─ Apply title case
├─ Confidence: 60-70% (many domains are acronyms)
└─ Time: <5ms
```

### 4.2 Company Detection Algorithm

```typescript
function detectCompany(
  html: string,
  url: string,
  pageTitle?: string
): CompanyInfo | null {
  let companyName: string | null = null;
  let confidence: number = 0;
  let method: CompanyInfo['detectionMethod'] = 'domain-parsing';
  
  // STAGE 1: Schema.org
  const schemaOrg = extractSchema(html);
  if (schemaOrg?.organizationName) {
    companyName = schemaOrg.organizationName;
    confidence = validateAgainstPageTitle(companyName, pageTitle) ? 98 : 85;
    method = 'schema.org';
    return { name: companyName, confidence, detectionMethod: method };
  }
  
  // STAGE 2: JSON-LD
  const jsonLd = extractJsonLd(html);
  if (jsonLd?.['@type'] === 'Organization' && jsonLd?.name) {
    companyName = jsonLd.name;
    confidence = 95;
    method = 'json-ld';
    return { name: companyName, confidence, detectionMethod: method };
  }
  
  // STAGE 3: OpenGraph
  const ogSiteName = extractMetaTag(html, 'og:site_name');
  if (ogSiteName) {
    companyName = ogSiteName;
    confidence = 90;
    method = 'opengraph';
    return { name: companyName, confidence, detectionMethod: method };
  }
  
  // STAGE 4: Title Tag
  if (pageTitle) {
    const parsed = parsePageTitle(pageTitle);
    if (parsed) {
      companyName = parsed;
      confidence = 85;
      method = 'title-tag';
      return { name: companyName, confidence, detectionMethod: method };
    }
  }
  
  // STAGE 5: H1 Tag
  const h1 = extractH1(html);
  if (h1 && !looksLikeNavigation(h1)) {
    companyName = h1;
    confidence = 75;
    method = 'h1-tag';
    return { name: companyName, confidence, detectionMethod: method };
  }
  
  // STAGE 6: Domain parsing (fallback)
  const domain = extractDomain(url);
  if (domain) {
    companyName = titleCase(domain);
    confidence = 65;
    method = 'domain-parsing';
    return { name: companyName, confidence, detectionMethod: method };
  }
  
  return null;
}
```

### 4.3 Confidence Thresholds

```
Score   Status              Action
────────────────────────────────────
98-100  Enterprise Grade    ✅ Always use
90-97   High Quality        ✅ Always use
80-89   Good Quality        ✅ Use (may need verification)
70-79   Possible            ⚠️ Flag for review
60-69   Uncertain           ⚠️ Only use if no alternative
<60     Poor Quality        ❌ Skip
```

---

## PART 5: PATTERN ENGINE – 6-STAGE ARCHITECTURE

### 5.1 Pattern Matching Stages

```
STAGE 1: Google Query Generation (SEARCH INPUT)
│
├─ Input: keyword (string)
├─ Process:
│  ├─ generateQueries(keyword, location, patterns)
│  ├─ Apply patterns as site: filters
│  └─ Create multiple query variations
├─ Output: queries[]
└─ Purpose: Find URLs matching the pattern
   Example: "company contact" → "company contact site:example.com"

v
STAGE 2: Google Result Analysis (SEARCH RESULTS)
│
├─ Input: GoogleSearchResult[]
├─ Process:
│  ├─ Check result.snippet for keyword mentions
│  ├─ Check result.title for keyword mentions
│  └─ Rank by relevance
├─ Output: Ranked URLs
└─ Purpose: Filter results by relevance to keyword
   Example: "contact" in snippet = higher rank

v
STAGE 3: URL Pattern Validation (URL STRUCTURE)
│
├─ Input: URL string
├─ Patterns to validate:
│  ├─ /contact, /contact-us, /get-in-touch (contact pages)
│  ├─ /about, /about-us, /team (company info pages)
│  ├─ /careers, /jobs, /hiring (hiring pages)
│  ├─ /pricing, /plans (business pages)
│  └─ Custom user patterns
├─ Output: matched patterns[]
└─ Purpose: Identify URL type before crawling
   Example: URL ends in "/contact" → "contact_page"

v
STAGE 4: Metadata Validation (PAGE METADATA)
│
├─ Input: Page title, meta description, OG tags
├─ Process:
│  ├─ Check if keyword appears in page title
│  ├─ Check if keyword appears in meta description
│  ├─ Check page language/encoding
│  └─ Validate company name match
├─ Output: metadata_matches[]
└─ Purpose: Verify page is relevant BEFORE full extraction
   Example: Search for "HR", title contains "Careers" → match

v
STAGE 5: HTML Validation (CONTENT STRUCTURE)
│
├─ Input: Full HTML from crawled page
├─ Process:
│  ├─ Search for keyword in visible text
│  ├─ Check for contact forms
│  ├─ Check for email patterns
│  ├─ Validate content length > 100 bytes
│  └─ Skip if honeypot/spam detected
├─ Output: html_matches[]
└─ Purpose: Ensure page has relevant content
   Example: Page contains "contact form" → match

v
STAGE 6: Extracted Data Validation (FINAL CHECK)
│
├─ Input: IntelligenceRecord (extracted emails, company, etc.)
├─ Process:
│  ├─ Verify extracted emails match domain
│  ├─ Verify company name matches URL
│  ├─ Verify total emails within reasonable range
│  ├─ Check for spam patterns
│  └─ Calculate final confidence score
├─ Output: Validated IntelligenceRecord OR null
└─ Purpose: Quality gate before returning results
   Example: email domain doesn't match URL → reduce confidence
```

### 5.2 Pattern Validation Rules

```typescript
interface PatternValidationResult {
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  matched: boolean;
  matchedPatterns?: string[];
  confidence: number;          // 0-100
  reason?: string;
  shouldContinue: boolean;     // Stop processing or continue?
}

// EXAMPLE: User enters patterns: ["contact", "careers"]
// URL: https://example.com/contact

// Stage 3: URL Pattern Validation
{
  stage: 3,
  matched: true,
  matchedPatterns: ["contact"],
  confidence: 95,
  reason: "/contact in URL",
  shouldContinue: true
}

// Stage 5: HTML Validation
{
  stage: 5,
  matched: true,
  matchedPatterns: ["contact_form", "email_field"],
  confidence: 90,
  reason: "Contact form with email field found",
  shouldContinue: true
}

// Stage 6: Extracted Data Validation
{
  stage: 6,
  matched: true,
  matchedPatterns: ["domain_match", "email_valid"],
  confidence: 98,
  reason: "Email domain matches website domain",
  shouldContinue: true
}
```

---

## PART 6: DEOBFUSCATION ENGINE – COMPREHENSIVE METHOD LIST

### 6.1 All Supported Methods (24 Total)

#### TIER 1: BASIC (9 methods - existing)
1. **Direct Regex**
   - Pattern: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`
   - Time: <1ms
   - Accuracy: 100%

2. **[at]/[dot] Replacement**
   - Converts: `[at]` → `@`, `[dot]` → `.`
   - Variants: `(at)`, `(dot)`, `AT`, `DOT`
   - Time: <1ms
   - Accuracy: 100%

3. **HTML Entity Decoding**
   - Converts: `&#64;` → `@`, `&#46;` → `.`
   - Variants: Named entities like `&nbsp;`, `&quot;`
   - Time: <5ms
   - Accuracy: 100%

4. **Base64 Decoding**
   - Detects: `/[A-Za-z0-9+/]+={0,2}/g` (20+ chars)
   - Decodes and searches for email pattern
   - Time: <10ms per match
   - Accuracy: 90%

5. **Mailto Links**
   - Pattern: `mailto:(.+?)@(.+?)` or `<a href="mailto:...">`
   - Time: <1ms
   - Accuracy: 100%

6. **Reversed Strings**
   - Detects: Emails reversed in source
   - Method: Reverse text, search for emails, re-reverse
   - Time: <5ms
   - Accuracy: 95%

7. **ROT13 Cipher**
   - Converts: Each letter rotated 13 positions
   - Function: `rot13(text)`
   - Time: <5ms
   - Accuracy: 100%

8. **URL Encoding**
   - Converts: `%40` → `@`, `%2E` → `.`
   - Method: `decodeURIComponent()`
   - Time: <1ms
   - Accuracy: 100%

9. **JSON Structures**
   - Pattern: `{"email": "..."}` or `"email": "..."`
   - Regex: `/"(?:email|mail|contact)":\s*"([^"]+)"/gi`
   - Time: <5ms
   - Accuracy: 98%

#### TIER 2: INTERMEDIATE (5 methods - new in Phase 2A)

10. **Decimal HTML Entities**
    - Converts: `&#64;` → `@`
    - Uses: Character code mapping
    - Time: <5ms
    - Accuracy: 100%

11. **Hex HTML Entities**
    - Converts: `&#x40;` → `@`
    - Regex: `/&#x[0-9a-fA-F]+;/g`
    - Time: <5ms
    - Accuracy: 100%

12. **Named HTML Entities**
    - Converts: `&at;` (rare), custom entities
    - Dictionary lookup
    - Time: <3ms
    - Accuracy: 95%

13. **Unicode Escapes**
    - Converts: `\u0040` → `@`
    - JavaScript escape sequences
    - Time: <5ms
    - Accuracy: 100%

14. **String Concatenation**
    - Detects: `"user" + "@" + "domain.com"`
    - Concatenates parts to find emails
    - Time: <20ms
    - Accuracy: 85%

#### TIER 3: ADVANCED (4 methods)

15. **HTML Comments**
    - Searches: `<!-- email@domain.com -->`
    - Extracts from comment content
    - Time: <5ms
    - Accuracy: 100%

16. **CSS Hidden Elements**
    - Detects: `style="display:none"` or `class="hidden"`
    - Uses Puppeteer to evaluate CSS
    - Time: <100ms (requires Puppeteer)
    - Accuracy: 95%

17. **Data Attributes**
    - Searches: `data-email="..."`, `data-contact="..."`
    - Parses all data-* attributes
    - Time: <10ms
    - Accuracy: 95%

18. **Click Handler Emails**
    - Detects: `onclick="alert('email@domain.com')"`
    - Regex: `/onclick|onload|onmouseover/`
    - Time: <10ms
    - Accuracy: 80%

#### TIER 4: FRAMEWORK-SPECIFIC (4 methods)

19. **React/Vue/Angular Props**
    - Detects: `<Contact email="..." />`
    - Pattern: `[a-z]+Email?="\s*([^"]+)"`
    - Time: <10ms
    - Accuracy: 90%

20. **Next.js Hydration Data**
    - Searches: `__NEXT_DATA__` JSON object
    - Parses initial state
    - Time: <20ms
    - Accuracy: 95%

21. **JavaScript Inline Variables**
    - Detects: `var contactEmail = "..."`
    - Regex: `/(?:var|const|let)\s+\w*email\w*\s*=\s*['"](.*?)['"]`
    - Time: <10ms
    - Accuracy: 85%

22. **Shadow DOM Elements**
    - Uses: Puppeteer to pierce Shadow DOM
    - Extracts from Web Components
    - Time: <500ms
    - Accuracy: 95%

#### TIER 5: EDGE CASES (2 methods)

23. **Cloudflare Anti-Bot Obfuscation**
    - Detects: Cloudflare's email obfuscation
    - Method: Reverse Cloudflare's cipher
    - Time: <50ms
    - Accuracy: 100%

24. **Pixel Fonts / Image Emails**
    - Detects: Email as background image
    - Uses: OCR on Puppeteer screenshot
    - Time: <2000ms (requires OCR)
    - Accuracy: 60%
    - **NOTE:** Optional, expensive, Phase 2B+

### 6.2 Method Selection Strategy

```typescript
// Each extraction attempt:
const methods = [
  // Fast methods first (< 10ms each)
  directRegex,              // 1
  atDotReplacement,         // 2
  htmlEntityDecoding,       // 3
  mailtoLinks,              // 4
  urlEncoding,              // 5
  
  // Medium methods (< 100ms each)
  base64Decoding,           // 4
  rotThirteen,              // 7
  jsonStructures,           // 9
  decimalEntities,          // 10
  hexEntities,              // 11
  
  // Slower but valuable (< 500ms each)
  stringConcatenation,      // 14
  htmlComments,             // 15
  dataAttributes,           // 17
  clickHandlers,            // 18
  
  // Framework-specific (< 100ms each)
  reactProps,               // 19
  nextJsData,               // 20
  inlineVariables,          // 21
  
  // Very slow/expensive (Puppeteer required)
  cssHiddenElements,        // 16 (100ms)
  shadowDom,                // 22 (500ms)
  // pixelFonts             // 24 (2000ms) - optional
]

// Orchestrator applies in WAVES:
WAVE 1: JSDOM extraction (methods 1-12) <100ms total
WAVE 2: Additional regex (methods 13-18) <50ms more
WAVE 3: If no emails found and time allows:
        - Launch Puppeteer
        - Run methods 15, 16, 19-22
        - Max 10 seconds remaining
```

---

## PART 7: WORKER OUTPUT MIGRATION STRATEGY

### 7.1 Current Worker Output

```typescript
// CURRENT: processJob() calls extractEmailsFromUrl()
async function processJob(job: Job): Promise<void> {
  const emails: string[] = await extractEmailsFromUrl(job.url);
  
  job.emails = emails;                    // Array of email strings
  job.emailsFound = emails.length;        // Count
  job.status = 'completed';
  job.completedAt = Date.now();
  
  await queue.markCompleted(jobId, emails);
}

// Returns to job:
{
  id: "job-123",
  emails: ["info@example.com", "support@example.com"],
  emailsFound: 2,
  status: "completed",
  completedAt: 1721275200000
}
```

### 7.2 New Worker Output

```typescript
// NEW: processJob() calls extractIntelligence()
async function processJob(job: Job): Promise<void> {
  const intelligence: IntelligenceRecord = 
    await extractIntelligence(job.url, job.query);
  
  // Store full record
  job.intelligence = intelligence;        // Full object
  job.status = 'completed';
  job.completedAt = Date.now();
  
  await queue.markCompleted(jobId, intelligence);
}

// Returns to job:
{
  id: "job-123",
  intelligence: {
    company: { name: "Example Inc", confidence: 95 },
    website: { url: "https://example.com", pageTitle: "Home" },
    emails: [
      {
        email: "info@example.com",
        confidence: 98,
        type: "general",
        extractionMethod: "mailto",
        evidence: { section: "footer", snippet: "..." }
      }
    ],
    quality: { totalEmails: 2, highConfidenceEmails: 2 },
    processing: { extractedAt: 1721275200000, processingTimeMs: 8234 }
  },
  status: "completed",
  completedAt: 1721275200000
}
```

### 7.3 Migration Path (Backward Compatibility)

```typescript
// Phase 2A: Keep BOTH formats in Redis
// Job stores both old and new formats

async function markCompleted(jobId: string, intelligence: IntelligenceRecord) {
  const job: Job = {
    id: jobId,
    
    // OLD FORMAT (for API v1 compatibility)
    emails: intelligence.emails.map(e => e.email),
    emailsFound: intelligence.emails.length,
    
    // NEW FORMAT (for API v2)
    intelligence: intelligence,
    
    // Common fields
    status: 'completed',
    completedAt: Date.now(),
    processingTime: intelligence.processing.processingTimeMs
  };
  
  // Store in Redis as JSON
  SET job:${jobId} ${JSON.stringify(job)} EX 604800
}

// API v1 still works (extracts old fields)
GET /api/job/123/result → {
  id: "123",
  emails: ["info@example.com"],
  totalEmails: 1
}

// API v2 works (returns full intelligence)
GET /api/job/123/result/v2 → {
  company: { ... },
  emails: [ { email: "...", evidence: {...} } ],
  quality: { ... }
}
```

---

## PART 8: STORAGE STRATEGY

### 8.1 Redis Storage Estimates

```
Current model (Phase 1):
  Per job: ~500 bytes
  1M jobs: ~500 MB
  Cost: ~$10/month (Upstash)

Phase 2A model (10-20 emails per job):
  Per email: ~1-2 KB (includes evidence)
  Per job: 15-30 KB (10 emails × 1.5 KB)
  1M jobs: ~15-30 GB
  Cost: ~$100-200/month (Upstash Pro)

Key breakdown per job:
  ├─ Basic fields: 500 bytes
  ├─ Company info: 100 bytes
  ├─ Website metadata: 500 bytes
  ├─ 10 emails × 1.5 KB: 15 KB
  ├─ Evidence objects: 3.5 KB (350 bytes × 10)
  ├─ Processing metadata: 500 bytes
  └─ TOTAL: ~20 KB per job
```

### 8.2 Recommendations

**What stays in Redis:**
- ✅ Active jobs (current/processing) → Fast access
- ✅ Recent completions (7 days) → User queries
- ✅ Frequently accessed data → Hot path

**What should move to PostgreSQL (Phase 3+):**
- ⏭️ Completed jobs older than 7 days
- ⏭️ Full search history
- ⏭️ User analytics

**What should be cached (Phase 3+):**
- ⏭️ Company info (cache by domain → low miss rate)
- ⏭️ Common patterns (top 100 patterns)
- ⏭️ Frequently searched keywords

**What should expire/archive (Phase 4+):**
- ⏭️ Failed jobs after 30 days
- ⏭️ Extraction errors after 90 days
- ⏭️ Worker logs after 7 days

### 8.3 Cost Optimization Strategy

```
PHASE 2A: Accept higher Redis usage
├─ Use: Upstash Pro ($100-200/month)
├─ Benefits: Simplicity, speed, backward compatible
└─ Timeline: 3-4 weeks

PHASE 3: Implement PostgreSQL archiving
├─ Move: Jobs > 7 days old → PostgreSQL
├─ Result: Redis stays <10GB, PostgreSQL grows
├─ Cost: PostgreSQL cheaper than Redis ($50-100/month)
└─ Timeline: Following quarter

PHASE 4: Add caching layer
├─ Tool: Redis remains primary, add Elasticsearch
├─ Query: Complex searches faster
├─ Analytics: Better insights
└─ Cost: Minimal additional expense

FUTURE: Full data warehouse
├─ Tool: Snowflake, BigQuery, etc.
├─ Purpose: Enterprise analytics
├─ Timeline: Only if user base grows 10x
```

---

## PART 9: API VERSIONING STRATEGY

### 9.1 Endpoint Strategy

```
EXISTING (v1 - unchanged)
├─ GET /api/job/{id}/result
│  └─ Returns: { id, emails[], totalEmails }
│
├─ POST /api/dashboard/search
│  └─ Same as before
│
└─ All existing endpoints work exactly as-is

NEW (v2 - new endpoints, Phase 2A)
├─ GET /api/job/{id}/result/v2
│  └─ Returns: Full IntelligenceRecord
│
├─ POST /api/dashboard/search/v2
│  └─ Input: Same as v1
│  └─ Returns: { jobIds[], intelligence_preview }
│
└─ GET /api/job/{id}
   └─ Returns: Full job object with intelligence
```

### 9.2 Backward Compatibility Architecture

```typescript
// When returning a job, BOTH formats are available:

interface JobResponse {
  // Legacy format (API v1)
  id: string;
  emails: string[];                    // Just email strings
  totalEmails: number;
  status: string;
  
  // NEW format (API v2)
  intelligence?: IntelligenceRecord;   // Full object, optional
  apiVersion: '1' | '2';               // Client knows which format
}

// Smart response builder:
function buildJobResponse(job: Job, apiVersion: string = '1') {
  if (apiVersion === '2' || hasIntelligence(job)) {
    // Return v2 format
    return {
      id: job.id,
      emails: job.emails,              // Keep for compatibility
      totalEmails: job.emails.length,
      intelligence: job.intelligence,  // Add new field
      apiVersion: '2'
    };
  } else {
    // Return v1 format (default)
    return {
      id: job.id,
      emails: job.emails,
      totalEmails: job.emails.length,
      status: job.status,
      apiVersion: '1'
    };
  }
}
```

### 9.3 Migration Timeline for Clients

```
DAY 1-7: API v2 launches (feature flag)
├─ v1 still fully supported
├─ v2 available for new clients
└─ Logging to track adoption

WEEK 2-4: Migration period
├─ Notify existing clients: "v2 available"
├─ Document v2 API
├─ Provide migration guide

MONTH 2-3: Deprecation warning
├─ v1 works but returns deprecation header
├─ "v1 will be removed in 6 months"

MONTH 6: v1 removal
├─ Existing clients must migrate to v2
├─ v1 endpoints return 410 Gone
├─ Client gets clear error message

NOTE: v1 will work for at least 6 months. No rush.
```

---

## PART 10: DASHBOARD UI IMPACT

### 10.1 Existing Components (Reused)

```
✅ KEEP AS-IS (no changes needed):
├─ app/dashboard/search/page.tsx
│  └─ Search form works exactly the same
│
├─ app/dashboard/jobs/page.tsx
│  └─ Can show existing data
│  └─ Can extend to show new fields
│
├─ app/dashboard/layout.tsx
│  └─ Navigation unchanged
│
└─ All UI components
   └─ Can be extended but not required
```

### 10.2 New Components Required

```
NEW RESULT CARDS:
├─ CompanyCard
│  ├─ Displays: Company name, confidence, detection method
│  ├─ Confidence badge (color-coded)
│  └─ Source citation
│
├─ EnhancedEmailCard
│  ├─ Displays: Email + confidence
│  ├─ Shows: Where found (footer, contact page, etc.)
│  ├─ Evidence snippet
│  ├─ Extraction method
│  └─ Copy-to-clipboard button
│
├─ MetadataCard
│  ├─ Displays: Page title, description, OG tags
│  ├─ Shows: Schema.org status
│  └─ Links to page source
│
└─ QualityCard
   ├─ Shows: Overall quality score
   ├─ Breakdown: # high-confidence emails
   ├─ Page relevance score
   └─ Risk flags
```

### 10.3 New Filters

```
EXISTING FILTERS (keep):
├─ Status: pending, processing, completed, failed
└─ Date range

NEW FILTERS (add):
├─ Confidence: 80-100, 60-79, <60
├─ Company detected: yes/no
├─ Email count: 0, 1-5, 5+
├─ Extraction method: jsdom, puppeteer
├─ Risk flags: honeypot, newly_registered, etc.
└─ Page relevance: high, medium, low
```

### 10.4 New Export Options

```
EXISTING EXPORTS:
└─ Email list (CSV)

NEW EXPORTS:
├─ Full intelligence (JSON)
├─ Rich records (CSV with all fields)
├─ By company (grouped)
├─ By quality score
├─ With evidence (includes snippets)
└─ Parquet format (for data analysis)
```

---

## PART 11: TESTING PLAN

### 11.1 Unit Tests

```typescript
// lib/extraction/company-detector.test.ts
├─ detectCompany_schema_org()
├─ detectCompany_json_ld()
├─ detectCompany_opengraph()
├─ detectCompany_title_tag()
├─ detectCompany_domain_parsing()
└─ detectCompany_confidence_ranking()

// lib/extraction/pattern-validator.test.ts
├─ validateStage1_urlPattern()
├─ validateStage3_urlPath()
├─ validateStage4_metadata()
├─ validateStage5_htmlContent()
├─ validateStage6_extractedData()
└─ patternEngine_integrationTest()

// lib/extraction/deobfuscate-extended.test.ts
├─ test_decimalEntities()
├─ test_hexEntities()
├─ test_unicodeEscapes()
├─ test_stringConcatenation()
├─ test_dataAttributes()
├─ test_frameWorkProps_react()
├─ test_frameWorkProps_nextjs()
└─ test_allMethods_ensemble()

// lib/extraction/evidence-tracker.test.ts
├─ track_section()
├─ track_selector()
├─ track_snippet()
├─ evidence_storage_minimal()
└─ evidence_retrieval()
```

### 11.2 Integration Tests

```typescript
// tests/integration/extraction-flow.test.ts
├─ Full URL → IntelligenceRecord (JSDOM)
├─ Full URL → IntelligenceRecord (Puppeteer)
├─ Real website: blackrock.com
├─ Real website: stripe.com
├─ Real website: github.com
├─ Edge cases: Single-page app
├─ Edge cases: No contact info
└─ Edge cases: Heavy obfuscation

// tests/integration/worker-to-result.test.ts
├─ Queue job → Worker processes → Result stored
├─ Job status transitions: pending → processing → completed
├─ Error handling: timeout, network error
├─ Retry logic: maxRetries=3
└─ Concurrent processing: 3 workers in parallel
```

### 11.3 Worker Tests

```typescript
// tests/worker/extraction.test.ts
├─ Timeout handling (>20s)
├─ Puppeteer fallback trigger
├─ Concurrency: 1, 3, 5 concurrent jobs
├─ Rate limiting: 200ms delay enforced
├─ Memory leaks: Browser cleanup
└─ Error recovery: Watchdog restart
```

### 11.4 Google PSE Integration Tests

```typescript
// tests/integration/google-pse.test.ts
├─ Query execution: Returns results
├─ Pagination: 1-5 pages work
├─ Rate limiting: 429 handled with backoff
├─ Auth: GOOGLE_API_KEY + GOOGLE_CX loaded
├─ Error: 403 quota exceeded handled
└─ Performance: <2s per query
```

### 11.5 Performance Tests

```typescript
// tests/performance/extraction-speed.test.ts
├─ JSDOM extraction: <10s target
├─ Puppeteer extraction: <15s target
├─ Deobfuscation: <500ms target
├─ Company detection: <100ms target
├─ Pattern validation: <50ms target
└─ Full record: <20s target
```

### 11.6 Rollback Tests

```typescript
// tests/rollback/v1-compatibility.test.ts
├─ API v1 endpoints still return old format
├─ Old jobs still retrievable
├─ Search functionality unchanged
├─ Queue system unchanged
├─ Worker system unchanged
└─ No data loss on rollback
```

---

## PART 12: ROLLBACK PLAN

### 12.1 Rollback Triggers

**Automatic rollback if ANY of:**
- ❌ Worker crashes on 10+ consecutive jobs
- ❌ Redis memory > 100GB (unexpected growth)
- ❌ Job processing time > 30s average
- ❌ Error rate > 50% for 1 hour
- ❌ API v1 compatibility broken
- ❌ Data corruption detected

**Manual rollback if:**
- ❌ User reports critical bugs
- ❌ Search results quality degrades
- ❌ Performance unacceptable
- ❌ Security vulnerability

### 12.2 Exact Rollback Procedure

```
STEP 1: Stop production workers
├─ Kill all worker processes
├─ No new jobs are dequeued
└─ Existing jobs stay in queue

STEP 2: Revert code
├─ git revert Phase_2A_commits
├─ Redeploy v1 extraction engine
├─ API endpoints still serve

STEP 3: Verify v1 functionality
├─ Test: Can fetch old jobs
├─ Test: Results are correct
├─ Test: No data corrupted
└─ Check: Queue still intact

STEP 4: Resume workers
├─ Restart workers with v1 code
├─ Process pending jobs
└─ Monitor for errors

STEP 5: Analysis & Recovery
├─ Determine what failed
├─ Rollback jobs with errors
├─ Restore from backup if needed
└─ Plan v2 fix
```

### 12.3 What Won't Be Affected by Rollback

✅ **Dashboard Search** - Works exactly the same
✅ **API v1 Endpoints** - Continue to function
✅ **Queue System** - Untouched, continues working
✅ **Worker System** - Reverts to v1 version
✅ **Google PSE** - Untouched
✅ **Old Job Results** - Still queryable
✅ **User Auth** - Unchanged
✅ **Billing** - Unaffected
✅ **Redis Data** - v1 format compatible

### 12.4 Recovery Timeline

```
T+0m: Rollback trigger detected
T+5m: Decision made, code reverted
T+10m: v1 extraction engine deployed
T+15m: Workers restarted with v1
T+20m: Monitoring shows normal operations
T+1h: Root cause analysis begins
T+4h: v2 fix ready
T+6h: v2 redeployed with fix
```

### 12.5 Data Recovery (If Needed)

```
Scenario: Some Phase 2A jobs corrupted data

Recovery:
├─ Identify: Which job IDs failed
├─ Isolate: Mark jobs as 'needs_retry'
├─ Rollback: Remove Intelligence fields
├─ Extract: Re-run with v1 extraction
├─ Restore: Update with valid results

Timeline: <2 hours
Data loss: ZERO (v1 format preserved)
```

---

## SUMMARY: WHERE TO ENTER INTELLIGENCE DATA

### Phase 2A Integration Points

| Stage | File | Function | Current | New |
|-------|------|----------|---------|-----|
| 1 | search-service.ts | queue.addJob() | url, source, keyword | + googleResult, position |
| 2 | worker.ts | extractEmailsFromUrl() | returns emails[] | returns IntelligenceRecord |
| 3 | engine.ts | extractWithJsdom() | returns emails[] + html | returns IntelligenceRecord |
| 4 | deobfuscate.ts | deobfuscateEmails() | returns emails[] | returns EmailIntelligence[] |
| 5 | queue.ts | markCompleted() | stores job.emails | stores job.intelligence |
| 6 | api/result | GET /api/job/:id/result | returns emails[] | returns + full intelligence (v2) |
| 7 | dashboard/jobs | Jobs page | displays count | displays cards with details |

---

## CONSTRAINTS ENFORCED

✅ No modifications to existing code (design-only)  
✅ API v1 remains 100% functional  
✅ Queue/worker architecture unchanged  
✅ Google PSE integration unchanged  
✅ No breaking changes to search functionality  
✅ Storage-agnostic domain model  
✅ Clear rollback path  
✅ Backward compatibility maintained  

---

## CONCLUSION

This Phase 2A specification provides a complete blueprint for transforming the extraction engine into an intelligence extraction engine while preserving all existing functionality.

**Key Achievements:**
- ✅ Rich IntelligenceRecord domain model
- ✅ Evidence tracking with minimal storage
- ✅ 24+ deobfuscation methods
- ✅ 6-stage pattern validation
- ✅ 100% backward compatible
- ✅ Clear implementation path
- ✅ Comprehensive testing strategy
- ✅ Safe rollback procedures

**Ready for implementation approval.**
