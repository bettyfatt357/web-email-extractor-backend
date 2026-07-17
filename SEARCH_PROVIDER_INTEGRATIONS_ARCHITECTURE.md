# Search Provider Integrations Architecture Report

**Status**: READ-ONLY INVESTIGATION COMPLETE  
**Scope**: User-owned search provider integrations (Google PSE, SerpAPI, future providers)  
**Date**: Current session

---

## EXECUTIVE SUMMARY

The application currently uses hardcoded Google Programmable Search Engine credentials (GOOGLE_API_KEY + GOOGLE_CX from environment variables). This architecture report designs how to allow users to connect and manage their own search provider credentials while maintaining backward compatibility with the default provider.

**Key Findings**:
- Current system relies on single global Google configuration
- Search service hardcoded to use `googleSearch()` function
- No provider abstraction layer exists
- Supabase available for storing encrypted credentials
- Advanced Discovery feature needs provider selection capability

---

## CURRENT ARCHITECTURE ANALYSIS

### Current Search Flow

```
/dashboard/search (UI)
  ↓
handleSubmit() → POST /api/search
  ↓
/api/search/route.ts validates request
  ↓
performSearch() or performAdvancedSearch()
  ↓
googleSearch() → Google PSE API (hardcoded)
  ↓
Extract URLs → Queue extraction jobs
  ↓
Return results
```

### Current Provider Configuration

**File**: `/lib/config/google.ts`

```typescript
class GoogleConfigManager {
  - Loads GOOGLE_API_KEY from environment
  - Loads GOOGLE_CX from environment
  - Validates at startup (throws error if missing)
  - Returns config or null
}
```

**Usage in Search Service**:
```typescript
// /lib/search/search-service.ts line 76
const googleResults = await googleSearch(enhancedQuery, pages);
```

### Limitations of Current System

1. **Single Provider**: Only Google PSE supported
2. **Global Configuration**: Environment variables apply to all users
3. **No User Choice**: Users cannot switch providers
4. **Backward Compatibility Risk**: Hard to change without breaking existing deployments
5. **No Credential Management UI**: No way for users to input their own credentials

---

## PROPOSED ARCHITECTURE

### 1. DATABASE SCHEMA FOR INTEGRATIONS

#### Table: `user_integrations`

Store user-owned search provider credentials:

```sql
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider type
  provider_type TEXT NOT NULL CHECK (provider_type IN ('google_pse', 'serpapi', 'bing', 'custom')),
  provider_name TEXT NOT NULL, -- 'Google Programmable Search Engine', 'SerpAPI', etc
  
  -- Encrypted credentials (Supabase pgcrypto)
  credentials JSONB NOT NULL, -- { apiKey, searchEngineId } for Google, { apiKey } for SerpAPI
  
  -- Status tracking
  is_default BOOLEAN DEFAULT false, -- Is this user's default provider?
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP,
  test_status TEXT, -- 'success', 'failed', null
  test_error TEXT, -- Error message if last test failed
  
  -- Usage tracking
  searches_performed INT DEFAULT 0,
  failed_searches INT DEFAULT 0,
  
  -- Metadata
  notes TEXT, -- User's notes about this integration
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, provider_type) -- One integration per provider type per user
);

CREATE INDEX idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX idx_user_integrations_is_default ON user_integrations(user_id, is_default);
```

#### Table: `provider_registry`

Define available providers and their requirements:

