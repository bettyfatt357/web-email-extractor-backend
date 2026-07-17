import { NextRequest, NextResponse } from 'next/server';
import { withDashboardAuth, DashboardAuthRequest } from '@/lib/auth/middleware-dashboard';
import { getRateLimitStatus } from '@/lib/auth/rate-limit';
import { getUsage } from '@/lib/auth/billing';
import { getUserUsageSummary } from '@/lib/auth/usage-tracking';
import { getCustomer } from '@/lib/billing/stripe';

/**
 * GET /api/billing/status
 * Returns user's billing status, usage, and subscription info
 * 
 * Authentication: Supabase session (dashboard)
 */
async function handler(request: DashboardAuthRequest): Promise<NextResponse> {
  try {
    const user = (request as DashboardAuthRequest).user;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const plan = 'pro'; // TODO: Get from Supabase user metadata

    // Get rate limit
    const rateLimit = await getRateLimitStatus(userId, plan);

    // Get usage quota
    const usage = await getUsage(userId, plan);

    // Get usage summary
    const summary = await getUserUsageSummary(userId);

    // Get Stripe subscription
    const customer = await getCustomer(user?.id || userId);

    return NextResponse.json({
      plan,
      usage,
      rateLimit,
      activity: summary,
      subscription: customer?.subscription || null,
      nextBillingDate: customer?.subscription?.currentPeriodEnd
        ? new Date(customer.subscription.currentPeriodEnd).toISOString()
        : null,
    });
  } catch (error) {
    console.error('[BILLING] Error in /billing/status:', error);
    return NextResponse.json(
      { error: 'Failed to get billing status' },
      { status: 500 }
    );
  }
}

export const GET = withDashboardAuth(handler);
