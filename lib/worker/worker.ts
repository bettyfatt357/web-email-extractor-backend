import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env files
config({ path: resolve(process.cwd(), '.env.development.local') });
config({ path: resolve(process.cwd(), '.env.local') });

import { EmailQueue } from '../queue/queue';
import { extractEmailsFromUrl } from '../extraction/engine';
import { Watchdog } from './watchdog';
import { randomBytes } from 'crypto';

function uuidv4() {
  return randomBytes(16).toString('hex');
}

export class Worker {
  private queue: EmailQueue;
  private watchdog: Watchdog;
  private workerId: string;
  private running = false;
  private jobTimeout = 20000; // 20 seconds
  private concurrency = 1; // Number of concurrent jobs
  private activeJobs = 0; // Currently processing jobs
  private requestDelayMs = 200; // Rate limiting: delay between jobs
  private lastJobTime = 0; // Track last job processing time

  constructor(redisUrl: string, concurrency?: number) {
    this.queue = new EmailQueue(redisUrl);
    this.watchdog = new Watchdog(this.queue);
    this.workerId = `worker-${uuidv4().slice(0, 8)}`;
    
    // Get concurrency from env or parameter
    if (concurrency) {
      this.concurrency = concurrency;
    } else if (process.env.WORKER_CONCURRENCY) {
      this.concurrency = parseInt(process.env.WORKER_CONCURRENCY, 10) || 1;
    }
    
    // Get rate limiting delay from env
    if (process.env.REQUEST_DELAY_MS) {
      this.requestDelayMs = parseInt(process.env.REQUEST_DELAY_MS, 10) || 200;
    }
    
    console.log(`[${this.workerId}] Configured for ${this.concurrency} concurrent jobs, ${this.requestDelayMs}ms delay`);
  }

  async start() {
    try {
      await this.queue.connect();
      console.log(`[${this.workerId}] Connected to Redis`);
    } catch (error) {
      console.error(
        `[${this.workerId}] Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }

    this.running = true;
    console.log(`[${this.workerId}] Started with ${this.concurrency} concurrent worker loops`);

    // Start watchdog
    this.watchdog.start();

    // Start multiple concurrent worker loops
    for (let i = 0; i < this.concurrency; i++) {
      this.startWorkerLoop(i);
    }
  }

  private async startWorkerLoop(loopIndex: number) {
    console.log(`[${this.workerId}:LOOP-${loopIndex}] Starting worker loop`);
    
    while (this.running) {
      try {
        const job = await this.queue.getNextJob();

        if (!job) {
          // No jobs available, wait before next check
          await this.sleep(1000);
          continue;
        }

        // Apply rate limiting
        const timeSinceLastJob = Date.now() - this.lastJobTime;
        if (timeSinceLastJob < this.requestDelayMs) {
          await this.sleep(this.requestDelayMs - timeSinceLastJob);
        }
        this.lastJobTime = Date.now();

        // Process job
        await this.processJob(job);
      } catch (error) {
        console.error(
          `[${this.workerId}:LOOP-${loopIndex}] Error: ${error instanceof Error ? error.message : String(error)}`
        );
        await this.sleep(1000);
      }
    }

    console.log(`[${this.workerId}:LOOP-${loopIndex}] Stopped`);
  }



  /**
   * Process a single job
   */
  private async processJob(job: { id: string; url: string }) {
    try {
      console.log(
        `[${this.workerId}] Processing job: ${job.id} - URL: ${job.url}`
      );

      try {
        // Extract emails with timeout
        const emails = await Promise.race([
          extractEmailsFromUrl(job.url),
          this.timeout(this.jobTimeout),
        ]);

        console.log(
          `[${this.workerId}] Job ${job.id} completed - found ${emails.length} emails`
        );

        // Mark as completed
        await this.queue.markCompleted(job.id, emails);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        console.log(`[${this.workerId}] Job ${job.id} failed - ${errorMsg}`);

        // Mark as failed
        await this.queue.markFailed(job.id, errorMsg);
      }
    } catch (error) {
      console.error(
        `[${this.workerId}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async stop() {
    this.running = false;
    this.watchdog.stop();
    await this.queue.disconnect();
    console.log(`[WORKER] Stopped`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Job timeout after ${ms}ms`)), ms)
    );
  }
}

// Graceful shutdown
let worker: Worker;

async function shutdown() {
  console.log(`\n[WORKER] Shutting down...`);
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Main entry point
if (process.env.REDIS_URL) {
  const concurrency = process.env.WORKER_CONCURRENCY
    ? parseInt(process.env.WORKER_CONCURRENCY, 10)
    : 1;
  worker = new Worker(process.env.REDIS_URL, concurrency);
  worker.start().catch((error) => {
    console.error(`[WORKER] Failed to start: ${error}`);
    process.exit(1);
  });
} else {
  console.error('[WORKER] REDIS_URL environment variable is required');
  process.exit(1);
}
