# Deobfuscation Methods Reference

**Total Methods:** 24+  
**Status:** Planned (implementation Phase 1)  
**Complexity:** Simple → Advanced  
**Performance Target:** <500ms for all methods combined

---

## Method Categories

### Tier 1: Simple Text Replacements (Existing)

#### 1. Direct Email Regex
**Status:** ✅ Existing  
**Example:** `user@example.com` in plain text  
**Regex:** `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`  
**Confidence:** 99%  
**Speed:** <1ms

#### 2. Text Obfuscation ([at], (at), DOT, [dot])
**Status:** ✅ Existing  
**Example:** `user[at]example[dot]com`  
**Method:** String replace patterns  
**Confidence:** 95%  
**Speed:** <1ms

#### 3. HTML Entity Decoding
**Status:** ✅ Existing  
**Example:** `user&#64;example&#46;com`  
**Method:** Decode HTML entities then regex  
**Confidence:** 95%  
**Speed:** <5ms

#### 4. Base64 Encoding
**Status:** ✅ Existing  
**Example:** `dXNlckBleGFtcGxlLmNvbQ==`  
**Method:** Detect base64 patterns, decode, extract emails  
**Confidence:** 85%  
**Speed:** <10ms

#### 5. mailto: Links
**Status:** ✅ Existing  
**Example:** `<a href="mailto:user@example.com">Contact</a>`  
**Method:** Regex: `/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/gi`  
**Confidence:** 98%  
**Speed:** <1ms

#### 6. String Reverse
**Status:** ✅ Existing  
**Example:** Reverse entire text, find emails, reverse them back  
**Method:** Reverse full text, regex, reverse matches  
**Confidence:** 75% (low, many false positives)  
**Speed:** <5ms

#### 7. ROT13 Encoding
**Status:** ✅ Existing  
**Example:** `hfre@rknzcyr.pbz` → `user@example.com`  
**Method:** Apply ROT13, regex extract  
**Confidence:** 85%  
**Speed:** <10ms

#### 8. URL Encoding
**Status:** ✅ Existing  
**Example:** `user%40example%2Ecom`  
**Method:** `decodeURIComponent()`, regex extract  
**Confidence:** 95%  
**Speed:** <5ms

#### 9. JSON Embedded Emails
**Status:** ✅ Existing  
**Example:** `{"email":"user@example.com"}`  
**Method:** Parse JSON, extract email fields  
**Confidence:** 98%  
**Speed:** <10ms

#### 10. String Concatenation (Basic)
**Status:** ✅ Existing (partial)  
**Example:** `"user" + "@" + "example.com"`  
**Method:** Pattern detection and assembly  
**Confidence:** 60% (complex, many false positives)  
**Speed:** <50ms

---

### Tier 2: HTML & Entity Encoding (NEW)

#### 11. Decimal HTML Entities
**Status:** 🆕 NEW  
**Example:** `user&#64;example&#46;com`  
**Method:** Convert decimal entities to chars: `&#64;` → `@`  
**Regex:** `/&#(\d+);/g` then `String.fromCharCode()`  
**Confidence:** 96%  
**Speed:** <5ms  
**Implementation:**
```typescript
function deobfuscateDecimalEntities(text: string): string[] {
  const decoded = text.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  return extractEmails(decoded);
}
```

#### 12. Hexadecimal HTML Entities
**Status:** 🆕 NEW  
**Example:** `user&#x40;example&#x2e;com`  
**Method:** Convert hex entities: `&#x40;` → `@`  
**Regex:** `/&#x([a-f0-9]+);/gi`  
**Confidence:** 96%  
**Speed:** <5ms  
**Implementation:**
```typescript
function deobfuscateHexEntities(text: string): string[] {
  const decoded = text.replace(/&#x([a-f0-9]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  return extractEmails(decoded);
}
```

#### 13. Named HTML Entities
**Status:** 🆕 NEW  
**Example:** `user&commat;example&period;com`  
**Method:** Replace named entities: `&commat;` → `@`  
**Confidence:** 92%  
**Speed:** <5ms  
**Implementation:**
```typescript
const namedEntities = {
  'commat': '@',
  'period': '.',
  'atat': '@@',
  'at': '@',
  'dot': '.',
  'dash': '-',
  'underscore': '_',
};

function deobfuscateNamedEntities(text: string): string[] {
  let decoded = text;
  for (const [name, char] of Object.entries(namedEntities)) {
    decoded = decoded.replace(new RegExp(`&${name};`, 'gi'), char);
  }
  return extractEmails(decoded);
}
```

