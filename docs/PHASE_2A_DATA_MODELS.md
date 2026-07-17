# PHASE 2A – Complete Data Models

**Purpose:** Exact TypeScript interfaces for Phase 2A implementation  
**Status:** Ready to code from  

---

## 1. Discovery Record

```typescript
// lib/types/discovery.ts

export type DiscoveryStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DiscoveryRecord {
  // Identifiers
  id: string; // UUID
  searchId: string; // Links to search session
  
  // Google Results (immutable once created)
  googleRank: number; // 1-based position in SERP
  url: string; // The URL discovered
  pageTitle: string; // Title from Google SERP
  snippet: string; // Snippet from Google SERP
  
  // Search Context (what query led to this result)
  query: string; // The exact query sent to Google
  keyword: string; // Primary keyword from user
  location?: string; // Location filter if used
  pattern?: string; // Pattern if specified (e.g., "contact")
  
  // Job Status (updated as worker processes)
  status: DiscoveryStatus;
  error?: string; // Error message if status = 'failed'
  
  // Timestamps
  discoveredAt: number; // When Google result was discovered
  extractedAt?: number; // When worker completed extraction
  
  // Reference to extracted intelligence
  intelligenceId?: string; // UUID of IntelligenceRecord in PostgreSQL
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

export interface CreateDiscoveryRecordInput {
  searchId: string;
  googleRank: number;
  url: string;
  pageTitle: string;
  snippet: string;
  query: string;
  keyword: string;
  location?: string;
  pattern?: string;
}

export interface UpdateDiscoveryRecordInput {
  status?: DiscoveryStatus;
  error?: string;
  extractedAt?: number;
  intelligenceId?: string;
}
```

---

## 2. Intelligence Record

```typescript
// lib/types/intelligence.ts

export type DetectionMethod = 'schema' | 'json-ld' | 'og' | 'title' | 'h1' | 'domain' | 'fallback';
export type FoundIn = 'header' | 'footer' | 'contact_page' | 'careers_page' | 'about_page' | 'team_page' | 'other';
export type ExtractionMethod = 'jsdom' | 'puppeteer';
export type ObfuscationType = 'none' | 'base64' | 'rot13' | 'unicode' | 'hex' | 'entity' | 'json' | 'html-comment' | 'css-hidden' | 'javascript' | 'iframe' | 'shadow-dom' | 'nextjs' | 'react' | 'vue' | 'angular' | 'astro' | 'other';

// Company Information
export interface CompanyInfo {
  name: string;
  confidence: number; // 0-100
  detectionMethod: DetectionMethod;
  detectionSource?: string; // e.g., "schema.org", "meta[property='og:site_name']"
}

// Email Evidence (WHERE, WHAT, WHY)
export interface EmailEvidence {
  foundIn: FoundIn;
  htmlSnippet: string; // 50-200 chars of context
  selector: string; // CSS selector: 'footer a', 'span.email', etc
  tagName: string; // 'a', 'span', 'div', etc
  classes?: string[]; // ['contact-email', 'footer-link']
  id?: string; // Element ID
  reasonForMatch: string; // "Matched pattern 'contact'" or "Found in mailto link"
}

// Pattern Matching Results
export interface PatternMatchingResult {
  stage1Matched: boolean; // Query generation matched
  stage2Matched: boolean; // URL pattern matched (/contact, /careers)
  stage3Matched: boolean; // HTML content matched
  matchedPatterns: string[]; // ['contact', 'email']
}

// Individual Email Intelligence
export interface EmailIntelligence {
  email: string;
  confidence: number; // 0-100, based on method, obfuscation, patterns
  extractionMethod: ExtractionMethod; // 'jsdom' | 'puppeteer'
  obfuscationType: ObfuscationType;
  deobfuscationPlugin: string; // Plugin that extracted it: 'direct', 'base64.ts', 'rot13.ts', etc
  
  // Evidence Tracking
  evidence: EmailEvidence;
  
  // Pattern Matching
  patternMatching: PatternMatchingResult;
}

// Quality Metrics
export interface QualityMetrics {
  pageRelevance: number; // 0-100: How relevant is page to search?
  emailCount: number;
  highConfidenceEmails: number; // Confidence >= 80
  extractionMethod: ExtractionMethod;
  processingTimeMs: number;
}

// Search Context (from DiscoveryRecord)
export interface SearchContext {
  query: string;
  keyword: string;
  googleRank: number;
  googleSnippet: string;
  location?: string;
  pattern?: string;
}

// Main Intelligence Record
export interface IntelligenceRecord {
  id: string; // UUID
  discoveryId: string; // Reference to DiscoveryRecord
  
  // Page Information (from crawler)
  pageTitle: string; // Actual <title> tag
  pageDescription?: string; // Meta description
  pageUrl: string;
  
  // Company
  company: CompanyInfo;
  
  // Emails (array, multiple emails per page)
  emails: EmailIntelligence[];
  
  // Context
  searchContext: SearchContext;
  
  // Quality
  quality: QualityMetrics;
  
  // Metadata
  extractedAt: number; // Timestamp
  workerId: string; // Which worker extracted
  version: string; // Intelligence engine version
  
  createdAt: number;
}

export interface CreateIntelligenceRecordInput {
  discoveryId: string;
  pageTitle: string;
  pageDescription?: string;
  pageUrl: string;
  company: CompanyInfo;
  emails: EmailIntelligence[];
  searchContext: SearchContext;
  quality: QualityMetrics;
  workerId: string;
}
```

