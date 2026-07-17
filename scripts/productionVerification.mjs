#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment from project root
config({ path: resolve(__dirname, '../.env.development.local') });

function uuidv4() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Production Verification Test
 * Tests the complete extraction pipeline with 20 real websites
 */

const TEST_WEBSITES = [
  // Static HTML websites
  { url: 'https://example.com', type: 'static' },
  { url: 'https://www.w3.org', type: 'static' },
  { url: 'https://tools.ietf.org', type: 'static' },
  
  // Company websites (often have contact pages)
  { url: 'https://www.apple.com', type: 'company' },
  { url: 'https://www.microsoft.com', type: 'company' },
  { url: 'https://www.google.com', type: 'company' },
  { url: 'https://www.amazon.com', type: 'company' },
  
  // University websites (usually have contact info)
  { url: 'https://www.harvard.edu', type: 'university' },
  { url: 'https://www.mit.edu', type: 'university' },
  { url: 'https://www.stanford.edu', type: 'university' },
  { url: 'https://www.yale.edu', type: 'university' },
  
  // Tech companies (JavaScript-heavy)
  { url: 'https://www.github.com', type: 'tech' },
  { url: 'https://www.vercel.com', type: 'tech' },
  { url: 'https://www.npm.js.org', type: 'tech' },
  { url: 'https://www.docker.com', type: 'tech' },
  
  // News/content sites (JavaScript-heavy)
  { url: 'https://www.bbc.com', type: 'news' },
  { url: 'https://www.cnn.com', type: 'news' },
  
  // Other public sites
  { url: 'https://www.wikipedia.org', type: 'reference' },
  { url: 'https://www.github.com/about', type: 'info' },
  { url: 'https://www.mozilla.org', type: 'nonprofit' },
];

async function setupRedis() {
  const REST_API_URL = process.env.KV_REST_API_URL;
  const REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
  const REDIS_URL = process.env.REDIS_URL;

  let redis;
  if (REST_API_URL && REST_API_TOKEN) {
    redis = new Redis({
      url: REST_API_URL,
      token: REST_API_TOKEN,
    });
  } else if (REDIS_URL) {
    redis = new Redis({
      url: REDIS_URL,
    });
  } else {
    console.error('[VERIFY] Missing Redis configuration');
    process.exit(1);
  }

  // Verify connection
  try {
    await redis.ping();
    return redis;
  } catch (error) {
    console.error('[VERIFY] Redis connection failed:', error.message);
    process.exit(1);
  }
}

async function addJobsToQueue(redis, websites) {
  console.log('\n[VERIFY] Adding jobs to queue...');
  
  const jobIds = [];
  let jobCount = 0;
  let duplicates = 0;

  for (const website of websites) {
    try {
      const jobId = uuidv4().slice(0, 8);
      const job = {
        id: jobId,
        url: website.url,
        status: 'pending',
        emails: [],
        retries: 0,
        maxRetries: 3,
        createdAt: Date.now(),
        startedAt: null,
        completedAt: null,
        error: null,
        source: 'production-verification',
        query: website.type,
      };

      // Store job
      await redis.set(`job:${jobId}`, JSON.stringify(job));
      await redis.rpush('queue:pending', jobId);
      jobIds.push(jobId);
      jobCount++;

      console.log(`  ✓ [${jobCount}/${websites.length}] Job ${jobId} added: ${website.url} (${website.type})`);
    } catch (error) {
      console.error(`  ✗ Failed to add job for ${website.url}:`, error.message);
    }
  }

  console.log(`\n[VERIFY] Total jobs added: ${jobCount}`);
  return jobIds;
}

