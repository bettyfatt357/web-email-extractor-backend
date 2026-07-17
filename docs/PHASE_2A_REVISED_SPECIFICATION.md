# PHASE 2A: Discovery Intelligence Engine – Revised Specification

**Status:** Complete Architecture Design (Approval-Ready)  
**Timeline:** 3-4 weeks  
**Team:** 1 FTE or 2 developers  
**Based on:** User feedback incorporating SerpDigger architecture

---

## Executive Summary

Your feedback fundamentally improved the architecture by **separating discovery from extraction**. Instead of one overloaded system, we now have:

1. **Discovery Phase** (Google PSE) → Discovery Record
2. **Extraction Phase** (Worker) → Intelligence Record  
3. **Storage Phase** (PostgreSQL) → Business Intelligence Database

This approach scales infinitely better and aligns with SerpDigger's proven architecture.

---

## Architecture: Before vs. After

### Before (Over-engineered)
```
Dashboard
   ↓
Google PSE Search + Extraction
   ↓
20KB/job Redis
   ↓
API v1 + v2
   ↓
Result: Bloated, slow, Redis drowning in data
```

### After (Clean Separation)
```
Dashboard
   ↓
Google PSE Search (Discovery Only)
   ↓
Discovery Record
   ↓
Queue (Redis, lightweight)
   ↓
Crawler + Extraction Engine
   ↓
Evidence Builder
   ↓
Result Store (PostgreSQL)
   ↓
Dashboard
   ↓
Result: Fast, scalable, sane storage model
```

---

## Core Data Models

### 1. Discovery Record (Created by Google PSE)

**Purpose:** Lightweight record of what Google found. Created once, never modified.

```typescript
interface DiscoveryRecord {
  // Identifiers
  id: string; // UUID
  searchId: string; // Links to search session
  googleRank: number; // Position in Google results (1-10, etc)
  
  // From Google Results
  url: string;
  pageTitle: string; // Google's title in SERP
  snippet: string; // Google's snippet in SERP
  
  // From Search Context
  query: string; // The exact query sent to Google
  keyword: string; // The primary keyword
  location?: string; // If location was specified
  pattern?: string; // If pattern was specified (e.g., "contact")
  
  // Timestamps & Status
  discoveredAt: number; // Timestamp
  status: 'pending' | 'processing' | 'completed' | 'failed'; // Job status
  error?: string; // Error message if failed
  
  // Extraction Result (populated by worker)
  extractedAt?: number; // When extraction completed
  intelligence?: IntelligenceRecord; // Full intelligence (see below)
}
```

**Storage:** Redis (queue) → PostgreSQL (history)

**Size:** ~300 bytes (lightweight)

**Lifespan:** Created once, immutable until extraction starts

---

### 2. Intelligence Record (Created by Worker)

**Purpose:** Rich business intelligence extracted from the page.

```typescript
interface IntelligenceRecord {
  // Page Information
  pageTitle: string; // Actual <title> tag
  pageDescription?: string; // Meta description
  pageUrl: string;
  
  // Company Information (hierarchical detection)
  company: {
    name: string;
    confidence: number; // 0-100, based on detection method
    detectionMethod: 'schema' | 'json-ld' | 'og' | 'title' | 'h1' | 'domain' | 'fallback';
    detectionSource?: string; // What element/property was used
  };
  
  // Emails (multiple if found)
  emails: EmailIntelligence[];
  
  // Evidence & Context
  searchContext: {
    query: string;
    keyword: string;
    googleRank: number;
    googleSnippet: string;
    location?: string;
    pattern?: string;
  };
  
  // Quality Metrics
  quality: {
    pageRelevance: number; // 0-100: How relevant is this page to the search?
    emailCount: number;
    highConfidenceEmails: number; // Confidence >= 80
    extractionMethod: 'jsdom' | 'puppeteer'; // How extracted
    processingTimeMs: number;
  };
  
  // Metadata
  extractedAt: number; // Timestamp
  workerId: string; // Which worker extracted this
  version: string; // Intelligence engine version
}
```

---

### 3. Email Intelligence (Within IntelligenceRecord)

**Purpose:** Rich details about each email extracted.

