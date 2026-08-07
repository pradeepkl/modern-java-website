/**
 * Signed opaque tokens for email CTA click attribution.
 * Encode email + sequence id; never put raw email in outbound URLs.
 * Reuses the same secret family as unsubscribe tokens.
 */
const { createHmac, timingSafeEqual } = require('node:crypto');

const TOKEN_VERSION = 'v1';
const CLICK_QUERY_PARAM = 'mj_click';

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

function normalizeSequence(sequence) {
  return String(sequence || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
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
 * @param {{ secret: string, sequence: string, issuedAtMs?: number }} options
 */
function createEmailClickToken(
  email,
  { secret, sequence, issuedAtMs = Date.now() } = {},
) {
  const normalized = normalizeEmail(email);
  const seq = normalizeSequence(sequence);
  if (!normalized) throw new Error('email is required');
  if (!seq) throw new Error('sequence is required');

  const payload = JSON.stringify({
    v: TOKEN_VERSION,
    t: 'click',
    e: normalized,
    s: seq,
    iat: Number(issuedAtMs) || Date.now(),
  });
  const payloadPart = base64UrlEncode(payload);
  const sigPart = base64UrlEncode(signPayload(secret, payloadPart));
  return `${payloadPart}.${sigPart}`;
}

/**
 * @param {string} token
 * @param {{ secret: string }} options
 * @returns {{ email: string, sequence: string, issuedAtMs: number } | null}
 */
function verifyEmailClickToken(token, { secret } = {}) {
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

  if (parsed?.v !== TOKEN_VERSION || parsed?.t !== 'click') return null;
  const email = normalizeEmail(parsed.e);
  const sequence = normalizeSequence(parsed.s);
  if (!email || !sequence) return null;
  const issuedAtMs = Number(parsed.iat);
  if (!Number.isFinite(issuedAtMs)) return null;

  return { email, sequence, issuedAtMs };
}

/**
 * Pair of timestamps for DynamoDB: UTC ISO-8601 + human-readable IST.
 * @param {string | Date | number} [input]
 * @returns {{ utc: string, ist: string }}
 */
function formatUtcAndIst(input = new Date()) {
  const date =
    input instanceof Date
      ? input
      : new Date(typeof input === 'number' ? input : String(input));
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp for UTC/IST formatting');
  }

  const utc = date.toISOString();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  const ist = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} IST`;
  return { utc, ist };
}

/**
 * DynamoDB update for SAMPLE_REQUESTS_TABLE when an email CTA is clicked.
 * Sequence-specific first-click timestamp + rolling last-click fields.
 * Each click time is stored as UTC (`*At`) and IST (`*AtIst`) columns.
 */
function buildEmailLinkClickUpdate({ sequence, now } = {}) {
  const { utc, ist } = formatUtcAndIst(now || new Date());
  const seq = normalizeSequence(sequence);
  const values = {
    ':nowUtc': utc,
    ':nowIst': ist,
    ':seq': seq,
    ':zero': 0,
    ':one': 1,
  };

  let expression =
    'SET lastEmailLinkClickedAt = :nowUtc, ' +
    'lastEmailLinkClickedAtIst = :nowIst, ' +
    'lastEmailLinkSequence = :seq, ' +
    'emailLinkClickCount = if_not_exists(emailLinkClickCount, :zero) + :one, ' +
    'updatedAt = :nowUtc';

  // Named first-click attributes for known sample nurture steps.
  if (seq === 'sample-continuity' || seq === 'continuity') {
    expression +=
      ', sampleContinuityLinkClickedAt = if_not_exists(sampleContinuityLinkClickedAt, :nowUtc)' +
      ', sampleContinuityLinkClickedAtIst = if_not_exists(sampleContinuityLinkClickedAtIst, :nowIst)';
  } else if (seq === 'sample-education' || seq === 'education') {
    expression +=
      ', sampleEducationLinkClickedAt = if_not_exists(sampleEducationLinkClickedAt, :nowUtc)' +
      ', sampleEducationLinkClickedAtIst = if_not_exists(sampleEducationLinkClickedAtIst, :nowIst)';
  } else if (seq === 'sample-reminder' || seq === 'reminder') {
    expression +=
      ', sampleReminderLinkClickedAt = if_not_exists(sampleReminderLinkClickedAt, :nowUtc)' +
      ', sampleReminderLinkClickedAtIst = if_not_exists(sampleReminderLinkClickedAtIst, :nowIst)';
  } else if (seq === 'sample-followup' || seq === 'voucher') {
    expression +=
      ', sampleFollowUpLinkClickedAt = if_not_exists(sampleFollowUpLinkClickedAt, :nowUtc)' +
      ', sampleFollowUpLinkClickedAtIst = if_not_exists(sampleFollowUpLinkClickedAtIst, :nowIst)';
  }

  return {
    UpdateExpression: expression,
    ExpressionAttributeValues: values,
  };
}

module.exports = {
  TOKEN_VERSION,
  CLICK_QUERY_PARAM,
  normalizeEmail,
  normalizeSequence,
  formatUtcAndIst,
  createEmailClickToken,
  verifyEmailClickToken,
  buildEmailLinkClickUpdate,
};
