# Phase 2 Implementation Plan: Public Marketing Website

**Date**: July 16, 2026  
**Status**: Awaiting Approval  
**Scope**: Landing page only - NO authentication changes, NO dashboard changes, NO backend changes

---

## CRITICAL CONSTRAINTS

**DO NOT MODIFY**:
- ❌ Authentication system
- ❌ Dashboard functionality
- ❌ Admin dashboard
- ❌ Backend APIs
- ❌ Redis queue
- ❌ Extraction engine
- ❌ Worker processes
- ❌ Google PSE integration

**ONLY IMPLEMENT**:
- ✅ Landing page UI
- ✅ Public marketing content
- ✅ Navigation structure
- ✅ Auth buttons (navigation only, no functionality yet)

---

## PART 1: CURRENT PROJECT DIAGNOSIS

### Existing Project Structure

**Root-level layout**:
```
app/
  ├─ page.tsx (placeholder - WILL BE REPLACED)
  ├─ layout.tsx (root layout - will be minimally updated)
  ├─ globals.css (existing styles - preserved)
  ├─ dashboard/ (existing - UNTOUCHED)
  │  ├─ layout.tsx (dashboard layout)
  │  ├─ page.tsx (dashboard home)
  │  ├─ search/page.tsx (search page)
  │  ├─ jobs/page.tsx (jobs page)
  │  ├─ api-keys/page.tsx (API keys)
  │  ├─ usage/page.tsx (usage stats)
  │  ├─ billing/page.tsx (billing)
  │  ├─ settings/page.tsx (settings)
  │  └─ profile/page.tsx (profile)
  ├─ admin/ (existing - UNTOUCHED)
  │  ├─ layout.tsx (admin layout)
  │  ├─ page.tsx (admin dashboard)
  │  ├─ analytics/page.tsx
  │  ├─ jobs/page.tsx
  │  ├─ queue/page.tsx
  │  ├─ workers/page.tsx
  │  ├─ users/page.tsx
  │  └─ settings/page.tsx
  └─ api/ (existing - UNTOUCHED)
     ├─ search/route.ts (search endpoint)
     ├─ job/[id]/route.ts (job status)
     ├─ admin/ (admin endpoints)
     ├─ auth/ (auth endpoints)
     ├─ billing/ (billing endpoints)
     └─ health/ (health checks)

components/
  ├─ ui/ (existing shadcn components)
  │  ├─ button.tsx (exists - modern, has variants)
  │  └─ card.tsx (exists - shadcn card)
  └─ admin/ (existing)
     └─ sidebar.tsx (admin sidebar)

public/
  └─ (placeholder images exist)

lib/
  ├─ auth/ (existing - UNTOUCHED)
  ├─ search/ (existing - UNTOUCHED)
  ├─ extraction/ (existing - UNTOUCHED)
  ├─ queue/ (existing - UNTOUCHED)
  ├─ worker/ (existing - UNTOUCHED)
  └─ supabase/ (Phase 1 - UNTOUCHED)
```

### Current app/page.tsx

**Current state**: Placeholder with centered icon and "Your v0 generation will show here" message
**File size**: ~895 bytes
**Content**: Static placeholder (no imports, no logic)
**Action**: Will be completely replaced

### Current app/layout.tsx

**Current state**: Root layout with Vercel Analytics
**Metadata**: "v0 App" (will be updated to "Nastech Discovery Intelligence")
**Viewport**: Light/dark color scheme support
**Action**: Minimal update (metadata, title, description)

### Existing UI Components

**Available**:
- ✅ Button component (shadcn, multiple variants: default, outline, secondary, ghost, destructive, link)
- ✅ Card component (shadcn)
- ✅ Lucide Icons (all available)
- ✅ TailwindCSS v4 (with theme variables)
- ✅ Dark mode support (CSS variables)

### Existing Styling System

**TailwindCSS v4 with CSS variables**:
```css
--background: oklch(1 0 0)
--foreground: oklch(0 0 0)
--primary: oklch(...)
--secondary: oklch(...)
--accent: oklch(...)
--muted: oklch(...)
--border: oklch(...)
--ring: oklch(...)
```

