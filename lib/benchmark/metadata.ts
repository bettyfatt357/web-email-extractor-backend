/**
 * Collect benchmark metadata for reproducibility
 */

import { execSync } from 'child_process';
import { BenchmarkMetadata, PreflightStatus } from './types';

const BENCHMARK_VERSION = '1.0';

export function collectMetadata(
  preflightStatus: PreflightStatus,
  environment: 'local' | 'staging' | 'production' = 'local'
): BenchmarkMetadata {
  let gitCommit = 'unknown';

  // Try to get git commit hash
  try {
    gitCommit = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    // If git is not available or in a git repo, continue with 'unknown'
  }

  return {
    benchmarkVersion: BENCHMARK_VERSION,
    timestamp: new Date().toISOString(),
    gitCommit,
    nodeVersion: process.version,
    environment,
    preflightStatus,
  };
}