```sql
CREATE TABLE provider_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT, -- CDN URL for provider logo
  
  -- Provider requirements (defines what credentials are needed)
  required_fields JSONB NOT NULL, 
  -- Example: [
  --   { "name": "apiKey", "label": "API Key", "type": "password", "required": true },
  --   { "name": "searchEngineId", "label": "Search Engine ID", "type": "text", "required": true }
  -- ]
  
  -- Setup instructions
  setup_instructions TEXT,
  setup_url TEXT, -- Link to provider dashboard
  documentation_url TEXT,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  is_beta BOOLEAN DEFAULT false,
  
  -- Rate limiting
  free_tier_limit INT, -- Searches per day (null if unlimited)
  rate_limit_per_hour INT DEFAULT 100,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with default providers
INSERT INTO provider_registry VALUES
  (gen_random_uuid(), 'google_pse', 'Google Programmable Search Engine', '...', 
   JSONB '[{"name":"apiKey",...},{"name":"searchEngineId",...}]', ...),
  (gen_random_uuid(), 'serpapi', 'SerpAPI', '...', 
   JSONB '[{"name":"apiKey",...}]', ...);
```

#### Table: `integration_usage_logs`

Audit trail for compliance and debugging:

```sql
CREATE TABLE integration_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  integration_id UUID NOT NULL REFERENCES user_integrations(id),
  
  action TEXT NOT NULL, -- 'search', 'test', 'error'
  status TEXT, -- 'success', 'failed', 'rate_limited'
  search_id TEXT, -- Reference to search that used this integration
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_integration_usage_logs_user_id ON integration_usage_logs(user_id);
CREATE INDEX idx_integration_usage_logs_created_at ON integration_usage_logs(created_at);
```

### 2. ENCRYPTION STRATEGY

#### Credential Storage

**Location**: Supabase `user_integrations.credentials` column (JSONB)  
**Encryption**: Supabase pgcrypto extension (pgsql-crypto)

**Setup SQL**:
```sql
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted credentials column
ALTER TABLE user_integrations 
ADD COLUMN credentials_encrypted BYTEA;

-- Encryption function
CREATE OR REPLACE FUNCTION encrypt_credentials(data JSONB)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(data::text, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;

-- Decryption function
CREATE OR REPLACE FUNCTION decrypt_credentials(data BYTEA)
RETURNS JSONB AS $$
BEGIN
  RETURN pgp_sym_decrypt(data, current_setting('app.encryption_key'))::jsonb;
END;
$$ LANGUAGE plpgsql;
```

**In Application**:

When storing credentials:
```typescript
// API receives: { apiKey, searchEngineId }
// Server encrypts with app-level key before storing in DB
const encrypted = await supabase
  .from('user_integrations')
  .insert({
    user_id: session.user.id,
    provider_type: 'google_pse',
    credentials: supabase.rpc('encrypt_credentials', { data: credentials })
  })
```

When retrieving credentials:
```typescript
// Get encrypted credentials
const { data } = await supabase
  .from('user_integrations')
  .select('id, decrypt_credentials(credentials_encrypted) as credentials')
  .eq('user_id', userId)
  .eq('is_default', true)
  .single()

// Decrypted credentials available in application
const { apiKey, searchEngineId } = data.credentials
```

### 3. SETTINGS UI STRUCTURE

#### New Dashboard Tab: `/dashboard/integrations`

**Page Structure**:

```
Dashboard → Settings → Integrations (NEW TAB)

┌─────────────────────────────────────────────────────────────┐
│ Search Providers                                            │
│ Connect your own search provider credentials               │
├─────────────────────────────────────────────────────────────┤

┌─ Connected Providers ────────────────────────────────────────┐
│                                                             │
│ Google Programmable Search Engine                          │
│ ✓ Connected · Last tested 2h ago · [Test] [Edit] [Disconnect]
│                                                             │
│ SerpAPI                                                     │
│ ✗ Not connected · [Connect]                               │
│                                                             │
│ Bing Search API                                             │
│ - Not available in your plan · [Learn More]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[+ Add New Provider] [Restore Defaults]
```

### 4. PROVIDER TESTING FLOW

#### Test Workflow

