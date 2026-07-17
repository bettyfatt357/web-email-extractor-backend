# Phase 2: Discovery Intelligence Engine - Implementation Plan

## Executive Summary

**Objective:** Upgrade the extraction engine from "email extraction" to "business intelligence extraction"

**Timeline:** 3-4 weeks (maintaining existing functionality)

**Scope:** Extend extraction to produce rich intelligence records with company, page metadata, evidence, confidence, extraction method, and matched query/pattern

**Backward Compatibility:** All existing APIs and searches continue working unchanged

**Key Principle:** Extend, don't rewrite. Keep all working code intact.

---

## Part 1: Current State Analysis

### What's Working ✅
- Queue system (Redis/Upstash, deduplication, retry logic)
- Worker system (concurrent processing, timeouts, watchdog monitoring)
- Google PSE integration (multi-keyword, multi-page search)
- Extraction engine (JSDOM + Puppeteer dual-mode)
- Current deobfuscation (9 methods: direct regex, [at]/(at), HTML entities, Base64, mailto, reverse, ROT13, URL encoding, JSON)
- API endpoints (search, job retrieval, result fetching)
- Authentication and rate limiting

### Current Limitations ❌
- No company name extraction
- No page metadata tracking (title, URL, Google position)
- No evidence tracking (WHERE email was found)
- No extraction method tracking (which deobfuscation worked)
- No matched query/pattern tracking
- No confidence scoring
- Only 9 deobfuscation methods (missing 15+ advanced methods)
- No 3-stage pattern matching (Google query → URL → HTML)
- Results are flat (just email arrays)

### Current Data Model

```typescript
// CURRENT (Tier 0)
{
  id: "job-123",
  url: "https://example.com",
  emails: ["info@example.com"],
  totalEmails: 1,
  status: "completed",
  createdAt: 1699564800000
}
```

---

## Part 2: Proposed Phase 2 Data Model

### New Intelligence Object (Tier 1 - Enterprise Grade)

```typescript
// PHASE 2 (Enterprise Grade)
{
  // Core Identification
  id: "job-123",
  status: "completed",
  timestamp: 1699564800000,
  workerId: "worker-abc123",
  
  // Source Information
  company: {
    name: "BlackRock",           // Extracted from URL/metadata
    confidence: 92               // 0-100 quality score
  },
  
  website: "https://blackrock.com",
  
  page: {
    title: "Contact Us",                              // From <title> tag
    url: "https://blackrock.com/contact",
    googlePosition: 4,                                // Position in Google results
    googlePage: 2,                                    // Which page of results
    
    // Metadata from page
    description: "Contact BlackRock for inquiries",   // From meta description
    ogImage: "https://blackrock.com/og-image.jpg",   // From OG tags
    openGraph: {                                      // All OG tags
      title: "Contact BlackRock",
      description: "Get in touch",
      image: "https://blackrock.com/og-image.jpg"
    },
    structuredData: {                                 // Schema.org data
      "@type": "Organization",
      name: "BlackRock",
      telephone: "+1-212-810-5000"
    }
  },
  
  // Search Context
  query: {
    keyword: "asset management",                      // Original keyword
    location: "New York",                             // Location filter
    pattern: "contact",                               // Pattern used
    generatedQuery: "asset management New York contact"  // Final Google query
  },
  
  // Emails with Full Intelligence
  emails: [
    {
      email: "info@blackrock.com",
      confidence: 98,                                 // 0-100 confidence
      method: "mailto",                               // Extraction method
      obfuscation: "none",                            // How it was encoded
      foundIn: "footer",                              // DOM section (header, footer, contact_page, etc)
      snippet: "Contact us at info@blackrock.com",    // HTML context
      deobfuscationMethod: "direct",                  // Which deobfuscation worked
      timestamp: 1699564800000
    },
    {
      email: "careers@blackrock.com",
      confidence: 85,
      method: "html_attribute",
      obfuscation: "html_entities",
      foundIn: "careers_page",
      snippet: "Email: &#105;&#110;&#102;&#111;&#64;...",
      deobfuscationMethod: "html_entity_decode",
      timestamp: 1699564800000
    }
  ],
  
  // Quality Metrics
  quality: {
    totalEmails: 2,
    highConfidence: 1,         // >= 90%
    mediumConfidence: 1,       // 70-89%
    lowConfidence: 0,          // < 70%
    pageRelevance: 95,         // How relevant page is to query (0-100)
    executionTime: 4200        // ms
  },
  
  // Crawl Information
  crawl: {
    status: "completed",
    method: "puppeteer",                              // jsdom | puppeteer
    duration: 4200,                                   // ms
    htmlSize: 245600,                                 // bytes
    statusCode: 200
  },
  
  // Error Tracking (if failed)
  error: null
}
```