**Available classes**:
- Color: `bg-primary`, `text-foreground`, `border-border`, etc.
- Layout: Flexbox, Grid, Responsive prefixes (sm:, md:, lg:, xl:)
- Spacing: Standard Tailwind scale
- Typography: `text-sm`, `text-lg`, `font-bold`, `font-medium`

---

## PART 2: ROUTING PLAN

### Current Routing

```
/ → app/page.tsx (placeholder - WILL CHANGE)
/dashboard → app/dashboard/layout.tsx + page.tsx
/admin → app/admin/layout.tsx + page.tsx
/api/* → API routes (unchanged)
```

### New Routing After Phase 2

```
/ → app/page.tsx (LANDING PAGE)
/dashboard → app/dashboard/layout.tsx + page.tsx (unchanged)
/admin → app/admin/layout.tsx + page.tsx (unchanged)
/api/* → API routes (unchanged)
```

### Routing Logic

**Landing page at root**:
- Accessible at `/`
- No authentication required
- Public, discoverable
- Entry point for new users

**Public marketing site**:
- No subroutes (all on single page)
- Navigation buttons to:
  - `/api/auth/login` (will exist in Phase 3)
  - `/api/auth/register` (will exist in Phase 3)
  - `/dashboard` (existing)

**Preserved routing**:
- `/dashboard/*` - Existing dashboard (untouched)
- `/admin/*` - Existing admin dashboard (untouched)
- `/api/*` - All API endpoints (untouched)

---

## PART 3: COMPONENT ARCHITECTURE

### New Components to Create

All components will be in `components/landing/` directory:

#### 1. **components/landing/navbar.tsx** (60-80 lines)
```typescript
Features:
- Logo/brand name on left
- Navigation links: Home, Features, How It Works, Pricing, About
- Right side: Login button, Get Started button
- Responsive: hamburger menu on mobile
- Sticky on scroll (optional)
- Dark mode aware
```

#### 2. **components/landing/hero.tsx** (80-120 lines)
```typescript
Features:
- Large headline: "Discover Business Intelligence at Scale"
- Subheadline: descriptive text
- Two CTA buttons: "Start Discovering", "View Demo"
- Hero illustration (modern dashboard mockup - generated or imported)
- Responsive layout
- Gradient or subtle background
```

#### 3. **components/landing/features.tsx** (100-150 lines)
```typescript
Features:
- 4-6 feature cards in grid
- Each card shows:
  - Icon (from Lucide)
  - Title
  - Description
  - Example or visual indicator
- Cards: Business Discovery, Contact Intelligence, Advanced Search, Job Tracking, Search History, Enterprise Scale
```

#### 4. **components/landing/how-it-works.tsx** (80-120 lines)
```typescript
Features:
- 3-step process visualization
- Step 1: Input (keywords, location, email pattern)
- Step 2: Discovery Engine (Google Search, filtering, queue)
- Step 3: Results (emails, phones, companies, export)
- Arrows/flow between steps
- Icons for each step
```

#### 5. **components/landing/screenshot-section.tsx** (60-100 lines)
```typescript
Features:
- Realistic dashboard preview mockup
- Shows: Searches, Jobs, Companies, Emails, Completion Rate
- Responsive (scales down on mobile)
- Styled to match actual dashboard
- Generated or imported image
```

#### 6. **components/landing/why-nastech.tsx** (80-120 lines)
```typescript
Features:
- Benefits list:
  - AI-powered discovery
  - High-speed processing
  - Real-time extraction
  - Background workers
- Use cases:
  - Built for agencies
  - Built for recruiters
  - Built for sales teams
  - Built for researchers
- Icons for each benefit
- Cards or list layout
```

#### 7. **components/landing/pricing.tsx** (120-160 lines)
```typescript
Features:
- 3 pricing tiers: Free, Professional, Enterprise
- Cards showing:
  - Plan name
  - Price (placeholder: TBD)
  - Features list (checkmarks)
  - CTA button
- Comparison of features across tiers
- Toggle for monthly/annual (optional)
```

