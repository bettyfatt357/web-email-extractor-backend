import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

/**
 * GET /api/job/:id
 * Returns full job object with all details
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
      return NextResponse.json(job, { status: 200 });
    } catch (parseError) {
      console.error(`[API] Failed to parse job ${jobId}:`, parseError);
      return NextResponse.json(
        { error: 'Failed to parse job data' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
