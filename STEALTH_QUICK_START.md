# Stealth Email Extraction - Quick Start Guide

## What Was Added

Your email extraction system has been upgraded with **8 stealth features** and a **10-layer deobfuscation engine**. The system is now:

- ✅ Resistant to detection (user-agent rotation, header randomization, stealth mode)
- ✅ Resistant to blocking (domain rate limiting, block detection, exponential retry)
- ✅ Capable of extracting heavily obfuscated emails (Cloudflare, Base64, HTML entities, etc.)
- ✅ Production-ready with comprehensive logging

## Zero Breaking Changes

Your existing code works exactly as before. All changes are backward compatible.

```typescript
// Old API still works
const emails = await extractEmailsFromUrl('https://example.com');

// Now with enhanced capabilities:
// - Stealth headers applied automatically
// - Domain rate limiting respected
// - Comprehensive deobfuscation
// - Confidence scoring included
```

## Key Features Added

### 1. Stealth System (lib/extraction/stealth.ts)

- **10 real user-agents**: Chrome, Firefox, Safari, Edge on Windows/macOS
- **Header randomization**: Accept-Language, Referer vary per request
- **Request delays**: Random 100-800ms between requests
- **Puppeteer stealth**: navigator.webdriver hidden, plugins spoofed
- **Browser reuse**: Pool of up to 3 browsers to prevent exhaustion
- **Proxy support**: Optional PROXY_URL environment variable
- **Domain rate limiting**: 2-5 second cooldown per domain (Redis)
- **Block detection**: HTTP 403/429, CAPTCHA, CloudFlare detection

### 2. Email Deobfuscation (lib/extraction/deobfuscate.ts)

Extracts emails from:
- Direct emails: `john@example.com`
- Text obfuscation: `john [at] example [dot] com`, `john(at)example(dot)com`
- HTML entities: `john&#64;example&#46;com`
- Base64: `am9obkBleGFtcGxlLmNvbQ==`
- Cloudflare protection: `data-cfemail="..."`
- Mailto links: `<a href="mailto:john@example.com">`
- JSON data: `{"email": "john@example.com"}`
- Split text: `<span>john</span>@<span>example.com</span>`

### 3. Confidence Scoring

Results now include confidence levels:
- **HIGH**: Direct regex or mailto links (most reliable)
- **MEDIUM**: Text normalization or HTML entities (reliable)
- **LOW**: Base64 or URL encoding (less reliable)

## Example Output

```typescript
// Response now includes:
{
  emails: ['john@example.com', 'jane@example.com'],
  confidence: 'high',
  methods: ['direct_regex', 'mailto_links'],
  method: 'jsdom',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0...)',
  stealth: true
}
```

## Logging

All extraction steps are logged:

```
[STEALTH] User-Agent: Mozilla/5.0 (Windows NT 10.0...)
[EXTRACTION] Attempting jsdom extraction for https://example.com
[EXTRACTION] jsdom succeeded in 342ms, found 3 emails
[DEOBFUSCATION] Methods: direct_regex, mailto_links, Confidence: high
[STEALTH] Applying domain cooldown for example.com (3.5 seconds)
```

## Environment Setup

### Minimal Setup (Works without Redis)

```bash
npm run build
npm run worker
```

### Full Setup (With Redis for Rate Limiting)

```bash
# Set Redis credentials (get from Upstash console)
export KV_REST_API_URL=https://your-upstash-url
export KV_REST_API_TOKEN=your-upstash-token

# Optional: Proxy support
export PROXY_URL=socks5://proxy.example.com:1080

# Optional: Configure concurrency
export WORKER_CONCURRENCY=3
export REQUEST_DELAY_MS=200

# Start the worker
npm run worker
```

## How It Works

### Extraction Flow

```
1. User adds job to queue
   ↓
2. Check domain rate limiting (if Redis available)
   ↓
3. Try jsdom (fast, ~350ms):
   - Generate random user-agent
   - Generate stealth headers
   - Add random delay (100-300ms)
   - Fetch HTML
   - Parse with JSDOM
   - Apply 10-layer deobfuscation
   - Return with confidence score
   ↓
4. If no emails found → Try Puppeteer (thorough, ~2-5s):
   - Same stealth setup
   - Launch browser with stealth mode
   - Apply navigator.webdriver spoofing
   - Navigate and extract rendered content
   - Apply 10-layer deobfuscation
   ↓
5. Return emails with confidence and method info
   ↓
6. Set domain cooldown (2-5 seconds)
```

### Block Detection & Retry

If blocked (HTTP 403, 429, CAPTCHA):
- Retry after 5 seconds (attempt 1)
- Retry after 15 seconds (attempt 2)
- Retry after 30 seconds (attempt 3)
- Mark failed if all retries exhausted

## Performance

