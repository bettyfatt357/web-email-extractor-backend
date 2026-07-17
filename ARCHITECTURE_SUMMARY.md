# Data Architecture Summary

**Three Independent Storage Layers**

## PostgreSQL (Supabase) - NEW
- User accounts & sessions
- Search history
- User preferences
- Saved results/bookmarks
- API keys (Phase 6)
- Audit logs

## Redis (Upstash) - UNCHANGED
- Job queue (Bull)
- Rate limiting counters
- Worker state/locks
- Temporary results (TTL 24h)

## Memory (Runtime) - UNCHANGED
- HTML/DOM during page processing
- Email extraction during extraction
- Pattern matches during analysis
- Temporary calculations per request

---

## Data Distribution

**PostgreSQL**: ~6 tables, grows with users & searches, persistent
**Redis**: ~1000s of keys, bounded size, ephemeral with TTL
**Memory**: Per-request allocations, discarded after processing

---

## Impact Assessment

| System | Status | Files Changed |
|--------|--------|---------------|
| PostgreSQL | NEW | 1 client file |
| Redis | UNCHANGED | 0 files |
| Memory | UNCHANGED | 0 files |
| Google Search API | UNCHANGED | 0 files |
| Workers | UNCHANGED | 0 files |
| Extraction | UNCHANGED | 0 files |
| Queue | UNCHANGED | 0 files |
| Billing/Stripe | UNCHANGED | 0 files |

**Total new files**: 17 (auth pages, dashboard, etc)
**Total modified files**: 7 (layout, page, middleware)
**Total deleted files**: 0

---

## Future Growth Support

✓ Multi-user accounts (user_id on all tables)
✓ Teams (can add team_id column)
✓ Organizations (same pattern as teams)
✓ Billing (subscriptions table ready)
✓ Search history (core feature)
✓ Saved projects (parent-child relationship)
✓ API usage analytics (audit_logs table)
✓ Analytics dashboard (aggregate queries on existing data)

---

## Confirmed: Zero Disruption

- ✓ Google Search API untouched
- ✓ Redis queue untouched
- ✓ Worker processes untouched
- ✓ Extraction engine untouched
- ✓ All existing APIs work as-is
- ✓ Backward compatible 100%

---

## Next Step: Approval

Approve this architecture to proceed with Phase 1 (Supabase setup).
