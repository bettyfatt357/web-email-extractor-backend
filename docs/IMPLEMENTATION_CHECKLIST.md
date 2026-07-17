# Intelligence Extraction Engine - Implementation Checklist

**Status:** READY FOR APPROVAL  
**Last Updated:** July 17, 2026

---

## Pre-Implementation Review Checklist

### Design Validation
- [ ] **Review Design Document** (`INTELLIGENCE_EXTRACTION_ENGINE_DESIGN.md`)
  - Architecture diagram understood
  - All 7 modules scope clear
  - Data model changes documented
  
- [ ] **Approve Critical Decisions**
  - [ ] Pattern Matching Strategy: Choose Option A/B/C (see 7.1)
  - [ ] Company Detection Approach: Choose Option A/B/C (see 7.2)
  - [ ] Confidence Scoring Algorithm: Choose Option A/B/C (see 7.3)
  - [ ] Evidence Storage Strategy: Define limits (see 7.4)
  - [ ] API Versioning: Choose Option A/B/C (see 7.5)

- [ ] **Validate File Structure**
  ```
  lib/extraction/
    ├── engine.ts (KEEP - main orchestrator)
    ├── deobfuscate.ts (EXTEND - add new methods)
    ├── modules/
    │   ├── html-extractor.ts (NEW)
    │   ├── javascript-extractor.ts (NEW)
    │   ├── shadow-dom-extractor.ts (NEW)
    │   ├── deobfuscation-engine.ts (NEW)
    │   ├── evidence-tracker.ts (NEW)
    │   ├── company-detector.ts (NEW)
    │   └── result-metadata.ts (NEW)
    └── orchestrator.ts (NEW - coordinates all modules)
  ```

- [ ] **Review Breaking Changes**
  - Job interface gets new fields (backward compatible JSON)
  - API response structure changes (needs version or dual support)
  - Storage requirements increase (~25-50x per large campaign)

---

## Phase 1: Foundation Setup (Weeks 1-2)

### 1.1 Create Module Structure
- [ ] Create `/lib/extraction/modules/` directory
- [ ] Create base interfaces in `/lib/extraction/modules/types.ts`:
  ```typescript
  interface ExtractionModule {
    name: string;
    extractEmails(url: string, timeout: number): Promise<ModuleResult>;
    extractMetadata(html: string): Promise<PageMetadata>;
  }
  ```

### 1.2 Extend Deobfuscation System
- [ ] Backup current `/lib/extraction/deobfuscate.ts`
- [ ] Add 5 new deobfuscation methods:
  - [ ] CSS Content Property extraction
  - [ ] Image Alt Text parsing
  - [ ] Data Attributes exploration
  - [ ] HTML Comments extraction
  - [ ] JavaScript string variable detection
  
- [ ] Implement DeobfuscationResult with method tracking:
  ```typescript
  interface DeobfuscationResult {
    email: string;
    methods: Array<{
      method: string;
      confidence: number;
      evidence: string;
    }>;
    finalConfidence: number;
  }
  ```

### 1.3 Create Evidence Tracker Module
- [ ] File: `/lib/extraction/modules/evidence-tracker.ts`
- [ ] Implement source location detection algorithm:
  - [ ] Hero/header detection (top 200px)
  - [ ] Footer detection (>80% page height or `<footer>` tag)
  - [ ] Contact page detection (title + form patterns)
  - [ ] Team page detection (title + people patterns)
  - [ ] Navigation detection (`<nav>` + menu patterns)
  
- [ ] Implement context extraction:
  - [ ] Get 50 chars before and after email
  - [ ] Extract CSS selector path
  - [ ] Determine containing element type

### 1.4 Extend Job Interface
- [ ] Modify `/lib/queue/types.ts` - Add new fields to `Job` interface:
  ```typescript
  // Add these fields
  extractionMethod?: 'jsdom' | 'puppeteer' | 'shadow-dom';
  pageTitle?: string | null;
  pageDescription?: string | null;
  detectedCompany?: {
    name: string;
    confidence: number;
  };
  matchedKeyword?: string;
  matchedPatterns?: string[];
  emailsWithEvidence?: Array<{ /* rich email data */ }>;
  quality?: {
    totalEmailsFound: number;
    highConfidenceEmails: number;
    pageRelevance: number;
  };
  ```

- [ ] Maintain backward compatibility:
  - [ ] Keep `emails: string[]` field for legacy support
  - [ ] JSON serialization still works

### 1.5 Update Queue System
- [ ] Modify `/lib/queue/queue.ts` - Update `markCompleted()`:
  ```typescript
  async markCompleted(
    jobId: string, 
    emails: string[],
    evidence?: ExtractionEvidence,  // NEW
    metadata?: ResultMetadata         // NEW
  ): Promise<void>
  ```
  
