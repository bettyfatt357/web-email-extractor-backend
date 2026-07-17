# PHASE 2 REFINED PLAN - Multi-Keyword Search with Result Tracking

**Status**: Refined Scope - Ready for Approval  
**Date**: July 16, 2026  
**Target**: 150-250 lines of new/modified code  

---

## SCOPE - WHAT'S INCLUDED

### 1. Query Generator (NEW MODULE)
**File**: `lib/search/query-generator.ts`  
**Purpose**: Combine keywords + location + patterns into optimized search queries

**Function**: `generateSearchQueries(keyword, location, patterns)`

**Algorithm**:
```typescript
inputs:
  keyword: "hedge fund manager"
  location: "Manhattan"
  patterns: ["@company.com"]

output:
  [
    "hedge fund manager manhattan",
    "hedge fund manager manhattan site:company.com",
    "hedge fund managers contact manhattan",
    "asset management manhattan contact"
  ]
```

**Implementation**: ~50 lines
- Combine keyword + location
- Inject domain patterns (site:domain.com)
- Generate 3-4 variations per keyword
- Return array of query strings

---

### 2. Multi-Keyword Search Loop
**File**: `lib/search/search-service.ts`  
**Modification**: New `performAdvancedSearch()` function

**Algorithm**:
```
FOR each keyword:
  1. Generate queries (using query-generator)
  2. Execute each query through Google PSE
  3. Collect results with metadata
  4. Apply delay before next keyword
  5. Track which keyword produced results
  
Return: Results grouped by keyword
```

**Implementation**: ~100 lines
- Loop through keywords
- Execute each query
- Collect search results
- Apply configurable delay
- Group by keyword

---

### 3. Search Result Tracking
**Purpose**: Return WHAT was found in search results (required for Phase 3 UI)

**Track Per Result**:
```typescript
{
  url: string,
  title: string,
  snippet: string,
  position: number,        // Position in search results
  keyword: string,         // Which keyword found it
  query: string,          // Which query generated it
  pageNumber: number      // Which page of results
}
```

**Implementation**: ~30 lines
- Capture from Google API response
- Store in results object
- Return in API response

---

### 4. API Response Enhancement
**File**: `app/api/search/route.ts`  
**Change**: Add `searchResultsPreview` field

**Old Response** (unchanged):
```json
{
  query: "combined query",
  searchId: "search_abc123",
  totalQueued: 28,
  jobIds: ["job_1", "job_2", ...]
}
```

**New Response** (backward compatible):
```json
{
  query: "combined query",
  searchId: "search_abc123",
  searchMode: "advanced",
  totalQueued: 28,
  jobIds: ["job_1", "job_2", ...],
  
  searchResultsPreview: [
    {
      keyword: "hedge fund manager",
      resultsFound: 47,
      topResults: [
        {
          url: "https://company.com",
          title: "Company - Asset Management",
          snippet: "Leading investment firm...",
          position: 1
        },
        ...
      ]
    }
  ]
}
```

**Implementation**: ~20 lines
- Build preview from search results
- Include top 3-5 results per keyword
- Return in response

---

## EXACT FILES TO MODIFY

### NEW FILE (1)
**`lib/search/query-generator.ts`** - ~50 lines
```typescript
export function generateSearchQueries(
  keyword: string,
  location?: string,
  patterns?: string[]
): string[]
```

Functions:
- `generateSearchQueries()` - Main function
- `injectPatterns()` - Add site: commands
- `createVariations()` - Generate alternatives

---

### MODIFIED FILES (3)

#### 1. `app/api/search/route.ts` (~20 lines)
Changes:
- Line 46: Pass new fields to search function
- Line 60-70: NEW: Build searchResultsPreview
- Line 75: Include in response

```typescript
// Extract new fields from request
const { keywords, patterns, location, searchDepth, delayMs } = req;

// Route to appropriate function
const result = keywords 
  ? await performAdvancedSearch(keywords, patterns, location, searchDepth, delayMs)
  : await performSearch(query, pages);

// Build preview (NEW)
const searchResultsPreview = buildSearchResultsPreview(result.searchResults);

// Response (NEW field)
return {
  ...result,
  searchMode: keywords ? "advanced" : "simple",
  searchResultsPreview
};
```

---

