# Email Extraction Backend System

A production-ready backend system for extracting emails from websites with robust job queue management, atomic locking, and automatic recovery of stuck jobs.

## System Architecture

### Core Components

1. **Email Queue** (`lib/queue/queue-rest.ts`)
   - Upstash Redis REST API-based job queue
   - Atomic locking using Redis SETNX operations
   - Prevents duplicate job processing with 35-second lock timeouts
   - Supports job states: pending, processing, completed, failed

2. **Worker** (`lib/worker/worker.ts`)
   - Continuous background process that polls the queue
   - Picks up jobs with atomic locking
   - Processes jobs with 20-second timeout
   - Logs all activity for monitoring

3. **Watchdog** (`lib/worker/watchdog.ts`)
   - Runs every 10 seconds automatically
   - Detects stuck jobs (processing >30 seconds)
   - Recovers stuck jobs by requeuing or marking as failed
   - Respects max retry limit (3 attempts)

4. **Extraction Engine** (`lib/extraction/engine.ts`)
   - Two-stage extraction: jsdom (fast) + Puppeteer (JavaScript-heavy sites)
   - Hard timeouts: 10s browser launch, 15s page navigation, 20s per job
   - Always closes browsers in finally blocks
   - Graceful fallback when extraction methods fail

5. **Email Deobfuscation** (`lib/extraction/deobfuscate.ts`)
   - Handles 9+ obfuscation patterns:
     - [at], (at), DOT, [dot] replacements
     - HTML entities
     - Base64 encoding
     - mailto links
     - URL encoding
     - ROT13
     - Reverse strings
     - JSON structured data
   - Normalizes and deduplicates results

## Installation

```bash
cd /vercel/share/v0-project
pnpm install
```

## Configuration

### Environment Variables

The system requires the following from Upstash Redis integration:

```env
KV_REST_API_URL=https://your-instance.upstash.io
KV_REST_API_TOKEN=your-token-here
```

These are automatically injected from `.env.development.local` via dotenv.

## Usage

### Start the Worker

```bash
npm run worker
```

Output:
```
[WORKER] Connected to Redis
[WORKER] Starting worker worker-xxxx...
[WATCHDOG] Starting watchdog (checks every 10s)
[WORKER] Picked job: job-id - processing URL: https://example.com
[EXTRACTION] jsdom succeeded in 145ms, found 5 emails
[WORKER] Job job-id completed - found 5 emails
[QUEUE] Job completed: job-id - found 5 emails
```

### Queue a Job Programmatically

```typescript
import { EmailQueue } from './lib/queue/queue-rest';

const queue = new EmailQueue(process.env.KV_REST_API_URL!, process.env.KV_REST_API_TOKEN!);
await queue.connect();

const jobId = await queue.addJob('https://example.com');
console.log(`Job queued: ${jobId}`);

// Check job status
const job = await queue.getJob(jobId);
console.log(`Job status: ${job.status}`); // pending, processing, completed, failed
```

### Run the Test

```bash
npm run worker > /tmp/worker.log 2>&1 &
node scripts/testRun.mjs
```

Test output shows:
- Jobs added to queue
- Worker picking up jobs
- Extraction completing
- Final queue status (all jobs processed, zero in processing)

## Job Processing Flow

1. **Job Creation**
   - URL added to `queue:pending` list
   - Job object stored in Redis hash with `job:id`
   - Status: `pending`, retries: 0

2. **Worker Pickup** (Atomic)
   - Worker calls `getNextJob()` with worker ID
   - SETNX attempts to acquire lock: `SET lock:id worker-id NX EX 35`
   - If lock acquired: job status → `processing`, startedAt set
   - If lock fails: another worker claimed it, job put back in queue

3. **Job Processing**
   - Extraction engine tries jsdom first (fast path)
   - If jsdom fails or times out, falls back to Puppeteer
   - Deobfuscates emails from page content
   - Normalizes and deduplicates results

4. **Job Completion**
   - If success: status → `completed`, emails stored, lock cleared
   - If error: status → `failed`, error message stored, lock cleared

5. **Watchdog Recovery** (Every 10s)
   - Scans for jobs with status = `processing`
   - If `now - startedAt > 30000ms`:
     - If `retries < maxRetries (3)`: requeue with incremented retry count
     - If `retries >= maxRetries`: mark as failed permanently

## Performance & Reliability