- [ ] Update Redis schema to store extended fields
- [ ] Add migration path for existing jobs

### 1.6 Add Tests
- [ ] Unit tests for Evidence Tracker
- [ ] Unit tests for new deobfuscation methods
- [ ] Integration tests for queue updates

---

## Phase 2: Advanced Extraction Modules (Weeks 2-3)

### 2.1 HTML Extraction Module
- [ ] File: `/lib/extraction/modules/html-extractor.ts`
- [ ] Implement `HTMLExtractor` class:
  ```typescript
  class HTMLExtractor {
    async extract(url: string, timeout: number): Promise<HTMLExtractionResult>
  }
  ```

- [ ] Features:
  - [ ] Use JSDOM for DOM parsing
  - [ ] Extract page metadata (title, description, OG tags)
  - [ ] Parse canonical URL
  - [ ] Detect source locations (hero, footer, contact, team, nav)
  - [ ] Extract raw email locations before deobfuscation
  - [ ] Return structured result with metadata

- [ ] Tests:
  - [ ] Test with 10 sample pages (various structures)
  - [ ] Verify metadata extraction
  - [ ] Verify source location detection accuracy
  - [ ] Performance: <3s extraction time

### 2.2 JavaScript Extraction Module
- [ ] File: `/lib/extraction/modules/javascript-extractor.ts`
- [ ] Implement `JavaScriptExtractor` class:
  ```typescript
  class JavaScriptExtractor {
    async extract(
      url: string, 
      timeout: number,
      jsExecutionDepth?: number
    ): Promise<JavaScriptExtractionResult>
  }
  ```

- [ ] Features:
  - [ ] Use Puppeteer for dynamic content
  - [ ] Implement progressive wait strategies (networkidle2 → domcontentloaded)
  - [ ] Detect JavaScript frameworks (React, Vue, Angular, etc.)
  - [ ] Capture console errors for debugging
  - [ ] Track network requests
  - [ ] Extract rendered HTML after JS execution

- [ ] Tests:
  - [ ] Test with React/Vue/Angular sites
  - [ ] Verify framework detection
  - [ ] Verify timeout handling
  - [ ] Performance: <8s extraction time

### 2.3 Shadow DOM Extraction Module
- [ ] File: `/lib/extraction/modules/shadow-dom-extractor.ts`
- [ ] Implement `ShadowDOMExtractor` class:
  ```typescript
  class ShadowDOMExtractor {
    async extract(
      url: string,
      timeout: number,
      shadowDomDepth?: number
    ): Promise<ShadowDOMExtractionResult>
  }
  ```

- [ ] Features:
  - [ ] Use Puppeteer page.evaluate() for shadow DOM walking
  - [ ] Recursively search shadow roots
  - [ ] Track host element paths
  - [ ] Return shadow DOM-specific emails

- [ ] Tests:
  - [ ] Test with Web Component sites
  - [ ] Verify nested shadow DOM handling
  - [ ] Verify host element tracking

### 2.4 Company Detector Module
- [ ] File: `/lib/extraction/modules/company-detector.ts`
- [ ] Implement `CompanyDetector` class:
  ```typescript
  class CompanyDetector {
    detect(input: CompanyDetectionInput): Promise<CompanyInfo>
  }
  ```

- [ ] Detection methods:
  - [ ] **URL-based:** Parse domain, handle subdomains, handle hyphens
  - [ ] **Metadata-based:** OG tags, meta tags, schema.org
  - [ ] **Title-based:** Extract org name from page title
  - [ ] **Fuzzy matching:** Match extracted names against candidates

- [ ] Implementation:
  - [ ] Implement domain parser (handle .co.uk, .io, etc.)
  - [ ] Implement title parser
  - [ ] Implement fuzzy string matching (Levenshtein distance)
  - [ ] Implement schema.org parser

- [ ] Tests:
  - [ ] Test with 20 diverse company websites
  - [ ] Verify accuracy of company name extraction
  - [ ] Verify confidence scoring

---

## Phase 3: Intelligence Layer (Week 3-4)

### 3.1 Deobfuscation Engine
- [ ] File: `/lib/extraction/modules/deobfuscation-engine.ts`
- [ ] Extend `/lib/extraction/deobfuscate.ts` with:
  - [ ] 5 new deobfuscation methods (see Phase 1.2)
  - [ ] Confidence scoring per method
  - [ ] Pattern matching engine
  - [ ] Domain validation
  - [ ] Method tracking

