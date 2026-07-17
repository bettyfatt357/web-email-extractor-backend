# Email Extraction Platform - Security Guidelines

## Security Overview

This document outlines the security architecture, threat model, and best practices for the Email Extraction Platform.

## Authentication & Authorization

### API Key Authentication
- **Format**: `sk_test_*` (development) or `sk_live_*` (production)
- **Transmission**: Sent via `x-api-key` HTTP header
- **Validation**: Checked on every request by `withAuth()` middleware
- **Invalid Keys**: Return HTTP 401 Unauthorized

### Admin Authentication
- **Credential**: Environment variable `ADMIN_CREDENTIAL`
- **Type**: String (any format - recommend `sk_admin_*` for clarity)
- **Validation**: Checked by `withAdminAuth()` middleware
- **Admin Routes**: All `/api/admin/*` endpoints require admin role

### Role-Based Access Control
```
user (default)
├── Can create jobs
├── Can view own jobs
├── Can view own usage
└── Cannot view other users

admin
├── Can view all jobs
├── Can view all users
├── Can view system metrics
├── Can manage rate limits
└── Can access admin dashboard

super_admin
└── All permissions (future expansion)
```

### Plan-Based Rate Limiting
```
Free Plan
├── Max 10 concurrent jobs
├── Max 100 jobs per month
└── Limited to basic features

Pro Plan
├── Max 100 concurrent jobs
├── Max 1000 jobs per month
└── Priority processing

Enterprise Plan
├── Max 500 concurrent jobs
├── Unlimited jobs
└── Custom limits & features
```

## Data Security

### In Transit
- **HTTPS Required**: All production traffic over TLS 1.2+
- **API Header**: `x-api-key` encrypted in transport
- **Database**: Redis connection uses `rediss://` (TLS) or REST API over HTTPS

### At Rest
- **Redis Encryption**: Upstash Redis encrypts data at rest
- **No Plaintext Passwords**: API keys never stored as plaintext
- **Job Data**: User emails stored only as long as needed (24-48 hour TTL)

### Access Control
- **Admin Credential**: Stored only in environment variable (never in code)
- **Sensitive Data**: Not logged in production (debug logging removed)
- **Error Messages**: Don't expose sensitive information
- **Rate Limit Data**: Isolated per user

## Input Validation

### API Endpoint Validation

#### POST /api/search
```typescript
Required fields:
- query: string (1-500 chars)
- pages: number (1-10 pages max)

Validation:
- Query length checked (prevents DoS)
- Pages range enforced (max 10 pages)
- URLs escaped before processing
```

#### Other Endpoints
- All endpoints validate input before processing
- JSON parsing wrapped in try-catch
- No eval() or dangerous string operations
- Regex patterns used safely (no ReDoS patterns)

### Output Validation
- Admin endpoints return filtered data
- Sensitive fields removed from responses
- Rate limit details exposed only to authenticated users

## SQL Injection & NoSQL Injection Prevention

### No SQL Database Used
- **System Uses**: Redis (key-value store, not SQL)
- **No Query Language**: Redis uses simple SET/GET operations
- **No Parameterization Needed**: Direct key-value operations safer than SQL

### Redis Commands
- All Redis operations use safe client library (@upstash/redis)
- Keys are constructed safely: `jobs:{jobId}`, `users:{userId}:usage`
- No user input in key construction without sanitization

## Cross-Site Scripting (XSS) Prevention

### React Components
- **JSX Escaping**: React auto-escapes all string content
- **sanitize-html**: Used if rendering user HTML (not current)
- **No dangerouslySetInnerHTML**: Not used anywhere

### Server-Side Rendering
- **Response Type**: JSON (not HTML)
- **Content-Type**: application/json header prevents XSS

## Cross-Site Request Forgery (CSRF) Protection

### API Design
- **Stateless APIs**: No session cookies
- **API Key Required**: Cannot be forged from browser
- **POST/PUT/DELETE**: Require valid API key
- **Origin Checks**: Not needed (API key is sufficient)

## Distributed Denial of Service (DDoS) Protection

### Rate Limiting by Plan
- Free: 10 concurrent jobs
- Pro: 100 concurrent jobs
- Enterprise: 500 concurrent jobs

### Queue Backpressure
- Max 1000 jobs queued
- New jobs rejected if queue full
- Returns HTTP 429 Too Many Requests

### Timeout Protection
- HTTP fetch: 5 second timeout
- Puppeteer: 15 second timeout
- Job processing: 20 second timeout

## Credential & Secret Management

### Environment Variables
- **ADMIN_CREDENTIAL**: Keep secret, rotate regularly
- **REDIS_URL**: Keep secret (contains password)
- **STRIPE_API_KEY**: Keep secret, use separate test/live keys
- **GOOGLE_API_KEY**: Restrict to specific referrers

### No Secrets in Code
- No hardcoded credentials
- No credentials in comments
- No credentials in git history
- `.env.local` is gitignored

### Secrets Rotation
1. Generate new secret
2. Deploy code update
3. Verify new secret works
4. Deactivate old secret
5. Monitor for failures

