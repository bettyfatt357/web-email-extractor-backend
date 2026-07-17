# Modular Intelligence Extraction Engine - Architecture Reference

**Quick Reference for Developers**

---

## Module Dependency Graph

```
┌────────────────────────────────────────────────────────────┐
│                  EXTRACTION ORCHESTRATOR                   │
│              (Coordinates all modules, manages timeout)    │
└────────────────────────────────────────────────────────────┘
        ↓
   ┌────┴────┬────────┬──────────┐
   ↓         ↓        ↓          ↓
┌──────┐  ┌──────┐  ┌───────┐  ┌──────┐
│ HTML │  │  JS  │  │Shadow │  │ PAGE │
│Extctr│  │Extctr│  │ DOM   │  │Parse │
└──────┘  └──────┘  └───────┘  └──────┘
   ↓         ↓        ↓          ↓
   └────┬────┴────┬───┴──────────┘
        ↓
   ┌────────────────────────────────┐
   │  DEOBFUSCATION ENGINE (15+)    │
   │  - 10 existing methods         │
   │  - 5 new methods               │
   │  - Confidence scoring          │
   │  - Pattern validation          │
   └────────────────────────────────┘
        ↓
   ┌────────────────────────────────┐
   │     EVIDENCE TRACKER           │
   │  - Source location detection   │
   │  - Context extraction          │
   │  - Email linking               │
   └────────────────────────────────┘
        ↓
   ┌────────────────────────────────┐
   │     COMPANY DETECTOR           │
   │  - Domain parsing              │
   │  - Metadata matching           │
   │  - Fuzzy matching              │
   └────────────────────────────────┘
        ↓
   ┌────────────────────────────────┐
   │  RESULT METADATA MANAGER       │
   │  - Assemble final result       │
   │  - Quality scoring             │
   │  - Prepare for storage         │
   └────────────────────────────────┘
        ↓
   INTELLIGENCE EXTRACTION RESULT
```

---

## Module File Structure

```
lib/extraction/
├── engine.ts (KEEP - main entry point)
│   └── exports: extractEmailsFromUrl()
│   └── REFACTORED to use Orchestrator
│
├── deobfuscate.ts (EXTEND - add new methods)
│   ├── Current: 10 methods
│   └── Add: CSS, alt text, data attrs, comments, JS vars
│
├── orchestrator.ts (NEW)
│   ├── Class: ExtractionOrchestrator
│   ├── Method: orchestrate(url, context, timeout)
│   └── Handles: module coordination, timeout management
│
├── modules/
│   ├── types.ts (NEW - shared interfaces)
│   │   ├── ExtractionModule interface
│   │   ├── HTMLExtractionResult
│   │   ├── JavaScriptExtractionResult
│   │   ├── ShadowDOMExtractionResult
│   │   ├── DeobfuscatedEmail
│   │   ├── ExtractionEvidence
│   │   ├── CompanyInfo
│   │   └── IntelligenceExtractionResult
│   │
│   ├── html-extractor.ts (NEW)
│   │   ├── Class: HTMLExtractor
│   │   ├── Method: extract(url, timeout)
│   │   ├── Returns: HTML + metadata + source locations
│   │   └── Time: <3s target
│   │
│   ├── javascript-extractor.ts (NEW)
│   │   ├── Class: JavaScriptExtractor
│   │   ├── Method: extract(url, timeout, depth)
│   │   ├── Returns: Rendered HTML + frameworks + console errors
│   │   └── Time: <8s target
│   │
│   ├── shadow-dom-extractor.ts (NEW)
│   │   ├── Class: ShadowDOMExtractor
│   │   ├── Method: extract(url, timeout, depth)
│   │   ├── Returns: Shadow DOM-specific emails
│   │   └── Time: <3s target
│   │
│   ├── deobfuscation-engine.ts (NEW)
│   │   ├── Class: DeobfuscationEngine
│   │   ├── Method: deobfuscate(text, patterns, domains)
│   │   ├── Returns: [DeobfuscatedEmail]
│   │   ├── Implements: 15+ methods, confidence scoring
│   │   └── Time: <500ms target
│   │
│   ├── evidence-tracker.ts (NEW)
│   │   ├── Class: EvidenceTracker
│   │   ├── Method: track(url, html, text, emails, metadata)
│   │   ├── Returns: ExtractionEvidence with source locations
│   │   ├── Implements: Location detection (hero, footer, etc)
│   │   └── Time: <100ms target
│   │
│   ├── company-detector.ts (NEW)
│   │   ├── Class: CompanyDetector
│   │   ├── Method: detect(url, metadata, emails)
│   │   ├── Returns: CompanyInfo
│   │   ├── Implements: URL parsing, metadata matching, fuzzy match
│   │   └── Time: <200ms target
│   │
│   └── result-metadata.ts (NEW)
│       ├── Class: ResultMetadataManager
│       ├── Method: assemble(allModuleResults)
│       ├── Returns: IntelligenceExtractionResult
│       ├── Implements: Aggregation, quality scoring
│       └── Time: <100ms target
│
└── utils/
    └── (existing utilities remain)
```

