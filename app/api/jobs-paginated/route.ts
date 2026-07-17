import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface PaginatedResponse {
  jobs: any[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  };
  status: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

/**
 * GET /api/jobs-paginated?status=pending&limit=20&offset=0
 * Paginated jobs endpoint with backpressure protection
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100); // Max 100
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Initialize Redis client
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Get status counts
    const counts = {
      pending: (await redis.scard('jobs:pending')) as number,
      processing: (await redis.scard('jobs:processing')) as number,
      completed: (await redis.scard('jobs:completed')) as number,
      failed: (await redis.scard('jobs:failed')) as number,
    };

    // Determine which SET to query
    let jobIds: string[] = [];
    let total = 0;

    if (status === 'all') {
      total = counts.pending + counts.processing + counts.completed + counts.failed;
      // Combine from all sets with limit and offset
      const pendingIds = (await redis.smembers('jobs:pending')) as string[];
      const processingIds = (await redis.smembers('jobs:processing')) as string[];
      const completedIds = (await redis.smembers('jobs:completed')) as string[];
      const failedIds = (await redis.smembers('jobs:failed')) as string[];
      jobIds = [...pendingIds, ...processingIds, ...completedIds, ...failedIds];
    } else if (status === 'pending') {
      total = counts.pending;
      jobIds = (await redis.smembers('jobs:pending')) as string[];
    } else if (status === 'processing') {
      total = counts.processing;
      jobIds = (await redis.smembers('jobs:processing')) as string[];
    } else if (status === 'completed') {
      total = counts.completed;
      jobIds = (await redis.smembers('jobs:completed')) as string[];
    } else if (status === 'failed') {
      total = counts.failed;
      jobIds = (await redis.smembers('jobs:failed')) as string[];
    }

    // Apply pagination
    const paginatedIds = jobIds.slice(offset, offset + limit);
    const jobs = [];

    for (const jobId of paginatedIds) {
      const jobJson = (await redis.get(`job:${jobId}`)) as string | null;
      if (jobJson) {
        try {
          const job = JSON.parse(jobJson);
          jobs.push(job);
        } catch (error) {
          console.error(`[API] Failed to parse job ${jobId}:`, error);
        }
      }
    }

    // Sort by creation time (newest first)
    jobs.sort((a, b) => b.createdAt - a.createdAt);

    const response: PaginatedResponse = {
      jobs,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
        nextCursor: offset + limit < total ? (offset + limit).toString() : undefined,
      },
      status: counts,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API] Error fetching paginated jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/jobs-paginated
 * Endpoint documentation
 */
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {
      methods: ['GET'],
      description: 'Get paginated list of jobs',
      queryParameters: {
        status: 'all|pending|processing|completed|failed (default: all)',
        limit: 'number - items per page (default: 20, max: 100)',
        offset: 'number - starting position (default: 0)',
      },
      example: 'GET /api/jobs-paginated?status=pending&limit=20&offset=0',
      response: {
        jobs: 'Job[] - array of jobs',
        pagination: {
          limit: 'number',
          offset: 'number',
          total: 'number - total jobs in this status',
          hasMore: 'boolean - more jobs available',
          nextCursor: 'string? - next offset to use',
        },
        status: {
          pending: 'number',
          processing: 'number',
          completed: 'number',
          failed: 'number',
        },
      },
    },
    { status: 200 }
  );
}
