import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Email Verification Callback Handler
 * 
 * Receives verification code from Supabase email link and exchanges it for a session.
 * 
 * Flow:
 * 1. User clicks email verification link: /auth/callback?code=xxx&type=email_verification
 * 2. Route extracts code and type from URL
 * 3. Exchange code with Supabase using verifyOtp()
 * 4. Supabase creates session and updates email_confirmed_at
 * 5. Session stored in httpOnly cookies
 * 6. Redirect to /dashboard
 * 
 * Error cases:
 * - Invalid/expired code: Show error message
 * - Already verified user: Redirect to dashboard
 * - Code exchange failure: Show error message
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle Supabase error responses
  if (error) {
    const message = errorDescription || error
    const encodedMessage = encodeURIComponent(message)
    return NextResponse.redirect(
      new URL(`/login?error=${encodedMessage}`, request.url)
    )
  }

  // Check for required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL(
        '/login?error=' + encodeURIComponent('Invalid verification link'),
        request.url
      )
    )
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Email Verification] Missing Supabase environment variables')
      return NextResponse.redirect(
        new URL(
          '/login?error=' + encodeURIComponent('Email verification service unavailable'),
          request.url
        )
      )
    }

    const cookieStore = await cookies()
    let response = NextResponse.redirect(new URL('/dashboard', request.url))

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // Exchange code for session
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: code,
      type: 'email_verification',
    })

    if (verifyError || !data?.session) {
      let message = 'Failed to verify email'
      
      if (verifyError?.message.includes('invalid or expired')) {
        message = 'Verification link has expired. Please sign up again.'
      } else if (verifyError?.message.includes('already confirmed')) {
        message = 'Email already verified. You can log in now.'
      } else if (verifyError?.message) {
        message = verifyError.message
      }

      const encodedMessage = encodeURIComponent(message)
      return NextResponse.redirect(
        new URL(`/login?error=${encodedMessage}`, request.url)
      )
    }

    // Session created successfully - redirect to dashboard with updated cookies
    return response
  } catch (err) {
    console.error('[Email Verification] Error:', err)
    
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    const encodedMessage = encodeURIComponent(message)
    
    return NextResponse.redirect(
      new URL(`/login?error=${encodedMessage}`, request.url)
    )
  }
}