---

## Data Flow Diagram

### Current Flow

```
URL
 ↓
extractEmailsFromUrl()
 ├→ JSDOM extraction (10s timeout)
 ├→ If fail, Puppeteer (15s timeout)
 ↓
deobfuscateEmails(text)
 ├→ Apply 10 methods
 ├→ Collect all matches
 ↓
emails[] array
```

### Proposed Flow

```
URL + Context (keyword, patterns)
 ↓
ExtractionOrchestrator.orchestrate()
 │
 ├─ Step 1: HTMLExtractor.extract()
 │  ├→ Axios fetch (8s timeout)
 │  ├→ JSDOM parse
 │  ├→ Extract metadata (title, description, OG tags)
 │  ├→ Analyze structure (hero, footer, nav, contact, team)
 │  └→ Return: { html, text, metadata, sourceLocations }
 │
 ├─ Step 2: Detect if JavaScript-heavy
 │  └→ Check for <script>, framework indicators
 │
 ├─ Step 3: If JS-heavy, JavaScriptExtractor.extract()
 │  ├→ Puppeteer launch
 │  ├→ Navigate with timeouts
 │  ├→ Wait for networkidle2/domcontentloaded
 │  ├→ Detect frameworks (React, Vue, Angular, etc)
 │  ├→ Capture console errors
 │  └→ Return: { rendered HTML, frameworks, errors }
 │
 ├─ Step 4: Check for Shadow DOM
 │  └→ Puppeteer page.evaluate() to detect shadow roots
 │
 ├─ Step 5: If Shadow DOM, ShadowDOMExtractor.extract()
 │  ├→ Walk shadow DOM tree (depth 1-5)
 │  ├→ Track host elements
 │  └→ Extract shadow-specific content
 │
 ├─ Step 6: Combine all text sources
 │
 ├─ Step 7: DeobfuscationEngine.deobfuscate()
 │  ├→ Apply all 15+ methods
 │  ├→ Validate against user patterns
 │  ├→ Validate domains (optional DNS check)
 │  ├→ Calculate confidence per method
 │  └→ Return: [{ email, methods[], finalConfidence }]
 │
 ├─ Step 8: EvidenceTracker.track()
 │  ├→ Determine location (hero, footer, contact, etc)
 │  ├→ Extract surrounding context (50 chars before/after)
 │  ├→ Get CSS selector
 │  └→ Link emails to evidence
 │
 ├─ Step 9: CompanyDetector.detect()
 │  ├→ Parse domain
 │  ├→ Check OG tags (og:company, og:site_name)
 │  ├→ Check page title and meta tags
 │  ├→ Fuzzy match against candidates
 │  └→ Return: CompanyInfo
 │
 └─ Step 10: ResultMetadataManager.assemble()
    ├→ Aggregate all module results
    ├→ Calculate quality scores:
    │  ├→ totalEmailsFound
    │  ├→ highConfidenceEmails (>=80)
    │  ├→ pageRelevance (keyword match)
    │  └→ evidenceQuality (high/medium/low)
    └→ Return: IntelligenceExtractionResult
    
    ↓
    
IntelligenceExtractionResult
{
  emails: [{
    email: "user@example.com",
    confidence: 98,
    deobfuscationMethod: "direct",
    sourceLocation: { section: "contact", element: "<input>", context: "..." },
    matchedPatterns: ["*@example.com"],
    evidence: "Found in contact form"
  }],
  company: { name: "Example Corp", confidence: 95 },
  pageTitle: "Example Corp - Contact Us",
  metadata: { extractionMethod: "jsdom", extractionTime: 2134 },
  quality: { totalEmails: 5, highConfidence: 4, pageRelevance: 98 }
}
```

