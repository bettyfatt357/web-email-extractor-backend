'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for individuals and small teams',
    features: [
      'Up to 10 searches/month',
      'Basic email extraction',
      '1,000 results per search',
      'CSV export',
      'Email support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '$99',
    period: '/month',
    description: 'Best for growing businesses',
    features: [
      'Unlimited searches',
      'Advanced email extraction',
      'Up to 100K results per search',
      'API access',
      'Priority email support',
      'Search history & saved queries',
      'Background job monitoring',
    ],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    description: 'For large organizations',
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      '24/7 phone support',
      'Team collaboration',
      'Advanced analytics',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            Choose the plan that fits your needs. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, idx) => (
            <Card
              key={idx}
              className={`p-8 flex flex-col ${
                plan.highlighted ? 'ring-2 ring-primary scale-105' : ''
              } hover:border-primary/50 transition-all`}
            >
              {plan.highlighted && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4 w-fit">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-xs font-medium text-primary">Most Popular</span>
                </div>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-foreground/70 text-sm mb-6">{plan.description}</p>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period !== 'pricing' && <span className="text-foreground/60">{plan.period}</span>}
                </div>
              </div>

              <Link href="/dashboard" className="mb-8">
                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>

              <div className="space-y-4">
                {plan.features.map((feature, fidx) => (
                  <div key={fidx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground/70">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-foreground/60 mt-12">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </section>
  )
}
