import { Redis } from '@upstash/redis';
import { Job, JobStatus } from './types';
import { randomBytes } from 'crypto';
import { normalizeUrl } from '../utils/url-normalizer';

function uuidv4() {
  return randomBytes(16).toString('hex');
}

export class EmailQueue {
  private client: Redis;
  private connected = false;
  private maxRetries = 3;
  private jobTimeout = 20000; // 20 seconds
  
  // Rate limiting config
  private maxQueuedJobs = 1000; // Max jobs in queue
  private maxProcessing = 10; // Max jobs processing simultaneously
  private requestDelayMs = 200; // Delay between requests (ms)

  constructor(redisUrl: string) {
    // @upstash/redis client - supports both rediss:// and REST API URL
    // If we have REST API credentials, use those
    const restApiUrl = process.env.KV_REST_API_URL;
    const restApiToken = process.env.KV_REST_API_TOKEN;

    if (restApiUrl && restApiToken) {
      // Use REST API URL (preferred for sandbox environment)
      this.client = new Redis({
        url: restApiUrl,
        token: restApiToken,
        automaticDeserialization: false,
      } as any);
    } else {
      // Fall back to rediss:// URL
      this.client = new Redis({
        url: redisUrl,
        automaticDeserialization: false,
      } as any);
    }
  }

