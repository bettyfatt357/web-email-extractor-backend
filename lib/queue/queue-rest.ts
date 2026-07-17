import axios from 'axios';
import { Job, JobStatus } from './types';
import { randomBytes } from 'crypto';

function uuidv4() {
  return randomBytes(16).toString('hex');
}

export class EmailQueue {
  private baseUrl: string;
  private token: string;
  private connected = false;
  private maxRetries = 3;
  private jobTimeout = 20000; // 20 seconds

  constructor(redisUrl: string, restApiUrl?: string, restApiToken?: string) {
    if (!restApiUrl || !restApiToken) {
      // Try to parse from environment
      restApiUrl = process.env.KV_REST_API_URL || restApiUrl;
      restApiToken = process.env.KV_REST_API_TOKEN || restApiToken;
    }

    if (!restApiUrl || !restApiToken) {
      throw new Error('Upstash REST API URL and token are required');
    }

    this.baseUrl = restApiUrl;
    this.token = restApiToken;
  }

  async connect() {
    if (!this.connected) {
      try {
        // Test connection
        const response = await axios.get(`${this.baseUrl}/ping`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          timeout: 10000,
        });
        this.connected = true;
        console.log('[QUEUE] Connected to Upstash Redis via REST API');
      } catch (error) {
        console.error(
          `[QUEUE] Failed to connect: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }
  }

  async disconnect() {
    // REST API doesn't need explicit disconnection
    this.connected = false;
  }

  private getJobKey(jobId: string): string {
    return `job:${jobId}`;
  }

  private getLockKey(jobId: string): string {
    return `lock:${jobId}`;
  }

  private async request(command: string, args: any[] = []): Promise<any> {
    const url = `${this.baseUrl}/`;
    const payload = [command, ...args];

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Upstash REST API returns { result: ... }
    if (response.data && typeof response.data === 'object' && 'result' in response.data) {
      return response.data.result;
    }

    return response.data;
  }

  private async hset(key: string, data: Record<string, string>): Promise<void> {
    const args = [key];
    for (const [k, v] of Object.entries(data)) {
      args.push(k, v);
    }

    await this.request('HSET', args);
  }

  private async hgetall(key: string): Promise<Record<string, string>> {
    const result = await this.request('HGETALL', [key]);
    const obj: Record<string, string> = {};
    if (Array.isArray(result)) {
      for (let i = 0; i < result.length; i += 2) {
        obj[result[i]] = result[i + 1];
      }
    }
    return obj;
  }

  private async lpop(key: string): Promise<string | null> {
    const result = await this.request('LPOP', [key]);
    return result || null;
  }

  private async rpush(key: string, ...values: string[]): Promise<void> {
    await this.request('RPUSH', [key, ...values]);
  }

  private async setnx(
    key: string,
    value: string,
    exSecs: number
  ): Promise<boolean> {
    const response = await this.request('SET', [
      key,
      value,
      'NX',
      'EX',
      String(exSecs),
    ]);

    return response === 'OK';
  }

  private async del(key: string): Promise<void> {
    await this.request('DEL', [key]);
  }

  private async keys(pattern: string): Promise<string[]> {
    const result = await this.request('KEYS', [pattern]);
    return Array.isArray(result) ? result : [];
  }

  async addJob(url: string): Promise<string> {
    const jobId = uuidv4();
    const job: Job = {
      id: jobId,
      url,
      status: 'pending',
      emails: [],
      retries: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
    };

    await this.hset(this.getJobKey(jobId), this.jobToMap(job));
    await this.rpush('queue:pending', jobId);

    console.log(`[QUEUE] Job added: ${jobId} - URL: ${url}`);
    return jobId;
  }

  async getNextJob(workerId: string): Promise<Job | null> {
    // Get the next pending job ID
    const jobId = await this.lpop('queue:pending');

    if (!jobId) {
      return null;
    }

    // Try to acquire lock using SETNX
    const lockKey = this.getLockKey(jobId);
    const lockAcquired = await this.setnx(lockKey, workerId, 35);

    if (!lockAcquired) {
      // Another worker claimed this job, put it back
      await this.rpush('queue:pending', jobId);
      return null;
    }

    // Lock acquired, mark as processing
    const job = await this.getJob(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = Date.now();
      await this.hset(this.getJobKey(jobId), this.jobToMap(job));
      console.log(
        `[QUEUE] Locked job: ${jobId} by worker: ${workerId}`
      );
    }

    return job;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const data = await this.hgetall(this.getJobKey(jobId));

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this.mapToJob(data);
  }

  async markProcessing(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      job.status = 'processing';
      job.startedAt = Date.now();
      await this.hset(this.getJobKey(jobId), this.jobToMap(job));
    }
  }

  async markCompleted(jobId: string, emails: string[]): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      job.status = 'completed';
      job.emails = emails;
      job.completedAt = Date.now();
      await this.hset(this.getJobKey(jobId), this.jobToMap(job));
      await this.clearLock(jobId);
      console.log(
        `[QUEUE] Job completed: ${jobId} - found ${emails.length} emails`
      );
    }
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.completedAt = Date.now();
      await this.hset(this.getJobKey(jobId), this.jobToMap(job));
      await this.clearLock(jobId);
      console.log(`[QUEUE] Job failed: ${jobId} - Error: ${error}`);
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job && job.retries < job.maxRetries) {
      job.status = 'pending';
      job.retries++;
      job.startedAt = null;
      await this.hset(this.getJobKey(jobId), this.jobToMap(job));
      await this.rpush('queue:pending', jobId);
      await this.clearLock(jobId);
      console.log(
        `[QUEUE] Job requeued: ${jobId} - retry ${job.retries}/${job.maxRetries}`
      );
    }
  }

  async clearLock(jobId: string): Promise<void> {
    const lockKey = this.getLockKey(jobId);
    await this.del(lockKey);
  }

  async getJobsInState(status: JobStatus): Promise<Job[]> {
    const keys = await this.keys('job:*');
    const jobs: Job[] = [];

    for (const key of keys) {
      const data = await this.hgetall(key);
      const job = this.mapToJob(data);
      if (job && job.status === status) {
        jobs.push(job);
      }
    }

    return jobs;
  }

  async getAllJobs(): Promise<Job[]> {
    const keys = await this.keys('job:*');
    const jobs: Job[] = [];

    for (const key of keys) {
      const data = await this.hgetall(key);
      const job = this.mapToJob(data);
      if (job) {
        jobs.push(job);
      }
    }

    return jobs;
  }

  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const jobs = await this.getAllJobs();
    return {
      pending: jobs.filter((j) => j.status === 'pending').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    };
  }

  private jobToMap(job: Job): Record<string, string> {
    return {
      id: job.id,
      url: job.url,
      status: job.status,
      emails: JSON.stringify(job.emails),
      retries: String(job.retries),
      maxRetries: String(job.maxRetries),
      createdAt: String(job.createdAt),
      startedAt: String(job.startedAt ?? ''),
      completedAt: String(job.completedAt ?? ''),
      error: job.error ?? '',
    };
  }

  private mapToJob(data: Record<string, string>): Job {
    return {
      id: data.id,
      url: data.url,
      status: data.status as JobStatus,
      emails: data.emails ? JSON.parse(data.emails) : [],
      retries: parseInt(data.retries, 10),
      maxRetries: parseInt(data.maxRetries, 10),
      createdAt: parseInt(data.createdAt, 10),
      startedAt: data.startedAt ? parseInt(data.startedAt, 10) : null,
      completedAt: data.completedAt
        ? parseInt(data.completedAt, 10)
        : null,
      error: data.error || null,
    };
  }
}
