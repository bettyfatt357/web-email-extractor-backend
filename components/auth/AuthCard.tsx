'use client'

import React, { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {/* Content */}
        <div>
          {children}
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <div className="mt-6 text-center text-sm">
          {footer}
        </div>
      )}
    </div>
  )
}
