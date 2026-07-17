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

export default function RegisterPage() {
  const router = useRouter()
  const { user, isLoading, signUp, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showVerificationMessage, setShowVerificationMessage] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

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

    if (!email || !password || !confirmPassword || !agreeToTerms) {
      return
    }

    if (!validatePassword()) {
      return
    }

    setIsSubmitting(true)
    await signUp(email, password)
    setIsSubmitting(false)
    
    // Check if signup returned a user (immediate session creation)
    // If user exists, router.refresh() will redirect to /dashboard
    // If no user (email confirmation required), show verification message
    if (!user) {
      // Email confirmation is required - show message to check email
      setShowVerificationMessage(true)
      setVerificationEmail(email)
      // Clear form
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setAgreeToTerms(false)
    } else {
      // Session created immediately - refresh to sync with server
      router.refresh()
    }
  }

  if (isLoading) {
    return <LoadingSpinner text="Checking authentication..." />
  }

  // Show verification message after signup
  if (showVerificationMessage) {
    return (
      <div className="flex justify-center">
        <AuthCard
          title="Check Your Email"
          subtitle="Verify your email address to complete signup"
          footer={
            <p className="text-muted-foreground">
              Didn't receive the email?{' '}
              <button
                onClick={() => {
                  setShowVerificationMessage(false)
                  setVerificationEmail('')
                }}
                className="text-primary font-medium hover:underline"
              >
                Try again
              </button>
            </p>
          }
        >
          <div className="space-y-4 text-center">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground mb-2">
                A verification link has been sent to:
              </p>
              <p className="font-medium text-foreground">{verificationEmail}</p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Click the link in the email to verify your account and complete the signup process.</p>
              <p>The verification link will expire in 24 hours.</p>
            </div>
          </div>
        </AuthCard>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <AuthCard
        title="Create Account"
        subtitle="Sign up to get started with Nastech"
        footer={
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
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
            Password must be at least 8 characters
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={agreeToTerms}
              onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
            />
            <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
              I agree to the{' '}
              <Link href="#" className="text-primary hover:underline">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link href="#" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </label>
          </div>

          <AuthButton
            type="submit"
            isLoading={isSubmitting}
            disabled={!email || !password || !confirmPassword || !agreeToTerms}
            className="mt-6"
          >
            Create Account
          </AuthButton>
        </form>
      </AuthCard>
    </div>
  )
}
