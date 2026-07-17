'use client'

import { useEffect, useState } from 'react'

interface Stats {
  businesses: number
  emails: number
  searches: number
  accuracy: number
}

interface Targets {
  businesses: number
  emails: number
  searches: number
  accuracy: number
}

interface Durations {
  businesses: number
  emails: number
  searches: number
  accuracy: number
}

export function Stats() {
  const [stats, setStats] = useState<Stats>({
    businesses: 0,
    emails: 0,
    searches: 0,
    accuracy: 0,
  })

  useEffect(() => {
    const targets: Targets = {
      businesses: 10000000,
      emails: 50000000,
      searches: 500000,
      accuracy: 99,
    }

    const durations: Durations = {
      businesses: 2000,
      emails: 2500,
      searches: 2000,
      accuracy: 1500,
    }

    const intervals: Record<string, NodeJS.Timeout> = {}
    const startTimes: Record<string, number> = {}

    Object.entries(targets).forEach(([key, target]) => {
      startTimes[key] = Date.now()
      intervals[key] = setInterval(() => {
        const elapsed = Date.now() - startTimes[key]
        const duration = durations[key as keyof Durations]
        const progress = Math.min(elapsed / duration, 1)
        const current = Math.floor(target * progress)
        setStats((prev) => ({ ...prev, [key]: current }))

        if (progress === 1) {
          clearInterval(intervals[key])
        }
      }, 16)
    })

    return () => {
      Object.values(intervals).forEach((interval) => clearInterval(interval))
    }
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M+'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K+'
    }
    return num.toString()
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {formatNumber(stats.businesses)}
            </div>
            <div className="text-sm text-foreground/70">Businesses Discovered</div>
          </div>
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {formatNumber(stats.emails)}
            </div>
            <div className="text-sm text-foreground/70">Emails Extracted</div>
          </div>
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {formatNumber(stats.searches)}
            </div>
            <div className="text-sm text-foreground/70">Searches Processed</div>
          </div>
          <div className="text-center">
            <div className="text-5xl sm:text-6xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {stats.accuracy}%
            </div>
            <div className="text-sm text-foreground/70">Discovery Accuracy</div>
          </div>
        </div>
      </div>
    </section>
  )
}