---

## 3. Deobfuscation Plugin Interface

```typescript
// lib/extraction/deobfuscation/types.ts

export interface DeobfuscationResult {
  email: string;
  method: string; // Plugin name
  confidence: number; // 0-100
}

export interface DeobfuscationPlugin {
  // Plugin metadata
  name: string; // 'direct', 'base64', 'rot13', etc
  priority: number; // 1-100 (higher = try first)
  
  // Main extraction method
  extract(html: string): Promise<string[]>;
  
  // Confidence scoring for results
  confidence(email: string, source: string): number;
}
```

---

## 4. Company Detection Hierarchy

```typescript
// lib/intelligence/company-detector.ts

export interface CompanyDetectionStage {
  stage: number; // 1-6
  method: DetectionMethod;
  confidence: number; // 0-100
  checkFn: (page: ParsedPage) => string | undefined;
}

const COMPANY_DETECTION_STAGES: CompanyDetectionStage[] = [
  {
    stage: 1,
    method: 'schema',
    confidence: 98,
    checkFn: (page) => {
      // Check for schema.org Organization
      const schema = page.schemaOrg?.Organization;
      return schema?.name;
    }
  },
  {
    stage: 2,
    method: 'json-ld',
    confidence: 95,
    checkFn: (page) => {
      // Check JSON-LD
      const jsonLd = page.jsonLd?.find(obj => obj['@type'] === 'Organization');
      return jsonLd?.name;
    }
  },
  {
    stage: 3,
    method: 'og',
    confidence: 90,
    checkFn: (page) => {
      // Check Open Graph meta tags
      return page.ogSiteName || page.ogTitle;
    }
  },
  {
    stage: 4,
    method: 'title',
    confidence: 85,
    checkFn: (page) => {
      // Extract from <title> tag
      // "BlackRock | Investment Management" → "BlackRock"
      return page.title?.split('|')[0]?.trim();
    }
  },
  {
    stage: 5,
    method: 'h1',
    confidence: 75,
    checkFn: (page) => {
      // Extract from first <h1>
      return page.h1Tags?.[0];
    }
  },
  {
    stage: 6,
    method: 'domain',
    confidence: 65,
    checkFn: (page) => {
      // Extract from domain name
      // blackrock.com → "BlackRock"
      return page.domain?.split('.')[0]?.toUpperCase();
    }
  },
  {
    stage: 7,
    method: 'fallback',
    confidence: 50,
    checkFn: (page) => {
      // Last resort: return domain
      return page.domain;
    }
  }
];

export class CompanyDetector {
  detect(page: ParsedPage): CompanyInfo {
    for (const stage of COMPANY_DETECTION_STAGES) {
      const name = stage.checkFn(page);
      if (name) {
        return {
          name,
          confidence: stage.confidence,
          detectionMethod: stage.method,
          detectionSource: stage.method
        };
      }
    }
    
    // Should not reach here (fallback always succeeds)
    throw new Error('No company name detected');
  }
}
```

