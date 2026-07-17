'use client';

import { Card } from '@/components/ui/card';

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Platform analytics and trends</p>
      </div>

      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Advanced analytics coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Charts, trends, and detailed usage analytics
        </p>
      </Card>
    </div>
  );
}