async function monitorJobProgress(redis, jobIds, duration = 60000) {
  console.log(`\n[VERIFY] Monitoring job progress for ${duration / 1000}s...`);
  console.log('[VERIFY] Note: Actual extraction may be slow due to website variations\n');

  const startTime = Date.now();
  let lastReportTime = startTime;
  const reportInterval = 5000; // Report every 5 seconds

  while (Date.now() - startTime < duration) {
    const now = Date.now();
    if (now - lastReportTime >= reportInterval) {
      let pending = 0;
      let processing = 0;
      let completed = 0;
      let failed = 0;
      let totalEmails = 0;

      for (const jobId of jobIds) {
        const jobJson = (await redis.get(`job:${jobId}`)) || null;
        if (jobJson) {
          try {
            const job = JSON.parse(jobJson);
            if (job.status === 'pending') pending++;
            else if (job.status === 'processing') processing++;
            else if (job.status === 'completed') {
              completed++;
              totalEmails += job.emails?.length || 0;
            } else if (job.status === 'failed') failed++;
          } catch (error) {
            // Parse error
          }
        }
      }

      const elapsed = Math.round((now - startTime) / 1000);
      console.log(
        `[${elapsed}s] Pending: ${pending} | Processing: ${processing} | Completed: ${completed} | Failed: ${failed} | Emails: ${totalEmails}`
      );

      lastReportTime = now;
    }

    // Check if all jobs are done
    let allDone = true;
    for (const jobId of jobIds) {
      const jobJson = (await redis.get(`job:${jobId}`)) || null;
      if (jobJson) {
        const job = JSON.parse(jobJson);
        if (job.status === 'pending' || job.status === 'processing') {
          allDone = false;
          break;
        }
      }
    }

    if (allDone) {
      console.log('\n[VERIFY] All jobs completed!');
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function generateFinalReport(redis, jobIds) {
  console.log('\n========== PRODUCTION VERIFICATION REPORT ==========\n');

  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;
  let totalEmails = 0;
  let totalProcessingTime = 0;
  const results = [];

  for (const jobId of jobIds) {
    const jobJson = (await redis.get(`job:${jobId}`)) || null;
    if (jobJson) {
      try {
        const job = JSON.parse(jobJson);
        results.push(job);

        if (job.status === 'pending') pending++;
        else if (job.status === 'processing') processing++;
        else if (job.status === 'completed') {
          completed++;
          totalEmails += job.emails?.length || 0;
          if (job.processingTime) totalProcessingTime += job.processingTime;
        } else if (job.status === 'failed') failed++;
      } catch (error) {
        // Parse error
      }
    }
  }

  console.log('SUMMARY');
  console.log('-------');
  console.log(`Total Jobs: ${jobIds.length}`);
  console.log(`Pending: ${pending}`);
  console.log(`Processing: ${processing}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Emails Found: ${totalEmails}`);
  if (completed > 0) {
    console.log(`Avg Processing Time: ${Math.round(totalProcessingTime / completed)}ms`);
  }
  console.log(`Success Rate: ${completed}/${jobIds.length} (${Math.round((completed / jobIds.length) * 100)}%)`);

  console.log('\nDETAILED RESULTS');
  console.log('----------------');

  const byType = {};
  for (const result of results) {
    const type = result.query || 'unknown';
    if (!byType[type]) byType[type] = { total: 0, completed: 0, emails: 0 };
    byType[type].total++;
    if (result.status === 'completed') {
      byType[type].completed++;
      byType[type].emails += result.emails?.length || 0;
    }
  }

  for (const [type, stats] of Object.entries(byType)) {
    console.log(
      `\n${type.toUpperCase()}: ${stats.completed}/${stats.total} completed, ${stats.emails} emails found`
    );
  }

  console.log('\nCOMPLETED JOBS');
  console.log('--------------');
  for (const result of results.filter(r => r.status === 'completed')) {
    console.log(
      `✓ ${result.url}: ${result.emails?.length || 0} emails (${result.processingTime}ms)`
    );
  }

  console.log('\nFAILED JOBS');
  console.log('-----------');
  for (const result of results.filter(r => r.status === 'failed')) {
    console.log(`✗ ${result.url}: ${result.error}`);
  }

  console.log('\nSTICK JOBS (STILL PROCESSING)');
  console.log('-----------------------------');
  const stuckJobs = results.filter(r => r.status === 'processing');
  if (stuckJobs.length === 0) {
    console.log('✓ No stuck jobs detected!');
  } else {
    for (const job of stuckJobs) {
      console.log(`⚠ ${job.url}: Processing since ${new Date(job.startedAt).toISOString()}`);
    }
  }

  console.log('\n================================================\n');

  return {
    total: jobIds.length,
    pending,
    processing,
    completed,
    failed,
    stuckJobs: stuckJobs.length,
    totalEmails,
  };
}

async function main() {
  console.log('\n========== PRODUCTION VERIFICATION TEST ==========');
  console.log('Date:', new Date().toISOString());
  console.log('Testing complete extraction pipeline with 20 real websites');
  console.log('\nTest includes:');
  console.log('  - Static HTML websites');
  console.log('  - JavaScript-heavy sites');
  console.log('  - Company websites');
  console.log('  - University websites');

  // Setup Redis
  const redis = await setupRedis();
  console.log('✓ Redis connection established');

  // Add jobs to queue
  const jobIds = await addJobsToQueue(redis, TEST_WEBSITES);

  // Monitor progress
  await monitorJobProgress(redis, jobIds, 120000); // 2 minutes max

  // Generate report
  const report = await generateFinalReport(redis, jobIds);

  // Exit with status
  if (report.stuckJobs > 0) {
    console.error(`\n⚠ WARNING: ${report.stuckJobs} jobs still processing (may be stuck)`);
  }

  if (report.completed === 0 && report.failed === 0) {
    console.warn('\n⚠ No jobs completed - extraction may not be running');
    process.exit(1);
  }

  console.log('✓ Production verification complete');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