### Backward Compatibility

**Old v1 API** - Still works, returns simplified results:
```
GET /api/job/[id]/result → { id, emails, totalEmails }
```

**New v2 API** - Returns full intelligence object:
```
GET /api/v2/job/[id]/result → Full Intelligence Object
```

---

## Part 3: 3-Stage Pattern Matching System

### Current Pattern Behavior
```
Pattern: "contact"
↓
site:contact    (Google query filtering)
```

**Problem:** Only filters Google results, doesn't validate extracted content

### Proposed 3-Stage System

#### Stage 1: Google Query Generation
Patterns influence the search query sent to Google

```
Patterns: ["contact", "careers", "team"]

Generated Queries:
├─ "keyword location contact"
├─ "keyword location contact-us site:example.com"
├─ "keyword location careers"
├─ "keyword location team"
└─ "keyword location about"

Stage 1 Library (patterns → search terms):
{
  "contact": ["contact", "get in touch", "contact us", "reach out"],
  "careers": ["careers", "jobs", "employment", "work with us"],
  "team": ["team", "staff", "employees", "our people"],
  "about": ["about", "about us", "company info"],
  "directory": ["directory", "staff directory", "contact directory"]
}
```

#### Stage 2: URL Path Matching
After crawling, match email URLs against known paths

```
Crawled URLs:
├─ /contact
├─ /contact-us
├─ /team
├─ /careers
└─ /about-us

Matched Pattern Paths (patterns → URL patterns):
{
  "contact": ["/contact", "/contact-us", "/get-in-touch", "/reach-out"],
  "careers": ["/careers", "/jobs", "/employment", "/hiring"],
  "team": ["/team", "/staff", "/employees", "/our-people"],
  "about": ["/about", "/about-us", "/company", "/info"]
}
```

#### Stage 3: HTML Content Matching
Search extracted page HTML for pattern keywords

```
Crawled HTML (text content):
"Contact our sales team at sales@example.com
 For support, email support@example.com"

Matched Pattern Keywords (patterns → HTML keywords):
{
  "contact": ["Contact", "Get in touch", "Reach out", "Drop us a line"],
  "sales": ["Sales", "Quote", "Pricing", "Business inquiry"],
  "support": ["Support", "Help", "Customer service", "Assistance"],
  "hr": ["HR", "Human Resources", "Recruitment", "Hiring"],
  "careers": ["Careers", "Jobs", "Employment", "Work with us"]
}

Result:
{
  "sales@example.com": ["sales"],
  "support@example.com": ["support"]
}
```

### Implementation: Pattern Orchestrator

```typescript
class PatternOrchestrator {
  // Stage 1: Generate queries
  generateSearchQueries(keyword, location, patterns) {
    // Uses PATTERN_TO_SEARCH_TERMS mapping
  }
  
  // Stage 2: Match URLs
  matchUrlPatterns(url, patterns) {
    // Uses PATTERN_TO_URL_PATTERNS mapping
    // Returns matched patterns
  }
  
  // Stage 3: Match HTML content
  matchHtmlPatterns(html, patterns) {
    // Uses PATTERN_TO_HTML_KEYWORDS mapping
    // Returns matched patterns per email
  }
}
```