#### 8. **components/landing/footer.tsx** (60-80 lines)
```typescript
Features:
- Logo/brand
- Navigation links
- Legal links: Privacy, Terms, Contact
- Social links (optional)
- Copyright
- Responsive grid layout
```

### File Modification Plan

#### 1. **app/page.tsx** (REPLACED - 300-400 lines)
**Current**: 30 lines (placeholder)
**New**: Landing page with all components
```typescript
Structure:
- Import all landing components
- Single layout with sections
- Navbar, Hero, Features, How It Works, Screenshot, Why Nastech, Pricing, Footer
- No imports from dashboard or admin
- No authentication logic
```

#### 2. **app/layout.tsx** (MINIMALLY UPDATED - +5 lines)
**Current**: 40 lines
**New**: Update metadata only
```typescript
Changes:
- title: "Nastech Discovery Intelligence"
- description: "AI-powered Business Discovery & Contact Intelligence Platform"
- metadata.openGraph (optional)
- NO changes to structure, children, or Analytics
```

#### 3. **components/landing/** (NEW - 8 new files)
```
Created:
- navbar.tsx (80 lines)
- hero.tsx (120 lines)
- features.tsx (150 lines)
- how-it-works.tsx (120 lines)
- screenshot-section.tsx (100 lines)
- why-nastech.tsx (120 lines)
- pricing.tsx (160 lines)
- footer.tsx (80 lines)

Total new: ~1,030 lines of component code
```

### NO Changes to Existing Components

**Preserved**:
- ✅ `components/ui/button.tsx` (used, not modified)
- ✅ `components/ui/card.tsx` (used, not modified)
- ✅ `components/admin/sidebar.tsx` (untouched)
- ✅ All existing components (untouched)

---

## PART 4: DESIGN SPECIFICATIONS

### Color System (3-5 colors)

**Primary Colors**:
- Primary: #0F172A (dark navy for brand, buttons)
- Accent: #3B82F6 (bright blue for highlights)
- Background: #FFFFFF / #0F172A (light/dark mode)
- Foreground: #000000 / #FFFFFF
- Border: #E5E7EB / #1F2937

**Neutral Palette**:
- Used for cards, sections, text
- Light mode: grays from white to #374151
- Dark mode: grays from #111827 to white

### Typography

**Fonts** (Already in system):
- Headings: Inter / system font (bold, 2xl-4xl)
- Body: Inter / system font (regular, sm-lg)
- Code: Monospace (if needed)

**Scale**:
- Hero headline: 3xl-4xl, bold
- Section titles: 2xl, bold
- Card titles: lg, medium
- Body text: sm-base, regular
- Labels: xs-sm, medium

### Layout

**Mobile-first responsive**:
- Mobile: Single column, full width
- Tablet (md): 2 columns where appropriate
- Desktop (lg): 3-4 columns

**Spacing**:
- Sections: py-12 to py-16 (48-64px)
- Cards: gap-4 to gap-6 (16-24px)
- Inside cards: p-6 to p-8 (24-32px)

**Max width**:
- Container max-w-7xl (container class)
- Full width on mobile
- Centered on desktop

### Dark Mode

**Implementation**:
- CSS variables already support dark mode
- Use `dark:` prefixes in Tailwind
- No JavaScript needed (CSS-based via `prefers-color-scheme`)

---

## PART 5: FILES THAT WILL NOT CHANGE

### Completely Untouched

**Dashboard System** (100% preserved):
- ✅ `/app/dashboard/*` (all pages)
- ✅ `/app/dashboard/layout.tsx`
- ✅ All dashboard components

**Admin System** (100% preserved):
- ✅ `/app/admin/*` (all pages)
- ✅ `/app/admin/layout.tsx`
- ✅ `/components/admin/sidebar.tsx`

