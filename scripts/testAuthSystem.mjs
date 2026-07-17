#!/usr/bin/env node

/**
 * Test Auth System
 * 
 * Tests authentication, rate limiting, and billing system
 * Run with: node scripts/testAuthSystem.mjs
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║           AUTH & BILLING SYSTEM TEST                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, message) {
  const timestamp = new Date().toISOString().split('T')[1];
  const prefix = type === 'success' ? colors.green + '✓' :
                 type === 'error' ? colors.red + '✗' :
                 type === 'info' ? colors.blue + 'ℹ' :
                 type === 'warn' ? colors.yellow + '⚠' :
                 colors.cyan + '→';
  console.log(`${prefix} ${colors.reset}[${timestamp}] ${message}`);
}

/**
 * Test 1: Anonymous Access (if enabled)
 */
async function testAnonymousAccess() {
  log('info', 'Test 1: Anonymous Access');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`);
    const data = await response.json();

    if (response.status === 200 && data.authenticated === false) {
      log('success', 'Anonymous access allowed');
      return true;
    } else if (response.status === 401) {
      log('warn', 'Anonymous access disabled (expected if ALLOW_ANONYMOUS=false)');
      return true;
    }
  } catch (error) {
    log('error', `Anonymous test failed: ${error.message}`);
  }

  return false;
}

/**
 * Test 2: Auth with API Key
 */
async function testApiKeyAuth() {
  log('info', 'Test 2: API Key Authentication');

  const apiKey = 'sk_test_demo_key';

  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    const data = await response.json();

    if (response.status === 200 && data.authenticated) {
      log('success', `Authenticated with API key as user: ${data.user.id}`);
      log('info', `  Plan: ${data.user.plan}`);
      log('info', `  Rate limit: ${data.rateLimit.remaining}/${data.rateLimit.limit} remaining`);
      return true;
    } else if (response.status === 401) {
      log('error', `Invalid API key: ${data.error}`);
      return false;
    }
  } catch (error) {
    log('error', `Auth test failed: ${error.message}`);
  }

  return false;
}

/**
 * Test 3: Invalid API Key
 */
async function testInvalidApiKey() {
  log('info', 'Test 3: Invalid API Key Rejection');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'x-api-key': 'invalid_key_12345',
      },
    });

    if (response.status === 401) {
      log('success', 'Invalid API key correctly rejected with 401');
      return true;
    } else {
      log('error', `Expected 401, got ${response.status}`);
      return false;
    }
  } catch (error) {
    log('error', `Invalid key test failed: ${error.message}`);
  }

  return false;
}

/**
 * Test 4: Rate Limiting (simulate multiple requests)
 */
async function testRateLimiting() {
  log('info', 'Test 4: Rate Limit Check');

  const apiKey = 'sk_test_demo_key';

  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    const data = await response.json();

    if (data.rateLimit) {
      log('success', 'Rate limit status retrieved');
      log('info', `  Plan: ${data.rateLimit.plan}`);
      log('info', `  Limit: ${data.rateLimit.limit} requests/hour`);
      log('info', `  Used: ${data.rateLimit.used}`);
      log('info', `  Remaining: ${data.rateLimit.remaining}`);
      log('info', `  Resets at: ${new Date(data.rateLimit.resetTime).toLocaleTimeString()}`);
      return true;
    }
  } catch (error) {
    log('error', `Rate limit test failed: ${error.message}`);
  }

  return false;
}

/**
 * Test 5: Billing Status
 */
async function testBillingStatus() {
  log('info', 'Test 5: Billing Status');

  const apiKey = 'sk_test_demo_key';

  try {
    const response = await fetch(`${BASE_URL}/api/billing/status`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (response.status === 200) {
      const data = await response.json();
      log('success', 'Billing status retrieved');
      log('info', `  Plan: ${data.plan}`);
      log('info', `  Usage: ${data.usage.used}/${data.usage.limit} queries`);
      log('info', `  Remaining: ${data.usage.remaining}`);
      log('info', `  Usage rate: ${data.usage.percentageUsed}%`);
      return true;
    } else if (response.status === 401) {
      log('warn', 'Billing endpoint requires authentication');
      return true;
    }
  } catch (error) {
    log('error', `Billing status test failed: ${error.message}`);
  }

  return false;
}

/**
 * Test 6: Webhook Configuration
 */
async function testWebhookConfig() {
  log('info', 'Test 6: Stripe Webhook Configuration');

  try {
    const response = await fetch(`${BASE_URL}/api/billing/webhook`);
    const data = await response.json();

    if (data.configured) {
      log('success', 'Stripe webhook is configured');
    } else {
      log('warn', 'Stripe webhook not configured (STRIPE_WEBHOOK_SECRET not set)');
    }

    return true;
  } catch (error) {
    log('error', `Webhook config test failed: ${error.message}`);
  }

  return false;
}

/**
 * Test 7: Backward Compatibility
 */
async function testBackwardCompatibility() {
  log('info', 'Test 7: Backward Compatibility (OPTIONS /api/search)');

  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: 'OPTIONS',
    });

    if (response.status === 200) {
      const data = await response.json();
      log('success', 'Endpoint OPTIONS still works');
      log('info', `  Methods: ${data.methods.join(', ')}`);
      return true;
    }
  } catch (error) {
    log('error', `Compatibility test failed: ${error.message}`);
  }

  return false;
}

/**
 * Run all tests
 */
async function runAllTests() {
  const results = [];

  results.push(['Anonymous Access', await testAnonymousAccess()]);
  console.log();

  results.push(['API Key Auth', await testApiKeyAuth()]);
  console.log();

  results.push(['Invalid Key Rejection', await testInvalidApiKey()]);
  console.log();

  results.push(['Rate Limit Status', await testRateLimiting()]);
  console.log();

  results.push(['Billing Status', await testBillingStatus()]);
  console.log();

  results.push(['Webhook Config', await testWebhookConfig()]);
  console.log();

  results.push(['Backward Compatibility', await testBackwardCompatibility()]);
  console.log();

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  let passed = 0;
  for (const [name, result] of results) {
    const status = result ? colors.green + '✓ PASS' : colors.red + '✗ FAIL';
    console.log(`║ ${status}${colors.reset}  ${name.padEnd(50)} ║`);
    if (result) passed++;
  }

  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Total: ${passed}/${results.length} tests passed${' '.repeat(48 - String(passed).length - String(results.length).length)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (passed === results.length) {
    log('success', 'All tests passed!');
  } else {
    log('warn', `${results.length - passed} test(s) failed`);
  }
}

// Run tests
runAllTests().catch(error => {
  log('error', `Test suite failed: ${error.message}`);
  process.exit(1);
});
