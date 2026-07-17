# Intelligence Extraction Engine - Design Document

**Version:** 1.0  
**Date:** July 17, 2026  
**Status:** DESIGN PHASE (No code changes approved yet)

---

## Executive Summary

This document outlines a modular, enterprise-grade Intelligence Extraction Engine designed to rival **SerpDigger** capabilities. The current extraction pipeline is functional but limited in evidence tracking, metadata capture, and pattern validation. This design proposes a comprehensive modularization that extends the engine with:

- **Evidence tracking** (page title, source location, matched patterns)
- **Advanced email deobfuscation** (pattern matching, validation, confidence scoring)
- **Company detection** (domain parsing, fuzzy matching, metadata extraction)
- **Result metadata** (comprehensive tracking of extraction context)
- **Multi-strategy extraction** (HTML DOM, JavaScript execution, shadow DOM handling)

---

## Part 1: CURRENT STATE ANALYSIS

### 1.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT PIPELINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Search Form  →  Google API  →  URL Queue  →  Worker  →   │
│                                              Extraction     │
│                                              Engine         │
│                                                  ↓           │
│                                              Email Array    │
│                                                  ↓           │
│                                              Result API    │
│                                                  ↓           │
│                                              Dashboard     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Current Extraction Engine Capabilities

**File:** `/lib/extraction/engine.ts`

| Component | Status | Details |
|-----------|--------|---------|
| **JSDOM Extraction** | ✅ Implemented | Fast static content extraction, 10s timeout |
| **Puppeteer Fallback** | ✅ Implemented | JavaScript-heavy site handling, 15s timeout |
| **Concurrency Control** | ✅ Implemented | Max 3 concurrent browsers, proper cleanup |
| **Timeout Management** | ✅ Implemented | 20s job timeout with cascade fallback |
| **User Agent Spoofing** | ✅ Implemented | Desktop user agent to bypass detection |
| **HTML Size Limits** | ✅ Implemented | 10 MB max HTML to prevent DoS |
| **Redirect Handling** | ✅ Implemented | Max 5 redirects, configurable |
| **Page Metadata Capture** | ❌ Missing | No page title, description, or metadata |
| **Source Location Tracking** | ❌ Missing | No tracking of where email found on page |
| **Extraction Context** | ❌ Missing | No surrounding text or evidence |

### 1.3 Current Deobfuscation Methods

**File:** `/lib/extraction/deobfuscate.ts`

| Method | Status | Coverage |
|--------|--------|----------|
| **Direct Regex** | ✅ | Standard email format `name@domain.com` |
| **[at] / (at) replacement** | ✅ | Common obfuscation: `name[at]domain.com` |
| **[dot] / (dot) replacement** | ✅ | Common obfuscation: `name@domain[dot]com` |
| **HTML Entity Decoding** | ✅ | `&#64;`, `&#46;`, etc. + named entities |
| **Base64 Decoding** | ✅ | Base64-encoded email strings |
| **Mailto Links** | ✅ | `mailto:email@domain.com` extraction |
| **Reverse String Detection** | ✅ | Emails reversed in source |
| **ROT13 Encoding** | ✅ | Simple character substitution |
| **URL Encoding** | ✅ | Percent-encoded emails |
| **JSON Structured Data** | ✅ | `{"email": "..."}` pattern |
| **Email Pattern Matching** | ❌ | No custom pattern validation |
| **Confidence Scoring** | ❌ | No confidence metrics on extracted emails |
| **Obfuscation Detection** | ❌ | No tracking of which method extracted email |
| **Domain Validation** | ❌ | Only basic regex, no DNS/MX checks |

### 1.4 Current Result Metadata Storage

**File:** `/lib/queue/types.ts`

```typescript
interface Job {
  id: string;
  url: string;
  normalizedUrl?: string;
  status: JobStatus;
  emails: string[];           // ← Only emails stored
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  processingTime?: number;
  emailsFound?: number;
  error: string | null;
  source?: string;            // 'google_pse'
  query?: string;             // Keyword used
  domain?: string;            // Extracted from URL
  attempts?: number;          // Retry count
}
```

