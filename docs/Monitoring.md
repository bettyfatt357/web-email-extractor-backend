# Email Extraction Platform - Monitoring Guide

## Monitoring Strategy

**Approach**: Proactive monitoring + reactive alerts
**Tools**: Vercel built-in + optional (Sentry, DataDog)
**Alert**: Notify on-call when issues detected

---

## Key Metrics to Monitor

### Queue Metrics

**Pending Jobs Count**
- **Metric**: Number of jobs waiting to be processed
- **Healthy Range**: 0-100
- **Warning**: > 100 (bottleneck developing)
- **Critical**: > 500 (severe bottleneck)
- **Action**: Scale up workers

**Processing Jobs Count**
- **Metric**: Number of jobs currently being processed
- **Healthy Range**: 1-10 (depends on worker count)
- **Warning**: 0 for > 5 minutes (workers not running)
- **Critical**: 0 for > 15 minutes (workers crashed)
- **Action**: Restart worker process

**Completed Jobs (24h)**
- **Metric**: Jobs successfully completed
- **Healthy Range**: > 50 per day (varies)
- **Warning**: 0 for > 1 hour (no completions)
- **Action**: Check queue and worker status

**Failed Jobs**
- **Metric**: Failed job count in last 24 hours
- **Healthy Range**: < 1% of total
- **Warning**: > 1% failure rate
- **Critical**: > 5% failure rate
- **Action**: Investigate errors in logs

**Backpressure Flag**
- **Metric**: Queue size > 1000 jobs
- **Healthy Range**: False
- **Warning**: True (queue building up)
- **Critical**: True for > 30 minutes
- **Action**: Scale workers immediately

### Performance Metrics

**API Response Time (p50)**
- **Target**: < 100ms
- **Warning**: > 200ms
- **Critical**: > 1s
- **Action**: Check rate limiting, database load

**API Response Time (p99)**
- **Target**: < 500ms
- **Warning**: > 1s
- **Critical**: > 3s
- **Action**: Investigate slow requests

**Job Processing Time (average)**
- **Metric**: Average time from job start to completion
- **Target**: < 30 seconds
- **Warning**: > 60 seconds
- **Critical**: > 300 seconds
- **Action**: Check browser timeouts, network

**Error Rate (APIs)**
- **Metric**: Percentage of requests returning 5xx
- **Target**: < 0.1%
- **Warning**: > 1%
- **Critical**: > 5%
- **Action**: Check error logs

### Infrastructure Metrics

**Redis Connection Status**
- **Metric**: Can connect to Redis
- **Healthy**: Connected
- **Warning**: Connection timeout
- **Critical**: Connection refused
- **Action**: Check Redis instance, REDIS_URL

**Worker Process Status**
- **Metric**: Worker process running
- **Healthy**: Running
- **Warning**: CPU > 80%
- **Critical**: Process crashed
- **Action**: Restart worker, investigate crash

**Memory Usage (Worker)**
- **Metric**: RAM used by worker
- **Target**: < 512MB
- **Warning**: > 1GB
- **Critical**: > 1.5GB (approaching limit)
- **Action**: Check for memory leak, restart worker

**CPU Usage (Worker)**
- **Metric**: CPU utilization
- **Target**: 20-60%
- **Warning**: > 80%
- **Critical**: 100% sustained
- **Action**: Increase concurrency or worker count

---

## Monitoring Setup

### Vercel Built-in Monitoring

**Access**: Dashboard → Deployments → Select deployment → Analytics

**Available Metrics**:
- Response time by endpoint
- Error rate
- Request count
- Regional performance
- Traffic patterns

**Setup Time**: None (automatic)
**Cost**: Included in Vercel plan

### Sentry Error Tracking (Recommended)

**Setup**:
```bash
# 1. Create Sentry account at sentry.io
# 2. Create project for Next.js
# 3. Install SDK
npm install @sentry/nextjs

# 4. Initialize in app
# Next.js auto-initializes if env var set
# In Vercel: Settings → Environment Variables
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

**Features**:
- Error tracking
- Crash reporting
- Performance monitoring
- Release tracking
- Alerts

**Cost**: Free tier available (limited)

### DataDog Monitoring (Enterprise)

**Setup**:
```bash
# 1. Create DataDog account
# 2. Install agent
npm install dd-trace

# 3. Initialize
const tracer = require('dd-trace').init()

# 4. Set environment variables
DATADOG_SITE=datadoghq.com
DATADOG_API_KEY=your-key
```

**Features**:
- Full infrastructure monitoring
- Custom dashboards
- Advanced alerting
- APM (Application Performance Monitoring)

**Cost**: Paid (no free tier)

---

## Health Check Endpoints

### Liveness Check

```bash
# Endpoint should be responsive
curl https://api.yourdomain.com/api/auth/me

