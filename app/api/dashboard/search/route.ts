/**
 * POST /api/dashboard/search
 * 
 * Dashboard Search API - Internal use only
 * Accepts a search query, searches with configured provider, and queues extraction jobs
 * 
 * Authentication: Supabase session (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  performSearch,
  performAdvancedSearch,
  validateSearchRequest,
  validateAdvancedSearchRequest,
} from '@/lib/search/search-service';
import { googleConfig } from '@/lib/config/google';
import { withDashboardAuth, DashboardAuthRequest } from '@/lib/auth/middleware-dashboard';
import { trackUsageEvent } from '@/lib/auth/usage-tracking';

async function handler(request: DashboardAuthRequest): Promise<NextResponse> {
  try {
    // User authentication is already validated by withDashboardAuth
    const user = (request as DashboardAuthRequest).user;
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Google configuration first
    if (!googleConfig.isConfigured()) {
      console.error('[Dashboard Search] Google Search API configuration missing');
      return NextResponse.json(
        { error: 'Search provider not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { query, pages = 1, keywords, patterns, location, searchDepth = 1, delayMs = 200 } = body;

    let result;

    // Determine search mode: advanced if keywords provided, simple otherwise
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // Advanced mode
      console.log('[Dashboard Search] Advanced search request:', {
        userId: user.id,
        keywordCount: keywords.length,
        location,
        patternCount: patterns?.length || 0,
        searchDepth,
        delayMs,
      });

      // Validate advanced request
      const validationError = validateAdvancedSearchRequest(keywords, patterns, location, searchDepth, delayMs);
      if (validationError) {
        console.log('[Dashboard Search] Advanced validation error:', validationError);
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }

      // Perform advanced search
      result = await performAdvancedSearch(keywords, location, patterns, searchDepth, delayMs);
    } else {
      // Simple mode (backward compatible)
      console.log('[Dashboard Search] Simple search request:', { userId: user.id, query, pages });

      // Validate simple request
      const validationError = validateSearchRequest(query, pages);
      if (validationError) {
        console.log('[Dashboard Search] Validation error:', validationError);
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }

      // Perform simple search
      result = await performSearch(query, pages);
    }

    console.log('[Dashboard Search] Search completed:', {
      userId: user.id,
      totalQueued: result.totalQueued,
      searchId: result.searchId,
    });

    // Track usage event
    if (user.id) {
      await trackUsageEvent(user.id, 'search', {
        mode: keywords?.length ? 'advanced' : 'simple',
        jobsQueued: result.totalQueued,
      }).catch(err => {
        console.error('[Dashboard Search] Usage tracking error:', err);
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Dashboard Search] Error:', message);

    if (message.includes('quota') || message.includes('Quota')) {
      return NextResponse.json(
        { error: 'Search provider quota exceeded' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

export const POST = withDashboardAuth(handler);

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({
    methods: ['POST'],
    description: 'Dashboard Search API - Internal use only',
    authentication: 'Supabase session (httpOnly cookies)',
    modes: {
      simple: {
        body: { query: 'string', pages: 'number (1-5)' }
      },
      advanced: {
        body: {
          keywords: 'string[]',
          location: 'string?',
          patterns: 'string[]?',
          searchDepth: 'number (1-5)',
          delayMs: 'number (100-2000)'
        }
      }
    }
  }, { status: 200 });
}