## Stripe Webhook Security

### Signature Verification
```typescript
// Verify webhook signature before processing
const event = stripe.webhooks.constructEvent(
  body,
  header,
  STRIPE_WEBHOOK_SECRET
);
```

### Webhook Events Handled
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`

## Logging & Monitoring

### What NOT to Log
- ~~API keys or credentials~~ (removed)
- Passwords or sensitive data
- Personal identification details
- Complete request/response bodies (unless truncated)

### What TO Log
- Request timestamp, method, path
- Response status code
- Execution time (for performance)
- Error messages (without sensitive data)
- Job completion status

### Log Retention
- Production logs: 7 days retention
- Archive logs: 30 days
- Failed job logs: 48 hours (for debugging)

## Threat Model

### Threat 1: Unauthorized API Access
**Threat**: Attacker uses invalid or stolen API key
**Mitigation**:
- API key validation on every request
- 401 Unauthorized response
- Rate limiting by user/key
- Recommended: API key rotation policy

### Threat 2: Privilege Escalation
**Threat**: Regular user gains admin access
**Mitigation**:
- Admin role hardcoded in credential validation
- No way to change role via API
- Admin credential stored separately from user keys

### Threat 3: Resource Exhaustion
**Threat**: Attacker submits 1000s of jobs to exhaust resources
**Mitigation**:
- Queue size limited to 1000 jobs
- Per-user rate limiting by plan
- Backpressure detection
- HTTP 429 response when quota exceeded

### Threat 4: Data Breach
**Threat**: Attacker gains access to Redis
**Mitigation**:
- Redis over TLS (`rediss://`)
- Upstash encryption at rest
- Job data has short TTL (24-48 hours)
- No passwords stored in jobs

### Threat 5: Denial of Service
**Threat**: Attacker sends massive traffic to API
**Mitigation**:
- Vercel's global CDN protection
- Rate limiting by plan
- Timeout protection on all operations
- Queue backpressure limits

### Threat 6: Man-in-the-Middle Attack
**Threat**: Attacker intercepts API key in transit
**Mitigation**:
- HTTPS/TLS required for all production traffic
- API Gateway encryption
- Recommended: Use VPN or private endpoints for enterprise

### Threat 7: Worker Process Compromise
**Threat**: Attacker gains access to worker that processes jobs
**Mitigation**:
- Worker runs with minimal permissions
- Access only to Redis (no filesystem access)
- Graceful shutdown prevents corruption
- Failed jobs logged for investigation

## Security Best Practices

### For Operators
1. **Rotate Admin Credential** - At least quarterly
2. **Monitor API Usage** - Check for unusual patterns
3. **Update Dependencies** - Run `npm audit` regularly
4. **Backup Redis** - Enable Upstash backup
5. **Review Logs** - Check for suspicious access patterns
6. **Use HTTPS Only** - Redirect HTTP to HTTPS
7. **Restrict Admin Access** - Only give to trusted users
8. **Enable MFA** - For Stripe & Vercel accounts

### For API Users
1. **Protect API Key** - Don't commit to git, use env vars
2. **Use Rate Limiting** - Respect HTTP 429 responses
3. **Rotate Keys** - Regularly generate new keys
4. **Monitor Usage** - Check dashboard for anomalies
5. **Report Issues** - Contact support immediately if compromised
6. **Use HTTPS** - Always transmit API key securely
7. **Plan for Quota** - Design within rate limits

## Incident Response

### If API Key Compromised
1. Immediately generate new key in dashboard
2. Delete old key from API settings
3. Update all systems using old key
4. Check usage logs for unauthorized access
5. Monitor for unusual activity

### If Admin Credential Compromised
1. Immediately change `ADMIN_CREDENTIAL` in production
2. Redeploy application with new value
3. Review admin logs for unauthorized access
4. Reset rate limits for affected users if needed
5. Contact all administrators

### If Redis Breached
1. Assume all data exposed
2. Create new Redis instance (Upstash)
3. Update `REDIS_URL` in production
4. Redeploy application
5. Clear cache and restart workers
6. Notify users to change passwords/keys

## Compliance

### GDPR
- User data (emails) deleted after 24-48 hours (short retention)
- No personal data shared with third parties
- Users can request data deletion

### CCPA
- California users have data access rights
- Can delete their extraction jobs
- Can opt-out of processing

### SOC 2 (Recommended)
- Implement audit logging
- Document security procedures
- Regular security reviews
- Incident response plan

## Security Checklist for Deployment

- [ ] All required environment variables set
- [ ] HTTPS enabled for all traffic
- [ ] Admin credential rotated
- [ ] Redis connection over TLS
- [ ] Stripe webhook signature verified
- [ ] Rate limiting configured per plan
- [ ] Logs not containing sensitive data
- [ ] Error messages don't expose internals
- [ ] API keys validated on every request
- [ ] Admin routes require auth
- [ ] Backup strategy in place
- [ ] Monitoring & alerting configured
- [ ] Incident response plan documented
- [ ] Security audit performed