---

## Part 4: Deobfuscation Methods - 20+ Methods

### Current Methods (9) ✅

1. **Direct Regex** - Plain emails matching `/email@domain.com/`
2. **[at]/[dot]** - `user[at]example[dot]com` → `user@example.com`
3. **(at)/(dot)** - `user(at)example(dot)com` → `user@example.com`
4. **HTML Entities** - `&#64;` → `@`, `&#46;` → `.`
5. **Base64** - `aW5mb0BleGFtcGxlLmNvbQ==` → decode → extract
6. **Mailto Links** - `<a href="mailto:user@example.com">`
7. **Reverse Strings** - `moc.elpmaxe@resu` → reverse → extract
8. **ROT13** - `hfre@rknzcyr.pbz` → ROT13 decode → extract
9. **URL Encoding** - `user%40example%2Ecom` → decode → extract

### New Methods to Add (11) ✅

#### Tier 2: Common Variants
10. **Decimal Entities** - `&#117;&#115;&#101;&#114;` → `user`
11. **Hex Entities** - `&#x75;&#x73;&#x65;&#x72;` → `user`
12. **Named Entities** - `&quot;user&quot;@example&period;com`
13. **Unicode Escapes** - `\u0075\u0073\u0065\u0072` → `user`
14. **JSON String Escaping** - `"email":"user\@example.com"`

#### Tier 3: Framework-Specific
15. **Next.js Hydration** - Extract from `__NEXT_DATA__` JSON
16. **React Props** - Extract from React component props
17. **Vue Template** - Extract from Vue `data()` and `computed`
18. **Angular Expression** - Extract from `ng-` attributes

#### Tier 4: Advanced Obfuscation
19. **Shadow DOM** - Query shadow DOM for hidden content
20. **CSS Hidden** - Extract from `display:none`, `visibility:hidden` elements
21. **HTML Comments** - `<!-- mail to: user@example.com -->`

#### Tier 5: Cloudflare Protection (Optional)
22. **Cloudflare Email Protection** - Decode protected emails
23. **Canvas Rendering** - OCR emails rendered on canvas (experimental)

### Deobfuscation Orchestrator

```typescript
class DeobfuscationOrchestrator {
  methods = [
    // Tier 1: Direct
    directRegex,
    mailtoLinks,
    // Tier 2: Character substitution
    atDotVariants,
    htmlEntities,
    decimalEntities,
    hexEntities,
    // Tier 3: Encoding
    base64,
    urlEncoding,
    rot13,
    // Tier 4: Transformations
    reversed,
    unicodeEscapes,
    // Tier 5: Data formats
    jsonStructured,
    jsonLd,
    schema,
    microdata,
    // Tier 6: Framework-specific
    nextJs,
    react,
    vue,
    angular,
    // Tier 7: Advanced
    shadowDom,
    cssHidden,
    htmlComments,
    cloudflareProtection
  ];
  
  async extractEmails(html, text) {
    const results = new Map();
    
    for (const method of this.methods) {
      const emails = method(html, text);
      for (const email of emails) {
        results.set(email, {
          email,
          methods: [...(results.get(email)?.methods || []), method.name],
          confidence: this.scoreConfidence(email, results.get(email)?.methods || [])
        });
      }
    }
    
    return results;
  }
  
  scoreConfidence(email, methods) {
    // More methods that found it = higher confidence
    // 1 method: 60%, 2+ methods: 80%, 3+ methods: 95%
    const methodCount = methods.length;
    if (methodCount === 1) return 60;
    if (methodCount === 2) return 80;
    return 95;
  }
}
```

---

## Part 5: Module Architecture

### New/Extended Modules to Add

#### 1. Intelligence Extractor (NEW)
**File:** `/lib/extraction/intelligence-extractor.ts`

