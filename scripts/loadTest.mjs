#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
config({ path: resolve(__dirname, '../.env.development.local') });

const REST_API_URL = process.env.KV_REST_API_URL;
const REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

if (!REST_API_URL || !REST_API_TOKEN) {
  console.error('Missing KV_REST_API_URL or KV_REST_API_TOKEN');
  process.exit(1);
}

const redis = new Redis({
  url: REST_API_URL,
  token: REST_API_TOKEN,
  automaticDeserialization: false,
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.protocol = 'https:';
    parsed.hostname = parsed.hostname.toLowerCase();
    
    // Remove tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid'].forEach((p) => {
      parsed.searchParams.delete(p);
    });
    
    let normalized = parsed.toString();
    if (normalized.endsWith('/') && parsed.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function loadTest() {
  console.log(`
========================================
   LOAD TEST - 100+ CONCURRENT JOBS
========================================
`);

  // Clear Redis
  console.log('Clearing Redis data...');
  const allKeys = await redis.keys('*');
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
  }
  console.log('✓ Redis cleared\n');

  // Create test URLs
  const testUrls = [
    // Real sites
    'https://github.com',
    'https://www.github.com/',
    'https://github.com?utm_source=test', // Duplicate after normalization
    'https://example.com',
    'https://example.com/',
    'https://vercel.com',
    'https://VERCEL.COM/', // Case variant
    'https://nextjs.org',
    'https://react.dev',
    'https://typescript.org',
    // More URLs to reach 100+
    ...Array.from({ length: 90 }, (_, i) => `https://example${i}.com/contact`),
  ];

  console.log(`Adding ${testUrls.length} jobs to queue...`);
  let duplicates = 0;
  let added = 0;
  const jobIds = [];

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    const normalized = await normalizeUrl(url);
    
    // Check for duplicate
    const existingJobId = await redis.get(`idx:url:${normalized}`);
    if (existingJobId) {
      duplicates++;
      console.log(`  [${i + 1}/${testUrls.length}] DUPLICATE: ${url}`);
      continue;
    }

    // Create job
    const jobId = Math.random().toString(16).slice(2, 10);
    const job = {
      id: jobId,
      url,
      normalizedUrl: normalized,
      status: 'pending',
      emails: [],
      retries: 0,
      maxRetries: 3,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      error: null,
      attempts: 0,
    };

    await redis.set(`job:${jobId}`, JSON.stringify(job));
    await redis.rpush('queue:pending', jobId);
    await redis.set(`idx:url:${normalized}`, jobId, { ex: 86400 });

    jobIds.push(jobId);
    added++;

    if (added % 10 === 0) {
      console.log(`  [${i + 1}/${testUrls.length}] Added ${added} jobs...`);
    }
  }

  console.log(`✓ Added ${added} jobs`);
  console.log(`✓ Duplicates prevented: ${duplicates}\n`);

  // Get queue stats
  console.log('Queue Statistics:');
  const pendingCount = await redis.llen('queue:pending');
  console.log(`  Pending jobs: ${pendingCount}`);
  console.log(`  Total job keys: ${added}`);

  // Show sample job
  if (jobIds.length > 0) {
    const sampleJob = JSON.parse(
      await redis.get(`job:${jobIds[0]}`)
    );
    console.log(`\nSample Job (${jobIds[0]}):`);
    console.log(`  URL: ${sampleJob.url}`);
    console.log(`  Normalized: ${sampleJob.normalizedUrl}`);
    console.log(`  Status: ${sampleJob.status}`);
  }

  console.log(`\n========================================
   WAITING FOR WORKER TO PROCESS
========================================

Worker should process ${added} jobs concurrently.
Watching for progress...
`);

  // Monitor progress
  let lastProcessedCount = 0;
  let checkInterval = setInterval(async () => {
    const now = new Date().toLocaleTimeString();
    
    const allKeys = await redis.keys('job:*');
    const jobs = [];
    for (const key of allKeys) {
      const json = await redis.get(key);
      if (json) jobs.push(JSON.parse(json));
    }

    const pending = jobs.filter((j) => j.status === 'pending').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;

    const processedCount = completed + failed;
    const newlyProcessed = processedCount - lastProcessedCount;

    console.log(
      `[${now}] Pending: ${pending} | Processing: ${processing} | Completed: ${completed} | Failed: ${failed} | (${newlyProcessed} new)`
    );

    lastProcessedCount = processedCount;

    // Stop when all jobs done
    if (pending === 0 && processing === 0) {
      clearInterval(checkInterval);
      
      console.log(`\n========================================
   FINAL RESULTS
========================================\n`);

      console.log(`Total jobs added: ${added}`);
      console.log(`Completed: ${completed}`);
      console.log(`Failed: ${failed}`);
      console.log(`Success rate: ${((completed / added) * 100).toFixed(1)}%`);

      // Show failed jobs
      if (failed > 0) {
        console.log(`\nFailed jobs:`);
        jobs.filter((j) => j.status === 'failed').forEach((j) => {
          console.log(`  - ${j.id}: ${j.error}`);
        });
      }

      // Check for stuck jobs
      const stuck = jobs.filter((j) => j.status === 'processing');
      if (stuck.length > 0) {
        console.log(`\n⚠️  WARNING: ${stuck.length} jobs still stuck in processing!`);
      } else {
        console.log(`\n✓ ZERO jobs stuck in processing`);
      }

      console.log(`\n========================================
   CONCURRENCY TEST COMPLETE
========================================`);
      
      process.exit(0);
    }
  }, 2000);

  // Auto-exit after 2 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
    console.log(`\n⏱️  Test timeout after 2 minutes`);
    process.exit(1);
  }, 120000);
}

loadTest().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
