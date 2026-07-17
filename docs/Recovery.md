# Email Extraction Platform - Disaster Recovery Plan

## Overview

This document outlines procedures for recovering from various disaster scenarios.

**Recovery Time Objective (RTO)**: 1 hour
**Recovery Point Objective (RPO)**: 15 minutes

---

## Disaster Scenarios

### Scenario 1: Complete Redis Data Loss

**Severity**: CRITICAL
**Impact**: All jobs lost, queue reset
**Detection**: 
- API returns Redis connection error
- Queue health endpoint fails
- Worker cannot process jobs

**Recovery Procedure**:

**Step 1: Assess Scope** (5 min)
```bash
# Check if any data remains
redis-cli PING
redis-cli INFO

# If cannot connect, Redis is down
# If connects but empty, data was purged
```

**Step 2: Restore from Backup** (10 min)
```bash
# If Upstash backup available:
# 1. Login to Upstash dashboard
# 2. Navigate to your database
# 3. Click "Backups" tab
# 4. Select backup from 15 minutes ago
# 5. Click "Restore"
# 6. Confirm restoration
# 7. Wait 2-5 minutes for completion
```

**Step 3: Verify Restoration** (5 min)
```bash
# Test connection
redis-cli PING

# Check queue size
curl https://api.yourdomain.com/api/admin/queue/health
```

**Step 4: Resume Operations** (5 min)
```bash
# Restart workers
docker restart email-extraction-worker

# Monitor restoration
watch 'curl -s https://api.yourdomain.com/api/admin/queue/health | jq'
```

**Step 5: Notify Users** (ongoing)
- Send status update to all users
- Explain data loss scope
- Recommend retrying affected searches

**Total Recovery Time**: ~30 minutes

---

### Scenario 2: API Service (Vercel) Down

**Severity**: HIGH
**Impact**: Users cannot access API or dashboard
**Detection**:
- All API endpoints return 5xx errors
- Dashboard returns 5xx errors
- Health checks fail

**Recovery Procedure**:

**Step 1: Diagnose** (2 min)
```bash
# Check Vercel status
curl https://status.vercel.com/api/v2/status.json

# Check our deployment
vercel logs --prod

# Check environment variables
# Vercel dashboard → Settings → Environment Variables
```

**Step 2: Verify Recent Deployment** (3 min)
```bash
# Check deployment history
vercel deployments

# Look for failed deployment
# If recent deploy failed, rollback
vercel rollback
```

**Step 3: Manual Deploy** (5 min)
```bash
# If rollback doesn't work
git checkout stable-branch
vercel --prod --force
```

**Step 4: Verify Recovery** (2 min)
```bash
# Test endpoints
curl https://api.yourdomain.com/api/auth/me \
  -H "x-api-key: test-key"

# Should return 200 (or 401 with valid error)
```

**Step 5: Notify** (immediate)
- Post status page update
- Send Slack/email notification
- Monitor for any continued issues

**Total Recovery Time**: ~12 minutes

---

### Scenario 3: Worker Process Crash

**Severity**: MEDIUM
**Impact**: Jobs not processing, queue builds up
**Detection**:
- Worker pod/container not running
- Queue metrics show no processing jobs
- Jobs stuck in pending state

**Recovery Procedure**:

**Step 1: Diagnose** (2 min)
```bash
# Check process status
docker ps | grep worker

# Check logs
docker logs email-extraction-worker | tail -50

# Check queue size
curl https://api.yourdomain.com/api/admin/queue/health
```

**Step 2: Restart** (1 min)
```bash
# Simple restart
docker restart email-extraction-worker

# Or forceful restart
docker kill email-extraction-worker
docker run -d ... email-extraction-worker
```

**Step 3: Verify** (1 min)
```bash
# Check process running
docker ps | grep worker

# Watch queue process jobs
watch 'curl -s https://api.yourdomain.com/api/admin/queue/health | jq .pending'
```

**Step 4: Investigate Root Cause** (ongoing)
```bash
# Check logs for error pattern
docker logs email-extraction-worker | grep ERROR | head -20

# Common issues:
# - Memory exhausted: Increase container memory
# - Redis connection timeout: Check Redis status
# - Browser hang: Increase timeout or reduce concurrency
```