**API Layer** (100% preserved):
- ✅ `/app/api/search/route.ts`
- ✅ `/app/api/job/*/route.ts`
- ✅ `/app/api/admin/*`
- ✅ All other API routes

**Backend Logic** (100% preserved):
- ✅ `/lib/search/*` (search logic)
- ✅ `/lib/extraction/*` (extraction engine)
- ✅ `/lib/worker/*` (worker processes)
- ✅ `/lib/queue/*` (queue management)
- ✅ `/lib/auth/*` (authentication)
- ✅ `/lib/supabase/*` (Supabase integration)

**Infrastructure** (100% preserved):
- ✅ Redis queue
- ✅ Google PSE integration
- ✅ Worker processes
- ✅ Extraction engine
- ✅ All backend APIs

---

## PART 6: RISK ANALYSIS

### Why These Changes Are Safe

#### 1. **Routing Safety**
```
Current:
  / → placeholder page (unused)
  
New:
  / → landing page (public marketing)
  
Risk: ZERO
- Root route was placeholder anyway
- All other routes (/, /dashboard, /admin, /api) untouched
- No redirect changes
```

#### 2. **API Safety**
```
Landing page ← (NO API CALLS from landing)
  └─ Static content only
  └─ No API integrations
  └─ No authentication logic
  
Risk: ZERO
- No new API endpoints
- No API calls from landing page
- All backend completely isolated
```

#### 3. **Dashboard Safety**
```
Landing page (/) → Separate from (/dashboard)
  └─ Dashboard untouched
  └─ Dashboard layout untouched
  └─ Dashboard components untouched
  
Risk: ZERO
- Dashboard in completely separate route
- No shared state with landing
- No imports from landing to dashboard
```

#### 4. **Authentication Safety**
```
Current auth system (lib/auth/*):
  - Untouched
  - No changes to middleware
  - No changes to validation
  - No changes to credentials
  
Landing page:
  - No authentication logic
  - Only navigation buttons
  - Buttons point to /dashboard (Phase 3)
  
Risk: ZERO
- No auth changes
- Landing page is static/public
- Auth flow preserved
```

#### 5. **Queue/Redis Safety**
```
Landing page:
  └─ ZERO dependencies on Redis
  └─ ZERO queue calls
  └─ ZERO worker interactions
  
Risk: ZERO
- Landing page is completely static
- No background jobs
- No async operations
```

#### 6. **Extraction Engine Safety**
```
Landing page:
  └─ ZERO imports from extraction
  └─ ZERO calls to extraction
  └─ ZERO modified extraction code
  
Risk: ZERO
- Extraction engine untouched
- No dependencies between landing and extraction
```

#### 7. **Google PSE Safety**
```
Landing page:
  └─ ZERO dependency on Google PSE
  └─ ZERO API calls to Google
  └─ ZERO modified search logic
  
Risk: ZERO
- Search page (dashboard) untouched
- API endpoints untouched
- Google integration untouched
```

#### 8. **Admin Dashboard Safety**
```
Landing page:
  └─ ZERO access to /admin
  └─ ZERO admin components
  └─ ZERO admin logic
  
Risk: ZERO
- Admin routes completely separate
- Admin layout untouched
- Admin components untouched
```

#### 9. **Existing Component Safety**
```
Used components:
  - Button (existing, not modified)
  - Card (existing, not modified)
  - Lucide icons (library, not modified)
  
Landing components:
  - All new files in components/landing/
  - No conflicts with existing
  - No modifications to components/ui/
  
Risk: ZERO
- No component modifications
- Clean separation in landing/ directory
```

#### 10. **CSS/Styling Safety**
```
globals.css:
  └─ UNTOUCHED
  └─ New components use same variables
  └─ No new CSS files (Tailwind only)
  
Risk: ZERO
- Existing styles preserved
- Only Tailwind utility classes used
- No CSS conflicts possible
```

---

## PART 7: BUILD & DEPLOYMENT SAFETY

### npm run build
```
Expected behavior:
  - Compiles all new components
  - TypeScript validates landing page
  - No changes to backend compilation
  - Build succeeds (same as before)
  
Risk: ZERO
- New components are pure React
- No complex logic
- TypeScript-safe
```

