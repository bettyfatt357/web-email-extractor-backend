import { Card } from '@/components/ui/card';
import { ApiClient } from '@/lib/api/client';

interface Job {
  id: string;
  status: string;
  url: string;
  emailCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  processingTimeMs: number;
  retries: number;
  error: string | null;
}

interface JobsResponse {
  jobs: Job[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  statusCounts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

async function fetchJobs(status: string, page: number): Promise<JobsResponse> {
  const adminCredential = process.env.ADMIN_CREDENTIAL;
  if (!adminCredential) {
    throw new Error('ADMIN_CREDENTIAL environment variable not set');
  }

  const client = new ApiClient(adminCredential);
  return client.get<JobsResponse>(
    `/api/admin/jobs?status=${status}&offset=${page * 50}&limit=50`
  );
}

export default async function AdminJobsPage() {
  let data: JobsResponse | null = null;
  let error: string | null = null;
  const status = 'all';
  const page = 0;

  try {
    data = await fetchJobs(status, page);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch jobs';
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>Error loading jobs: {error}</p>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const getStatusColor = (jobStatus: string) => {
    switch (jobStatus) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
        <p className="text-muted-foreground">All extraction jobs across the platform</p>
      </div>

      {/* Status Filters - Note: Filtering is not functional in this server-rendered view */}
      <div className="flex gap-2 flex-wrap">
      {['all', 'pending', 'processing', 'completed', 'failed'].map((s) => (
          <div
            key={s}
            className="px-4 py-2 rounded bg-secondary text-secondary-foreground"
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({data?.statusCounts[s as keyof typeof data.statusCounts] || 0})
          </div>
        ))}
      </div>

      {/* Jobs Table */}
      {!data || data.jobs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No jobs found
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">URL</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Emails</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Time (ms)</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border hover:bg-accent/50">
                    <td className="py-3 px-4 font-mono text-xs">{job.id.slice(0, 8)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          job.status
                        )}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 truncate text-xs max-w-xs">{job.url}</td>
                    <td className="py-3 px-4">{job.emailCount}</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {job.processingTimeMs > 0 ? job.processingTimeMs.toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Info */}
          <div className="pt-4 text-sm text-muted-foreground">
            Showing {data.pagination.offset + 1}–{Math.min(
              data.pagination.offset + data.pagination.limit,
              data.pagination.total
            )} of {data.pagination.total} jobs
          </div>
        </>
      )}
    </div>
  );
}
