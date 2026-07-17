import { Card } from '@/components/ui/card';
import { ApiClient } from '@/lib/api/client';

interface QueueHealth {
  status: 'healthy' | 'warning' | 'critical';
  alert: string | null;
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
    length: number;
    capacity: number;
    utilizationPercent: number;
  };
  performance: {
    successRate: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    jobsProcessedPerHour: number;
  };
  recentFailures: Array<{
    id: string;
    url: string;
    error: string;
    failedAt: string;
  }>;
  timestamp: string;
}

async function fetchQueueHealth(): Promise<QueueHealth> {
  const adminCredential = process.env.ADMIN_CREDENTIAL;
  if (!adminCredential) {
    throw new Error('ADMIN_CREDENTIAL environment variable not set');
  }

  const client = new ApiClient(adminCredential);
  return client.get<QueueHealth>('/api/admin/queue/health');
}

export default async function AdminQueuePage() {
  let health: QueueHealth | null = null;
  let error: string | null = null;

  try {
    health = await fetchQueueHealth();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to fetch queue health';
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>Error loading queue health: {error}</p>
      </div>
    );
  }

  if (!health) {
    return <div>No data available</div>;
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' };
      case 'warning':
        return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900' };
      case 'critical':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' };
      default:
        return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-900' };
    }
  };

  const colors = getHealthColor(health.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Queue Monitoring</h1>
        <p className="text-muted-foreground">Real-time queue health and performance</p>
      </div>

      {/* Health Status */}
      <div className={`p-6 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex justify-between items-start">
          <div>
            <h2 className={`text-lg font-bold ${colors.text}`}>
              {health.status === 'healthy'
                ? '✓ Queue Healthy'
                : health.status === 'warning'
                ? '⚠️ Queue Warning'
                : '🚨 Queue Critical'}
            </h2>
            {health.alert && <p className={`text-sm mt-2 ${colors.text}`}>{health.alert}</p>}
          </div>
          <div className={`text-2xl font-bold ${colors.text}`}>
            {health.queue.utilizationPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Queue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Pending</div>
          <div className="text-3xl font-bold text-foreground">{health.queue.pending}</div>
          <div className="text-xs text-muted-foreground mt-2">Awaiting processing</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Processing</div>
          <div className="text-3xl font-bold text-foreground">{health.queue.processing}</div>
          <div className="text-xs text-muted-foreground mt-2">Currently active</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Completed</div>
          <div className="text-3xl font-bold text-foreground">{health.queue.completed}</div>
          <div className="text-xs text-muted-foreground mt-2">Success count</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Failed</div>
          <div className="text-3xl font-bold text-red-600">{health.queue.failed}</div>
          <div className="text-xs text-muted-foreground mt-2">Error count</div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Success Rate</div>
          <div className="text-3xl font-bold text-foreground">
            {health.performance.successRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-2">Of {health.queue.total} total</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Avg Processing</div>
          <div className="text-3xl font-bold text-foreground">
            {health.performance.avgProcessingTimeMs.toLocaleString()}ms
          </div>
          <div className="text-xs text-muted-foreground mt-2">Per job average</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">Capacity Usage</div>
          <div className="text-3xl font-bold text-foreground">
            {health.queue.length} / {health.queue.capacity}
          </div>
          <div className="text-xs text-muted-foreground mt-2">Queue length</div>
        </Card>
      </div>

      {/* Recent Failures */}
      {health.recentFailures.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Failures</h2>
          <div className="space-y-3">
            {health.recentFailures.map((failure) => (
              <div
                key={failure.id}
                className="p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-xs text-red-900">{failure.id}</p>
                    <p className="text-sm text-red-700 mt-1">{failure.error}</p>
                  </div>
                  <div className="text-xs text-red-600 whitespace-nowrap">
                    {new Date(failure.failedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(health.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
