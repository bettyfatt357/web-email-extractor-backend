'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsage } from '@/hooks/useUsage';

interface UsageData {
  day: string;
  requests: number;
  emails: number;
}

export default function UsagePage() {
  const { usage, isLoading, error } = useUsage();

  // Mock historical data
  const dailyUsage: UsageData[] = [
    { day: 'Mon', requests: 45, emails: 1200 },
    { day: 'Tue', requests: 52, emails: 1450 },
    { day: 'Wed', requests: 38, emails: 950 },
    { day: 'Thu', requests: 61, emails: 1800 },
    { day: 'Fri', requests: 55, emails: 1600 },
    { day: 'Sat', requests: 42, emails: 1100 },
    { day: 'Sun', requests: 38, emails: 900 },
  ];

  const maxRequests = Math.max(...dailyUsage.map((d) => d.requests)) * 1.2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Usage</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your API usage and quotas
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Current Usage */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground capitalize">{usage.plan}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Used This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {usage.quotaUsed.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of {usage.quotaLimit.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Remaining
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {usage.quotaRemaining.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {((usage.quotaUsed / usage.quotaLimit) * 100).toFixed(1)}% used
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resets On
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {new Date(usage.resetDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil(
                  (new Date(usage.resetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )}{' '}
                days left
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage Progress */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Quota</CardTitle>
            <CardDescription>Your usage progress this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">API Requests</span>
                <span className="text-sm text-muted-foreground">
                  {usage.quotaUsed.toLocaleString()} / {usage.quotaLimit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min((usage.quotaUsed / usage.quotaLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <CardDescription>Last 7 days of API requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Simple bar chart */}
            {dailyUsage.map((data) => (
              <div key={data.day}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{data.day}</span>
                  <span className="text-sm text-muted-foreground">
                    {data.requests} requests, {data.emails.toLocaleString()} emails
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${(data.requests / maxRequests) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rate Limit Information */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limits</CardTitle>
          <CardDescription>How your plan affects API access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <p className="font-medium text-foreground">Requests per Hour</p>
                <p className="text-sm text-muted-foreground">
                  {usage?.plan === 'pro' ? '100' : usage?.plan === 'enterprise' ? '1000' : '10'} requests/hour
                </p>
              </div>
            </div>
            <div className="flex justify-between items-start border-b border-border pb-3">
              <div>
                <p className="font-medium text-foreground">Monthly Quota</p>
                <p className="text-sm text-muted-foreground">
                  {usage?.quotaLimit?.toLocaleString() || '0'} requests
                </p>
              </div>
            </div>
            <div>
              <p className="font-medium text-foreground">Concurrent Jobs</p>
              <p className="text-sm text-muted-foreground">
                {usage?.plan === 'pro' ? '5' : usage?.plan === 'enterprise' ? 'Unlimited' : '1'} concurrent
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Notice */}
      {usage?.plan === 'free' && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle>Upgrade to Pro</CardTitle>
            <CardDescription>Get higher limits and more features</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground mb-4">
              Upgrade to Pro to get 100 requests/hour, higher monthly quotas, and priority support.
            </p>
            <a href="/dashboard/billing">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                View Plans
              </button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