### Timeouts

- Browser launch: **10 seconds** (fail if longer)
- Page navigation: **15 seconds** (fail if longer)
- Job execution: **20 seconds** (fail if longer)
- Watchdog check: **Every 10 seconds**
- Lock lifetime: **35 seconds** (prevents duplicate processing)
- Stuck detection: **>30 seconds** in processing state

### Atomic Operations

- Redis SETNX ensures only ONE worker can claim a job
- Lock expires after 35 seconds even if worker dies
- No duplicate processing possible

### Retry Logic

- Max retries: 3 attempts per URL
- Stuck jobs automatically requeued
- Failed jobs marked after exceeding retries
- Each retry increments counter with automatic recovery

### Resource Management

- Puppeteer always closes browser in finally block
- No resource leaks even on failures
- Request timeouts prevent hanging
- Worker continues on errors (resilient loop)

## Job States and Transitions

```
pending → (worker picks) → processing → completed/failed
   ↑                           ↓
   ← (watchdog recovery if stuck > 30s)
```

- **pending**: Waiting to be processed
- **processing**: Currently being extracted (with lock)
- **completed**: Successfully extracted, emails stored
- **failed**: All retries exhausted or final error

## Monitoring

Watch the logs for these key indicators:

```bash
# Check worker is running
tail -f /tmp/worker.log | grep "WORKER"

# Monitor job processing
tail -f /tmp/worker.log | grep "Job"

# Watch for stuck jobs (watchdog recovery)
tail -f /tmp/worker.log | grep "WATCHDOG"
```

## API Reference

### EmailQueue

```typescript
class EmailQueue {
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  
  async addJob(url: string): Promise<string>
  async getNextJob(workerId: string): Promise<Job | null>
  async getJob(jobId: string): Promise<Job | null>
  
  async markProcessing(jobId: string): Promise<void>
  async markCompleted(jobId: string, emails: string[]): Promise<void>
  async markFailed(jobId: string, error: string): Promise<void>
  async retryJob(jobId: string): Promise<void>
  
  async getJobsInState(status: JobStatus): Promise<Job[]>
  async getAllJobs(): Promise<Job[]>
  async getQueueStatus(): Promise<QueueStatus>
}
```

### Job Interface

```typescript
interface Job {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  emails: string[];
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}
```

## Testing

### Unit Test

```bash
node scripts/testRun.mjs
```

Verifies:
- ✅ Jobs added to queue
- ✅ Worker picks jobs with atomic locking
- ✅ Extraction completes
- ✅ Queue empties completely
- ✅ ZERO jobs remain in processing

### Manual Test

Add a job and watch it process:

```typescript
const queue = new EmailQueue(url, token);
await queue.connect();

const jobId = await queue.addJob('https://example.com');
console.log(`Added job: ${jobId}`);

// Watch in separate terminal
// npm run worker

// Check status
await new Promise(r => setTimeout(r, 5000));
const job = await queue.getJob(jobId);
console.log(job); // Should show status: completed
```

## Troubleshooting

### Worker won't start

Check environment variables:
```bash
echo $KV_REST_API_URL
echo $KV_REST_API_TOKEN
```

### Jobs stuck in processing

The watchdog runs every 10 seconds and will automatically:
1. Detect jobs >30s in processing
2. Requeue if retries < 3
3. Mark failed if retries >= 3

Check logs for `[WATCHDOG]` messages.

### No emails extracted

Normal for example.com (no contact emails). The system works correctly:
- Uses two extraction methods
- Tries obfuscation decodings
- Returns results (empty if none found)

Test with a real contact page like a support page with emails.

## Architecture Decisions

1. **REST API over Redis Protocol**: Upstash REST API works reliably in all environments, no TLS certificate issues
2. **Atomic Locking**: Redis SETNX prevents race conditions without additional databases
3. **Watchdog Pattern**: Simple polling every 10s catches stuck jobs without complex monitoring
4. **Two-Stage Extraction**: jsdom for speed, Puppeteer for JavaScript-heavy pages
5. **Hard Timeouts**: Prevents resource exhaustion from hung requests
6. **Retry Limit**: 3 attempts balances resilience with avoiding infinite loops

## Future Enhancements

- Email validation against DNS/SMTP
- URL discovery with Google Custom Search API
- Parallel worker scaling
- Job priority levels
- Webhook notifications on completion
- Metrics dashboard
