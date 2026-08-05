/**
 * Consumer-mailbox allowlist for chapter-preview delivery.
 * Keep in sync with backend/src/sampleEmailAllowlist.js.
 */

export const SAMPLE_EMAIL_ALLOWLIST_MESSAGE =
  'Chapter previews are only sent to Gmail, Outlook, Hotmail, Live, Yahoo, iCloud, or Rediff addresses. Please use one of those and try again.';

const SAMPLE_EMAIL_ALLOWED_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',
  // Microsoft
  'outlook.com',
  'outlook.in',
  'hotmail.com',
  'hotmail.co.in',
  'hotmail.co.uk',
  'live.com',
  'live.in',
  'msn.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'ymail.com',
  'rocketmail.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Rediff
  'rediffmail.com',
  'rediff.com',
]);

export function emailDomain(email: string): string {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1) return '';
  return normalized.slice(at + 1);
}

export function isAllowedSampleEmailDomain(email: string): boolean {
  const domain = emailDomain(email);
  return Boolean(domain) && SAMPLE_EMAIL_ALLOWED_DOMAINS.has(domain);
}