### TypeScript Checking
```
Landing components:
  - Fully typed with React.ReactNode, JSX.Element
  - Props interfaces for each component
  - No `any` types
  - No type errors
  
Risk: ZERO
- Clean TypeScript implementation
```

### Production Deployment
```
Changes are:
  - Static React components
  - Zero database queries
  - Zero environment dependencies
  - Zero infrastructure changes
  
Risk: ZERO
- Safe to deploy immediately
- No migrations needed
- No configuration changes
```

---

## PART 8: IMPLEMENTATION CHECKLIST

### Phase 2a: Landing Page Components

```
[ ] Create components/landing/navbar.tsx
[ ] Create components/landing/hero.tsx
[ ] Create components/landing/features.tsx
[ ] Create components/landing/how-it-works.tsx
[ ] Create components/landing/screenshot-section.tsx
[ ] Create components/landing/why-nastech.tsx
[ ] Create components/landing/pricing.tsx
[ ] Create components/landing/footer.tsx
```

### Phase 2b: Landing Page Layout

```
[ ] Replace app/page.tsx with landing page
[ ] Update app/layout.tsx metadata
[ ] Test responsive design (mobile, tablet, desktop)
[ ] Test dark mode
[ ] Verify all links work
[ ] Test build: npm run build
[ ] Test TypeScript: npx tsc --noEmit
```

### Phase 2c: Verification

```
[ ] npm run build succeeds
[ ] TypeScript reports zero errors
[ ] Existing search endpoints still work
[ ] Redis queue still works
[ ] Workers still function
[ ] Admin dashboard still accessible
[ ] Dashboard still accessible
[ ] No API changes
[ ] All existing functionality preserved
```

---

## PART 9: WHAT THIS PLAN INCLUDES

### Full Landing Page with Sections

1. **Navigation** (sticky, responsive)
2. **Hero** (headline, subheadline, CTAs)
3. **Features** (6 feature cards)
4. **How It Works** (3-step process)
5. **Screenshot** (dashboard preview)
6. **Why Nastech** (benefits + use cases)
7. **Pricing** (3 tiers)
8. **Footer** (links, copyright)

### Professional Design

- Clean, minimal aesthetic (Linear, Vercel style)
- Modern color scheme (professional navy + bright accent)
- Smooth animations (Framer Motion - subtle)
- Fully responsive (mobile-first)
- Dark mode support
- Accessibility (ARIA labels, semantic HTML)
- Fast performance (no external requests, static)

### Production-Ready Code

- TypeScript throughout
- Reusable components
- Clean separation of concerns
- No technical debt
- Zero console warnings
- Proper error handling
- SEO metadata

---

## APPROVAL GATES

This plan is ready for approval if you confirm:

- [ ] Landing page replaces only `/app/page.tsx` and updates `app/layout.tsx` metadata
- [ ] All new components are in `components/landing/`
- [ ] No changes to dashboard, admin, or APIs
- [ ] No changes to authentication, queue, or extraction
- [ ] Design matches modern SaaS aesthetic (Linear, Vercel, etc.)
- [ ] Landing page is fully public (no auth required)
- [ ] Navigation buttons are placeholders (auth UI comes in Phase 3)
- [ ] All sections included: nav, hero, features, how-it-works, pricing, footer

---

## NEXT STEPS

### Upon Approval

1. Generate design inspiration (design briefing)
2. Implement all landing components
3. Replace app/page.tsx with landing layout
4. Update app/layout.tsx metadata
5. Run verification suite:
   - `npm run build`
   - `npx tsc --noEmit`
   - Manual testing of existing systems
6. Deploy landing page
7. Proceed to Phase 3 (Authentication)

### Estimated Implementation Time

- Design: 1-2 hours
- Components: 3-4 hours
- Testing: 1 hour
- **Total: 5-7 hours**

---

**STATUS**: AWAITING APPROVAL

Please review and confirm all approval gates above before implementing.

