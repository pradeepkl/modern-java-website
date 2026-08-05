/**
 * Consumer-mailbox allowlist for chapter-preview delivery.
 * Blocks disposable / unknown domains from collecting the sample PDF.
 */

const SAMPLE_EMAIL_ALLOWLIST_MESSAGE =
  'Chapter previews are only sent to Gmail, Outlook, Hotmail, Live, Yahoo, iCloud, or Rediff addresses. Please use one of those and try again.';

/** Exact domains (lowercase) accepted for sample-chapter requests. */
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

function emailDomain(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1) return '';
  return normalized.slice(at + 1);
}

function isAllowedSampleEmailDomain(email) {
  const domain = emailDomain(email);
  return Boolean(domain) && SAMPLE_EMAIL_ALLOWED_DOMAINS.has(domain);
}

module.exports = {
  SAMPLE_EMAIL_ALLOWLIST_MESSAGE,
  SAMPLE_EMAIL_ALLOWED_DOMAINS,
  emailDomain,
  isAllowedSampleEmailDomain,
};
