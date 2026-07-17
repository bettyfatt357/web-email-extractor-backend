'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { ErrorAlert } from '@/components/auth/ErrorAlert'
import { LoadingSpinner } from '@/components/auth/LoadingSpinner'
import { useAuth } from '@/hooks/use-auth'
import { CheckCircle } from 'lucide-react'

function ResetPasswordContent() {
  const router = useRouter()
  const { updatePassword, error, clearError } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [isValidToken, setIsValidToken] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // Check if token exists in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const token = searchParams.get('token')
    const type = searchParams.get('type')
    
    if (token && type === 'recovery') {
      setIsValidToken(true)
    }
    
    setIsChecking(false)
  }, [])

  const validatePassword = () => {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return false
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return false
    }
    setPasswordError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!password || !confirmPassword) {
      return
    }

    if (!validatePassword()) {
      return
    }

    setIsSubmitting(true)
    await updatePassword(password)
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isChecking) {
    return <LoadingSpinner text="Loading..." />
  }

  if (!isValidToken) {
    return (
      <div className="flex justify-center">
        <AuthCard
          title="Invalid Reset Link"
          footer={
            <Link href="/forgot-password" className="text-primary font-medium hover:underline">
              Request new reset link
            </Link>
          }
        >
          <div className="flex flex-col items-center text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              The password reset link is invalid or has expired.
            </p>
            <p className="text-xs text-muted-foreground">
              Please request a new password reset link.
            </p>
          </div>
        </AuthCard>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="flex justify-center">
        <AuthCard
          title="Password Updated"
          footer={
            <Link href="/login" className="text-primary font-medium hover:underline">
              Back to Sign In
            </Link>
          }
        >
          <div className="flex flex-col items-center text-center py-6">
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-card-foreground mb-2">
              Password successfully updated
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              You can now sign in with your new password.
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting to sign in in 3 seconds...
            </p>
          </div>
        </AuthCard>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <AuthCard
        title="Reset Your Password"
        subtitle="Enter your new password below"
        footer={
          <Link href="/login" className="text-primary font-medium hover:underline">
            Back to Sign In
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <ErrorAlert message={error.message} onDismiss={clearError} />
          )}

          <AuthInput
            label="New Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            error={passwordError || undefined}
            required
            autoComplete="new-password"
          />

          <AuthInput
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            autoComplete="new-password"
          />

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Password must be at least 8 characters and match the confirmation
          </div>

          <AuthButton
            type="submit"
            isLoading={isSubmitting}
            disabled={!password || !confirmPassword}
            className="mt-6"
          >
            Update Password
          </AuthButton>
        </form>
      </AuthCard>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