---

## Module Interface Contracts

### ExtractionModule (Base Interface)

```typescript
interface ExtractionModule {
  name: string;
  
  /**
   * Extract from URL
   * @param url - Target URL
   * @param timeout - Max execution time in ms
   * @returns Extraction result or null if timeout/error
   */
  extract(url: string, timeout: number): Promise<ExtractionModuleResult | null>;
  
  /**
   * Extract metadata from HTML
   * @param html - HTML content
   * @returns Structured metadata
   */
  extractMetadata(html: string): Promise<PageMetadata>;
}
```

### HTMLExtractor

```typescript
class HTMLExtractor implements ExtractionModule {
  /**
   * Fast extraction using JSDOM
   * @param url - Target URL
   * @param timeout - Max 10000ms
   */
  async extract(url: string, timeout: number): Promise<HTMLExtractionResult>
  
  /**
   * Timeout: 10 seconds
   * Returns: { html, text, metadata, sourceLocations, emails }
   */
}

interface HTMLExtractionResult {
  success: boolean;
  html: string;
  text: string;
  metadata: {
    pageTitle: string | null;
    pageDescription: string | null;
    ogTags: Record<string, string>;
    canonicalUrl: string | null;
  };
  sourceLocation: {
    inHead: boolean;
    inFooter: boolean;
    inNav: boolean;
    inContactForm: boolean;
    inTeamSection: boolean;
  };
  emails: Array<{ email: string; location: string }>;
  extractionTime: number;
}
```

### JavaScriptExtractor

```typescript
class JavaScriptExtractor implements ExtractionModule {
  /**
   * Dynamic extraction using Puppeteer
   * @param url - Target URL
   * @param timeout - Max 15000ms
   * @param jsExecutionDepth - 1-3, framework depth to wait for
   */
  async extract(
    url: string,
    timeout: number,
    jsExecutionDepth?: number
  ): Promise<JavaScriptExtractionResult>
}

interface JavaScriptExtractionResult extends HTMLExtractionResult {
  jsContent: string;
  waitStrategy: 'networkidle0' | 'networkidle2' | 'domcontentloaded';
  jsFrameworksDetected: string[];
  consoleErrors: string[];
  networkRequests: number;
}
```

### DeobfuscationEngine

```typescript
class DeobfuscationEngine {
  /**
   * Deobfuscate text using all methods
   * @param text - Text to deobfuscate
   * @param patterns - Optional user-defined patterns
   * @param allowedDomains - Optional domain whitelist
   */
  async deobfuscate(
    text: string,
    patterns?: string[],
    allowedDomains?: string[]
  ): Promise<DeobfuscatedEmail[]>
}

interface DeobfuscatedEmail {
  email: string;
  methods: {
    method: string;              // 'direct', 'base64', 'rot13', etc.
    confidence: number;          // 0-100
    evidence: string;            // Raw text containing email
  }[];
  domainInfo: {
    domain: string;
    isDomainValid: boolean;
  };
  patternMatches: {
    pattern: string;
    matches: boolean;
    score: number;                // 0-100
  }[];
  overallConfidence: number;     // 0-100
}
```

