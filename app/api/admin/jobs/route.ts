import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { withAuth, AuthedRequest } from '@/lib/auth/middleware';
import { withAdminAuth } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/jobs
 * Admin jobs list with full visibility across all users
 * Query params: status, limit, offset, sortBy
 * Protected: Admin authorization required
 */
async function handler(request: AuthedRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Determine which status sets to query
    let statusSets: string[] = [];
    if (status === 'all') {
      statusSets = ['jobs:pending', 'jobs:processing', 'jobs:completed', 'jobs:failed'];
    } else {
      statusSets = [`jobs:${status}`];
    }

    // Get job IDs from all relevant status sets
    let allJobIds: string[] = [];
    for (const statusSet of statusSets) {
      const ids = (await redis.smembers(statusSet)) as string[];
      allJobIds = allJobIds.concat(ids);
    }

    // Sort by creation time (newest first) - need to fetch data
    const jobsWithData: any[] = [];
    for (const jobId of allJobIds) {
      const jobJson = (await redis.get(`job:${jobId}`)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          jobsWithData.push(job);
        } catch {
          // Skip malformed jobs
        }
      }
    }

    // Sort by created time (newest first)
    jobsWithData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Apply pagination
    const total = jobsWithData.length;
    const paginatedJobs = jobsWithData.slice(offset, offset + limit);

    // Sanitize sensitive data
    const safeJobs = paginatedJobs.map((job) => ({
      id: job.id,
      status: job.status,
      url: job.url,
      emailCount: (job.emails || []).length,
      createdAt: new Date(job.createdAt || 0).toISOString(),
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
      processingTimeMs: job.processingTime || 0,
      retries: job.retries || 0,
      error: job.error || null,
    }));

    return NextResponse.json(
      {
        jobs: safeJobs,
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + limit < total,
        },
        statusCounts: {
          pending: (await redis.scard('jobs:pending')) as number,
          processing: (await redis.scard('jobs:processing')) as number,
          completed: (await redis.scard('jobs:completed')) as number,
          failed: (await redis.scard('jobs:failed')) as number,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ADMIN-JOBS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(withAdminAuth(handler));
