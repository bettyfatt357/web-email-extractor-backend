import { type NextRequest, NextResponse } from 'next/server'
import { refreshServerSession } from '@/lib/supabase/server'

/**
 * Middleware Configuration for Supabase SSR
 * 
 * This middleware synchronizes session state between:
 * - Browser (via httpOnly cookies)
 * - Server (via request/response cookie management)
 * 
 * On every request, refreshServerSession():
 * 1. Reads cookies from browser (sent in request headers)
 * 2. Validates session with Supabase
 * 3. Refreshes token if needed
 * 4. Returns response with updated cookies
 * 
 * This ensures server and browser always have the same session state.
 */
export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes (API auth handled by lib/auth/middleware.ts)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip middleware for admin routes (admin auth uses ADMIN_CREDENTIAL)
  if (pathname.startsWith('/admin/')) {
    return NextResponse.next()
  }

  try {
    // Refresh session and get response with updated cookies (handles cookie sync)
    const { session, response } = await refreshServerSession(request)

    // Public routes - always allow
    const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/auth/callback']
    if (publicRoutes.includes(pathname)) {
      // If user is already authenticated, redirect away from auth pages
      if (session && (pathname === '/login' || pathname === '/register')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return response
    }

    // Protected routes - require authentication
    if (pathname.startsWith('/dashboard')) {
      if (!session) {
        // User not authenticated, redirect to login
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

    return response
  } catch (error) {
    console.error('[Middleware] Error:', error)
    // On error, allow request to continue (fail open for robustness)
    return NextResponse.next()
  }
}
