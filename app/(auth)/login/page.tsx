'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { ErrorAlert } from '@/components/auth/ErrorAlert'
import { LoadingSpinner } from '@/components/auth/LoadingSpinner'
import { useAuth } from '@/hooks/use-auth'
import { Checkbox } from '@/components/ui/checkbox'

export default function LoginPage() {
  const router = useRouter()
  const { user, isLoading, signIn, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!email || !password) {
      return
    }

    setIsSubmitting(true)
    await signIn(email, password)
    setIsSubmitting(false)
    
    // Refresh to sync with server state and trigger useEffect redirect
    router.refresh()
  }

  if (isLoading) {
    return <LoadingSpinner text="Checking authentication..." />
  }

  return (
    <div className="flex justify-center">
      <AuthCard
        title="Sign In to Nastech"
        subtitle="Enter your credentials to access your dashboard"
        footer={
          <p className="text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <ErrorAlert message={error.message} onDismiss={clearError} />
          )}

          <AuthInput
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
          />

          <AuthInput
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <label htmlFor="remember" className="text-muted-foreground cursor-pointer">
                Remember me
              </label>
            </div>
            <Link href="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <AuthButton
            type="submit"
            isLoading={isSubmitting}
            disabled={!email || !password}
            className="mt-6"
          >
            Sign In
          </AuthButton>
        </form>
      </AuthCard>
    </div>
  )
}
