# Intelligence Extraction Engine - Revised Implementation Plan

**Date:** July 17, 2026  
**Status:** Ready for Approval  
**Timeline:** 3-4 weeks (revised from 5-6 weeks)  
**Strategy:** EXTEND existing architecture, DO NOT REWRITE

---

## Executive Summary

The current extraction engine is **already working**. We will extend it incrementally to add intelligence capabilities (company detection, confidence scoring, evidence tracking, enhanced deobfuscation).

Key principle: **Preserve all existing functionality. Add new capabilities on top.**

---

## What We're NOT Changing

✅ **Queue System** - Works perfectly, keep as-is  
✅ **Authentication** - Keep as-is  
✅ **Google PSE Integration** - Keep as-is  
✅ **Worker Architecture** - Keep as-is  
✅ **Dashboard UI** - Keep as-is (will enhance to display new fields)

---

## What We're Extending

### 1. Deobfuscation Engine
**Current State:** 10 methods working  
**Extension:** Add 14+ new methods without breaking existing ones

**New Methods to Add:**
- `deobfuscateMailto()` - mailto: links (extract email)
- `deobfuscateHTMLEntities()` - &#169; style entities
- `deobfuscateDecimalEntities()` - &#64; decimal codes
- `deobfuscateHexEntities()` - &#x40; hex codes
- `deobfuscateROT13()` - ROT13 encoding
- `deobfuscateStringConcat()` - "email" + "@" + "domain.com"
- `deobfuscateStringReverse()` - String.reverse() patterns
- `deobfuscateBase64()` - Base64 encoded strings
- `deobfuscateCloudflare()` - Cloudflare email protection (parsing)
- `deobfuscateUnicode()` - Unicode escapes \u0040
- `deobfuscateCSS()` - CSS hidden text display
- `deobfuscateDataAttributes()` - data-email attributes
- `deobfuscateJSONData()` - Email in JSON structures
- `deobfuscateNextJSData()` - NEXT_DATA hydration
- `deobfuscateReactHydration()` - React.__INIT hydration
- `deobfuscateVueHydration()` - Vue hydration data
- `deobfuscateAngularState()` - Angular $injector state
- `deobfuscateWindowVars()` - window.userEmail = "..."

**Implementation Pattern:**
```typescript
// Each deobfuscation method is independent
// Add to deobfuscate.ts as new exported functions
// Call each in order with email regex validation
// Track which method succeeded (for evidence)

export function deobfuscateMailto(text: string): DeobfuscatedEmail[] {
  // Parse mailto: links
  // Return { email, method: 'mailto', confidence: 95 }
}

export function deobfuscateCloudflare(text: string): DeobfuscatedEmail[] {
  // Parse Cloudflare protection patterns
  // Return { email, method: 'cloudflare', confidence: 90 }
}
```

### 2. Email Result Schema
**Current State:** `emails: string[]`  
**Extension:** Add metadata per email

**Current Result:**
```json
{
  "id": "job-123",
  "emails": ["user@example.com"],
  "status": "completed"
}
```

**Extended Result:**
```json
{
  "id": "job-123",
  "emails": [
    {
      "email": "user@example.com",
      "confidence": 98,
      "type": "general",
      "method": "mailto",
      "obfuscation": "none",
      "foundIn": "Contact Section",
      "evidence": "Found in <a href=\"mailto:user@example.com\">Contact</a>",
      "timestamp": "2026-07-17T08:32:18Z"
    }
  ],
  "company": {
    "name": "Acme Corp",
    "confidence": 92,
    "source": "domain"
  },
  "pageTitle": "Acme Corp - Contact Us",
  "pageDescription": "Get in touch with our sales team",
  "quality": {
    "totalEmails": 1,
    "highConfidence": 1,
    "pageRelevance": 95
  }
}
```

**Backward Compatibility:**
- Old results kept as flat `emails: string[]`
- New results use `emails: ExtractedEmail[]`
- API returns both for compatibility during transition

### 3. Extraction Engine Extensions
**Current State:** JSDOM + Puppeteer extraction  
**Extension:** Add metadata capture

**Changes to `engine.ts`:**
- Add `capturePageTitle()` method
- Add `capturePageDescription()` method  
- Add `captureOpenGraphData()` method
- Add `captureMetaData()` method
- Return extended `ExtractionResult` with metadata