**Missing Fields:**
- `pageTitle` - Title of extracted page
- `pageDescription` - Meta description
- `pageSnippet` - Context around email
- `sourceLocation` - Where on page email found (hero, footer, contact page, etc.)
- `matchedPattern` - Which pattern/keyword matched
- `matchedDeobfuscationMethod` - How was email deobfuscated
- `companyName` - Extracted company name
- `confidence` - Email confidence score (0-100)
- `evidence` - Array of extracted context
- `extractionMethod` - 'jsdom' or 'puppeteer'
- `pageMetadata` - title, description, og:image, etc.

### 1.5 Current Search System Integration

**Pattern Support:** ❌ **PARTIAL ONLY**

From `/lib/search/query-generator.ts`:
```typescript
// Patterns only used for site: filtering in queries
const domainPattern = patterns[0].startsWith('@') 
  ? patterns[0].substring(1) 
  : patterns[0];
contactQuery += ` site:${domainPattern}`;
```

**Issue:** Patterns are NOT tracked back to individual emails. When a URL is added to queue:
```typescript
const jobId = await queue.addJob(url, 'google_pse', keyword);
// Pattern metadata is LOST here - not passed to queue
```

---

## Part 2: SERPDIGGER CAPABILITY COMPARISON

### 2.1 Feature Matrix

| Feature | SerpDigger | Current | Gap |
|---------|------------|---------|-----|
| **Keywords** | ✅ Multi-keyword search | ✅ Supported | None |
| **Patterns** | ✅ Email pattern validation | ⚠️ Search only | Critical |
| **Location** | ✅ Geographic targeting | ✅ Supported | None |
| **Search Depth** | ✅ Multi-page results | ✅ 1-5 pages | None |
| **Company Detection** | ✅ Auto-extract company names | ❌ Not implemented | Major |
| **Email Validation** | ✅ Pattern-based validation | ⚠️ Regex only | Moderate |
| **Evidence Tracking** | ✅ Page title, source location | ❌ Not captured | Critical |
| **Page Metadata** | ✅ OG tags, descriptions | ❌ Not captured | Major |
| **Confidence Scoring** | ✅ Per-email confidence | ❌ Not implemented | Moderate |
| **Deobfuscation Methods** | ✅ 15+ methods | ✅ 10 methods | Minor |
| **Result Export** | ✅ CSV/JSON with all metadata | ⚠️ Email array only | Major |
| **Batch Processing** | ✅ Campaign management | ⚠️ Single job tracking | Moderate |
| **Duplicate Detection** | ✅ Cross-keyword deduplication | ✅ Implemented | None |
| **Rate Limiting** | ✅ Per-user, per-provider | ✅ Implemented | None |
| **Multi-CSE Support** | ✅ Multiple search engines | ❌ Single CSE only | Moderate |

### 2.2 Critical Gaps

**TIER 1 - CRITICAL (Blocks SerpDigger parity):**

1. **Pattern Matching for Email Validation**
   - SerpDigger: Users define patterns like `name@domain.com`, `firstname.lastname@company.com`
   - Current: Patterns only used in search queries, not for email validation
   - Impact: Cannot filter results by user-defined email patterns

2. **Evidence & Context Tracking**
   - SerpDigger: Shows WHERE email was found (hero, footer, contact page, team page, etc.)
   - Current: Only stores email address, no context
   - Impact: Cannot verify email or trace finding

3. **Company Name Extraction**
   - SerpDigger: Auto-extracts and verifies company names
   - Current: Not implemented
   - Impact: Cannot group results by company, cannot verify company match

4. **Page Metadata Capture**
   - SerpDigger: Captures page title, description, OG tags
   - Current: Not captured (JSDOM/Puppeteer HTML available but not extracted)
   - Impact: Cannot verify page relevance or use for company matching

**TIER 2 - MAJOR (Affects result quality):**

5. **Confidence Scoring**
   - SerpDigger: Per-email confidence (0-100%) based on multiple factors
   - Current: All emails treated equally
   - Impact: Users cannot filter low-confidence results

