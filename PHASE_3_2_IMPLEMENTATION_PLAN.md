# Phase 3.2-3.5: Authentication UI & Navbar Implementation Plan

**Status**: AWAITING APPROVAL  
**Date**: July 16, 2026  
**Scope**: Complete authentication UI implementation

---

## CURRENT STATE VERIFICATION

### Already Exists (Phase 3.1 - Complete)

**Auth Utilities**:
- ✅ `lib/supabase/auth.ts` - Client-side auth wrapper
- ✅ `lib/supabase/client.ts` - Browser Supabase client
- ✅ `lib/supabase/server.ts` - Server-side Supabase client + session functions
- ✅ `hooks/use-auth.ts` - React auth hook
- ✅ `lib/supabase/utils.ts` - Auth utilities
- ✅ `middleware.ts` - Route protection + session refresh
- ✅ `@supabase/ssr` - Dependency installed

**Current Routes**:
- ✅ `/` - Landing page (app/page.tsx)
- ✅ `/dashboard` - Dashboard home (app/dashboard/page.tsx)
- ✅ `/dashboard/search` - Search page
- ✅ `/dashboard/jobs` - Jobs page
- ✅ `/dashboard/api-keys` - API keys page
- ✅ `/dashboard/billing` - Billing page
- ✅ `/dashboard/settings` - Settings page
- ✅ `/dashboard/profile` - Profile page
- ✅ `/dashboard/usage` - Usage page
- ✅ `/admin/*` - Admin portal (PROTECTED - DO NOT MODIFY)

**Current Components**:
- ✅ `components/ui/button.tsx` - Button component
- ✅ `components/ui/card.tsx` - Card component
- ✅ `components/landing/navbar.tsx` - Navbar (needs modification)
- ✅ `components/landing/*` - Other landing page sections

**Design System**:
- ✅ Tailwind CSS v4 with shadcn/ui
- ✅ OKLCH color tokens in `app/globals.css`
- ✅ Light/dark mode support
- ✅ Responsive design ready

---

## IMPLEMENTATION PHASES

### Phase 3.2: Create Auth Components (2-3 hours)

**Purpose**: Build reusable components used across all auth pages

**Files to Create** (7 components):

#### 1. `components/auth/AuthCard.tsx`
- Card wrapper for auth pages
- Props: `title`, `subtitle`, `children`, `footer`
- Centered layout with max-width 450px
- Responsive padding
- Handles dark/light mode

#### 2. `components/auth/AuthInput.tsx`
- Text input with label, validation, error display
- Props: `type`, `label`, `placeholder`, `error`, `disabled`, `value`, `onChange`, `required`, `autoComplete`
- Show/hide toggle for password fields
- Error message display below
- Accessible with `aria-describedby` for errors
- Dark mode compatible

#### 3. `components/auth/AuthButton.tsx`
- Primary button with loading state
- Props: `loading`, `children`, `disabled`, `className`, `type`
- Shows spinner while loading
- Disabled state while processing
- Full width by default
- Dark mode compatible

#### 4. `components/auth/ErrorAlert.tsx`
- Dismissible error message
- Props: `message`, `onDismiss`
- Auto-dismisses after 5 seconds
- Destructive red color
- Alert icon (lucide)
- Fade out animation

#### 5. `components/auth/LoadingSpinner.tsx`
- Centered loading indicator
- Props: `text`, `size`
- Used on loading states
- Spinner animation
- Optional text below spinner

#### 6. `components/auth/AuthDivider.tsx`
- "Or" divider between form sections
- Props: `text` (default: "Or")
- Gray text with lines on sides
- Responsive padding

#### 7. `components/auth/SocialLoginButton.tsx`
- Google login button (placeholder for now)
- Props: `provider`, `onClick`
- Full width
- Outline style
- Icon + text
- Disabled state support

**Build Requirements**:
- `npm run build` succeeds
- `npx tsc --noEmit` passes

---

### Phase 3.3: Create Public Auth Routes (4-5 hours)

**Purpose**: Auth pages for registration, login, password recovery

**Files to Create** (5 pages + 1 layout):

#### 1. `app/(auth)/layout.tsx`
- Wrapper for all public auth pages
- Centered card layout
- Navbar with back-to-home link
- Theme toggle
- Footer with branding
- No dashboard sidebar
- Different styling from dashboard

#### 2. `app/(auth)/login/page.tsx` (~150 lines)
**Features**:
- Email input + validation
- Password input + show/hide toggle
- "Remember me" checkbox (optional)
- "Forgot password?" link → `/forgot-password`
- "Don't have account?" link → `/register`
- Login button + loading state
- Error display
- Google login placeholder button
- Auto-redirect if already logged in