```typescript
interface ExtractionResult {
  emails: string[];  // Keep existing
  html?: string;     // Keep existing
  method: 'jsdom' | 'puppeteer';  // Keep existing
  // NEW FIELDS:
  pageTitle?: string;
  pageDescription?: string;
  ogImage?: string;
  ogTitle?: string;
  allMetadata?: Record<string, string>;
}
```

### 4. Evidence Tracking Module
**New Module:** `lib/extraction/evidence-tracker.ts`

**Purpose:** Track WHERE each email was found on the page

```typescript
export interface EmailEvidence {
  email: string;
  section: string; // 'header', 'footer', 'contact_form', 'about_page', etc.
  context: string; // Text around the email
  lineNumber?: number;
  confidence: number; // 0-100
}

export class EvidenceTracker {
  findEmailLocation(email: string, html: string, dom: Document): EmailEvidence {
    // Find which section contains email
    // Return { email, section, context, confidence }
  }
  
  getSectionName(element: Element): string {
    // Identify section type: contact, footer, header, etc.
  }
  
  getContext(email: string, element: Element): string {
    // Get text context around email
  }
}
```

### 5. Company Detection Module
**New Module:** `lib/extraction/company-detector.ts`

**Purpose:** Auto-detect company name from URL & metadata

```typescript
export interface CompanyInfo {
  name: string;
  domain: string;
  confidence: number; // 0-100
  source: 'domain' | 'title' | 'og_tags' | 'metadata';
}

export class CompanyDetector {
  detectCompany(url: string, metadata: PageMetadata): CompanyInfo {
    // Extract from: domain, page title, OG tags, metadata
    // Return { name, domain, confidence, source }
  }
  
  cleanCompanyName(text: string): string {
    // "Acme Corp Inc" -> "Acme Corp"
  }
  
  normalizeCompanyName(name1: string, name2: string): boolean {
    // Fuzzy match: "ACME CORPORATION" == "Acme Corp"?
  }
}
```

### 6. Confidence Scoring Module
**New Module:** `lib/extraction/confidence-scorer.ts`

**Purpose:** Score quality of extracted data (0-100)

```typescript
export interface ConfidenceScore {
  email: number;           // Email validity: 0-100
  companyMatch: number;    // Email matches company: 0-100
  pageRelevance: number;   // Page relevance to search: 0-100
  overall: number;         // Weighted average: 0-100
}

export class ConfidenceScorer {
  scoreEmail(email: string, domain: string): number {
    // Check: format valid, domain matches page, etc.
  }
  
  scoreCompanyMatch(email: string, company: string): number {
    // Does email domain match company domain?
  }
  
  scorePageRelevance(query: string, pageTitle: string): number {
    // Does page match search query?
  }
}
```

### 7. Deobfuscation Orchestrator
**New Module:** `lib/extraction/deobfuscation-orchestrator.ts`

**Purpose:** Run all deobfuscation methods in order, track results

```typescript
export interface DeobfuscatedResult {
  email: string;
  method: string;           // Which deobfuscation method
  obfuscation: string;      // What type: 'cloudflare', 'base64', etc.
  confidence: number;       // 0-100
  evidence?: string;        // How it was found
}

export class DeobfuscationOrchestrator {
  async deobfuscateAll(text: string): Promise<DeobfuscatedResult[]> {
    const results: DeobfuscatedResult[] = [];
    
    // Try each method in order
    results.push(...deobfuscateMailto(text));
    results.push(...deobfuscateHTMLEntities(text));
    results.push(...deobfuscateBase64(text));
    // ... etc
    
    // Deduplicate and score
    return this.deduplicateAndScore(results);
  }
}
```

---

## Implementation Phases

### Phase 1: Deobfuscation Engine (Week 1)
**Goal:** Add 14+ new deobfuscation methods  
**Changes:** Only `lib/extraction/deobfuscate.ts`  
**Time:** 3-4 days  
**Risk:** LOW - all additions, no modifications to existing code  

**Deliverable:**
- ✅ 24+ total deobfuscation methods
- ✅ All tested against sample pages
- ✅ Each method returns confidence score
- ✅ Backward compatible

**Files Modified:**
- `lib/extraction/deobfuscate.ts` - Add 14 new functions

