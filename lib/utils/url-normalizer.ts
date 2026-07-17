import { URLNormalizationOptions } from '../queue/types';

/**
 * Normalize URLs to prevent duplicates and enable deduplication
 * 
 * Examples:
 * - https://example.com → https://example.com
 * - https://example.com/ → https://example.com
 * - https://example.com/?utm_source=test → https://example.com
 * - HTTP://Example.COM → https://example.com
 */
export function normalizeUrl(
  url: string,
  options: URLNormalizationOptions = {}
): { normalized: string; domain: string } {
  const {
    removeTrailingSlash = true,
    lowercaseDomain = true,
    removeUtmParams = true,
    normalizeProtocol = true,
  } = options;

  try {
    const parsed = new URL(url);
    
    // Normalize protocol
    if (normalizeProtocol) {
      parsed.protocol = 'https:';
    }
    
    // Lowercase domain
    if (lowercaseDomain) {
      parsed.hostname = parsed.hostname.toLowerCase();
    }
    
    // Remove UTM and tracking parameters
    if (removeUtmParams) {
      const trackingParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'fbclid',
        'gclid',
        'msclkid',
      ];
      
      trackingParams.forEach((param) => {
        parsed.searchParams.delete(param);
      });
    }
    
    // Build normalized URL
    let normalized = parsed.toString();
    
    // Remove trailing slash (but keep root)
    if (removeTrailingSlash && normalized.endsWith('/') && parsed.pathname === '/') {
      normalized = normalized.slice(0, -1);
    }
    
    // Remove trailing hash if empty
    if (normalized.endsWith('#')) {
      normalized = normalized.slice(0, -1);
    }
    
    // Extract domain for grouping
    const domain = parsed.hostname;
    
    return {
      normalized: normalized.toLowerCase(),
      domain: domain.toLowerCase(),
    };
  } catch (error) {
    // If URL parsing fails, return original with extracted domain attempt
    return {
      normalized: url.toLowerCase(),
      domain: extractDomain(url),
    };
  }
}

/**
 * Extract domain from URL string (fallback for invalid URLs)
 */
function extractDomain(urlString: string): string {
  try {
    const match = urlString.match(/^(?:https?:\/\/)?(?:www\.)?([^/?#]+)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check if two URLs are equivalent after normalization
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  const norm1 = normalizeUrl(url1);
  const norm2 = normalizeUrl(url2);
  return norm1.normalized === norm2.normalized;
}