```typescript
class IntelligenceExtractor {
  async extractIntelligence(url: string, pageMetadata: PageMetadata, 
                           query: QueryContext): Promise<IntelligenceRecord> {
    
    // 1. Extract company from URL/metadata
    const company = this.detectCompany(url, pageMetadata);
    
    // 2. Extract page metadata
    const pageInfo = this.extractPageMetadata(pageMetadata);
    
    // 3. Extract and deobfuscate emails
    const emailResults = await this.extractEmails(pageMetadata);
    
    // 4. Track evidence (WHERE found)
    const emailsWithEvidence = this.trackEvidence(emailResults, pageMetadata);
    
    // 5. Score confidence
    const scoredEmails = this.scoreConfidence(emailsWithEvidence, pageMetadata);
    
    // 6. Build intelligence object
    return this.buildIntelligenceRecord({
      company,
      page: pageInfo,
      query,
      emails: scoredEmails,
      metadata: pageMetadata
    });
  }
}
```

#### 2. Company Detector (NEW)
**File:** `/lib/extraction/company-detector.ts`

```typescript
class CompanyDetector {
  // Extract company from:
  // 1. Domain name (example.com → Example)
  // 2. Page title
  // 3. OG tags (og:site_name)
  // 4. Schema.org Organization
  // 5. Favicon metadata
  
  detect(url, pageMetadata) {
    const name = this.extractFromDomain(url) 
              || this.extractFromPageTitle(pageMetadata.title)
              || this.extractFromOG(pageMetadata.openGraph)
              || this.extractFromSchema(pageMetadata.structuredData);
    
    return {
      name,
      confidence: this.scoreConfidence(name, pageMetadata)
    };
  }
  
  scoreConfidence(name, metadata) {
    // Schema.org: 99%, Domain: 85%, Page title: 80%, OG: 75%
  }
}
```

#### 3. Evidence Tracker (NEW)
**File:** `/lib/extraction/evidence-tracker.ts`

```typescript
class EvidenceTracker {
  // Track WHERE each email was found:
  // - header / footer / sidebar
  // - contact_page / careers_page / team_page
  // - HTML class/id (e.g., "contact-form", "team-member")
  
  trackEmailSource(email, htmlElement, pageContext) {
    const section = this.identifySection(htmlElement);
    const snippet = this.extractSnippet(htmlElement);
    const context = this.extractContext(htmlElement);
    
    return {
      email,
      foundIn: section,
      snippet,
      context,
      elementPath: this.getElementPath(htmlElement)
    };
  }
  
  identifySection(element) {
    // Returns: header | footer | sidebar | main | contact_page | etc
  }
}
```

#### 4. Pattern Validator (NEW)
**File:** `/lib/extraction/pattern-validator.ts`

```typescript
class PatternValidator {
  // Stage 2: URL matching
  matchUrlPatterns(url, patterns) {
    // /contact matches "contact" pattern
  }
  
  // Stage 3: HTML matching
  matchHtmlPatterns(html, patterns) {
    // HTML contains "Contact" text → matches pattern
  }
  
  validateEmails(emails, patterns, url, html) {
    // For each email, track which patterns matched
    return emails.map(email => ({
      email,
      matchedPatterns: this.findMatchingPatterns(email, patterns, url, html)
    }));
  }
}
```

#### 5. Confidence Scorer (NEW)
**File:** `/lib/extraction/confidence-scorer.ts`

```typescript
class ConfidenceScorer {
  scoreEmail(email, context) {
    // Factors:
    // - Format validity: 30 points
    // - Deobfuscation methods: 20 points per method (capped at 30)
    // - Domain match: 20 points
    // - Page relevance: 20 points
    
    let score = 0;
    
    score += this.scoreFormat(email) * 0.30;
    score += Math.min(this.scoreDeobfuscation(email) * 0.30, 30);
    score += this.scoreDomainMatch(email, context) * 0.20;
    score += this.scorePageRelevance(context) * 0.20;
    
    return Math.round(score);
  }
}
```

