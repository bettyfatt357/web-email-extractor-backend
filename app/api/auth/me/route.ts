import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthedRequest, getUserId } from '@/lib/auth/middleware';
import { getRateLimitStatus } from '@/lib/auth/rate-limit';
import { getUsage } from '@/lib/auth/billing';
import { getCustomer } from '@/lib/billing/stripe';

/**
 * GET /api/auth/me
 * Returns authenticated user info, rate limit status, and usage quota
 */
async function handler(request: AuthedRequest): Promise<NextResponse> {
  try {
    const userId = getUserId(request);
    const user = (request as AuthedRequest).user;
    const plan = user?.plan || 'free';

    // Get rate limit status
    const rateLimit = await getRateLimitStatus(userId, plan);

    // Get usage quota
    const usage = await getUsage(userId, plan);

    // Get Stripe customer info if authenticated
    let stripeCustomer = null;
    if (user?.id) {
      stripeCustomer = await getCustomer(user.id);
    }

    return NextResponse.json({
      authenticated: !!user,
      user: user ? {
        id: user.id,
        credential: user.credential ? `${user.credential.slice(0, 8)}...` : undefined,
        plan: user.plan,
      } : null,
      rateLimit,
      usage,
      billing: stripeCustomer || { message: 'No billing info' },
    });
  } catch (error) {
    console.error('[AUTH] Error in /auth/me:', error);
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);
