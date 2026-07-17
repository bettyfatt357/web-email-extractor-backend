/**
 * Search Service
 * 
 * Complete workflow for searching URLs and feeding them into the extraction queue
 */

import { googleSearch, extractUrlsFromResults } from './google-client';
import { enhanceQuery } from './query-enhancer';
import { filterUrls } from './url-filter';
import { generateQueries } from './query-generator';
import { normalizeUrl } from '../utils/url-normalizer';
import { EmailQueue } from '../queue/queue';
import { randomBytes } from 'crypto';

export interface SearchResult {
  query: string;
  enhancedQuery: string;
  searchId: string;
  totalUrlsFound: number;
  totalQueued: number;
  duplicatesRemoved: number;
  skipped: number;
  jobIds: string[];
}

export interface AdvancedSearchResult extends SearchResult {
  searchMode: 'advanced';
  keywordsProcessed: string[];
  jobsByKeyword?: {
    [keyword: string]: {
      jobCount: number;
      jobIds: string[];
    };
  };
}

export interface SearchResultPreview {
  keyword: string;
  resultsFound: number;
  topResults: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
}

/**
 * Generate unique search ID
 */
function generateSearchId(): string {
  return `search_${randomBytes(8).toString('hex')}`;
}

/**
 * Perform Google search and queue extraction jobs
 */