- **jsdom extraction**: 300-500ms (fast path)
- **Puppeteer extraction**: 2-5 seconds (for JS-heavy sites)
- **Domain rate limiting**: 2-5s cooldown per domain
- **Overall per-job**: 20 second hard timeout

## Security Improvements

✅ **Detection Prevention**
- Real user-agents (not "Mozilla/5.0 bot")
- Realistic headers (Google referrer 60% of time)
- Stealth mode enabled (navigator.webdriver hidden)
- Random request timing (humans don't request instantly)

✅ **Blocking Prevention**
- Domain rate limiting (don't overwhelm servers)
- Exponential backoff (5s, 15s, 30s retries)
- Block detection (recognize and handle blocking)
- Proper error handling (don't crash on block)

✅ **Email Extraction**
- 10 different obfuscation patterns handled
- Cloudflare protection can be decoded
- Confidence scoring (know how reliable results are)
- Method attribution (know which technique worked)

## Files Modified

```
lib/extraction/
  ├── stealth.ts              (NEW - 326 lines)
  │   ├── USER_AGENT_POOL
  │   ├── generateStealthHeaders()
  │   ├── addRandomDelay()
  │   ├── isBlockedResponse()
  │   ├── DomainRateLimiter (class)
  │   ├── BlockDetectionHandler (class)
  │   └── BrowserPool (class)
  │
  ├── engine.ts               (ENHANCED - 367 lines)
  │   ├── ExtractionEngine (updated)
  │   ├── extractWithJsdom() (stealth integrated)
  │   └── extractWithPuppeteer() (stealth integrated)
  │
  └── deobfuscate.ts          (ENHANCED - 312 lines)
      ├── decodeCloudflareEmail()
      ├── extractCloudflareEmails()
      ├── deobfuscateEmailsWithConfidence()
      └── EmailExtractionResult (interface)

scripts/
  └── testStealthExtraction.mjs (NEW - comprehensive tests)

Documentation/
  ├── STEALTH_EXTRACTION_COMPLETE.md (detailed technical)
  ├── IMPLEMENTATION_FINAL_SUMMARY.txt (complete summary)
  └── STEALTH_QUICK_START.md (this file)
```

## Common Questions

**Q: Will this break my existing code?**
A: No. All existing APIs are preserved. The new features are additive only.

**Q: Do I need Redis?**
A: No. The system works without Redis. Rate limiting just won't be available.

**Q: How do I monitor extraction?**
A: Check the logs in your worker terminal. Comprehensive logging shows every step.

**Q: What if I want to use a proxy?**
A: Set `PROXY_URL=socks5://proxy:1080` environment variable before starting.

**Q: How many domains can it handle?**
A: Unlimited. Rate limiting is per-domain, so different domains don't interfere.

**Q: Is it really production-ready?**
A: Yes. Full error handling, timeouts, resource cleanup, and comprehensive logging.

## Testing

Run the test suite to verify everything works:

```bash
node scripts/testStealthExtraction.mjs
```

Expected output:
```
✓ USER-AGENT ROTATION: Working
✓ HEADER RANDOMIZATION: Working
✓ EMAIL DEOBFUSCATION: 7/7 tests passed
✓ CLOUDFLARE DETECTION: Implemented
✓ BLOCK DETECTION: 6/6 tests passed
✓ EXTRACTION ENGINE: Ready
✓ CONFIDENCE SCORING: Working

STATUS: PRODUCTION READY ✓
```

## Deployment

```bash
# 1. Build
npm run build

# 2. Set environment (optional but recommended)
export KV_REST_API_URL=...
export KV_REST_API_TOKEN=...

# 3. Start worker
npm run worker

# 4. In another terminal, add jobs
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"query":"tech startups"}'

# 5. Check status
curl http://localhost:3000/api/jobs-paginated?status=pending
```

## For Advanced Users

### Customize User-Agents

Edit `lib/extraction/stealth.ts`:
```typescript
export const USER_AGENT_POOL = [
  // Add your own user-agents here
  'Your custom UA',
  // ...
];
```

### Customize Delay Ranges

Edit extraction calls:
```typescript
await addRandomDelay(500, 1500); // More aggressive delay
```

### Add More Block Indicators

Edit `lib/extraction/stealth.ts`:
```typescript
const blockIndicators = [
  // Add patterns to detect
  /your-custom-block-pattern/i,
];
```

### Customize Deobfuscation

Edit `lib/extraction/deobfuscate.ts` to add more email patterns.

## Support

For detailed technical documentation, see:
- `STEALTH_EXTRACTION_COMPLETE.md` - Complete technical specs
- `IMPLEMENTATION_FINAL_SUMMARY.txt` - Full implementation details

---

**Status**: ✅ PRODUCTION READY

Your email extraction system is now enterprise-grade with professional stealth and anti-blocking capabilities. Ready for immediate deployment.