```
User enters credentials
  ↓
[Test Credentials] button clicked
  ↓
POST /api/dashboard/integrations/test
  ├─ Validate credential format
  ├─ Call provider's test endpoint
  │ ├─ Google: Test with searchbyimage.googleapis.com
  │ ├─ SerpAPI: Test with /account API
  │ └─ Bing: Test with /search endpoint
  ├─ Handle response
  │ ├─ Success: Show "✓ Connected successfully"
  │ ├─ Failed: Show specific error (invalid key, quota exceeded, etc)
  │ └─ Network: Show connection error
  ↓
If success: Enable [Save] button
If failed: Show error, prevent save
```

#### Test Result Types

| Result | Message | Action |
|--------|---------|--------|
| Valid | ✓ Credentials verified | Allow save |
| Invalid Key | ✗ API key is invalid | Show error, block save |
| Quota Exceeded | ⚠ Daily quota reached | Allow save (temporary issue) |
| Not Configured | ✗ Provider not set up | Link to setup docs |
| Network Error | ✗ Cannot reach provider | Retry or contact support |

### 5. SEARCH ROUTING ARCHITECTURE

#### Provider Selection Flow

**Simple Search**:
```
User clicks "Search" on /dashboard/search
  ↓
Uses user's default provider (or global fallback)
  ↓
POST /api/search with query
  ↓
API identifies which provider to use
  ├─ Check user's default: SELECT ... WHERE is_default = true
  ├─ If none: Use global config (GOOGLE_API_KEY env var)
  ├─ If exists: Use user's credentials
  ↓
performSearch(query, provider)
  └─ Calls provider-specific search function
```

**Advanced Discovery**:
```
User accesses /dashboard/advanced-discovery (NEW PAGE)
  ↓
Page fetches user's connected providers
  ├─ GET /api/dashboard/integrations
  ├─ Returns: [google_pse { id, name, status }, serpapi { id, name, status }]
  ↓
AdvancedDiscovery component shows provider selector
  ├─ Radio buttons: Google PSE | SerpAPI | [Default]
  ↓
User configures search + selects provider
  ↓
Clicks "Start Search"
  ↓
POST /api/search with:
  {
    keywords: [...],
    patterns: [...],
    providerId: "integration_id_xyz", // NEW FIELD
    ...
  }
  ↓
API fetches provider credentials
  ↓
performAdvancedSearch(keywords, provider)
```

### 6. ADVANCED DISCOVERY PROVIDER SELECTION

#### New Component: ProviderSelector

**Location**: `/components/integrations/ProviderSelector.tsx`

```typescript
interface ProviderSelectorProps {
  value?: string // integration_id or 'default'
  onChange: (integrationId: string) => void
  disabled?: boolean
}

// Renders:
// [◉ Use Default Provider]
// [◯ Google PSE] - Shows status, rate limit
// [◯ SerpAPI] - Shows status, rate limit
// [◯ Bing Search] - Grayed out: "Upgrade to Pro"
```

#### Integration in Advanced Discovery

**Current Page**: `/app/dashboard/search/page.tsx`

