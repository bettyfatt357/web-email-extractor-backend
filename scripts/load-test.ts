/**
 * Load Test Benchmark Suite
 * 
 * Simulates concurrent users submitting extraction jobs and measures:
 * - API response times (P50, P95, P99)
 * - Job completion times (P50, P95, P99)
 * - Queue depth over time
 * - Success/failure rates
 * - Throughput (jobs/min, websites/hour, emails/hour)
 * - Redis latency
 * 
 * Exit codes:
 * - 0: All benchmark runs completed successfully
 * - 1: Pre-flight validation failed or any benchmark run failed unexpectedly
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import axios from 'axios';
import { randomBytes } from 'crypto';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { runPreflightChecks } from '../lib/benchmark/preflight';
import { collectMetadata } from '../lib/benchmark/metadata';
import { MetricsCollector } from '../lib/benchmark/metrics';
import { saveResults, generateAndSaveReport } from '../lib/benchmark/report';
import { BenchmarkResults } from '../lib/benchmark/types';

// Configuration
const CONCURRENCY_LEVELS = [1, 5, 10, 20, 50];
const WARMUP_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const MEASUREMENT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max
const QUEUE_DEPTH_SAMPLE_INTERVAL_MS = 10 * 1000; // Sample every 10 seconds
const JOB_POLL_INTERVAL_MS = 2 * 1000; // Poll for job completion every 2 seconds

// Get configuration from environment
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const ENVIRONMENT = (process.env.BENCHMARK_ENV || 'local') as
  | 'local'
  | 'staging'
  | 'production';

// List of realistic websites to search for email extraction
const SAMPLE_WEBSITES = [
  'example.com',
  'github.com',
  'stackoverflow.com',
  'google.com',
  'microsoft.com',
  'amazon.com',
  'apple.com',
  'facebook.com',
  'twitter.com',
  'linkedin.com',
  'airbnb.com',
  'uber.com',
  'spotify.com',
  'netflix.com',
  'stripe.com',
  'stripe.dev',
  'vercel.com',
  'nextjs.org',
  'react.dev',
  'nodejs.org',
];

// List of realistic search queries for email extraction
const SAMPLE_QUERIES = [
  'contact us form',
  'customer support email',
  'sales team email',
  'press inquiries',
  'business email',
  'company email address',
  'support contact',
  'email contact page',
];

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRealisticQuery(): string {
  const website = SAMPLE_WEBSITES[Math.floor(Math.random() * SAMPLE_WEBSITES.length)];
  const query = SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)];
  return `${query} ${website}`;
}

async function submitExtractionJob(
  query: string,
  metricsCollector: MetricsCollector
): Promise<{ jobId: string; submitTime: number } | null> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/search`,
      {
        query,
        pages: 1,
      },
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const responseTime = Date.now() - startTime;
    const success = response.status === 200 || response.status === 201;
    const jobId = response.data?.job_id || response.data?.jobId;

    metricsCollector.recordAPITiming(
      responseTime,
      response.status,
      success,
      undefined,
      jobId
    );

    if (success && jobId) {
      return { jobId, submitTime: startTime };
    }

    return null;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    metricsCollector.recordAPITiming(
      responseTime,
      500,
      false,
      errorMsg
    );

    return null;
  }
}

async function pollJobCompletion(
  jobId: string,
  submitTime: number
): Promise<{ success: boolean; emailsFound: number; url: string } | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/jobs/${jobId}`, {
      headers: {
        'x-api-key': API_KEY,
      },
      timeout: 10000,
    });

    const job = response.data;

    if (
      job.status === 'completed' ||
      job.status === 'failed'
    ) {
      return {
        success: job.status === 'completed',
        emailsFound: job.emails?.length || 0,
        url: job.url || 'unknown',
      };
    }

    return null;
  } catch (error) {
    console.error(`[BENCHMARK] Failed to poll job ${jobId}:`, error);
    return null;
  }
}

async function runBenchmarkIteration(
  concurrency: number,
  metricsCollector: MetricsCollector
): Promise<void> {
  console.log(`\n[BENCHMARK] Starting concurrency level: ${concurrency} users`);

  // Phase 1: Warm-up (discard measurements)
  console.log(
    `[BENCHMARK] Warm-up phase (2 minutes, data discarded)...`
  );

  const warmupStartTime = Date.now();
  const pendingJobs: { jobId: string; submitTime: number }[] = [];

  // Submit jobs during warm-up (but don't measure)
  while (Date.now() - warmupStartTime < WARMUP_DURATION_MS) {
    // Submit concurrency jobs in parallel
    const submissions = [];
    for (let i = 0; i < concurrency; i++) {
      const query = generateRealisticQuery();
      submissions.push(submitExtractionJob(query, metricsCollector));

      // Stagger submissions slightly
      await new Promise((r) => setTimeout(r, randomDelay(50, 200)));
    }

    const results = await Promise.all(submissions);
    for (const result of results) {
      if (result) {
        pendingJobs.push(result);
      }
    }

    // Poll for completions during warm-up (discard measurements)
    await new Promise((r) => setTimeout(r, randomDelay(1000, 3000)));
  }

  // Clear pending jobs and metrics before measurement phase
  metricsCollector.reset();
  pendingJobs.length = 0;

  // Phase 2: Measurement (collect all metrics)
  console.log(
    `[BENCHMARK] Measurement phase (5 minutes, collecting metrics)...`
  );

  const measurementStartTime = Date.now();
  const submittedJobIds: { jobId: string; submitTime: number }[] = [];
  let queueDepthSampleTimer: NodeJS.Timeout;

  // Function to submit jobs continuously
  const submissionTask = async () => {
    while (Date.now() - measurementStartTime < MEASUREMENT_DURATION_MS) {
      // Submit concurrency jobs in parallel
      const submissions = [];
      for (let i = 0; i < concurrency; i++) {
        const query = generateRealisticQuery();
        submissions.push(submitExtractionJob(query, metricsCollector));

        // Stagger submissions
        await new Promise((r) => setTimeout(r, randomDelay(50, 200)));
      }

      const results = await Promise.all(submissions);
      for (const result of results) {
        if (result) {
          submittedJobIds.push(result);
        }
      }

      // Delay before next batch
      await new Promise((r) => setTimeout(r, randomDelay(500, 2000)));
    }
  };

  // Function to sample queue depth periodically
  const queueDepthTask = async () => {
    while (Date.now() - measurementStartTime < MEASUREMENT_DURATION_MS) {
      await metricsCollector.recordQueueDepthSample();
      await new Promise((r) => setTimeout(r, QUEUE_DEPTH_SAMPLE_INTERVAL_MS));
    }
  };

  // Function to poll for job completions
  const pollTask = async () => {
    while (Date.now() - measurementStartTime < MEASUREMENT_DURATION_MS) {
      for (let i = 0; i < submittedJobIds.length; i++) {
        const { jobId, submitTime } = submittedJobIds[i];

        const result = await pollJobCompletion(jobId, submitTime);

        if (result) {
          const completedAt = Date.now();
          const duration = completedAt - submitTime;

          metricsCollector.recordJobCompletion({
            job_id: jobId,
            submitted_at: submitTime,
            completed_at: completedAt,
            duration_ms: duration,
            status: result.success ? 'completed' : 'failed',
            emails_found: result.emailsFound,
            website_url: result.url,
            success: result.success,
          });

          // Remove from pending
          submittedJobIds.splice(i, 1);
          i--;
        }
      }

      await new Promise((r) => setTimeout(r, JOB_POLL_INTERVAL_MS));
    }
  };

  // Run all tasks in parallel
  const measurementEndTime = Date.now() + MEASUREMENT_DURATION_MS;
  try {
    await Promise.all([
      submissionTask(),
      queueDepthTask(),
      pollTask(),
    ]);
  } catch (error) {
    console.error('[BENCHMARK] Error during measurement phase:', error);
  }

  // Phase 3: Cool-down (wait for remaining jobs to complete)
  console.log(
    `[BENCHMARK] Cool-down phase (waiting for queue to empty, max 5 minutes)...`
  );

  const cooldownStartTime = Date.now();
  let remainingJobs = submittedJobIds.length;

  while (
    remainingJobs > 0 &&
    Date.now() - cooldownStartTime < COOLDOWN_TIMEOUT_MS
  ) {
    for (let i = 0; i < submittedJobIds.length; i++) {
      const { jobId, submitTime } = submittedJobIds[i];

      const result = await pollJobCompletion(jobId, submitTime);

      if (result) {
        const completedAt = Date.now();
        const duration = completedAt - submitTime;

        metricsCollector.recordJobCompletion({
          job_id: jobId,
          submitted_at: submitTime,
          completed_at: completedAt,
          duration_ms: duration,
          status: result.success ? 'completed' : 'failed',
          emails_found: result.emailsFound,
          website_url: result.url,
          success: result.success,
        });

        // Remove from pending
        submittedJobIds.splice(i, 1);
        i--;
      }
    }

    remainingJobs = submittedJobIds.length;

    if (remainingJobs > 0) {
      process.stdout.write(
        `\r[BENCHMARK] Waiting for ${remainingJobs} jobs to complete...`
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  if (remainingJobs > 0) {
    console.log(
      `\n[BENCHMARK] ⚠ Cool-down timeout: ${remainingJobs} jobs still pending`
    );
  } else {
    console.log('\n[BENCHMARK] ✓ All jobs completed');
  }

  const cooldownEndTime = Date.now();

  console.log(
    `[BENCHMARK] ✓ Concurrency ${concurrency} complete\n`
  );
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                 Load Test Benchmark Suite                      ║
║                                                                ║
║  Testing concurrency levels: ${CONCURRENCY_LEVELS.join(', ')}                  ║
╚════════════════════════════════════════════════════════════════╝
`);

  // Pre-flight validation (runs once, not per concurrency level)
  const { status: preflightStatus, allPassed } = await runPreflightChecks(
    API_BASE_URL,
    REDIS_REST_URL,
    REDIS_REST_TOKEN
  );

  if (!allPassed) {
    console.error(
      '[BENCHMARK] ✗ Pre-flight validation failed. Aborting benchmark.\n'
    );
    process.exit(1);
  }

  // Collect metadata (once, before any tests)
  const metadata = collectMetadata(preflightStatus, ENVIRONMENT);

  const allResults: BenchmarkResults[] = [];
  let successCount = 0;
  let failureCount = 0;

  // Run benchmark for each concurrency level
  for (const concurrency of CONCURRENCY_LEVELS) {
    try {
      const metricsCollector = new MetricsCollector(
        REDIS_REST_URL,
        REDIS_REST_TOKEN,
        API_BASE_URL
      );

      // Run the benchmark iteration
      await runBenchmarkIteration(concurrency, metricsCollector);

      // Generate results for this concurrency level
      const results = metricsCollector.generateResults(
        metadata,
        {
          concurrency,
          warmup_duration_ms: WARMUP_DURATION_MS,
          measurement_duration_ms: MEASUREMENT_DURATION_MS,
          cooldown_timeout_ms: COOLDOWN_TIMEOUT_MS,
        },
        Date.now() - MEASUREMENT_DURATION_MS, // Approximate start time
        Date.now(), // End time
        Date.now() // Cool-down end time
      );

      allResults.push(results);

      // Save results for this concurrency level
      const filename = `benchmark-results-${concurrency}.json`;
      await saveResults(results, filename);

      console.log(
        `[BENCHMARK] ✓ Results saved: ${filename}`
      );
      successCount++;
    } catch (error) {
      console.error(
        `[BENCHMARK] ✗ Concurrency ${concurrency} failed:`,
        error
      );
      failureCount++;

      // Continue to next concurrency level but note the failure
    }
  }

  // Generate final report from all results
  if (allResults.length > 0) {
    try {
      await generateAndSaveReport(allResults);
      console.log('[BENCHMARK] ✓ Benchmark report generated: BENCHMARK_REPORT.md\n');
    } catch (error) {
      console.error('[BENCHMARK] Failed to generate report:', error);
    }
  }

  // Print summary
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                  Benchmark Complete                            ║
╚════════════════════════════════════════════════════════════════╝

Completed: ${successCount}/${CONCURRENCY_LEVELS.length} concurrency levels
Failed: ${failureCount}/${CONCURRENCY_LEVELS.length} concurrency levels

Results saved:
`);

  for (const result of allResults) {
    console.log(
      `  • benchmark-results-${result.configuration.concurrency}.json`
    );
  }

  console.log(
    `  • BENCHMARK_REPORT.md (complete analysis)\n`
  );

  // Exit with appropriate code
  if (failureCount === 0) {
    console.log('[BENCHMARK] ✓ All benchmarks completed successfully\n');
    process.exit(0);
  } else {
    console.error(
      `[BENCHMARK] ✗ ${failureCount} benchmark(s) failed. Check partial results.\n`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[BENCHMARK] Fatal error:', error);
  process.exit(1);
});
