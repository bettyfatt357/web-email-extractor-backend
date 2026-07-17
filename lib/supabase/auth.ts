import { getSupabaseClient } from './client'

export type AuthError = {
  message: string
  code?: string
}

export type AuthResponse<T = any> = {
  data: T
  error: AuthError | null
}

/**
 * Register a new user with email and password
 */
export async function signUp(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
      },
    })

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data: { success: true },
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Get the current authenticated user
 */
export async function getUser() {
  try {
    const supabase = getSupabaseClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data: user,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Get the current session
 */
export async function getSession() {
  try {
    const supabase = getSupabaseClient()

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data: session,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  const supabase = getSupabaseClient()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })

  return subscription
}

/**
 * Send password reset email
 */
export async function resetPasswordForEmail(
  email: string
): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
    })

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Update user password
 */
export async function updatePassword(password: string): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}

/**
 * Verify email OTP (one-time password)
 * Used for email confirmation and verification links
 */
export async function verifyOtp(
  email: string,
  token: string,
  type: 'email_verification' | 'recovery' = 'email_verification'
): Promise<AuthResponse> {
  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    })

    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          code: error.status?.toString(),
        },
      }
    }

    return {
      data,
      error: null,
    }
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
      },
    }
  }
}
