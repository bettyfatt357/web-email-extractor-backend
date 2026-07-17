'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Plan {
  name: string;
  price: number;
  requests: number;
  description: string;
  features: string[];
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: 0,
    requests: 10,
    description: 'For getting started',
    features: ['10 requests/hour', '100 requests/month', '1 concurrent job', 'Community support'],
  },
  {
    name: 'Pro',
    price: 29,
    requests: 100,
    description: 'For growing teams',
    features: ['100 requests/hour', '10,000 requests/month', '5 concurrent jobs', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 99,
    requests: 1000,
    description: 'For large-scale operations',
    features: [
      '1000 requests/hour',
      'Unlimited requests/month',
      'Unlimited concurrent jobs',
      '24/7 dedicated support',
      'Custom integrations',
    ],
  },
];

const mockInvoices: Invoice[] = [
  {
    id: 'inv_001',
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 29,
    status: 'paid',
  },
  {
    id: 'inv_002',
    date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 29,
    status: 'paid',
  },
];

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<string>('Pro');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const handleUpgrade = (planName: string) => {
    // In production, redirect to Stripe checkout
    console.log(`Upgrading to ${planName}`);
  };

  const handleManageStripe = () => {
    // In production, redirect to Stripe customer portal
    console.log('Opening Stripe customer portal');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are on the {currentPlan} plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-2xl font-bold text-foreground">{currentPlan}</p>
            <p className="text-muted-foreground">
              ${plans.find((p) => p.name === currentPlan)?.price || 0}/month
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleManageStripe}>
              Manage Billing
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Subscription
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans Comparison */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.name === currentPlan;
            return (
              <Card
                key={plan.name}
                className={`relative ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              >
                {isCurrent && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-bl-lg">
                    Current Plan
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-3xl font-bold text-foreground">
                      ${plan.price}
                      <span className="text-base text-muted-foreground font-normal">/month</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.requests.toLocaleString()} requests/hour
                    </p>
                  </div>

                  <Button
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={isCurrent}
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                  >
                    {isCurrent ? 'Current Plan' : 'Choose Plan'}
                  </Button>

                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your recent invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet</p>
            ) : (
              mockInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 border border-border rounded-lg flex items-center justify-between hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium text-foreground">Invoice {invoice.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-foreground">${invoice.amount.toFixed(2)}</p>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded inline-block ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : invoice.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">
                      Download
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Information</CardTitle>
          <CardDescription>Manage your billing details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border border-border rounded-lg bg-muted/50">
            <p className="text-sm text-foreground font-medium mb-2">Billing Email</p>
            <p className="text-sm text-muted-foreground">user@example.com</p>
          </div>
          <Button variant="outline" onClick={handleManageStripe}>
            Update Payment Method
          </Button>
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Cancel Subscription</CardTitle>
              <CardDescription>
                Are you sure you want to cancel? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your subscription will remain active until the end of your billing period. After that,
                you'll be downgraded to the Free plan.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                  Keep Subscription
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowCancelDialog(false);
                    // Handle cancellation
                  }}
                >
                  Cancel Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
