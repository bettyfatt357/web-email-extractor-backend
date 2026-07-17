# Phase 2 Complete Diagnosis - Business Discovery Search Engine

**Date**: July 16, 2026  
**Status**: Architecture & Design Complete - Ready for Implementation  
**Scope**: Full Business Discovery Workflow with Evidence Tracking  

---

## EXECUTIVE SUMMARY

Phase 2 transforms the simple "search → extract emails" system into a **complete business discovery search engine** similar to SerpDigger. The system captures not just emails, but comprehensive intelligence about:
- **Why** a page was discovered (matched keyword, pattern, location)
- **Where** it came from (search query, page title, snippet)
- **What** was found (company name, website, contact evidence)
- **How** it matched (pattern intelligence, evidence tracking)

### Key Architectural Changes
1. **Query Intelligence** - Multi-factor query generation (keyword + pattern + location + industry)
2. **Result Intelligence** - Track search query, keyword match, pattern match for each result
3. **Evidence Tracking** - Store exactly where each data point was discovered and why
4. **Data Model Expansion** - Comprehensive job/result schema with intelligence metadata
5. **Pattern Detection** - Detect relevant patterns inside crawled pages

---

## 1. CURRENT ARCHITECTURE SUMMARY

### Existing Pipeline
```
Google CSE Search
    ↓
Extract URLs
    ↓
Filter URLs (social media, repos, etc)
    ↓
Queue Extraction Jobs
    ↓
Worker Pool
    ↓
Page Crawling (jsdom + puppeteer)
    ↓
Email Extraction
    ↓
Store Results
```

### Current Data Captured
- URL
- Extracted emails
- Job status, retries, processing time
- Source query (optional)

### Current Job Type
```typescript
interface Job {
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];
  retries: number;
  createdAt: number;
  error: string | null;
  source?: string;
  query?: string;
}
```

### Existing Components
- **Google Client**: Multi-page search, retry logic, quota handling
- **URL Filter**: 65+ domain skip list, file type filtering
- **Query Enhancer**: Intent detection, query enrichment
- **Extraction Engine**: jsdom + puppeteer, email finding
- **Worker Pool**: Concurrent job processing with rate limiting
- **Queue**: Redis-based job queue with backpressure

---

## 2. PHASE 2 COMPLETE WORKFLOW

### User Input Expansion

**Previous**:
```
query: "hedge funds manhattan"
pages: 2
```

**New (Comprehensive)**:
```typescript
{
  // Search parameters
  keywords: ["hedge fund manager", "asset management"],        // Business types
  patterns: ["@company.com", "@startups.co"],                 // Email domain filters
  location: "Manhattan, New York",                            // Geographic context
  industry: "finance",                                         // Industry/category (optional)
  cseId: "google_cse_id_123",                                 // Specific CSE selection
  
  // Search behavior
  searchDepth: 2,                                              // Pages per keyword
  delayMs: 300,                                                // Rate limiting
  deepSearch: true,                                            // Enhanced crawling
  
  // Intelligence capture
  capturePageContent: true,                                    // Store full page info
  detectPatterns: ["contact", "about", "team"],               // Page section patterns
}
```

### Step 1: Query Generation (NEW)

For each keyword, generate optimized search query:

```
Input: 
  - Keyword: "hedge fund manager"
  - Location: "Manhattan, New York"
  - Patterns: ["@company.com"]
  - Industry: "finance"

Process:
  1. Parse location (extract city, state)
  2. Add industry context from intent detection
  3. Append pattern hints (if looking for contact emails)
  4. Combine with location
  
Output Queries:
  - "hedge fund manager manhattan new york contact"
  - "hedge fund manager manhattan site:company.com"
  - "hedge fund manager ny investment management"

Track: Each query generated is stored as "search_query_used"
```

### Step 2: Google PSE Execution (Enhanced)

Execute search with tracking:

