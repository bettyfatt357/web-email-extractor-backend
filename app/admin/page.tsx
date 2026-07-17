import { Card } from '@/components/ui/card';
import { ApiClient } from '@/lib/api/client';

interface DashboardMetrics {
  timestamp: string;
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
    successRate: number;
    failureRate: number;
  };
  performance: {
    avgProcessingTimeMs: number;
    backpressure: boolean;
    health: 'healthy' | 'warning' | 'critical';
  };
  workers: {
    active: number;
    idle: number;
    total: number;
  };
  today: {
    jobsProcessed: number;
    emailsExtracted: number;
  };
}

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const adminCredential = process.env.ADMIN_CREDENTIAL;
  if (!adminCredential) {
    throw new Error('ADMIN_CREDENTIAL environment variable not set');
  }

  const client = new ApiClient(adminCredential);
  return client.get<DashboardMetrics>('/api/admin/dashboard');
}

export default async function AdminDashboard() {
  let metrics: DashboardMetrics | null = null;
  let error: string | null = null;

  try {
    metrics = await fetchDashboardMetrics();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch metrics';
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>Error loading metrics: {error}</p>
      </div>
    );
  }

  if (!metrics) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">System overview and key metrics</p>
      </div>

      {/* Status Alert */}
      {metrics.performance.health !== 'healthy' && (
        <div className={`p-4 rounded-lg ${
          metrics.performance.health === 'warning' 
            ? 'bg-yellow-50 text-yellow-900 border border-yellow-200' 
            : 'bg-red-50 text-red-900 border border-red-200'
        }`}>
          <p className="font-semibold">
            {metrics.performance.health === 'warning' ? '⚠️ Warning' : '🚨 Critical'}: 
            {metrics.performance.backpressure ? ' Queue backpressure detected' : ' System issues detected'}
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Jobs */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Queued Jobs</div>
          <div className="text-3xl font-bold text-foreground">{metrics.queue.pending}</div>
          <div className="text-xs text-muted-foreground mt-2">Waiting for processing</div>
        </Card>

        {/* Processing */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Processing</div>
          <div className="text-3xl font-bold text-foreground">{metrics.queue.processing}</div>
          <div className="text-xs text-muted-foreground mt-2">Currently active jobs</div>
        </Card>

        {/* Completed Today */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Completed Today</div>
          <div className="text-3xl font-bold text-foreground">{metrics.today.jobsProcessed}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Success rate: {metrics.queue.successRate.toFixed(1)}%
          </div>
        </Card>

        {/* Emails Extracted */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Emails Today</div>
          <div className="text-3xl font-bold text-foreground">{metrics.today.emailsExtracted}</div>
          <div className="text-xs text-muted-foreground mt-2">Extracted so far</div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Avg Processing Time */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Avg Processing Time</div>
          <div className="text-2xl font-bold text-foreground">
            {metrics.performance.avgProcessingTimeMs.toLocaleString()}ms
          </div>
          <div className="text-xs text-muted-foreground mt-2">Per job average</div>
        </Card>

        {/* Success Rate */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Success Rate</div>
          <div className="text-2xl font-bold text-foreground">
            {metrics.queue.successRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {metrics.queue.completed} completed / {metrics.queue.total} total
          </div>
        </Card>

        {/* Workers */}
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Workers</div>
          <div className="text-2xl font-bold text-foreground">{metrics.workers.active}</div>
          <div className="text-xs text-muted-foreground mt-2">
            {metrics.workers.active} active, {metrics.workers.idle} idle
          </div>
        </Card>
      </div>

      {/* Queue Summary */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Queue Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Total Jobs</div>
            <div className="text-2xl font-bold text-foreground">{metrics.queue.total}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-red-600">{metrics.queue.failed}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Failure Rate</div>
            <div className="text-2xl font-bold text-red-600">
              {metrics.queue.failureRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Health</div>
            <div className={`text-2xl font-bold ${
              metrics.performance.health === 'healthy' 
                ? 'text-green-600' 
                : metrics.performance.health === 'warning'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>
              {metrics.performance.health === 'healthy' ? '✓' : 'ℹ️'}
            </div>
          </div>
        </div>
      </Card>

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(metrics.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
