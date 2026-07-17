#!/usr/bin/env node

/**
 * Google PSE Search Pipeline Test
 * 
 * Tests the complete flow:
 * 1. Configure Google PSE
 * 2. Call search API endpoint
 * 3. Verify URLs are added to queue
 * 4. Watch worker process them
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';
const SEARCH_QUERIES = [
  { query: 'digital marketing agencies London', pages: 1 },
  { query: 'tech startups San Francisco', pages: 1 },
];

/**
 * Test search endpoint
 */
async function testSearch() {
  console.log('\n========================================');
  console.log('  GOOGLE PSE SEARCH PIPELINE TEST');
  console.log('========================================\n');

  // Check if server is running
  try {
    console.log('[TEST] Checking API server...');
    const healthResponse = await fetch(`${API_BASE}/api/search`);
    if (!healthResponse.ok) {
      throw new Error(`Server responded with ${healthResponse.status}`);
    }
    const healthData = await healthResponse.json();
    console.log(`[TEST] Server OK: ${healthData.message}\n`);

    if (!healthData.configured) {
      console.error(
        '[TEST] Google PSE not configured. Set GOOGLE_API_KEY and GOOGLE_CX.\n'
      );
      return;
    }
  } catch (error) {
    console.error(
      `[TEST] Cannot connect to API: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error('[TEST] Make sure Next.js dev server is running: npm run dev\n');
    return;
  }

  // Run searches
  let totalJobsCreated = 0;
  const allJobIds = [];

  for (const testCase of SEARCH_QUERIES) {
    try {
      console.log(`[TEST] Starting search: "${testCase.query}" (${testCase.pages} page(s))`);

      const response = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[TEST] Search failed: ${error.error}`);
        console.error(`       Details: ${error.details}`);
        continue;
      }

      const result = await response.json();

      console.log(`[TEST] Search completed:`);
      console.log(`       Original query: "${result.query}"`);
      console.log(`       Enhanced query: "${result.enhancedQuery}"`);
      console.log(`       Search ID: ${result.searchId}`);
      console.log(`       Total URLs found: ${result.totalUrlsFound}`);
      console.log(`       Successfully queued: ${result.totalQueued}`);
      console.log(`       Duplicates removed: ${result.duplicatesRemoved}`);
      console.log(`       Skipped (filtered): ${result.skipped}`);
      console.log(`       Job IDs: ${result.jobIds.slice(0, 3).join(', ')}${result.jobIds.length > 3 ? ` ... +${result.jobIds.length - 3} more` : ''}\n`);

      totalJobsCreated += result.totalQueued;
      allJobIds.push(...result.jobIds);
    } catch (error) {
      console.error(
        `[TEST] Error: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  }

  console.log(`[TEST] Total jobs created: ${totalJobsCreated}`);

  // Monitor jobs in real-time
  if (totalJobsCreated > 0) {
    console.log('\n[TEST] Monitoring job queue...\n');
    await monitorJobs(allJobIds);
  }

  console.log('\n========================================');
  console.log('  TEST COMPLETE');
  console.log('========================================\n');
}

/**
 * Monitor job progression
 */
async function monitorJobs(jobIds) {
  let monitoringComplete = false;
  let iterations = 0;
  const maxIterations = 60; // ~30 seconds at 500ms per check

  while (!monitoringComplete && iterations < maxIterations) {
    try {
      const response = await fetch(`${API_BASE}/api/jobs`);
      const jobs = await response.json();

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      // Count job statuses
      for (const job of jobs.pending || []) {
        stats.pending++;
      }
      for (const job of jobs.processing || []) {
        stats.processing++;
      }
      for (const job of jobs.completed || []) {
        stats.completed++;
      }
      for (const job of jobs.failed || []) {
        stats.failed++;
      }

      console.log(
        `[${new Date().toLocaleTimeString()}] Pending: ${stats.pending} | Processing: ${stats.processing} | Completed: ${stats.completed} | Failed: ${stats.failed}`
      );

      // Check if we're done
      if (stats.pending === 0 && stats.processing === 0) {
        monitoringComplete = true;
        console.log('\n[TEST] All jobs processed!');
        console.log(`[TEST] Final results: ${stats.completed} completed, ${stats.failed} failed`);
      }

      // Sample job details
      if (jobs.completed && jobs.completed[0]) {
        const sample = jobs.completed[0];
        console.log(
          `[TEST] Sample result: ${sample.url} → ${sample.emails.length} emails found`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      iterations++;
    } catch (error) {
      console.error(`[TEST] Monitoring error: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!monitoringComplete) {
    console.log('\n[TEST] Monitoring timeout - not all jobs completed within time limit');
  }
}

// Run test
testSearch().catch(console.error);
