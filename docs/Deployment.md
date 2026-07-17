# Email Extraction Platform - Deployment Guide

## Deployment Options

### Option 1: Vercel (Recommended for API & Dashboard)

**Pros**:
- Serverless, auto-scaling
- Global CDN
- Built-in observability
- Free tier available
- Easy GitHub integration

**Cons**:
- Worker must run separately
- Function timeout limits
- Cold starts possible

### Option 2: Docker Container

**Pros**:
- Full control
- Run on any cloud (AWS, GCP, Azure)
- Workers and API together
- Custom configuration

**Cons**:
- Manual scaling
- More operational overhead
- More maintenance required

### Option 3: Hybrid (Recommended for Production)

**API & Dashboard**: Vercel serverless
**Workers**: Separate container on cloud (ECS, GKE, etc.)
**Benefits**: Best of both worlds

---

## Vercel Deployment (API & Dashboard)

### Prerequisites
- Vercel account
- GitHub repository connected
- Environment variables configured

### Step 1: Prepare Environment Variables

Create or update environment variables in Vercel project:

```bash
# In Vercel Dashboard → Settings → Environment Variables

# Required:
REDIS_URL=rediss://default:password@host.upstash.io:6379
GOOGLE_CX=your-cx-id
GOOGLE_API_KEY=your-api-key
STRIPE_API_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
ADMIN_CREDENTIAL=your-admin-secret

# Optional:
ALLOW_ANONYMOUS=false
WORKER_CONCURRENCY=1
REQUEST_DELAY_MS=0
RATE_LIMIT_FREE=10
RATE_LIMIT_PRO=100
RATE_LIMIT_ENTERPRISE=500
```

### Step 2: Deploy via Git

```bash
# If not already connected:
# 1. Push code to GitHub
# 2. Connect GitHub repo in Vercel dashboard
# 3. Vercel auto-deploys on push to main

# Or deploy manually:
vercel --prod
```

### Step 3: Verify Deployment

```bash
# Test API endpoint
curl https://your-domain.vercel.app/api/auth/me \
  -H "x-api-key: your-admin-credential"

# Test admin dashboard
curl https://your-domain.vercel.app/admin \
  -H "x-api-key: your-admin-credential"
```

### Step 4: Configure Stripe Webhook

```bash
# In Stripe Dashboard → Webhooks
# Add endpoint: https://your-domain.vercel.app/api/billing/webhook
# Events: customer.subscription.*, invoice.payment_*
# Copy signing secret to STRIPE_WEBHOOK_SECRET
```

---

## Worker Deployment (Docker)

### Build Docker Image

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy application
COPY . .

# Build Next.js (needed for types)
RUN npm run build

# Run worker process
CMD ["node", "lib/worker/worker.ts"]
```

Build image:

```bash
docker build -t email-extraction-worker:latest .
```

### Run Worker Locally

```bash
docker run \
  -e REDIS_URL=rediss://... \
  -e GOOGLE_CX=... \
  -e GOOGLE_API_KEY=... \
  -e WORKER_CONCURRENCY=5 \
  email-extraction-worker:latest
```

### Deploy to Kubernetes

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: email-extraction-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: email-extraction-worker
  template:
    metadata:
      labels:
        app: email-extraction-worker
    spec:
      containers:
      - name: worker
        image: email-extraction-worker:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        - name: GOOGLE_CX
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: google-cx
        - name: GOOGLE_API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: google-api-key
        - name: WORKER_CONCURRENCY
          value: "5"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

Deploy:

```bash
kubectl apply -f deployment.yaml
```

### Deploy to ECS (AWS)

Create task definition:

```json
{
  "family": "email-extraction-worker",
  "containerDefinitions": [{
    "name": "worker",
    "image": "your-registry/email-extraction-worker:latest",
    "memory": 512,
    "cpu": 256,
    "environment": [
      { "name": "REDIS_URL", "value": "rediss://..." },
      { "name": "GOOGLE_CX", "value": "..." },
      { "name": "WORKER_CONCURRENCY", "value": "5" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/email-extraction-worker",
        "awslogs-region": "us-east-1"
      }
    }
  }]
}
```

Create service:

```bash
aws ecs create-service \
  --cluster production \
  --service-name email-extraction-worker \
  --task-definition email-extraction-worker \
  --desired-count 2 \
  --launch-type FARGATE
```

---

## Database Setup

### Upstash Redis

1. Create Upstash account at https://upstash.com
2. Create Redis database
3. Copy connection string: `rediss://...`
4. Set `REDIS_URL` environment variable