#### 6. Extended Deobfuscation Engine (EXTENDED)
**File:** `/lib/extraction/deobfuscate-extended.ts`

- Keep existing `deobfuscate.ts` as-is
- Add new file with 11 additional methods
- Create `DeobfuscationOrchestrator` that runs all 20+ methods
- Track which method worked for each email

#### 7. Extended Extraction Engine (EXTENDED)
**File:** `/lib/extraction/engine.ts` (extend existing)

```typescript
class ExtendedExtractionEngine extends ExtractionEngine {
  async extractIntelligence(url: string, queryContext: QueryContext) {
    // Keep existing extractEmails() working for backward compat
    
    // NEW: Extract full intelligence
    const html = await this.fetchPage(url);
    const metadata = this.extractPageMetadata(html);
    
    // Use new orchestrators
    const company = new CompanyDetector().detect(url, metadata);
    const emails = await new DeobfuscationOrchestrator().extract(html);
    const evidence = new EvidenceTracker().track(emails, html);
    const validated = new PatternValidator().validate(emails, evidence);
    const scored = new ConfidenceScorer().score(validated, metadata);
    
    return new IntelligenceExtractor().build({
      company,
      page: metadata,
      emails: scored,
      query: queryContext
    });
  }
}
```

---

## Part 6: Queue/Job Model Extensions

### Extended Job Interface

```typescript
interface ExtendedJob extends Job {
  // EXISTING FIELDS (keep as-is)
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];
  retries: number;
  
  // NEW FIELDS for intelligence
  intelligence?: {
    company: { name: string; confidence: number };
    page: {
      title: string;
      description: string;
      googlePosition: number;
      openGraph: Record<string, string>;
    };
    query: {
      keyword: string;
      pattern: string;
      generatedQuery: string;
    };
  };
  
  emailsIntelligence?: Array<{
    email: string;
    confidence: number;
    method: string;
    foundIn: string;
    snippet: string;
  }>;
  
  crawl?: {
    method: 'jsdom' | 'puppeteer';
    duration: number;
    statusCode: number;
  };
}
```

### Backward Compatibility in Queue

- Existing `Job` interface still works (intelligence fields optional)
- Old jobs don't need migration
- New jobs include intelligence fields
- API v1 returns only emails (backward compatible)
- API v2 returns full intelligence object

---

## Part 7: API Changes

### Backward Compatible API v1 (No Changes)
```
GET /api/job/[id]/result
→ { id, emails, totalEmails }  // Still works exactly the same
```

### New Intelligence API v2
```
GET /api/v2/job/[id]
→ Full Intelligence Object (company, page, emails with evidence, confidence, etc)
```

### New Endpoints
```
GET /api/v2/jobs
→ List intelligence records (pagination)

GET /api/v2/search/[searchId]
→ Get all jobs from a search with intelligence

POST /api/v2/export/[searchId]
→ Export results as CSV/JSON with full intelligence
```

---

## Part 8: Implementation Phases

### Phase 2A: Foundation (Week 1)
**Deliverable:** All 20+ deobfuscation methods working
**Tasks:**
- [ ] Create deobfuscate-extended.ts with 11 new methods
- [ ] Create DeobfuscationOrchestrator class
- [ ] Add confidence scoring to deobfuscation
- [ ] Test on 100+ real websites
- [ ] Ensure no regressions in existing extraction
**Time:** 3-4 days
**Risk:** LOW

**Approval Gate:** 
- All 20 methods tested
- 95%+ accuracy on test sites
- No performance regressions
- Backward compatible

---

### Phase 2B: Intelligence Modules (Week 1-2)
**Deliverable:** Company detection, evidence tracking, confidence scoring
**Tasks:**
- [ ] Create CompanyDetector class
- [ ] Create EvidenceTracker class
- [ ] Create PatternValidator class (Stage 2 & 3)
- [ ] Create ConfidenceScorer class
- [ ] Create IntelligenceExtractor orchestrator
- [ ] Test on 100+ real websites
**Time:** 3-4 days
**Risk:** LOW

