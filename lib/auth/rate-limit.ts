import { NextResponse } from 'next/server';
import { AuthedRequest, getUserId } from './middleware';

// In-memory rate limit store (for local testing)
// In production, use Redis
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  free: number; // Requests per hour for free plan
  pro: number; // Requests per hour for pro plan
  enterprise: number; // Requests per hour for enterprise plan
}

const DEFAULT_LIMITS: RateLimitConfig = {
  free: parseInt(process.env.RATE_LIMIT_FREE || '10', 10),
  pro: parseInt(process.env.RATE_LIMIT_PRO || '100', 10),
  enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE || '1000', 10),
};

/**
 * Check if user has exceeded rate limit
 */
async function checkRateLimit(
  userId: string,
  plan: 'free' | 'pro' | 'enterprise' = 'free'
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const limit = DEFAULT_LIMITS[plan];
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  let userLimit = rateLimitStore.get(userId);

  // Create new entry or reset if time has passed
  if (!userLimit || now > userLimit.resetTime) {
    userLimit = {
      count: 0,
      resetTime: now + oneHourMs,
    };
    rateLimitStore.set(userId, userLimit);
  }

  // Check if limit exceeded
  const allowed = userLimit.count < limit;
  const remaining = Math.max(0, limit - userLimit.count);

  if (allowed) {
    userLimit.count++;
  }

  return {
    allowed,
    remaining,
    resetTime: userLimit.resetTime,
  };
}

/**
 * Rate limit middleware wrapper
 * RUNS BEFORE request hits handler
 * Checks rate limit and blocks if exceeded
 */
export function withRateLimit(
  handler: (
    req: AuthedRequest,
    res: any
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: AuthedRequest) => {
    try {
      const userId = getUserId(request);
      const plan = request.user?.plan || 'free';

      const { allowed, remaining, resetTime } = await checkRateLimit(
        userId,
        plan
      );

      if (!allowed) {
        const resetDate = new Date(resetTime).toISOString();
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Too many requests. Plan: ${plan}. Limit resets at ${resetDate}`,
            resetAt: resetDate,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetTime - Date.now()) / 1000)),
            },
          }
        );
      }

      // Add remaining requests to response headers
      request.headers.set('x-ratelimit-remaining', String(remaining));
      request.headers.set('x-ratelimit-reset', String(resetTime));

      return handler(request, undefined);
    } catch (error) {
      console.error('[RATE_LIMIT] Error:', error);
      // On error, allow request to proceed
      return handler(request, undefined);
    }
  };
}

/**
 * Get rate limit status for user
 */
export async function getRateLimitStatus(
  userId: string,
  plan: 'free' | 'pro' | 'enterprise' = 'free'
) {
  const limit = DEFAULT_LIMITS[plan];
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit) {
    return {
      plan,
      limit,
      used: 0,
      remaining: limit,
      resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  return {
    plan,
    limit,
    used: userLimit.count,
    remaining: Math.max(0, limit - userLimit.count),
    resetAt: new Date(userLimit.resetTime).toISOString(),
  };
}
