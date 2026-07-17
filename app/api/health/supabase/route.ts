import { NextResponse } from 'next/server'
import { verifySupabaseConnection, getSupabaseHealth } from '@/lib/supabase/utils'

export async function GET() {
  try {
    const health = await getSupabaseHealth()
    
    return NextResponse.json(
      {
        supabase: health,
        timestamp: new Date().toISOString(),
      },
      {
        status: health.connected ? 200 : 503,
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check Supabase health',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
