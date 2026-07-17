/**
 * POST /api/search
 * 
 * Google PSE Search API
 * Accepts a search query, searches with Google PSE, and queues extraction jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  performSearch,
  performAdvancedSearch,
  validateSearchRequest,
  validateAdvancedSearchRequest,
} from '@/lib/search/search-service';
import { googleConfig } from '@/lib/config/google';
import { withAuth, AuthedRequest, getUserId } from '@/lib/auth/middleware';
import { withRateLimit } from '@/lib/auth/rate-limit';
import { withBilling } from '@/lib/auth/billing';
import { trackUsageEvent } from '@/lib/auth/usage-tracking';

async function handler(request: AuthedRequest): Promise<NextResponse> {
  try {
    // Check Google configuration first
    if (!googleConfig.isConfigured()) {
      console.error('[API] Google Search API configuration missing');
      return NextResponse.json(
        { error: 'Google Search API configuration missing' },
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
      console.log('[API] Advanced search request received:', {
        keywordCount: keywords.length,
        location,
        patternCount: patterns?.length || 0,
        searchDepth,
        delayMs,
      });

      // Validate advanced request
      const validationError = validateAdvancedSearchRequest(keywords, patterns, location, searchDepth, delayMs);
      if (validationError) {
        console.log('[API] Advanced validation error:', validationError);
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }

      // Perform advanced search
      result = await performAdvancedSearch(keywords, location, patterns, searchDepth, delayMs);
    } else {
      // Simple mode (backward compatible)
      console.log('[API] Simple search request received:', { query, pages });

      // Validate simple request
      const validationError = validateSearchRequest(query, pages);
      if (validationError) {
        console.log('[API] Validation error:', validationError);
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }

      // Perform simple search
      result = await performSearch(query, pages);
    }

    const isAdvanced = 'searchMode' in result && result.searchMode === 'advanced';
    console.log('[API] Search completed:', {
      mode: isAdvanced ? 'advanced' : 'simple',
      searchId: result.searchId,
      jobsCreated: result.totalQueued,
      duplicatesRemoved: result.duplicatesRemoved,
      ...(isAdvanced && { keywordsProcessed: (result as any).keywordsProcessed?.length }),
    });

    // Track usage after successful request
    const userId = getUserId(request);
    await trackUsageEvent(userId, '/api/search', 'search', {
      jobsCreated: result.totalQueued,
      success: true,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Check if it's a configuration error
    if (message.includes('configuration missing')) {
      console.error('[API] Configuration error:', message);
      return NextResponse.json(
        { error: 'Google Search API configuration missing' },
        { status: 500 }
      );
    }

    // Check if it's a quota error
    if (message.includes('quota')) {
      console.error('[API] Google API quota exceeded:', message);
      return NextResponse.json(
        { error: 'Google API quota exceeded. Please try again later.' },
        { status: 503 }
      );
    }

    // Generic error
    console.error('[API] Search error:', message);
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Export wrapped POST handler with auth, rate limiting, and billing
 * Middleware chain: Auth -> RateLimit -> Billing -> Handler
 */
export const POST = withAuth(withRateLimit(withBilling(handler)));

/**
 * OPTIONS /api/search
 * CORS and method information
 */
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {
      methods: ['POST'],
      description: 'Google PSE Search API - Simple and Advanced Modes',
      simpleMode: {
        description: 'Single query search (backward compatible)',
        body: {
          query: 'string (required, min 3 chars)',
          pages: 'number (optional, default 1, max 5)',
        },
      },
      advancedMode: {
        description: 'Multi-keyword business discovery search',
        body: {
          keywords: 'string[] (required, 1-10 keywords)',
          patterns: 'string[] (optional, email domain patterns like @company.com)',
          location: 'string (optional, geographic context)',
          searchDepth: 'number (optional, default 1, pages per keyword, 1-5)',
          delayMs: 'number (optional, default 200, delay between keywords in ms)',
        },
      },
    },
    { status: 200 }
  );
}