**Form Validation**:
- Email format validation
- Password required
- Show errors on blur or submit

**UX**:
- Loading spinner on button
- Disabled inputs while submitting
- Focus management
- Keyboard Enter to submit
- Responsive for mobile/tablet/desktop

#### 3. `app/(auth)/register/page.tsx` (~180 lines)
**Features**:
- Email input + validation
- Password input + strength indicator
- Confirm password input
- Terms checkbox (required)
- "Already have account?" link → `/login`
- Create Account button + loading state
- Error display
- Google signup placeholder button

**Password Strength**:
- Show requirements (min 8 chars, uppercase, number, symbol - optional or UI only)
- Visual indicator (red/yellow/green)
- Update as user types

**Form Validation**:
- Email format
- Password min 8 chars (or configured requirement)
- Passwords match
- Terms checked
- Show errors on blur or submit

**UX**:
- Same as login page
- Focus on password strength feedback

#### 4. `app/(auth)/forgot-password/page.tsx` (~140 lines)
**Features**:
- Email input
- "Send Reset Link" button + loading state
- Success state with message
- "Back to Sign In" link → `/login`
- Error display

**States**:
1. **Initial**: Form visible
2. **Loading**: Button disabled, spinner
3. **Success**: Form hidden, confirmation message, email display
4. **Error**: Show error, keep form visible

**Error Handling**:
- Email not found → "No account found with this email"
- Network error → "Connection failed, try again"
- Rate limited → "Too many requests, try again in 5 minutes"

#### 5. `app/(auth)/reset-password/page.tsx` (~160 lines)
**Features**:
- New password input + show/hide
- Confirm password input + show/hide
- "Update Password" button + loading state
- Success message → auto-redirect to `/login`
- "Back to Sign In" link
- Error display
- Token validation from URL query params

**Token Validation**:
- Extract token from URL (`?token=xxx&type=recovery`)
- Validate with Supabase
- Show error if invalid/expired
- "Request new reset link" link → `/forgot-password`

**States**:
1. **Loading**: Validating token
2. **Invalid**: Show error, link to forgot password
3. **Valid**: Form displayed
4. **Submitting**: Button disabled, spinner
5. **Success**: Message, auto-redirect after 3 seconds

#### 6. `app/(auth)/(login)/page.tsx` (Optional redirect)
- If route group used, provide redirect route to `/login`
- Or handle via middleware

---

### Phase 3.4: Update Navbar Component (1-2 hours)

**File to Modify**: `components/landing/navbar.tsx`

**Changes Required** (~60 lines added):

#### When Logged Out:
```
Desktop:
- "Sign In" button → /login (ghost style)
- "Get Started" button → /register (primary style)

Mobile:
- Same buttons in menu
```

#### When Logged In:
```
Desktop:
- User email: "user@example.com"
- "Dashboard" link → /dashboard
- "Sign Out" button (destructive style)

Mobile:
- Same in menu
```

**Implementation**:
- Import `useAuth()` hook
- Add loading state (show skeleton while checking)
- Conditional rendering based on auth state
- Handle logout: `signOut()` + redirect to home
- Responsive for mobile/tablet/desktop

**Error Handling**:
- If auth check fails, show sign in button
- Graceful fallback

---

### Phase 3.5: Update Dashboard Layout (1-2 hours)

**File to Modify**: `app/dashboard/layout.tsx`

**Changes Required** (~60 lines added):

#### Auth Protection:
- Import `useAuth()` hook
- Check `isLoading` state
- Show loading spinner while checking session
- Redirect to `/login` if not authenticated
- Safety check (middleware should handle, but backup)

#### User Display:
- Display user email instead of placeholder
- Optional: Display plan from user object
- Optional: User avatar placeholder

#### Logout Handler:
- Update logout button to call `signOut()`
- Redirect to `/` after logout
- Show loading state on click

#### Sidebar:
- Keep same structure (8 menu items)
- No changes to menu items
- Keep same styling

---

## ROUTES SUMMARY

### Public Routes (No Auth Required)
```
GET / ........................ Landing page
GET /login ................... Login page
GET /register ................ Registration page
GET /forgot-password ......... Forgot password page
GET /reset-password .......... Reset password page
```

### Protected Routes (Auth Required)
```
GET /dashboard ............... Dashboard home
GET /dashboard/search ........ Search page
GET /dashboard/jobs .......... Jobs page
GET /dashboard/api-keys ...... API keys page
GET /dashboard/billing ....... Billing page
GET /dashboard/settings ...... Settings page
GET /dashboard/profile ....... Profile page
GET /dashboard/usage ......... Usage page
```