  async connect() {
    if (!this.connected) {
      try {
        // Test connection with PING
        const pong = await this.client.ping();
        if (pong === 'PONG') {
          this.connected = true;
          console.log('[REDIS] Connected successfully');
          return;
        }
      } catch (error) {
        console.error(
          `[REDIS] Connection failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }
  }

  async disconnect() {
    // @upstash/redis doesn't require explicit disconnection
    this.connected = false;
  }

  private getJobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  private getLockKey(jobId: string): string {
    return `lock:${jobId}`;
  }

  async addJob(url: string, source?: string, query?: string): Promise<string | null> {
    // Check queue size with backpressure
    const pendingCount = (await this.client.llen('queue:pending')) as number;
    if (pendingCount >= this.maxQueuedJobs) {
      console.error(
        `[QUEUE] Queue overloaded: ${pendingCount}/${this.maxQueuedJobs} - rejecting new jobs`
      );
      return null;
    }

    // Normalize URL
    const { normalized: normalizedUrl, domain } = normalizeUrl(url);

    // Check for duplicates
    const existingJobId = await this.findJobByNormalizedUrl(normalizedUrl);
    if (existingJobId) {
      console.log(
        `[QUEUE] Duplicate detected: ${normalizedUrl} (existing: ${existingJobId})`
      );
      return existingJobId;
    }

    const jobId = uuidv4();
    const job: Job = {
      id: jobId,
      url,
      normalizedUrl,
      domain,
      source,
      query,
      status: 'pending',
      emails: [],
      retries: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
      attempts: 0,
    };

    // Store entire job as JSON string with TTL
    const jobKey = this.getJobKey(jobId);
    const jobJson = JSON.stringify(job);
    
    // Set job with TTL for automatic cleanup (7 days)
    await this.client.set(jobKey, jobJson, { ex: 604800 });
    
    // Add to pending index (LIST for queue operations)
    await this.client.rpush('queue:pending', jobId);
    
    // Add to pending SET for metrics
    await this.client.sadd('jobs:pending', jobId);
    
    // Add to normalized URL index for deduplication
    await this.client.set(`idx:url:${normalizedUrl}`, jobId, { ex: 86400 }); // 24h TTL

    console.log(`[QUEUE] Job added: ${jobId} - URL: ${normalizedUrl} (pending: ${pendingCount + 1})`);
    return jobId;
  }

  /**
   * Check if a normalized URL already has a job
   */
  private async findJobByNormalizedUrl(normalizedUrl: string): Promise<string | null> {
    const existingJobId = (await this.client.get(
      `idx:url:${normalizedUrl}`
    )) as string | null;
    return existingJobId;
  }

  /**
   * Get current queue size (all jobs, all statuses)
   */
  async getQueueSize(): Promise<number> {
    const keys = (await this.client.keys('job:*')) as string[];
    return keys.length;
  }

  async getNextJob(): Promise<Job | null> {
    // Get pending job ID from queue (LPOP for FIFO)
    const jobId = (await this.client.lpop('queue:pending')) as string | null;

    if (!jobId) {
      return null;
    }

    // Try to acquire lock atomically with SETNX
    const lockKey = this.getLockKey(jobId);
    const workerId = `worker:${process.pid}:${Date.now()}`;

    // SET NX EX: atomic operation, only succeeds if key doesn't exist
    const lockResult = await this.client.set(lockKey, workerId, {
      nx: true,
      ex: 35, // 35 second lock
    });

    if (lockResult === 'OK') {
      // Lock acquired successfully
      const job = await this.getJob(jobId);

      if (job && job.status === 'pending') {
        // Mark as processing
        job.status = 'processing';
        job.startedAt = Date.now();
        await this.client.set(this.getJobKey(jobId), JSON.stringify(job));

        // Update indexes: remove from pending, add to processing
        await this.client.srem('jobs:pending', jobId);
        await this.client.sadd('jobs:processing', jobId);

        console.log(`[QUEUE] Claimed job: ${jobId} with lock - URL: ${job.url}`);
        return job;
      } else {
        // Job already processed, release lock and re-add to pending if needed
        await this.client.del(lockKey);
        if (job?.status === 'pending') {
          await this.client.rpush('queue:pending', jobId);
        }
        return null;
      }
    } else {
      // Could not acquire lock, re-add to pending for next attempt
      await this.client.rpush('queue:pending', jobId);
      return null;
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    const jobJson = (await this.client.get(this.getJobKey(jobId))) as string | null;

    if (!jobJson) {
      console.log(`[QUEUE] Job not found: ${jobId}`);
      return null;
    }

    try {
      const job = JSON.parse(jobJson) as Job;
      console.log(`[QUEUE] Retrieved job: ${jobId} - URL: ${job.url}`);
      return job;
    } catch (error) {
      console.error(`[QUEUE] Failed to parse job ${jobId}: ${error}`);
      return null;
    }
  }

  async markCompleted(jobId: string, emails: string[]): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      const now = Date.now();
      job.status = 'completed';
      job.emails = emails;
      job.emailsFound = emails.length;
      job.completedAt = now;
      if (job.startedAt) {
        job.processingTime = now - job.startedAt;
      }

      // Store updated job with TTL for completed jobs (24 hours)
      await this.client.set(this.getJobKey(jobId), JSON.stringify(job), { ex: 86400 });
      
      // Update indexes
      await this.client.srem('jobs:processing', jobId);
      await this.client.sadd('jobs:completed', jobId);
      
      // Clear lock
      await this.client.del(this.getLockKey(jobId));

      console.log(
        `[QUEUE] Job completed: ${jobId} - found ${emails.length} emails in ${job.processingTime}ms`
      );
    }
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      const now = Date.now();
      job.status = 'failed';
      job.error = error;
      job.completedAt = now;
      if (job.startedAt) {
        job.processingTime = now - job.startedAt;
      }

      // Store updated job with TTL for failed jobs (48 hours)
      await this.client.set(this.getJobKey(jobId), JSON.stringify(job), { ex: 172800 });
      
      // Update indexes
      await this.client.srem('jobs:processing', jobId);
      await this.client.sadd('jobs:failed', jobId);
      
      // Clear lock
      await this.client.del(this.getLockKey(jobId));

      console.log(
        `[QUEUE] Job failed: ${jobId} - Error: ${error} (${job.processingTime}ms)`
      );
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job && job.retries < job.maxRetries) {
      job.status = 'pending';
      job.retries++;
      job.startedAt = null;

      // Store updated job as JSON and add back to queue
      await this.client.set(this.getJobKey(jobId), JSON.stringify(job));
      await this.client.rpush('queue:pending', jobId);
      
      // Update indexes: remove from failed/processing, add to pending
      await this.client.srem('jobs:processing', jobId);
      await this.client.srem('jobs:failed', jobId);
      await this.client.sadd('jobs:pending', jobId);
      
      await this.client.del(this.getLockKey(jobId));

      console.log(
        `[QUEUE] Job requeued: ${jobId} - retry ${job.retries}/${job.maxRetries}`
      );
    }
  }

  async clearLock(jobId: string): Promise<void> {
    const lockKey = this.getLockKey(jobId);
    await this.client.del(lockKey);
  }

  async getJobsInState(status: JobStatus): Promise<Job[]> {
    const keys = (await this.client.keys('job:*')) as string[];
    const jobs: Job[] = [];

    for (const key of keys) {
      const jobJson = (await this.client.get(key)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson) as Job;
          if (job.status === status) {
            jobs.push(job);
          }
        } catch (error) {
          console.error(`[QUEUE] Failed to parse ${key}: ${error}`);
        }
      }
    }

    return jobs;
  }

  async getAllJobs(): Promise<Job[]> {
    const keys = (await this.client.keys('job:*')) as string[];
    const jobs: Job[] = [];

    for (const key of keys) {
      const jobJson = (await this.client.get(key)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson) as Job;
          jobs.push(job);
        } catch (error) {
          console.error(`[QUEUE] Failed to parse ${key}: ${error}`);
        }
      }
    }

    return jobs;
  }

  /**
   * Get queue statistics using Redis indexes
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    avgProcessingTime: number;
  }> {
    // Use SET cardinality for fast counts
    const pending = (await this.client.scard('jobs:pending')) as number;
    const processing = (await this.client.scard('jobs:processing')) as number;
    const completed = (await this.client.scard('jobs:completed')) as number;
    const failed = (await this.client.scard('jobs:failed')) as number;
    
    const stats = {
      total: pending + processing + completed + failed,
      pending,
      processing,
      completed,
      failed,
      avgProcessingTime: 0,
    };

    // Calculate average processing time from completed jobs
    let totalProcessingTime = 0;
    let processedCount = 0;

    const completedIds = (await this.client.smembers('jobs:completed')) as string[];
    for (const jobId of completedIds) {
      const job = await this.getJob(jobId);
      if (job && job.processingTime) {
        totalProcessingTime += job.processingTime;
        processedCount++;
      }
    }

    if (processedCount > 0) {
      stats.avgProcessingTime = Math.round(totalProcessingTime / processedCount);
    }

    return stats;
  }
}
