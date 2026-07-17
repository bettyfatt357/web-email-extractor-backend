/**
 * Collect real measurements during benchmark execution
 * All measurements are actual values from the system
 */

import axios from 'axios';
import {
  APITiming,
  JobCompletion,
  QueueDepthSample,
  RedisOperationTiming,
  BenchmarkResults,
  BenchmarkMetadata,
  TestConfiguration,
} from './types';

export class MetricsCollector {
  private apiTimings: APITiming[] = [];
  private jobCompletions: JobCompletion[] = [];
  private queueDepthSamples: QueueDepthSample[] = [];
  private redisOperationTimings: RedisOperationTiming[] = [];

  private redisRestUrl: string;
  private redisRestToken: string;
  private apiBaseUrl: string;

  constructor(redisRestUrl: string, redisRestToken: string, apiBaseUrl: string) {
    this.redisRestUrl = redisRestUrl;
    this.redisRestToken = redisRestToken;
    this.apiBaseUrl = apiBaseUrl;
  }

  // Record API timing (called after each API request)
  recordAPITiming(
    responseTimeMs: number,
    statusCode: number,
    success: boolean,
    error?: string,
    jobId?: string
  ) {
    this.apiTimings.push({
      timestamp: Date.now(),
      response_time_ms: responseTimeMs,
      status_code: statusCode,
      success,
      error,
      job_id: jobId,
    });
  }

  // Record job completion (called when polling jobs)
  recordJobCompletion(completion: JobCompletion) {
    this.jobCompletions.push(completion);
  }

  // Record queue depth sample (called periodically during measurement)
  async recordQueueDepthSample() {
    try {
      const startTime = Date.now();

      // Use Redis REST API to get queue counts
      const [pendingResponse, processingResponse, completedResponse, failedResponse] =
        await Promise.all([
          this.getRedisCount('jobs:pending'),
          this.getRedisCount('jobs:processing'),
          this.getRedisCount('jobs:completed'),
          this.getRedisCount('jobs:failed'),
        ]);

      this.queueDepthSamples.push({
        timestamp: startTime,
        pending_count: pendingResponse.count,
        processing_count: processingResponse.count,
        completed_count: completedResponse.count,
        failed_count: failedResponse.count,
      });

      // Record Redis operation timings
      this.redisOperationTimings.push(...[
        pendingResponse.timing,
        processingResponse.timing,
        completedResponse.timing,
        failedResponse.timing,
      ]);
    } catch (error) {
      console.error('[METRICS] Failed to record queue depth:', error);
    }
  }

