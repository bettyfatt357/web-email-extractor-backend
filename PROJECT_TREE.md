# PROJECT_TREE.md - Complete Project Structure

## Directory Layout

```
/vercel/share/v0-project/
│
├── app/                                 # Next.js App Router
│   ├── api/                            # API endpoints
│   │   ├── admin/                      # Admin endpoints (NEW - Prompt 8)
│   │   │   ├── dashboard/
│   │   │   │   └── route.ts            # GET /api/admin/dashboard (read-only)
│   │   │   ├── jobs/
│   │   │   │   └── route.ts            # GET /api/admin/jobs (read-only)
│   │   │   ├── queue/
│   │   │   │   └── health/
│   │   │   │       └── route.ts        # GET /api/admin/queue/health (read-only)
│   │   │   └── users/
│   │   │       └── route.ts            # GET /api/admin/users (read-only)
│   │   │
│   │   ├── auth/                       # Authentication endpoints
│   │   │   └── me/
│   │   │       └── route.ts            # GET /api/auth/me - User info
│   │   │
│   │   ├── billing/                    # Billing endpoints
│   │   │   ├── status/
│   │   │   │   └── route.ts            # GET /api/billing/status - Billing info
│   │   │   └── webhook/
│   │   │       └── route.ts            # POST /api/billing/webhook - Stripe webhooks
│   │   │
│   │   ├── job/                        # Individual job endpoints
│   │   │   └── [id]/
│   │   │       ├── route.ts            # GET /api/job/:id - Job details
│   │   │       ├── status/
│   │   │       │   └── route.ts        # GET /api/job/:id/status - Job status
│   │   │       └── result/
│   │   │           └── route.ts        # GET /api/job/:id/result - Email results
│   │   │
│   │   ├── jobs/
│   │   │   └── route.ts                # GET /api/jobs - All jobs (debug)
│   │   │
│   │   ├── jobs-paginated/
│   │   │   └── route.ts                # GET /api/jobs-paginated - Paginated jobs
│   │   │
│   │   ├── metrics/
│   │   │   └── route.ts                # GET /api/metrics - Queue metrics
│   │   │
│   │   └── search/
│   │       └── route.ts                # POST /api/search - Start search
│   │
│   ├── admin/                          # Admin pages (NEW - Prompt 8)
│   │   ├── layout.tsx                  # Admin layout wrapper
│   │   ├── page.tsx                    # /admin - Dashboard
│   │   ├── jobs/
│   │   │   └── page.tsx                # /admin/jobs - Job management
│   │   ├── queue/
│   │   │   └── page.tsx                # /admin/queue - Queue monitoring
│   │   ├── users/
│   │   │   └── page.tsx                # /admin/users - User management
│   │   ├── workers/
│   │   │   └── page.tsx                # /admin/workers - Placeholder
│   │   ├── analytics/
│   │   │   └── page.tsx                # /admin/analytics - Placeholder
│   │   ├── security/
│   │   │   └── page.tsx                # /admin/security - Placeholder
│   │   └── settings/
│   │       └── page.tsx                # /admin/settings - Placeholder
│   │
│   ├── dashboard/                      # Customer dashboard (NEW - Prompt 3)
│   │   ├── layout.tsx                  # Dashboard layout wrapper
│   │   ├── page.tsx                    # /dashboard - Home/Overview
│   │   ├── search/
│   │   │   └── page.tsx                # /dashboard/search - New search
│   │   ├── jobs/
│   │   │   └── page.tsx                # /dashboard/jobs - Job management
│   │   ├── api-keys/
│   │   │   └── page.tsx                # /dashboard/api-keys - API key management
│   │   ├── usage/
│   │   │   └── page.tsx                # /dashboard/usage - Usage analytics
│   │   ├── billing/
│   │   │   └── page.tsx                # /dashboard/billing - Billing management
│   │   ├── profile/
│   │   │   └── page.tsx                # /dashboard/profile - User profile
│   │   └── settings/
│   │       └── page.tsx                # /dashboard/settings - Settings
│   │
│   ├── layout.tsx                      # Root layout
│   ├── page.tsx                        # Home page (/)
│   └── globals.css                     # Global styles
│
├── components/                         # React components
│   ├── admin/                          # Admin UI components
│   │   └── sidebar.tsx                 # Admin sidebar navigation
│   │
│   └── ui/                             # UI component library
│       ├── button.tsx                  # Button component
│       └── card.tsx                    # Card component
│
├── hooks/                              # Custom React hooks
│   ├── useMetrics.ts                   # Dashboard metrics hook (with auto-refresh)
│   └── useUsage.ts                     # Usage data hook (with auto-refresh)
│
├── lib/                                # Backend logic
│   ├── auth/                           # Authentication & Authorization
│   │   ├── middleware.ts               # withAuth middleware (API key validation)
│   │   ├── admin-auth.ts               # withAdminAuth middleware (admin role check)
│   │   ├── rate-limit.ts               # withRateLimit middleware (hourly quotas)
│   │   ├── billing.ts                  # withBilling middleware (monthly quotas)
│   │   ├── usage-tracking.ts           # Usage event logging
│   │   ├── README.md                   # Auth system documentation
│   │   └── SCHEMA.md                   # Database schema
│   │
│   ├── billing/                        # Billing system
│   │   └── stripe.ts                   # Stripe integration
│   │
│   ├── config/                         # Configuration
│   │   └── google.ts                   # Google PSE config
│   │
│   ├── extraction/                     # Email extraction engine
│   │   ├── engine.ts                   # Main extraction orchestrator
│   │   ├── deobfuscate.ts              # Email deobfuscation (10+ patterns)
│   │   └── [other extractors]
│   │
│   ├── queue/                          # Job queue system
│   │   ├── queue.ts                    # Main queue operations (Redis)
│   │   └── queue-rest.ts               # Queue REST client
│   │
│   └── [other utility modules]
│
├── scripts/                            # Utility scripts
│   └── [test and utility scripts]
│
├── public/                             # Static assets
│   └── [images, fonts, etc.]
│
├── Documentation Files (Root)
│   ├── ARCHITECTURE.md                 # System architecture (this set)
│   ├── SYSTEM_DESIGN.md                # Detailed design patterns
│   ├── PROJECT_TREE.md                 # This file
│   ├── API_REFERENCE.md                # API documentation
│   │
│   ├── AUTH_BILLING_INTEGRATION.md     # Auth & billing docs (Prompt 2)
│   ├── DASHBOARD_QUICK_START.md        # Dashboard docs (Prompt 3)
│   ├── ADMIN_PLATFORM_SUMMARY.md       # Admin platform docs (Prompt 8)
│   ├── FINAL_VERIFICATION_REPORT.md    # Final verification (Prompt 9)
│   │
│   └── [other documentation files from previous prompts]
│
├── package.json                        # NPM dependencies
├── tsconfig.json                       # TypeScript configuration
├── next.config.mjs                     # Next.js configuration
├── tailwind.config.ts                  # Tailwind CSS configuration
├── postcss.config.mjs                  # PostCSS configuration
└── components.json                     # shadcn/ui configuration
```

