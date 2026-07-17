/**
 * Utility functions for Supabase operations
 * Connectivity verification helpers for Phase 1
 */

import { getSupabaseClient } from './client'

/**
 * Verify Supabase client connectivity
 * Returns true if connection is successful
 */
export async function verifySupabaseConnection(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('[Supabase] Connection verification error:', error.message)
      return false
    }
    
    console.log('[Supabase] Connection verified successfully')
    return true
  } catch (err) {
    console.error('[Supabase] Connection verification failed:', err)
    return false
  }
}

/**
 * Get health status of Supabase connection
 */
export async function getSupabaseHealth() {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    
    return {
      status: error ? 'error' : 'healthy',
      error: error ? error.message : null,
      connected: !error,
    }
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      connected: false,
    }
  }
}