**Total Recovery Time**: ~5 minutes

---

### Scenario 4: Connection Quota Exceeded (Google Search API)

**Severity**: MEDIUM
**Impact**: Search endpoint returns errors
**Detection**:
- Errors mentioning "quota exceeded"
- Jobs fail with API error

**Recovery Procedure**:

**Step 1: Verify Quota Status** (2 min)
```bash
# Check Google Cloud Console
# https://console.cloud.google.com/
# APIs & Services → Quotas
# Search for "Programmable Search API"
```

**Step 2: Increase Quota** (5 min)
```bash
# If using free tier:
# Quota: 100 queries/day
# Options:
# 1. Wait until quota resets (next day)
# 2. Upgrade to paid plan
# 3. Create separate Google CX IDs to distribute load

# To upgrade:
# Google Cloud Console → APIs → Programmable Search API → Enable Billing
```

**Step 3: Implement Workaround** (ongoing)
```bash
# Temporary: Rate-limit requests
# config: REQUEST_DELAY_MS=1000 (1 second between requests)

# Medium-term: Add multiple Google CX IDs
# Rotate between them to distribute quota
```

**Total Recovery Time**: Depends on upgrade (immediate if paid account)

---

### Scenario 5: Admin Credential Compromised

**Severity**: CRITICAL (Security)
**Impact**: Unauthorized admin access possible
**Detection**:
- Unusual activity in admin logs
- Changes to rate limits or settings
- Suspicious jobs created

**Recovery Procedure**:

**Step 1: Immediate Response** (1 min)
```bash
# Generate new random credential
NEW_CREDENTIAL=$(openssl rand -base64 32)

# Update environment variable
# Vercel: Settings → Environment Variables → ADMIN_CREDENTIAL → Update to NEW_CREDENTIAL
```

**Step 2: Deploy** (1 min)
```bash
# Vercel auto-deploys on env var change
# No manual deploy needed
# Takes ~30 seconds

# Verify
curl https://api.yourdomain.com/api/admin/dashboard \
  -H "x-api-key: $NEW_CREDENTIAL"
```

**Step 3: Audit** (30 min)
```bash
# Review admin logs for unauthorized actions
# Check if any rates limits were changed
# Review job access patterns

# Identify what was accessed
# Notify affected users if needed
```

**Step 4: Secure Old Credential** (ongoing)
- Remove from all local machines
- Remove from documentation
- Remove from version control history
- Inform team of new credential

**Total Recovery Time**: ~5 minutes + audit time

---

### Scenario 6: Data Breach (Emails Exposed)

**Severity**: CRITICAL
**Impact**: User data compromised
**Detection**:
- Unauthorized Redis access
- External data exposure discovered

**Recovery Procedure**:

**Step 1: Contain** (immediate)
```bash
# Option 1: Stop all operations
# Scale workers to 0
kubectl scale deployment email-extraction-worker --replicas=0

# Option 2: Change Redis credentials
# In Upstash: Settings → Database Credentials → Rotate
```

**Step 2: Investigate** (1-4 hours)
```bash
# 1. Determine what data was exposed
# 2. Identify how breach occurred
# 3. Identify affected users
# 4. Timeline of access

# Questions:
# - Which email addresses were exposed?
# - How many jobs were affected?
# - For how long?
# - Who had access?
```

**Step 3: Notify** (6-24 hours)
```bash
# Comply with GDPR (24 hours), CCPA (as soon as possible)
# Send notification to all affected users
# Include:
# - What data was exposed
# - When it was exposed
# - What you're doing about it
# - What users should do
```

**Step 4: Remediate** (1-7 days)
```bash
# 1. Patch security vulnerability
# 2. Deploy fix
# 3. Rotate all credentials
# 4. Enable enhanced monitoring
# 5. Implement additional security

# Example fixes:
# - If Redis exposed: Change REDIS_URL
# - If API compromised: Rotate API keys
# - If worker compromised: Wipe and redeploy
```

**Step 5: Communicate** (ongoing)
- Update status page
- Send regular updates
- Provide credit monitoring if appropriate
- Document incident for future prevention