#### 2. `lib/search/search-service.ts` (~100 lines)
Changes:
- Add new request interface with advanced fields
- Import queryGenerator
- NEW: `performAdvancedSearch()` function
- NEW: `buildSearchResultsPreview()` helper

```typescript
// NEW interface
interface AdvancedSearchRequest {
  keywords: string[];
  patterns?: string[];
  location?: string;
  searchDepth?: number;
  delayMs?: number;
}

// NEW function
export async function performAdvancedSearch(
  keywords: string[],
  patterns?: string[],
  location?: string,
  searchDepth: number = 1,
  delayMs: number = 200
): Promise<SearchResult> {
  
  const searchResults = [];
  const jobIds = [];
  const allUrls = new Set<string>();
  
  for (const keyword of keywords) {
    // Generate queries
    const queries = generateSearchQueries(keyword, location, patterns);
    
    // Execute each query
    for (const query of queries) {
      const results = await googleSearch(query, searchDepth);
      
      // Track results
      for (const result of results) {
        searchResults.push({
          keyword,
          query,
          url: result.link,
          title: result.title,
          snippet: result.snippet,
          position: results.indexOf(result) + 1
        });
      }
    }
    
    // Delay before next keyword
    await sleep(delayMs);
  }
  
  // De-duplicate URLs
  const urlsToQueue = [...new Set(allUrls)];
  
  // Add to queue
  const queueResult = await queue.addJobs(urlsToQueue, {
    source: 'google_pse',
    keywords: keywords.join(','),
    searchMode: 'advanced'
  });
  
  return {
    searchId: generateSearchId(),
    query: keywords.join(' '),
    totalQueued: queueResult.count,
    jobIds: queueResult.jobIds,
    searchResults // NEW - for preview
  };
}

// NEW helper
function buildSearchResultsPreview(searchResults: SearchResult[]): GroupedResults[] {
  const grouped = new Map<string, SearchResult[]>();
  
  for (const result of searchResults) {
    if (!grouped.has(result.keyword)) {
      grouped.set(result.keyword, []);
    }
    grouped.get(result.keyword)!.push(result);
  }
  
  return Array.from(grouped.entries()).map(([keyword, results]) => ({
    keyword,
    resultsFound: results.length,
    topResults: results.slice(0, 5) // Top 5 per keyword
  }));
}
```

---

#### 3. `lib/search/url-filter.ts` (~10 lines)
Changes:
- Add optional `extractMetadata` parameter to return position/title/snippet

```typescript
export function filterUrls(
  results: GoogleResult[],
  extractMetadata?: boolean
): FilteredUrl[] {
  // ... existing filter logic ...
  
  return results
    .map(r => ({
      url: new URL(r.link).hostname,
      original: r.link,
      title: extractMetadata ? r.title : undefined,
      snippet: extractMetadata ? r.snippet : undefined,
      position: extractMetadata ? results.indexOf(r) + 1 : undefined
    }))
    .filter(url => !shouldSkipDomain(url.url));
}
```

---

## DATA STRUCTURES

### Search Result with Metadata
```typescript
interface SearchResult {
  keyword: string;
  query: string;
  url: string;
  title: string;
  snippet: string;
  position: number;
  pageNumber?: number;
}
```

### Grouped Search Results
```typescript
interface GroupedResults {
  keyword: string;
  resultsFound: number;
  topResults: SearchResult[]; // Top 5 per keyword
}
```

### Enhanced Job Info (in queue)
```typescript
// Optional metadata in job
{
  keyword?: string;      // Which keyword matched
  query?: string;        // Which query found it
  searchMode?: string;   // 'simple' | 'advanced'
}
```

---

## API CHANGES

### Request Format
```json
{
  // Old (still works)
  "query": "search term",
  "pages": 2,
  
  // New (advanced mode)
  "keywords": ["keyword1", "keyword2"],
  "patterns": ["@company.com"],
  "location": "Manhattan",
  "searchDepth": 2,
  "delayMs": 300
}
```

### Response Format
```json
{
  // Always present
  "searchId": "search_abc123",
  "totalQueued": 28,
  "jobIds": ["job_1", "job_2", ...],
  
  // NEW: Only in advanced mode
  "searchMode": "advanced",
  "searchResultsPreview": [
    {
      "keyword": "hedge fund manager",
      "resultsFound": 47,
      "topResults": [
        {
          "url": "https://company1.com",
          "title": "Company 1",
          "snippet": "...",
          "position": 1
        }
      ]
    }
  ]
}
```