---

### Tier 3: JavaScript & Framework Hydration (NEW)

#### 14. String Concatenation (Advanced)
**Status:** 🆕 NEW  
**Example:** `"user" + "." + "name" + "@" + "example" + "." + "com"`  
**Method:** Parse JavaScript string concatenation patterns  
**Confidence:** 70% (many false positives possible)  
**Speed:** <100ms  
**Implementation:**
```typescript
function deobfuscateStringConcat(text: string): string[] {
  // Match patterns like "email" + "@" + "domain"
  const patterns = [
    /["']([^"']+)["']\s*\+\s*["']([^"']+)["']/g,  // "a" + "b"
    /["']([^"']+)["']\s*\+\s*["']([^"']+)["']\s*\+\s*["']([^"']+)["']/g, // "a" + "b" + "c"
  ];
  
  const results = new Set<string>();
  // Try to assemble pieces into email-like format
  // ... complex logic to find valid email patterns
  return Array.from(results);
}
```

#### 15. Next.js NEXT_DATA Hydration
**Status:** 🆕 NEW  
**Example:** `<script id="__NEXT_DATA__" type="application/json">{...}</script>`  
**Method:** Extract NEXT_DATA JSON, search for email fields  
**Confidence:** 95%  
**Speed:** <20ms  
**Implementation:**
```typescript
function deobfuscateNextJSData(html: string): string[] {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (!match) return [];
  
  try {
    const data = JSON.parse(match[1]);
    return extractEmailsFromObject(data);
  } catch {
    return [];
  }
}
```

#### 16. React Hydration Data
**Status:** 🆕 NEW  
**Example:** `window.__INITIAL_STATE__ = {...}`  
**Method:** Extract React __INIT variables, search for emails  
**Confidence:** 92%  
**Speed:** <20ms  
**Implementation:**
```typescript
function deobfuscateReactHydration(text: string): string[] {
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?/,
    /window\.__DATA__\s*=\s*(\{[\s\S]*?\});?/,
    /const\s+__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?/,
  ];
  
  const results: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        results.push(...extractEmailsFromObject(data));
      } catch {
        // Invalid JSON, skip
      }
    }
  }
  return results;
}
```

#### 17. Vue Hydration Data
**Status:** 🆕 NEW  
**Example:** `window.__vue__ = {...}`  
**Method:** Extract Vue state objects  
**Confidence:** 90%  
**Speed:** <20ms  
**Implementation:**
```typescript
function deobfuscateVueHydration(text: string): string[] {
  const patterns = [
    /window\.__vue__\s*=\s*(\{[\s\S]*?\});?/,
    /window\.__VUE_DEVTOOLS_GLOBAL_HOOK__\.state\s*=\s*(\{[\s\S]*?\});?/,
  ];
  
  const results: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        results.push(...extractEmailsFromObject(data));
      } catch {
        // Invalid JSON, skip
      }
    }
  }
  return results;
}
```

#### 18. Angular State Injection
**Status:** 🆕 NEW  
**Example:** `angular.module('app').run(['$injector', function($injector) { var data = {...} }])`  
**Method:** Extract Angular injector state  
**Confidence:** 88%  
**Speed:** <30ms  
**Implementation:**
```typescript
function deobfuscateAngularState(text: string): string[] {
  // Look for window.angular module data
  const patterns = [
    /window\.(?:app|ng)\.(?:data|state|config)\s*=\s*(\{[\s\S]*?\});?/,
    /angular\.module\([^)]+\)\.(?:run|factory|service)\(\[.*?function.*?\{([\s\S]*?)\}/,
  ];
  
  const results: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        results.push(...extractEmailsFromObject(data));
      } catch {
        // Not valid JSON, skip
      }
    }
  }
  return results;
}
```

---

### Tier 4: Character Encoding (NEW)

#### 19. Unicode Escape Sequences
**Status:** 🆕 NEW  
**Example:** `\u0075\u0073\u0065\u0072\u0040\u0065...` → `user@example.com`  
**Method:** Replace Unicode escapes with actual characters  
**Regex:** `/\\u([0-9a-f]{4})/gi`  
**Confidence:** 95%  
**Speed:** <10ms  
**Implementation:**
```typescript
function deobfuscateUnicode(text: string): string[] {
  const decoded = text.replace(/\\u([0-9a-f]{4})/gi, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  return extractEmails(decoded);
}
```

