# Phase 2: Data Model Reference

## Intelligence Object - Complete Specification

### Structure Overview

```typescript
interface IntelligenceRecord {
  // Identification & Status
  id: string;
  status: "completed" | "failed" | "processing";
  timestamp: number;
  workerId: string;
  
  // Source Identification
  company: CompanyInfo;
  website: string;
  page: PageInfo;
  
  // Search Context
  query: QueryContext;
  
  // Results
  emails: EmailIntelligence[];
  
  // Quality Metrics
  quality: QualityMetrics;
  
  // Crawl Details
  crawl: CrawlInfo;
  
  // Error (if applicable)
  error: null | string;
}
```

---

## Detailed Field Specifications

### 1. Company Detection

```typescript
interface CompanyInfo {
  // Company name extracted from:
  // Priority: Schema.org > Domain > Page Title > OG Tags
  name: string;
  
  // Confidence: 0-100
  // 99: Schema.org Organization
  // 95: Domain extraction + metadata match
  // 85: Domain-only extraction
  // 75: Page title extraction
  confidence: number;
  
  // Source of extraction
  source: "schema" | "domain" | "page_title" | "og_tags" | "favicon";
  
  // Domain extracted from URL
  domain: string;
}

// Example
{
  name: "BlackRock Inc",
  confidence: 95,
  source: "schema",
  domain: "blackrock.com"
}
```

**Implementation Strategy:**
1. Parse URL → extract domain name → capitalize
2. Query Schema.org Organization data
3. Check OG tags (og:site_name)
4. Fallback to page `<title>`

---

### 2. Page Information

```typescript
interface PageInfo {
  // Page metadata
  title: string;
  url: string;
  description?: string;
  
  // Google Search positioning
  googlePosition: number;      // 1-10 (position in search results)
  googlePage: number;          // 1-5 (which page of results)
  
  // Open Graph metadata (SEO)
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    site_name?: string;
  };
  
  // Schema.org Structured Data
  structuredData: {
    "@type"?: string;
    name?: string;
    description?: string;
    telephone?: string;
    email?: string;
    sameAs?: string[];
  };
  
  // HTTP response info
  statusCode: number;
  headers: {
    contentType?: string;
    charset?: string;
    lastModified?: string;
  };
}

// Example
{
  title: "Contact Us - BlackRock",
  url: "https://www.blackrock.com/us/en/contact-us",
  description: "Get in touch with BlackRock. Contact our offices and teams.",
  googlePosition: 4,
  googlePage: 1,
  openGraph: {
    title: "Contact BlackRock",
    description: "Reach out to BlackRock",
    image: "https://www.blackrock.com/og-image.jpg",
    site_name: "BlackRock"
  },
  structuredData: {
    "@type": "Organization",
    name: "BlackRock Inc",
    telephone: "+1-212-810-5000",
    email: "clientservices@blackrock.com"
  },
  statusCode: 200,
  headers: {
    contentType: "text/html",
    charset: "utf-8"
  }
}
```

**Extraction Points:**
- Title: `document.querySelector('title').textContent`
- Description: `meta[name="description"]` or `meta[property="og:description"]`
- Schema.org: Parse `<script type="application/ld+json">`
- OpenGraph: Parse `<meta property="og:*">`

---

### 3. Query Context

```typescript
interface QueryContext {
  // Original search parameters
  keyword: string;              // e.g., "asset management"
  location: string;             // e.g., "New York"
  pattern: string;              // e.g., "contact" | "careers"
  
  // Generated query sent to Google
  generatedQuery: string;       // Final Google PSE query
  
  // Search details
  googlePage: number;           // 1-5 (which page of results)
  googlePosition: number;       // 1-10 (position on page)
  
  // Timestamp
  queriedAt: number;            // When query was executed
}

// Example
{
  keyword: "asset management firms",
  location: "New York",
  pattern: "contact",
  generatedQuery: "asset management firms New York contact email",
  googlePage: 2,
  googlePosition: 4,
  queriedAt: 1699564800000
}
```

---

### 4. Email Intelligence