### Admin Routes (Admin Auth - DO NOT MODIFY)
```
GET /admin ................... Admin portal
GET /admin/* ................. Admin pages
```

### API Routes (x-api-key Auth - DO NOT MODIFY)
```
GET/POST /api/* .............. All API routes
```

---

## FILE CHANGES SUMMARY

### Phase 3.2: Create Auth Components
```
NEW:
- components/auth/AuthCard.tsx (60 lines)
- components/auth/AuthInput.tsx (120 lines)
- components/auth/AuthButton.tsx (70 lines)
- components/auth/ErrorAlert.tsx (60 lines)
- components/auth/LoadingSpinner.tsx (50 lines)
- components/auth/AuthDivider.tsx (40 lines)
- components/auth/SocialLoginButton.tsx (70 lines)

TOTAL: 470 lines of new component code
```

### Phase 3.3: Create Public Auth Routes
```
NEW:
- app/(auth)/layout.tsx (120 lines)
- app/(auth)/login/page.tsx (150 lines)
- app/(auth)/register/page.tsx (180 lines)
- app/(auth)/forgot-password/page.tsx (140 lines)
- app/(auth)/reset-password/page.tsx (160 lines)

TOTAL: 750 lines of new route code
```

### Phase 3.4: Update Navbar
```
MODIFY:
- components/landing/navbar.tsx (+60 lines)

Changes:
- Add useAuth() hook
- Add auth state check
- Conditional button rendering
- Logout handler
```

### Phase 3.5: Update Dashboard Layout
```
MODIFY:
- app/dashboard/layout.tsx (+60 lines)

Changes:
- Add useAuth() hook
- Add loading state
- Display user email
- Auth protection check
- Logout button handler
```

---

## DESIGN SPECIFICATIONS

### Layout Pattern
- **Container**: Centered card with max-width 450px (desktop)
- **Spacing**: Consistent 24px padding, 16px gap between elements
- **Rounded**: Radius tokens (radius-md for cards, radius-sm for buttons)

### Typography
- **Heading**: text-2xl font-semibold
- **Subheading**: text-sm text-foreground/70
- **Label**: text-sm font-medium
- **Button**: text-sm font-medium

### Colors
- **Primary**: oklch(0.205 0 0) - Dark navy
- **Background**: oklch(1 0 0) light / oklch(0.145 0 0) dark
- **Border**: oklch(0.922 0 0)
- **Error**: oklch(0.577 0.245 27.325) - Red
- **Input**: oklch(0.922 0 0)

### Responsive
- **Mobile**: 320px - Full width with padding
- **Tablet**: 768px - 450px card centered
- **Desktop**: 1024px+ - Same 450px card

### Dark Mode
- Automatic via class `.dark` on `html`
- All components inherit from globals.css theme
- No manual color overrides needed

---

## AUTHENTICATION FLOW IMPLEMENTATION

### Registration Flow
```
1. User fills email, password, confirm, terms
2. Submit → useAuth().signUp(email, password)
3. Loading state on button
4. Success → Set user in state
5. Auto-redirect to /dashboard OR /login (configurable)
6. Error → Show ErrorAlert, keep form
```

### Login Flow
```
1. User fills email, password
2. Submit → useAuth().signIn(email, password)
3. Loading state on button
4. Success → Set user in state, redirect to /dashboard
5. Error → Show ErrorAlert, keep form
6. If already logged in → Auto-redirect to /dashboard
```

### Logout Flow
```
1. User clicks "Sign Out" button
2. Loading state on button
3. Call useAuth().signOut()
4. Clear session, clear user state
5. Redirect to /
6. Navbar updates automatically
```

### Forgot Password Flow
```
1. User enters email
2. Submit → supabase.auth.resetPasswordForEmail(email)
3. Loading state
4. Success → Show confirmation message
5. Email received with reset link
6. Link → /reset-password?token=xxx&type=recovery
```

### Reset Password Flow
```
1. User clicks email link with token
2. Page validates token with Supabase
3. If valid → Show form
4. If invalid → Show error with link to /forgot-password
5. User submits new password
6. Update → supabase.auth.updateUser({ password })
7. Success → Show message, redirect to /login after 3s
```

---

## ERROR HANDLING IMPLEMENTATION

**Error Types & Messages**:

