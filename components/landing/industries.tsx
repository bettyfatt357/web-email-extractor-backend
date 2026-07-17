'use client'

import { Card } from '@/components/ui/card'
import { Briefcase, Users, Building2, TrendingUp, DollarSign, Home, Scale, BookOpen, Lightbulb } from 'lucide-react'

const industries = [
  { icon: Users, title: 'Recruiters', description: 'Find candidates and decision makers across target companies.' },
  { icon: TrendingUp, title: 'Sales Teams', description: 'Identify prospects and build high-quality prospect lists.' },
  { icon: Briefcase, title: 'Marketing Agencies', description: 'Discover clients and decision makers for outreach.' },
  { icon: DollarSign, title: 'Private Equity', description: 'Research investment targets and portfolio companies.' },
  { icon: Building2, title: 'Venture Capital', description: 'Identify founder contacts and investment opportunities.' },
  { icon: Home, title: 'Real Estate', description: 'Find property contacts and decision makers.' },
  { icon: Scale, title: 'Legal', description: 'Research corporate contacts for legal discovery.' },
  { icon: BookOpen, title: 'Researchers', description: 'Access verified business and contact data for studies.' },
  { icon: Lightbulb, title: 'Consultants', description: 'Build prospect lists for consulting engagements.' },
]

export function Industries() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Built for Every Industry
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            From recruiting to research, discover how Nastech serves your industry.
          </p>
        </div>

        {/* Industries Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {industries.map((industry, idx) => {
            const Icon = industry.icon
            return (
              <Card key={idx} className="p-6 hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{industry.title}</h3>
                <p className="text-sm text-foreground/70">{industry.description}</p>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