---

## BACKWARD COMPATIBILITY

✓ **100% Maintained**

Old API calls:
```json
{ "query": "search", "pages": 2 }
```
- Works unchanged
- Returns same response as before
- No new fields for simple mode

New fields optional:
```json
{ "keywords": [...] }
```
- If not provided, uses defaults
- Old clients don't need changes

Response extended (not changed):
- `searchResultsPreview` only in advanced mode
- Old clients ignore unknown JSON fields
- Zero breaking changes

---

## QUOTA PROTECTION

**No Change Needed** - Existing protections sufficient:
- ✓ Google API timeout (10 seconds)
- ✓ Exponential backoff retry
- ✓ Rate limiting per user
- ✓ Queue backpressure (max 1000 jobs)

**New Protection**:
- ✓ Configurable delay between keywords (default 200ms)
- ✓ User confirmation for large searches (>200 jobs) - already in UI

---

## NOT INCLUDED (DEFERRED)

✗ Page crawling (puppeteer/jsdom)  
✗ Company intelligence extraction  
✗ Confidence scoring  
✗ Evidence tracking system  
✗ Worker/extraction modifications  
✗ Full business intelligence engine  

**These are Phase 3+ work**

---

## IMPLEMENTATION CHECKLIST

- [ ] Create `lib/search/query-generator.ts` (~50 lines)
- [ ] Add `performAdvancedSearch()` to search-service.ts (~60 lines)
- [ ] Add `buildSearchResultsPreview()` helper (~30 lines)
- [ ] Update `app/api/search/route.ts` (~20 lines)
- [ ] Enhance `lib/search/url-filter.ts` (~10 lines)
- [ ] Validate backward compatibility
- [ ] Test simple mode (no changes)
- [ ] Test advanced mode (new functionality)
- [ ] Verify TypeScript (0 errors)
- [ ] Build succeeds

---

## SUCCESS CRITERIA

**Functional**:
- ✓ Simple mode works unchanged
- ✓ Advanced mode loops through keywords
- ✓ Delays applied between keywords
- ✓ Search results tracked correctly
- ✓ Results grouped by keyword
- ✓ Preview included in response

**Quality**:
- ✓ 0 TypeScript errors
- ✓ Build succeeds
- ✓ Backward compatible
- ✓ No queue/worker changes
- ✓ <250 lines total code

**Testing**:
- ✓ Test simple mode (regression)
- ✓ Test advanced mode (new)
- ✓ Test result tracking
- ✓ Test grouping
- ✓ Test backward compatibility

---

## TIMELINE

**Implementation**: 2-3 hours
- Create query-generator: 30 min
- Create advanced search: 60 min
- Update route: 30 min
- Testing: 30 min

---

## RISK ASSESSMENT

**Overall Risk**: LOW ✓

- ✓ Backward compatible
- ✓ No breaking changes
- ✓ Additive only
- ✓ No queue/worker changes
- ✓ Well-isolated code
- ✓ Comprehensive error handling

---

## WHAT THIS ENABLES FOR PHASE 3

Phase 3 will use `searchResultsPreview` to:
- Show user what was found in search
- Display top results per keyword
- Let user preview before job completion
- Build analytics dashboard
- Show search effectiveness

---

## APPROVAL QUESTIONS

1. ✓ Approve query generator approach (combine keyword + location + patterns)?
2. ✓ Approve multi-keyword loop with configurable delays?
3. ✓ Approve search result tracking (URL, title, snippet, position)?
4. ✓ Approve new response field `searchResultsPreview`?
5. ✓ Approve 150-250 lines scope?
6. ✓ Approve no changes to queue/worker/extraction?
7. ✓ Approve backward compatibility maintained?
8. ✓ Ready to proceed with Phase 2 implementation?

---

## SUMMARY

**Phase 2 will add**:
- Multi-keyword search loop
- Query generation with pattern injection
- Search result tracking
- Preview of results in API response

**Phase 2 will NOT change**:
- Queue system
- Worker pool
- Extraction engine
- Page crawling
- Company intelligence

**Result**: Small, focused, safe implementation (~200 lines)  
**Enables**: Phase 3 UI showing what was found  
**Maintains**: 100% backward compatibility  

---

**AWAITING APPROVAL TO PROCEED**
