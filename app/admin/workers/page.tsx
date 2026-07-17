'use client';

import { Card } from '@/components/ui/card';

export default function AdminWorkersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Workers</h1>
        <p className="text-muted-foreground">Monitor worker processes and status</p>
      </div>

      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Worker monitoring features coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          View active workers, throughput, and performance metrics
        </p>
      </Card>
    </div>
  );
}
