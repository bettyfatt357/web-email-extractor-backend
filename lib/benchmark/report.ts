/**
 * Generate markdown benchmark report from collected results
 */

import { BenchmarkResults } from './types';
import * as fs from 'fs';
import * as path from 'path';

export function generateBenchmarkReport(results: BenchmarkResults[]): string {
  const timestamp = new Date().toISOString();

  let report = `# Benchmark Report

Generated: ${timestamp}

## Executive Summary

This benchmark measures actual system performance across multiple concurrency levels (1, 5, 10, 20, 50 concurrent users).

**Important:** All metrics represent actual measurements from the running system. Unavailable metrics are explicitly marked as "Metric unavailable".

---

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Benchmark Version | ${results[0]?.metadata.benchmarkVersion} |
| Node Version | ${results[0]?.metadata.nodeVersion} |
| Git Commit | ${results[0]?.metadata.gitCommit} |
| Environment | ${results[0]?.metadata.environment} |
| Warm-up Duration | 2 minutes |
| Measurement Duration | 5-10 minutes (per concurrency level) |

---

## Pre-flight Validation

| Check | Status | Details |
|-------|--------|---------|
| Redis Connection | ${results[0]?.metadata.preflightStatus.redisConnection} | ${results[0]?.metadata.preflightStatus.redisConnectionError || 'Connected successfully'} |
| Worker Available | ${results[0]?.metadata.preflightStatus.workerAvailable} | ${results[0]?.metadata.preflightStatus.workerAvailableError || 'At least one worker available'} |
| Environment Variables | ${results[0]?.metadata.preflightStatus.envVariablesValid} | ${results[0]?.metadata.preflightStatus.envVariablesError || 'All required variables set'} |
| API Reachable | ${results[0]?.metadata.preflightStatus.apiReachable} | ${results[0]?.metadata.preflightStatus.apiReachableError || 'API is reachable'} |

---

## Results by Concurrency Level

`;

  // Create table for each concurrency level
  for (const result of results) {
    const concurrency = result.configuration.concurrency;

    report += `
### Concurrency: ${concurrency} User(s)

#### Throughput & Success

| Metric | Value |
|--------|-------|
| Jobs Submitted | ${result.total_jobs_submitted} |
| Jobs Completed | ${result.total_jobs_completed} |
| Jobs Failed | ${result.total_jobs_failed} |
| Success Rate | ${result.success_rate_pct.toFixed(2)}% |
| Jobs/Minute | ${result.jobs_per_minute.toFixed(2)} |
| Websites/Hour | ${result.websites_per_hour.toFixed(0)} |
| Total Emails Extracted | ${result.total_emails_extracted} |
| Emails/Hour | ${result.emails_per_hour.toFixed(0)} |

#### API Response Latency

| Metric | Value (ms) |
|--------|-----------|
| P50 | ${result.api_p50_ms.toFixed(1)} |
| P95 | ${result.api_p95_ms.toFixed(1)} |
| P99 | ${result.api_p99_ms.toFixed(1)} |
| P99.9 | ${result.api_p99_9_ms.toFixed(1)} |
| Average | ${result.api_avg_ms.toFixed(1)} |
| Min | ${result.api_min_ms.toFixed(1)} |
| Max | ${result.api_max_ms.toFixed(1)} |

#### Job Completion Time

| Metric | Value (ms) |
|--------|-----------|
| P50 | ${result.job_p50_ms.toFixed(0)} |
| P95 | ${result.job_p95_ms.toFixed(0)} |
| P99 | ${result.job_p99_ms.toFixed(0)} |
| P99.9 | ${result.job_p99_9_ms.toFixed(0)} |
| Average | ${result.job_avg_ms.toFixed(0)} |
| Min | ${result.job_min_ms.toFixed(0)} |
| Max | ${result.job_max_ms.toFixed(0)} |

#### Queue Depth

| Metric | Value |
|--------|-------|
| Max Pending | ${result.queue_depth_max} |
| Avg Pending | ${result.queue_depth_avg.toFixed(1)} |
| Min Pending | ${result.queue_depth_min} |

#### Redis Latency

| Metric | Value (ms) |
|--------|-----------|
| P50 | ${result.redis_p50_ms.toFixed(2)} |
| P95 | ${result.redis_p95_ms.toFixed(2)} |
| P99 | ${result.redis_p99_ms.toFixed(2)} |

`;
  }

  // Scaling analysis
  report += `
---

## Scaling Analysis

### Throughput Scaling

`;

  if (results.length > 1) {
    report += `
| Concurrency | Jobs/Min | Websites/Hour | Success Rate |
|-------------|----------|---------------|--------------|
`;
    for (const result of results) {
      report += `| ${result.configuration.concurrency} | ${result.jobs_per_minute.toFixed(2)} | ${result.websites_per_hour.toFixed(0)} | ${result.success_rate_pct.toFixed(2)}% |\n`;
    }

    // Calculate linear scaling efficiency
    const baseline = results[0];
    if (baseline) {
      report += `

### Linear Scaling Efficiency

This shows how well the system scales with additional concurrency. 100% means perfect linear scaling.

| Concurrency | Scaling Efficiency |
|-------------|-------------------|
`;
      for (const result of results) {
        const efficiency =
          (result.jobs_per_minute / baseline.jobs_per_minute / result.configuration.concurrency) *
          100;
        report += `| ${result.configuration.concurrency} | ${efficiency.toFixed(1)}% |\n`;
      }
    }
  }

  report += `

---

## Unavailable Metrics

The following metrics could not be measured from the system and are reported as unavailable:

- **CPU Usage (%)**: Metric unavailable
- **Memory Usage (MB)**: Metric unavailable  
- **Worker Utilization (%)**: Metric unavailable

These metrics require host-level monitoring infrastructure that is outside the scope of this benchmark.

---

## Recommendations

### Based on Observed Results:

1. **Throughput**: The system achieves ${results[results.length - 1]?.jobs_per_minute.toFixed(2) || 'N/A'} jobs/minute at ${results[results.length - 1]?.configuration.concurrency} concurrent users.

2. **Latency**: Job completion times at P99 average ${results.reduce((sum, r) => sum + r.job_p99_ms, 0) / results.length / results.length} ms across concurrency levels.

3. **Success Rate**: Overall success rate is ${results.reduce((sum, r) => sum + r.success_rate_pct, 0) / results.length}% across all concurrency levels.

4. **Queue Dynamics**: Maximum queue depth observed was ${Math.max(...results.map((r) => r.queue_depth_max))} jobs.

### Scaling Observations:

${generateScalingRecommendations(results)}

---

## Testing Notes

- Each test follows the pattern: Warm-up (2 min) → Measurement (5-10 min) → Cool-down
- Warm-up phase data is discarded to avoid startup effects
- Only completed jobs are counted in final metrics
- Queue depth samples taken every 5-10 seconds during measurement
- All timings are measured from the actual system with zero synthetic delays

---

## Raw Data

Detailed raw measurements are available in:
- \`benchmark-results-{concurrency}.json\` files for each concurrency level

`;

  return report;
}