```typescript
interface EmailIntelligence {
  email: string; // The email address
  
  // Extraction Details
  confidence: number; // 0-100
  extractionMethod: string; // 'jsdom' | 'puppeteer'
  obfuscationType: string; // 'none' | 'base64' | 'rot13' | 'entity' | etc
  deobfuscationPlugin: string; // Which plugin extracted it: 'direct', 'base64.ts', etc
  
  // Evidence Tracking (THIS IS GOLD)
  evidence: {
    foundIn: 'header' | 'footer' | 'contact_page' | 'careers_page' | 'about_page' | 'team_page' | 'other'; // WHERE
    htmlSnippet: string; // ~50-200 chars of context (NOT full HTML)
    selector: string; // CSS selector: 'footer a', 'span.email', etc
    tagName: string; // 'a', 'span', 'div', etc
    classes?: string[]; // ['contact-email', 'footer-link']
    id?: string; // Element ID if present
    reasonForMatch: string; // "Matched pattern 'contact'" or "Found in mailto link"
  };
  
  // Pattern Matching Results
  patternMatching: {
    stage1Matched: boolean; // Google query matched (e.g., "contact" in query)
    stage2Matched: boolean; // URL pattern matched (e.g., /contact, /careers)
    stage3Matched: boolean; // HTML content matched (e.g., <h2>Contact Us</h2>)
    matchedPatterns: string[]; // Which patterns matched: ['contact', 'email']
  };
}
```

---

## Key Architectural Principles

### Principle 1: Discovery ≠ Extraction

**Google PSE (Discovery)**
- Input: Keywords + location + patterns
- Process: Query generation + Google search
- Output: Discovery Record (rank, title, snippet, URL, query, keyword)
- Size: 300 bytes
- Storage: Redis queue only
- Lifetime: Until worker processes

**Worker (Extraction)**
- Input: Discovery Record + URL
- Process: Crawl page → Extract emails → Build intelligence
- Output: Intelligence Record
- Size: 5-15 KB (for 2-5 emails)
- Storage: PostgreSQL (permanent)
- Lifetime: Permanent history

### Principle 2: Pattern Matching in 3 Stages

**Stage 1: Query Generation** (During Discovery)
```
User Input: hedge funds, contact, New York

Generated Queries:
1. "hedge funds contact New York"
2. "hedge funds contact New York site:*.com"
3. "hedge funds New York contact email"
4. "New York hedge funds information"
```

Each query records: query text, keyword, location, pattern

**Stage 2: URL Validation** (During Extraction)
```
If pattern = "contact", validate URL contains:
- /contact
- /contact-us
- /get-in-touch
- /reach-us
- /inquiry
- /support

Confidence boost: 20 points if URL path matches pattern
```

**Stage 3: HTML Content Validation** (During Extraction)
```
Search page HTML for keywords:
Contact: ["Contact", "Reach us", "Email us"]
Careers: ["Careers", "Join us", "Work with us"]
Team: ["Team", "Leadership", "Our team"]
Investor: ["Investor relations", "Investors", "Shareholder"]

Each keyword found: +10 confidence for emails on that page
```

---

## Deobfuscation: Pluggable Plugin Architecture

### Current Problem
- 24 hardcoded methods in one file
- Adding new method = refactoring entire file
- Testing is all-or-nothing

### Solution: Plugin Architecture

**Directory Structure:**
```
lib/extraction/deobfuscation/
├── engine.ts              # Main orchestrator
├── types.ts               # Plugin interface
├── plugins/
│   ├── direct.ts          # Unobfuscated emails
│   ├── mailto.ts          # <a href="mailto:email">
│   ├── base64.ts          # base64('email@example.com')
│   ├── rot13.ts           # ROT13 encoded
│   ├── unicode.ts         # \u0065\u006d\u0061\u0069\u006c
│   ├── hex.ts             # \x65\x6d\x61\x69\x6c
│   ├── decimal.ts         # &#101;&#109;&#97;&#105;&#108;
│   ├── named-entity.ts    # &lt;, &gt;, &quot;
│   ├── html-entity.ts     # Full HTML entity decoding
│   ├── json.ts            # JSON.stringify escaping
│   ├── css-hidden.ts      # display:none, visibility:hidden
│   ├── shadow-dom.ts      # Shadow DOM content
│   ├── html-comment.ts    # <!-- hidden in comments -->
│   ├── nextjs.ts          # __NEXT_DATA__ hydration
│   ├── react.ts           # React fiber tree
│   ├── vue.ts             # Vue template data
│   ├── angular.ts         # Angular ng-bind data
│   ├── astro.ts           # Astro hydration
│   ├── javascript.ts      # JavaScript inline: var email="x@y"
│   ├── onclick.ts         # onclick="sendEmail('x@y')"
│   ├── data-attribute.ts  # data-email="x@y"
│   ├── iframe.ts          # Inside iframe content
│   └── cloudflare.ts      # Cloudflare anti-bot
└── test/
    ├── direct.test.ts
    ├── base64.test.ts
    └── ...
```