```typescript
interface SearchResult {
  link: string;                    // URL found
  title: string;                   // Page title
  snippet: string;                 // Search snippet
  position: number;                // Rank in results (1-10)
  page: number;                    // Page number (1-N)
  searchQuery: string;             // The query that found this
  matchedKeyword: string;           // Which keyword triggered this result
  matchedPattern?: string;          // If pattern-based search
}
```

**Tracking**: 
- Store which search query produced each result
- Track matched keyword for each result
- Note if result came from pattern-based search

### Step 3: URL Filtering & Deduplication

```
Input: 20 URLs from search

Filter:
  1. Remove social media (linkedin.com, facebook.com, etc)
  2. Remove code repos (github.com, gitlab.com, etc)
  3. Remove search engines, forums
  4. Deduplicate (one per domain)

Output Metadata:
  - domain: "company.com"
  - sourceUrl: "https://company.com"
  - searchQuery: "hedge fund manager manhattan contact"
  - matchedKeyword: "hedge fund manager"
  - discoveredVia: "pattern_search" | "keyword_search"
```

### Step 4: Page Crawling & Evidence Collection (NEW)

Crawl each discovered page and collect intelligence:

```typescript
interface PageIntelligence {
  // Page metadata
  url: string;
  title: string;
  
  // Content analysis
  foundPatterns: {
    contact: boolean;              // Has contact page
    about: boolean;                // Has about page
    team: boolean;                 // Has team info
    services: boolean;             // Services description
    testimonials: boolean;          // Customer references
  };
  
  // Email evidence
  emails: string[];
  emailSources: {
    email: string;
    foundOn: string;              // Page URL where found
    pattern: string;              // HTML pattern that found it
    context: string;              // Surrounding text
  }[];
  
  // Company information (detected)
  companyName?: string;
  description?: string;
  foundPatterns: string[];        // e.g., ["contact page", "team section"]
  
  // Evidence tracking
  evidence: {
    keyword: string;              // "hedge fund manager"
    pattern: string;              // "@company.com"
    searchQuery: string;           // Full query used
    location: string;              // Geographic context
    why: string;                   // Human-readable reason: "Matched pattern on contact page"
  }
}
```

### Step 5: Pattern Intelligence (NEW)

Detect and track why page matched:

```
Example Page: https://blackrock.com/contact

Process:
  1. Check URL path contains "contact" → Pattern found: CONTACT_PAGE
  2. Extract page title "Contact Us | BlackRock" → Pattern: CONTACT_TITLE
  3. Scan page for phone/email → Pattern: CONTACT_INFO
  4. Check company name "BlackRock" → Matches knowledge base
  5. Extract emails: info@blackrock.com, careers@blackrock.com
  
Output Intelligence:
  {
    companyName: "BlackRock",
    website: "https://blackrock.com",
    contactPage: "https://blackrock.com/contact",
    emails: ["info@blackrock.com", "careers@blackrock.com"],
    patternsDetected: [
      "contact_page_url",
      "contact_in_title",
      "contact_form"
    ],
    matchedKeyword: "asset management",
    matchedPattern: "@company.com",
    searchQuery: "asset management firms contact",
    confidence: 0.95,
    evidence: {
      reason: "Contact page URL found for company in search results",
      sources: [
        "Found via pattern search on domain blackrock.com",
        "Contact page detected in URL path",
        "Emails extracted from contact form"
      ]
    }
  }
```

### Step 6: Comprehensive Result Storage

Each discovered company gets:

```typescript
interface DiscoveredBusiness {
  // Identity
  id: string;                           // Unique ID
  companyName: string;
  website: string;
  
  // Discovery metadata
  discoveredAt: number;                // Timestamp
  searchId: string;                    // Batch search ID
  sourceSearch: {
    keyword: string;                   // "hedge fund manager"
    pattern: string;                   // "@company.com" (if applicable)
    location: string;                  // "Manhattan"
    query: string;                     // Full query used
  };
  
  // Contact information
  emails: {
    email: string;
    sourceUrl: string;                 // Where found
    pattern: string;                   // How found (regex, form, etc)
    context: string;                   // Surrounding text
    confidence: number;                // 0.0 - 1.0
  }[];
  
  // Evidence & Intelligence
  evidence: {
    foundOnPages: string[];            // URLs where data found
    patterns: string[];                // Patterns detected
    reason: string;                    // Why matched
    confidence: number;
  };
  
  // Page Intelligence
  pages: {
    url: string;
    title: string;
    type: "homepage" | "contact" | "about" | "other";
    crawledAt: number;
    contentPreview: string;
  }[];
  
  // Job tracking
  jobStatus: {
    crawlStatus: "completed" | "failed" | "pending";
    extractionTime: number;            // ms
    lastUpdated: number;
  };
}
```

