'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMetrics } from '@/hooks/useMetrics';
import { useUsage } from '@/hooks/useUsage';

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

export default function Dashboard() {
  const { metrics, isLoading: metricsLoading } = useMetrics();
  const { usage, isLoading: usageLoading } = useUsage();

  const statCards: StatCard[] = [
    {
      title: 'Active Jobs',
      value: metrics?.activeJobs || 0,
      icon: '⚙️',
    },
    {
      title: 'Completed Jobs',
      value: metrics?.completedJobs || 0,
      icon: '✅',
    },
    {
      title: 'Emails Extracted',
      value: (metrics?.totalEmails || 0).toLocaleString(),
      icon: '📧',
    },
    {
      title: 'Remaining Requests',
      value: (usage?.quotaRemaining || 0).toLocaleString(),
      subtitle: `${usage?.quotaUsed || 0} used this month`,
      icon: '📊',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your extraction activity.
          </p>
        </div>
        <Link href="/dashboard/search">
          <Button size="lg">New Search</Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <span className="text-3xl">{stat.icon}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Searches</CardTitle>
            <CardDescription>Your latest extraction searches</CardDescription>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Recent searches will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/search">
              <Button variant="outline" className="w-full justify-start">
                🔍 New Search
              </Button>
            </Link>
            <Link href="/dashboard/api-keys">
              <Button variant="outline" className="w-full justify-start">
                🔑 API Keys
              </Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button variant="outline" className="w-full justify-start">
                💳 Billing
              </Button>
            </Link>
            <Link href="/dashboard/usage">
              <Button variant="outline" className="w-full justify-start">
                📊 Usage Stats
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Usage</CardTitle>
          <CardDescription>Your usage this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">API Requests</span>
                <span className="text-sm text-muted-foreground">
                  {usage?.quotaUsed || 0} / {usage?.quotaLimit || 0}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      ((usage?.quotaUsed || 0) / (usage?.quotaLimit || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
