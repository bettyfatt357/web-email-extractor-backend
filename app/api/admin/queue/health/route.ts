import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { withAuth, AuthedRequest } from '@/lib/auth/middleware';
import { withAdminAuth } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/queue/health
 * Queue health and performance metrics
 * Protected: Admin authorization required
 */
async function handler(request: AuthedRequest): Promise<NextResponse> {
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Get counts
    const pending = (await redis.scard('jobs:pending')) as number;
    const processing = (await redis.scard('jobs:processing')) as number;
    const completed = (await redis.scard('jobs:completed')) as number;
    const failed = (await redis.scard('jobs:failed')) as number;
    const total = pending + processing + completed + failed;

    // Get recently failed jobs (last hour)
    const failedIds = (await redis.smembers('jobs:failed')) as string[];
    const recentlyFailed = [];
    const oneHourAgo = Date.now() - 3600000;

    for (let i = 0; i < Math.min(10, failedIds.length); i++) {
      const jobId = failedIds[i];
      const jobJson = (await redis.get(`job:${jobId}`)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          if ((job.completedAt || 0) > oneHourAgo) {
            recentlyFailed.push({
              id: job.id,
              url: job.url,
              error: job.error || 'Unknown error',
              failedAt: new Date(job.completedAt || 0).toISOString(),
            });
          }
        } catch {
          // Skip malformed jobs
        }
      }
    }

    // Calculate health status
    const queueLength = pending + processing;
    const capacity = 1000;
    const utilizationPercent = (queueLength / capacity) * 100;

    let healthStatus: 'healthy' | 'warning' | 'critical';
    let alert: string | null = null;

    if (utilizationPercent > 90) {
      healthStatus = 'critical';
      alert = 'Queue utilization critical - backpressure detected';
    } else if (utilizationPercent > 70) {
      healthStatus = 'warning';
      alert = 'Queue utilization high - approaching capacity';
    } else if (failed > 100) {
      healthStatus = 'warning';
      alert = 'High failure rate detected';
    } else {
      healthStatus = 'healthy';
    }

    // Calculate processing efficiency
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : 0;

    // Get average processing time from sample
    const completedIds = (await redis.smembers('jobs:completed')) as string[];
    let avgProcessingTime = 0;
    let totalTime = 0;
    let count = 0;

    for (let i = 0; i < Math.min(50, completedIds.length); i++) {
      const jobId = completedIds[i];
      const jobJson = (await redis.get(`job:${jobId}`)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          if (job.processingTime) {
            totalTime += job.processingTime;
            count++;
          }
        } catch {
          // Skip malformed jobs
        }
      }
    }

    if (count > 0) {
      avgProcessingTime = totalTime / count;
    }

    return NextResponse.json(
      {
        status: healthStatus,
        alert,
        queue: {
          pending,
          processing,
          completed,
          failed,
          total,
          length: queueLength,
          capacity,
          utilizationPercent: parseFloat(utilizationPercent.toFixed(1)),
        },
        performance: {
          successRate: parseFloat(successRate as string),
          failureRate: parseFloat(failureRate as string),
          avgProcessingTimeMs: Math.round(avgProcessingTime),
          jobsProcessedPerHour: completed, // Simplified estimate
        },
        recentFailures: recentlyFailed,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[QUEUE-HEALTH] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch queue health',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(withAdminAuth(handler));
