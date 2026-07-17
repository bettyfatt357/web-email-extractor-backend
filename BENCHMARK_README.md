# Load Test Benchmark Suite

## Overview

This benchmark suite measures actual system performance under concurrent load. It tests the real application with no mocks, using actual API endpoints, Redis queue, background workers, and extraction pipeline.

**Key Principle:** All metrics represent actual measurements. Unavailable metrics are explicitly reported as "Metric unavailable".

## Architecture

The benchmark consists of 6 isolated files in `lib/benchmark/` and `scripts/`:

### Files

1. **lib/benchmark/types.ts** (141 lines)
   - TypeScript interfaces for all data structures
   - `PreflightStatus`, `BenchmarkMetadata`, `BenchmarkResults`, `APITiming`, `JobCompletion`, etc.

2. **lib/benchmark/preflight.ts** (141 lines)
   - Pre-flight validation checks
   - Verifies: Redis connection, worker availability, environment variables, API reachability
   - Exits with code 1 if any check fails

3. **lib/benchmark/metadata.ts** (35 lines)
   - Collects system metadata for reproducibility
   - Records: benchmark version, timestamp, git commit, Node version, environment

4. **lib/benchmark/metrics.ts** (285 lines)
   - Real measurement collection
   - Records: API timings, job completions, queue depth, Redis latency
   - Calculates percentiles (P50, P95, P99, P99.9)
   - Generates final results with all metrics

5. **lib/benchmark/report.ts** (255 lines)
   - Generates markdown benchmark report
   - Creates tables for each concurrency level
   - Analyzes scaling efficiency
   - Saves JSON results files

6. **scripts/load-test.ts** (497 lines)
   - Main orchestrator
   - Runs 5 sequential benchmarks: 1, 5, 10, 20, 50 concurrent users
   - Each test: warm-up (2 min) → measurement (5 min) → cool-down
   - Handles errors and saves partial results
   - Exit codes: 0 (success) or 1 (failure)

## Running the Benchmark

### Prerequisites

1. Start the API server:
```bash
npm run dev
```

2. Start background worker(s):
```bash
npm run worker
```

3. Set environment variables:
```bash
export API_BASE_URL=http://localhost:3000
export API_KEY=your-api-key
export UPSTASH_REDIS_REST_URL=your-redis-url
export UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Execute Benchmark

```bash
npx tsx scripts/load-test.ts
```

Or add to `package.json`:
```json
"scripts": {
  "benchmark": "tsx scripts/load-test.ts"
}
```

Then run:
```bash
npm run benchmark
```

## Test Phases

For each concurrency level (1, 5, 10, 20, 50 users), the benchmark runs:

### Phase 1: Warm-up (2 minutes)
- Concurrent users submit extraction jobs
- **Data is discarded** to avoid startup effects
- Primes system caches and connections

### Phase 2: Measurement (5 minutes)
- **All metrics collected** during this phase
- Concurrent users continue submitting jobs
- Queue depth sampled every 10 seconds
- Job completions polled every 2 seconds
- API response times measured for each request

### Phase 3: Cool-down (up to 5 minutes)
- Stop accepting new submissions
- Wait for remaining jobs to complete
- Record final job completion times

## Metrics Collected

### Real Measurements

✓ **API Response Latency**
- P50, P95, P99, P99.9 percentiles
- Average, min, max response times

✓ **Job Completion Time**
- Duration from submission to completion
- P50, P95, P99, P99.9 percentiles

✓ **Queue Depth**
- Pending, processing, completed, failed job counts
- Sampled every 10 seconds

✓ **Throughput**
- Jobs/minute during measurement period
- Websites/hour (derived)
- Emails/hour (derived)

✓ **Success Rate**
- Percentage of jobs completed successfully

✓ **Redis Latency**
- Operation timing for SCARD, GET, SET commands
- P50, P95, P99 percentiles

✓ **Email Extraction**
- Total emails extracted per concurrency level
- Emails per hour

### Unavailable Metrics

✗ **CPU Usage (%)** - Metric unavailable
- Requires host-level monitoring

✗ **Memory Usage (MB)** - Metric unavailable
- Requires Node.js profiler

✗ **Worker Utilization (%)** - Metric unavailable
- No worker status API available

## Output Files

After running the benchmark, you'll find:

### JSON Result Files
- `benchmark-results-1.json` - Results for 1 concurrent user
- `benchmark-results-5.json` - Results for 5 concurrent users
- `benchmark-results-10.json` - Results for 10 concurrent users
- `benchmark-results-20.json` - Results for 20 concurrent users
- `benchmark-results-50.json` - Results for 50 concurrent users

### Markdown Report
- `BENCHMARK_REPORT.md` - Complete analysis with tables and recommendations

Each JSON file contains:
```json
{
  "metadata": {
    "benchmarkVersion": "1.0",
    "timestamp": "2026-07-15T...",
    "gitCommit": "abc123...",
    "nodeVersion": "v20.x.x",
    "environment": "local",
    "preflightStatus": { ... }
  },
  "configuration": {
    "concurrency": 10,
    "warmup_duration_ms": 120000,
    "measurement_duration_ms": 300000,
    "cooldown_timeout_ms": 300000
  },
  "results": {
    "total_jobs_submitted": 450,
    "total_jobs_completed": 398,
    "success_rate_pct": 99.5,
    "jobs_per_minute": 79.6,
    "websites_per_hour": 4776,
    "emails_per_hour": 369400,
    "api_p50_ms": 150,
    "api_p95_ms": 180,
    "api_p99_ms": 210,
    "job_p50_ms": 20000,
    "job_p95_ms": 25000,
    "job_p99_ms": 28000,
    ...
  },
  "unavailable_metrics": {
    "cpu_usage_pct": "Metric unavailable",
    "memory_usage_mb": "Metric unavailable",
    "worker_utilization_pct": "Metric unavailable"
  },
  "api_timings": [...],
  "job_completions": [...]
}
```

## Exit Codes

- **Exit Code 0**: All benchmark runs (1, 5, 10, 20, 50 users) completed successfully
- **Exit Code 1**: Pre-flight validation failed OR any benchmark run terminated unexpectedly

Partial results are saved before exiting on failure, allowing you to investigate what succeeded.

## Error Handling

### Pre-flight Failures
- Exit immediately with code 1
- No partial results (haven't started benchmarking yet)

### Runtime Failures
- Current run saved as partial result to `benchmark-results-{N}.json`
- Error recorded in JSON
- Remaining concurrency levels skipped
- Exit with code 1

Example of partial failure:
```
Pre-flight: PASS
Concurrency 1: COMPLETED ✓
Concurrency 5: COMPLETED ✓
Concurrency 10: FAILED (timeout)
Concurrency 20: SKIPPED
Concurrency 50: SKIPPED