#### 20. Hex Byte Encoding
**Status:** 🆕 NEW  
**Example:** `\x75\x73\x65\x72` → `user`  
**Method:** Replace hex byte escapes with characters  
**Regex:** `/\\x([0-9a-f]{2})/gi`  
**Confidence:** 94%  
**Speed:** <10ms  
**Implementation:**
```typescript
function deobfuscateHexBytes(text: string): string[] {
  const decoded = text.replace(/\\x([0-9a-f]{2})/gi, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });
  return extractEmails(decoded);
}
```

---

### Tier 5: CSS & DOM Manipulation (NEW)

#### 21. CSS Hidden Text
**Status:** 🆕 NEW  
**Example:** `<span style="display:none">user@example.com</span>`  
**Method:** Extract all text, including hidden elements (JSDOM already does this)  
**Confidence:** 99%  
**Speed:** <5ms  
**Implementation:**
```typescript
function deobfuscateCSSHidden(dom: Document): string[] {
  // JSDOM already extracts all text including hidden elements
  // This is a no-op but included for completeness
  return extractEmailsFromDOM(dom);
}
```

#### 22. Data Attributes
**Status:** 🆕 NEW  
**Example:** `<div data-email="user@example.com">Contact</div>`  
**Method:** Extract all data-* attributes containing emails  
**Confidence:** 95%  
**Speed:** <10ms  
**Implementation:**
```typescript
function deobfuscateDataAttributes(dom: Document): string[] {
  const results: string[] = [];
  const elements = dom.querySelectorAll('[data-email], [data-mail], [data-contact]');
  
  for (const el of elements) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-') && attr.value) {
        const matches = attr.value.match(emailRegex);
        if (matches) results.push(...matches);
      }
    }
  }
  return results;
}
```

#### 23. Click Handler Text
**Status:** 🆕 NEW  
**Example:** `<a onclick="alert('Contact: user@example.com')">Click</a>`  
**Method:** Extract onclick/onload handler text  
**Confidence:** 70% (many false positives)  
**Speed:** <20ms  
**Implementation:**
```typescript
function deobfuscateClickHandlers(html: string): string[] {
  const results: string[] = [];
  const handlers = html.match(/on\w+\s*=\s*["']([^"']*)["']/gi) || [];
  
  for (const handler of handlers) {
    const matches = handler.match(emailRegex);
    if (matches) results.push(...matches);
  }
  return results;
}
```

#### 24. Shadow DOM & Web Components
**Status:** 🆕 NEW  
**Example:** `<custom-element>.shadowRoot contains email</custom-element>`  
**Method:** Access shadow DOM with Puppeteer page.evaluate()  
**Confidence:** 95%  
**Speed:** <100ms (requires Puppeteer)  
**Implementation:**
```typescript
async function deobfuscateShadowDOM(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const results: string[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    // Traverse shadow DOMs
    function traverse(element: Element) {
      if (element.shadowRoot) {
        const text = element.shadowRoot.textContent;
        if (text) results.push(...text.match(emailRegex) || []);
        
        for (const child of element.shadowRoot.children) {
          traverse(child);
        }
      }
      
      for (const child of element.children) {
        traverse(child);
      }
    }
    
    traverse(document.documentElement);
    return results;
  });
}
```

---

### Tier 6: Advanced Obfuscation (NEW)

#### 25. Cloudflare Email Protection
**Status:** 🆕 NEW  
**Example:** `<a href="/cdn-cgi/l/email-protection#deadbeef">protected</a>`  
**Method:** Detect Cloudflare protection pattern, extract encoded email  
**Confidence:** 85% (need to decode)  
**Speed:** <50ms  
**Implementation:**
```typescript
function deobfuscateCloudflare(html: string): string[] {
  // Cloudflare encoded emails look like: /cdn-cgi/l/email-protection#<hex>
  const pattern = /\/cdn-cgi\/l\/email-protection#([a-f0-9]+)/gi;
  const results: string[] = [];
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const encoded = match[1];
    try {
      // Cloudflare uses XOR encoding with a key
      // The decoding requires JavaScript evaluation in Puppeteer context
      // For now, we can at least flag that Cloudflare protection was detected
      results.push(`[CLOUDFLARE_PROTECTED:${encoded}]`);
    } catch {
      // Cannot decode, skip
    }
  }
  
  return results;
}
```

