/**
 * Query Generator
 * 
 * Generates optimized search queries for multi-keyword business discovery
 * Combines keywords, location, and patterns to create effective search variations
 */

interface QueryGeneratorOptions {
  keyword: string;
  location?: string;
  patterns?: string[];
}

interface GeneratedQueries {
  keyword: string;
  queries: string[];
  location?: string;
}

/**
 * Generate search queries for a single keyword
 * Creates 3-4 query variations to maximize result coverage
 */
export function generateQueries(options: QueryGeneratorOptions): GeneratedQueries {
  const { keyword, location, patterns = [] } = options;

  const queries: string[] = [];

  // Query 1: Keyword + location (base query)
  let baseQuery = keyword;
  if (location) {
    baseQuery += ` ${location}`;
  }
  queries.push(baseQuery);

  // Query 2: Add contact intent
  let contactQuery = baseQuery + ' contact email';
  if (patterns.length > 0) {
    // Add site: command for first pattern
    const domainPattern = patterns[0].startsWith('@') ? patterns[0].substring(1) : patterns[0];
    contactQuery += ` site:${domainPattern}`;
  }
  queries.push(contactQuery);

  // Query 3: Add "company" context (common for B2B discovery)
  queries.push(baseQuery + ' company');

  // Query 4: Add "information" context
  queries.push(baseQuery + ' information');

  // De-duplicate and filter empty queries
  const uniqueQueries = Array.from(new Set(queries))
    .filter(q => q.trim().length > 0)
    .slice(0, 4); // Cap at 4 variations

  return {
    keyword,
    queries: uniqueQueries,
    location,
  };
}

/**
 * Generate queries for multiple keywords
 */
export function generateQueriesForKeywords(
  keywords: string[],
  location?: string,
  patterns?: string[]
): GeneratedQueries[] {
  return keywords.map(keyword =>
    generateQueries({ keyword, location, patterns })
  );
}
