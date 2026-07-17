import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface JobResultResponse {
  id: string;
  emails: string[];
  totalEmails: number;
}

/**
 * GET /api/job/:id/result
 * Returns only emails and total count
 * Only available after job completion
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

      // Check if job is completed
      if (job.status !== 'completed' && job.status !== 'failed') {
        return NextResponse.json(
          { 
            error: 'Job not finished',
            status: job.status,
            message: `Job is still ${job.status}. Please wait for completion.`
          },
          { status: 202 }
        );
      }

      // If failed, return the error
      if (job.status === 'failed') {
        return NextResponse.json(
          {
            id: job.id,
            error: job.error,
            emails: [],
            totalEmails: 0,
          },
          { status: 200 }
        );
      }

      // Return successful result
      const response: JobResultResponse = {
        id: job.id,
        emails: job.emails || [],
        totalEmails: (job.emails || []).length,
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
    console.error('[API] Error fetching job result:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