6. **Deobfuscation Method Tracking**
   - SerpDigger: Shows which method extracted email
   - Current: Method not tracked
   - Impact: Cannot assess email validity by extraction method

7. **Multi-CSE Support**
   - SerpDigger: Can use multiple Google Custom Search Engines
   - Current: Single GOOGLE_CX only
   - Impact: Limited search coverage

---

## Part 3: MODULAR INTELLIGENCE EXTRACTION ENGINE DESIGN

### 3.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  MODULAR INTELLIGENCE EXTRACTION ENGINE                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     EXTRACTION ORCHESTRATOR                      │   │
│  │  (Decides which extractors to use, coordinates module flow)     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    EXTRACTION MODULES                            │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │  │
│  │  │   HTML Module    │  │ JavaScript Mod.  │  │ Shadow DOM   │ │  │
│  │  │  (JSDOM)         │  │ (Puppeteer)      │  │ Module       │ │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘ │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 EMAIL DEOBFUSCATION ENGINE                       │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  • 15+ deobfuscation methods with method tracking               │  │
│  │  • Confidence scoring per email                                │  │
│  │  • Domain validation                                           │  │
│  │  • Pattern matching against user-defined patterns             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                METADATA & EVIDENCE TRACKING                     │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  • Page Title & Description                                    │  │
│  │  • OG Tags (og:image, og:company, etc.)                        │  │
│  │  • Source Location Detection (hero, footer, contact)           │  │
│  │  • Matched Keyword & Pattern                                  │  │
│  │  • Extraction Method                                           │  │
│  │  • Page Snippet Context                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              COMPANY DETECTION & VERIFICATION                   │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  • Domain parsing (domain.com → company name)                   │  │
│  │  • Fuzzy matching against URL/page title                        │  │
│  │  • Company metadata extraction                                  │  │
│  │  • Logo detection                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    RESULT METADATA OBJECT                       │  │
│  │                 (Rich extraction context)                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Module Specifications

#### **Module 1: HTML Extraction (`html-extractor.ts`)**

**Purpose:** Fast extraction of emails and metadata from static HTML

**Inputs:**
- `url: string`
- `timeout: number` (default: 10s)
- `options: ExtractionOptions`

**Outputs:**
```typescript
interface HTMLExtractionResult {
  success: boolean;
  html: string;
  text: string;
  metadata: {
    pageTitle: string | null;
    pageDescription: string | null;
    ogTags: Record<string, string>;
    canonicalUrl: string | null;
    headers: Map<string, string>;
  };
  sourceLocation: {
    inHead: boolean;
    inFooter: boolean;
    inNav: boolean;
    inContactForm: boolean;
    inTeamSection: boolean;
  };
  emails: Array<{
    email: string;
    rawValue: string;
    location: string; // CSS selector or approximate location
  }>;
  error: string | null;
  extractionTime: number;
}
```

**Implementation Strategy:**
- Use JSDOM for DOM traversal
- Parse metadata from `<head>` tags (title, meta description, og:* tags)
- Analyze page structure to identify common email locations
- Track raw email values before deobfuscation
- Implement source location detection via DOM selectors

---

#### **Module 2: JavaScript Extraction (`javascript-extractor.ts`)**

**Purpose:** Extract emails from JavaScript-rendered content

**Inputs:**
- `url: string`
- `timeout: number` (default: 15s)
- `jsExecutionDepth: number` (1-3, controls how many JS frameworks to wait for)
- `options: ExtractionOptions`

**Outputs:**
```typescript
interface JavaScriptExtractionResult extends HTMLExtractionResult {
  jsContent: string; // HTML AFTER JavaScript execution
  waitStrategy: 'networkidle0' | 'networkidle2' | 'domcontentloaded';
  jsFrameworksDetected: string[]; // ['React', 'Vue', 'Angular', etc.]
  consoleErrors: string[];
  networkRequests: number;
}
```

**Implementation Strategy:**
- Use Puppeteer with configurable wait strategies
- Detect JavaScript frameworks via window object inspection
- Intercept network requests to track external API calls
- Capture console errors for debugging
- Implement progressive timeout reduction (try networkidle2, fallback to domcontentloaded)

