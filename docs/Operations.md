# Email Extraction Platform - Operations Guide

## Daily Operations

### Morning Checklist
1. **System Health**
   ```bash
   curl https://api.yourdomain.com/api/admin/queue/health
   ```
   - Verify queue is not in backpressure
   - Check failure rate < 1%
   - Confirm processing jobs count reasonable

2. **Error Review**
   - Check logs for any critical errors
   - Review failed jobs in admin dashboard
   - Check error tracking service (Sentry, etc.)

3. **Performance Check**
   - Average response time < 200ms
   - p99 latency < 1s
   - No memory leaks

### Evening Tasks
1. **Capacity Planning**
   - Review job queue size trends
   - Check worker utilization
   - Plan scaling if needed

2. **Backups**
   - Verify Redis backups completed
   - Check backup status in Upstash dashboard

---

## Monitoring Dashboard Setup

### Key Metrics to Monitor

```
Queue Health:
├── Pending jobs: Target < 100 (indicates bottleneck if higher)
├── Processing jobs: Target 1-5 (depending on worker count)
├── Completed jobs: Track daily/weekly trends
├── Failed jobs: Should be < 1% of total
├── Failure rate: Alert if > 5%
└── Backpressure: Alert immediately if true

Performance:
├── API latency (p50, p95, p99)
├── Job processing time (avg, max)
├── Worker utilization (%)
├── CPU usage per worker
└── Memory usage per worker

Billing:
├── Monthly API calls
├── User quota usage
├── Revenue by plan
└── Churn rate

Infrastructure:
├── Redis connection status
├── Worker process status
├── Disk usage
└── Network throughput
```

### Recommended Tools

1. **Vercel Analytics**
   - Built-in, no setup needed
   - Provides performance metrics

2. **Sentry**
   - Error tracking
   - Crash reporting
   - Performance monitoring

3. **DataDog or New Relic**
   - Full infrastructure monitoring
   - Custom dashboards
   - Advanced alerting

---

## Common Tasks

### Restart Worker Process

```bash
# If using Vercel + separate container:
# Option 1: Kill and restart
docker stop email-extraction-worker
docker start email-extraction-worker

# Option 2: Force restart (more aggressive)
docker kill email-extraction-worker
docker run -d ... email-extraction-worker

# Option 3: Kubernetes
kubectl rollout restart deployment/email-extraction-worker

# Option 4: ECS
aws ecs update-service \
  --cluster production \
  --service email-extraction-worker \
  --force-new-deployment
```

### Check Job Status

```bash
# View specific job
curl https://api.yourdomain.com/api/job/{jobId}/status \
  -H "x-api-key: your-api-key"

# View all pending jobs
curl 'https://api.yourdomain.com/api/jobs?status=pending&limit=10' \
  -H "x-api-key: admin-credential"

# View failed jobs
curl 'https://api.yourdomain.com/api/jobs?status=failed&limit=10' \
  -H "x-api-key: admin-credential"
```

### Rotate Admin Credential

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update environment variable
# Via Vercel: Settings → Environment Variables → ADMIN_CREDENTIAL → Update
# Via Docker: Update ADMIN_CREDENTIAL in deployment config

# 3. Redeploy application
# Vercel: Auto-deploys on env var change
# Docker: Manual restart required

# 4. Verify new credential works
curl https://api.yourdomain.com/api/admin/dashboard \
  -H "x-api-key: $NEW_SECRET"

# 5. Old credential stops working immediately
```

### Update Rate Limits

```bash
# Update in environment variables:
RATE_LIMIT_FREE=20
RATE_LIMIT_PRO=200
RATE_LIMIT_ENTERPRISE=1000

# Redeploy
# Changes take effect immediately on next request
```

### Clear Failed Jobs

```bash
# Via Redis CLI:
redis-cli DEL "jobs:failed"

# Via curl (recommend instead of direct Redis access):
curl -X DELETE https://api.yourdomain.com/api/admin/jobs/clear-failed \
  -H "x-api-key: admin-credential"
# (Note: This endpoint would need to be implemented if needed)
```

---

## Incident Response

### Incident: High Error Rate (>5%)

**Step 1: Assess Severity**
```bash
# Check queue health
curl https://api.yourdomain.com/api/admin/queue/health

# Check recent errors
grep ERROR /var/log/email-extraction-worker.log | tail -20
```

**Step 2: Identify Cause**
- Check Redis connectivity
- Check Google API quota
- Check Stripe API status
- Check worker process status

**Step 3: Mitigate**
```bash
# Option 1: Restart worker
docker restart email-extraction-worker

# Option 2: Scale down if memory issues
kubectl scale deployment email-extraction-worker --replicas=1

# Option 3: Clear queue (last resort)
redis-cli FLUSHDB  # WARNING: Clears all data!
```

**Step 4: Verify**
```bash
# Submit test job
curl -X POST https://api.yourdomain.com/api/search \
  -H "x-api-key: test-key" \
  -d '{"query":"test", "pages":1}'

# Check result after 30 seconds
curl https://api.yourdomain.com/api/jobs/latest \
  -H "x-api-key: test-key"
```

### Incident: Queue Backpressure (Queue Full)

**Step 1: Identify the Cause**
```bash
# Check worker status
docker ps | grep worker

# Check if worker is stuck
docker logs email-extraction-worker | tail -50

# Check queue size
curl https://api.yourdomain.com/api/admin/queue/health \
  -H "x-api-key: admin-credential"
```

**Step 2: Increase Capacity**
```bash
# Option 1: Increase worker concurrency
WORKER_CONCURRENCY=10

