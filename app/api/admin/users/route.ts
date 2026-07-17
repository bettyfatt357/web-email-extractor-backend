import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthedRequest } from '@/lib/auth/middleware';
import { withAdminAuth } from '@/lib/auth/admin-auth';

/**
 * GET /api/admin/users
 * Admin user management - list all users with billing info
 * Protected: Admin authorization required
 *
 * Note: This is a simulated endpoint since users are API-key based.
 * In production, query actual user database for full user management.
 */
async function handler(request: AuthedRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const plan = url.searchParams.get('plan') || 'all';
    const status = url.searchParams.get('status') || 'active';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // In production, this would query the actual user database
    // For now, return structure that the admin dashboard expects
    
    // Simulated users list (in production: query database)
    const allUsers = [
      {
        id: 'user_001',
        email: 'john@example.com',
        plan: 'pro' as const,
        status: 'active' as const,
        createdAt: '2024-01-15T10:30:00Z',
        lastActive: '2024-07-15T14:22:00Z',
        apiKeysCount: 2,
        usagePercent: 65,
        usageThisMonth: 3250,
        limit: 5000,
        jobsCompleted: 145,
        jobsFailed: 3,
      },
      {
        id: 'user_002',
        email: 'alice@corp.com',
        plan: 'enterprise' as const,
        status: 'active' as const,
        createdAt: '2024-02-01T09:15:00Z',
        lastActive: '2024-07-14T18:45:00Z',
        apiKeysCount: 5,
        usagePercent: 42,
        usageThisMonth: 420000,
        limit: 1000000,
        jobsCompleted: 8920,
        jobsFailed: 47,
      },
      {
        id: 'user_003',
        email: 'bob@startup.io',
        plan: 'free' as const,
        status: 'active' as const,
        createdAt: '2024-03-20T12:00:00Z',
        lastActive: '2024-07-10T08:30:00Z',
        apiKeysCount: 1,
        usagePercent: 95,
        usageThisMonth: 95,
        limit: 100,
        jobsCompleted: 92,
        jobsFailed: 1,
      },
    ];

    // Filter users
    let filteredUsers = allUsers;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.email.toLowerCase().includes(searchLower) ||
          u.id.toLowerCase().includes(searchLower)
      );
    }

    if (plan !== 'all') {
      filteredUsers = filteredUsers.filter((u) => u.plan === plan);
    }

    if (status !== 'all') {
      filteredUsers = filteredUsers.filter((u) => u.status === status);
    }

    // Apply pagination
    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);

    return NextResponse.json(
      {
        users: paginatedUsers,
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + limit < total,
        },
        summary: {
          totalUsers: total,
          activeUsers: filteredUsers.filter((u) => u.status === 'active').length,
          byPlan: {
            free: filteredUsers.filter((u) => u.plan === 'free').length,
            pro: filteredUsers.filter((u) => u.plan === 'pro').length,
            enterprise: filteredUsers.filter((u) => u.plan === 'enterprise').length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ADMIN-USERS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(withAdminAuth(handler));
