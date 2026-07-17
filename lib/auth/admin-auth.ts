import { NextRequest, NextResponse } from 'next/server';
import { AuthedRequest, User } from './middleware';

/**
 * Check if user has admin authorization
 * 
 * Responsibilities:
 * - Check user.isAdmin or user.role properties
 * - Return true/false based on authorization
 * 
 * Does NOT care about how isAdmin flag was set during authentication
 * Works with any authentication provider that sets isAdmin/role
 */
export async function validateAdminRole(user: User): Promise<boolean> {
  const result = user.isAdmin === true || user.role === 'admin' || user.role === 'super_admin';
  console.log('[auth-admin] validateAdminRole: user={ isAdmin:', user.isAdmin, ', role:', user.role, '}, result:', result);
  return result;
}

/**
 * Check if user has super admin authorization
 */
export async function validateSuperAdminRole(user: User): Promise<boolean> {
  return user.role === 'super_admin';
}

/**
 * Admin authorization middleware
 * 
 * Responsibilities:
 * - Check if user is authenticated (withAuth runs first)
 * - Check if user.isAdmin property is true
 * - Deny access if not authorized
 * 
 * Does NOT validate credentials - that's withAuth()'s job
 */
export function withAdminAuth(
  handler: (req: AuthedRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest) => {
    try {
      const authedRequest = request as AuthedRequest;

      // User must be authenticated first (withAuth runs first in middleware chain)
      if (!authedRequest.user) {
        console.log('[auth-admin] withAdminAuth: no user - 401');
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 }
        );
      }

      // Check if user has admin permission
      const isAdmin = await validateAdminRole(authedRequest.user);
      
      if (!isAdmin) {
        console.log('[auth-admin] withAdminAuth: 403 Forbidden - user not admin');
        return NextResponse.json(
          { error: 'Forbidden - admin access required' },
          { status: 403 }
        );
      }

      // User is authorized, call handler
      return handler(authedRequest);
    } catch (error) {
      console.error('[auth-admin] Error in withAdminAuth:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Super admin only authorization middleware
 */
export function withSuperAdminAuth(
  handler: (req: AuthedRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest) => {
    try {
      const authedRequest = request as AuthedRequest;

      // User must be authenticated first
      if (!authedRequest.user) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 }
        );
      }

      // Check if user has super admin permission
      const isSuperAdmin = await validateSuperAdminRole(authedRequest.user);
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden - super admin access required' },
          { status: 403 }
        );
      }

      // User is authorized, call handler
      return handler(authedRequest);
    } catch (error) {
      console.error('[SUPER-ADMIN-AUTH] Error in super admin authorization middleware:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