---

## 3. DATA MODEL CHANGES REQUIRED

### Job Type Extension

**Current** (`lib/queue/types.ts`):
```typescript
interface Job {
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];
  query?: string;
  source?: string;
}
```

**Enhanced** (Phase 2):
```typescript
interface Job {
  // Original fields
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];
  
  // Enhanced discovery fields (NEW)
  discoveryMetadata: {
    searchKeyword: string;           // "hedge fund manager"
    matchedPattern?: string;          // "@company.com"
    searchLocation?: string;          // "Manhattan"
    searchQuery: string;              // Full query used
    discoveryReason: string;          // Why this was discovered
  };
  
  // Page intelligence (NEW)
  pageIntelligence: {
    title: string;                   // Page title
    companyName?: string;            // Detected company
    patterns: {
      isContactPage: boolean;
      isAboutPage: boolean;
      hasEmailForm: boolean;
      hasTeamInfo: boolean;
    };
    evidence: {
      foundPatterns: string[];
      detectionMethod: string[];    // How patterns detected
    };
  };
  
  // Email evidence (NEW)
  emailEvidence: {
    email: string;
    sourceUrl: string;
    pattern: string;                // How detected
    context: string;                // Surrounding text
    confidence: number;
  }[];
  
  // Audit trail
  audit: {
    createdAt: number;
    crawledAt?: number;
    completedAt?: number;
    processingTime?: number;
  };
}
```

### Result Grouping

Results grouped by keyword in response:

```typescript
interface SearchResponse {
  // Existing fields
  searchId: string;
  totalQueued: number;
  jobIds: string[];
  
  // New intelligence grouping (Phase 2)
  searchMode: "advanced";
  resultsIntelligence: {
    totalBusinessesDiscovered: number;
    byKeyword: {
      [keyword: string]: {
        jobCount: number;
        jobIds: string[];
        businessesFound: number;
        emailsExtracted: number;
        confidence: number;
      };
    };
    byPattern: {
      [pattern: string]: {
        jobCount: number;
        matchCount: number;
      };
    };
    byLocation: {
      [location: string]: {
        jobCount: number;
        businessesFound: number;
      };
    };
  };
}
```

---

## 4. API PAYLOAD DESIGN

### Request Format (Comprehensive)

```typescript
POST /api/search

Request Body:
{
  // Search specification
  keywords: ["hedge fund manager", "asset management"],
  patterns: ["@company.com", "@startup.co"],
  location: "Manhattan, New York",
  industry?: "finance",                          // Optional
  cseId?: "custom_google_cse_id",                // Optional
  
  // Search behavior
  searchDepth?: 2,                               // Pages per keyword (1-5)
  delayMs?: 300,                                 // Rate limiting (100-2000)
  deepSearch?: true,                             // Enhanced crawling
  
  // Intelligence capture
  capturePageContent?: true,                     // Store page info
  detectPatterns?: ["contact", "about", "team"], // Patterns to detect
  
  // Legacy support
  query?: string,                                // For simple mode
  pages?: number,
}
```

### Response Format (Intelligence-Rich)

