export function deobfuscateEmails(text: string): string[] {
  const emails = new Set<string>();

  // 1. Direct email regex
  const emailRegex =
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const directMatches = text.match(emailRegex) || [];
  directMatches.forEach((email) => emails.add(email.toLowerCase()));

  // 2. Replace [at] or (at) with @
  let deobfuscated = text
    .replace(/\[at\]/gi, '@')
    .replace(/\(at\)/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/DOT/gi, '.')
    .replace(/\[dot\]/gi, '.')
    .replace(/\(dot\)/gi, '.');

  const modifiedMatches = deobfuscated.match(emailRegex) || [];
  modifiedMatches.forEach((email) =>
    emails.add(email.toLowerCase())
  );

  // 3. HTML entity decoding
  const htmlDecoded = decodeHTMLEntities(text);
  const entityMatches = htmlDecoded.match(emailRegex) || [];
  entityMatches.forEach((email) => emails.add(email.toLowerCase()));

  // 4. Base64 encoded emails
  const base64Matches = text.match(/[A-Za-z0-9+/]+={0,2}/g) || [];
  for (const match of base64Matches) {
    if (match.length >= 20) {
      try {
        const decoded = Buffer.from(match, 'base64').toString('utf-8');
        const b64Emails = decoded.match(emailRegex) || [];
        b64Emails.forEach((email) => emails.add(email.toLowerCase()));
      } catch {
        // Not valid base64, skip
      }
    }
  }

  // 5. mailto links
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/gi;
  let match;
  while ((match = mailtoRegex.exec(text)) !== null) {
    emails.add(match[1].toLowerCase());
  }

  // 6. Reverse strings (uncommon but possible)
  const reversed = text.split('').reverse().join('');
  const reversedMatches = reversed.match(emailRegex) || [];
  reversedMatches.forEach((email) => {
    const corrected = email.split('').reverse().join('');
    emails.add(corrected.toLowerCase());
  });

  // 7. ROT13 encoding
  const rot13Text = rot13(text);
  const rot13Matches = rot13Text.match(emailRegex) || [];
  rot13Matches.forEach((email) => emails.add(email.toLowerCase()));

  // 8. URL encoded emails
  try {
    const decoded = decodeURIComponent(text);
    const urlMatches = decoded.match(emailRegex) || [];
    urlMatches.forEach((email) => emails.add(email.toLowerCase()));
  } catch {
    // Not valid URL encoding
  }

  // 9. Hidden in structured data (JSON)
  const jsonRegex = /"(?:email|mail|contact)":\s*"([^"]+)"/gi;
  while ((match = jsonRegex.exec(text)) !== null) {
    if (match[1].match(emailRegex)) {
      const jsonEmails = match[1].match(emailRegex) || [];
      jsonEmails.forEach((email) => emails.add(email.toLowerCase()));
    }
  }

  return Array.from(emails);
}

function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#64;': '@',
    '&#46;': '.',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });

  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  return decoded;
}

function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + 13) % 26) + 65);
    }
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + 13) % 26) + 97);
    }
    return char;
  });
}

export function normalizeAndDeduplicateEmails(
  emails: string[]
): string[] {
  const normalized = new Set<string>();

  for (const email of emails) {
    // Validate format
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      normalized.add(email.toLowerCase().trim());
    }
  }

  return Array.from(normalized).sort();
}