**Files Created:**
- `lib/extraction/deobfuscation-orchestrator.ts` - New module to run all methods

---

### Phase 2: Evidence & Company Modules (Week 1-2)
**Goal:** Add evidence tracking and company detection  
**Time:** 3-4 days  
**Risk:** LOW - new modules, no changes to existing extraction

**Deliverable:**
- ✅ Evidence location tracking (header, footer, contact, etc.)
- ✅ Company name auto-detection from URL/metadata
- ✅ Confidence scoring for both

**Files Created:**
- `lib/extraction/evidence-tracker.ts` - New module
- `lib/extraction/company-detector.ts` - New module
- `lib/extraction/confidence-scorer.ts` - New module

---

### Phase 3: Extend Extraction Engine (Week 2)
**Goal:** Capture page metadata, integrate new modules  
**Time:** 3-4 days  
**Risk:** MEDIUM - modifying existing engine, but carefully

**Changes to Existing Code:**
- Extend `ExtractionResult` interface with metadata fields
- Add metadata capture methods to `ExtractionEngine`
- Integrate evidence tracker & company detector
- Return extended result object

**Backward Compatibility:**
- Old `extractEmails()` returns `string[]` ✓
- New `extractWithIntelligence()` returns full metadata ✓

**Files Modified:**
- `lib/extraction/engine.ts` - Extend (keep all existing code)

---

### Phase 4: Extend Queue & Job Model (Week 2-3)
**Goal:** Store new fields in Job object  
**Time:** 2-3 days  
**Risk:** LOW - extending interface, database schema migration optional

**Changes:**
- Extend `Job` interface with new fields:
  - `metadata`: PageMetadata
  - `emailMetadata`: ExtractedEmail[]
  - `company`: CompanyInfo
  - `quality`: QualityScore
  - `deobfuscationMethods`: string[]

**Database Changes:**
- **Option A (Recommended):** Store extended fields as JSON in Redis
- **Option B (Future):** Add columns to database if using persistent storage

**Files Modified:**
- `lib/queue/types.ts` - Extend interface
- `lib/queue/queue.ts` - Update `markCompleted()` to store new fields

---

### Phase 5: Update APIs (Week 3)
**Goal:** Return extended results in API responses  
**Time:** 2-3 days  
**Risk:** LOW - backward compatible versioning

**Changes:**
- `/api/job/[id]/result` returns extended fields
- `/api/dashboard/search` returns extended results
- Old clients still work (only get email array)
- New clients get full metadata

**API Versioning Strategy:**
```typescript
// Backward compatible - returns minimal data
GET /api/job/123/result
Response: { emails: ["user@example.com"] }

// New endpoint - returns full intelligence
GET /api/job/123/result?v=2
Response: {
  emails: [{
    email: "user@example.com",
    confidence: 98,
    method: "mailto",
    foundIn: "Contact Section"
  }],
  company: { name: "Acme", confidence: 95 },
  quality: { ... }
}
```

**Files Modified:**
- `app/api/job/[id]/result/route.ts` - Add version support

---

### Phase 6: Dashboard Integration (Week 3-4)
**Goal:** Display new fields in dashboard  
**Time:** 2-3 days  
**Risk:** LOW - UI-only changes

**Changes:**
- Enhance Jobs page to show company names
- Show confidence scores
- Display evidence location
- Show deobfuscation methods used

**Files Modified:**
- `app/dashboard/jobs/page.tsx` - Add new columns/display logic
- `app/dashboard/results/page.tsx` (if exists) - Add new sections

---

### Phase 7: Testing & Optimization (Week 4)
**Goal:** Ensure quality, performance, no regressions  
**Time:** Full week  
**Risk:** MEDIUM - integration testing required

**Testing:**
- ✅ All deobfuscation methods on 100+ sample pages
- ✅ Evidence tracking accuracy
- ✅ Company detection accuracy (95%+)
- ✅ Performance: <12s per URL
- ✅ No regressions to existing extraction
- ✅ Backward compatibility verified

**Files Modified:**
- New test files under `__tests__/` or `tests/`

---

## Data Model Changes

### Queue/Job Changes

**File:** `lib/queue/types.ts`

**Current:**
```typescript
export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];  // ← Current, simple array
  retries: number;
  maxRetries: number;
  createdAt: number;
  // ... other fields
}
```

