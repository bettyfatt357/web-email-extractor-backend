import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface JobsByStatus {
  pending: any[];
  processing: any[];
  completed: any[];
  failed: any[];
}

/**
 * GET /api/jobs
 * Debug endpoint - returns all jobs grouped by status
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize Redis client
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Get all job keys
    const keys = (await redis.keys('job:*')) as string[];

    // Group jobs by status
    const jobsByStatus: JobsByStatus = {
      pending: [],
      processing: [],
      completed: [],
      failed: [],
    };

    for (const key of keys) {
      const jobJson = (await redis.get(key)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          const status = job.status as keyof JobsByStatus;

          if (status in jobsByStatus) {
            jobsByStatus[status].push(job);
          }
        } catch (error) {
          console.error(`[API] Failed to parse ${key}:`, error);
        }
      }
    }

    // Sort by creation time (newest first)
    Object.keys(jobsByStatus).forEach((status) => {
      jobsByStatus[status as keyof JobsByStatus].sort(
        (a, b) => b.createdAt - a.createdAt
      );
    });

    const response = {
      total: keys.length,
      ...jobsByStatus,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API] Error fetching all jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