- [ ] Implement `DeobfuscationEngine` class:
  ```typescript
  class DeobfuscationEngine {
    deobfuscate(
      text: string,
      patterns?: string[],
      allowedDomains?: string[]
    ): Promise<DeobfuscatedEmail[]>
  }
  ```

- [ ] Confidence scoring algorithm:
  - [ ] Base confidence per method (0-100)
  - [ ] Pattern match bonus (+20-30)
  - [ ] Domain validation bonus (+10)
  - [ ] Multi-method extraction bonus (+15 per additional method)
  - [ ] Final confidence = average of all methods, clamped 0-100

- [ ] Tests:
  - [ ] Test each deobfuscation method with 5+ examples
  - [ ] Test confidence scoring accuracy
  - [ ] Test pattern matching
  - [ ] Test domain validation

### 3.2 Result Metadata Manager
- [ ] File: `/lib/extraction/modules/result-metadata.ts`
- [ ] Implement `ResultMetadataManager` class:
  ```typescript
  class ResultMetadataManager {
    assemble(input: AssemblyInput): Promise<IntelligenceExtractionResult>
  }
  ```

- [ ] Features:
  - [ ] Aggregate data from all modules
  - [ ] Calculate quality scores
  - [ ] Assemble final result object
  - [ ] Prepare for storage

- [ ] Quality scoring:
  - [ ] High-confidence count (>=80)
  - [ ] Page relevance (keyword match score)
  - [ ] Evidence quality (high/medium/low)

- [ ] Tests:
  - [ ] Test assembly of complete result
  - [ ] Verify quality score calculation
  - [ ] Verify data integrity

### 3.3 Extraction Orchestrator
- [ ] File: `/lib/extraction/orchestrator.ts`
- [ ] Implement `ExtractionOrchestrator` class:
  ```typescript
  class ExtractionOrchestrator {
    async orchestrate(
      url: string,
      jobContext: JobContext,
      timeout: number
    ): Promise<IntelligenceExtractionResult>
  }
  ```

- [ ] Orchestration logic:
  - [ ] **Step 1:** HTML Extraction (if time allows)
  - [ ] **Step 2:** Detect if JS-heavy (if time allows)
  - [ ] **Step 3:** JS Extraction (if JS detected)
  - [ ] **Step 4:** Shadow DOM check (if time allows)
  - [ ] **Step 5:** Deobfuscation (all methods)
  - [ ] **Step 6:** Evidence Tracking
  - [ ] **Step 7:** Company Detection
  - [ ] **Step 8:** Result Assembly

- [ ] Timeout management:
  - [ ] Total timeout: 20s (existing)
  - [ ] Progressive timeout reduction per step
  - [ ] Graceful degradation (skip JS if timeout approaching)

- [ ] Tests:
  - [ ] Test full orchestration flow
  - [ ] Test timeout handling
  - [ ] Test graceful degradation
  - [ ] Test performance (20s max per URL)

---

## Phase 4: Integration & Testing (Week 4-5)

### 4.1 Update Worker Pipeline
- [ ] Modify `/lib/worker/worker.ts`:
  - [ ] Replace `extractEmailsFromUrl()` call with `orchestrator.orchestrate()`
  - [ ] Pass job context (keyword, patterns) to orchestrator
  - [ ] Update `queue.markCompleted()` to store rich metadata

- [ ] Implementation:
  ```typescript
  const result = await orchestrator.orchestrate(
    job.url,
    {
      keyword: job.query,
      patterns: extractPatterns(job),
    },
    remainingTime
  );
  
  await queue.markCompleted(
    job.id,
    result.emailsExtracted.map(e => e.email),
    result.evidence,
    result.metadata
  );
  ```

- [ ] Tests:
  - [ ] Integration test with real queue
  - [ ] Verify metadata is stored correctly
  - [ ] Verify backward compatibility

### 4.2 Update Dashboard Result API
- [ ] Modify `/app/api/job/[id]/result/route.ts`:
  - [ ] Return extended metadata (not just emails)
  - [ ] Support API versioning (v1 for old format, v2 for new)
  - [ ] Or add query parameter `?format=rich`

- [ ] New response format:
  ```json
  {
    "id": "job-123",
    "company": { "name": "...", "confidence": 95 },
    "pageTitle": "...",
    "emails": [
      {
        "email": "...",
        "confidence": 95,
        "sourceLocation": { "section": "contact", ... },
        "matchedPatterns": ["*@acme.com"],
        "evidence": "Found in contact form"
      }
    ],
    "metadata": { "extractionMethod": "jsdom", ... },
    "quality": { "totalEmails": 5, "highConfidence": 4, ... }
  }
  ```

