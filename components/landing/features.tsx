'use client'

import { Search, MapPin, Mail, Zap, Shield, BarChart3, Clock, Save, Lock, Gauge } from 'lucide-react'
import { Card } from '@/components/ui/card'

const features = [
  {
    icon: Search,
    title: 'AI Business Discovery',
    description: 'Intelligent search across millions of businesses using advanced filtering and ranking algorithms.',
  },
  {
    icon: MapPin,
    title: 'Location-Based Search',
    description: 'Target specific regions, cities, and territories with geographic filtering capabilities.',
  },
  {
    icon: Mail,
    title: 'Email Pattern Search',
    description: 'Find emails matching custom patterns like firstname@domain or initial.lastname@company.com.',
  },
  {
    icon: Zap,
    title: 'Contact Intelligence',
    description: 'Extract and verify phone numbers, websites, and decision maker contact information.',
  },
  {
    icon: Clock,
    title: 'Background Processing',
    description: 'Jobs run in the background with real-time status updates and instant result delivery.',
  },
  {
    icon: BarChart3,
    title: 'Job Queue Monitoring',
    description: 'Monitor discovery jobs, track processing status, and manage queue priorities.',
  },
  {
    icon: Save,
    title: 'Saved Searches',
    description: 'Save search queries and results for later reference, comparison, and re-running.',
  },
  {
    icon: Gauge,
    title: 'Fast Processing',
    description: 'Optimized workers process thousands of results per minute with low latency.',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'Bank-level encryption, API keys, and role-based access control for teams.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            Everything you need to discover businesses, extract contacts, and scale your outreach.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card key={idx} className="p-6 hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-foreground/70">{feature.description}</p>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
