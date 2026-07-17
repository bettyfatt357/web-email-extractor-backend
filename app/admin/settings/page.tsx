'use client';

import { Card } from '@/components/ui/card';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Administrative settings and configuration</p>
      </div>

      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Admin settings coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Platform preferences, notifications, and administration
        </p>
      </Card>
    </div>
  );
}
