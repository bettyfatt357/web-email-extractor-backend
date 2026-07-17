'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import * as authApi from '@/lib/supabase/auth'

export type AuthError = {
  message: string
  code?: string
}

export interface UseAuthReturn {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  error: AuthError | null
  clearError: () => void
}

/**
 * Hook for managing Supabase authentication state
 *
 * Automatically loads session on mount and subscribes to auth changes.
 * Provides methods for signUp, signIn, signOut, and password management.
 *
 * @example
 * const { user, isLoading, signIn, signOut } = useAuth()
 *
 * if (isLoading) return <LoadingSpinner />
 * if (!user) return <LoginForm />
 * return <Dashboard />
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null)

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true)
      const { data, error } = await authApi.getUser()

      if (error) {
        setUser(null)
      } else {
        setUser(data)
      }

      setIsLoading(false)
    }

    loadSession()

    // Subscribe to auth state changes
    const subscription = authApi.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        setError(null)
      }, 5000)

      setErrorTimeout(timeout)

      return () => clearTimeout(timeout)
    }
  }, [error])

  const handleSignIn = async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)

    const { data, error } = await authApi.signIn(email, password)

    if (error) {
      setError(error)
      setIsLoading(false)
      return
    }

    // Update user state immediately from response
    if (data?.user) {
      setUser(data.user)
    }

    setIsLoading(false)
  }

  const handleSignUp = async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)

    const { data, error } = await authApi.signUp(email, password)

    if (error) {
      setError(error)
      setIsLoading(false)
      return
    }

    // Update user state immediately from response
    if (data?.user) {
      setUser(data.user)
    }

    setIsLoading(false)
  }

  const handleSignOut = async () => {
    setError(null)
    setIsLoading(true)
    
    // Clear user state immediately
    setUser(null)

    const { error } = await authApi.signOut()

    if (error) {
      setError(error)
    }

    setIsLoading(false)
  }

  const handleResetPasswordForEmail = async (email: string) => {
    setError(null)
    setIsLoading(true)

    const { error } = await authApi.resetPasswordForEmail(email)

    if (error) {
      setError(error)
    }

    setIsLoading(false)
  }

  const handleUpdatePassword = async (password: string) => {
    setError(null)
    setIsLoading(true)

    const { error } = await authApi.updatePassword(password)

    if (error) {
      setError(error)
    }

    setIsLoading(false)
  }

  const clearError = () => {
    setError(null)
    if (errorTimeout) {
      clearTimeout(errorTimeout)
      setErrorTimeout(null)
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    resetPasswordForEmail: handleResetPasswordForEmail,
    updatePassword: handleUpdatePassword,
    error,
    clearError,
  }
}