---

## 5. Pattern Validator (3 Stages)

```typescript
// lib/intelligence/pattern-validator.ts

export interface PatternValidationContext {
  discoveryRecord: DiscoveryRecord;
  page: ParsedPage;
  emails: string[];
}

export class PatternValidator {
  // Stage 1: Query included pattern
  stage1(context: PatternValidationContext): boolean {
    if (!context.discoveryRecord.pattern) return false;
    
    const query = context.discoveryRecord.query.toLowerCase();
    const pattern = context.discoveryRecord.pattern.toLowerCase();
    
    return query.includes(pattern);
  }
  
  // Stage 2: URL path includes pattern
  stage2(context: PatternValidationContext): boolean {
    if (!context.discoveryRecord.pattern) return false;
    
    const urlPatterns: Record<string, string[]> = {
      'contact': ['/contact', '/contact-us', '/get-in-touch', '/reach-us'],
      'careers': ['/careers', '/join-us', '/work-with-us', '/hiring'],
      'team': ['/team', '/about', '/our-team', '/leadership'],
      'investor': ['/investor', '/investors', '/ir/'],
      'press': ['/press', '/news', '/media', '/newsroom'],
      'support': ['/support', '/help', '/faq', '/contact'],
    };
    
    const pattern = context.discoveryRecord.pattern.toLowerCase();
    const targetPaths = urlPatterns[pattern] || [];
    
    const urlPath = new URL(context.discoveryRecord.url).pathname.toLowerCase();
    
    return targetPaths.some(p => urlPath.includes(p));
  }
  
  // Stage 3: HTML content includes pattern keywords
  stage3(context: PatternValidationContext): boolean {
    if (!context.discoveryRecord.pattern) return false;
    
    const contentKeywords: Record<string, string[]> = {
      'contact': ['Contact', 'Reach us', 'Email us', 'Get in touch', 'Contact form'],
      'careers': ['Careers', 'Join us', 'Work with us', 'Apply', 'Hiring'],
      'team': ['Team', 'Our team', 'Leadership', 'Staff', 'Meet the team'],
      'investor': ['Investor relations', 'Investors', 'Shareholder', 'IR', 'Financial'],
      'press': ['Press', 'News', 'Media', 'Newsroom', 'Press release'],
    };
    
    const pattern = context.discoveryRecord.pattern.toLowerCase();
    const keywords = contentKeywords[pattern] || [];
    
    const html = context.page.html.toLowerCase();
    
    return keywords.some(kw => html.includes(kw.toLowerCase()));
  }
  
  validate(context: PatternValidationContext): PatternMatchingResult {
    return {
      stage1Matched: this.stage1(context),
      stage2Matched: this.stage2(context),
      stage3Matched: this.stage3(context),
      matchedPatterns: this.discoveryRecord.pattern ? [this.discoveryRecord.pattern] : []
    };
  }
}
```

---

## 6. Evidence Builder