Exiting with code 1
```

## Realistic Test Scenarios

The benchmark simulates realistic user behavior:

### Sample Websites
- github.com, stackoverflow.com, google.com, microsoft.com, amazon.com, apple.com
- facebook.com, twitter.com, linkedin.com, airbnb.com, uber.com, spotify.com
- netflix.com, stripe.com, vercel.com, nextjs.org, react.dev, nodejs.org

### Sample Queries
- "contact us form {website}"
- "customer support email {website}"
- "sales team email {website}"
- "press inquiries {website}"
- "company email address {website}"
- "support contact {website}"

### Job Submission Pattern
- Concurrent users submit jobs in parallel
- Staggered 50-200ms between individual requests
- 500-2000ms delay between submission batches
- Realistic job polling interval (2-second checks)

## Reproducibility

Every benchmark run includes metadata for reproducibility:

```json
{
  "benchmarkVersion": "1.0",
  "timestamp": "2026-07-15T14:30:00Z",
  "gitCommit": "abc123def456",
  "nodeVersion": "v20.14.0",
  "environment": "local|staging|production"
}
```

This allows you to:
- Compare results across different git commits
- Track performance changes over time
- Identify environment-specific behavior
- Reproduce specific test runs

## Scaling Analysis

The report includes scaling efficiency analysis showing how throughput scales with concurrency:

- **100% efficiency**: Linear scaling (doubling concurrency doubles throughput)
- **>80% efficiency**: Good scaling (slight contention)
- **50-80% efficiency**: Moderate scaling (consider more workers)
- **<50% efficiency**: Limited scaling (potential bottlenecks)

## Implementation Details

### No System Modifications
- ✓ All measurements from actual system
- ✓ No changes to extraction pipeline
- ✓ No changes to queue system
- ✓ No changes to worker implementation
- ✓ No schema changes
- ✓ Fully removable - just delete `lib/benchmark/` and `scripts/load-test.ts`

### Actual Endpoints Tested
- POST /api/search (job submission)
- GET /api/jobs/{id} (job status polling)
- Real Redis operations via REST API
- Real background worker processing

### Real Data Collection
- API response times measured from actual HTTP calls
- Queue depth from actual Redis SCARD operations
- Job completion times calculated from stored timestamps
- Success/failure determined from actual job status
- Email counts from actual extraction results

## Troubleshooting

### "Pre-flight validation failed"
Check:
1. Redis connection: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. API running: `API_BASE_URL` (default: http://localhost:3000)
3. API key set: `API_KEY` environment variable
4. Worker running: At least one background worker must be processing jobs

### "No jobs completed"
- Check if extraction is working: Run a single manual API request
- Verify worker is running and can access queue
- Check worker logs for errors

### "Timeout waiting for jobs"
- Queue might be overloaded
- Check if worker is stuck or crashed
- Review worker logs

### "Redis connection failed"
- Verify `UPSTASH_REDIS_REST_URL` and token are correct
- Check network connectivity to Redis
- Ensure Upstash Redis is running

## Performance Tips

1. **Reduce Concurrency for Initial Testing**
   - Start with 1 user to verify system works
   - Gradually increase to 5, 10, etc.

2. **Run During Off-Peak**
   - Avoids interference from other workloads
   - More stable, reproducible results

3. **Multiple Runs**
   - Run benchmark multiple times
   - Average results for stability
   - Look for outliers

4. **Monitor System**
   - Watch worker logs during benchmark
   - Check Redis latency separately
   - Note any errors or warnings

## Next Steps

After running the benchmark:

1. **Review BENCHMARK_REPORT.md** for analysis
2. **Check JSON results** for detailed metrics
3. **Compare concurrency levels** - how does throughput scale?
4. **Identify bottlenecks** - where is time spent?
5. **Plan improvements** - where to optimize?
6. **Set baselines** - track performance over time

## Design Principles

This benchmark follows these key principles:

1. **Measure Real System** - No mocks, no simulations
2. **Only Real Metrics** - Never estimate values
3. **Explicit Unavailable** - Report "Metric unavailable" when can't measure
4. **Zero Impact** - Doesn't modify production code
5. **Reproducible** - Include metadata for comparison
6. **Graceful Errors** - Save partial results on failure
7. **Clear Exit Codes** - Enable CI/CD integration