Add provider selection section:
```
┌─ Advanced Discovery ────────────────────────────┐
│                                                │
│ Search Settings:                              │
│ ├─ Keywords: [input]                          │
│ ├─ Location: [input]                          │
│ ├─ Depth: [slider 1-5]                        │
│                                                │
│ Search Provider:                              │
│ ├─ [◉ Use My Default]                         │
│ ├─ [◯ Google PSE] - Connected, 95k calls/day │
│ ├─ [◯ SerpAPI] - Connected, unlimited         │
│                                                │
│ [Start Search]                                 │
└─────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION PHASES

### Phase 1: Database & Encryption (2-3 days)

- [ ] Create migration for `user_integrations` table
- [ ] Create migration for `provider_registry` table
- [ ] Create migration for `integration_usage_logs` table
- [ ] Set up pgcrypto encryption functions
- [ ] Seed `provider_registry` with Google PSE and SerpAPI

### Phase 2: Provider Abstraction Layer (2-3 days)

- [ ] Create provider interface/abstract base class
- [ ] Implement Google PSE provider class
- [ ] Implement SerpAPI provider class
- [ ] Create provider factory pattern
- [ ] Update search service to use provider abstraction

### Phase 3: Credentials Management APIs (2-3 days)

- [ ] POST `/api/dashboard/integrations` - Add new integration
- [ ] GET `/api/dashboard/integrations` - List user's integrations
- [ ] PUT `/api/dashboard/integrations/:id` - Update integration
- [ ] DELETE `/api/dashboard/integrations/:id` - Remove integration
- [ ] POST `/api/dashboard/integrations/:id/test` - Test credentials

### Phase 4: Settings UI (3-4 days)

- [ ] Create `/dashboard/integrations/page.tsx`
- [ ] Build `IntegrationList` component
- [ ] Build `ConnectProviderModal` component
- [ ] Build `ProviderSelector` component
- [ ] Add integrations tab to settings layout

### Phase 5: Advanced Discovery Integration (2 days)

- [ ] Add provider selector to search page
- [ ] Update search form to capture selected provider
- [ ] Update /api/search to use selected provider
- [ ] Test with multiple providers

### Phase 6: Testing & Documentation (2-3 days)

- [ ] Unit tests for provider classes
- [ ] Integration tests for credential flow
- [ ] E2E tests for provider switching
- [ ] User documentation

---

## PROVIDER ABSTRACTION DESIGN

### Base Provider Interface

```typescript
interface SearchProvider {
  type: 'google_pse' | 'serpapi' | 'bing' | 'custom'
  name: string
  
  // Search methods
  search(query: string, pageSize?: number): Promise<SearchResult[]>
  advancedSearch(keywords: string[], options?: AdvancedOptions): Promise<SearchResult[]>
  
  // Validation
  validateCredentials(creds: unknown): Promise<boolean>
  testConnection(): Promise<{ success: boolean; error?: string }>
  
  // Rate limiting
  getRateLimit(): { requestsPerHour: number; remaining: number }
}

// Implementation per provider
class GooglePSEProvider implements SearchProvider {
  constructor(apiKey: string, searchEngineId: string) { ... }
  
  async search(query: string) {
    // Call Google Custom Search API
  }
  
  async testConnection() {
    // Validate API key and search engine ID
  }
}

class SerpAPIProvider implements SearchProvider {
  constructor(apiKey: string) { ... }
  
  async search(query: string) {
    // Call SerpAPI
  }
  
  async testConnection() {
    // Validate API key via /account endpoint
  }
}
```

### Provider Factory

```typescript
class ProviderFactory {
  static async createFromIntegration(
    integration: UserIntegration,
    decryptedCredentials: Record<string, any>
  ): Promise<SearchProvider> {
    switch (integration.provider_type) {
      case 'google_pse':
        return new GooglePSEProvider(
          decryptedCredentials.apiKey,
          decryptedCredentials.searchEngineId
        )
      case 'serpapi':
        return new SerpAPIProvider(decryptedCredentials.apiKey)
      default:
        throw new Error(`Unknown provider: ${integration.provider_type}`)
    }
  }
  
  static createDefault(): SearchProvider {
    // Use environment variable config
    return new GooglePSEProvider(
      process.env.GOOGLE_API_KEY!,
      process.env.GOOGLE_CX!
    )
  }
}
```

---

## BACKWARD COMPATIBILITY

### Existing Users (No Change Required)

For users without connected integrations:
- `performSearch()` automatically uses global Google config
- No UI shown about providers
- Works exactly as today

### Opt-In Migration Path

Users can:
1. Navigate to Settings → Integrations (NEW)
2. See "No custom providers connected"
3. Click "Connect a Provider"
4. Optionally connect their own Google PSE or SerpAPI
5. Set their own as default (optional)
6. Search continues to work with their provider

### Fallback Chain

```
1. Check for user's default provider
   ↓ (if connected and active)
2. Use that provider
   ↓ (if not set or disabled)
3. Fall back to global GOOGLE_API_KEY / GOOGLE_CX
   ↓ (if not configured)