```typescript
{
  // Standard response
  searchId: string;
  totalQueued: number;
  jobIds: string[];
  
  // Discovery intelligence (NEW)
  searchMode: "advanced";
  discoveryIntelligence: {
    
    // Overall statistics
    totalBusinessesDiscovered: number;
    totalEmailsExtracted: number;
    averageConfidence: number;
    
    // By keyword breakdown
    byKeyword: {
      "hedge fund manager": {
        jobsCreated: 18,
        jobIds: ["job_1", "job_2", ...],
        businessesFound: 12,
        emailsExtracted: 24,
        averageConfidence: 0.92,
        topPatterns: ["contact_page", "about_page"]
      },
      "asset management": {
        jobsCreated: 15,
        jobIds: [...],
        businessesFound: 10,
        emailsExtracted: 19,
        averageConfidence: 0.88
      }
    },
    
    // By pattern matched
    byPattern: {
      "@company.com": {
        matchCount: 8,
        jobCount: 8
      },
      "@startup.co": {
        matchCount: 4,
        jobCount: 4
      }
    },
    
    // Geographic distribution
    byLocation: {
      "Manhattan": { jobCount: 20, businesses: 15 },
      "New York": { jobCount: 8, businesses: 6 }
    }
  },
  
  // Evidence summary
  evidenceSummary: {
    sourceQueries: [
      "hedge fund manager manhattan contact",
      "asset management ny site:company.com",
      "hedge fund manager new york finance"
    ],
    detectionMethods: [
      "contact_page_detection",
      "domain_pattern_match",
      "keyword_in_title"
    ],
    confidence: {
      high: 24,    // 0.8+
      medium: 12,  // 0.5-0.8
      low: 3       // <0.5
    }
  }
}
```

---

## 5. BACKEND IMPLEMENTATION ARCHITECTURE

### Files to Create (NEW)

#### 1. `lib/search/query-generator.ts` (NEW)
**Purpose**: Generate optimized search queries from user inputs

```typescript
interface QueryGenerationInput {
  keyword: string;
  location: string;
  patterns: string[];
  industry?: string;
  searchType: "keyword" | "pattern" | "location";
}

interface GeneratedQuery {
  query: string;                    // Final query string
  keyword: string;                  // Matched keyword
  location: string;                 // Geographic context
  method: "keyword" | "pattern";    // How generated
  expectedPatterns: string[];       // What to look for
}

export function generateSearchQueries(
  keywords: string[],
  location: string,
  patterns: string[],
  industry?: string
): GeneratedQuery[]
```

**Responsibilities**:
- Combine keyword + location intelligently
- Generate pattern-based queries (site:domain)
- Create variations to maximize coverage
- Track which query generated each result

#### 2. `lib/search/evidence-tracker.ts` (NEW)
**Purpose**: Track discovery evidence and match reasons

```typescript
interface DiscoveryEvidence {
  keyword: string;
  pattern?: string;
  location: string;
  searchQuery: string;
  searchPosition: number;
  pageTitle: string;
  reason: string[];              // Why this matched
  confidence: number;
}

export function trackDiscovery(
  result: SearchResult,
  keyword: string,
  pattern: string | undefined,
  location: string
): DiscoveryEvidence
```

**Responsibilities**:
- Record which query/keyword produced result
- Track pattern matches
- Calculate confidence score
- Generate human-readable reason

#### 3. `lib/search/pattern-detector.ts` (NEW)
**Purpose**: Detect patterns in crawled pages

```typescript
interface DetectedPattern {
  type: "contact" | "about" | "team" | "services" | "other";
  confidence: number;
  evidence: string[];            // How detected
  foundOn?: string[];            // URLs where found
}

export function detectPatterns(
  html: string,
  url: string,
  detectPatterns: string[]
): DetectedPattern[]
```

**Responsibilities**:
- Analyze HTML for contact pages
- Detect about/team/services sections
- Find contact forms, social links
- Confidence scoring per pattern

#### 4. `lib/search/company-intelligence.ts` (NEW)
**Purpose**: Extract company intelligence from pages

```typescript
interface CompanyIntelligence {
  companyName?: string;
  description?: string;
  emails: {
    email: string;
    sourceUrl: string;
    context: string;
    pattern: string;
  }[];
  detectedPatterns: string[];
  confidence: number;
  evidence: {
    keyword: string;
    searchQuery: string;
    location: string;
  };
}

export async function extractCompanyIntelligence(
  url: string,
  html: string,
  emailsExtracted: string[],
  context: DiscoveryContext
): Promise<CompanyIntelligence>
```