  // Helper: Get Redis set cardinality with timing
  private async getRedisCount(
    key: string
  ): Promise<{ count: number; timing: RedisOperationTiming }> {
    const startTime = Date.now();

    try {
      const response = await axios.get(
        `${this.redisRestUrl}/scard/${key}`,
        {
          headers: {
            Authorization: `Bearer ${this.redisRestToken}`,
          },
          timeout: 5000,
        }
      );

      const duration = Date.now() - startTime;
      const count = response.data?.result || 0;

      const timing: RedisOperationTiming = {
        timestamp: startTime,
        operation: 'SCARD',
        duration_ms: duration,
        success: true,
      };

      return { count, timing };
    } catch (error) {
      const duration = Date.now() - startTime;

      const timing: RedisOperationTiming = {
        timestamp: startTime,
        operation: 'SCARD',
        duration_ms: duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      return { count: 0, timing };
    }
  }

  // Calculate percentile from array of numbers
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Calculate average
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Generate final results
  generateResults(
    metadata: BenchmarkMetadata,
    configuration: TestConfiguration,
    measurementStartTime: number,
    measurementEndTime: number,
    cooldownEndTime: number
  ): BenchmarkResults {
    // Extract job completion times from completed jobs
    const completionTimes = this.jobCompletions
      .filter((j) => j.duration_ms !== undefined)
      .map((j) => j.duration_ms!);

    // Extract API response times
    const apiTimes = this.apiTimings.map((t) => t.response_time_ms);

    // Extract Redis operation times
    const redisTimes = this.redisOperationTimings
      .filter((t) => t.success)
      .map((t) => t.duration_ms);

    // Count metrics
    const completedJobs = this.jobCompletions.filter(
      (j) => j.success === true
    ).length;
    const failedJobs = this.jobCompletions.filter(
      (j) => j.success === false
    ).length;
    const totalEmails = this.jobCompletions.reduce(
      (sum, j) => sum + j.emails_found,
      0
    );

    // Measurement duration in minutes
    const measurementDurationMs = measurementEndTime - measurementStartTime;
    const measurementDurationMinutes = measurementDurationMs / 60000;

    // Calculate throughput
    const jobsPerMinute = completedJobs / measurementDurationMinutes;
    const websitesPerHour = jobsPerMinute * 60;
    const emailsPerMinute = totalEmails / measurementDurationMinutes;
    const emailsPerHour = emailsPerMinute * 60;
    const successRate =
      (completedJobs / (completedJobs + failedJobs)) * 100 || 0;

    return {
      metadata,
      configuration,

      // Submission metrics
      total_jobs_submitted: this.apiTimings.filter((t) => t.success).length,
      total_jobs_completed: completedJobs,
      total_jobs_failed: failedJobs,

      // Email metrics
      total_emails_extracted: totalEmails,

      // API timing metrics
      api_response_times_ms: apiTimes,
      api_p50_ms: this.calculatePercentile(apiTimes, 50),
      api_p95_ms: this.calculatePercentile(apiTimes, 95),
      api_p99_ms: this.calculatePercentile(apiTimes, 99),
      api_p99_9_ms: this.calculatePercentile(apiTimes, 99.9),
      api_avg_ms: this.calculateAverage(apiTimes),
      api_min_ms: apiTimes.length > 0 ? Math.min(...apiTimes) : 0,
      api_max_ms: apiTimes.length > 0 ? Math.max(...apiTimes) : 0,

      // Job completion timing metrics
      job_completion_times_ms: completionTimes,
      job_p50_ms: this.calculatePercentile(completionTimes, 50),
      job_p95_ms: this.calculatePercentile(completionTimes, 95),
      job_p99_ms: this.calculatePercentile(completionTimes, 99),
      job_p99_9_ms: this.calculatePercentile(completionTimes, 99.9),
      job_avg_ms: this.calculateAverage(completionTimes),
      job_min_ms: completionTimes.length > 0 ? Math.min(...completionTimes) : 0,
      job_max_ms: completionTimes.length > 0 ? Math.max(...completionTimes) : 0,

      // Queue metrics
      queue_depth_samples: this.queueDepthSamples,
      queue_depth_max:
        this.queueDepthSamples.length > 0
          ? Math.max(...this.queueDepthSamples.map((s) => s.pending_count))
          : 0,
      queue_depth_avg:
        this.queueDepthSamples.length > 0
          ? this.queueDepthSamples.reduce((sum, s) => sum + s.pending_count, 0) /
            this.queueDepthSamples.length
          : 0,
      queue_depth_min:
        this.queueDepthSamples.length > 0
          ? Math.min(...this.queueDepthSamples.map((s) => s.pending_count))
          : 0,

      // Redis metrics
      redis_operation_timings: this.redisOperationTimings,
      redis_p50_ms: this.calculatePercentile(redisTimes, 50),
      redis_p95_ms: this.calculatePercentile(redisTimes, 95),
      redis_p99_ms: this.calculatePercentile(redisTimes, 99),

      // Calculated throughput
      jobs_per_minute: jobsPerMinute,
      websites_per_hour: websitesPerHour,
      emails_per_minute: emailsPerMinute,
      emails_per_hour: emailsPerHour,
      success_rate_pct: successRate,

      // Timestamps
      timestamps: {
        test_start: measurementStartTime - measurementDurationMs, // Work backwards to get actual start
        warm_up_end: measurementStartTime,
        measurement_start: measurementStartTime,
        measurement_end: measurementEndTime,
        cool_down_start: measurementEndTime,
        cool_down_end: cooldownEndTime,
      },

      // Unavailable metrics
      unavailable_metrics: {
        cpu_usage_pct: 'Metric unavailable',
        memory_usage_mb: 'Metric unavailable',
        worker_utilization_pct: 'Metric unavailable',
      },

      // Raw data
      api_timings: this.apiTimings,
      job_completions: this.jobCompletions,
    };
  }

  // Reset for next test
  reset() {
    this.apiTimings = [];
    this.jobCompletions = [];
    this.queueDepthSamples = [];
    this.redisOperationTimings = [];
  }
}