# Option 2: Add more worker instances
kubectl scale deployment email-extraction-worker --replicas=5

# Option 3: Optimize extraction speed
# Review job timeout, may be too long
```

**Step 3: Drain Queue**
```bash
# Allow queue to process by scaling up workers
# Monitor progress
watch -n 5 'curl -s https://api.yourdomain.com/api/admin/queue/health | jq'
```

### Incident: Redis Connection Failed

**Step 1: Diagnose**
```bash
# Test connection from local
redis-cli -u rediss://... PING

# Check REDIS_URL environment variable
echo $REDIS_URL
```

**Step 2: Failover**
```bash
# If using Upstash:
# 1. Check Upstash dashboard for status
# 2. Wait for auto-recovery (usually < 1 minute)
# 3. If persistent, create new Redis instance
# 4. Update REDIS_URL to new instance
# 5. Redeploy application

# During outage: New jobs queue locally (not ideal, but queued)
```

**Step 3: Recover Data**
```bash
# Restore from backup (if available)
# Upstash: Dashboard → Backups → Restore
```

---

## Scaling Guide

### Vertical Scaling (More Powerful Machine)

**Increase Resources Per Worker**
```bash
# Update Kubernetes resources
# In deployment.yaml
resources:
  requests:
    memory: "1Gi"    # Increase from 512Mi
    cpu: "1000m"     # Increase from 500m
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

### Horizontal Scaling (More Workers)

**Add More Worker Instances**
```bash
# Kubernetes
kubectl scale deployment email-extraction-worker --replicas=10

# Docker Compose
docker-compose up --scale worker=10 -d

# ECS
aws ecs update-service --desired-count 10 ...
```

**Monitor Impact**
```bash
# Watch queue clear
watch 'curl -s https://api.yourdomain.com/api/admin/queue/health | jq .pending'

# Expected: Queue decreases, processing time improves
```

### Database Scaling

**Redis Scaling**
- Upstash handles automatically
- Use larger tier if needed: Upstash dashboard → Upgrade

---

## Backup & Recovery

### Backup Strategy

**Redis Backups**
```bash
# Automated via Upstash
# Enable in dashboard: Settings → Backups
# Daily backups, 7-day retention

# Manual backup (if needed)
redis-cli BGSAVE
```

**Configuration Backups**
```bash
# Export environment variables
# In Vercel: Settings → Environment Variables → (export manually)
# In Docker: Store docker-compose.yml in version control
```

### Restore Procedure

**Step 1: Restore Redis**
```bash
# Via Upstash dashboard:
# 1. Navigate to Backups
# 2. Select backup point
# 3. Confirm restore
# 4. Takes 2-5 minutes
```

**Step 2: Verify Data**
```bash
curl https://api.yourdomain.com/api/admin/queue/health \
  -H "x-api-key: admin-credential"

# Should show restored job counts
```

**Step 3: Resume Operations**
```bash
# Restart workers if needed
docker restart email-extraction-worker

# Monitor recovery
tail -f /var/log/email-extraction-worker.log
```

---

## Performance Tuning

### Database Optimization

**Reduce Query Count**
- Current: Single query per Redis operation (optimal)
- No further optimization needed

**Optimize Connection Pool**
```bash
# Current: @upstash/redis with pool
# Already optimized for REST API + direct connection fallback
```

### Worker Optimization

**Current Settings**
```
- WORKER_CONCURRENCY: 1 (configurable, increase for more throughput)
- Browser timeout: 15 seconds (can reduce if sites load fast)
- Max concurrent browsers: 3 (can increase for more resources)
```

**Tune for Your Workload**
```bash
# If latency high, CPU available:
WORKER_CONCURRENCY=5

# If latency high, but memory constrained:
# Reduce MAX_CONCURRENT_BROWSERS in worker code
# Or add more worker instances instead
```

### API Optimization

**Current**: Vercel serverless (auto-optimized)
- Cold starts: ~500ms (one-time)
- Warm responses: < 100ms
- No further optimization needed (Vercel handles)

---

## Maintenance Windows

### Planned Maintenance

**Minimize Downtime**
```bash
# 1. Increase worker capacity before maintenance
kubectl scale deployment email-extraction-worker --replicas=10

# 2. Let queue build up (jobs queue up)
# 3. Stop accepting new jobs (optional)
# 4. Perform maintenance
# 5. Restart services
# 6. Monitor queue drain

# Total downtime for API: Can be minutes (using blue-green deploy)
# Job processing: Can pause for hours during maintenance
```

**Update Dependencies**
```bash
# Development
npm update
npm audit
git push

# Vercel auto-deploys
# No manual action needed
```

---

## Disaster Recovery

### Data Loss Scenario

**Complete Data Loss**
1. Create new Redis instance
2. Update REDIS_URL
3. Redeploy application
4. Notify users (jobs lost)
5. Recommend retrying searches

### Service Failure Scenario

**API Down**
1. Check Vercel status
2. Verify environment variables
3. Restart via Vercel dashboard
4. If persistent, rollback deployment

**Worker Down**
1. Restart worker process: `docker restart ...`
2. Check logs for errors
3. If errors, rollback code
4. Jobs will reprocess with automatic retry

---

## Documentation

### Keep Updated
- Update this doc when procedures change
- Document new operational tasks
- Share with team members
- Review quarterly

### Runbook Template

Create runbooks for:
- Common incidents
- Maintenance procedures
- Scaling operations
- Backup & restore

Example format:
```
# Incident: [Name]
## Symptoms
## Diagnosis
## Resolution
## Prevention
## Escalation
```