**Responsibilities**:
- Extract company name from page
- Link emails to source/context
- Compile intelligence evidence
- Calculate confidence

### Files to Modify

#### 1. `app/api/search/route.ts` (MODIFY)
**Changes**:
- Line 28-35: Extract new fields (keywords, patterns, location, industry, etc)
- Line 46-52: Detect advanced vs simple mode
- Line 55-70: Pass all metadata to search service
- Add new response formatting with intelligence

**Estimated changes**: 30-40 lines

#### 2. `lib/search/search-service.ts` (MODIFY)
**Changes**:
- Add new `performAdvancedDiscoverySearch()` function
- Create query generator from keywords/location/patterns
- Loop through generated queries
- Track discovery metadata for each result
- Group results by keyword and pattern

**Estimated changes**: 150-200 lines

#### 3. `lib/queue/types.ts` (MODIFY)
**Changes**:
- Extend Job interface with discovery metadata
- Add page intelligence fields
- Add email evidence tracking
- Add audit trail

**Estimated changes**: 40-50 lines

#### 4. `lib/extraction/engine.ts` (MODIFY)
**Changes**:
- Modify `extractEmails()` to return enhanced result with evidence
- Add pattern detection call
- Return email sources and context
- Track page title and metadata

**Estimated changes**: 20-30 lines

#### 5. `lib/worker/worker.ts` (MODIFY)
**Changes**:
- Store discovery metadata with results
- Call pattern detection
- Link email evidence
- Update job with intelligence

**Estimated changes**: 15-20 lines

#### 6. `lib/extraction/deobfuscate.ts` (MINOR)
**Changes**:
- Track pattern used to find each email
- Return context around email

**Estimated changes**: 10-15 lines

---

## 6. BACKWARD COMPATIBILITY PLAN

### 100% Backward Compatible Guarantee

#### Simple Mode Still Works
```json
{
  "query": "search term",
  "pages": 2
}
```
✅ Works exactly as before
✅ No breaking changes to response

#### New Fields Are Optional
```json
{
  "keywords": [...],        // Optional
  "patterns": [...],        // Optional
  "location": "...",        // Optional
  ...
}
```
✅ If not provided, defaults applied
✅ Old clients don't need updates

#### Response Format Extended (Not Changed)

**Simple mode response** (unchanged):
```json
{
  "searchId": "...",
  "totalQueued": 15,
  "jobIds": [...]
}
```

**Advanced mode response** (new fields added):
```json
{
  "searchId": "...",
  "totalQueued": 28,
  "jobIds": [...],
  "discoveryIntelligence": { ... }  // NEW - old clients ignore
}
```

✅ Old clients ignore unknown JSON fields
✅ Zero breaking changes

#### Job Type Extended (Not Changed)

**Old query for job** (still works):
```
GET /api/job/job_123
Returns: emails, status, createdAt
```

**New query for job** (enhanced):
```
GET /api/job/job_123
Returns: emails, status, + discovery metadata + intelligence
```

✅ Old fields still present
✅ New fields optional in response
✅ API versioning not needed

---

## 7. QUOTA & PERFORMANCE PROTECTION

### Query Multiplication Protection

**Problem**: Multiple keywords = multiple Google API calls

**Current**: 1 keyword = 1-5 Google searches (depending on pages)  
**Advanced**: N keywords = N × (1-5) Google searches

**Example**:
- 5 keywords × 2 pages = ~10 Google searches
- With pattern queries: ~15 Google searches total
- With 300ms delay = ~4.5 seconds total
- ~150 API quota units used

**Protection Mechanisms**:
1. **Pre-calculation Warning**: Estimate before executing
2. **User Confirmation**: Confirm if >200 jobs
3. **Rate Limiting**: Configurable delay between keywords
4. **Queue Backpressure**: Max 1000 queued jobs
5. **Error Recovery**: Continue if a keyword fails

