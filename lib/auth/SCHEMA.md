# Authentication & Billing Schema

This document describes the database schema needed for the authentication and billing system.

**Status**: Current implementation uses in-memory stores for demo. Production requires database migration.

## Tables Required

### users
Stores user accounts and API keys

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### api_keys
Stores API keys for authentication

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP
);
```

### usage
Tracks usage/quota for each user

```sql
CREATE TABLE usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,  -- YYYY-MM format
  searches INT DEFAULT 0,
  status_checks INT DEFAULT 0,
  result_fetches INT DEFAULT 0,
  total_jobs_created INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month)
);
```

### billing_subscriptions
Stores Stripe subscription info

```sql
CREATE TABLE billing_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT,
  plan TEXT CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT CHECK (status IN ('active', 'past_due', 'cancelled')),
  current_period_start BIGINT,
  current_period_end BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### usage_events
Audit log of all API calls

```sql
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,  -- NULL for anonymous
  endpoint TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('search', 'status', 'results')),
  jobs_created INT,
  urls_processed INT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

### rate_limit_state
Tracks rate limit counters

```sql
CREATE TABLE rate_limit_state (
  id TEXT PRIMARY KEY,
  user_id_or_ip TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  request_count INT DEFAULT 0,
  reset_time BIGINT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Indexes

```sql
-- Speed up common queries
CREATE INDEX idx_users_plan ON users(plan);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_usage_user_month ON usage(user_id, month);
CREATE INDEX idx_subscriptions_user ON billing_subscriptions(user_id);
CREATE INDEX idx_events_user_time ON usage_events(user_id, created_at);
```

## Migration Instructions

### From In-Memory to Database

1. **users table**: Migrate user records from JavaScript Map
2. **api_keys table**: Hash API keys before storing
3. **usage table**: Sum up incremental usage calls
4. **billing_subscriptions**: Migrate Stripe customer records
5. **usage_events**: Migrate event log

### Code Changes Needed

Replace in-memory stores:

```typescript
// OLD: const usageStore = new Map<string, any>();

// NEW:
import { Database } from '@/lib/db';
const db = new Database();

// Replace:
// usageStore.get(userId)
// With:
// await db.query('SELECT * FROM usage WHERE user_id = ?', [userId])
```

## Environment Variables

```
# Required for Stripe webhooks
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Rate limits (per hour)
RATE_LIMIT_FREE=10
RATE_LIMIT_PRO=100
RATE_LIMIT_ENTERPRISE=1000

# Allow anonymous access (when no API key required)
ALLOW_ANONYMOUS=true
```

## Security Considerations

1. **API Key Storage**: Always hash keys before storing
   ```typescript
   const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
   ```

2. **Stripe Webhook Verification**: Always verify signature
   ```typescript
   stripe.webhooks.constructEvent(rawBody, signature, secret);
   ```

3. **Rate Limiting**: Use Redis for distributed rate limiting
   ```
   REDIS_URL=redis://...
   ```

4. **Usage Tracking**: Log all API calls for audit trail

5. **Quota Enforcement**: Check quota BEFORE processing request
