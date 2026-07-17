import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { withDashboardAuth, DashboardAuthRequest } from '@/lib/auth/middleware-dashboard';

/**
 * GET /api/metrics
 * System health metrics endpoint
 * 
 * Authentication: Supabase session (dashboard)
 */
async function handler(request: DashboardAuthRequest) {
  try {
    // Initialize Redis client
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Get counts from job indexes using SET cardinality (fast O(1) operation)
    const pending = (await redis.scard('jobs:pending')) as number;
    const processing = (await redis.scard('jobs:processing')) as number;
    const completed = (await redis.scard('jobs:completed')) as number;
    const failed = (await redis.scard('jobs:failed')) as number;

    // Get sample of completed jobs to calculate average processing time
    const completedIds = (await redis.smembers('jobs:completed')) as string[];
    let avgProcessingTime = 0;
    let totalTime = 0;
    let count = 0;

    // Sample up to 100 completed jobs for performance
    const sampleSize = Math.min(100, completedIds.length);
    for (let i = 0; i < sampleSize; i++) {
      const jobId = completedIds[i];
      const jobJson = (await redis.get(`job:${jobId}`)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          if (job.processingTime) {
            totalTime += job.processingTime;
            count++;
          }
        } catch (error) {
          // Skip malformed jobs
        }
      }
    }

    if (count > 0) {
      avgProcessingTime = Math.round(totalTime / count);
    }

    const metrics = {
      timestamp: Date.now(),
      queue: {
        pending,
        processing,
        completed,
        failed,
        total: pending + processing + completed + failed,
      },
      performance: {
        avgProcessingTimeMs: avgProcessingTime,
        throughput: {
          completedPerHour: Math.round((completed / 3600) * 1000), // Rough estimate
          failureRate: completed + failed > 0 ? (failed / (completed + failed)) * 100 : 0,
        },
      },
      health: {
        backpressureActive: pending > 5000,
        queueHealthy: pending < 5000 && failed < completed,
        avgProcessingTimeHealthy: avgProcessingTime < 20000,
      },
    };

    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/metrics
 * Endpoint documentation
 */
async function optionsHandler(request: DashboardAuthRequest) {
  return NextResponse.json(
    {
      methods: ['GET'],
      description: 'Get system health metrics',
      endpoint: 'GET /api/metrics',
      response: {
        timestamp: 'number - current timestamp',
        queue: {
          pending: 'number - jobs waiting',
          processing: 'number - jobs being processed',
          completed: 'number - successfully completed jobs',
          failed: 'number - failed jobs',
          total: 'number - total jobs',
        },
        performance: {
          avgProcessingTimeMs: 'number - average job processing time',
          throughput: {
            completedPerHour: 'number - estimated completion rate',
            failureRate: 'number - percentage of jobs that failed',
          },
        },
        health: {
          backpressureActive: 'boolean - queue is backed up',
          queueHealthy: 'boolean - queue is in good state',
          avgProcessingTimeHealthy: 'boolean - processing time is acceptable',
        },
      },
    },
    { status: 200 }
  );
}

export const GET = withDashboardAuth(handler);
export const OPTIONS = withDashboardAuth(optionsHandler);
