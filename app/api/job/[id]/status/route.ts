import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface JobStatusResponse {
  id: string;
  status: string;
  retries: number;
  progress: number;
  duration: number;
}

/**
 * GET /api/job/:id/status
 * Returns lightweight status information with progress and duration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    // Initialize Redis client
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });

    // Get job from Redis
    const jobJson = (await redis.get(`job:${jobId}`)) as string | null;

    if (!jobJson) {
      return NextResponse.json(
        { error: `Job ${jobId} not found` },
        { status: 404 }
      );
    }

    try {
      const job = JSON.parse(jobJson);

      // Calculate progress (0=pending, 50=processing, 100=completed/failed)
      let progress = 0;
      switch (job.status) {
        case 'pending':
          progress = 0;
          break;
        case 'processing':
          progress = 50;
          break;
        case 'completed':
        case 'failed':
          progress = 100;
          break;
        default:
          progress = 0;
      }

      // Calculate duration
      let duration = 0;
      if (job.startedAt) {
        const endTime = job.completedAt || Date.now();
        duration = endTime - job.startedAt;
      }

      const response: JobStatusResponse = {
        id: job.id,
        status: job.status,
        retries: job.retries,
        progress,
        duration,
      };

      return NextResponse.json(response, { status: 200 });
    } catch (parseError) {
      console.error(`[API] Failed to parse job ${jobId}:`, parseError);
      return NextResponse.json(
        { error: 'Failed to parse job data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