**Extended (APPEND, don't replace):**
```typescript
export interface ExtractedEmail {
  email: string;
  confidence: number;      // 0-100
  type: string;            // 'general', 'contact', 'support', etc.
  method: string;          // 'mailto', 'direct', 'contact_form'
  obfuscation: string;     // 'none', 'base64', 'cloudflare', etc.
  foundIn: string;         // 'header', 'footer', 'contact_page'
  evidence: string;        // Extracted context/proof
  timestamp: number;       // When extracted
}

export interface CompanyInfo {
  name: string;
  confidence: number;      // 0-100
  source: 'domain' | 'title' | 'og_tags';
}

export interface QualityScore {
  totalEmails: number;
  highConfidence: number;  // Count where confidence >= 90
  pageRelevance: number;   // 0-100
  extractionMethod: 'jsdom' | 'puppeteer';
}

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];                    // ← Keep for backward compat
  emailMetadata?: ExtractedEmail[];     // ← NEW: Extended email data
  metadata?: {                          // ← NEW: Page metadata
    title?: string;
    description?: string;
    ogImage?: string;
    ogTitle?: string;
  };
  company?: CompanyInfo;                // ← NEW: Auto-detected company
  quality?: QualityScore;               // ← NEW: Quality metrics
  deobfuscationMethods?: string[];      // ← NEW: Methods used
  retries: number;
  maxRetries: number;
  createdAt: number;
  // ... other existing fields unchanged
}
```

**Migration Strategy:**
- Phase 4 only: Add new optional fields to interface
- Week 3-4: Existing jobs continue to work
- Week 4+: All new jobs include new fields
- No database migration needed (Redis stores as JSON)

---

## API Changes

### `/api/job/[id]/result`

**Current (v1, default):**
```json
{
  "id": "job-123",
  "emails": ["user@example.com"],
  "totalEmails": 1
}
```

**Extended (v2, with `?v=2`):**
```json
{
  "id": "job-123",
  "emails": ["user@example.com"],
  "emailMetadata": [
    {
      "email": "user@example.com",
      "confidence": 98,
      "type": "general",
      "method": "mailto",
      "obfuscation": "none",
      "foundIn": "Contact Section",
      "evidence": "Found in contact page footer",
      "timestamp": 1721234538000
    }
  ],
  "company": {
    "name": "Acme Corp",
    "confidence": 92,
    "source": "domain"
  },
  "metadata": {
    "title": "Acme Corp - Contact Us",
    "description": "Get in touch with our sales team",
    "ogImage": "https://acme.com/og.jpg"
  },
  "quality": {
    "totalEmails": 1,
    "highConfidence": 1,
    "pageRelevance": 95,
    "extractionMethod": "jsdom"
  },
  "deobfuscationMethods": ["mailto"],
  "totalEmails": 1
}
```

**File Modified:**
- `app/api/job/[id]/result/route.ts`

---

## File Structure After Implementation

```
lib/extraction/
├── engine.ts                          (MODIFIED: +metadata capture)
├── deobfuscate.ts                     (MODIFIED: +14 methods)
├── deobfuscation-orchestrator.ts      (NEW)
├── evidence-tracker.ts                (NEW)
├── company-detector.ts                (NEW)
├── confidence-scorer.ts               (NEW)
└── index.ts                           (EXPORT all modules)

lib/queue/
├── types.ts                           (MODIFIED: +new interfaces)
├── queue.ts                           (MODIFIED: use new fields)
└── index.ts

app/api/
└── job/[id]/result/route.ts          (MODIFIED: add ?v=2 support)

app/dashboard/
└── jobs/page.tsx                      (MODIFIED: display new fields)

docs/
├── REVISED_IMPLEMENTATION_PLAN.md     (YOU ARE HERE)
└── DEOBFUSCATION_METHODS.md           (NEW: reference)
```

---

## Checklist by Phase

### Phase 1: Deobfuscation Engine

**Day 1-2:**
- [ ] Research all 24 deobfuscation methods
- [ ] Create deobfuscation-orchestrator.ts
- [ ] Implement 14 new methods in deobfuscate.ts
- [ ] Add confidence scoring to each method
- [ ] Add method tracking (what method found this email?)

**Day 3-4:**
- [ ] Unit tests for each method
- [ ] Test on 20+ real websites with various obfuscation
- [ ] Measure performance (<500ms for all methods)
- [ ] Document each method in DEOBFUSCATION_METHODS.md

**Approval Gate:** All tests passing, no regressions

---

### Phase 2: Evidence & Company Modules

**Day 1-2:**
- [ ] Create evidence-tracker.ts
- [ ] Implement section identification (header, footer, contact, etc.)
- [ ] Extract context around each email
- [ ] Implement confidence scoring for evidence

**Day 2-3:**
- [ ] Create company-detector.ts
- [ ] Extract from domain, title, OG tags
- [ ] Implement fuzzy matching for company name normalization
- [ ] Implement confidence scoring

**Day 3-4:**
- [ ] Create confidence-scorer.ts
- [ ] Implement email format validation
- [ ] Implement company match scoring
- [ ] Implement page relevance scoring
- [ ] Unit tests for all three modules

**Approval Gate:** All modules unit tested, >95% accuracy on test pages

---

### Phase 3: Extend Extraction Engine

**Day 1-2:**
- [ ] Extend ExtractionResult interface
- [ ] Add metadata capture to extractWithJsdom()
- [ ] Add metadata capture to extractWithPuppeteer()
- [ ] Integrate new modules (evidence, company, confidence)

**Day 2-3:**
- [ ] Create extractWithIntelligence() method
- [ ] Keep existing extractEmails() unchanged
- [ ] Test backward compatibility

**Day 3-4:**
- [ ] Performance testing (no regression to <20s timeout)
- [ ] Integration tests with real URLs
- [ ] Verify no crashes or memory leaks

**Approval Gate:** Performance targets met, backward compatibility verified

---

### Phase 4: Queue & Job Model

**Day 1-2:**
- [ ] Extend Job interface in types.ts
- [ ] Add new optional fields
- [ ] Create helper functions for new fields

**Day 2-3:**
- [ ] Update queue.ts markCompleted() to store new fields
- [ ] Update queue.ts getJob() to return new fields
- [ ] Test with Redis

**Day 3-4:**
- [ ] Integration test full pipeline
- [ ] Verify no data loss
- [ ] Verify backward compatibility with old jobs

**Approval Gate:** All data correctly persisted, old jobs still work

---

### Phase 5: Update APIs

**Day 1:**
- [ ] Implement ?v=2 query parameter support
- [ ] Create version-aware response formatting
- [ ] Maintain v1 as default (backward compatible)

**Day 2:**
- [ ] API integration tests
- [ ] Test both v1 and v2 responses
- [ ] Verify payload sizes

**Day 3:**
- [ ] Update API documentation
- [ ] Create migration guide for clients

**Approval Gate:** Both versions working, documented

---

### Phase 6: Dashboard Integration

**Day 1-2:**
- [ ] Update Jobs page to display new fields
- [ ] Add company name column
- [ ] Add confidence score display
- [ ] Add evidence location column

**Day 2-3:**
- [ ] Create detail view showing full email metadata
- [ ] Add filtering by confidence score
- [ ] Add export with new fields

**Day 3-4:**
- [ ] UI testing
- [ ] Mobile responsive testing
- [ ] Performance testing (large result sets)

**Approval Gate:** UI looks good, no performance regressions

---

### Phase 7: Testing & Optimization

**Full Week:**
- [ ] End-to-end testing (search → crawl → extract → display)
- [ ] Test on 100+ real websites
- [ ] Measure accuracy of company detection (target: 95%+)
- [ ] Measure accuracy of evidence tracking (target: 100%)
- [ ] Measure confidence scoring calibration
- [ ] Load testing (1000+ jobs)
- [ ] Performance profiling and optimization
- [ ] Documentation and runbooks
- [ ] QA sign-off

**Approval Gate:** All tests passing, metrics met, ready for production

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Deobfuscation methods miss edge cases | High | Low | Test on 200+ real sites, add fallback |
| Company detection <90% accuracy | Medium | Medium | Use multiple sources, fuzzy matching |
| Performance regression >20s | Low | High | Profile each phase, optimize hot paths |
| Evidence tracking unreliable | Low | Low | Validate on 100+ pages, manual QA |
| Backward compatibility broken | Low | Critical | Version API, keep old fields, extensive testing |
| Storage explosion with metadata | Medium | Medium | Limit evidence field size, implement pagination |

---

## Success Criteria

### Phase 1
- ✅ All 24 deobfuscation methods working
- ✅ <500ms for orchestrator to run all methods
- ✅ No regressions to existing extraction

### Phase 2
- ✅ Evidence tracking 100% accurate on test pages
- ✅ Company detection 90%+ accurate
- ✅ Confidence scoring 0-100 range realistic

### Phase 3
- ✅ Extraction <20s per URL (95th percentile)
- ✅ Memory usage stable
- ✅ No crashes or timeouts

### Phase 4
- ✅ All new fields persisted correctly
- ✅ Old jobs still queryable
- ✅ No data loss

### Phase 5
- ✅ Both API versions working
- ✅ Backward compatibility maintained
- ✅ Clear migration path for clients

### Phase 6
- ✅ Dashboard displays all new fields
- ✅ No UI performance regressions
- ✅ Mobile responsive

### Phase 7
- ✅ 100% of tests passing
- ✅ Feature parity with SerpDigger
- ✅ Ready for production deployment

---

## Rollback Plan

Each phase has a rollback strategy:

**Phase 1:** Deobfuscation methods are new additions. Rollback = don't call them.  
**Phase 2:** New modules, no breaking changes. Rollback = don't call new modules.  
**Phase 3:** Extended interface. Rollback = use old extractEmails() method.  
**Phase 4:** New optional fields. Rollback = ignore new fields in responses.  
**Phase 5:** API versioning. Rollback = keep v1 as default.  
**Phase 6:** UI changes only. Rollback = revert UI changes.  
**Phase 7:** No production changes until after testing.

---

## Approval Sign-Off

Before proceeding to each phase, the following must be true:

- [ ] Phase plan reviewed and approved
- [ ] Technical approach reviewed and approved
- [ ] Risk assessment reviewed and approved
- [ ] Testing strategy reviewed and approved
- [ ] Go/no-go meeting held
- [ ] Product owner sign-off
- [ ] Technical lead sign-off

---

## Questions & Answers

**Q: How long will this take?**  
A: 3-4 weeks for a single developer working full-time. 2 weeks with two developers.

**Q: Will existing searches be affected?**  
A: No. Phase 1-3 are purely extraction enhancements. No impact on search, queue, or worker.

**Q: Do we need to change the database schema?**  
A: No. Phase 4 uses optional fields in Redis JSON. No database migration needed.

**Q: Will API consumers need to change?**  
A: No. v1 API remains default and backward compatible. New consumers use ?v=2.

**Q: What if a deobfuscation method is too slow?**  
A: Orchestrator can skip slow methods or run them asynchronously. Each method has a timeout.

**Q: How do we know if company detection is working?**  
A: Manual QA on 100+ test pages. Target: 95%+ accuracy. Can add validation endpoint.

**Q: What's the maximum result size per job?**  
A: Currently unlimited. With metadata: ~500-1000 bytes per email. Should be fine for most searches.

**Q: Can we skip Phase 2 and go straight to Phase 3?**  
A: No. Evidence tracking and company detection are needed for the intelligent result object.

**Q: What if we need to add another CSE engine later?**  
A: Current design is ready for multi-CSE. Phase 5 APIs already support it in design.

---

## Next Steps

### User Must Decide:

1. **Approve Phase 1** - Deobfuscation methods (no risk, pure addition)
2. **Approve Phase 2** - Evidence & Company modules (low risk, new modules)
3. **Approve Phase 3** - Extraction engine extension (medium risk, requires testing)

### Once Approved:

1. Implement Phase 1 (3-4 days)
2. Wait for QA sign-off
3. Implement Phase 2 (3-4 days)
4. Wait for QA sign-off
5. Implement Phase 3 (3-4 days)
6. Continue through Phase 7

---

## Timeline Comparison

**v0 Original Plan:** 5-6 weeks (rewrite entire architecture)  
**Revised Plan:** 3-4 weeks (extend existing architecture)  
**Benefit:** 40% faster, lower risk, preserves working code

**Why Faster:**
- No queue rewrite ✅
- No worker rewrite ✅
- No auth rewrite ✅
- No Google PSE rewrite ✅
- Pure extension with new modules ✅
- Backward compatible throughout ✅

---

**Status:** Ready for approval to begin Phase 1