**Approval Gate:**
- All modules working independently
- Company detection 85%+ accurate
- Evidence tracking captures WHERE correctly
- Confidence scores realistic (0-100)
- No performance regressions

---

### Phase 2C: Engine Integration (Week 2)
**Deliverable:** Extended extraction engine producing intelligence objects
**Tasks:**
- [ ] Extend ExtractionEngine to call new modules
- [ ] Integrate page metadata extraction
- [ ] Integrate Pattern Validator stages 2-3
- [ ] Add crawl metadata tracking
- [ ] Performance testing (<12s per URL)
- [ ] Memory profiling
**Time:** 2-3 days
**Risk:** MEDIUM

**Approval Gate:**
- Intelligence objects complete and valid
- <12s extraction time (95th percentile)
- No memory leaks
- Clean error handling
- Backward compatibility verified

---

### Phase 2D: Queue & Data Model (Week 2-3)
**Deliverable:** Extended Job interface, intelligence fields persisted
**Tasks:**
- [ ] Extend Job interface with intelligence fields
- [ ] Update queue to store/retrieve intelligence
- [ ] Verify old jobs still work
- [ ] Test data persistence
- [ ] Profile Redis storage increase
**Time:** 2 days
**Risk:** LOW

**Approval Gate:**
- Data persists correctly
- Old jobs unaffected
- Storage increase acceptable
- Query performance acceptable

---

### Phase 2E: API v2 Implementation (Week 3)
**Deliverable:** New API v2 endpoints, v1 backward compatible
**Tasks:**
- [ ] Create /api/v2/job/[id] endpoint
- [ ] Create /api/v2/jobs endpoint
- [ ] Create /api/v2/search/[searchId] endpoint
- [ ] Test both v1 and v2
- [ ] Documentation
**Time:** 2 days
**Risk:** LOW

**Approval Gate:**
- Both API versions working
- v1 returns same results as before
- v2 returns full intelligence
- No breaking changes

---

### Phase 2F: Dashboard UI (Week 3-4)
**Deliverable:** Dashboard displays intelligence (company, confidence, evidence)
**Tasks:**
- [ ] Update jobs page to display company names
- [ ] Show confidence scores
- [ ] Show evidence locations (WHERE emails found)
- [ ] Display extraction methods
- [ ] Add filters by confidence, pattern match
- [ ] Test performance
**Time:** 2-3 days
**Risk:** LOW

**Approval Gate:**
- UI displays correctly
- No performance regressions
- Responsive on mobile
- User feedback positive

---

### Phase 2G: Testing & Documentation (Week 4)
**Deliverable:** Comprehensive test coverage, production readiness
**Tasks:**
- [ ] Unit tests for all new modules
- [ ] Integration tests (end-to-end)
- [ ] Performance benchmarking
- [ ] Edge case testing
- [ ] Documentation updates
- [ ] Production readiness checklist
**Time:** 2-3 days
**Risk:** MEDIUM

**Approval Gate:**
- >85% test coverage
- All edge cases handled
- Performance targets met
- Ready for production

---

## Part 9: Backward Compatibility Matrix

| Feature | v1 API | v2 API | Note |
|---------|--------|--------|------|
| Email extraction | ✅ | ✅ | Identical results |
| Basic job retrieval | ✅ | ✅ | Identical |
| Search endpoint | ✅ | ✅ | Unchanged |
| Queue system | ✅ | ✅ | Unchanged |
| Worker system | ✅ | ✅ | Unchanged |
| Google PSE | ✅ | ✅ | Unchanged |
| Company detection | ❌ | ✅ | New feature |
| Confidence scores | ❌ | ✅ | New feature |
| Evidence tracking | ❌ | ✅ | New feature |
| Pattern matching | ⚠️ | ✅ | Stage 1 only (v1), Full 3-stage (v2) |
| Deobfuscation | ✅ | ✅ | 9 methods (v1), 20+ methods (v2) |

