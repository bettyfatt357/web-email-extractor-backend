'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { ErrorAlert } from '@/components/auth/ErrorAlert'
import { useAuth } from '@/hooks/use-auth'
import { Mail, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!email) {
      return
    }

    setIsSubmitting(true)
    await resetPasswordForEmail(email)
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <div className="flex justify-center">
        <AuthCard
          title="Check Your Email"
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
              Password reset email sent
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <p className="text-xs text-muted-foreground">
              Check your spam folder if you don&apos;t see it in your inbox.
            </p>
          </div>
        </AuthCard>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <AuthCard
        title="Forgot Your Password?"
        subtitle="Enter your email and we&apos;ll send you a reset link"
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
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            required
            autoComplete="email"
          />

          <AuthButton
            type="submit"
            isLoading={isSubmitting}
            disabled={!email}
            className="mt-6"
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Reset Email
          </AuthButton>
        </form>
      </AuthCard>
    </div>
  )
}
