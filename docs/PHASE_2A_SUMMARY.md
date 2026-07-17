# PHASE 2A TECHNICAL SPECIFICATION – QUICK REFERENCE

**Status:** COMPLETE - Ready for Implementation  
**Document:** PHASE_2A_TECHNICAL_SPECIFICATION.md (1,831 lines)  
**Timeline:** 3-4 weeks

---

## WHAT THIS SPECIFICATION COVERS

1. **Existing Pipeline Audit** - Complete execution flow from dashboard search → result storage
2. **IntelligenceRecord Data Model** - Full TypeScript interface with all fields
3. **Evidence Object Design** - Minimal storage, maximum traceability
4. **Company Detection Strategy** - 6-stage hierarchy with confidence scoring
5. **Pattern Engine** - 6-stage validation architecture
6. **Deobfuscation Engine** - 24 methods categorized by tier
7. **Worker Output Migration** - Backward-compatible transformation
8. **Storage Strategy** - Redis estimates + long-term recommendations
9. **API Versioning** - v1 (unchanged) + v2 (new endpoints)
10. **Dashboard UI Impact** - New components, filters, exports
11. **Testing Plan** - Unit, integration, worker, performance tests
12. **Rollback Plan** - Safe recovery if needed

---

## KEY DATA MODEL

### IntelligenceRecord (New Output)

```typescript
{
  company: { name, confidence, detectionMethod },
  website: { url, pageTitle, pageDescription, ogTags, ... },
  discovery: { googlePosition, generatedQuery, keyword, location, pattern },
  emails: [{
    email,
    confidence,
    type,
    extractionMethod,
    obfuscationMethod,
    evidence: { section, selector, snippet, matchReason }
  }],
  phones?: [],     // Future
  addresses?: [],  // Future
  quality: { totalEmails, highConfidenceEmails, pageRelevance },
  processing: { extractedAt, processingTimeMs, workerId, status }
}
```

**Storage:** ~20 KB per job (vs 500 bytes current)  
**Cost:** Upstash Pro ~$100-200/month (vs $10 current)

---

## IMPLEMENTATION ENTRY POINTS

```
Dashboard Search Form
    ↓ (unchanged)
Search Service → generateQueries()
    ↓ NEW: Pass Google result position + snippet
Queue.addJob(url, 'google_pse', keyword, googleResult)
    ↓
Worker.processJob()
    ↓ NEW: Call extractIntelligence() instead of extractEmailsFromUrl()
Extraction Engine
    ├─ NEW: Detect company (schema.org → json-ld → og-tags → domain)
    ├─ NEW: Extract page metadata (title, description, h1)
    ├─ NEW: Apply 24+ deobfuscation methods
    ├─ NEW: Track evidence (WHERE found on page)
    └─ NEW: Return IntelligenceRecord
    ↓ NEW: queue.markCompleted(jobId, intelligenceRecord)
Result Storage
    ↓ NEW: /api/job/:id/result/v2 returns full intelligence
API v2 Endpoints
    ↓
Dashboard UI (new cards for company, evidence, quality)
```

---

## DEOBFUSCATION METHODS (24 TOTAL)

**TIER 1: Basic (9 existing)**
1. Direct regex | 2. [at]/[dot] | 3. HTML entities | 4. Base64 | 5. Mailto links | 6. Reversed strings | 7. ROT13 | 8. URL encoding | 9. JSON

**TIER 2: Intermediate (5 new)**
10. Decimal entities | 11. Hex entities | 12. Named entities | 13. Unicode | 14. String concat

**TIER 3: Advanced (4 new)**
15. HTML comments | 16. CSS hidden | 17. Data attributes | 18. Click handlers

**TIER 4: Framework-specific (4 new)**
19. React/Vue props | 20. Next.js hydration | 21. JS inline vars | 22. Shadow DOM

**TIER 5: Edge cases (2 optional)**
23. Cloudflare anti-bot | 24. Pixel fonts (OCR)

---

## PATTERN ENGINE (6 STAGES)

```
Stage 1: Google Query Generation    → "company contact site:pattern"
Stage 2: Google Result Analysis     → Check snippet for relevance
Stage 3: URL Pattern Validation     → /contact, /careers, /about
Stage 4: Metadata Validation        → Title/description/OG tags match
Stage 5: HTML Validation           → Content contains keyword
Stage 6: Extracted Data Validation  → Email domain matches, company matches
```

Each stage assigns confidence score. Fail any = reduce confidence or skip.

---

## COMPANY DETECTION (6-STAGE HIERARCHY)

