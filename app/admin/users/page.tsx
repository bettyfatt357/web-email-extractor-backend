import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ApiClient } from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended';
  createdAt: string;
  lastActive: string;
  apiKeysCount: number;
  usagePercent: number;
  usageThisMonth: number;
  limit: number;
  jobsCompleted: number;
  jobsFailed: number;
}

interface UsersResponse {
  users: User[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  summary: {
    totalUsers: number;
    activeUsers: number;
    byPlan: {
      free: number;
      pro: number;
      enterprise: number;
    };
  };
}

async function fetchUsers(search: string, plan: string, page: number): Promise<UsersResponse> {
  const adminCredential = process.env.ADMIN_CREDENTIAL;
  if (!adminCredential) {
    throw new Error('ADMIN_CREDENTIAL environment variable not set');
  }

  const params = new URLSearchParams({
    search,
    plan,
    offset: String(page * 50),
    limit: '50',
  });
  const client = new ApiClient(adminCredential);
  return client.get<UsersResponse>(`/api/admin/users?${params}`);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const params = await searchParams;
  let data: UsersResponse | null = null;
  let error: string | null = null;
  const search = (params.search as string) || '';
  const plan = (params.plan as string) || 'all';
  const page = parseInt((params.page as string) || '0', 10);

  try {
    data = await fetchUsers(search, plan, page);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch users';
  }

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free':
        return 'text-gray-600 bg-gray-50';
      case 'pro':
        return 'text-blue-600 bg-blue-50';
      case 'enterprise':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground">View and manage platform users</p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {data.summary.totalUsers}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {data.summary.activeUsers}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Free Plan</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {data.summary.byPlan.free}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Pro/Enterprise</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {data.summary.byPlan.pro + data.summary.byPlan.enterprise}
            </div>
          </Card>
        </div>
      )}

      {/* Users Table */}
      {error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : !data || data.users.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No users found
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Usage</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Jobs</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">API Keys</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className="border-b border-border hover:bg-accent/50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground font-mono">{user.id}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium capitalize ${getPlanColor(
                          user.plan
                        )}`}
                      >
                        {user.plan}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {user.usageThisMonth.toLocaleString()} / {user.limit.toLocaleString()}
                        </p>
                        <div className="w-24 h-1.5 bg-background rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full ${
                              user.usagePercent > 90
                                ? 'bg-red-500'
                                : user.usagePercent > 70
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(user.usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">
                      {user.jobsCompleted}
                      <span className="text-muted-foreground ml-1">
                        ({user.jobsFailed} failed)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{user.apiKeysCount}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(user.lastActive).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {data.pagination.offset + 1}–{Math.min(
                data.pagination.offset + data.pagination.limit,
                data.pagination.total
              )} of {data.pagination.total} users
            </div>
            <div className="flex gap-2">
              {page > 0 ? (
                <Link
                  href={`/admin/users?page=${Math.max(0, page - 1)}&search=${encodeURIComponent(search)}&plan=${plan}`}
                  className="px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/80"
                >
                  Previous
                </Link>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 rounded-lg bg-accent text-accent-foreground opacity-50 cursor-not-allowed"
                >
                  Previous
                </button>
              )}
              {data.pagination.hasMore ? (
                <Link
                  href={`/admin/users?page=${page + 1}&search=${encodeURIComponent(search)}&plan=${plan}`}
                  className="px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/80"
                >
                  Next
                </Link>
              ) : (
                <button
                  disabled
                  className="px-4 py-2 rounded-lg bg-accent text-accent-foreground opacity-50 cursor-not-allowed"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
