/**
 * URL Filtering and Validation
 * 
 * Validates and filters URLs from search results
 * Removes spam, social media, and invalid URLs
 */

// Domains to always skip
const SKIP_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'linkedin.com',
  'linkedin.com/company',
  'linkedin.com/feed',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com',
  'pinterest.com',
  'quora.com',
  'medium.com',
  'dev.to',
  'stackoverflow.com',
  'github.com',
  'gitlab.com',
  'bitbucket.com',
  'pages.github.io',
  'blogspot.com',
  'wordpress.com',
  'wix.com',
  'squarespace.com',
  'weebly.com',
  'google.com',
  'google.co.uk',
  'bing.com',
  'duckduckgo.com',
]);

// File extensions to skip
const SKIP_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.mp4',
  '.mp3',
  '.avi',
  '.mov',
]);

/**
 * Check if URL is valid
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http and https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Check for file extensions
    const path = url.pathname.toLowerCase();
    for (const ext of SKIP_EXTENSIONS) {
      if (path.endsWith(ext)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if domain should be skipped
 */
function shouldSkipDomain(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();

  // Direct match
  if (SKIP_DOMAINS.has(lowerDomain)) {
    return true;
  }

  // Subdomain match (e.g., company.linkedin.com)
  for (const skipDomain of SKIP_DOMAINS) {
    if (lowerDomain.endsWith(`.${skipDomain}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter URLs from search results
 * 
 * Returns only valid URLs to domains we should extract from
 */
export function filterUrls(urls: string[]): string[] {
  const filtered: string[] = [];
  const seenDomains = new Set<string>();

  for (const url of urls) {
    // Validate URL format
    if (!isValidUrl(url)) {
      continue;
    }

    // Extract domain
    const domain = extractDomain(url);
    if (!domain) {
      continue;
    }

    // Skip if domain is in skip list
    if (shouldSkipDomain(domain)) {
      continue;
    }

    // Skip if we already have this domain to reduce duplicates
    if (seenDomains.has(domain)) {
      continue;
    }

    filtered.push(url);
    seenDomains.add(domain);
  }

  return filtered;
}

/**
 * Get reasons why URL was filtered
 */
export function getFilterReason(urlString: string): string | null {
  if (!isValidUrl(urlString)) {
    try {
      const url = new URL(urlString);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'Invalid protocol';
      }

      const path = url.pathname.toLowerCase();
      for (const ext of SKIP_EXTENSIONS) {
        if (path.endsWith(ext)) {
          return `File type not supported: ${ext}`;
        }
      }
    } catch {
      return 'Invalid URL format';
    }
  }

  const domain = extractDomain(urlString);
  if (domain && shouldSkipDomain(domain)) {
    return `Domain filtered: ${domain}`;
  }

  return null;
}