| Error | Message | Action |
|-------|---------|--------|
| Invalid password | "Invalid email or password" | Show form, clear password |
| Email exists | "Email already registered. Sign in instead?" | Show link to /login |
| Weak password | "Password must be at least 8 characters" | Keep form, focus password |
| Expired token | "Link expired. Request a new reset email." | Show link to /forgot-password |
| Invalid token | "Invalid reset link" | Show link to /forgot-password |
| Network error | "Connection failed. Please try again." | Show retry button |
| Rate limited | "Too many requests. Try again in 5 minutes." | Disable form for 5 min |
| Supabase down | "Service temporarily unavailable. Try again soon." | Show status page link |
| Session expired | "Session expired. Please sign in again." | Auto-redirect to /login |

**Implementation**:
- Each form catches errors from auth functions
- ErrorAlert component displays message
- Auto-dismiss after 5 seconds (or manual close)
- Clear on successful submit

---

## ACCESSIBILITY REQUIREMENTS

**Keyboard Navigation**:
- Tab through inputs, buttons
- Enter submits form
- Escape closes dialogs (if any)

**ARIA Labels**:
- `<label htmlFor>` for inputs
- `aria-describedby` for error messages
- `aria-label` for icon-only buttons

**Visual Indicators**:
- Focus ring on buttons (default browser)
- Error messages linked to fields
- Color contrast > 4.5:1

**Screen Reader**:
- Loading state announced
- Errors announced
- Success messages announced

**Semantic HTML**:
- `<form>` for forms
- `<input type="email">`, `<input type="password">`, etc.
- `<button type="submit">` for submit buttons
- `<label>` for input labels

---

## TESTING REQUIREMENTS

### Build & TypeScript
- `npm run build` succeeds
- `npx tsc --noEmit` zero errors
- No console warnings
- All imports resolve

### Component Tests (Manual)
- Auth components render without errors
- Props work correctly
- Dark/light mode works
- Responsive on mobile/tablet/desktop

### Flow Tests (Manual)
- Can register with valid email/password
- Can login with registered credentials
- Session persists on page refresh
- Cannot access /dashboard without auth
- Can logout and session clears
- Can request password reset
- Can reset password with token

### UI Tests (Manual)
- Form validation works
- Error messages display
- Loading states show spinners
- Buttons disabled while submitting
- Links navigate correctly
- Navbar updates on auth state change

---

## RISKS & MITIGATIONS

### Risk: Route Group Confusion
- Using `(auth)` route group might affect routing
- **Mitigation**: Test all routes, verify navigation works
- **Rollback**: Move pages out of route group to `app/login/`, `app/register/`, etc.

### Risk: useAuth Hook Issues
- Hook might not initialize correctly on mount
- **Mitigation**: Add logging, test in different browsers
- **Rollback**: Add null checks, fallback to unauthenticated state

### Risk: Navbar Auth State
- Navbar might show wrong state due to race condition
- **Mitigation**: Show loading skeleton while checking
- **Rollback**: Show placeholder, don't update navbar until loaded

### Risk: Middleware Redirect Loop
- middleware.ts might redirect infinitely
- **Mitigation**: Exclude public routes, test all paths
- **Rollback**: Disable middleware, add explicit checks

---

## ROLLBACK STRATEGY

If any phase fails:

**Phase 3.2 (Components)**:
- Delete `components/auth/*` directory
- No other files affected
- Zero impact on app

**Phase 3.3 (Routes)**:
- Delete `app/(auth)` directory
- Revert middleware.ts if modified
- App continues working (no auth pages but protected routes still work)

**Phase 3.4 (Navbar)**:
- Revert `components/landing/navbar.tsx` to pre-Phase 3.4 version
- Navbar shows original "Sign In"/"Get Started" buttons

**Phase 3.5 (Dashboard)**:
- Revert `app/dashboard/layout.tsx` to pre-Phase 3.5 version
- Dashboard still accessible but no user info display

---

## NEXT STEPS

### Approval Required

Please review and approve this implementation plan. Confirm:

1. ✓ Route structure correct (auth route group vs standard routes)?
2. ✓ Component design meets requirements?
3. ✓ Navbar changes acceptable?
4. ✓ Error handling comprehensive?
5. ✓ No conflicts with existing systems?

### After Approval

**Phase 3.2**: Create 7 auth components
→ Build verification → TypeScript verification → Approval for Phase 3.3

**Phase 3.3**: Create 5 auth pages
→ Build verification → TypeScript verification → Approval for Phase 3.4

**Phase 3.4**: Update navbar component
→ Build verification → TypeScript verification → Approval for Phase 3.5

**Phase 3.5**: Update dashboard layout
→ Build verification → TypeScript verification → COMPLETE

---

## STATUS

**Implementation Plan Complete**: ✅

**All phases documented**: ✅

**Risk assessment included**: ✅

**Rollback strategy defined**: ✅

**AWAITING APPROVAL TO PROCEED WITH PHASE 3.2**
