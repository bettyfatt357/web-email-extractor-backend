'use client';

import { Card } from '@/components/ui/card';

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Security</h1>
        <p className="text-muted-foreground">Security events and audit logs</p>
      </div>

      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Security monitoring coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Invalid API keys, rate limit violations, suspicious activity
        </p>
      </Card>
    </div>
  );
}
