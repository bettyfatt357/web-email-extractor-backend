/**
 * Google API Configuration
 * 
 * Validates and exposes Google Custom Search API credentials
 */

interface GoogleConfig {
  apiKey: string;
  cx: string;
  maxPages: number;
  maxUrlsPerRequest: number;
  requestTimeout: number;
  retryAttempts: number;
}

class GoogleConfigManager {
  private config: GoogleConfig | null = null;
  private validated = false;

  /**
   * Load and validate Google API configuration
   */
  validate(): GoogleConfig {
    if (this.validated && this.config) {
      return this.config;
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    const cx = process.env.GOOGLE_CX;

    if (!apiKey || !cx) {
      const missing = [];
      if (!apiKey) missing.push('GOOGLE_API_KEY');
      if (!cx) missing.push('GOOGLE_CX');
      
      throw new Error(
        `Google Search API configuration missing: ${missing.join(', ')}`
      );
    }

    this.config = {
      apiKey,
      cx,
      maxPages: 5,
      maxUrlsPerRequest: 50,
      requestTimeout: 10000,
      retryAttempts: 3,
    };
    this.validated = true;

    return this.config;
  }

  /**
   * Check if configuration is available
   */
  isConfigured(): boolean {
    try {
      this.validate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get config or return error
   */
  getConfig(): GoogleConfig | null {
    try {
      return this.validate();
    } catch {
      return null;
    }
  }
}

export const googleConfig = new GoogleConfigManager();
