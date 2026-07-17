'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface AuthButtonProps {
  children: React.ReactNode
  isLoading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  className?: string
}

export function AuthButton({
  children,
  isLoading = false,
  disabled = false,
  type = 'button',
  onClick,
  className,
}: AuthButtonProps) {
  return (
    <Button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`w-full ${className}`}
      size="lg"
    >
      {isLoading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      {children}
    </Button>
  )
}