export async function performSearch(
  query: string,
  pages: number = 1
): Promise<SearchResult> {
  const searchId = generateSearchId();
  const startTime = Date.now();

  console.log(`[SEARCH] Starting search: "${query}" (${pages} pages)`);
  console.log(`[SEARCH] Search ID: ${searchId}`);

  try {
    // Step 1: Enhance query
    const enhancedQuery = enhanceQuery(query);
    if (enhancedQuery !== query) {
      console.log(`[SEARCH] Query enhanced: "${query}" → "${enhancedQuery}"`);
    }

    // Step 2: Call Google PSE
    console.log('[SEARCH] Calling Google Custom Search API...');
    const googleResults = await googleSearch(enhancedQuery, pages);
    console.log(`[SEARCH] Google returned ${googleResults.length} results`);

    // Step 3: Extract URLs from results
    const googleUrls = extractUrlsFromResults(googleResults);
    console.log(`[SEARCH] Extracted ${googleUrls.length} URLs`);

    // Step 4: Filter URLs
    console.log('[SEARCH] Filtering URLs...');
    const filteredUrls = filterUrls(googleUrls);
    console.log(
      `[SEARCH] After filtering: ${filteredUrls.length} valid URLs (skipped ${googleUrls.length - filteredUrls.length})`
    );

    // Step 5: Initialize queue
    const redisUrl = process.env.REDIS_URL || '';
    const queue = new EmailQueue(redisUrl);
    await queue.connect();

    // Step 6: Add jobs to queue
    const jobIds: string[] = [];
    const seenUrls = new Set<string>();
    let duplicateCount = 0;

    console.log('[SEARCH] Adding jobs to extraction queue...');

    for (const url of filteredUrls) {
      try {
        // Normalize URL
        const { normalized } = normalizeUrl(url);

        // Check for duplicates
        if (seenUrls.has(normalized)) {
          duplicateCount++;
          console.log(`[SEARCH] Duplicate (already in this batch): ${normalized}`);
          continue;
        }

        seenUrls.add(normalized);

        // Add to queue
        const jobId = await queue.addJob(url, 'google_pse', query);

        if (jobId) {
          jobIds.push(jobId);
          console.log(
            `[SEARCH] Job created: ${jobId} - ${url}`
          );
        } else {
          console.log(`[SEARCH] Queue full, could not add: ${url}`);
        }
      } catch (error) {
        console.error(
          `[SEARCH] Error adding job for ${url}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SEARCH] Complete in ${duration}ms`);
    console.log(`[SEARCH] Results: ${jobIds.length} jobs created`);

    return {
      query,
      enhancedQuery,
      searchId,
      totalUrlsFound: googleUrls.length,
      totalQueued: jobIds.length,
      duplicatesRemoved: duplicateCount,
      skipped: googleUrls.length - filteredUrls.length,
      jobIds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SEARCH] Error: ${message}`);
    throw error;
  }
}

/**
 * Validate search request
 */
export function validateSearchRequest(query: string, pages?: number): string | null {
  if (!query || typeof query !== 'string') {
    return 'Query is required';
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return 'Query must be at least 3 characters';
  }

  if (pages !== undefined) {
    if (typeof pages !== 'number' || pages < 1 || pages > 5) {
      return 'Pages must be between 1 and 5';
    }
  }

  return null;
}

/**
 * Validate advanced search request
 */
export function validateAdvancedSearchRequest(
  keywords?: string[],
  patterns?: string[],
  location?: string,
  searchDepth?: number,
  delayMs?: number
): string | null {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return 'Keywords are required for advanced search';
  }

  if (keywords.length > 10) {
    return 'Maximum 10 keywords per search';
  }

  if (keywords.some(k => typeof k !== 'string' || k.trim().length < 2)) {
    return 'Each keyword must be at least 2 characters';
  }

  if (patterns && !Array.isArray(patterns)) {
    return 'Patterns must be an array';
  }

  if (patterns && patterns.length > 10) {
    return 'Maximum 10 patterns per search';
  }

  if (location && typeof location !== 'string') {
    return 'Location must be a string';
  }

  if (searchDepth !== undefined) {
    if (typeof searchDepth !== 'number' || searchDepth < 1 || searchDepth > 5) {
      return 'Search depth must be between 1 and 5';
    }
  }

  if (delayMs !== undefined) {
    if (typeof delayMs !== 'number' || delayMs < 100 || delayMs > 2000) {
      return 'Delay must be between 100ms and 2000ms';
    }
  }

  return null;
}

/**
 * Perform advanced multi-keyword search and queue extraction jobs
 */
export async function performAdvancedSearch(
  keywords: string[],
  location: string | undefined,
  patterns: string[] | undefined,
  searchDepth: number = 1,
  delayMs: number = 200
): Promise<AdvancedSearchResult> {
  const searchId = generateSearchId();
  const startTime = Date.now();

  console.log(`[SEARCH] Starting advanced search: ${keywords.length} keywords (${searchDepth} pages each)`);
  console.log(`[SEARCH] Search ID: ${searchId}`);
  console.log(`[SEARCH] Keywords: ${keywords.join(', ')}`);
  if (location) console.log(`[SEARCH] Location: ${location}`);
  if (patterns?.length) console.log(`[SEARCH] Patterns: ${patterns.join(', ')}`);

  try {
    // Initialize queue
    const redisUrl = process.env.REDIS_URL || '';
    const queue = new EmailQueue(redisUrl);
    await queue.connect();

    const jobsByKeyword: { [keyword: string]: { jobCount: number; jobIds: string[] } } = {};
    const allJobIds: string[] = [];
    const seenUrls = new Set<string>();
    let totalDuplicates = 0;
    let totalSkipped = 0;
    let totalUrlsFound = 0;
    const searchPreviews: SearchResultPreview[] = [];

    // Process each keyword
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      console.log(`[SEARCH] Processing keyword ${i + 1}/${keywords.length}: "${keyword}"`);

      try {
        // Generate optimized queries for this keyword
        const queryGen = generateQueries({ keyword, location, patterns });
        console.log(`[SEARCH] Generated ${queryGen.queries.length} query variations`);

        // Execute all queries for this keyword
        const keywordUrls = new Set<string>();
        const keywordJobIds: string[] = [];

        for (let qIdx = 0; qIdx < queryGen.queries.length; qIdx++) {
          const queryToUse = queryGen.queries[qIdx];
          console.log(`[SEARCH] Executing query ${qIdx + 1}/${queryGen.queries.length}: "${queryToUse}"`);

          try {
            // Enhance and search
            const enhancedQuery = enhanceQuery(queryToUse);
            const googleResults = await googleSearch(enhancedQuery, searchDepth);
            console.log(`[SEARCH] Google returned ${googleResults.length} results for query`);
            totalUrlsFound += googleResults.length;

            // Extract and filter URLs
            const urlsFromQuery = extractUrlsFromResults(googleResults);
            const filteredUrls = filterUrls(urlsFromQuery);
            totalSkipped += urlsFromQuery.length - filteredUrls.length;
            console.log(`[SEARCH] Filtered to ${filteredUrls.length} valid URLs for this query`);

            // Add to keyword collection (deduplicate within keyword)
            for (const url of filteredUrls) {
              keywordUrls.add(url);
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[SEARCH] Error executing query: ${msg}`);
            // Continue with next query
          }

          // Delay between queries (but not after the last one)
          if (qIdx < queryGen.queries.length - 1) {
            console.log(`[SEARCH] Waiting ${delayMs}ms before next query...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }

        // Queue jobs for this keyword's URLs
        console.log(`[SEARCH] Queueing ${keywordUrls.size} unique URLs for keyword: "${keyword}"`);

        for (const url of keywordUrls) {
          try {
            const { normalized } = normalizeUrl(url);

            // Check for duplicates across all keywords
            if (seenUrls.has(normalized)) {
              totalDuplicates++;
              console.log(`[SEARCH] Duplicate across keywords: ${normalized}`);
              continue;
            }

            seenUrls.add(normalized);

            // Add to queue with keyword metadata
            const jobId = await queue.addJob(url, 'google_pse', keyword);

            if (jobId) {
              keywordJobIds.push(jobId);
              allJobIds.push(jobId);
              console.log(`[SEARCH] Job created: ${jobId} for keyword: "${keyword}"`);
            } else {
              console.log(`[SEARCH] Queue full, could not add: ${url}`);
            }
          } catch (error) {
            console.error(`[SEARCH] Error adding job: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        jobsByKeyword[keyword] = {
          jobCount: keywordJobIds.length,
          jobIds: keywordJobIds,
        };

        // Add preview for this keyword
        searchPreviews.push({
          keyword,
          resultsFound: keywordUrls.size,
          topResults: Array.from(keywordUrls)
            .slice(0, 5)
            .map((url, idx) => {
              // Try to extract title from URL if possible
              const urlObj = new URL(url);
              return {
                url,
                title: urlObj.hostname || 'Unknown',
                snippet: `Result ${idx + 1}`,
              };
            }),
        });

        // Delay before next keyword (but not after the last one)
        if (i < keywords.length - 1) {
          console.log(`[SEARCH] Waiting ${delayMs}ms before next keyword...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[SEARCH] Error processing keyword "${keyword}": ${msg}`);
        // Continue with next keyword
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SEARCH] Advanced search complete in ${duration}ms`);
    console.log(`[SEARCH] Results: ${allJobIds.length} jobs created across ${keywords.length} keywords`);

    const combinedQuery = `${keywords.join(' ')} ${location || ''}`.trim();

    return {
      query: combinedQuery,
      enhancedQuery: combinedQuery,
      searchId,
      searchMode: 'advanced',
      totalUrlsFound,
      totalQueued: allJobIds.length,
      duplicatesRemoved: totalDuplicates,
      skipped: totalSkipped,
      jobIds: allJobIds,
      keywordsProcessed: keywords,
      jobsByKeyword,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SEARCH] Advanced search error: ${message}`);
    throw error;
  }
}
