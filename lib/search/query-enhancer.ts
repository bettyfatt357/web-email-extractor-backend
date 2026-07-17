/**
 * Query Enhancement
 * 
 * Improves search queries to get better results
 * without compromising quality or specificity
 */

type SearchIntent = 'company' | 'finance' | 'contact' | 'people' | 'general';

/**
 * Analyze search intent from query
 */
function analyzeIntent(query: string): SearchIntent {
  const lowerQuery = query.toLowerCase();

  if (
    lowerQuery.includes('fund') ||
    lowerQuery.includes('investor') ||
    lowerQuery.includes('capital') ||
    lowerQuery.includes('hedge') ||
    lowerQuery.includes('venture') ||
    lowerQuery.includes('equity')
  ) {
    return 'finance';
  }

  if (
    lowerQuery.includes('founder') ||
    lowerQuery.includes('ceo') ||
    lowerQuery.includes('executive') ||
    lowerQuery.includes('founder') ||
    lowerQuery.includes('leader')
  ) {
    return 'people';
  }

  if (
    lowerQuery.includes('email') ||
    lowerQuery.includes('contact') ||
    lowerQuery.includes('phone') ||
    lowerQuery.includes('reach')
  ) {
    return 'contact';
  }

  if (
    lowerQuery.includes('company') ||
    lowerQuery.includes('agency') ||
    lowerQuery.includes('firm') ||
    lowerQuery.includes('studio') ||
    lowerQuery.includes('consulting') ||
    lowerQuery.includes('services')
  ) {
    return 'company';
  }

  return 'general';
}

/**
 * Enhance search query based on detected intent
 * 
 * Examples:
 * "hedge funds Manhattan" → "hedge funds Manhattan investment management firms"
 * "startup founders" → "startup founders contact email"
 */
export function enhanceQuery(originalQuery: string): string {
  // Validate input
  if (!originalQuery || originalQuery.trim().length < 2) {
    return originalQuery;
  }

  const query = originalQuery.trim();
  const intent = analyzeIntent(query);

  // Prevent double-enhancement
  if (
    query.includes('contact') &&
    query.includes('email') &&
    query.includes('website')
  ) {
    return query;
  }

  let enhanced = query;

  switch (intent) {
    case 'finance':
      // Add finance-specific keywords
      if (!query.match(/investment|management|firms?|companies?/i)) {
        enhanced = `${query} investment management firms`;
      }
      break;

    case 'people':
      // Add people-specific keywords
      if (!query.match(/contact|email|social|profile/i)) {
        enhanced = `${query} contact email`;
      }
      break;

    case 'contact':
      // Add contact-specific keywords
      if (!query.match(/website|company|official/i)) {
        enhanced = `${query} official website`;
      }
      break;

    case 'company':
      // Add company-specific keywords
      if (!query.match(/contact|email|website/i)) {
        enhanced = `${query} contact information`;
      }
      break;

    case 'general':
    default:
      // Light enhancement for general queries
      if (query.length < 30 && !query.match(/\b(site|filetype|intitle)\b/)) {
        // Add minimal context
        if (query.match(/^[a-z]+ [a-z]+$/i)) {
          // Two-word query - add location or category context
          enhanced = `${query} official`;
        }
      }
      break;
  }

  return enhanced;
}

/**
 * Check if enhancement improved the query
 */
export function isEnhancementUseful(
  original: string,
  enhanced: string
): boolean {
  // Enhancement is useful if it's meaningfully longer and doesn't duplicate
  const diff = enhanced.length - original.length;
  const hasDuplication = enhanced.includes(original) &&
    enhanced.replace(original, '').trim().split(' ').length <= 3;

  return diff > 5 && diff < 50 && hasDuplication;
}
