import { NextRequest, NextResponse } from 'next/server'
import { refreshServerSession } from '@/lib/supabase/server'

/**
 * Dashboard User Object
 * Authenticated user from Supabase session
 */
export interface DashboardUser {
  id: string
  email: string
}

export interface DashboardAuthRequest extends NextRequest {
  user?: DashboardUser
}

/**
 * Dashboard Authentication Middleware
 * 
 * Validates Supabase session from httpOnly cookies for internal dashboard APIs.
 * 
 * Requirements:
 * - Session must exist in httpOnly cookies (set by browser after Supabase login)
 * - Session must be valid (not expired, access token valid)
 * - Returns 401 if session invalid/missing
 * - Attaches user info to request for handler to use
 * 
 * Usage:
 * ```typescript
 * export const GET = withDashboardAuth(handler);
 * ```
 */
export function withDashboardAuth(
  handler: (req: DashboardAuthRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest) => {
    try {
      // Extract and validate Supabase session from cookies
      const { session } = await refreshServerSession(request)

      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized - session required' },
          { status: 401 }
        )
      }

      // Attach user to request
      const dashboardRequest = request as DashboardAuthRequest
      dashboardRequest.user = {
        id: session.user.id,
        email: session.user.email || '',
      }

      return handler(dashboardRequest)
    } catch (error) {
      console.error('[Dashboard Auth] Error:', error)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      )
    }
  }
}
