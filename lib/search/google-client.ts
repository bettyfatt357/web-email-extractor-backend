/**
 * Google Custom Search API Client
 * 
 * Handles pagination, retries with exponential backoff, and error handling
 */

import { googleConfig } from '../config/google';

interface GoogleSearchResult {
  link: string;
  title: string;
  snippet: string;
}

interface GoogleAPIResponse {
  queries?: {
    request?: Array<{
      startIndex?: number;
    }>;
  };
  items?: Array<{
    link: string;
    title: string;
    snippet: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Google Custom Search API with retry logic
 */
async function callGoogleAPI(
  query: string,
  startIndex: number,
  maxRetries: number = 3
): Promise<GoogleSearchResult[]> {
  const config = googleConfig.validate();
  const baseUrl = 'https://www.googleapis.com/customsearch/v1';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('cx', config.cx);
      url.searchParams.append('key', config.apiKey);
      url.searchParams.append('start', startIndex.toString());

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EmailExtractor/1.0)',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit - wait longer
          console.log('[GOOGLE] Rate limited, waiting...');
          await sleep(5000);
          continue;
        }

        if (response.status === 403) {
          throw new Error('Google API quota exceeded or access denied');
        }

        throw new Error(`Google API error: ${response.status}`);
      }

      const data = (await response.json()) as GoogleAPIResponse;

      // Check for API errors in response
      if (data.error) {
        if (data.error.code === 403) {
          throw new Error('Google API quota exceeded');
        }
        throw new Error(`Google API error: ${data.error.message}`);
      }

      // Extract results
      const results: GoogleSearchResult[] = [];
      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          if (item.link && item.title) {
            results.push({
              link: item.link,
              title: item.title,
              snippet: item.snippet || '',
            });
          }
        }
      }

      return results;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      // Don't retry on quota errors
      if (message.includes('quota')) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(
          `[GOOGLE] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms: ${message}`
        );
        await sleep(backoffMs);
      } else {
        throw error;
      }
    }
  }

  return [];
}

/**
 * Fetch search results from Google Custom Search
 */
export async function googleSearch(
  query: string,
  pages: number = 1
): Promise<GoogleSearchResult[]> {
  // Validate configuration
  googleConfig.validate(); // This will throw if config is missing

  // Limit pages
  const maxPages = Math.min(pages, 5);
  const allResults: GoogleSearchResult[] = [];

  // Fetch each page
  for (let page = 0; page < maxPages; page++) {
    const startIndex = page * 10 + 1; // Google API uses 1-based indexing

    try {
      console.log(
        `[GOOGLE] Fetching page ${page + 1}/${maxPages} (start=${startIndex})`
      );

      const results = await callGoogleAPI(query, startIndex);

      if (results.length === 0) {
        // No more results
        break;
      }

      allResults.push(...results);

      // Delay between requests (200-500ms)
      if (page < maxPages - 1) {
        await sleep(Math.random() * 300 + 200);
      }
    } catch (error) {
      console.error(
        `[GOOGLE] Error fetching page ${page + 1}: ${error instanceof Error ? error.message : String(error)}`
      );

      // Stop on error
      break;
    }
  }

  console.log(`[GOOGLE] Found ${allResults.length} total results`);
  return allResults;
}

/**
 * Extract URLs from Google search results
 */
export function extractUrlsFromResults(
  results: GoogleSearchResult[]
): string[] {
  return results.map(r => r.link);
}
