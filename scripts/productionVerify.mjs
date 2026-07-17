#!/usr/bin/env node

import('dotenv').then(async (d) => {
  d.config({path: '.env.development.local'});
  const { Redis } = await import('@upstash/redis');

  const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  function uuidv4() {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes.join('').substring(0, 8);
  }

  const TEST_WEBSITES = [
    { url: 'https://example.com', type: 'static' },
    { url: 'https://www.w3.org', type: 'static' },
    { url: 'https://tools.ietf.org', type: 'static' },
    { url: 'https://www.apple.com', type: 'company' },
    { url: 'https://www.microsoft.com', type: 'company' },
    { url: 'https://www.google.com', type: 'company' },
    { url: 'https://www.amazon.com', type: 'company' },
    { url: 'https://www.harvard.edu', type: 'university' },
    { url: 'https://www.mit.edu', type: 'university' },
    { url: 'https://www.stanford.edu', type: 'university' },
    { url: 'https://www.yale.edu', type: 'university' },
    { url: 'https://www.github.com', type: 'tech' },
    { url: 'https://www.vercel.com', type: 'tech' },
    { url: 'https://www.npmjs.org', type: 'tech' },
    { url: 'https://www.docker.com', type: 'tech' },
    { url: 'https://www.bbc.com', type: 'news' },
    { url: 'https://www.cnn.com', type: 'news' },
    { url: 'https://www.wikipedia.org', type: 'reference' },
    { url: 'https://www.github.com/about', type: 'info' },
    { url: 'https://www.mozilla.org', type: 'nonprofit' },
  ];

  console.log('\n========== PRODUCTION VERIFICATION TEST ==========');
  console.log('Date:', new Date().toISOString());
  console.log('Testing: Complete extraction pipeline');
  console.log('Websites: 20 real public sites\n');

  // Clear old test data
  console.log('[VERIFY] Clearing old test data...');
  const oldKeys = await redis.keys('job:*');
  if (oldKeys && oldKeys.length > 0) {
    // Only delete keys from production-verification source
    for (const key of oldKeys) {
      const jobJson = await redis.get(key);
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          if (job.source === 'production-verification') {
            await redis.del(key);
          }
        } catch (e) {
          // Skip
        }
      }
    }
  }
  await redis.del('queue:pending');
  console.log('✓ Cleared previous test data\n');

  // Add jobs
  console.log('[VERIFY] Adding jobs to queue...');
  const jobIds = [];
  let count = 0;

  for (const website of TEST_WEBSITES) {
    try {
      const jobId = uuidv4();
      const job = {
        id: jobId,
        url: website.url,
        normalizedUrl: website.url.toLowerCase().replace(/\/$/, ''),
        domain: new URL(website.url).hostname,
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
        attempts: 0,
      };

      await redis.set(`job:${jobId}`, JSON.stringify(job));
      await redis.rpush('queue:pending', jobId);
      jobIds.push(jobId);
      count++;
      console.log(`  [${count}/${TEST_WEBSITES.length}] ${website.url} (${website.type})`);
    } catch (error) {
      console.error(`  ✗ Failed to add job:`, error.message);
    }
  }

  console.log(`\n✓ Added ${count} jobs to queue\n`);

  // Monitor progress
  console.log('[VERIFY] Monitoring job progress for 120 seconds...\n');
  const startTime = Date.now();
  let lastReport = startTime;
  let allDone = false;

  while (Date.now() - startTime < 120000) {
    const now = Date.now();

    if (now - lastReport >= 5000 || allDone) {
      let pending = 0;
      let processing = 0;
      let completed = 0;
      let failed = 0;
      let totalEmails = 0;

      for (const jobId of jobIds) {
        const jobJson = await redis.get(`job:${jobId}`);
        if (jobJson) {
          try {
            const job = JSON.parse(jobJson);
            if (job.status === 'pending') pending++;
            else if (job.status === 'processing') processing++;
            else if (job.status === 'completed') {
              completed++;
              totalEmails += job.emails?.length || 0;
            } else if (job.status === 'failed') failed++;
          } catch (e) {
            // Parse error
          }
        }
      }

      const elapsed = Math.round((now - startTime) / 1000);
      console.log(
        `[${elapsed}s] Pending: ${pending} | Processing: ${processing} | Completed: ${completed} | Failed: ${failed} | Emails: ${totalEmails}`
      );

      lastReport = now;

      // Check if all jobs are done
      if (pending === 0 && processing === 0) {
        allDone = true;
        console.log('\n✓ All jobs completed!');
        break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final report
  console.log('\n========== FINAL VERIFICATION REPORT ==========\n');

  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;
  let totalEmails = 0;
  let stuckJobs = 0;
  const results = [];

  for (const jobId of jobIds) {
    const jobJson = await redis.get(`job:${jobId}`);
    if (jobJson) {
      try {
        const job = JSON.parse(jobJson);
        results.push(job);

        if (job.status === 'pending') pending++;
        else if (job.status === 'processing') {
          processing++;
          stuckJobs++;
        } else if (job.status === 'completed') {
          completed++;
          totalEmails += job.emails?.length || 0;
        } else if (job.status === 'failed') failed++;
      } catch (e) {
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
  console.log(`Success Rate: ${completed}/${jobIds.length} (${Math.round((completed / jobIds.length) * 100)}%)`);

  console.log('\nBY TYPE');
  console.log('-------');
  const byType = {};
  for (const result of results) {
    const type = result.query || 'unknown';
    if (!byType[type]) byType[type] = { total: 0, completed: 0, failed: 0, emails: 0 };
    byType[type].total++;
    if (result.status === 'completed') {
      byType[type].completed++;
      byType[type].emails += result.emails?.length || 0;
    } else if (result.status === 'failed') {
      byType[type].failed++;
    }
  }

  for (const [type, stats] of Object.entries(byType)) {
    console.log(
      `${type}: ${stats.completed}/${stats.total} completed, ${stats.failed} failed, ${stats.emails} emails`
    );
  }

  console.log('\nCOMPLETED JOBS');
  console.log('--------------');
  const completedJobs = results.filter(r => r.status === 'completed');
  if (completedJobs.length === 0) {
    console.log('(none yet - extraction may be slow or still running)');
  } else {
    for (const job of completedJobs.slice(0, 5)) {
      console.log(`✓ ${job.url}: ${job.emails?.length || 0} emails (${job.processingTime}ms)`);
    }
    if (completedJobs.length > 5) {
      console.log(`  ... and ${completedJobs.length - 5} more`);
    }
  }

  console.log('\nFAILED JOBS');
  console.log('-----------');
  const failedJobs = results.filter(r => r.status === 'failed');
  if (failedJobs.length === 0) {
    console.log('(none)');
  } else {
    for (const job of failedJobs.slice(0, 5)) {
      console.log(`✗ ${job.url}: ${job.error}`);
    }
    if (failedJobs.length > 5) {
      console.log(`  ... and ${failedJobs.length - 5} more`);
    }
  }

  console.log('\nSTUCK JOBS DETECTION');
  console.log('-------------------');
  if (stuckJobs === 0) {
    console.log('✓ No stuck jobs detected!');
  } else {
    console.log(`⚠ ${stuckJobs} job(s) still processing`);
  }

  console.log('\n============================================\n');
  console.log('✓ Production verification test complete');
  console.log(`Status: ${completed > 0 ? 'SUCCESS' : 'INCOMPLETE'}`);

  process.exit(0);
});
