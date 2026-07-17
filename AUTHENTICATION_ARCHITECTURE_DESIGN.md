# Authentication Architecture Design Report
## Separating Dashboard & External API Authentication

**Status**: READ-ONLY INVESTIGATION COMPLETE  
**Application Type**: Search Intelligence SaaS (internal dashboard + external API)  
**Date**: Current session

---

## EXECUTIVE SUMMARY

The application has two distinct authentication requirements that are currently conflated:

1. **Dashboard Authentication** (Internal, User-Based)
   - Users authenticate with email/password
   - Use Supabase for session management
   - Dashboard pages and internal APIs accessed via httpOnly cookies
   - No API keys needed for dashboard features

2. **External API Authentication** (External, Developer-Based)
   - Developers consume /api endpoints from external applications
   - Use x-api-key header for authentication
   - Designed for server-to-server communication
   - Existing infrastructure already correct

**Problem**: Dashboard calls internal APIs with x-api-key requirement (incorrect)  
**Solution**: Create separate authentication middleware for dashboard APIs vs external APIs

---

## CURRENT ARCHITECTURE ANALYSIS

### Supabase Authentication (Phase 2A - Implemented ✓)

**Flow**:
```
User Login
  ↓
Supabase email/password verification
  ↓
Session created + httpOnly cookies set
  ↓
Browser automatically sends cookies in requests
  ↓
Server extracts session from cookies
  ↓
User authenticated to dashboard
```

**Status**: Correctly implemented
- User state captured in React
- router.refresh() syncs client/server
- Middleware validates Supabase sessions
- Dashboard pages accessible

### API Key Authentication (Pre-existing - External Focus)

**Flow**:
```
External Developer
  ↓
Calls /api/search with x-api-key header
  ↓
withAuth() middleware checks header
  ↓
Validates API key format (sk_test_/sk_live_)
  ↓
Attaches user object to request
  ↓
Route handler processes request
  ↓
Returns JSON response
```

**Status**: Correctly implemented for external use
- Designed for developers outside the app
- Works with server-to-server calls
- Doesn't require browser/cookies
- Can be rate-limited per key

### Problem: Dashboard Tries Using API Keys

**Conflicting Flow**:
```
Dashboard loads
  ↓
useUsage() hook calls getUserCredential()
  ↓
No API key found in localStorage
  ↓
ApiClient sends request without x-api-key header
  ↓
withAuth() middleware rejects (no credential)
  ↓
401 Unauthorized
  ↓
Dashboard data fails to load ✗
```

**Root Cause**: Two auth systems, no clear separation

---

## RECOMMENDED ARCHITECTURE

### Principle: Two Separate Auth Paths

```
┌─────────────────────────────────────────────────────────┐
│ INCOMING REQUEST                                        │
└─────────────────────────────────────────────────────────┘
                        │
                        ↓
            ┌───────────────────────┐
            │ Is request from       │
            │ dashboard/browser?    │
            └───────────────────────┘
                    /       \
                   /         \
              YES /           \ NO
                 /             \
                ↓               ↓
        ┌──────────────┐  ┌──────────────┐
        │ Check for    │  │ Check for    │
        │ Supabase     │  │ x-api-key    │
        │ session      │  │ header       │
        │ (cookies)    │  │              │
        └──────────────┘  └──────────────┘
                │              │
                ↓              ↓
        ┌──────────────┐  ┌──────────────┐
        │ Valid? →     │  │ Valid? →     │
        │ Allow access │  │ Allow access │
        │ (Dashboard)  │  │ (External)   │
        └──────────────┘  └──────────────┘
```

### API Route Classification

#### INTERNAL DASHBOARD APIs (Use Supabase Session)

These routes are called only by the dashboard UI:

```
GET  /api/billing/status         - Fetch usage/quota
GET  /api/metrics                - Fetch job metrics
GET  /api/auth/me                - Fetch current user
GET  /dashboard/api/**           - Dashboard-specific endpoints
```

**Authentication**: Supabase session from httpOnly cookies  
**Middleware**: withDashboardAuth()  
**Client**: useUsage(), useMetrics() hooks (NO credential needed)  

#### EXTERNAL API ROUTES (Use x-api-key)

These routes are called by external developers:

```
POST /api/search                 - Perform search
POST /api/jobs                   - Create job
GET  /api/job/[id]              - Get job status
GET  /api/job/[id]/result       - Get job result
POST /api/job/[id]/status       - Check status
GET  /api/admin/**              - Admin endpoints
```

**Authentication**: x-api-key header  
**Middleware**: withAuth() (existing - KEEP)  
**Client**: ApiClient with credential passed manually  

---

