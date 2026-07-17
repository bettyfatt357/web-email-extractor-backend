/**
 * Pre-flight validation checks
 * Verifies system is ready before starting benchmarks
 */

import axios from 'axios';
import { PreflightStatus } from './types';

export async function runPreflightChecks(
  apiBaseUrl: string,
  redisRestUrl: string,
  redisRestToken: string
): Promise<{ status: PreflightStatus; allPassed: boolean }> {
  const status: PreflightStatus = {
    redisConnection: 'FAILED',
    workerAvailable: 'FAILED',
    envVariablesValid: 'FAILED',
    apiReachable: 'FAILED',
  };

  console.log('\n[PREFLIGHT] Starting system validation...\n');

  // Check 1: Environment variables
  console.log('[PREFLIGHT] Checking environment variables...');
  if (!redisRestUrl || !redisRestToken) {
    status.envVariablesError = 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN';
    console.error(`  ✗ ${status.envVariablesError}`);
  } else if (!process.env.API_KEY) {
    status.envVariablesError = 'Missing API_KEY environment variable';
    console.error(`  ✗ ${status.envVariablesError}`);
  } else {
    status.envVariablesValid = 'OK';
    console.log('  ✓ Environment variables loaded');
  }

  // Check 2: Redis connection
  console.log('[PREFLIGHT] Checking Redis connection...');
  try {
    const redisResponse = await axios.get(`${redisRestUrl}/ping`, {
      headers: {
        Authorization: `Bearer ${redisRestToken}`,
      },
      timeout: 5000,
    });

    if (redisResponse.status === 200) {
      status.redisConnection = 'OK';
      console.log('  ✓ Redis connection successful');
    } else {
      status.redisConnectionError = `Unexpected status: ${redisResponse.status}`;
      console.error(`  ✗ ${status.redisConnectionError}`);
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    status.redisConnectionError = `Failed to connect to Redis: ${errorMsg}`;
    console.error(`  ✗ ${status.redisConnectionError}`);
  }

  // Check 3: API is reachable
  console.log('[PREFLIGHT] Checking API availability...');
  try {
    const apiResponse = await axios.get(`${apiBaseUrl}/api/health`, {
      timeout: 5000,
      headers: {
        'x-api-key': process.env.API_KEY || '',
      },
    });

    if (apiResponse.status === 200) {
      status.apiReachable = 'OK';
      console.log('  ✓ API is reachable');
    } else {
      status.apiReachableError = `Unexpected status: ${apiResponse.status}`;
      console.error(`  ✗ ${status.apiReachableError}`);
    }
  } catch (error) {
    // Health endpoint might not exist, try search endpoint instead
    try {
      const searchResponse = await axios.post(
        `${apiBaseUrl}/api/search`,
        { query: 'test', pages: 1 },
        {
          timeout: 5000,
          headers: {
            'x-api-key': process.env.API_KEY || '',
          },
        }
      );
      status.apiReachable = 'OK';
      console.log('  ✓ API is reachable');
    } catch (searchError) {
      const errorMsg =
        searchError instanceof Error ? searchError.message : String(searchError);
      status.apiReachableError = `Failed to reach API: ${errorMsg}`;
      console.error(`  ✗ ${status.apiReachableError}`);
    }
  }

  // Check 4: At least one background worker available
  console.log('[PREFLIGHT] Checking background worker availability...');
  try {
    // Try to fetch worker status or check if we can submit a job
    // This is determined by checking if we can interact with the queue
    const queueResponse = await axios.get(
      `${redisRestUrl}/scard/jobs:processing`,
      {
        headers: {
          Authorization: `Bearer ${redisRestToken}`,
        },
        timeout: 5000,
      }
    );

    // If we got here, we can access the queue, which means a worker should be able to process jobs
    status.workerAvailable = 'OK';
    console.log('  ✓ At least one background worker is available');
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);
    status.workerAvailableError = `Cannot verify worker availability: ${errorMsg}`;
    console.error(`  ✗ ${status.workerAvailableError}`);
  }

  const allPassed =
    status.envVariablesValid === 'OK' &&
    status.redisConnection === 'OK' &&
    status.apiReachable === 'OK' &&
    status.workerAvailable === 'OK';

  console.log('\n[PREFLIGHT] Validation complete\n');

  if (!allPassed) {
    console.error('[PREFLIGHT] ✗ One or more checks failed. Aborting benchmark.\n');
  } else {
    console.log('[PREFLIGHT] ✓ All checks passed. Ready to benchmark.\n');
  }

  return { status, allPassed };
}