4. Show error: "No search provider configured"
```

---

## SECURITY CONSIDERATIONS

### Credential Security

1. **Encryption at Rest**: pgcrypto with app-level encryption key
2. **Encryption in Transit**: HTTPS/TLS (Vercel provides)
3. **Access Control**: Row-level security (user sees only their own credentials)
4. **Audit Logging**: Every credential access logged in `integration_usage_logs`

### Rate Limiting

1. Per-user per-provider rate limits
2. Prevent credential sharing (one user_id per credential set)
3. Monitor for abuse patterns
4. Alert on failed tests (possible invalid key detection)

### Validation

1. Validate credential format before storage
2. Test credentials immediately after input
3. Periodic re-validation (weekly)
4. Mark as inactive if tests fail repeatedly

---

## API ENDPOINT SPECIFICATIONS

### POST /api/dashboard/integrations

Add new provider integration.

**Auth**: Supabase session required  
**Body**:
```json
{
  "provider_type": "google_pse",
  "credentials": {
    "apiKey": "AIza...",
    "searchEngineId": "012345:abc..."
  },
  "notes": "Personal Google PSE for company research"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "provider_type": "google_pse",
  "provider_name": "Google Programmable Search Engine",
  "is_default": false,
  "is_active": true,
  "test_status": "success",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### GET /api/dashboard/integrations

List user's integrations (credentials redacted).

**Auth**: Supabase session required  
**Response** (200 OK):
```json
{
  "integrations": [
    {
      "id": "uuid",
      "provider_type": "google_pse",
      "provider_name": "Google Programmable Search Engine",
      "is_default": true,
      "is_active": true,
      "test_status": "success",
      "last_tested_at": "2024-01-15T10:00:00Z",
      "searches_performed": 42,
      "failed_searches": 1
    }
  ]
}
```

### POST /api/dashboard/integrations/:id/test

Test provider credentials.

**Auth**: Supabase session required  
**Response** (200 OK):
```json
{
  "success": true,
  "message": "Credentials verified successfully"
}
```

Or (400 Bad Request):
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

---

## MIGRATION STRATEGY

### For Existing Deployments

1. **Week 1**: Deploy database tables + encryption setup
2. **Week 2**: Deploy provider abstraction layer (no UI yet)
3. **Week 3**: Deploy Settings UI (beta flag)
4. **Week 4**: Remove beta flag, full release

### For New Deployments

- All code and tables included from day 1
- Default provider (global config) works immediately
- User integrations optional

---

## FUTURE EXTENSIBILITY

### Adding New Providers

1. Create new class implementing `SearchProvider` interface
2. Add to `provider_registry` via migration
3. Update `ProviderFactory` to handle new type
4. UI automatically supports new provider

### Adding Provider-Specific Features

- Rate limit indicators
- Search history per provider
- Provider-specific result formatting
- Cost tracking per provider

---

## TESTING STRATEGY

### Unit Tests

- Provider factory creation
- Credential encryption/decryption
- Provider-specific search logic
- Fallback chain logic

### Integration Tests

- End-to-end credential flow
- Database transactions
- RLS policies on user_integrations
- Test endpoint validation

### E2E Tests

- User connects provider via UI
- User runs search with custom provider
- Results returned correctly
- Switching between providers

---

## OPEN QUESTIONS FOR APPROVAL

1. Should users be able to pause/disable a provider without deleting it?
2. Should we implement cost tracking per provider integration?
3. Should admin users be able to see all users' integrations?
4. What encryption key should we use (env var, key management service)?
5. Should failed integration tests send alerts to users?

---

## NO CODE CHANGES MADE

This is a READ-ONLY architectural design document. No implementation has started.

**Next Steps**:
1. Review architecture and provide feedback
2. Approve database schema
3. Confirm encryption strategy
4. Confirm UI/UX flows
5. Provide implementation approval to proceed with Phase 1