```typescript
interface EmailIntelligence {
  // The email address
  email: string;
  
  // Confidence: 0-100
  // Factors:
  // - Format validity: 0-30 points
  // - Deobfuscation methods: 0-30 points (capped)
  // - Domain match: 0-20 points
  // - Page relevance: 0-20 points
  confidence: number;
  
  // How was email encoded/stored
  obfuscation: 
    | "none"                      // Plain email
    | "mailto_link"              // <a href="mailto:">
    | "html_entities"            // &#64; &#46;
    | "decimal_entities"         // &#117;&#115;
    | "hex_entities"             // &#x75;&#x73;
    | "base64"                   // aW5mb0BleGFtcGxl
    | "url_encoded"              // user%40example%2Ecom
    | "rot13"                    // hfre@rknzcyr.pbz
    | "reversed"                 // moc.elpmaxe@resu
    | "json_string"              // "email":"user@"
    | "unicode_escape"           // \u0075\u0073
    | "css_hidden"               // display:none
    | "cloudflare"               // Protected by Cloudflare
    | "other";
  
  // Which extraction method found it
  method: 
    | "mailto"                   // mailto: link
    | "html_attribute"           // HTML attribute (data-email, title, etc)
    | "text_content"             // Plain text in page
    | "json_structured"          // JSON-LD or structured data
    | "schema_org"               // Schema.org microdata
    | "javascript"               // JavaScript variable
    | "shadow_dom"               // Shadow DOM element
    | "iframe"                   // Same-origin iframe
    | "comment"                  // HTML comment
    | "canvas"                   // Rendered on canvas
    | "other";
  
  // Specifically which deobfuscation method(s) worked
  deobfuscationMethods: string[];  // ["htmlEntityDecode", "rot13"]
  
  // WHERE on the page was it found?
  foundIn: 
    | "header"                   // Site header/navigation
    | "footer"                   // Site footer
    | "sidebar"                  // Sidebar/aside
    | "main_content"             // Main page content
    | "contact_page"             // Contact page section
    | "careers_page"             // Careers/jobs page
    | "team_page"                // Team/staff page
    | "about_page"               // About us page
    | "form"                     // Form field
    | "metadata"                 // Page metadata (Schema.org, OG tags)
    | "unknown";
  
  // HTML snippet showing context
  snippet: string;              // 50-200 char excerpt
  
  // Full HTML element context
  htmlElement?: {
    tag: string;                // "a", "p", "div", etc
    id?: string;
    class?: string;
    content: string;            // Full element HTML
  };
  
  // Pattern matching results
  matchedPatterns: {
    stage1GoogleQuery: boolean;     // Was in Stage 1 query generation
    stage2UrlMatch: boolean;        // Matched URL pattern
    stage3HtmlMatch: string[];      // Matched patterns in HTML
  };
  
  // When was it extracted
  timestamp: number;
}

// Example 1: Simple email
{
  email: "info@blackrock.com",
  confidence: 98,
  obfuscation: "none",
  method: "mailto",
  deobfuscationMethods: ["directRegex"],
  foundIn: "footer",
  snippet: 'For inquiries, email <a href="mailto:info@blackrock.com">info@blackrock.com</a>',
  htmlElement: {
    tag: "a",
    class: "footer-link",
    content: '<a href="mailto:info@blackrock.com" class="footer-link">Contact us</a>'
  },
  matchedPatterns: {
    stage1GoogleQuery: true,
    stage2UrlMatch: true,
    stage3HtmlMatch: ["contact"]
  },
  timestamp: 1699564800000
}

// Example 2: Obfuscated email
{
  email: "careers@blackrock.com",
  confidence: 82,
  obfuscation: "html_entities",
  method: "text_content",
  deobfuscationMethods: ["htmlEntityDecode", "directRegex"],
  foundIn: "careers_page",
  snippet: "For careers inquiries: careers[at]blackrock[dot]com",
  htmlElement: {
    tag: "p",
    id: "careers-email",
    content: '<p id="careers-email">Email us at careers&#64;blackrock&#46;com</p>'
  },
  matchedPatterns: {
    stage1GoogleQuery: true,
    stage2UrlMatch: true,
    stage3HtmlMatch: ["careers"]
  },
  timestamp: 1699564800000
}

// Example 3: Low confidence email
{
  email: "support@blackrock.com",
  confidence: 55,
  obfuscation: "other",
  method: "json_structured",
  deobfuscationMethods: ["jsonParse"],
  foundIn: "metadata",
  snippet: "supportEmail in JSON-LD schema data",
  htmlElement: {
    tag: "script",
    content: '<script type="application/ld+json">{"supportEmail":"support@blackrock.com"}</script>'
  },
  matchedPatterns: {
    stage1GoogleQuery: false,
    stage2UrlMatch: false,
    stage3HtmlMatch: []
  },
  timestamp: 1699564800000
}
```

---

### 5. Quality Metrics