---

#### **Module 3: Shadow DOM Extraction (`shadow-dom-extractor.ts`)**

**Purpose:** Extract emails from Shadow DOM (Web Components)

**Inputs:**
- Same as JavaScript extraction
- `shadowDomDepth: number` (1-5, how deeply to search Shadow DOM trees)

**Outputs:**
```typescript
interface ShadowDOMExtractionResult extends JavaScriptExtractionResult {
  shadowDOMElements: number;
  shadowDOMEmails: Array<{
    email: string;
    location: string; // Full path including shadow root
    hostElement: string;
  }>;
}
```

**Implementation Strategy:**
- Use Puppeteer page.evaluate() to walk Shadow DOM tree
- Recursively search through shadow roots up to specified depth
- Track host element for context
- Handle nested shadow DOMs

---

#### **Module 4: Email Deobfuscation Engine (`deobfuscation-engine.ts`)**

**Purpose:** Extract emails from obfuscated content with confidence scoring and method tracking

**Inputs:**
```typescript
interface DeobfuscationInput {
  text: string;
  patterns?: string[]; // User-defined email patterns
  allowedDomains?: string[]; // Optional domain whitelist
  confidenceThreshold?: number; // 0-100, default 70
}
```

**Outputs:**
```typescript
interface DeobfuscatedEmail {
  email: string;
  methods: {
    method: string; // 'direct', 'at_replacement', 'rot13', etc.
    confidence: number; // 0-100
    evidence: string; // Raw text that contained email
  }[];
  domainInfo: {
    domain: string;
    isDomainValid: boolean;
    isWildcard: boolean;
  };
  patternMatches: {
    pattern: string;
    matches: boolean;
    score: number; // 0-100
  }[];
  overallConfidence: number; // 0-100
}
```

**Deobfuscation Methods (15+):**

1. **Direct Email Regex** - Standard email format
2. **[at] / (at) Replacement** - Common obfuscation
3. **[dot] / (dot) Replacement** - Domain obfuscation
4. **HTML Entity Decoding** - `&#64;`, `&#46;`, etc.
5. **Numeric HTML Entities** - Decimal and hex codes
6. **Base64 Decoding** - Encoded email strings
7. **Mailto Links** - `mailto:email@domain`
8. **Reverse String Detection** - Reversed emails
9. **ROT13 Encoding** - Character substitution cipher
10. **URL Encoding** - Percent-encoded emails
11. **JSON Structured Data** - `{"email": "..."}`
12. **CSS Content** - Emails in `content: "..."` properties
13. **Image Alt Text** - Emails in img alt attributes
14. **Data Attributes** - `data-email="..."` attributes
15. **Comment Content** - Emails in HTML comments
16. **Atbash Cipher** - Mirror alphabet substitution
17. **Caesar Cipher** - Configurable shift amounts

**Implementation Strategy:**
- Each method returns confidence score (0-100)
- Multiple methods can extract same email with different confidence
- Track which method had highest confidence
- Validate domain after deobfuscation (optional DNS check)
- Compare against user-defined patterns
- Calculate overall confidence = average of all matching methods

---

#### **Module 5: Metadata & Evidence Tracker (`evidence-tracker.ts`)**

**Purpose:** Track extraction context and evidence

**Inputs:**
```typescript
interface EvidenceInput {
  url: string;
  html: string;
  text: string;
  emails: Array<{
    email: string;
    rawValue: string;
    location?: string;
  }>;
  metadata: PageMetadata;
  extractionMethod: 'jsdom' | 'puppeteer' | 'shadow-dom';
  matchedKeyword?: string;
  matchedPatterns?: string[];
}
```

