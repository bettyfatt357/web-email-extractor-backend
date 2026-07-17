import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as puppeteer from 'puppeteer';
import {
  deobfuscateEmails,
  normalizeAndDeduplicateEmails,
} from './deobfuscate';

interface ExtractionResult {
  emails: string[];
  html?: string;
  method: 'jsdom' | 'puppeteer';
}

export class ExtractionEngine {
  private jsdomTimeout = 10000; // 10 seconds
  private puppeteerLaunchTimeout = 10000; // 10 seconds
  private puppeteerGotoTimeout = 15000; // 15 seconds
  private jobTimeout = 20000; // 20 seconds
  
  // Production protections
  private maxHtmlSize = 10 * 1024 * 1024; // 10 MB max HTML
  private maxRedirects = 5; // Max redirects
  private maxConcurrentBrowsers = 3; // Max concurrent browsers
  private activeBrowsers = 0; // Current browser count

  async extractEmails(url: string): Promise<string[]> {
    const startTime = Date.now();

    try {
      // Try fast jsdom extraction first
      console.log(`[EXTRACTION] Attempting jsdom extraction for ${url}`);
      try {
        const result = await Promise.race([
          this.extractWithJsdom(url),
          this.timeout(this.jsdomTimeout),
        ]);

        if (result) {
          const elapsed = Date.now() - startTime;
          console.log(
            `[EXTRACTION] jsdom succeeded in ${elapsed}ms, found ${result.emails.length} emails`
          );
          return result.emails;
        }
      } catch (error) {
        console.log(
          `[EXTRACTION] jsdom failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // Fallback to Puppeteer for JavaScript-heavy sites
      console.log(
        `[EXTRACTION] Falling back to Puppeteer for ${url}`
      );

      const remainingTime = this.jobTimeout - (Date.now() - startTime);
      if (remainingTime < 3000) {
        throw new Error('Insufficient time remaining for Puppeteer');
      }

      const result = await Promise.race([
        this.extractWithPuppeteer(url),
        this.timeout(remainingTime),
      ]);

      const elapsed = Date.now() - startTime;
      console.log(
        `[EXTRACTION] Puppeteer succeeded in ${elapsed}ms, found ${result.emails.length} emails`
      );
      return result.emails;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      throw new Error(
        `Extraction failed after ${elapsed}ms: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async extractWithJsdom(url: string): Promise<ExtractionResult> {
    const response = await axios.get(url, {
      timeout: 8000,
      maxRedirects: this.maxRedirects,
      maxContentLength: this.maxHtmlSize,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // Check HTML size
    if (response.data.length > this.maxHtmlSize) {
      throw new Error(
        `HTML too large: ${response.data.length} bytes (max ${this.maxHtmlSize})`
      );
    }

    const dom = new JSDOM(response.data, { url });
    const html = dom.window.document.documentElement.outerHTML;

    // Extract text content and HTML
    const fullText = html + '\n' + dom.window.document.body.innerText;

    // Deobfuscate emails
    const emails = deobfuscateEmails(fullText);
    const normalized = normalizeAndDeduplicateEmails(emails);

    return {
      emails: normalized,
      html,
      method: 'jsdom',
    };
  }

  private async extractWithPuppeteer(
    url: string
  ): Promise<ExtractionResult> {
    // Wait for available browser slot
    while (this.activeBrowsers >= this.maxConcurrentBrowsers) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.activeBrowsers++;
    let browser;
    try {
      // Launch browser with timeout
      browser = await Promise.race([
        puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }),
        this.timeout(this.puppeteerLaunchTimeout),
      ]);

      if (!browser) {
        throw new Error('Browser launch timeout');
      }

      const page = await browser.newPage();

      // Set resource limits
      await page.setDefaultNavigationTimeout(this.puppeteerGotoTimeout);
      await page.setDefaultTimeout(this.puppeteerGotoTimeout);

      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      // Navigate with timeout and redirect limits
      try {
        await Promise.race([
          page.goto(url, { 
            waitUntil: 'networkidle2',
            referer: 'https://www.google.com/',
          }),
          this.timeout(this.puppeteerGotoTimeout),
        ]);
      } catch (error) {
        console.log(
          `[EXTRACTION] Page goto timeout/error, continuing anyway`
        );
        // Continue even if goto fails - page might have partial content
      }

      // Extract page content with size limits
      const html = await page.content();
      if (html.length > this.maxHtmlSize) {
        throw new Error(
          `HTML too large: ${html.length} bytes (max ${this.maxHtmlSize})`
        );
      }

      const text = await page.evaluate(() => document.body.innerText);

      // Deobfuscate emails
      const fullText = html + '\n' + text;
      const emails = deobfuscateEmails(fullText);
      const normalized = normalizeAndDeduplicateEmails(emails);

      await page.close();

      return {
        emails: normalized,
        html,
        method: 'puppeteer',
      };
    } finally {
      // Always close browser
      if (browser) {
        try {
          await browser.close();
        } catch (error) {
          console.log(
            `[EXTRACTION] Error closing browser: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      this.activeBrowsers--;
    }
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    );
  }
}

export async function extractEmailsFromUrl(url: string): Promise<string[]> {
  const engine = new ExtractionEngine();
  return engine.extractEmails(url);
}
