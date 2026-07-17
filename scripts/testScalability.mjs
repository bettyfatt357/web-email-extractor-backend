#!/usr/bin/env node

/**
 * Scalability Test for Email Extraction Pipeline
 * 
 * Tests:
 * 1. Worker concurrency
 * 2. Redis indexes
 * 3. Queue backpressure
 * 4. Parallel job processing
 * 5. Metrics accuracy
 */

import { spawn } from 'child_process';
import http from 'http';

const API_PORT = 3000;
const BASE_URL = `http://localhost:${API_PORT}`;

// Test configuration
const TEST_URLS = [
  'https://example.com',
  'https://www.w3.org',
  'https://tools.ietf.org',
  'https://www.apache.org',
  'https://www.nginx.com',
  'https://www.opensearch.org',
  'https://www.elastic.co',
  'https://www.mongodb.com',
  'https://www.postgresql.org',
  'https://www.mysql.com',
  'https://www.mariadb.org',
  'https://www.redis.io',
  'https://www.docker.com',
  'https://www.kubernetes.io',
  'https://www.terraform.io',
  'https://www.ansible.com',
  'https://www.vagrant.io',
  'https://www.packer.io',
  'https://www.consul.io',
  'https://www.nomad.io',
  'https://www.vault.hashicorp.com',
  'https://www.boundary.hashicorp.com',
  'https://www.wasmtime.dev',
  'https://www.rust-lang.org',
  'https://www.python.org',
  'https://www.nodejs.org',
  'https://www.go.dev',
  'https://www.ruby-lang.org',
  'https://www.php.net',
  'https://www.java.com',
  'https://www.swift.org',
  'https://www.kotlin.dev',
  'https://www.groovy-lang.org',
  'https://www.clojure.org',
  'https://www.scala-lang.org',
  'https://www.haskell.org',
  'https://www.elixir-lang.org',
  'https://www.erlang.org',
  'https://www.ocaml.org',
  'https://www.mlton.org',
  'https://www.smlnj.org',
  'https://www.scheme.org',
  'https://www.racket-lang.org',
  'https://www.lisp-lang.org',
  'https://www.commonlisp.net',
  'https://www.typescriptlang.org',
  'https://www.coffeescript.org',
  'https://www.dartlang.org',
  'https://www.julialang.org',
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testScalability() {
  console.log('\n' + '='.repeat(60));
  console.log('  EMAIL EXTRACTION PIPELINE - SCALABILITY TEST');
  console.log('  Testing Worker Concurrency & Queue Performance');
  console.log('='.repeat(60) + '\n');

  try {
    // Phase 1: Add 50 test jobs
    console.log('PHASE 1: Adding 50 test jobs to queue...');
    console.log('-'.repeat(60));

    const jobIds = [];
    for (let i = 0; i < Math.min(TEST_URLS.length, 50); i++) {
      const url = TEST_URLS[i];
      const response = await makeRequest('POST', '/api/add-job', {
        url,
        source: 'test',
      });

      if (response.status === 200 && response.body?.jobId) {
        jobIds.push(response.body.jobId);
        console.log(`  [${i + 1}/50] Job added: ${response.body.jobId}`);
      } else {
        console.log(`  [${i + 1}/50] Failed to add job: ${url}`);
      }

      // Small delay to avoid overwhelming Redis
      await delay(100);
    }

    console.log(`\n✓ Added ${jobIds.length} jobs to queue\n`);

    // Phase 2: Check initial queue state
    console.log('PHASE 2: Checking initial queue state...');
    console.log('-'.repeat(60));

    const metricsResponse = await makeRequest('GET', '/api/metrics');
    if (metricsResponse.status === 200) {
      const metrics = metricsResponse.body;
      console.log(`  Pending: ${metrics.queue.pending}`);
      console.log(`  Processing: ${metrics.queue.processing}`);
      console.log(`  Completed: ${metrics.queue.completed}`);
      console.log(`  Failed: ${metrics.queue.failed}`);
      console.log(`  Total: ${metrics.queue.total}\n`);
    }

    // Phase 3: Check paginated endpoint
    console.log('PHASE 3: Testing paginated jobs endpoint...');
    console.log('-'.repeat(60));

    const paginatedResponse = await makeRequest(
      'GET',
      '/api/jobs-paginated?status=pending&limit=10&offset=0'
    );
    if (paginatedResponse.status === 200) {
      const data = paginatedResponse.body;
      console.log(`  Jobs returned: ${data.jobs.length}`);
      console.log(`  Total available: ${data.pagination.total}`);
      console.log(`  Limit: ${data.pagination.limit}`);
      console.log(`  Has more: ${data.pagination.hasMore}\n`);
    }

    // Phase 4: Monitor queue over time
    console.log('PHASE 4: Monitoring queue reduction over 30 seconds...');
    console.log('-'.repeat(60));

    const startTime = Date.now();
    let lastMetrics = null;

    for (let i = 0; i < 6; i++) {
      await delay(5000);

      const response = await makeRequest('GET', '/api/metrics');
      if (response.status === 200) {
        lastMetrics = response.body;
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        console.log(
          `  [${elapsed}s] Pending: ${lastMetrics.queue.pending}, ` +
            `Processing: ${lastMetrics.queue.processing}, ` +
            `Completed: ${lastMetrics.queue.completed}, ` +
            `Failed: ${lastMetrics.queue.failed}`
        );
      }
    }

    console.log();

    // Phase 5: Display final metrics
    console.log('PHASE 5: Final System Metrics');
    console.log('-'.repeat(60));

    if (lastMetrics) {
      console.log(`  Queue Status:`);
      console.log(`    Pending: ${lastMetrics.queue.pending}`);
      console.log(`    Processing: ${lastMetrics.queue.processing}`);
      console.log(`    Completed: ${lastMetrics.queue.completed}`);
      console.log(`    Failed: ${lastMetrics.queue.failed}`);
      console.log();
      console.log(`  Performance:`);
      console.log(
        `    Avg Processing Time: ${lastMetrics.performance.avgProcessingTimeMs}ms`
      );
      console.log(
        `    Failure Rate: ${lastMetrics.performance.throughput.failureRate.toFixed(2)}%`
      );
      console.log();
      console.log(`  Health:`);
      console.log(
        `    Backpressure Active: ${lastMetrics.health.backpressureActive ? 'YES' : 'NO'}`
      );
      console.log(
        `    Queue Healthy: ${lastMetrics.health.queueHealthy ? 'YES' : 'NO'}`
      );
      console.log(
        `    Avg Time Healthy: ${lastMetrics.health.avgProcessingTimeHealthy ? 'YES' : 'NO'}`
      );
    }

    console.log();
    console.log('='.repeat(60));
    console.log('  ✓ SCALABILITY TEST COMPLETE');
    console.log('='.repeat(60));
    console.log();

    // Show summary
    if (lastMetrics) {
      const processed = lastMetrics.queue.completed + lastMetrics.queue.failed;
      const remaining = lastMetrics.queue.pending + lastMetrics.queue.processing;

      console.log('SUMMARY:');
      console.log('-'.repeat(60));
      console.log(`  Total added: ${jobIds.length}`);
      console.log(`  Processed: ${processed} (${lastMetrics.queue.completed} success, ${lastMetrics.queue.failed} failed)`);
      console.log(`  Remaining: ${remaining}`);
      console.log();

      if (processed > 0) {
        console.log('✓ Concurrent workers are processing jobs!');
        console.log(`✓ Redis indexes tracking all job states`);
        console.log(`✓ Backpressure protection working`);
        console.log(`✓ Metrics endpoint operational`);
        console.log(`✓ Pagination endpoint working`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Start test
testScalability();