```typescript
interface QualityMetrics {
  // Email statistics
  totalEmails: number;          // Total emails found
  highConfidence: number;       // >= 90%
  mediumConfidence: number;     // 70-89%
  lowConfidence: number;        // < 70%
  
  // Page relevance to query (0-100)
  // Based on title match, content match, keyword density
  pageRelevance: number;
  
  // Processing details
  executionTime: number;        // ms
  deobfuscationMethods: number; // How many methods found emails
  patternsMatched: string[];    // Which patterns matched
}

// Example
{
  totalEmails: 3,
  highConfidence: 2,
  mediumConfidence: 1,
  lowConfidence: 0,
  pageRelevance: 92,
  executionTime: 4200,
  deobfuscationMethods: 5,
  patternsMatched: ["contact", "careers"]
}
```

---

### 6. Crawl Information

```typescript
interface CrawlInfo {
  // Execution status
  status: "completed" | "failed" | "partial";
  
  // Extraction method used
  method: "jsdom" | "puppeteer";
  
  // Performance
  duration: number;             // milliseconds
  
  // Resource usage
  htmlSize: number;             // bytes
  textSize: number;             // bytes
  
  // HTTP response
  statusCode: number;
  redirects: number;
  
  // Browser details (if Puppeteer)
  viewport?: {
    width: number;
    height: number;
  };
  
  // JavaScript execution
  jsExecuted: boolean;          // Was JavaScript run?
  jsErrors: string[];           // Any JS errors encountered
}

// Example
{
  status: "completed",
  method: "puppeteer",
  duration: 4200,
  htmlSize: 245600,
  textSize: 89300,
  statusCode: 200,
  redirects: 0,
  viewport: {
    width: 1920,
    height: 1080
  },
  jsExecuted: true,
  jsErrors: []
}
```

---

## Full Example: Complete Intelligence Record

```json
{
  "id": "job-abc123def456",
  "status": "completed",
  "timestamp": 1699564800000,
  "workerId": "worker-xyz789",
  
  "company": {
    "name": "BlackRock Inc",
    "confidence": 95,
    "source": "schema",
    "domain": "blackrock.com"
  },
  
  "website": "https://www.blackrock.com",
  
  "page": {
    "title": "Contact BlackRock",
    "url": "https://www.blackrock.com/us/en/contact-us",
    "description": "Get in touch with BlackRock offices worldwide",
    "googlePosition": 4,
    "googlePage": 1,
    "openGraph": {
      "title": "Contact BlackRock",
      "description": "Reach out to BlackRock worldwide",
      "image": "https://www.blackrock.com/images/og-contact.jpg",
      "site_name": "BlackRock"
    },
    "structuredData": {
      "@type": "Organization",
      "name": "BlackRock Inc",
      "telephone": "+1-212-810-5000",
      "email": "clientservices@blackrock.com"
    },
    "statusCode": 200,
    "headers": {
      "contentType": "text/html",
      "charset": "utf-8"
    }
  },
  
  "query": {
    "keyword": "asset management firms",
    "location": "New York",
    "pattern": "contact",
    "generatedQuery": "asset management firms New York contact email",
    "googlePage": 1,
    "googlePosition": 4,
    "queriedAt": 1699564800000
  },
  
  "emails": [
    {
      "email": "info@blackrock.com",
      "confidence": 98,
      "obfuscation": "none",
      "method": "mailto",
      "deobfuscationMethods": ["directRegex"],
      "foundIn": "footer",
      "snippet": "<a href=\"mailto:info@blackrock.com\">Contact us</a>",
      "htmlElement": {
        "tag": "a",
        "class": "footer-contact",
        "content": "<a href=\"mailto:info@blackrock.com\" class=\"footer-contact\">Contact us</a>"
      },
      "matchedPatterns": {
        "stage1GoogleQuery": true,
        "stage2UrlMatch": true,
        "stage3HtmlMatch": ["contact"]
      },
      "timestamp": 1699564800000
    },
    {
      "email": "careers@blackrock.com",
      "confidence": 88,
      "obfuscation": "html_entities",
      "method": "text_content",
      "deobfuscationMethods": ["htmlEntityDecode"],
      "foundIn": "careers_page",
      "snippet": "Careers inquiries: careers&#64;blackrock&#46;com",
      "htmlElement": {
        "tag": "p",
        "id": "careers-contact",
        "content": "<p id=\"careers-contact\">Email: careers&#64;blackrock&#46;com</p>"
      },
      "matchedPatterns": {
        "stage1GoogleQuery": true,
        "stage2UrlMatch": true,
        "stage3HtmlMatch": ["careers"]
      },
      "timestamp": 1699564800000
    },
    {
      "email": "support@blackrock.com",
      "confidence": 92,
      "obfuscation": "none",
      "method": "json_structured",
      "deobfuscationMethods": ["directRegex"],
      "foundIn": "metadata",
      "snippet": "supportEmail in Schema.org data",
      "htmlElement": {
        "tag": "script",
        "content": "<script type=\"application/ld+json\">{\"supportEmail\":\"support@blackrock.com\"}</script>"
      },
      "matchedPatterns": {
        "stage1GoogleQuery": false,
        "stage2UrlMatch": false,
        "stage3HtmlMatch": []
      },
      "timestamp": 1699564800000
    }
  ],
  
  "quality": {
    "totalEmails": 3,
    "highConfidence": 2,
    "mediumConfidence": 1,
    "lowConfidence": 0,
    "pageRelevance": 94,
    "executionTime": 4200,
    "deobfuscationMethods": 3,
    "patternsMatched": ["contact", "careers"]
  },
  
  "crawl": {
    "status": "completed",
    "method": "puppeteer",
    "duration": 4200,
    "htmlSize": 245600,
    "textSize": 89300,
    "statusCode": 200,
    "redirects": 0,
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "jsExecuted": true,
    "jsErrors": []
  },
  
  "error": null
}
```

