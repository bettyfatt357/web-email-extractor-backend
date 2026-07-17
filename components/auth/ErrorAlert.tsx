'use client'

import React from 'react'
import { AlertCircle, X } from 'lucide-react'

interface ErrorAlertProps {
  message: string
  onDismiss?: () => void
}

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 mb-6 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm text-destructive">
        {message}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-destructive/60 hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