```
Stage 1: Schema.org          → 98% confidence
Stage 2: JSON-LD            → 95% confidence
Stage 3: OpenGraph          → 90% confidence
Stage 4: Title tag          → 85% confidence
Stage 5: H1 tag             → 75% confidence
Stage 6: Domain parsing     → 65% confidence
```

---

## BACKWARD COMPATIBILITY

✅ **API v1 Unchanged**
- `/api/dashboard/search` - Same input/output
- `/api/job/:id/result` - Still returns { emails[], totalEmails }
- All existing endpoints work exactly as before

✅ **API v2 New (Opt-in)**
- `/api/job/:id/result/v2` - Returns full IntelligenceRecord
- `/api/dashboard/search/v2` - Same input, richer output

✅ **No Breaking Changes**
- Queue system unchanged
- Worker system unchanged
- Google PSE unchanged
- Dashboard search unchanged
- Redis schema extended (additive only)

---

## STORAGE IMPACT

```
Current: ~500 bytes per job → 1M jobs = 500 MB
Phase 2A: ~20 KB per job → 1M jobs = 20 GB

Cost: Upstash Pro ~$100-200/month (from ~$10)

Mitigation strategies (Phase 3+):
├─ Archive completed jobs to PostgreSQL
├─ Add caching layer
├─ Implement data expiration
└─ Offer tiered retention policies
```

---

## TESTING COVERAGE

✅ Unit tests (company detection, pattern validation, deobfuscation)  
✅ Integration tests (full extraction flow)  
✅ Worker tests (concurrency, timeouts, memory)  
✅ Performance tests (<20s per URL)  
✅ Compatibility tests (API v1 still works)  
✅ Rollback tests (safe reversion)

---

## ROLLBACK SAFETY

**Automatic triggers:** Worker crash rate >50%, memory >100GB, errors >50%, API v1 broken  

**Recovery time:** ~1 hour  

**Data loss:** ZERO (v1 format preserved, intelligence fields optional)  

**Unaffected:** Dashboard, search, queue, workers, Google PSE, auth

---

## WHAT'S NOT CHANGING

✅ Dashboard search form UI  
✅ Search functionality (same queries, same results)  
✅ Queue system (Redis, dedup, TTL)  
✅ Worker system (concurrency, timeouts, retry logic)  
✅ Google PSE integration  
✅ Authentication & rate limiting  
✅ Billing system

---

## FILES TO CREATE (Phase 2A Implementation)

```
lib/extraction/
├─ company-detector.ts           (NEW)
├─ pattern-validator.ts          (NEW)
├─ deobfuscate-extended.ts       (NEW - adds 15 methods)
├─ evidence-tracker.ts           (NEW)
├─ intelligence-record-builder.ts (NEW)
└─ engine.ts                      (MODIFY - add new return type)

lib/queue/
└─ types.ts                       (MODIFY - extend Job interface)

app/api/job/[id]/
├─ result/route.ts               (MODIFY - add v2 detection)
└─ result/v2/route.ts            (NEW)

app/dashboard/
└─ jobs/page.tsx                 (MODIFY - add new cards)

components/dashboard/
├─ CompanyCard.tsx               (NEW)
├─ EnhancedEmailCard.tsx         (NEW)
├─ MetadataCard.tsx              (NEW)
└─ QualityCard.tsx               (NEW)
```

---

## DECISION CHECKLIST FOR APPROVAL

**Before implementation, confirm:**

- [ ] IntelligenceRecord data model approved
- [ ] Evidence tracking approach approved
- [ ] Company detection 6-stage hierarchy approved
- [ ] Pattern engine 6-stage validation approved
- [ ] 24+ deobfuscation methods approved
- [ ] Storage cost increase acceptable (~$100/month)
- [ ] Backward compatibility strategy confirmed
- [ ] API versioning (v1 + v2) confirmed
- [ ] Rollback plan acceptable
- [ ] Timeline (3-4 weeks) feasible

---

## NEXT STEPS

1. Review PHASE_2A_TECHNICAL_SPECIFICATION.md (complete document)
2. Confirm data model and architecture
3. Answer decision checklist above
4. Authorize Phase 2A implementation
5. Implementation begins immediately upon approval

---

## DOCUMENT LOCATIONS

```
/vercel/share/v0-project/docs/

PHASE_2A_TECHNICAL_SPECIFICATION.md (Main - 1,831 lines)
PHASE_2A_SUMMARY.md (This file - Quick reference)
```

---

**Status:** ✅ SPECIFICATION COMPLETE - AWAITING IMPLEMENTATION APPROVAL