---

## Part 10: Data Migration Plan

### No Migration Needed ✅
- Redis stores new fields alongside old fields
- Existing jobs are unaffected
- Old API (v1) only reads email array (backward compatible)
- New API (v2) reads full object

### Example Migration Scenario
```
Old Job (still works):
{
  id: "job-123",
  emails: ["info@example.com"],
  status: "completed"
}

New Job (includes intelligence):
{
  id: "job-456",
  emails: ["info@example.com"],
  intelligence: { company: {...}, page: {...}, ... },
  status: "completed"
}

Both work simultaneously - no migration needed
```

---

## Part 11: Success Criteria

### Functional Success
- ✅ All 20+ deobfuscation methods working
- ✅ Company detection 85%+ accurate
- ✅ Evidence tracking 100% (every email has location)
- ✅ Confidence scores realistic and useful
- ✅ Pattern matching 3-stage working (Stage 1 already exists, add Stage 2-3)
- ✅ Intelligence objects properly structured

### Performance Success
- ✅ <12s extraction time per URL (95th percentile)
- ✅ <500ms deobfuscation time total
- ✅ No memory leaks
- ✅ Queue performance unchanged

### Compatibility Success
- ✅ v1 API returns identical results as before
- ✅ All existing searches work unchanged
- ✅ Old jobs still queryable
- ✅ No database migration needed

### Quality Success
- ✅ >85% test coverage
- ✅ <5% regression in extraction accuracy
- ✅ 0 breaking API changes
- ✅ Production-ready error handling

---

## Part 12: Risk Management

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Performance regression | MEDIUM | Profile each module, optimization budget |
| Memory leaks | MEDIUM | Profiling, watchdog monitoring |
| Deobfuscation false positives | MEDIUM | Validation rules, confidence thresholds |
| Data model incompatibility | LOW | Fields optional, backward compatible |
| API breaking changes | LOW | Dual API versions (v1 + v2) |
| Redis storage explosion | LOW | Optional fields, compression strategy |

---

## Part 13: Sign-Off Checklist

### Pre-Implementation
- [ ] Approve 3-stage pattern matching design
- [ ] Approve deobfuscation methods list (20+)
- [ ] Approve intelligence object data model
- [ ] Confirm backward compatibility approach
- [ ] Allocate team resources
- [ ] Set timeline expectations

### Phase Completion Gates
- [ ] Phase 2A: Deobfuscation methods approved
- [ ] Phase 2B: Intelligence modules approved
- [ ] Phase 2C: Engine integration approved
- [ ] Phase 2D: Queue model approved
- [ ] Phase 2E: API v2 approved
- [ ] Phase 2F: Dashboard UI approved
- [ ] Phase 2G: Production ready approved

### Go-Live
- [ ] All phases complete
- [ ] Test coverage >85%
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Team trained
- [ ] Monitoring alerts set
- [ ] Rollback plan ready

---

## Summary

**Phase 2 transforms your extraction engine from:**
```
Email extractor → Business Intelligence Platform
```

**With:**
- 20+ deobfuscation methods (industry-leading resilience)
- 3-stage pattern matching (query → URL → HTML)
- Rich intelligence objects (company, page metadata, evidence, confidence)
- Full backward compatibility (v1 API unchanged)
- Enterprise-grade data tracking

**Timeline:** 3-4 weeks  
**Risk Level:** Medium (phases 3 & 7)  
**Benefit:** SerpDigger-level intelligence + modular architecture  

---

## Next Steps

**Your Decision:**
1. ✅ Review this plan
2. ✅ Approve deobfuscation methods list
3. ✅ Approve intelligence object model
4. ✅ Confirm 3-stage pattern design
5. ✅ Authorize Phase 2A implementation

**Once Approved:**
- Start Phase 2A (deobfuscation methods)
- 3-4 day delivery
- Present results for approval
- Continue to Phase 2B

