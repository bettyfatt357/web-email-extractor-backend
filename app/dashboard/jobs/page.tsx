'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiClient, ApiError } from '@/lib/api/client';
import { getUserCredential } from '@/lib/auth/storage';

interface Job {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  emailsFound: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

const statusColors: Record<Job['status'], string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  processing: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  completed: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  failed: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
};

const statusIcons: Record<Job['status'], string> = {
  pending: '⏳',
  processing: '⚙️',
  completed: '✅',
  failed: '❌',
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>(
    'all'
  );

  useEffect(() => {
    async function fetchJobs() {
      try {
        setIsLoading(true);
        const credential = getUserCredential() ?? undefined;
        const client = new ApiClient(credential);

        const statusParam = filter !== 'all' ? `&status=${filter}` : '';
        const data = await client.get<JobsResponse>(
          `/api/jobs-paginated?page=${page}&pageSize=10${statusParam}`
        );
        setJobs(data.jobs);
        setTotalPages(Math.ceil(data.total / data.pageSize));
        setError(null);
      } catch (err) {
        let message = 'Failed to fetch jobs';
        if (err instanceof ApiError) {
          message = err.message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        console.error('[dashboard/jobs] Error fetching jobs:', message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchJobs();
    const interval = setInterval(fetchJobs, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [page, filter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Track extraction jobs and results
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'pending', 'processing', 'completed', 'failed'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            onClick={() => {
              setFilter(status);
              setPage(1);
            }}
            className="capitalize whitespace-nowrap"
          >
            {status === 'all' ? 'All Jobs' : status}
          </Button>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Extraction Jobs</CardTitle>
          <CardDescription>
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} on this page
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No jobs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">URL</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Emails</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border hover:bg-accent">
                      <td className="py-3 px-4">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate max-w-xs"
                          title={job.url}
                        >
                          {job.url}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span>{statusIcons[job.status]}</span>
                          <span
                            className={`inline-block px-2 py-1 text-xs font-semibold rounded capitalize ${
                              statusColors[job.status]
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{job.emailsFound}</td>
                      <td className="py-3 px-4">
                        {new Date(job.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