**Outputs:**
```typescript
interface ExtractionEvidence {
  url: string;
  
  // Page information
  pageTitle: string | null;
  pageDescription: string | null;
  canonicalUrl: string | null;
  ogTags: Record<string, string>;
  
  // Source location tracking
  sourceLocation: {
    section: 'hero' | 'nav' | 'header' | 'body' | 'footer' | 'contact' | 'team' | 'unknown';
    element: string; // Tag name or class
    selector: string; // CSS selector
    context: string; // Surrounding text
  };
  
  // Extraction context
  extractedOn: number; // timestamp
  extractionMethod: string;
  extractionTime: number;
  
  // Matched search criteria
  matchedKeyword: string | null;
  matchedPatterns: string[];
  
  // Email evidence
  emailEvidence: Array<{
    email: string;
    deobfuscationMethod: string;
    confidence: number;
    contextBefore: string; // 50 chars before
    contextAfter: string; // 50 chars after
  }>;
}
```

**Source Location Detection Algorithm:**
```
1. Analyze page structure (semantic HTML tags)
2. Check for common patterns:
   - Hero/header: top 200px content
   - Footer: `<footer>`, content after 80% page height
   - Contact page: title contains "contact", forms present
   - Team page: title contains "team", people/avatars present
   - Navigation: `<nav>`, horizontal menu patterns
3. Track CSS selector for exact email location
4. Extract surrounding text for context
```

---

#### **Module 6: Company Detection (`company-detector.ts`)**

**Purpose:** Extract and verify company information

**Inputs:**
```typescript
interface CompanyDetectionInput {
  url: string;
  pageTitle: string | null;
  pageDescription: string | null;
  ogTags: Record<string, string>;
  emails: string[];
  html: string;
}
```

**Outputs:**
```typescript
interface CompanyInfo {
  companyName: string;
  domain: string;
  confidence: number; // 0-100
  sources: {
    source: 'url' | 'title' | 'og:company' | 'og:site_name' | 'schema' | 'meta';
    value: string;
  }[];
  metadata: {
    industry?: string;
    tagline?: string;
    logoUrl?: string;
    socialLinks?: Record<string, string>;
  };
}
```

**Detection Strategy:**

1. **URL-based Detection**
   - Parse domain: `company-name.com` → "Company Name"
   - Handle subdomains: `api.company-name.com` → "Company Name"
   - Handle TLDs: `.co.uk`, `.io`, etc.
   - Handle hyphens/underscores: Replace with spaces, title case

2. **Page Metadata Detection**
   - OG tags: `og:site_name`, `og:company`
   - Meta tags: Schema.org `Organization` type
   - Page title patterns: Extract organization name
   - Meta description: Look for company context

3. **Fuzzy Matching**
   - Extract potential company names from page
   - Compare against known company list (if available)
   - Calculate fuzzy match score
   - Verify against email domain

4. **Email Domain Matching**
   - Parse email domain: `user@company-domain.com`
   - Match against detected company
   - Handle corporate domain variations

---

#### **Module 7: Result Metadata Manager (`result-metadata.ts`)**

**Purpose:** Assemble comprehensive extraction result with all metadata

**Inputs:**
```typescript
interface AssemblyInput {
  jobId: string;
  url: string;
  keyword: string;
  patterns: string[];
  htmlResult: HTMLExtractionResult;
  jsResult?: JavaScriptExtractionResult;
  deobfuscatedEmails: DeobfuscatedEmail[];
  evidence: ExtractionEvidence;
  company: CompanyInfo;
}
```

**Outputs:**
```typescript
interface IntelligenceExtractionResult {
  // Core identifiers
  jobId: string;
  url: string;
  
  // Page information
  company: {
    name: string;
    domain: string;
    confidence: number;
  };
  pageTitle: string | null;
  pageDescription: string | null;
  canonicalUrl: string | null;
  
  // Extracted emails with full context
  emailsExtracted: Array<{
    email: string;
    confidence: number; // 0-100
    validationStatus: 'valid' | 'questionable' | 'invalid';
    deobfuscationMethod: string;
    sourceLocation: {
      section: string;
      element: string;
      context: string;
    };
    matchedPatterns: string[];
    matchedKeyword: string;
    evidence: string;
  }>;
  
  // Extraction metadata
  metadata: {
    extractedOn: number;
    extractionMethod: 'jsdom' | 'puppeteer' | 'shadow-dom';
    extractionTime: number;
    jsFrameworksDetected: string[];
  };
  
  // Quality metrics
  quality: {
    totalEmailsFound: number;
    highConfidenceEmails: number; // >= 80
    pageRelevance: number; // 0-100, based on keyword match
    evidenceQuality: 'high' | 'medium' | 'low';
  };
}
```