### Page Crawling Protection

**Problem**: Crawling 50 pages could be slow/costly

**Current**: Crawl pages sequentially
**New**: Worker pool handles concurrency

**Protection**:
- Max 3 concurrent Puppeteer browsers (existing)
- 20 second timeout per page (existing)
- Rate limiting between jobs (existing)
- Fallback to jsdom if Puppeteer unavailable (existing)

### Storage Protection

**Metadata added per job**:
- ~2KB discovery metadata
- ~1KB email evidence per email
- ~500B page intelligence

**Example**: 500 jobs × 5 emails × 3.5KB = ~8.75 MB  
✅ Well within Redis capacity

---

## 8. WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│ User Input: Keywords, Patterns, Location, Industry              │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ Query Generation (NEW)                                           │
│  - Combine keyword + location + patterns                        │
│  - Generate multiple query variations                           │
│  - Create pattern-based searches (site:domain)                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ For Each Generated Query:                                        │
│  1. Google PSE Search (existing)                                │
│  2. Extract URLs (existing)                                     │
│  3. Filter URLs (existing)                                      │
│  4. Track Discovery Metadata (NEW)                              │
│     - Which query produced this?                                │
│     - Which keyword/pattern matched?                            │
│  5. Add to Queue with Evidence (NEW)                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ Worker Pool: Concurrent Job Processing                          │
│  1. Get Job from Queue                                          │
│  2. Crawl Page (jsdom + puppeteer) - existing                  │
│  3. Extract Emails (existing)                                  │
│  4. Detect Patterns (NEW)                                       │
│     - Is this a contact page?                                   │
│     - About page? Team page?                                    │
│  5. Extract Company Intelligence (NEW)                          │
│     - Company name, description                                 │
│     - Email evidence (where found, context)                    │
│  6. Store with Evidence (NEW)                                   │
│     - Why this matched                                          │
│     - Confidence score                                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│ Results: Complete Business Intelligence                         │
│  - Company name, website                                        │
│  - Emails with source/context                                  │
│  - Page intelligence (contact, about, etc)                     │
│  - Evidence: why matched, confidence                           │
│  - Grouped by keyword, pattern, location                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. IMPLEMENTATION CHECKLIST

### Phase 2A: Data Model & Intelligence Foundation
- [ ] Extend Job interface in `lib/queue/types.ts`
- [ ] Create `lib/search/query-generator.ts`
- [ ] Create `lib/search/evidence-tracker.ts`
- [ ] Create `lib/search/pattern-detector.ts`
- [ ] Create `lib/search/company-intelligence.ts`
- [ ] Test data structures (no runtime yet)

### Phase 2B: Backend Integration
- [ ] Modify `app/api/search/route.ts` for new request format
- [ ] Modify `lib/search/search-service.ts` for advanced discovery
- [ ] Modify `lib/extraction/engine.ts` to return evidence
- [ ] Modify `lib/worker/worker.ts` to track metadata
- [ ] Update response formatting with intelligence

### Phase 2C: Search Execution
- [ ] Implement query generation from keywords/location
- [ ] Test with real Google PSE
- [ ] Verify metadata tracking
- [ ] Test pattern detection on real pages
- [ ] Verify confidence scoring

### Phase 2D: Testing & Validation
- [ ] Regression test: simple mode still works
- [ ] Functional test: advanced mode discovers businesses
- [ ] Metadata test: evidence tracking complete
- [ ] Quota test: stays within limits
- [ ] Performance test: batch with 10+ keywords
- [ ] Error test: graceful failure handling

---

## 10. RISK ASSESSMENT

### Low Risk
✅ Data model extensions (additive, not breaking)  
✅ New files (isolated, no dependency changes)  
✅ Pattern detection (local page analysis, no external calls)  
✅ Evidence tracking (metadata, no business logic changes)  

### Medium Risk
⚠️ Query generation (needs testing with real Google CSE)  
⚠️ Multiple Google API calls (quota exposure)  
   - Mitigation: Pre-calculation, user confirmation, rate limiting

