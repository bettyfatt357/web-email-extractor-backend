import { NextRequest, NextResponse } from 'next/server';

/**
 * Authenticated user object
 * Contains credentials and authorization properties
 * Designed to support multiple authentication providers
 */
export interface User {
  id: string;
  credential: string; // API key, JWT, session ID, etc.
  isAdmin: boolean;
  role: 'user' | 'admin' | 'super_admin';
  plan: 'free' | 'pro' | 'enterprise';
}

export interface AuthedRequest extends NextRequest {
  user?: User;
}

/**
 * Load user object from credential
 * 
 * This is the ONLY point that needs to change when migrating auth providers.
 * 
 * Current: Validates API key format, recognizes ADMIN_CREDENTIAL in development
 * Future: Can query database, verify Clerk tokens, validate Auth.js sessions, etc.
 */
export async function loadUserFromCredential(
  credential: string | undefined
): Promise<User | null> {
  if (!credential) {
    return null;
  }

  // Development: Check if credential is the admin credential
  const adminCredential = process.env.ADMIN_CREDENTIAL;
  
  if (adminCredential && credential === adminCredential) {
    const adminUser: User = {
      id: 'admin-user-dev',
      credential,
      isAdmin: true,
      role: 'super_admin',
      plan: 'enterprise',
    };
    return adminUser;
  }

  // Regular user: Validate API key format
  // Accepts both test and live keys
  if (credential.startsWith('sk_test_') || credential.startsWith('sk_live_')) {
    // Determine plan from credential
    const plan: 'free' | 'pro' | 'enterprise' = credential.includes('pro')
      ? 'pro'
      : 'free';
    
    // Use full credential as user ID for consistency
    const regularUser: User = {
      id: credential,
      credential,
      isAdmin: false,
      role: 'user',
      plan,
    };
    return regularUser;
  }

  // Invalid credential format
  return null;
}

/**
 * Authentication middleware
 * 
 * Responsibilities:
 * - Extract credential from x-api-key header
 * - Load user object via loadUserFromCredential()
 * - Attach user to request
 * 
 * Does NOT handle authorization - that's withAdminAuth()'s job
 */
export function withAuth(
  handler: (req: AuthedRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest) => {
    try {
      const credential = request.headers.get('x-api-key');

      // Check for anonymous access
      if (!credential && process.env.ALLOW_ANONYMOUS === 'true') {
        return handler(request as AuthedRequest);
      }

      // If credential provided, load user
      if (credential) {
        const user = await loadUserFromCredential(credential);

        if (!user) {
          return NextResponse.json(
            { error: 'Invalid API key' },
            { status: 401 }
          );
        }

        // Attach user to request with isAdmin flag set
        (request as AuthedRequest).user = user;
        return handler(request as AuthedRequest);
      }

      // No credential and anonymous not allowed
      return NextResponse.json(
        { error: 'Unauthorized - API key required' },
        { status: 401 }
      );
    } catch (error) {
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Extract user ID from request (authenticated or anonymous)
 * Used for audit logging, analytics, etc.
 */
export function getUserId(request: AuthedRequest): string {
  const user = (request as AuthedRequest).user;
  if (user?.id) {
    return user.id;
  }

  // For anonymous users, use IP or session ID
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  return `anon_${ip.replace(/[^a-zA-Z0-9]/g, '')}`;
}