### EvidenceTracker

```typescript
class EvidenceTracker {
  /**
   * Track extraction evidence
   * @param url - URL extracted from
   * @param html - Full HTML
   * @param text - Text content
   * @param emails - Extracted emails
   * @param metadata - Page metadata
   */
  async track(
    url: string,
    html: string,
    text: string,
    emails: Array<{ email: string; rawValue: string }>,
    metadata: PageMetadata
  ): Promise<ExtractionEvidence>
}

interface ExtractionEvidence {
  url: string;
  pageTitle: string | null;
  sourceLocation: {
    section: 'hero' | 'nav' | 'footer' | 'contact' | 'team' | 'body';
    element: string;
    selector: string;
    context: string;
  };
  emailEvidence: Array<{
    email: string;
    contextBefore: string;
    contextAfter: string;
  }>;
}
```

### CompanyDetector

```typescript
class CompanyDetector {
  /**
   * Detect company information
   * @param url - Company URL
   * @param pageTitle - Page title
   * @param ogTags - Open Graph tags
   */
  detect(
    url: string,
    pageTitle: string | null,
    ogTags: Record<string, string>
  ): Promise<CompanyInfo>
}

interface CompanyInfo {
  companyName: string;
  domain: string;
  confidence: number;            // 0-100
  sources: {
    source: 'url' | 'title' | 'og:company' | 'og:site_name' | 'schema';
    value: string;
  }[];
}
```

### ResultMetadataManager

```typescript
class ResultMetadataManager {
  /**
   * Assemble final extraction result
   * @param htmlResult - HTML module output
   * @param jsResult - JS module output (optional)
   * @param deobfuscated - Deobfuscation engine output
   * @param evidence - Evidence tracker output
   * @param company - Company detector output
   */
  assemble(
    htmlResult: HTMLExtractionResult,
    jsResult: JavaScriptExtractionResult | undefined,
    deobfuscated: DeobfuscatedEmail[],
    evidence: ExtractionEvidence,
    company: CompanyInfo
  ): Promise<IntelligenceExtractionResult>
}

interface IntelligenceExtractionResult {
  company: { name: string; domain: string; confidence: number };
  pageTitle: string | null;
  pageDescription: string | null;
  
  emailsExtracted: Array<{
    email: string;
    confidence: number;           // 0-100
    validationStatus: 'valid' | 'questionable' | 'invalid';
    deobfuscationMethod: string;
    sourceLocation: {
      section: string;
      element: string;
      context: string;
    };
    matchedPatterns: string[];
    evidence: string;
  }>;
  
  metadata: {
    extractedOn: number;
    extractionMethod: 'jsdom' | 'puppeteer' | 'shadow-dom';
    extractionTime: number;
    jsFrameworksDetected: string[];
  };
  
  quality: {
    totalEmailsFound: number;
    highConfidenceEmails: number;
    pageRelevance: number;
    evidenceQuality: 'high' | 'medium' | 'low';
  };
}
```

---

## Deobfuscation Methods Reference

### Existing (10)