### Mitigations
- User confirmation for large searches
- Configurable delays between queries
- Error recovery (continue on failure)
- Comprehensive logging for debugging
- Backward compatibility maintained

---

## 11. SUCCESS CRITERIA

### Functional
- [ ] Simple mode works unchanged (regression)
- [ ] Advanced mode generates queries correctly
- [ ] Evidence tracking complete for each result
- [ ] Pattern detection working on sample pages
- [ ] Confidence scoring accurate
- [ ] Results grouped by keyword/pattern/location
- [ ] No data loss or corruption

### Quality
- [ ] 0 TypeScript errors
- [ ] Build succeeds
- [ ] Backward compatibility 100%
- [ ] All error cases handled
- [ ] Comprehensive logging
- [ ] Performance acceptable (no slowdowns)

### Testing
- [ ] Unit tests: query generation, pattern detection
- [ ] Integration tests: full advanced search flow
- [ ] Quota tests: doesn't exceed limits
- [ ] Page crawl tests: evidence extraction works
- [ ] Edge cases: empty results, errors, timeouts

---

## 12. FILES SUMMARY

### Files to Create (4 new)
1. `lib/search/query-generator.ts` - Query optimization
2. `lib/search/evidence-tracker.ts` - Discovery evidence
3. `lib/search/pattern-detector.ts` - Page pattern analysis
4. `lib/search/company-intelligence.ts` - Company data extraction

### Files to Modify (6 existing)
1. `app/api/search/route.ts` - New request/response format
2. `lib/search/search-service.ts` - Advanced discovery logic
3. `lib/queue/types.ts` - Extended Job interface
4. `lib/extraction/engine.ts` - Enhanced extraction
5. `lib/worker/worker.ts` - Metadata tracking
6. `lib/extraction/deobfuscate.ts` - Email evidence

### Files NOT Modified
✅ Google PSE client (works as-is)
✅ URL filtering (works as-is)
✅ Queue system (works as-is)
✅ Worker concurrency (works as-is)
✅ Rate limiting (works as-is)

---

## 13. IMPLEMENTATION SCOPE

**New Code**: ~600-800 lines
- Query generation: 150-200 lines
- Evidence tracking: 100-150 lines
- Pattern detection: 150-200 lines
- Company intelligence: 100-150 lines

**Modified Code**: ~150-200 lines
- Route handler: 30-40 lines
- Search service: 80-100 lines
- Queue types: 40-50 lines
- Extraction/worker: 20-30 lines

**Total**: ~800-1000 lines of new/modified code

**Complexity**: MEDIUM
- Straightforward business logic
- Well-isolated components
- No complex algorithms
- Good error handling

**Time Estimate**: 4-6 hours implementation + 2 hours testing

---

## SUMMARY: PHASE 2 BUSINESS DISCOVERY ENGINE

### What Phase 2 Delivers
- **Complete business discovery** with evidence tracking
- **Query intelligence** optimizing search coverage
- **Pattern detection** finding contact pages, about pages, etc
- **Company intelligence** extracting structured data
- **Confidence scoring** for each discovery
- **Evidence trail** showing why each business matched
- **Grouping & analytics** by keyword, pattern, location

### Architecture Changes
- 4 new intelligence modules
- Extended job data model
- Enhanced response with discovery intelligence
- Pattern detection in crawled pages
- Evidence tracking throughout

### Backward Compatibility
- ✅ 100% maintained
- ✅ Simple mode works unchanged
- ✅ New fields optional in requests
- ✅ New fields in responses (ignored by old clients)
- ✅ Zero breaking changes

### Quota Protection
- ✅ Pre-calculation before execution
- ✅ User confirmation for large searches
- ✅ Configurable delays between queries
- ✅ Error recovery (don't exit on failure)
- ✅ Rate limiting enforced

### Ready for Implementation?
**YES** - All architecture designed and documented.

**Next Step**: Await approval to begin Phase 2 implementation.

---

**END OF PHASE 2 COMPLETE DIAGNOSIS**
