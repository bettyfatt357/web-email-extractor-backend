import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment from project root
config({ path: resolve(__dirname, '../.env.development.local') });

const REDIS_URL = process.env.REDIS_URL;
const REST_API_URL = process.env.KV_REST_API_URL;
const REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

if (!REDIS_URL && !REST_API_URL) {
  console.error('[TEST] Missing REDIS_URL or KV_REST_API_URL environment variable');
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Connect to Redis using Upstash SDK (prefer REST API)
let redis;
if (REST_API_URL && REST_API_TOKEN) {
  redis = new Redis({
    url: REST_API_URL,
    token: REST_API_TOKEN,
    automaticDeserialization: false,
  });
} else {
  redis = new Redis({
    url: REDIS_URL,
    automaticDeserialization: false,
  });
}

async function testSystem() {
  console.log('');
  console.log('==============================================');
  console.log('   EMAIL EXTRACTION BACKEND - TEST RUN');
  console.log('==============================================');
  console.log('');

  try {
    // Test Redis connection
    console.log('[TEST] Testing Redis connection...');
    try {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }
      console.log('[REDIS] Connected successfully');
    } catch (error) {
      console.error('[TEST] Redis connection failed:', error.message);
      throw error;
    }
    console.log('');

    // Clear previous jobs AND locks
    console.log('[TEST] Clearing previous jobs and data...');
    const oldJobKeys = await redis.keys('job:*');
    const oldLockKeys = await redis.keys('lock:*');
    const keysToDelete = [...oldJobKeys, ...oldLockKeys, 'queue:pending'];
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
    console.log(`[TEST] Cleared ${oldJobKeys.length} old jobs, ${oldLockKeys.length} locks`);
    console.log('');

    // Add test jobs
    console.log('[TEST] Adding test jobs to queue...');
    const testUrls = [
      'https://example.com',
      'https://github.com',
      'https://nodejs.org',
    ];

    const jobIds = [];
    for (const url of testUrls) {
      const jobId = Math.random().toString(16).slice(2, 10);
      const job = {
        id: jobId,
        url,
        status: 'pending',
        emails: [],
        retries: 0,
        maxRetries: 3,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        error: null,
      };

      // Store entire job as JSON string
      await redis.set(`job:${jobId}`, JSON.stringify(job));
      await redis.rpush('queue:pending', jobId);
      jobIds.push(jobId);

      console.log(`✓ Job added: ${jobId} - ${url}`);
    }
    console.log('');

    // Wait for worker to process
    console.log('[TEST] Waiting for worker to process jobs (30 seconds max)...');
    let startTime = Date.now();
    const maxWaitTime = 30000; // 30 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const pendingCount = await redis.llen('queue:pending');
      console.log(`[TEST] Pending jobs: ${pendingCount}`);

      // Check if all jobs are done (completed or failed)
      let allDone = true;
      let processedCount = 0;
      
      for (const jobId of jobIds) {
        const jobJson = (await redis.get(`job:${jobId}`)) || null;
        let status = 'unknown';
        
        if (jobJson) {
          try {
            const jobData = JSON.parse(jobJson);
            status = String(jobData.status || 'unknown');
          } catch (error) {
            status = 'error';
          }
        }
        
        if (status === 'completed' || status === 'failed') {
          processedCount++;
        } else if (status !== 'pending') {
          // Job is in processing
          allDone = false;
        }
      }

      if (processedCount === jobIds.length && allDone) {
        console.log('[TEST] All jobs processed!');
        break;
      }

      if (pendingCount === 0 && processedCount > 0) {
        console.log(`[TEST] ${processedCount}/${jobIds.length} jobs completed`);
      }

      await sleep(1000);
    }

    console.log('');

    // Get job details
    console.log('[TEST] Job Details:');
    console.log('');

    let completedCount = 0;
    let failedCount = 0;
    let totalEmails = 0;

    for (const jobId of jobIds) {
      const jobJson = (await redis.get(`job:${jobId}`)) || null;

      if (!jobJson) {
        console.log(`[TEST]   Job ${jobId}: NOT FOUND`);
        continue;
      }

      let jobData;
      try {
        jobData = JSON.parse(jobJson);
      } catch (error) {
        console.log(`[TEST]   Job ${jobId}: PARSE ERROR`);
        continue;
      }

      const emails = jobData.emails || [];
      const status = jobData.status || 'unknown';

      console.log(`[TEST]   Job ${jobId}:`);
      console.log(`[TEST]     Status: ${status}`);
      console.log(`[TEST]     URL: ${jobData.url}`);
      console.log(`[TEST]     Emails found: ${emails.length}`);

      if (emails.length > 0) {
        console.log(`[TEST]     Samples: ${emails.slice(0, 2).join(', ')}`);
        totalEmails += emails.length;
      }

      if (status === 'completed') {
        completedCount++;
      } else if (status === 'failed') {
        failedCount++;
        console.log(`[TEST]     Error: ${jobData.error}`);
      }

      console.log('');
    }

    // Final status
    console.log('==============================================');
    console.log('   FINAL STATUS');
    console.log('==============================================');
    console.log(`Total jobs: ${jobIds.length}`);
    console.log(`Completed: ${completedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Total emails found: ${totalEmails}`);
    console.log('');

    // Check for stuck jobs
    const allJobs = (await redis.keys('job:*')) || [];
    let stuckCount = 0;

    for (const key of allJobs) {
      const jobJson = (await redis.get(key)) || null;
      if (jobJson) {
        try {
          const jobData = JSON.parse(jobJson);
          if (jobData.status === 'processing') {
            stuckCount++;
            console.log(`⚠️  STUCK JOB: ${jobData.id} - ${jobData.url}`);
          }
        } catch (error) {
          // Skip parse errors
        }
      }
    }

    console.log('');

    if (stuckCount === 0) {
      console.log('✓ ZERO jobs stuck in processing - SYSTEM COMPLETE');
    } else {
      console.log(`✗ WARNING: ${stuckCount} jobs stuck in processing!`);
    }

    console.log('==============================================');
    console.log('');
  } catch (error) {
    console.error('[TEST] Error:', error.message);
    process.exit(1);
  } finally {
    // Upstash Redis doesn't require explicit cleanup
  }
}

// Run test
testSystem().catch((error) => {
  console.error('[TEST] Fatal error:', error);
  process.exit(1);
});
