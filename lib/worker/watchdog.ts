import { EmailQueue } from '../queue/queue';

export class Watchdog {
  private queue: EmailQueue;
  private checkInterval = 10000; // 10 seconds
  private stuckTimeout = 30000; // 30 seconds
  private running = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(queue: EmailQueue) {
    this.queue = queue;
  }

  start() {
    if (this.running) {
      console.log('[WATCHDOG] Already running');
      return;
    }

    this.running = true;
    console.log('[WATCHDOG] Starting watchdog (checks every 10s)');

    this.intervalId = setInterval(() => {
      this.check();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('[WATCHDOG] Stopped');
  }

  private async check() {
    try {
      const processingJobs = await this.queue.getJobsInState(
        'processing'
      );
      const now = Date.now();

      for (const job of processingJobs) {
        if (!job.startedAt) {
          continue;
        }

        const elapsedTime = now - job.startedAt;

        // Check if stuck (>30 seconds in processing)
        if (elapsedTime > this.stuckTimeout) {
          console.log(
            `[WATCHDOG] Detected stuck job: ${job.id} (${elapsedTime}ms in processing)`
          );

          // Retry if under max retries
          if (job.retries < job.maxRetries) {
            await this.queue.retryJob(job.id);
            console.log(
              `[WATCHDOG] Recovered stuck job ${job.id} - retry ${job.retries + 1}/${job.maxRetries}`
            );
          } else {
            // Mark as failed
            await this.queue.markFailed(
              job.id,
              'Exceeded max retries (stuck processing)'
            );
            console.log(
              `[WATCHDOG] PERMANENTLY FAILED job ${job.id} - max retries exceeded`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `[WATCHDOG] Error during check: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