function generateScalingRecommendations(results: BenchmarkResults[]): string {
  if (results.length < 2) return 'Insufficient data for scaling analysis.';

  const baseline = results[0]!;
  const highest = results[results.length - 1]!;

  const throughputIncrease =
    ((highest.jobs_per_minute - baseline.jobs_per_minute) /
      baseline.jobs_per_minute) *
    100;
  const concurrencyIncrease =
    ((highest.configuration.concurrency - baseline.configuration.concurrency) /
      baseline.configuration.concurrency) *
    100;

  let recommendation = '';

  if (throughputIncrease / concurrencyIncrease > 0.8) {
    recommendation =
      '**Good Scaling**: The system shows strong linear scaling. Throughput increases proportionally with concurrency.';
  } else if (throughputIncrease / concurrencyIncrease > 0.5) {
    recommendation =
      '**Moderate Scaling**: The system scales reasonably well, though with some contention. Consider adding workers for better performance.';
  } else {
    recommendation =
      '**Limited Scaling**: Throughput increases slower than concurrency, suggesting potential bottlenecks in queue processing or extraction pipeline. Investigate worker capacity and resource allocation.';
  }

  return recommendation;
}

export async function saveResults(results: BenchmarkResults, filename: string): Promise<void> {
  const content = JSON.stringify(results, null, 2);
  await fs.promises.writeFile(filename, content, 'utf-8');
  console.log(`[REPORT] Saved results to ${filename}`);
}

export async function generateAndSaveReport(
  allResults: BenchmarkResults[]
): Promise<void> {
  const report = generateBenchmarkReport(allResults);
  const reportPath = path.join(process.cwd(), 'BENCHMARK_REPORT.md');

  await fs.promises.writeFile(reportPath, report, 'utf-8');
  console.log(`[REPORT] Generated benchmark report: ${reportPath}`);
}
