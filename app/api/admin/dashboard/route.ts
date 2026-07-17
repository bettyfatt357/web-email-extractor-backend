import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { withAuth, AuthedRequest } from '@/lib/auth/middleware';
import { withAdminAuth } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/dashboard
 * Admin dashboard metrics - comprehensive system overview
 * Protected: Admin authorization required
 */
async function handler(request: AuthedRequest): Promise<NextResponse> {
  try {
    // Initialize Redis client
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Get queue metrics (O(1) operations)
    const pending = (await redis.scard('jobs:pending')) as number;
    const processing = (await redis.scard('jobs:processing')) as number;
    const completed = (await redis.scard('jobs:completed')) as number;
    const failed = (await redis.scard('jobs:failed')) as number;
    const total = pending + processing + completed + failed;

    // Calculate metrics
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(2) : 0;

    // Get sample of completed jobs for average processing time
    const completedIds = (await redis.smembers('jobs:completed')) as string[];
    let avgProcessingTime = 0;
    let totalTime = 0;
    let count = 0;

    const sampleSize = Math.min(50, completedIds.length);
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
        } catch {
          // Skip malformed job data
        }
      }
    }

    if (count > 0) {
      avgProcessingTime = totalTime / count;
    }

    // Check backpressure (queue health warning)
    const backpressure = pending > 1000;

    // Get worker status from metadata
    const workerStatus = (await redis.get('worker:status')) as string | null;
    const workerData = workerStatus ? JSON.parse(workerStatus) : { active: 0, idle: 0 };

    // Get today's email count (assuming stored in Redis)
    const emailsExtractedToday = (await redis.get('stats:emails:today')) as number | null;

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        queue: {
          pending,
          processing,
          completed,
          failed,
          total,
          successRate: parseFloat(successRate as string),
          failureRate: parseFloat(failureRate as string),
        },
        performance: {
          avgProcessingTimeMs: Math.round(avgProcessingTime),
          backpressure,
          health: backpressure ? 'warning' : 'healthy',
        },
        workers: {
          active: workerData.active || 0,
          idle: workerData.idle || 0,
          total: (workerData.active || 0) + (workerData.idle || 0),
        },
        today: {
          jobsProcessed: completed + failed,
          emailsExtracted: emailsExtractedToday || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ADMIN-DASHBOARD] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Wrap with auth middleware: Auth -> AdminAuth -> Handler
export const GET = withAuth(withAdminAuth(handler));
