import { NextResponse } from 'next/server';
import { AuthedRequest } from './middleware';

// In-memory usage store (in production, use database)
const usageStore = new Map<string, { used: number; limit: number }>();

export interface BillingPlan {
  name: 'free' | 'pro' | 'enterprise';
  limit: number; // Queries per month
  price: number;
}

const PLANS: Record<string, BillingPlan> = {
  free: { name: 'free', limit: 100, price: 0 },
  pro: { name: 'pro', limit: 5000, price: 99 },
  enterprise: { name: 'enterprise', limit: 1000000, price: 999 },
};

/**
 * Get user's current plan limits
 */
function getUserPlanLimit(request: AuthedRequest): number {
  const plan = request.user?.plan || 'free';
  return PLANS[plan]?.limit || PLANS.free.limit;
}

/**
 * Check user's quota usage
 */
async function checkQuota(userId: string, planLimit: number) {
  const usage = usageStore.get(userId) || { used: 0, limit: planLimit };

  return {
    used: usage.used,
    limit: usage.limit,
    remaining: Math.max(0, usage.limit - usage.used),
    exceeded: usage.used >= usage.limit,
  };
}

/**
 * Billing enforcement middleware
 * Checks quota BEFORE allowing request to proceed
 */
export function withBilling(
  handler: (
    req: AuthedRequest,
    res: any
  ) => Promise<NextResponse> | NextResponse
) {
  return async (request: AuthedRequest) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        // Anonymous users have no billing restrictions
        return handler(request, undefined);
      }

      const planLimit = getUserPlanLimit(request);
      const quota = await checkQuota(userId, planLimit);

      if (quota.exceeded) {
        const plan = request.user?.plan || 'free';
        return NextResponse.json(
          {
            error: 'Quota exceeded',
            message: `You have reached your monthly limit of ${quota.limit} queries on the ${plan} plan`,
            quota: {
              used: quota.used,
              limit: quota.limit,
              remaining: 0,
            },
            upgrade: 'https://example.com/pricing',
          },
          { status: 403 }
        );
      }

      // Add quota info to headers
      request.headers.set('x-quota-used', String(quota.used));
      request.headers.set('x-quota-remaining', String(quota.remaining));

      return handler(request, undefined);
    } catch (error) {
      console.error('[BILLING] Error:', error);
      // On error, allow request to proceed
      return handler(request, undefined);
    }
  };
}

/**
 * Increment usage after successful request
 * MUST be called AFTER request completes successfully
 */
export async function incrementUsage(userId: string, count: number = 1) {
  const usage = usageStore.get(userId) || { used: 0, limit: PLANS.pro.limit };
  usage.used += count;
  usageStore.set(userId, usage);

  return {
    used: usage.used,
    limit: usage.limit,
    remaining: Math.max(0, usage.limit - usage.used),
  };
}

/**
 * Get usage for user
 */
export async function getUsage(userId: string, plan: 'free' | 'pro' | 'enterprise' = 'free') {
  const planLimit = PLANS[plan]?.limit || PLANS.free.limit;
  const usage = usageStore.get(userId) || { used: 0, limit: planLimit };

  return {
    plan,
    used: usage.used,
    limit: usage.limit,
    remaining: Math.max(0, usage.limit - usage.used),
    percentageUsed: Math.round((usage.used / usage.limit) * 100),
  };
}

/**
 * Reset usage (admin only)
 */
export async function resetUsage(userId: string) {
  usageStore.delete(userId);
}

/**
 * Get all users' usage (admin only)
 */
export async function getAllUsage() {
  const result: Record<string, any> = {};

  for (const [userId, usage] of usageStore.entries()) {
    result[userId] = {
      used: usage.used,
      limit: usage.limit,
      remaining: Math.max(0, usage.limit - usage.used),
    };
  }

  return result;
}