```
1. Direct Regex
   Pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
   Confidence base: 95
   Time: <10ms

2. [at] / (at) Replacement
   Text: "name[at]domain.com" → "name@domain.com"
   Confidence base: 85
   Time: <10ms

3. [dot] / (dot) Replacement
   Text: "domain[dot]com" → "domain.com"
   Confidence base: 85
   Time: <10ms

4. HTML Entity Decoding
   Text: "&#64;" → "@", "&#46;" → "."
   Confidence base: 90
   Time: <20ms

5. Base64 Decoding
   Text: [Base64 string] → decoded text
   Confidence base: 70
   Time: <30ms

6. Mailto Links
   Text: "mailto:email@domain" → "email@domain"
   Confidence base: 95
   Time: <10ms

7. Reverse String Detection
   Text: "moc.niamod@eman" → "name@domain.com"
   Confidence base: 80
   Time: <20ms

8. ROT13 Encoding
   Text: Character substitution (a→n, b→o, etc)
   Confidence base: 75
   Time: <30ms

9. URL Encoding
   Text: "%40" → "@", "%2E" → "."
   Confidence base: 85
   Time: <10ms

10. JSON Structured Data
    Text: {"email": "user@domain.com"}
    Confidence base: 80
    Time: <20ms
```

### New (5+)

```
11. CSS Content Property
    Text: ::after { content: "user@example" }
    Confidence base: 50
    Time: <50ms
    Implementation: Parse <style> tags, extract content

12. Image Alt Text
    Text: <img alt="Contact: user@example.com">
    Confidence base: 70
    Time: <20ms
    Implementation: Parse img alt attributes

13. Data Attributes
    Text: <span data-email="user@example.com">
    Confidence base: 75
    Time: <30ms
    Implementation: Parse data-* attributes

14. HTML Comments
    Text: <!-- user@example.com -->
    Confidence base: 65
    Time: <10ms
    Implementation: Extract HTML comment nodes

15. JavaScript Variables
    Text: var email = "user@example.com"
    Confidence base: 60
    Time: <40ms
    Implementation: Simple regex for var/const/let assignments

16. Atbash Cipher
    Text: Mirror alphabet substitution (a↔z, b↔y)
    Confidence base: 70
    Time: <20ms
    Implementation: Custom cipher reversal

17. Caesar Cipher
    Text: Configurable shift (try 1-25)
    Confidence base: 65
    Time: <100ms
    Implementation: Try all shifts, validate against patterns
```

---

## Confidence Scoring Algorithm

### Method Confidence (Base)

Each method has inherent reliability:

```
High (90+):        Direct regex, Mailto links
Medium-High (80+): HTML entities, URL encoding, Data attributes
Medium (70-79):    Base64, JSON, Image alt text, CSS content
Medium-Low (60-69): ROT13, Reverse string, JS variables, Caesar
Low (50-59):       Atbash, CSS content as fallback
```

### Modifiers (Applied to Base)

```
Pattern validation:
  - Matches user pattern:           +20 to +30
  - Doesn't match pattern:           -30 to -50
  - No pattern defined:              +0

Domain validation:
  - Valid domain (format):           +10
  - Domain has DNS records:          +10
  - Common spam domain:              -20

Context validation:
  - Multiple methods extract same:   +15 per additional method
  - Surrounded by name/person:       +10
  - Suspicious context:              -15

Multiple confirmations:
  - 2 methods extract same email:    +10
  - 3+ methods extract same:         +20
```

### Final Calculation

```
overallConfidence = 
  (sum of all method confidences) / (number of methods)
  
clamped to [0, 100]

Example:
  - Direct regex finds email:        confidence = 95
  - Matches user pattern:            +25 → 120 (clamped 100)
  - Final confidence:                100
  
Example 2:
  - Base64 finds email:              confidence = 70
  - Doesn't match pattern:           -40 → 30
  - Domain validation fails:         -20 → 10
  - Final confidence:                10
```

---

## Performance Targets

### Module Timeouts

```
HTMLExtractor:        < 3 seconds  (Axios + JSDOM)
JavaScriptExtractor:  < 8 seconds  (Puppeteer)
ShadowDOMExtractor:   < 3 seconds  (Page evaluation)
DeobfuscationEngine:  < 500ms      (All 17 methods)
EvidenceTracker:      < 100ms      (DOM analysis)
CompanyDetector:      < 200ms      (String operations)
ResultMetadataManager: < 100ms     (Aggregation)
─────────────────────────────────
Total per URL:        < 12 seconds (95th percentile)
```