---

## Backward Compatibility Details

### API v1 Response (Old Format)
```json
{
  "id": "job-abc123def456",
  "emails": [
    "info@blackrock.com",
    "careers@blackrock.com",
    "support@blackrock.com"
  ],
  "totalEmails": 3
}
```

### API v2 Response (Full Intelligence)
```json
{
  ... [Full Intelligence Object as shown above]
}
```

**Key Point:** v1 API simply extracts the `emails` array from the full object. No data is lost.

---

## Storage Comparison

### Before Phase 2
```
Job Size: ~500 bytes
Storage per 1000 jobs: ~500 KB
```

### After Phase 2
```
Job Size: ~8-12 KB (per email: 2-3 KB)
Storage per 1000 jobs: ~8-12 MB
Storage per 1000000 jobs: ~8-12 GB
```

**Impact:** 15-25x increase, but Redis is still cost-effective (Upstash tier handles this easily)

---

## TypeScript Interfaces (Full)

```typescript
export interface CompanyInfo {
  name: string;
  confidence: number;
  source: "schema" | "domain" | "page_title" | "og_tags" | "favicon";
  domain: string;
}

export interface PageInfo {
  title: string;
  url: string;
  description?: string;
  googlePosition: number;
  googlePage: number;
  openGraph: Record<string, string>;
  structuredData: Record<string, any>;
  statusCode: number;
  headers: Record<string, string>;
}

export interface QueryContext {
  keyword: string;
  location: string;
  pattern: string;
  generatedQuery: string;
  googlePage: number;
  googlePosition: number;
  queriedAt: number;
}

export interface EmailIntelligence {
  email: string;
  confidence: number;
  obfuscation: string;
  method: string;
  deobfuscationMethods: string[];
  foundIn: string;
  snippet: string;
  htmlElement?: {
    tag: string;
    id?: string;
    class?: string;
    content: string;
  };
  matchedPatterns: {
    stage1GoogleQuery: boolean;
    stage2UrlMatch: boolean;
    stage3HtmlMatch: string[];
  };
  timestamp: number;
}

export interface QualityMetrics {
  totalEmails: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  pageRelevance: number;
  executionTime: number;
  deobfuscationMethods: number;
  patternsMatched: string[];
}

export interface CrawlInfo {
  status: "completed" | "failed" | "partial";
  method: "jsdom" | "puppeteer";
  duration: number;
  htmlSize: number;
  textSize: number;
  statusCode: number;
  redirects: number;
  viewport?: { width: number; height: number };
  jsExecuted: boolean;
  jsErrors: string[];
}

export interface IntelligenceRecord {
  id: string;
  status: "completed" | "failed" | "processing";
  timestamp: number;
  workerId: string;
  company: CompanyInfo;
  website: string;
  page: PageInfo;
  query: QueryContext;
  emails: EmailIntelligence[];
  quality: QualityMetrics;
  crawl: CrawlInfo;
  error: null | string;
}
```

This is the complete data model for Phase 2. All fields are typed, documented, and exemplified.