```typescript
// lib/intelligence/evidence-builder.ts

export interface RawEmailLocation {
  email: string;
  selector: string;
  tagName: string;
  classes: string[];
  id?: string;
  parentHtml: string; // 50-200 chars
}

export class EvidenceBuilder {
  async trackEmails(
    emails: string[],
    html: string,
    patterns: string[]
  ): Promise<EmailEvidence[]> {
    const results: EmailEvidence[] = [];
    
    for (const email of emails) {
      // Find where this email appears in HTML
      const locations = this.findEmailLocations(email, html);
      
      for (const location of locations) {
        // Determine section (footer, header, contact, etc)
        const section = this.determineSection(location, html);
        
        // Generate reason for match
        const reason = this.generateMatchReason(patterns, location, html);
        
        results.push({
          foundIn: section,
          htmlSnippet: location.parentHtml,
          selector: location.selector,
          tagName: location.tagName,
          classes: location.classes.length > 0 ? location.classes : undefined,
          id: location.id,
          reasonForMatch: reason
        });
      }
    }
    
    return results;
  }
  
  private findEmailLocations(email: string, html: string): RawEmailLocation[] {
    // Use JSDOM to find email in HTML
    const locations: RawEmailLocation[] = [];
    
    // Check mailto links
    const mailtoRegex = new RegExp(`mailto:${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
    // ... find in HTML and add to locations
    
    // Check text content
    const textRegex = new RegExp(`\\b${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    // ... find in HTML and add to locations
    
    return locations;
  }
  
  private determineSection(location: RawEmailLocation, html: string): FoundIn {
    const lowerHtml = html.toLowerCase();
    const footerMatch = lowerHtml.indexOf('<footer');
    const headerMatch = lowerHtml.indexOf('<header');
    
    // Determine which section contains this location
    // Return appropriate value: 'footer', 'header', 'contact_page', etc
    
    return 'other'; // Simplified
  }
  
  private generateMatchReason(patterns: string[], location: RawEmailLocation, html: string): string {
    // Generate human-readable reason why we think this is a valid email
    // Examples: "Matched 'contact' pattern", "Found in footer", "In mailto link"
    
    return 'Found in HTML';
  }
}
```

---

## 7. Intelligence Record Builder

```typescript
// lib/intelligence/intelligence-builder.ts

export class IntelligenceRecordBuilder {
  async build(input: {
    discoveryRecord: DiscoveryRecord;
    page: ParsedPage;
    rawEmails: string[];
    deobfuscationResults: DeobfuscationResult[];
    workerId: string;
  }): Promise<IntelligenceRecord> {
    const { discoveryRecord, page, rawEmails, deobfuscationResults, workerId } = input;
    
    // Detect company
    const companyDetector = new CompanyDetector();
    const company = companyDetector.detect(page);
    
    // Validate patterns
    const patternValidator = new PatternValidator();
    const patternMatching = patternValidator.validate({
      discoveryRecord,
      page,
      emails: rawEmails
    });
    
    // Track evidence
    const evidenceBuilder = new EvidenceBuilder();
    const evidence = await evidenceBuilder.trackEmails(
      rawEmails,
      page.html,
      discoveryRecord.pattern ? [discoveryRecord.pattern] : []
    );
    
    // Build email intelligence with confidence scoring
    const emails = this.buildEmailIntelligence(
      deobfuscationResults,
      evidence,
      patternMatching
    );
    
    // Calculate quality metrics
    const quality: QualityMetrics = {
      pageRelevance: this.calculatePageRelevance(discoveryRecord, page),
      emailCount: emails.length,
      highConfidenceEmails: emails.filter(e => e.confidence >= 80).length,
      extractionMethod: page.extractionMethod,
      processingTimeMs: page.processingTimeMs
    };
    
    return {
      id: generateUUID(),
      discoveryId: discoveryRecord.id,
      pageTitle: page.title,
      pageDescription: page.description,
      pageUrl: discoveryRecord.url,
      company,
      emails,
      searchContext: {
        query: discoveryRecord.query,
        keyword: discoveryRecord.keyword,
        googleRank: discoveryRecord.googleRank,
        googleSnippet: discoveryRecord.snippet,
        location: discoveryRecord.location,
        pattern: discoveryRecord.pattern
      },
      quality,
      extractedAt: Date.now(),
      workerId,
      version: '2.0.0',
      createdAt: Date.now()
    };
  }
  
  private buildEmailIntelligence(
    deobResults: DeobfuscationResult[],
    evidence: EmailEvidence[],
    patterns: PatternMatchingResult
  ): EmailIntelligence[] {
    return deobResults.map((deobResult, idx) => ({
      email: deobResult.email,
      confidence: this.calculateEmailConfidence(deobResult, patterns),
      extractionMethod: 'jsdom', // Would come from page object
      obfuscationType: 'none', // Would determine from deobResult
      deobfuscationPlugin: deobResult.method,
      evidence: evidence[idx] || { foundIn: 'other', htmlSnippet: '', selector: '', tagName: 'unknown', reasonForMatch: 'Unknown' },
      patternMatching: patterns
    }));
  }
  
  private calculateEmailConfidence(
    deobResult: DeobfuscationResult,
    patterns: PatternMatchingResult
  ): number {
    let confidence = deobResult.confidence;
    
    // Boost based on pattern matches
    if (patterns.stage1Matched) confidence += 5;
    if (patterns.stage2Matched) confidence += 15;
    if (patterns.stage3Matched) confidence += 10;
    
    return Math.min(confidence, 100);
  }
  
  private calculatePageRelevance(discovery: DiscoveryRecord, page: ParsedPage): number {
    // Score how relevant this page is to the search
    // Based on: google rank, keyword match, pattern match, title match
    
    let score = Math.max(0, 100 - discovery.googleRank * 5); // Base on Google rank
    
    // Boost if keyword in title
    if (page.title?.toLowerCase().includes(discovery.keyword.toLowerCase())) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }
}
```

---

## 8. Complete Example

```typescript
// A complete end-to-end example

const discoveryRecord: DiscoveryRecord = {
  id: 'disc-123',
  searchId: 'search-456',
  googleRank: 1,
  url: 'https://blackrock.com/contact',
  pageTitle: 'Contact Us',
  snippet: 'Contact us at info@blackrock.com',
  query: 'hedge funds contact New York',
  keyword: 'hedge funds',
  location: 'New York',
  pattern: 'contact',
  status: 'pending',
  discoveredAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const page: ParsedPage = {
  title: 'BlackRock - Contact Us',
  description: 'Get in touch with BlackRock',
  url: 'https://blackrock.com/contact',
  html: '...',
  schemaOrg: {
    Organization: { name: 'BlackRock, Inc.' }
  },
  extractionMethod: 'jsdom',
  processingTimeMs: 3000
};

const deobfuscationResults: DeobfuscationResult[] = [
  { email: 'info@blackrock.com', method: 'mailto', confidence: 99 }
];

const intelligence = await new IntelligenceRecordBuilder().build({
  discoveryRecord,
  page,
  rawEmails: ['info@blackrock.com'],
  deobfuscationResults,
  workerId: 'worker-123'
});

// Result:
{
  id: 'intel-789',
  discoveryId: 'disc-123',
  pageTitle: 'BlackRock - Contact Us',
  pageUrl: 'https://blackrock.com/contact',
  company: {
    name: 'BlackRock, Inc.',
    confidence: 98,
    detectionMethod: 'schema'
  },
  emails: [{
    email: 'info@blackrock.com',
    confidence: 97,
    extractionMethod: 'jsdom',
    obfuscationType: 'none',
    deobfuscationPlugin: 'mailto',
    evidence: {
      foundIn: 'footer',
      htmlSnippet: '<footer>Contact us at info@blackrock.com</footer>',
      selector: 'footer a',
      tagName: 'a',
      reasonForMatch: "Matched 'contact' pattern and mailto link"
    },
    patternMatching: {
      stage1Matched: true,
      stage2Matched: true,
      stage3Matched: true,
      matchedPatterns: ['contact']
    }
  }],
  searchContext: {
    query: 'hedge funds contact New York',
    keyword: 'hedge funds',
    googleRank: 1,
    googleSnippet: 'Contact us at info@blackrock.com',
    location: 'New York',
    pattern: 'contact'
  },
  quality: {
    pageRelevance: 95,
    emailCount: 1,
    highConfidenceEmails: 1,
    extractionMethod: 'jsdom',
    processingTimeMs: 3000
  },
  extractedAt: Date.now(),
  workerId: 'worker-123',
  version: '2.0.0',
  createdAt: Date.now()
}
```

---

## Implementation Checklist

- [ ] Create lib/types/discovery.ts
- [ ] Create lib/types/intelligence.ts
- [ ] Create lib/extraction/deobfuscation/types.ts
- [ ] Create lib/intelligence/company-detector.ts
- [ ] Create lib/intelligence/pattern-validator.ts
- [ ] Create lib/intelligence/evidence-builder.ts
- [ ] Create lib/intelligence/intelligence-builder.ts
- [ ] Update Worker to use IntelligenceRecordBuilder
- [ ] Create PostgreSQL schema
- [ ] Add unit tests for each class
- [ ] Add integration tests
- [ ] Update API endpoints