---

### 3.3 Execution Flow

```
User initiates search
        ↓
Search service generates keywords/patterns
        ↓
Google CSE returns URLs
        ↓
URLs queued with metadata (keyword, pattern)
        ↓
Worker picks job from queue
        ↓
┌─────────────────────────────────┐
│   EXTRACTION ORCHESTRATOR       │
│  (Main controller)              │
├─────────────────────────────────┤
│ 1. Try HTML Module (fast)       │
│    - Timeout: 10s               │
│    - Extract metadata           │
│    - Track source locations     │
│    - Get raw text + HTML        │
├─────────────────────────────────┤
│ 2. If JS heavy, try JS Module   │
│    - Timeout: remaining time    │
│    - Execute JS (networkidle2)  │
│    - Detect frameworks          │
│    - Re-extract from rendered   │
├─────────────────────────────────┤
│ 3. Check for Shadow DOM         │
│    - Walk shadow roots          │
│    - Deep search (depth 3-5)    │
├─────────────────────────────────┤
│ 4. Deobfuscation Engine         │
│    - Apply all 17 methods       │
│    - Confidence scoring         │
│    - Pattern matching           │
│    - Domain validation          │
├─────────────────────────────────┤
│ 5. Evidence Tracker             │
│    - Determine source location  │
│    - Extract context            │
│    - Link emails to evidence    │
├─────────────────────────────────┤
│ 6. Company Detector             │
│    - Parse domain               │
│    - Match metadata             │
│    - Verify company info        │
├─────────────────────────────────┤
│ 7. Result Metadata Manager      │
│    - Assemble final result      │
│    - Calculate quality scores   │
│    - Prepare for storage        │
└─────────────────────────────────┘
        ↓
Store result in Redis with full metadata
        ↓
Dashboard displays rich extraction data
```

---

## Part 4: MISSING DEOBFUSCATION METHODS (Gap Analysis)

### 4.1 Currently Implemented (10 methods)

1. ✅ Direct Regex
2. ✅ [at] / (at) Replacement
3. ✅ [dot] / (dot) Replacement
4. ✅ HTML Entity Decoding
5. ✅ Base64 Decoding
6. ✅ Mailto Links
7. ✅ Reverse String
8. ✅ ROT13 Encoding
9. ✅ URL Encoding
10. ✅ JSON Structured Data

### 4.2 Recommended Additions (5+ methods)

| Method | Description | Use Case | Implementation |
|--------|-------------|----------|-----------------|
| **CSS Content Property** | `::after { content: "user@example" }` | Websites hiding emails in CSS | Parse `content` properties from `<style>` tags |
| **Image Alt Text** | Email hidden in img alt | Visual obfuscation | Check `alt`, `title` attributes |
| **Data Attributes** | `<span data-email="user@example">` | React/Vue apps | Parse all `data-*` attributes |
| **HTML Comments** | `<!-- user@example -->` | Developer artifacts | Extract from HTML comment nodes |
| **Atbash Cipher** | Mirror alphabet substitution | Creative obfuscation | Mirror each letter (a↔z, b↔y) |
| **Caesar Cipher** | Configurable shift | Common encryption | Try shifts 1-25, validate against patterns |
| **Leetspeak** | `us3r@3x4mpl3.c0m` | 1337 speak | Replace common substitutions (3→E, 4→A, etc.) |
| **Spacing Removal** | `u s e r @ e x a m p l e . c o m` | Visual obfuscation | Remove all whitespace from potential emails |
| **Encoding Detection** | Detect and decode ASCII/Unicode | Various encodings | Run entropy analysis, try common encodings |
| **JavaScript String Variables** | `var email = "user@example"` | JavaScript minification | Extract from variable assignments |

### 4.3 Confidence Scoring Logic

Each deobfuscation method returns confidence based on:

```typescript
interface DeobfuscationConfidence {
  methodName: string;
  baseConfidence: number; // 0-100, inherent to method
  
  // Modifiers
  domainValidationScore: number; // -20 to +20, based on domain checks
  patternMatchScore: number; // -30 to +30, based on user patterns
  contextScore: number; // -10 to +10, based on surrounding text
  
  finalConfidence: number; // Sum of base + modifiers, clamped 0-100
}
```

**Example Scoring:**
- Direct Regex: Base 95 (very reliable)
- Base64: Base 60 (could be false positive)
- ROT13: Base 70 (less common but clear intent)
- CSS Content: Base 50 (often CSS artifacts)

If email passes pattern validation: +20-30 confidence  
If domain has valid DNS: +10 confidence  
If multiple methods extract same: +15 confidence per additional method

---

## Part 5: DATA MODEL CHANGES REQUIRED

### 5.1 Job Interface Enhancement

**Current:**
```typescript
interface Job {
  id: string;
  url: string;
  status: JobStatus;
  emails: string[];
  // ... basic fields
}
```

**Proposed:**
```typescript
interface IntelligenceJob extends Job {
  // Extraction metadata
  extractionMethod: 'jsdom' | 'puppeteer' | 'shadow-dom';
  extractionTime: number;
  jsFrameworksDetected: string[];
  
  // Page metadata
  pageTitle: string | null;
  pageDescription: string | null;
  canonicalUrl: string | null;
  ogTags: Record<string, string>;
  
  // Company information
  detectedCompany: {
    name: string;
    domain: string;
    confidence: number;
  };
  
  // Search criteria tracking
  matchedKeyword: string;
  matchedPatterns: string[];
  
  // Rich email data (replaces simple emails[])
  emailsWithEvidence: Array<{
    email: string;
    confidence: number;
    validationStatus: 'valid' | 'questionable' | 'invalid';
    deobfuscationMethod: string;
    sourceLocation: {
      section: string;
      element: string;
      context: string;
    };
    evidence: string;
  }>;
  
  // Quality scoring
  quality: {
    totalEmailsFound: number;
    highConfidenceEmails: number;
    pageRelevance: number;
    evidenceQuality: 'high' | 'medium' | 'low';
  };
}
```

### 5.2 API Response Enhancement

**Current:**
```json
{
  "id": "job-123",
  "emails": ["user@example.com"],
  "totalEmails": 1
}
```

**Proposed:**
```json
{
  "id": "job-123",
  "company": {
    "name": "Acme Corp",
    "confidence": 95
  },
  "pageTitle": "Acme Corp - Contact Us",
  "emails": [
    {
      "email": "contact@acme.com",
      "confidence": 98,
      "validationStatus": "valid",
      "deobfuscationMethod": "direct",
      "sourceLocation": {
        "section": "contact",
        "element": "<input type='email'>",
        "context": "Email: contact@acme.com"
      },
      "matchedKeyword": "acme",
      "matchedPatterns": ["*@acme.com"],
      "evidence": "Found in contact form"
    }
  ],
  "metadata": {
    "extractionMethod": "jsdom",
    "extractionTime": 2134,
    "extractedOn": 1721221600000
  },
  "quality": {
    "totalEmails": 1,
    "highConfidence": 1,
    "pageRelevance": 98,
    "evidenceQuality": "high"
  }
}
```

---

## Part 6: IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create modular structure in `/lib/extraction/modules/`
- [ ] Implement HTML Extraction Module
- [ ] Create Evidence Tracker
- [ ] Extend Job interface with new fields
- [ ] Update queue to persist new fields

### Phase 2: Advanced Extraction (Weeks 2-3)
- [ ] Implement JavaScript Extraction Module
- [ ] Implement Shadow DOM Module
- [ ] Create Company Detector
- [ ] Add 5 new deobfuscation methods

### Phase 3: Intelligence Layer (Week 3-4)
- [ ] Build Email Deobfuscation Engine with confidence scoring
- [ ] Implement Result Metadata Manager
- [ ] Create Extraction Orchestrator
- [ ] Pattern matching engine for user-defined patterns