---

## File Statistics

### By Category

**API Endpoints: 15 files**
- Customer endpoints: 11
- Admin endpoints: 4

**Frontend Pages: 17 files**
- Customer dashboard: 8
- Admin pages: 9

**Components: 3 files**
- UI components: 2
- Admin components: 1

**Hooks: 2 files**
- Data fetching hooks: 2

**Backend Logic: 10+ files**
- Auth: 5
- Billing: 1
- Extraction: 2
- Queue: 2
- Config: 1

**Documentation: 25+ files**
- Architecture: 4 (this set)
- Implementation guides: 20+

---

## Module Dependencies

### API Layer Dependencies

```
POST /api/search
  ├─ withAuth (lib/auth/middleware.ts)
  ├─ withRateLimit (lib/auth/rate-limit.ts)
  ├─ withBilling (lib/auth/billing.ts)
  ├─ lib/search/googlePseDiscovery.ts
  ├─ lib/queue/queue.ts
  └─ lib/auth/usage-tracking.ts

GET /api/metrics
  ├─ withAuth
  └─ lib/queue/queue.ts

GET /api/admin/dashboard
  ├─ withAuth
  ├─ withAdminAuth (lib/auth/admin-auth.ts)
  └─ lib/queue/queue.ts (read-only)
```

### Frontend Dependencies

```
/dashboard/** (Customer Dashboard)
  ├─ hooks/useMetrics.ts
  ├─ hooks/useUsage.ts
  ├─ components/ui/card.tsx
  └─ /api/metrics, /api/jobs-paginated, etc.

/admin/** (Admin Pages)
  ├─ components/admin/sidebar.tsx
  ├─ /api/admin/dashboard
  ├─ /api/admin/jobs
  ├─ /api/admin/queue/health
  └─ /api/admin/users
```