### Optimization Strategies

```
HTMLExtractor:
  - HTTP timeout: 8s (1s buffer for processing)
  - Parallel DNS resolution
  - Connection pooling (axios agent)

JavaScriptExtractor:
  - Browser instance reuse (if possible)
  - Resource blocking (stylesheets, images)
  - Progressive wait strategy fallback

DeobfuscationEngine:
  - Regex pre-compilation cache
  - Early exit on high-confidence match
  - Parallel method execution (async Promise.all)

Overall:
  - Module cascading (run in sequence, not parallel initially)
  - Timeout propagation (remaining time to next module)
  - Graceful degradation (skip slow modules if time low)
```

---

## Error Handling Strategy

### Module-Level Errors

```
HTML Extraction fails:
  → Log error, continue to JS extraction if time available
  
JS Extraction fails:
  → Log error, continue to deobfuscation with HTML-only text
  
Shadow DOM fails:
  → Log error (non-critical), continue to deobfuscation
  
Deobfuscation fails:
  → Log error, return empty emails array
  → Still process evidence/metadata with available data
  
Company Detection fails:
  → Log error, return null company info
  → Continue to result assembly
```

### Orchestrator Error Handling

```
Total timeout exceeded:
  → Return best available result so far
  → Mark quality as 'low' if incomplete
  
All modules fail:
  → Return error response with original URL
  → Log for debugging
  
Partial failures:
  → Use available module outputs
  → Mark quality appropriately
  → Return incomplete but valid result
```

---

## Testing Strategy

### Unit Tests

```
HTMLExtractor:
  ✓ Parse HTML metadata
  ✓ Detect source locations (hero, footer, etc)
  ✓ Extract emails from text
  ✓ Handle timeouts gracefully
  ✓ Handle invalid HTML

JavaScriptExtractor:
  ✓ Detect JS frameworks
  ✓ Wait strategies work
  ✓ Render dynamic content
  ✓ Capture console errors
  ✓ Handle navigation errors

DeobfuscationEngine:
  ✓ All 17 methods work
  ✓ Confidence calculation correct
  ✓ Pattern matching works
  ✓ Multiple method deduplication

EvidenceTracker:
  ✓ Correct source location detection
  ✓ Context extraction accuracy
  ✓ CSS selector generation

CompanyDetector:
  ✓ Domain parsing (various TLDs)
  ✓ Fuzzy matching
  ✓ OG tag extraction

ResultMetadataManager:
  ✓ Quality score calculation
  ✓ Data aggregation
  ✓ Confidence normalization
```

### Integration Tests

```
Full pipeline:
  ✓ URL → Final result (success path)
  ✓ HTML-only path (no JS)
  ✓ JS-heavy path (with Puppeteer)
  ✓ Timeout handling per module
  ✓ Partial failures recovery
  ✓ Queue integration (store rich metadata)
  ✓ API response formatting
```

### Performance Tests

```
✓ HTML extraction < 3s (10 test pages)
✓ JS extraction < 8s (10 dynamic sites)
✓ Deobfuscation < 500ms (1000 emails)
✓ Total pipeline < 12s (10 diverse URLs)
✓ Concurrency test (100 parallel jobs)
✓ Memory profiling (no leaks)
```

---

## Deployment Checklist

```
Before going live:

✓ All unit tests passing (>80% coverage)
✓ Integration tests passing
✓ Performance benchmarks met
✓ Manual testing on 50 sample pages
✓ Load testing (100 concurrent jobs)
✓ Memory profiling done
✓ Error logging verified
✓ Monitoring/alerts configured
✓ API versioning plan approved
✓ Migration plan documented
✓ Rollback plan documented
✓ Team trained on new modules
✓ Documentation updated
✓ Production config reviewed
```

---

**END OF REFERENCE**

