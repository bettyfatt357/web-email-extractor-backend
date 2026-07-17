import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Redis } from '@upstash/redis';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
config({ path: resolve(__dirname, '../.env.development.local') });

const REST_API_URL = process.env.KV_REST_API_URL;
const REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const API_BASE = 'http://localhost:3000/api';

if (!REST_API_URL || !REST_API_TOKEN) {
  console.error('[TEST] Missing KV_REST_API_URL or KV_REST_API_TOKEN');
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Connect to Redis using Upstash SDK
const redis = new Redis({
  url: REST_API_URL,
  token: REST_API_TOKEN,
  automaticDeserialization: false,
});

async function main() {
  console.log('========== JOB STATUS API TEST ==========\n');

  try {
    // Test Redis connection
    console.log('[TEST] Testing Redis connection...');
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    console.log('[REDIS] Connected successfully\n');

    // Clear old data
    console.log('[TEST] Clearing previous data...');
    const oldJobKeys = await redis.keys('job:*');
    const oldLockKeys = await redis.keys('lock:*');
    const keysToDelete = [...oldJobKeys, ...oldLockKeys, 'queue:pending'];
    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
    console.log(`[TEST] Cleared ${oldJobKeys.length} old jobs\n`);

    // Add test jobs
    console.log('[TEST] Adding test jobs...');
    const testUrls = [
      'https://example.com',
      'https://github.com',
      'https://vercel.com',
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

      await redis.set(`job:${jobId}`, JSON.stringify(job));
      await redis.rpush('queue:pending', jobId);
      jobIds.push(jobId);

      console.log(`✓ Job added: ${jobId} - ${url}`);
    }
    console.log('');

    // Wait for Next.js server to be ready
    console.log('[TEST] Waiting for Next.js server to be ready...');
    for (let i = 0; i < 10; i++) {
      try {
        await axios.get(`${API_BASE}/jobs`, { timeout: 2000 });
        console.log('[API] Server is ready\n');
        break;
      } catch (error) {
        if (i < 9) {
          process.stdout.write('.');
          await sleep(1000);
        } else {
          console.log('\n[WARNING] Server not responding, continuing anyway...\n');
        }
      }
    }

    // Poll job status in real-time
    console.log('========== REAL-TIME STATUS TRACKING ==========\n');
    let trackingDone = false;
    let statusCount = 0;

    while (!trackingDone && statusCount < 30) {
      console.log(`\n[${new Date().toLocaleTimeString()}] Status Check #${statusCount + 1}:`);

      let allCompleted = true;

      for (const jobId of jobIds) {
        try {
          const statusResponse = await axios.get(
            `${API_BASE}/job/${jobId}/status`,
            { timeout: 5000 }
          );

          const { status, progress, duration, retries } = statusResponse.data;
          const durationSec = (duration / 1000).toFixed(2);

          console.log(
            `  Job ${jobId}: status=${status}, progress=${progress}%, duration=${durationSec}s, retries=${retries}`
          );

          if (status !== 'completed' && status !== 'failed') {
            allCompleted = false;
          }

          // If completed, also fetch results
          if (status === 'completed') {
            try {
              const resultResponse = await axios.get(
                `${API_BASE}/job/${jobId}/result`,
                { timeout: 5000 }
              );
              const { totalEmails, emails } = resultResponse.data;
              console.log(
                `    → Found ${totalEmails} emails: ${emails.slice(0, 2).join(', ')}${emails.length > 2 ? '...' : ''}`
              );
            } catch (resultError) {
              // Might still be processing
            }
          }
        } catch (error) {
          if (error.response?.status === 404) {
            console.log(`  Job ${jobId}: NOT FOUND`);
          } else {
            console.log(`  Job ${jobId}: ERROR - ${error.message}`);
          }
          allCompleted = false;
        }
      }

      if (allCompleted) {
        console.log('\n[TEST] All jobs completed!');
        trackingDone = true;
      } else {
        statusCount++;
        if (statusCount < 30) {
          await sleep(2000);
        }
      }
    }

    // Fetch final results
    console.log('\n========== FINAL RESULTS ==========\n');
    for (const jobId of jobIds) {
      try {
        const response = await axios.get(`${API_BASE}/job/${jobId}`, {
          timeout: 5000,
        });
        const job = response.data;

        console.log(`Job ${jobId}:`);
        console.log(`  URL: ${job.url}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Emails: ${job.emails.length}`);
        if (job.error) {
          console.log(`  Error: ${job.error}`);
        }
        if (job.completedAt && job.startedAt) {
          const duration = ((job.completedAt - job.startedAt) / 1000).toFixed(2);
          console.log(`  Duration: ${duration}s`);
        }
      } catch (error) {
        console.log(`Job ${jobId}: Failed to fetch`);
      }
    }

    // Get all jobs overview
    console.log('\n========== ALL JOBS OVERVIEW ==========\n');
    try {
      const allJobsResponse = await axios.get(`${API_BASE}/jobs`, {
        timeout: 5000,
      });
      const { total, pending, processing, completed, failed } = allJobsResponse.data;

      console.log(`Total jobs: ${total}`);
      console.log(`  Pending: ${pending.length}`);
      console.log(`  Processing: ${processing.length}`);
      console.log(`  Completed: ${completed.length}`);
      console.log(`  Failed: ${failed.length}`);
    } catch (error) {
      console.log(`Failed to fetch jobs overview: ${error.message}`);
    }

    console.log('\n========== TEST COMPLETE ==========');
  } catch (error) {
    console.error('[TEST] Error:', error.message);
    process.exit(1);
  }
}

main();
