/**
 * Opaque HMAC tokens for RFC 8058 one-click unsubscribe URLs.
 * Tokens encode the subscriber email; GET must never mutate preference.
 */
const { createHmac, timingSafeEqual } = require('node:crypto');

const TOKEN_VERSION = 'v1';

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function requireSecret(secret) {
  const value = String(secret || '').trim();
  if (!value) {
    throw new Error('UNSUBSCRIBE_TOKEN_SECRET is not configured');
  }
  return value;
}

function signPayload(secret, payload) {
  return createHmac('sha256', requireSecret(secret))
    .update(payload)
    .digest();
}

/**
 * @param {string} email
 * @param {{ secret: string, issuedAtMs?: number }} options
 * @returns {string}
 */
function createUnsubscribeToken(email, { secret, issuedAtMs = Date.now() } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('email is required');
  }
  const payload = JSON.stringify({
    v: TOKEN_VERSION,
    e: normalized,
    iat: Number(issuedAtMs) || Date.now(),
  });
  const payloadPart = base64UrlEncode(payload);
  const sigPart = base64UrlEncode(signPayload(secret, payloadPart));
  return `${payloadPart}.${sigPart}`;
}

/**
 * @param {string} token
 * @param {{ secret: string }} options
 * @returns {{ email: string, issuedAtMs: number } | null}
 */
function verifyUnsubscribeToken(token, { secret } = {}) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2) return null;

  const [payloadPart, sigPart] = parts;
  let expected;
  let provided;
  try {
    expected = signPayload(secret, payloadPart);
    provided = base64UrlDecode(sigPart);
  } catch {
    return null;
  }

  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  let parsed;
  try {
    parsed = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
  } catch {
    return null;
  }

  if (parsed?.v !== TOKEN_VERSION) return null;
  const email = normalizeEmail(parsed.e);
  if (!email) return null;
  const issuedAtMs = Number(parsed.iat);
  if (!Number.isFinite(issuedAtMs)) return null;

  return { email, issuedAtMs };
}

/**
 * @param {{ publicApiUrl: string, token: string }} options
 */
function buildOneClickUnsubscribeUrl({ publicApiUrl, token }) {
  const base = String(publicApiUrl || '')
    .trim()
    .replace(/\/$/, '');
  if (!base) {
    throw new Error('PUBLIC_API_URL is not configured');
  }
  return `${base}/marketing-consents/one-click/${encodeURIComponent(token)}`;
}

module.exports = {
  TOKEN_VERSION,
  normalizeEmail,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  buildOneClickUnsubscribeUrl,
};