**Plugin Interface:**
```typescript
interface DeobfuscationPlugin {
  name: string; // 'base64', 'rot13', etc
  priority: number; // 1-100 (higher = try first)
  extract(html: string): string[]; // Returns potential emails
  confidence(email: string, source: string): number; // 0-100
}
```

**Orchestrator Logic:**
```typescript
class DeobfuscationEngine {
  private plugins: DeobfuscationPlugin[] = [];

  async deobfuscate(html: string): Promise<EmailResult[]> {
    // Load plugins dynamically
    this.plugins = await this.loadPlugins(); // Sorted by priority
    
    const results: EmailResult[] = [];
    const seen = new Set<string>();
    
    // Try each plugin
    for (const plugin of this.plugins) {
      try {
        const emails = await plugin.extract(html);
        
        for (const email of emails) {
          if (!seen.has(email)) {
            const confidence = plugin.confidence(email, html);
            results.push({
              email,
              method: plugin.name,
              confidence,
              plugin: plugin.name
            });
            seen.add(email);
          }
        }
      } catch (error) {
        console.error(`Plugin ${plugin.name} failed:`, error);
        // Continue to next plugin
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  
  // Easy to add new method later
  async registerPlugin(plugin: DeobfuscationPlugin) {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => b.priority - a.priority);
  }
}
```

**Adding a new deobfuscation method:**
```typescript
// plugins/my-new-technique.ts
export class MyNewPlugin implements DeobfuscationPlugin {
  name = 'my-technique';
  priority = 50;
  
  async extract(html: string): Promise<string[]> {
    // Detect and extract emails using new technique
    return emails;
  }
  
  confidence(email: string, source: string): number {
    // Estimate confidence 0-100
    return 85;
  }
}

// In engine initialization:
deobfuscationEngine.registerPlugin(new MyNewPlugin());
// Done. No refactoring of existing code.
```

**Benefits:**
- ✅ Each method is isolated, testable, replaceable
- ✅ Add new methods without touching existing code
- ✅ Easy to benchmark which plugins work best
- ✅ Can disable problematic plugins easily
- ✅ Follows Open/Closed principle

---

## Worker Extraction Flow

### Current (Simplified)
```
Worker.processJob()
  ↓
extractEmailsFromUrl(url)
  ↓
emails[]
  ↓
queue.markCompleted(jobId, emails)
```

### After Phase 2A

```
Worker.processJob(discoveryRecord)
  ↓
page = await crawler.fetch(url) [Handles: page, DOM, Shadow DOM, iframes, scripts]
  ↓
html = page.getHTML()
  ↓
emails = deobfuscationEngine.deobfuscate(html) [24+ methods, plugins]
  ↓
company = companyDetector.detect(page) [Schema.org → Domain, hierarchical]
  ↓
emailIntelligence[] = enrichEmails(emails, page, discoveryRecord) [Evidence, patterns, confidence]
  ↓
intelligenceRecord = buildIntelligenceRecord(emailIntelligence[], company, discoveryRecord)
  ↓
PostgreSQL.insert(intelligenceRecord)
  ↓
Redis.markCompleted(discoveryRecord.id, intelligenceRecord.id)
  ↓
Dashboard displays rich intelligence
```

---

## Data Flow: End-to-End

### 1. User Initiates Search (Dashboard)
```
Input: keywords=['hedge funds'], patterns=['contact'], location='New York'
```

### 2. Google PSE Discovery (Search Service)
```
Query generation: "hedge funds contact New York", "hedge funds contact", etc

Google Results:
1. Rank 1: www.blackrock.com/contact (Title: "Contact Us", Snippet: "Contact us at info@blackrock.com")
2. Rank 2: www.vanguard.com/contact (Title: "Contact Vanguard", Snippet: "Reach our team...")
3. ... (more results)

Create Discovery Records:
- discoveryRecord1 { rank: 1, url: blackrock.com/contact, keyword: 'hedge funds', pattern: 'contact' }
- discoveryRecord2 { rank: 2, url: vanguard.com/contact, keyword: 'hedge funds', pattern: 'contact' }

Add to Queue (Redis)
Store Discovery Records (PostgreSQL, for history)
```