#### 26. SVG Embedded Text
**Status:** 🆕 NEW  
**Example:** `<svg><text x="10" y="10">user@example.com</text></svg>`  
**Method:** Extract text from SVG elements  
**Confidence:** 98%  
**Speed:** <10ms  
**Implementation:**
```typescript
function deobfuscateSVGText(dom: Document): string[] {
  const results: string[] = [];
  const textElements = dom.querySelectorAll('svg text, svg tspan');
  
  for (const el of textElements) {
    const text = el.textContent;
    if (text) {
      const matches = text.match(emailRegex);
      if (matches) results.push(...matches);
    }
  }
  return results;
}
```

#### 27. Canvas Rendered Text (FUTURE)
**Status:** 📅 FUTURE  
**Example:** Email rendered as pixels on canvas (requires OCR)  
**Method:** Use Tesseract.js or similar OCR  
**Confidence:** 60-80% (OCR limitations)  
**Speed:** 500-2000ms  
**Note:** Expensive, should be opt-in feature  

#### 28. PDF Extraction (FUTURE)
**Status:** 📅 FUTURE  
**Example:** Email extraction from PDF documents  
**Method:** Use pdf-parse or similar  
**Confidence:** 90-95%  
**Speed:** <500ms per PDF  
**Note:** Requires separate module, can add later  

#### 29. Office Document Extraction (FUTURE)
**Status:** 📅 FUTURE  
**Example:** Email extraction from .docx, .xlsx  
**Method:** Use js-unzip or python-pptx equivalent  
**Confidence:** 95%+  
**Speed:** <200ms per document  
**Note:** Requires separate module, can add later  

#### 30. Image OCR (FUTURE)
**Status:** 📅 FUTURE  
**Example:** Email visible as text in image  
**Method:** Use Tesseract.js or Paddle OCR  
**Confidence:** 70-85%  
**Speed:** 1-5s per image  
**Note:** Expensive, should be opt-in feature  

---

## Implementation Strategy

### Phase 1: Methods 1-10 (Existing)
Already implemented ✅

### Phase 1: Methods 11-24 (NEW)
Add in this order for maximum coverage/minimum complexity:

**Week 1 (Days 1-2):**
1. Method 11: Decimal entities
2. Method 12: Hex entities  
3. Method 13: Named entities
4. Method 19: Unicode escapes
5. Method 20: Hex bytes

**Week 1 (Days 3-4):**
6. Method 14: String concatenation
7. Method 21: CSS hidden text
8. Method 22: Data attributes
9. Method 23: Click handlers

**Week 2 (Days 1-2):**
10. Method 15: Next.js data
11. Method 16: React hydration
12. Method 17: Vue hydration
13. Method 18: Angular state

**Week 2 (Days 3-4):**
14. Method 24: Shadow DOM
15. Method 25: Cloudflare protection
16. Method 26: SVG text

### Phase 2+: Methods 27-30 (FUTURE)
Add as optional modules later:
- Canvas OCR (opt-in)
- PDF extraction (opt-in)
- Office documents (opt-in)
- Image OCR (opt-in)

---

## Testing Strategy

### Test Coverage

Each method needs:
- ✅ Unit test with known obfuscation
- ✅ Test on 5+ real websites
- ✅ Performance test (<100ms each)
- ✅ False positive test
- ✅ Edge case test

### Sample Test Website Collections

**Category: Simple Obfuscation**
- Contact pages with [at] and [dot]
- Pages with HTML entities
- Pages with Base64 encoded emails

**Category: JavaScript Obfuscation**
- Next.js applications
- React applications
- Vue applications
- Angular applications

**Category: CSS Obfuscation**
- Pages with hidden email sections
- Pages with data attributes
- Pages with onclick handlers

**Category: Advanced Obfuscation**
- Cloudflare protected pages
- SVG embedded emails
- Shadow DOM components

---

## Performance Targets

| Method | Target | Priority |
|--------|--------|----------|
| Methods 1-10 | <100ms total | ✅ Existing |
| Method 11-13 | <20ms | Critical |
| Method 14 | <100ms | High |
| Method 15-18 | <100ms each | High |
| Method 19-20 | <15ms | High |
| Method 21-23 | <30ms each | Medium |
| Method 24 | <100ms | Medium |
| Method 25-26 | <50ms each | Medium |
| **Total** | **<500ms** | ✅ Target |

---

## Reference Implementation

### Orchestrator Structure