- [ ] Tests:
  - [ ] Verify response structure
  - [ ] Verify data completeness
  - [ ] Backward compatibility tests

### 4.3 Update Dashboard UI
- [ ] Modify search results display:
  - [ ] Show company name alongside URL
  - [ ] Show page title
  - [ ] Show confidence scores
  - [ ] Show source location (hero, footer, contact, etc.)
  - [ ] Show matched patterns

- [ ] Add result filters:
  - [ ] Filter by confidence level
  - [ ] Filter by company
  - [ ] Filter by source location
  - [ ] Filter by deobfuscation method

- [ ] Tests:
  - [ ] Visual regression testing
  - [ ] Responsive design tests
  - [ ] Data display accuracy

### 4.4 Comprehensive Testing
- [ ] **Unit Tests:** All modules (80%+ coverage)
- [ ] **Integration Tests:** Full pipeline (queue → orchestrator → storage → API)
- [ ] **Performance Tests:** 
  - [ ] HTML extraction: <3s
  - [ ] JS extraction: <8s
  - [ ] Deobfuscation: <500ms
  - [ ] Total: <12s per URL (95th percentile)
- [ ] **Load Tests:** 100 concurrent extractions
- [ ] **Regression Tests:** Existing functionality still works

---

## Phase 5: Performance & Polish (Week 5-6)

### 5.1 Performance Optimization
- [ ] Profile module execution times
- [ ] Identify bottlenecks
- [ ] Optimize hot paths:
  - [ ] Regex compilation caching
  - [ ] Pattern matching early exit
  - [ ] Puppeteer resource reuse

- [ ] Add caching layer:
  - [ ] Cache company detection results (by domain)
  - [ ] Cache pattern compilation results
  - [ ] Cache page metadata (24h TTL)

### 5.2 Monitoring & Logging
- [ ] Add detailed logging to orchestrator
- [ ] Add metrics:
  - [ ] Module execution times
  - [ ] Extraction success rates
  - [ ] Confidence score distribution
  - [ ] Storage usage trends

- [ ] Add alerts:
  - [ ] Extraction timeouts
  - [ ] High failure rates
  - [ ] Storage quota warnings

### 5.3 Documentation
- [ ] Document module architecture
- [ ] Add inline code comments
- [ ] Create troubleshooting guide
- [ ] Document API changes

### 5.4 Migration Path
- [ ] Create data migration script (for existing jobs)
- [ ] Add deprecation warnings for old API
- [ ] Plan timeline for API v1 sunset

---

## Critical Decisions Before Implementation

**User MUST Approve:**

1. **Pattern Matching Strategy** (Section 7.1)
   - [ ] Option A: Strict regex (fast, limited)
   - [ ] Option B: Fuzzy matching (flexible, slower)
   - [ ] Option C: ML classification (powerful, complex)
   - **Decision:** ___________

2. **Company Detection** (Section 7.2)
   - [ ] Option A: URL parsing only
   - [ ] Option B: URL + metadata matching
   - [ ] Option C: Third-party API integration
   - **Decision:** ___________

3. **Confidence Scoring** (Section 7.3)
   - [ ] Option A: Simple average
   - [ ] Option B: Weighted average
   - [ ] Option C: ML model-based
   - **Decision:** ___________

4. **Evidence Storage** (Section 7.4)
   - [ ] How many bytes per email for context?
   - [ ] Pagination strategy for large results?
   - [ ] Archival policy?
   - **Decision:** ___________

5. **API Versioning** (Section 7.5)
   - [ ] Option A: Dual format support (big payload)
   - [ ] Option B: API versioning (v1 vs v2)
   - [ ] Option C: Migration flag (break change)
   - **Decision:** ___________

---

## Sign-Off Checklist

### Design Review
- [ ] Design document reviewed and approved
- [ ] Architecture understood by team
- [ ] Critical decisions documented
- [ ] Risks acknowledged and mitigated

### Timeline & Resources
- [ ] 5-6 week timeline acceptable
- [ ] Resources allocated
- [ ] Dependencies resolved

### Success Criteria
- [ ] Feature parity with SerpDigger achieved
- [ ] 95%+ confidence on high-quality emails
- [ ] <12s per URL extraction time
- [ ] Dashboard displays rich metadata
- [ ] Backward compatibility maintained

### Risk Acknowledgment
- [ ] Redis storage costs may increase 25-50x
- [ ] Module complexity requires careful testing
- [ ] Performance optimization critical
- [ ] User patterns require documentation

---

**Ready to Proceed?** 

Once user approves above, send implementation plan to team and begin Phase 1.