---

## Data Flow Between Modules

### Search Initiation

```
Customer Request
  ↓ POST /api/search
  ├─ Authentication (withAuth)
  ├─ Rate Limiting (withRateLimit)
  ├─ Billing Check (withBilling)
  ├─ Google PSE Discovery (lib/search/)
  ├─ Job Queue Creation (lib/queue/queue.ts)
  └─ Usage Tracking (lib/auth/usage-tracking.ts)
  ↓
Response with Job IDs
```

### Job Processing

```
Worker Loop (lib/worker/worker.ts)
  ↓ Every 1 second
  ├─ Get Next Job (lib/queue/queue.ts)
  ├─ Claim with SETNX lock
  ├─ Extract Emails (lib/extraction/engine.ts)
  ├─ Deobfuscate (lib/extraction/deobfuscate.ts)
  ├─ Mark Completed (lib/queue/queue.ts)
  └─ Release lock
  
Watchdog (lib/worker/watchdog.ts)
  ↓ Every 10 seconds
  ├─ Find Stuck Jobs (lib/queue/queue.ts)
  ├─ Recover or Fail (lib/queue/queue.ts)
  └─ Log Actions
```

### Admin Monitoring

```
Admin Request
  ↓ GET /api/admin/dashboard
  ├─ Authentication (withAuth)
  ├─ Authorization (withAdminAuth)
  ├─ Read Queue Stats (lib/queue/queue.ts)
  └─ Calculate Metrics
  ↓
Response with System Metrics
```

---

## File Sizes Summary

| Category | Files | LOC | Purpose |
|----------|-------|-----|---------|
| API Endpoints | 15 | ~1,500 | Request handling |
| Pages | 17 | ~2,500 | UI rendering |
| Middleware | 5 | ~600 | Auth, rate limiting, billing |
| Extraction | 2+ | ~800 | Email extraction |
| Queue | 2+ | ~500 | Job management |
| Hooks | 2 | ~100 | Data fetching |
| Components | 3 | ~200 | UI building blocks |
| Docs | 25+ | ~10,000 | Documentation |

---

## Key Design Choices Reflected in Structure

1. **Separation of Concerns**
   - `lib/auth/` - All authentication
   - `lib/queue/` - All queue operations
   - `lib/extraction/` - All extraction logic

2. **Middleware Composition**
   - Each middleware is independent file
   - Stacked in order (auth → rate limit → billing)
   - Admin auth is separate module

3. **Read-Write Separation**
   - Admin endpoints in `/admin/` with "read-only"
   - Customer endpoints unrestricted

4. **Dashboard vs Admin Separation**
   - `/dashboard/` for customers
   - `/admin/` for administrators
   - Different middleware, different access levels

5. **Modular Extraction**
   - engine.ts orchestrates
   - deobfuscate.ts handles patterns
   - Multiple extractors can exist

---

## Adding New Features

### Adding a New Customer API Endpoint

1. Create file: `app/api/new-feature/route.ts`
2. Wrap with middleware: `withAuth(withRateLimit(withBilling(handler)))`
3. Call `trackUsageEvent()` on success
4. Document in API_REFERENCE.md

### Adding an Admin Dashboard Page

1. Create file: `app/admin/new-section/page.tsx`
2. Call `GET /api/admin/*` endpoint
3. Add to sidebar: `components/admin/sidebar.tsx`
4. Import admin auth from: `lib/auth/admin-auth.ts`

### Adding Customer Dashboard Feature

1. Create hook in: `hooks/useNewFeature.ts`
2. Create page: `app/dashboard/new-feature/page.tsx`
3. Use hook for data fetching
4. Add to layout sidebar

### Adding New Auth Logic

1. Create middleware in: `lib/auth/new-middleware.ts`
2. Export as: `withNewAuth`
3. Use in endpoints: `withAuth(withNewAuth(handler))`
4. Document middleware order

---

## Testing File Organization

Tests should follow the structure:

```
__tests__/
├── api/
│   ├── admin/
│   ├── auth/
│   ├── billing/
│   └── [others]
├── lib/
│   ├── auth/
│   ├── queue/
│   ├── extraction/
│   └── [others]
└── hooks/
    └── [hook tests]
```

