# Phase 2 Quick Reference Guide

## What Changed

### Files Created
- `lib/search/query-generator.ts` - Query optimization engine

### Files Modified
- `lib/search/search-service.ts` - Added advanced search function
- `app/api/search/route.ts` - Added mode routing

### What Stayed the Same
- Google PSE integration
- URL filtering
- Queue system
- Worker pool
- Extraction engine

---

## API Usage

### Simple Mode (Original)
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "hedge funds manhattan",
    "pages": 2
  }'
```

### Advanced Mode (New)
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["hedge fund manager", "real estate agent"],
    "location": "Manhattan",
    "patterns": ["@company.com"],
    "searchDepth": 2,
    "delayMs": 300
  }'
```

---

## Key Features

✅ **Multi-keyword search** - 1-10 keywords per search  
✅ **Query optimization** - 3-4 variations per keyword  
✅ **Location context** - Geographic filtering  
✅ **Pattern injection** - Domain-specific queries  
✅ **Configurable delays** - 100-2000ms between keywords  
✅ **Error recovery** - Continues on partial failures  
✅ **Results grouping** - Jobs tracked by keyword  
✅ **Backward compatible** - 100% compatible with old API  

---

## Response Format

### Advanced Mode Response
```json
{
  "searchMode": "advanced",
  "totalQueued": 28,
  "keywordsProcessed": ["hedge fund manager", "real estate agent"],
  "jobsByKeyword": {
    "hedge fund manager": {
      "jobCount": 15,
      "jobIds": [...]
    },
    "real estate agent": {
      "jobCount": 13,
      "jobIds": [...]
    }
  }
}
```

---

## Validation Rules

| Field | Required | Range | Notes |
|-------|----------|-------|-------|
| keywords | ✓ (advanced) | 1-10 | Min 2 chars each |
| patterns | | 0-10 | Domain format (@domain.com) |
| location | | 0-100 chars | Optional |
| searchDepth | | 1-5 | Pages per keyword, default 1 |
| delayMs | | 100-2000 | Between keywords, default 200 |

---

## Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Validation failed | Invalid keywords, too many keywords |
| 403 | Quota exceeded | Google API quota exhausted |
| 500 | Server error | Config missing, unexpected error |
| 503 | Service unavailable | Rate limited by Google |

---

## Testing

```bash
# Check API is up
curl http://localhost:3000/api/search -X OPTIONS | jq .

# Test simple mode (needs auth)
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"query": "test", "pages": 1}'

# Test advanced mode (needs auth)
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"keywords": ["test"]}'
```

---

## Development

### Build & Test
```bash
npm run build    # Production build
npm run dev      # Dev server with hot reload
```

### Check TypeScript
```bash
npx tsc --noEmit
```

### View Changes
```bash
# See what was added/changed
git diff HEAD -- lib/search/search-service.ts
git diff HEAD -- app/api/search/route.ts
ls -la lib/search/query-generator.ts
```

---

## Next Steps (Phase 3)

- Page crawling and content extraction
- Company intelligence extraction
- Confidence scoring
- Evidence tracking
- Result persistence

---

## Support

For issues or questions:
1. Check PHASE_2_IMPLEMENTATION_COMPLETE.md for details
2. Review the inline code comments
3. Check TypeScript types for API structure
