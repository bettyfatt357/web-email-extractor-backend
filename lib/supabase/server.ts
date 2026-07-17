import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase server environment variables')
}

/**
 * Session Lifecycle (Unified Browser + Server):
 * 
 * 1. User signs in via browser client (createBrowserClient)
 *    → Supabase sets session cookies (httpOnly, Secure, SameSite)
 *    → Browser stores in document.cookie (but JS cannot access httpOnly)
 * 
 * 2. Next.js request reaches middleware
 *    → middleware.ts calls refreshServerSession()
 *    → Cookies automatically sent by browser in request headers
 *    → Server receives cookies and validates session
 * 
 * 3. Server updates cookies if tokens refreshed
 *    → Cookies propagated back in response
 *    → Browser receives updated cookies automatically
 * 
 * 4. Browser client re-authenticates on next request
 *    → Calls createBrowserClient (client-side)
 *    → Browser automatically includes cookies in request
 *    → Session persists across page reloads
 * 
 * Key: Browser and Server sync via httpOnly cookies (not localStorage)
 */

/**
 * Create a Supabase client for server-side operations
 * Used for server components and API routes
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch (error) {
          // Handle cookie setting errors (can happen in edge runtime)
          console.error('[Supabase] Error setting cookies:', error)
        }
      },
    },
  })
}

/**
 * Create a Supabase client for middleware
 * Handles request/response cookie management
 */
export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  return { supabase, response }
}

/**
 * Get the current session from the request
 * Used in middleware for route protection
 */
export async function getServerSession(request: NextRequest) {
  const { supabase } = createSupabaseMiddlewareClient(request)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session
}

/**
 * Get the current user from the request
 */
export async function getServerUser(request: NextRequest) {
  const { supabase } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

/**
 * Refresh the current session if needed
 * Auto-refreshes access token using refresh token
 */
export async function refreshServerSession(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { session, response }
}