### 3. Worker Extraction (Worker Process)
```
For each Discovery Record in queue:

Crawler.fetch(blackrock.com/contact)
  ↓ Returns: { html, jsdom object, screenshots, loaded resources }

Deobfuscation Engine.deobfuscate(html)
  ↓ Runs 24+ plugins
  ↓ Returns: [{ email: 'info@blackrock.com', method: 'mailto', confidence: 99 }, ...]

Company Detector.detect(html)
  ↓ Check schema.org → "BlackRock, Inc."
  ↓ Confidence: 98

Evidence Builder.track(emails, html)
  ↓ For each email, find: WHERE (footer), WHAT (HTML snippet), WHY (Matched 'contact' pattern)
  ↓ Returns: emailIntelligence[] with evidence

Pattern Validator.validate(page, searchContext)
  ↓ Stage 2: URL /contact matches pattern 'contact' → +20 confidence
  ↓ Stage 3: H2 "Contact Us" matches keyword 'contact' → +10 confidence

Build Intelligence Record:
{
  company: { name: 'BlackRock', confidence: 98 },
  emails: [{
    email: 'info@blackrock.com',
    confidence: 97,
    evidence: { foundIn: 'footer', snippet: '<footer>Contact us at info@blackrock.com</footer>' },
    patternMatching: { stage2Matched: true, stage3Matched: true }
  }],
  searchContext: {
    query: 'hedge funds contact New York',
    keyword: 'hedge funds',
    googleRank: 1,
    pattern: 'contact'
  }
}

Store in PostgreSQL
Update Redis: mark completed, link to PostgreSQL record
```

### 4. Dashboard Display
```
Show Discovery Record with linked Intelligence Record:
- Company: BlackRock (98% confidence)
- Email: info@blackrock.com (97% confidence)
- Found In: Footer
- Evidence: "Contact us at info@blackrock.com"
- Google Rank: 1
- Query: "hedge funds contact New York"
```

---

## PostgreSQL Schema

### Discovery Records Table
```sql
CREATE TABLE discovery_records (
  id UUID PRIMARY KEY,
  search_id UUID NOT NULL,
  google_rank INT,
  url VARCHAR(2048),
  page_title VARCHAR(500),
  snippet TEXT,
  query VARCHAR(500),
  keyword VARCHAR(100),
  location VARCHAR(100),
  pattern VARCHAR(100),
  discovered_at TIMESTAMP,
  status VARCHAR(20), -- 'pending', 'processing', 'completed', 'failed'
  error TEXT,
  intelligence_id UUID, -- Link to intelligence record
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discovery_search_id ON discovery_records(search_id);
CREATE INDEX idx_discovery_status ON discovery_records(status);
```

### Intelligence Records Table
```sql
CREATE TABLE intelligence_records (
  id UUID PRIMARY KEY,
  discovery_id UUID NOT NULL REFERENCES discovery_records(id),
  page_title VARCHAR(500),
  page_description TEXT,
  page_url VARCHAR(2048),
  
  -- Company
  company_name VARCHAR(500),
  company_confidence INT,
  company_detection_method VARCHAR(50),
  
  -- Quality
  page_relevance INT,
  email_count INT,
  high_confidence_emails INT,
  extraction_method VARCHAR(50),
  processing_time_ms INT,
  
  -- Full data (JSON)
  emails_json JSONB, -- Full email intelligence array
  
  -- Metadata
  extracted_at TIMESTAMP,
  worker_id VARCHAR(50),
  version VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_intelligence_discovery_id ON intelligence_records(discovery_id);
CREATE INDEX idx_intelligence_company_name ON intelligence_records(company_name);
```

---

## API Changes

### Existing: No Breaking Changes
- `/api/dashboard/search` → Works exactly the same
- `/api/job/:id` → Works exactly the same
- All existing endpoints backward compatible

