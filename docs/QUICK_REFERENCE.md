# Intelligence Extraction Engine - Quick Reference Card

**Print this page. 1-page decision guide.**

---

## Current State vs. Proposed

### What's Working ✅
- JSDOM + Puppeteer extraction
- 10 deobfuscation methods  
- Queue-based job processing
- Keyword tracking
- URL deduplication

### What's Missing ❌
- **Evidence tracking** (WHERE emails found)
- **Company detection** (WHAT company)
- **Page metadata** (title, description)
- **Confidence scoring** (HOW reliable)
- **Pattern validation** (DOES it match)

---

## The Problem (vs SerpDigger)

```
User wants to search for "software developers in NYC with email"

Current system:
  ✓ Searches for phrase
  ✓ Extracts emails
  ✗ Cannot validate email pattern
  ✗ Cannot show WHERE email found
  ✗ Cannot auto-extract company name
  ✗ Cannot score result quality
  ✗ Cannot filter low-confidence results

Result: Manual verification required, 50% false positives
```

---

## The Solution (7 Modules)

### 1️⃣ HTML Extractor
**Extract page structure & metadata**
- Time: <3s
- Output: title, description, OG tags, emails
- Fast JSDOM-based

### 2️⃣ JavaScript Extractor  
**Handle dynamic sites**
- Time: <8s
- Output: Rendered HTML, detected frameworks
- Puppeteer with smart waits

### 3️⃣ Shadow DOM Extractor
**Web Components support**
- Time: <3s
- Output: Shadow DOM emails
- Puppeteer page evaluation

### 4️⃣ Email Deobfuscation Engine
**Extract + validate emails**
- Time: <500ms
- Methods: 15+ techniques
- Output: Email + confidence (0-100)

### 5️⃣ Evidence Tracker
**WHERE was email found**
- Time: <100ms
- Output: Location (footer/contact/hero), context
- Analyzes page structure

### 6️⃣ Company Detector
**WHAT company is this**
- Time: <200ms
- Methods: Domain parsing, OG tags, fuzzy match
- Output: Company name + confidence

### 7️⃣ Result Metadata Manager
**Assemble final result**
- Time: <100ms
- Output: Rich metadata, quality scores
- Aggregates all modules

---

## Data Model Change

### Current
```json
{
  "id": "job-123",
  "emails": ["user@example.com"],
  "totalEmails": 1
}
```

### Proposed
```json
{
  "id": "job-123",
  "company": {
    "name": "Acme Corp",
    "confidence": 95
  },
  "pageTitle": "Acme Corp - Careers",
  "emails": [
    {
      "email": "careers@acme.com",
      "confidence": 98,
      "sourceLocation": {
        "section": "contact_page",
        "context": "Send your resume to careers@acme.com"
      },
      "matchedPatterns": ["*@acme.com"],
      "deobfuscationMethod": "direct"
    }
  ],
  "quality": {
    "totalEmails": 1,
    "highConfidence": 1,
    "pageRelevance": 95
  }
}
```

---

## 5 Critical Decisions

### 1. Pattern Matching
- **A:** Strict (fast, limited) 
- **B:** Fuzzy ← **RECOMMENDED**
- **C:** ML model (accurate, complex)

### 2. Company Detection
- **A:** URL only (fast, basic)
- **B:** URL + metadata ← **RECOMMENDED**
- **C:** API integration (accurate, latency)

### 3. Confidence Scoring
- **A:** Simple average (fast)
- **B:** Weighted average ← **RECOMMENDED**
- **C:** ML model (accurate, complex)

### 4. Storage Strategy
- Current: 20 bytes per email
- Proposed: 500-1000 bytes per email
- **Impact:** 25-50x storage increase
- **Question:** Acceptable? Archive policy?

### 5. API Versioning
- **A:** Dual format (backward compatible, big payload)
- **B:** Versioning ← **RECOMMENDED**
- **C:** Breaking change (clean, requires migration)

---

## Implementation Timeline

```
Phase 1 (Wk 1-2):  Foundation
  → Module structure, extend deobfuscation, update Job model
  
Phase 2 (Wk 2-3):  Advanced Extraction  
  → HTML, JS, Shadow DOM extractors + company detector
  
Phase 3 (Wk 3-4):  Intelligence Layer
  → Deobfuscation engine, evidence tracker, orchestrator
  
Phase 4 (Wk 4-5):  Integration & Testing
  → Worker integration, API updates, dashboard updates
  
Phase 5 (Wk 5-6):  Performance & Polish
  → Optimization, monitoring, documentation

TOTAL: 5-6 weeks with full team
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Feature parity | ✅ All 6 SerpDigger features | ⚠️ 1/6 |
| Confidence | 95%+ on high-quality | ❌ N/A |
| Page relevance | 85%+ | ❌ N/A |
| False positive rate | <5% | ~50% |
| Extraction time | <12s/URL | <20s/URL |
| Company accuracy | 95%+ | ❌ N/A |
| Evidence tracking | 100% URLs | ❌ 0% |

---

## Key Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Module complexity | 🔴 High | Comprehensive testing |
| Performance regression | 🔴 High | Profile & optimize |
| Storage explosion | 🟠 Medium | Archive policy |
| False positives | 🟠 Medium | Strict thresholds |
| Puppeteer crashes | 🟠 Medium | Watchdog monitoring |

---

## File Locations

```
docs/
├── QUICK_REFERENCE.md (you are here)
├── DIAGNOSIS_SUMMARY.md (👈 read this next)
├── INTELLIGENCE_EXTRACTION_ENGINE_DESIGN.md
├── IMPLEMENTATION_CHECKLIST.md
├── MODULE_ARCHITECTURE_REFERENCE.md
└── ANALYSIS_INDEX.md
```

---

## Next Steps

### Week 1: Decision
- [ ] Read DIAGNOSIS_SUMMARY.md
- [ ] Decide on 5 critical points
- [ ] Approve timeline & budget
- [ ] Authorize storage changes

### Week 2-7: Implementation
- [ ] Phase 1-5 execution
- [ ] Weekly progress reviews
- [ ] Quality gates
- [ ] Production deployment

---

## One-Liner Summary

**Transform extraction from simple email array to intelligent platform with company detection, evidence tracking, confidence scoring, and pattern validation.**

---

## Questions?

- **"How accurate will company detection be?"** 
  → 95%+ with Option B (URL + metadata), using fuzzy matching

- **"Will this break existing integrations?"**
  → No, API versioning strategy maintains backward compatibility

- **"How much will Redis storage increase?"**
  → 25-50x for campaigns with 1000+ emails

- **"Can we skip some modules?"**
  → No, all 7 are needed for SerpDigger parity

- **"What's the performance impact?"**
  → <12s per URL (within existing 20s job timeout)

- **"How long is implementation?"**
  → 5-6 weeks with full-time developer team

---

**Analysis completed: July 17, 2026**  
**Status: ✅ READY FOR APPROVAL**