## DATABASE SCHEMA FOR SEARCH PROVIDER INTEGRATIONS

### New Table: `user_integrations`

Store credentials for connected search providers:

```sql
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL, -- 'google', 'serpapi'
  provider_name TEXT NOT NULL, -- Display name
  
  -- Encrypted credentials (encrypted at rest)
  credentials JSONB NOT NULL, -- { apiKey, searchEngineId, etc }
  
  -- Metadata
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'error'
  last_tested_at TIMESTAMP,
  test_error TEXT, -- Error message if last test failed
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, provider_type)
);

CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);
```

### New Table: `provider_config`

Store available provider templates and requirements:

```sql
CREATE TABLE provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT UNIQUE NOT NULL, -- 'google', 'serpapi'
  display_name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  
  -- Provider requirements
  required_fields JSONB NOT NULL, -- [{ name, label, type, description }]
  documentation_url TEXT,
  
  -- Rate limiting per provider
  default_rate_limit INT DEFAULT 100,
  rate_limit_period INT DEFAULT 3600, -- seconds
  
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
```

### New Table: `integration_logs`

Audit trail for integration usage:

```sql
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  integration_id UUID NOT NULL REFERENCES user_integrations(id),
  
  action TEXT NOT NULL, -- 'test', 'use', 'error'
  status TEXT, -- 'success', 'failed', 'rate_limited'
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_integration_logs_user_id ON integration_logs(user_id);
```

---

## PROVIDER INTEGRATION STORAGE

### Google Programmable Search Engine

**Credentials to Store**:
```json
{
  "apiKey": "AIza...", // API key for authentication
  "searchEngineId": "012345:abcdef..." // PSE ID
}
```

**Validation**: Test API key with searchbyimage.googleapis.com API  
**Permissions**: Requires "Programmable Search API" enabled in Google Cloud

### SerpAPI

**Credentials to Store**:
```json
{
  "apiKey": "serpapi_key_...",
  "planType": "free|professional|business" // Optional
}
```

**Validation**: Test with https://serpapi.com/account API  
**Permissions**: Valid SerpAPI account with credits

### Future Providers

Architecture supports adding:
- Bing Search API
- DuckDuckGo API
- Custom search engine configurations

---

## MIDDLEWARE IMPLEMENTATION STRATEGY

### Option A: Create New Dashboard Auth Middleware

**File**: `lib/auth/middleware-dashboard.ts` (CREATE NEW)

```typescript
export interface DashboardAuthRequest extends NextRequest {
  user?: {
    id: string
    email: string
    plan: 'free' | 'pro' | 'enterprise'
  }
}

export function withDashboardAuth(
  handler: (req: DashboardAuthRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      // Extract Supabase session from cookies
      const { session } = await refreshServerSession(request)
      
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized - session required' },
          { status: 401 }
        )
      }
      
      // Attach user info to request
      const dashboardRequest = request as DashboardAuthRequest
      dashboardRequest.user = {
        id: session.user.id,
        email: session.user.email || '',
        plan: 'pro' // TODO: Get from user metadata
      }
      
      return handler(dashboardRequest)
    } catch (error) {
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
  }
}
```

### Option B: Modify Existing withAuth() Middleware

**File**: `lib/auth/middleware.ts` (MODIFY)

Add automatic detection:

```typescript
export function withAuth(
  handler: (req: AuthedRequest) => Promise<NextResponse>,
  options?: { dashboard?: boolean }
) {
  return async (request: NextRequest) => {
    // Try Supabase session first (dashboard)
    if (options?.dashboard) {
      const { session } = await refreshServerSession(request)
      if (session?.user) {
        const dashedRequest = request as AuthedRequest
        dashedRequest.user = {
          id: session.user.id,
          credential: session.session.access_token,
          isAdmin: false,
          role: 'user',
          plan: 'pro'
        }
        return handler(dashedRequest)
      }
    }
    
    // Fall back to x-api-key (external)
    const credential = request.headers.get('x-api-key')
    // ... existing logic
  }
}
```

---

## API ROUTES: AUTH MIGRATION PLAN

### Routes to Modify (Dashboard APIs)

**Current**: `export const GET = withAuth(handler)`  
**New**: `export const GET = withDashboardAuth(handler)`

```
/api/billing/status
/api/metrics
/api/auth/me
```

### Routes to Keep (External APIs)

**Current**: `export const POST = withAuth(withRateLimit(withBilling(handler)))`  
**No Change**: Continue using x-api-key

```
/api/search
/api/jobs
/api/job/[id]
/api/job/[id]/result
/api/job/[id]/status
/api/admin/**
```

---

## UI FLOW: CONNECTING SEARCH PROVIDERS

### Settings → Search Providers