**Total Recovery Time**: Depends on breach scope (days to weeks)

---

## Backup & Restore Procedures

### Redis Backup Strategy

**Current**: Automatic daily backups via Upstash
- Retention: 7 days
- Frequency: Daily
- Location: Upstash encrypted storage

**Verify Backups Working**
```bash
# Login to Upstash dashboard
# Navigate to database
# Click "Backups" tab
# Should see daily backup history

# If no backups:
# 1. Enable: Database → Settings → Backups → Enable
# 2. Wait 24 hours for first backup
```

### Manual Backup (If Needed)

```bash
# Full data export
redis-cli BGSAVE

# Or via Upstash API
curl https://api.upstash.com/backup -H "Authorization: Bearer $API_KEY"
```

### Restore Process

```bash
# Via Upstash dashboard:
# 1. Dashboard → Backups
# 2. Click backup timestamp
# 3. Confirm restore
# 4. Wait 2-5 minutes
# 5. Reconnect and verify

# Via API
curl -X POST https://api.upstash.com/backup/{backup_id}/restore \
  -H "Authorization: Bearer $API_KEY"
```

---

## Testing Disaster Recovery

### Quarterly DR Drills

**Test Scenario**: Redis Restore
```bash
# 1. Document current state
# 2. Restore from backup
# 3. Verify data integrity
# 4. Run test jobs
# 5. Document findings
# 6. Update procedures if needed

# Estimated time: 1-2 hours
# Schedule: Quarterly (every 3 months)
```

### Annual Full Disaster Recovery Test
```bash
# Simulate complete failure:
# 1. Stop API (take offline)
# 2. Stop workers
# 3. Wipe Redis
# 4. Restore from backup
# 5. Restart all services
# 6. Verify functionality
# 7. Document recovery time

# Estimated time: 4-6 hours
# Schedule: Annually (once per year)
```

---

## Communication Plan

### Incident Severity Levels

**Level 1 (Low)**
- Minor features unavailable
- < 1% user impact
- Notification: Update status page

**Level 2 (Medium)**
- Key features unavailable
- 1-10% user impact
- Notification: Email + status page + Slack

**Level 3 (High)**
- Majority of users affected
- > 10% impact
- Notification: All channels + phone call to key customers

**Level 4 (Critical)**
- Complete service outage
- All users affected
- Notification: All channels + media contact if needed

### Status Page Updates

**Template**:
```
INCIDENT: [Name]
SEVERITY: [Level]
STATUS: [Investigating/Identified/Mitigating/Resolved]
TIME: Started [time], Updated [time]

SUMMARY:
- Impact: [Who is affected, what's broken]
- Cause: [Root cause if known]
- Action: [What we're doing about it]
- ETA: [Estimated time to resolution, if known]

UPDATES:
- [Time]: Initial report
- [Time]: Root cause identified
- [Time]: Fix deployed
- [Time]: Verified resolved
```

---

## Documentation & Learning

### Post-Incident Review

After any significant incident:
1. Document what happened
2. Document recovery time
3. Document root cause
4. Document improvements needed
5. Schedule follow-up (if needed)

### Update Procedures

- Update this document if procedures changed
- Share learnings with team
- Schedule training if needed
- Test updated procedures

---

## Key Contacts

Create and maintain:
- [ ] Emergency escalation phone numbers
- [ ] Vendor support contacts (Upstash, Vercel, Google)
- [ ] Key team members and their roles
- [ ] Incident commander procedures

---

## Automation Opportunities

Consider automating:
1. **Automated failover** - Switch to backup Redis automatically
2. **Auto-healing workers** - Restart failed workers automatically
3. **Automated rollback** - Rollback failed deployments automatically
4. **Health checks** - Continuous monitoring with alerting
5. **Backup verification** - Automated backup integrity checks

---

## Recovery Time Targets

| Scenario | RTO | RPO |
|----------|-----|-----|
| Redis data loss | 30 min | 15 min |
| API down | 12 min | 0 min |
| Worker down | 5 min | 0 min* |
| Quota exceeded | Varies | N/A |
| Credential compromised | 5 min | N/A |
| Data breach | 4-24 hours | N/A |

*Jobs in progress may be lost, but no permanent data loss
