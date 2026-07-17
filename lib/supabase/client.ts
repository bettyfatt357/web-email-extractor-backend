import { createBrowserClient } from '@supabase/ssr'

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

/**
 * Get or create Supabase browser client (lazy-loaded)
 * Uses official @supabase/ssr createBrowserClient for proper SSR session management
 * Environment variables are validated only when client is first used, not at build time
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }

    supabaseClient = createBrowserClient(url, key)
  }

  return supabaseClient
}

// Lazy getter function - used in place of direct supabase import
export { getSupabaseClient as supabase }
