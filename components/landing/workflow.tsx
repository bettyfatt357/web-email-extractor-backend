'use client'

import { Card } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'

export function Workflow() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
            Simple, powerful discovery in three steps.
          </p>
        </div>

        {/* Workflow Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Step 1 */}
          <div>
            <Card className="p-8 mb-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="text-xl font-semibold">Enter Search Criteria</h3>
              </div>
              <ul className="space-y-3 text-foreground/70 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Business keywords</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Target location</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Email pattern</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Search depth & delay</span>
                </li>
              </ul>
            </Card>
            <div className="hidden md:flex justify-center">
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <Card className="p-8 mb-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="text-xl font-semibold">AI Discovery Engine</h3>
              </div>
              <ul className="space-y-3 text-foreground/70 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Google Search integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Intelligent filtering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Queue processing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Email extraction</span>
                </li>
              </ul>
            </Card>
            <div className="hidden md:flex justify-center">
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <Card className="p-8 mb-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="text-xl font-semibold">Get Results</h3>
              </div>
              <ul className="space-y-3 text-foreground/70 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Companies list</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Verified emails</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Phone numbers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Export & save</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}
