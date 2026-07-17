/**
 * Usage Tracking Module
 * 
 * Safely tracks user usage AFTER successful requests
 * Does not interfere with queue or worker logic
 */

import { incrementUsage, getUsage } from './billing';

export interface UsageEvent {
  userId: string;
  timestamp: number;
  endpoint: string;
  action: 'search' | 'status' | 'results';
  jobsCreated?: number;
  urlsProcessed?: number;
  success: boolean;
}

// In-memory event log (use database in production)
const usageLog: UsageEvent[] = [];

/**
 * Track usage event (call AFTER successful response)
 * Safe to call even if user is not authenticated
 */
export async function trackUsageEvent(
  userId: string | undefined,
  endpoint: string,
  action: 'search' | 'status' | 'results',
  data?: {
    jobsCreated?: number;
    urlsProcessed?: number;
    success?: boolean;
  }
): Promise<void> {
  if (!userId) {
    // Don't track anonymous usage (or track separately)
    return;
  }

  const event: UsageEvent = {
    userId,
    timestamp: Date.now(),
    endpoint,
    action,
    jobsCreated: data?.jobsCreated,
    urlsProcessed: data?.urlsProcessed,
    success: data?.success ?? true,
  };

  usageLog.push(event);

  // Increment user's quota only for successful search actions
  if (data?.success && action === 'search' && data?.jobsCreated) {
    try {
      await incrementUsage(userId, 1); // 1 per search, not per URL
    } catch (error) {
      console.error('[USAGE] Error incrementing usage:', error);
      // Don't throw - usage tracking should not block request
    }
  }

  console.log('[USAGE] Event tracked:', {
    userId,
    action,
    endpoint,
    timestamp: new Date(event.timestamp).toISOString(),
  });
}

/**
 * Get usage events for user
 */
export async function getUserUsageEvents(
  userId: string,
  limit: number = 100
): Promise<UsageEvent[]> {
  return usageLog
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get usage summary for user
 */
export async function getUserUsageSummary(userId: string) {
  const events = usageLog.filter((e) => e.userId === userId);
  const lastMonth = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentEvents = events.filter((e) => e.timestamp > lastMonth);

  return {
    total_events: events.length,
    recent_events: recentEvents.length,
    searches: events.filter((e) => e.action === 'search').length,
    status_checks: events.filter((e) => e.action === 'status').length,
    result_fetches: events.filter((e) => e.action === 'results').length,
    total_jobs_created: events.reduce((sum, e) => sum + (e.jobsCreated || 0), 0),
    last_event: events.length > 0 ? new Date(events[0].timestamp).toISOString() : null,
  };
}

/**
 * Get all usage events (admin)
 */
export async function getAllUsageEvents(limit: number = 1000): Promise<UsageEvent[]> {
  return usageLog
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Get usage analytics (admin)
 */
export async function getUsageAnalytics() {
  const totalEvents = usageLog.length;
  const uniqueUsers = new Set(usageLog.map((e) => e.userId)).size;
  const lastHour = Date.now() - 60 * 60 * 1000;
  const recentEvents = usageLog.filter((e) => e.timestamp > lastHour).length;

  const eventsByAction = {
    search: usageLog.filter((e) => e.action === 'search').length,
    status: usageLog.filter((e) => e.action === 'status').length,
    results: usageLog.filter((e) => e.action === 'results').length,
  };

  const successRate =
    totalEvents > 0
      ? Math.round(
          (usageLog.filter((e) => e.success).length / totalEvents) * 100
        )
      : 0;

  return {
    totalEvents,
    uniqueUsers,
    recentEventsLastHour: recentEvents,
    eventsByAction,
    successRate,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear usage logs (admin, debugging only)
 */
export async function clearUsageLogs(): Promise<void> {
  usageLog.length = 0;
  console.log('[USAGE] All usage logs cleared');
}
