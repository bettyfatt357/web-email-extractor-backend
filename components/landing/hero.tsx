'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <div className="relative min-h-screen pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm text-primary font-medium">AI-Powered Discovery</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter mb-6">
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Discover Businesses.
          </span>
          <br />
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Extract Intelligence.
          </span>
          <br />
          <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Scale Your Outreach.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-foreground/70 mb-10 max-w-2xl mx-auto leading-relaxed">
          Nastech Discovery Intelligence helps recruiters, agencies, researchers, investors, and sales teams discover businesses, identify decision makers, extract verified contact information, and manage discovery jobs from one intelligent platform.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/dashboard">
            <Button size="lg" className="bg-primary hover:bg-primary/90 h-12 px-8 text-base">
              Start Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 pt-12 border-t border-border">
          <div>
            <div className="text-3xl sm:text-4xl font-bold mb-2">10M+</div>
            <div className="text-sm text-foreground/60">Businesses Discovered</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold mb-2">50M+</div>
            <div className="text-sm text-foreground/60">Emails Extracted</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold mb-2">99%</div>
            <div className="text-sm text-foreground/60">Accuracy Rate</div>
          </div>
        </div>
      </div>
    </div>
  )
}