### Phase 4: Integration & Testing (Week 4-5)
- [ ] Integrate modules into worker pipeline
- [ ] Update dashboard to display new metadata
- [ ] API response enhancements
- [ ] Comprehensive testing & debugging

### Phase 5: Performance & Polish (Week 5-6)
- [ ] Optimize module execution times
- [ ] Add caching layer for company detection
- [ ] Performance profiling
- [ ] Documentation

---

## Part 7: CRITICAL DECISIONS NEEDED

Before implementation, user approval required on:

### 7.1 Pattern Matching Strategy
- **Option A:** Strict regex matching (fast, limited)
- **Option B:** Fuzzy matching with similarity score (flexible, slower)
- **Option C:** Machine learning classification (powerful, complex)
- **Recommendation:** Start with Option B, migrate to Option C if needed

### 7.2 Company Detection Approach
- **Option A:** URL parsing only (fast, basic)
- **Option B:** URL + page metadata matching (balanced)
- **Option C:** Third-party company API integration (most accurate, adds latency)
- **Recommendation:** Option B initially, allow user configuration for Option C

### 7.3 Confidence Scoring Algorithm
- **Option A:** Simple average of method confidences (fast, basic)
- **Option B:** Weighted average based on method reliability (balanced)
- **Option C:** Machine learning model trained on validation data (complex, accurate)
- **Recommendation:** Option B for v1, research Option C for v2

### 7.4 Evidence Storage Limits
- **Question:** How much context to store per email?
  - Current: Email only (~20 bytes)
  - Proposed: Email + metadata + context (~500-1000 bytes)
  - Impact on Redis storage: 25-50x increase for large campaigns
- **Decision needed:** Implement pagination/streaming for results?

### 7.5 Backward Compatibility
- **Question:** Should new extraction format support old API?
- **Options:**
  - A: Return both old and new formats (doubled payload)
  - B: API version support (v1 returns emails[], v2 returns rich data)
  - C: Migration flag (new format only, update clients first)
- **Recommendation:** Option B with gradual migration

---

## Part 8: SUCCESS METRICS

### 8.1 Feature Parity with SerpDigger
- ✅ Pattern-based email validation
- ✅ Company name extraction
- ✅ Page metadata capture
- ✅ Source location tracking
- ✅ Evidence aggregation
- ✅ Confidence scoring

### 8.2 Quality Improvements
- **Target:** 95%+ confidence on high-quality emails
- **Target:** 85%+ page relevance scoring
- **Target:** <5% false positive rate for extracted emails

### 8.3 Performance Targets
- **HTML Module:** <3s per URL
- **JavaScript Module:** <8s per URL
- **Deobfuscation:** <500ms for all methods
- **Total extraction:** <12s per URL (95th percentile)

### 8.4 User Experience
- Dashboard shows rich metadata for each result
- Ability to filter by confidence level
- Export results with full evidence
- Pattern matching shows matched criteria

---

## Part 9: RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Module complexity** | Hard to debug, high error rates | Comprehensive unit tests, clear interfaces |
| **Performance regression** | Slower extractions | Profile each module, optimize hot paths |
| **Storage explosion** | Redis costs increase | Implement result pagination, archival |
| **False positives** | Low-quality results | Strict confidence thresholds, validation |
| **Dependency on Puppeteer** | Browser crashes, memory leaks | Watchdog monitoring, graceful degradation |
| **Pattern matching performance** | Slow with many patterns | Regex compilation caching, early exit |

---

## Conclusion

This design transforms the extraction engine from a simple email scraper into an **Intelligence Extraction Platform** that rivals SerpDigger. The modular architecture enables:

✅ **Extensibility** - Add new extraction methods without rewriting  
✅ **Maintainability** - Clear separation of concerns  
✅ **Reliability** - Comprehensive evidence tracking and validation  
✅ **Intelligence** - Confidence scoring, pattern matching, company detection  
✅ **User Control** - Define patterns, filter by confidence, inspect evidence  

**Next Step:** Seek user approval on:
1. Implementation timeline
2. Critical decisions (7.1-7.5)
3. Storage strategy for metadata
4. API versioning approach
5. Performance/quality trade-offs