```typescript
import * as d from './deobfuscate';

export interface DeobfuscatedResult {
  email: string;
  method: string;          // Which deobfuscation method
  confidence: number;      // 0-100
  evidence?: string;       // How it was extracted
  obfuscationType?: string; // What type of obfuscation
}

export class DeobfuscationOrchestrator {
  async deobfuscateAll(
    text: string, 
    dom?: Document,
    page?: puppeteer.Page
  ): Promise<DeobfuscatedResult[]> {
    const results: DeobfuscatedResult[] = [];
    const foundEmails = new Set<string>();
    
    // Phase 1: Simple text methods (fast)
    const simple = [
      { fn: d.deobfuscateDirect, name: 'direct', confidence: 99 },
      { fn: d.deobfuscateTextObfuscation, name: 'text_obfuscation', confidence: 95 },
      { fn: d.deobfuscateHTMLEntities, name: 'html_entities', confidence: 95 },
      { fn: d.deobfuscateDecimalEntities, name: 'decimal_entities', confidence: 96 },
      { fn: d.deobfuscateHexEntities, name: 'hex_entities', confidence: 96 },
      { fn: d.deobfuscateNamedEntities, name: 'named_entities', confidence: 92 },
      { fn: d.deobfuscateMailto, name: 'mailto', confidence: 98 },
      { fn: d.deobfuscateBase64, name: 'base64', confidence: 85 },
      { fn: d.deobfuscateROT13, name: 'rot13', confidence: 85 },
      { fn: d.deobfuscateURLEncoding, name: 'url_encoding', confidence: 95 },
      { fn: d.deobfuscateUnicode, name: 'unicode', confidence: 95 },
      { fn: d.deobfuscateHexBytes, name: 'hex_bytes', confidence: 94 },
    ];
    
    // Phase 2: DOM methods (if available)
    const domMethods = [
      { fn: d.deobfuscateDataAttributes, name: 'data_attributes', confidence: 95 },
      { fn: d.deobfuscateSVGText, name: 'svg_text', confidence: 98 },
      { fn: d.deobfuscateClickHandlers, name: 'click_handlers', confidence: 70 },
    ];
    
    // Phase 3: JSON/Hydration methods
    const jsonMethods = [
      { fn: d.deobfuscateJSONData, name: 'json', confidence: 98 },
      { fn: d.deobfuscateNextJSData, name: 'nextjs_data', confidence: 95 },
      { fn: d.deobfuscateReactHydration, name: 'react_hydration', confidence: 92 },
      { fn: d.deobfuscateVueHydration, name: 'vue_hydration', confidence: 90 },
      { fn: d.deobfuscateAngularState, name: 'angular_state', confidence: 88 },
    ];
    
    // Phase 4: Complex methods
    const complexMethods = [
      { fn: d.deobfuscateStringConcat, name: 'string_concat', confidence: 70 },
    ];
    
    // Phase 5: Browser-dependent methods (if Puppeteer available)
    const browserMethods = [
      { fn: d.deobfuscateShadowDOM, name: 'shadow_dom', confidence: 95 },
      { fn: d.deobfuscateCloudflare, name: 'cloudflare', confidence: 85 },
    ];
    
    // Run simple methods
    for (const { fn, name, confidence } of simple) {
      try {
        const emails = await fn(text);
        for (const email of emails) {
          if (!foundEmails.has(email.toLowerCase())) {
            results.push({
              email: email.toLowerCase(),
              method: name,
              confidence,
            });
            foundEmails.add(email.toLowerCase());
          }
        }
      } catch (error) {
        console.log(`[Deobfuscation] Method ${name} failed:`, error);
      }
    }
    
    // Run DOM methods if available
    if (dom) {
      for (const { fn, name, confidence } of domMethods) {
        try {
          const emails = await fn(dom);
          for (const email of emails) {
            if (!foundEmails.has(email.toLowerCase())) {
              results.push({
                email: email.toLowerCase(),
                method: name,
                confidence,
              });
              foundEmails.add(email.toLowerCase());
            }
          }
        } catch (error) {
          console.log(`[Deobfuscation] Method ${name} failed:`, error);
        }
      }
    }
    
    // ... continue with other phases
    
    return results;
  }
}
```

---

## Next Steps

1. Review this reference document
2. Approve Phase 1 of REVISED_IMPLEMENTATION_PLAN.md
3. Begin implementation of methods 11-26
4. Test on real websites
5. Measure performance
6. Proceed to Phase 2 (Evidence & Company modules)