# Expected: 401 (valid error) or 200 (if valid key)
# Not expected: 5xx error, no response
```

### Readiness Check

```bash
# Queue health should show metrics
curl https://api.yourdomain.com/api/admin/queue/health \
  -H "x-api-key: admin-credential"

# Expected: 200 with JSON metrics
# Not expected: 5xx, connection error, Redis error
```

### Custom Health Endpoint (Recommended)

```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    // Check Redis connection
    const redis = createRedisClient();
    await redis.ping();
    
    // Check configuration
    if (!process.env.ADMIN_CREDENTIAL) {
      throw new Error('Missing ADMIN_CREDENTIAL');
    }
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        redis: 'ok',
        config: 'ok',
      }
    });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 503 });
  }
}
```

---

## Alerting Strategy

### Alert Channels

1. **Email**: Critical incidents
2. **Slack**: All incidents + daily digest
3. **PagerDuty**: On-call escalation (optional)
4. **SMS**: Critical incidents (optional)

### Alert Configuration

**Critical Alerts** (Immediate notification)
- Redis offline
- API error rate > 5%
- Worker crashed
- Admin credential compromised

**Warning Alerts** (Daily digest or next check)
- Queue backpressure
- Error rate > 1%
- Response time p99 > 1s
- Memory > 80%

**Info Alerts** (Daily summary)
- Daily job count
- Daily revenue/usage
- Deploy notifications

### Example Alert Rules

**Sentry Alert**:
```
Condition: New issue
Action: Send email + Slack notification
When: Any unhandled exception in production
```

**DataDog Alert**:
```
Metric: http.requests.errors
Condition: > 5% error rate
Duration: 5 minutes sustained
Action: PagerDuty page + email
```

**Vercel Alert**:
```
Metric: Function error rate
Condition: > 1%
Duration: 10 minutes
Action: Email notification
```

---

## Dashboards

### Vercel Analytics Dashboard

Shows:
- Request rate
- Error rate
- Response times
- Top endpoints
- Regional breakdown

Access: Vercel Dashboard → Analytics

### Custom Monitoring Dashboard (Recommended)

**Create dashboard showing**:
- Queue metrics (pending, processing, completed, failed)
- API response times (p50, p95, p99)
- Error rate
- Worker status
- Redis connection
- Daily trends

**Tools**:
- Sentry: Built-in dashboards
- DataDog: Custom dashboards
- Grafana: Free alternative
- Google Data Studio: Free alternative

---

## Performance Baselines

### Expected Performance

| Metric | Baseline | Target |
|--------|----------|--------|
| API response time (p50) | 50ms | < 100ms |
| API response time (p95) | 200ms | < 500ms |
| API response time (p99) | 500ms | < 1s |
| Job processing time | 20s | < 30s |
| Error rate | 0.05% | < 1% |
| Availability | 99.9% | > 99.9% |

### Historical Metrics

Track over time:
- Monthly job volume
- Monthly revenue
- Error rate trends
- Performance trends
- Uptime percentage

---

## Monitoring During Incidents

### Incident Response Monitoring

When incident detected:

1. **Immediate** (First 2 minutes)
   - Gather data on affected users/jobs
   - Check error rate and response times
   - Verify worker status
   - Check Redis connectivity

2. **Investigation** (First 10 minutes)
   - Review error logs (last 5 minutes)
   - Check for recent deployments
   - Review resource usage
   - Identify affected customers

3. **Resolution** (Ongoing)
   - Monitor recovery metrics
   - Verify fix working
   - Check error rate decreasing
   - Confirm no new errors

4. **Post-Incident** (After resolution)
   - Compare baseline metrics
   - Document incident timeline
   - Identify improvements
   - Update alerting if needed

---

## Monitoring Best Practices

### Set Realistic Thresholds
- Don't alert on every minor spike
- Alert when intervention needed
- Review thresholds monthly
- Adjust for seasonal patterns

### Reduce Alert Fatigue
- Combine related conditions
- Increase warning threshold first
- Page only on critical issues
- Daily digest for less urgent items

### Monitor Business Metrics
- Users/revenue impact
- Customer satisfaction
- SLA compliance
- Cost trends

### Regular Review
- Weekly: Check alert frequency
- Monthly: Review thresholds
- Quarterly: Full audit
- Annually: Strategy review

---

## Monitoring Checklist

- [ ] Vercel analytics enabled
- [ ] Error tracking configured (Sentry recommended)
- [ ] Health check endpoint created
- [ ] Alert rules configured
- [ ] On-call schedule set up
- [ ] Runbook linked to alerts
- [ ] Baselines documented
- [ ] Dashboard created
- [ ] Team trained on monitoring
- [ ] Post-incident process defined
