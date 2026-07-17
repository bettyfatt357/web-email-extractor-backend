'use client'

import React from 'react'
import { Input } from '@/components/ui/input'

interface AuthInputProps {
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  autoComplete?: string
  required?: boolean
}

export function AuthInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  disabled,
  autoComplete,
  required = false,
}: AuthInputProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-card-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        className={error ? 'border-destructive' : ''}
      />
      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