### Backup Configuration

```bash
# Enable automatic backups in Upstash dashboard
# Daily backups kept for 7 days
```

---

## SSL/TLS Configuration

### Vercel
- Automatic SSL provided
- Managed by Vercel
- No configuration needed

### Custom Domain
```bash
# In Vercel dashboard:
# 1. Add domain
# 2. Configure DNS records (provided by Vercel)
# 3. SSL auto-provisioned (Let's Encrypt)
```

---

## Health Checks

### Liveness Check
```bash
curl https://your-domain.vercel.app/api/auth/me \
  -H "x-api-key: valid-key"

# Should return 200 with user info (or 401 with valid error)
```

### Readiness Check
```bash
curl https://your-domain.vercel.app/api/admin/queue/health \
  -H "x-api-key: admin-credential"

# Should return 200 with queue metrics
```

---

## Monitoring & Logging

### Vercel Dashboard
- Built-in performance metrics
- Function execution logs
- Error tracking

### Custom Monitoring

```bash
# Check logs for errors
vercel logs --prod

# Monitor real-time activity
vercel logs --prod --follow
```

### Alert Setup (Recommended)

Use service like:
- **Sentry**: Error tracking
- **DataDog**: Performance monitoring
- **New Relic**: Application performance monitoring

---

## Scaling Guide

### Horizontal Scaling Workers

```bash
# Increase replicas/desired count
# Option 1: Kubernetes
kubectl scale deployment email-extraction-worker --replicas=5

# Option 2: ECS
aws ecs update-service \
  --cluster production \
  --service email-extraction-worker \
  --desired-count 5

# Option 3: Docker Compose
docker-compose up --scale worker=5
```

### Performance Tuning

```bash
# Increase worker concurrency
WORKER_CONCURRENCY=10

# Increase max queue size (in code)
const MAX_QUEUE_SIZE = 2000;

# Increase rate limits
RATE_LIMIT_PRO=500
RATE_LIMIT_ENTERPRISE=2000
```

---

## Rollback Procedure

### Vercel
```bash
# View deployment history
vercel deployments

# Rollback to previous version
vercel rollback

# Or via dashboard: Settings → Deployments
```

### Docker
```bash
# Redeploy previous image tag
docker pull your-registry/email-extraction-worker:previous-tag
docker tag your-registry/email-extraction-worker:previous-tag latest
```

---

## Migration Checklist

Before moving to production:

- [ ] All environment variables configured
- [ ] HTTPS enabled
- [ ] Admin credential set to secure value
- [ ] Redis backup enabled
- [ ] Stripe webhook configured
- [ ] Health checks passing
- [ ] Rate limits configured appropriately
- [ ] Monitoring dashboard set up
- [ ] Alerting configured
- [ ] Runbooks created
- [ ] Team trained on operations
- [ ] Disaster recovery plan reviewed
- [ ] Security audit performed
- [ ] Load testing completed

---

## Post-Deployment Verification

1. **API Connectivity**
   ```bash
   curl https://your-domain.vercel.app/api/auth/me
   ```

2. **Admin Dashboard**
   - Access /admin dashboard
   - Verify user list loads
   - Verify job monitoring works

3. **Job Processing**
   - Submit test job via /api/search
   - Monitor job status
   - Verify results returned

4. **Billing Integration**
   - Test Stripe webhook (use Stripe CLI)
   - Verify subscription status updates
   - Check rate limits applied

5. **Monitoring**
   - Check Vercel dashboard
   - Verify logging working
   - Confirm alerts configured

---

## Troubleshooting

### Issue: Worker not processing jobs
**Solution**:
1. Check Redis connection
2. Verify REDIS_URL environment variable
3. Check worker logs for errors
4. Restart worker process

### Issue: High latency on API calls
**Solution**:
1. Check rate limit status
2. Verify worker concurrency
3. Check Redis latency
4. Review queue backlog

### Issue: Stripe webhook not received
**Solution**:
1. Verify webhook URL in Stripe dashboard
2. Check STRIPE_WEBHOOK_SECRET matches
3. Review webhook logs in Stripe
4. Test with Stripe CLI: `stripe trigger customer.subscription.created`

---

## Maintenance Tasks

### Daily
- Monitor error rate
- Check queue health
- Verify jobs completing

### Weekly
- Review usage patterns
- Check for memory leaks
- Update dependencies (security patches)

### Monthly
- Performance review
- Optimization opportunities
- Security audit
- Cost review

### Quarterly
- Disaster recovery test
- Credential rotation
- Full system audit