### New: Optional Enhancements
- `/api/discovery/:id` → Returns discovery record with linked intelligence
- `/api/intelligence/:id` → Returns full intelligence record
- `/api/search/:id/results` → Returns all discoveries + intelligence for search
- `/api/company/:name/emails` → Group emails by company

---

## Implementation Phases (3-4 weeks)

### Phase 2A.1: Data Models (Days 1-2)
- [ ] Define DiscoveryRecord interface
- [ ] Define IntelligenceRecord interface
- [ ] Define EmailIntelligence interface
- [ ] Create PostgreSQL schema
- [ ] Update Queue types (add intelligence_id field)
- **Output:** TypeScript types, schema files

### Phase 2A.2: Deobfuscation Plugin Engine (Days 3-5)
- [ ] Create plugin interface
- [ ] Convert 9 existing methods to plugins
- [ ] Create 10 new plugin methods
- [ ] Build orchestrator
- [ ] Unit tests for each plugin
- [ ] Benchmark plugin performance
- **Output:** Pluggable deobfuscation with 19+ methods

### Phase 2A.3: Intelligence Modules (Days 6-8)
- [ ] Company detector (6-stage hierarchy)
- [ ] Pattern validator (3-stage)
- [ ] Evidence tracker (WHERE, WHAT, WHY)
- [ ] Intelligence record builder
- [ ] Unit tests
- **Output:** Intelligence building pipeline

### Phase 2A.4: Worker Integration (Days 9-11)
- [ ] Extend Worker to use new modules
- [ ] Update extraction to build IntelligenceRecord
- [ ] Implement PostgreSQL storage
- [ ] Update Redis to link to PostgreSQL
- [ ] Integration tests
- **Output:** Worker produces rich intelligence

### Phase 2A.5: API Updates (Days 12-14)
- [ ] Add new optional API endpoints
- [ ] Keep v1 endpoints unchanged
- [ ] Add optional intelligence fields to v1
- [ ] Documentation
- **Output:** Backward-compatible API

### Phase 2A.6: Dashboard UI (Days 15-17)
- [ ] Update jobs list to show company names
- [ ] Add confidence indicators
- [ ] Add evidence cards
- [ ] New filters: company, confidence, extraction method
- [ ] Search results: show linked intelligence
- **Output:** UI shows rich intelligence

### Phase 2A.7: Testing & Optimization (Days 18-21)
- [ ] Load testing (1000s of jobs)
- [ ] Performance optimization
- [ ] Rollback testing
- [ ] Documentation
- [ ] Production readiness
- **Output:** Production-ready system

---

## Risk Mitigation

### Risk 1: PostgreSQL Performance Degradation
**Mitigation:**
- Start with discovery records (small, frequent)
- Add intelligence records after Phase 2A.4
- Monitor query performance weekly
- Implement archival policy: after 90 days, compress to archive table

### Risk 2: Worker Memory Leaks
**Mitigation:**
- Profile memory usage weekly
- Restart workers every 24 hours
- Set memory limits per job: 500MB max
- Alert if memory > 1GB

### Risk 3: Extraction Takes Too Long
**Mitigation:**
- Target: <15s per URL (95th percentile)
- Kill jobs > 20s
- Monitor plugin performance
- Disable slow plugins if <2% impact

### Risk 4: Plugin Conflicts
**Mitigation:**
- Each plugin must be stateless
- Unit tests for each plugin isolation
- Integration tests for plugin ordering
- Automatic rollback if error rate > 5%

---

## Success Criteria

- ✅ 95%+ accuracy on company detection
- ✅ 90%+ accuracy on email extraction
- ✅ 99%+ zero breaking API changes
- ✅ <15s extraction time (95th percentile)
- ✅ <5% false positive rate
- ✅ PostgreSQL performant for 1M+ records
- ✅ All existing searches continue to work
- ✅ Full evidence tracking for 100% of emails

---

## Summary

Phase 2A transforms the system by:

1. **Separating concerns:** Discovery ≠ Extraction
2. **Using right storage:** Redis for queue, PostgreSQL for intelligence
3. **Pluggable architecture:** Add deobfuscation methods without refactoring
4. **Rich evidence:** WHERE, WHAT, WHY for every email
5. **Pattern validation:** 3-stage matching with confidence
6. **Hierarchical company detection:** 6-stage fallback
7. **100% backward compatible:** All existing API/searches work forever

Result: Enterprise-grade Business Discovery Intelligence Platform that scales infinitely.
