/**
 * Benchmark data structures and interfaces
 * All measurements are REAL values from the actual system
 */

export interface PreflightStatus {
  redisConnection: 'OK' | 'FAILED';
  redisConnectionError?: string;
  workerAvailable: 'OK' | 'FAILED';
  workerAvailableError?: string;
  envVariablesValid: 'OK' | 'FAILED';
  envVariablesError?: string;
  apiReachable: 'OK' | 'FAILED';
  apiReachableError?: string;
}

export interface BenchmarkMetadata {
  benchmarkVersion: string;
  timestamp: string; // ISO 8601
  gitCommit: string;
  nodeVersion: string;
  environment: 'local' | 'staging' | 'production';
  preflightStatus: PreflightStatus;
}

export interface TestConfiguration {
  concurrency: number;
  warmup_duration_ms: number;
  measurement_duration_ms: number;
  cooldown_timeout_ms: number;
}

export interface APITiming {
  timestamp: number; // When the request was made
  response_time_ms: number;
  status_code: number;
  success: boolean;
  error?: string;
  job_id?: string;
}

export interface JobCompletion {
  job_id: string;
  submitted_at: number;
  started_at?: number;
  completed_at?: number;
  duration_ms?: number;
  status: string;
  emails_found: number;
  website_url: string;
  success: boolean;
}

export interface QueueDepthSample {
  timestamp: number;
  pending_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
}

export interface RedisOperationTiming {
  timestamp: number;
  operation: string; // 'PING', 'SCARD', 'GET', 'SET', etc.
  duration_ms: number;
  success: boolean;
  error?: string;
}

export interface BenchmarkResults {
  metadata: BenchmarkMetadata;
  configuration: TestConfiguration;
  
  // Submission metrics
  total_jobs_submitted: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  
  // Email metrics
  total_emails_extracted: number;
  
  // Timing metrics
  api_response_times_ms: number[];
  api_p50_ms: number;
  api_p95_ms: number;
  api_p99_ms: number;
  api_p99_9_ms: number;
  api_avg_ms: number;
  api_min_ms: number;
  api_max_ms: number;
  
  job_completion_times_ms: number[];
  job_p50_ms: number;
  job_p95_ms: number;
  job_p99_ms: number;
  job_p99_9_ms: number;
  job_avg_ms: number;
  job_min_ms: number;
  job_max_ms: number;
  
  // Queue metrics
  queue_depth_samples: QueueDepthSample[];
  queue_depth_max: number;
  queue_depth_avg: number;
  queue_depth_min: number;
  
  // Redis metrics
  redis_operation_timings: RedisOperationTiming[];
  redis_p50_ms: number;
  redis_p95_ms: number;
  redis_p99_ms: number;
  
  // Calculated throughput
  jobs_per_minute: number;
  websites_per_hour: number;
  emails_per_minute: number;
  emails_per_hour: number;
  success_rate_pct: number;
  
  // Timestamps
  timestamps: {
    test_start: number;
    warm_up_end: number;
    measurement_start: number;
    measurement_end: number;
    cool_down_start: number;
    cool_down_end: number;
  };
  
  // Unavailable metrics (explicitly marked)
  unavailable_metrics: {
    cpu_usage_pct: string;
    memory_usage_mb: string;
    worker_utilization_pct: string;
  };
  
  // Raw data for debugging
  api_timings: APITiming[];
  job_completions: JobCompletion[];
}