```
Dashboard
  ↓
Settings (sidebar)
  ↓
Search Providers tab (NEW)
  ↓
┌─────────────────────────────────────────┐
│ Connected Providers                     │
├─────────────────────────────────────────┤
│ □ Google Programmable Search Engine     │
│   ✓ Connected · Last tested 2h ago      │
│   [Disconnect] [Test] [View Credentials]
│                                         │
│ □ SerpAPI                               │
│   ✗ Not connected (requires API key)    │
│   [Connect] [Learn More]                │
└─────────────────────────────────────────┘

[+ Add Provider]
```

### Connect Provider Flow

```
[+ Add Provider]
  ↓
┌─────────────────────────────────────────┐
│ Select Provider                         │
├─────────────────────────────────────────┤
│ □ Google Programmable Search Engine     │
│ □ SerpAPI                               │
│ □ Bing Search                           │
└─────────────────────────────────────────┘
  ↓
Modal: "Connect Google PSE"
  ↓
┌─────────────────────────────────────────┐
│ Step 1: Get Your Credentials            │
│                                         │
│ API Key:                                │
│ [_______________________________]        │
│ ? Learn how to get API key              │
│                                         │
│ Search Engine ID:                       │
│ [_______________________________]        │
│ ? Learn how to get Search Engine ID     │
│                                         │
│ [Test Credentials] [Save & Connect]    │
└─────────────────────────────────────────┘
  ↓
Test Results
  ↓
✓ Success! Provider connected
  ↓
Redirect to search provider management page
```

### New Components

**File**: `/app/dashboard/integrations/page.tsx`
- Main integrations management page

**File**: `/components/integrations/ProviderList.tsx`
- Display connected providers

**File**: `/components/integrations/ConnectProviderDialog.tsx`
- Modal for connecting new providers

**File**: `/components/integrations/ProviderStatus.tsx`
- Status indicator and actions

---

## API ENDPOINTS FOR PROVIDER MANAGEMENT

### New Internal Dashboard APIs

```
GET    /api/dashboard/integrations
       - List user's connected providers

POST   /api/dashboard/integrations
       - Add new provider connection
       Body: { provider_type, credentials }

GET    /api/dashboard/integrations/:providerId
       - Get specific integration details

PUT    /api/dashboard/integrations/:providerId
       - Update integration (disconnect, update creds)

POST   /api/dashboard/integrations/:providerId/test
       - Test provider credentials

POST   /api/dashboard/integrations/:providerId/verify
       - Verify provider is working
```

**Authentication**: Supabase session (dashboard auth)  
**Response**: User's integration data only

---

## DATABASE TABLES SUMMARY

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `user_integrations` | Store encrypted provider credentials | user_id, provider_type, credentials |
| `provider_config` | Available providers & requirements | provider_type, required_fields, is_active |
| `integration_logs` | Audit trail of integration usage | user_id, integration_id, action, status |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Separate Authentication Middleware
- [ ] Create `withDashboardAuth()` middleware
- [ ] Modify dashboard API routes
- [ ] Update client hooks (useUsage, useMetrics)
- [ ] Test dashboard functionality

### Phase 2: Database Schema
- [ ] Create user_integrations table
- [ ] Create provider_config table
- [ ] Create integration_logs table
- [ ] Add indexes and constraints

### Phase 3: Provider Management APIs
- [ ] Implement /api/dashboard/integrations endpoints
- [ ] Add credential encryption/decryption
- [ ] Add provider validation logic
- [ ] Add test/verify endpoints

### Phase 4: UI Components
- [ ] Create /dashboard/integrations page
- [ ] Build provider list component
- [ ] Build connect provider modal
- [ ] Add provider status display

### Phase 5: Search Integration
- [ ] Use connected provider in search flow
- [ ] Fall back to default if not connected
- [ ] Track which provider was used
- [ ] Update search UI to show provider choice

---

## SECURITY CONSIDERATIONS

### Credential Encryption

- Store credentials encrypted in database using Supabase encryption
- Never log credentials in error messages
- Rotate credentials on provider disconnect
- Add audit logging for credential access

### Rate Limiting

- Per-user rate limits for each provider
- Prevent credential sharing across users
- Track usage per integration
- Alert on unusual activity patterns

### Validation

- Test credentials immediately after input
- Periodic verification (weekly)
- Mark integration as "error" if tests fail
- Prevent use of failed integrations

---

## NO CODE CHANGES MADE

This is a READ-ONLY investigation and architectural design document.

**Next Steps**:
1. Review and approve this architecture
2. Confirm database schema and API endpoint design
3. Confirm UI flow and components
4. Provide implementation approval
5. Proceed with Phase 1 implementation

