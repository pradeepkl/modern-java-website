/**
 * Exclusive reader vouchers for sample-chapter Day 4 nurture.
 *
 * Status machine: ISSUED → RESERVED → REDEEMED
 *                 RESERVED (expired) → treated as ISSUED again
 *
 * Pricing: fixed exclusive payable amount against the current Classpath
 * digital website price (amountInr). Default: list ₹899 → pay ₹699.
 * No percentage is used or shown in customer-facing copy.
 */
const { randomBytes } = require('node:crypto');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  getAmountInr,
  inrToPaise,
} = require('./productPrices');

const VOUCHER_STATUS = Object.freeze({
  ISSUED: 'ISSUED',
  RESERVED: 'RESERVED',
  REDEEMED: 'REDEEMED',
  DISABLED: 'DISABLED',
});

const DEFAULT_PAYABLE_AMOUNT_INR = 699;
/** Multi-use site checkout code (not email-bound; not one-time). */
const DEFAULT_CAMPAIGN_VOUCHER_CODE = 'MODERNJAVA';
const DEFAULT_VALIDITY_DAYS = 7;
const DEFAULT_RESERVATION_TTL_MINUTES = 30;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVALID_VOUCHER_MESSAGE = 'Invalid or expired voucher.';
const VOUCHER_KIND = Object.freeze({
  CAMPAIGN: 'campaign',
  PERSONAL: 'personal',
});

function isConditionalCheckFailed(error) {
  return (
    error?.name === 'ConditionalCheckFailedException' ||
    error?.Code === 'ConditionalCheckFailedException' ||
    Boolean(error?.__type?.includes('ConditionalCheckFailed'))
  );
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizeVoucherCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function getConfiguredPayableAmountInr(
  env = process.env,
  fallback = DEFAULT_PAYABLE_AMOUNT_INR,
) {
  const raw = env.READER_VOUCHER_PAYABLE_INR;
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      'READER_VOUCHER_PAYABLE_INR must be a positive integer (INR)',
    );
  }
  return value;
}

function getConfiguredCampaignVoucherCode(
  env = process.env,
  fallback = DEFAULT_CAMPAIGN_VOUCHER_CODE,
) {
  const configured = normalizeVoucherCode(
    env.CAMPAIGN_VOUCHER_CODE || env.READER_CAMPAIGN_VOUCHER_CODE || fallback,
  );
  return configured || normalizeVoucherCode(fallback);
}

function isCampaignVoucherCode(code, env = process.env) {
  const normalized = normalizeVoucherCode(code);
  if (!normalized) return false;
  return normalized === getConfiguredCampaignVoucherCode(env);
}

function getConfiguredValidityDays(
  env = process.env,
  fallback = DEFAULT_VALIDITY_DAYS,
) {
  const raw = env.READER_VOUCHER_VALIDITY_DAYS;
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('READER_VOUCHER_VALIDITY_DAYS must be a positive integer');
  }
  return value;
}

function getReservationTtlMinutes(
  env = process.env,
  fallback = DEFAULT_RESERVATION_TTL_MINUTES,
) {
  const raw = env.READER_VOUCHER_RESERVATION_TTL_MINUTES;
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 5) {
    throw new Error(
      'READER_VOUCHER_RESERVATION_TTL_MINUTES must be an integer >= 5',
    );
  }
  return value;
}

/**
 * Cryptographically random code: MJ-XXXX-XXXX (no PII, URL-safe, uppercase).
 */
function generateVoucherCode() {
  const bytes = randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i += 1) {
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `MJ-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Fixed exclusive payable against current Classpath digital amountInr.
 * Example: basis ₹899, payable ₹699 → discount ₹200.
 */
function computeVoucherPricing({
  basisAmountInr = getAmountInr('digital'),
  payableAmountInr = getConfiguredPayableAmountInr(),
} = {}) {
  const basis = Number(basisAmountInr);
  const payable = Number(payableAmountInr);
  if (!Number.isInteger(basis) || basis <= 0) {
    throw new Error('basisAmountInr must be a positive integer');
  }
  if (!Number.isInteger(payable) || payable < 1) {
    throw new Error('payableAmountInr must be a positive integer');
  }
  if (payable >= basis) {
    throw new Error('payableAmountInr must be less than basisAmountInr');
  }
  const discountAmountInr = basis - payable;
  return {
    basisAmountInr: basis,
    discountAmountInr,
    payableAmountInr: payable,
    basisAmountPaise: inrToPaise(basis),
    discountAmountPaise: inrToPaise(discountAmountInr),
    payableAmountPaise: inrToPaise(payable),
  };
}

/** Prefer amounts stored on the voucher row (stable for already-issued codes). */
function pricingFromVoucher(voucher) {
  if (
    voucher &&
    Number.isInteger(voucher.basisAmountInr) &&
    Number.isInteger(voucher.payableAmountInr) &&
    Number.isInteger(voucher.discountAmountInr)
  ) {
    return computeVoucherPricing({
      basisAmountInr: voucher.basisAmountInr,
      payableAmountInr: voucher.payableAmountInr,
    });
  }
  return computeVoucherPricing();
}

function sampleRequestedAtIso(sampleItem) {
  return String(
    sampleItem?.lastRequestedAt || sampleItem?.firstRequestedAt || '',
  ).trim();
}

/**
 * Expiry = sample chapter request timestamp + validityDays × 24h (UTC).
 */
function computeVoucherExpiryIso(
  sampleRequestedAt,
  {
    validityDays = getConfiguredValidityDays(),
  } = {},
) {
  const requestedMs = Date.parse(sampleRequestedAt);
  if (!Number.isFinite(requestedMs)) {
    throw new Error('sampleRequestedAt must be a valid ISO timestamp');
  }
  const expiresMs =
    requestedMs + Math.max(1, Number(validityDays)) * 24 * 60 * 60 * 1000;
  return new Date(expiresMs).toISOString();
}

function isVoucherExpired(voucher, now = new Date()) {
  const expiresMs = Date.parse(voucher?.expiresAt || '');
  if (!Number.isFinite(expiresMs)) return true;
  return now.getTime() >= expiresMs;
}

function isReservationActive(voucher, now = new Date()) {
  if (!voucher || voucher.status !== VOUCHER_STATUS.RESERVED) return false;
  const reservationExpiresMs = Date.parse(voucher.reservationExpiresAt || '');
  if (!Number.isFinite(reservationExpiresMs)) return false;
  return now.getTime() < reservationExpiresMs;
}

function formatExpiryForEmail(expiresAtIso) {
  const date = new Date(expiresAtIso);
  if (Number.isNaN(date.getTime())) return String(expiresAtIso || '');
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

/**
 * Whether Day 4 may still issue/send a voucher for this sample request.
 * Skip when the voucher would already be expired at send time.
 */
function canIssueVoucherForSample(sampleItem, { now = new Date() } = {}) {
  const requestedAt = sampleRequestedAtIso(sampleItem);
  if (!requestedAt) return false;
  try {
    const expiresAt = computeVoucherExpiryIso(requestedAt);
    return !isVoucherExpired({ expiresAt }, now);
  } catch {
    return false;
  }
}

/**
 * Campaign-wide multi-use code: same fixed payable as reader offer, no email
 * binding and no one-time redemption.
 */
function evaluateCampaignVoucher(code) {
  if (!isCampaignVoucherCode(code)) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  return {
    ok: true,
    kind: VOUCHER_KIND.CAMPAIGN,
    pricing: computeVoucherPricing(),
    voucher: null,
  };
}

/**
 * Pure validation against a loaded personal voucher row + checkout email.
 * @returns {{ ok: true, pricing, kind } | { ok: false, message: string }}
 */
function evaluateVoucherForCheckout(
  voucher,
  {
    email,
    now = new Date(),
    appOrderId = null,
    hasPurchased = false,
  } = {},
) {
  const checkoutEmail = normalizeEmail(email);
  if (!voucher || !voucher.code) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (hasPurchased) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (normalizeEmail(voucher.email) !== checkoutEmail) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (voucher.status === VOUCHER_STATUS.DISABLED) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (voucher.status === VOUCHER_STATUS.REDEEMED) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (isVoucherExpired(voucher, now)) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (voucher.status === VOUCHER_STATUS.RESERVED) {
    const active = isReservationActive(voucher, now);
    if (active && appOrderId && voucher.reservedOrderId === appOrderId) {
      // Same order may continue.
    } else if (active) {
      return {
        ok: false,
        message: 'This voucher is temporarily reserved by another checkout.',
      };
    }
    // Expired reservation → treat as ISSUED.
  } else if (voucher.status !== VOUCHER_STATUS.ISSUED) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }

  const pricing = pricingFromVoucher(voucher);

  return {
    ok: true,
    kind: VOUCHER_KIND.PERSONAL,
    pricing,
    voucher,
  };
}

/**
 * Resolve either the campaign-wide code or a personal one-time voucher.
 */
function evaluateCheckoutVoucherCode(
  code,
  {
    voucher = null,
    email,
    now = new Date(),
    appOrderId = null,
    hasPurchased = false,
  } = {},
) {
  const normalized = normalizeVoucherCode(code);
  if (!normalized) {
    return { ok: false, message: INVALID_VOUCHER_MESSAGE };
  }
  if (isCampaignVoucherCode(normalized)) {
    return evaluateCampaignVoucher(normalized);
  }
  return evaluateVoucherForCheckout(voucher, {
    email,
    now,
    appOrderId,
    hasPurchased,
  });
}

function publicVoucherPricing(pricing) {
  return {
    basisAmountInr: pricing.basisAmountInr,
    discountAmountInr: pricing.discountAmountInr,
    payableAmountInr: pricing.payableAmountInr,
  };
}

async function getVoucherByCode(dynamo, tableName, code) {
  if (!tableName) return null;
  const normalized = normalizeVoucherCode(code);
  if (!normalized) return null;
  const result = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: { code: normalized },
    }),
  );
  return result.Item || null;
}

async function findVoucherByEmail(dynamo, tableName, email) {
  if (!tableName) return null;
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const result = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': normalized },
      Limit: 5,
    }),
  );
  const items = result.Items || [];
  // Prefer an active (non-redeemed, non-disabled) voucher.
  const active = items.find(
    (item) =>
      item.status === VOUCHER_STATUS.ISSUED ||
      item.status === VOUCHER_STATUS.RESERVED,
  );
  return active || items[0] || null;
}

/**
 * Idempotent issue: reuse existing active voucher for the email when present.
 */
async function issueVoucherForSampleLead({
  dynamo,
  tableName,
  sampleItem,
  now = new Date(),
  payableAmountInr = getConfiguredPayableAmountInr(),
}) {
  if (!tableName) {
    throw new Error('VOUCHERS_TABLE is not configured');
  }
  const email = normalizeEmail(sampleItem?.email);
  if (!email) {
    throw new Error('Sample lead email is required');
  }
  if (!canIssueVoucherForSample(sampleItem, { now })) {
    const error = new Error('Voucher window has already expired for this lead');
    error.code = 'VOUCHER_WINDOW_EXPIRED';
    throw error;
  }

  const existing = await findVoucherByEmail(dynamo, tableName, email);
  if (existing) {
    if (existing.status === VOUCHER_STATUS.REDEEMED) {
      const error = new Error('Voucher already redeemed for this lead');
      error.code = 'VOUCHER_ALREADY_REDEEMED';
      throw error;
    }
    if (existing.status === VOUCHER_STATUS.DISABLED) {
      const error = new Error('Voucher disabled for this lead');
      error.code = 'VOUCHER_DISABLED';
      throw error;
    }
    if (!isVoucherExpired(existing, now)) {
      return { voucher: existing, created: false };
    }
  }

  const requestedAt = sampleRequestedAtIso(sampleItem);
  const pricing = computeVoucherPricing({ payableAmountInr });
  const expiresAt = computeVoucherExpiryIso(requestedAt);
  const createdAt = now.toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateVoucherCode();
    const voucher = {
      code,
      email,
      status: VOUCHER_STATUS.ISSUED,
      productType: 'digital_bundle',
      basisAmountInr: pricing.basisAmountInr,
      discountAmountInr: pricing.discountAmountInr,
      payableAmountInr: pricing.payableAmountInr,
      sampleRequestedAt: requestedAt,
      expiresAt,
      createdAt,
      updatedAt: createdAt,
    };
    try {
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: voucher,
          ConditionExpression: 'attribute_not_exists(code)',
        }),
      );
      return { voucher, created: true };
    } catch (error) {
      if (!isConditionalCheckFailed(error)) throw error;
    }
  }

  throw new Error('Unable to allocate a unique voucher code');
}

async function reserveVoucher({
  dynamo,
  tableName,
  code,
  email,
  appOrderId,
  now = new Date(),
  hasPurchased = false,
  reservationTtlMinutes = getReservationTtlMinutes(),
}) {
  const voucher = await getVoucherByCode(dynamo, tableName, code);
  const evaluation = evaluateVoucherForCheckout(voucher, {
    email,
    now,
    appOrderId,
    hasPurchased,
  });
  if (!evaluation.ok) {
    const error = new Error(evaluation.message);
    error.code = 'VOUCHER_INVALID';
    throw error;
  }

  // Already reserved for this order — idempotent.
  if (
    voucher.status === VOUCHER_STATUS.RESERVED &&
    voucher.reservedOrderId === appOrderId &&
    isReservationActive(voucher, now)
  ) {
    return { voucher, pricing: evaluation.pricing };
  }

  const reservedAt = now.toISOString();
  const reservationExpiresAt = new Date(
    now.getTime() + reservationTtlMinutes * 60 * 1000,
  ).toISOString();

  try {
    const updated = await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { code: normalizeVoucherCode(code) },
        UpdateExpression:
          'SET #status = :reserved, reservedOrderId = :orderId, reservedAt = :reservedAt, ' +
          'reservationExpiresAt = :reservationExpiresAt, updatedAt = :updatedAt',
        ConditionExpression:
          'email = :email AND expiresAt > :now AND (' +
          '#status = :issued OR ' +
          '(#status = :reserved AND (reservationExpiresAt <= :now OR reservedOrderId = :orderId))' +
          ') AND #status <> :redeemed AND #status <> :disabled',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':reserved': VOUCHER_STATUS.RESERVED,
          ':issued': VOUCHER_STATUS.ISSUED,
          ':redeemed': VOUCHER_STATUS.REDEEMED,
          ':disabled': VOUCHER_STATUS.DISABLED,
          ':orderId': appOrderId,
          ':reservedAt': reservedAt,
          ':reservationExpiresAt': reservationExpiresAt,
          ':updatedAt': reservedAt,
          ':email': normalizeEmail(email),
          ':now': now.toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return {
      voucher: updated.Attributes,
      pricing: evaluation.pricing,
    };
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      const conflict = new Error(
        'This voucher is temporarily reserved by another checkout.',
      );
      conflict.code = 'VOUCHER_RESERVED';
      throw conflict;
    }
    throw error;
  }
}

async function releaseVoucherReservation({
  dynamo,
  tableName,
  code,
  appOrderId,
  now = new Date(),
}) {
  if (!tableName || !code || !appOrderId) return false;
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { code: normalizeVoucherCode(code) },
        UpdateExpression:
          'SET #status = :issued, updatedAt = :updatedAt ' +
          'REMOVE reservedOrderId, reservedAt, reservationExpiresAt',
        ConditionExpression:
          '#status = :reserved AND reservedOrderId = :orderId',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':issued': VOUCHER_STATUS.ISSUED,
          ':reserved': VOUCHER_STATUS.RESERVED,
          ':orderId': appOrderId,
          ':updatedAt': now.toISOString(),
        },
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

/**
 * Mark redeemed only after successful payment verification.
 * Allows redeem from RESERVED for this order, or ISSUED when checkout
 * bypasses reservation (dev bypass path redeems immediately).
 */
async function redeemVoucher({
  dynamo,
  tableName,
  code,
  email,
  appOrderId,
  now = new Date(),
}) {
  if (!tableName || !code || !appOrderId) return false;
  const redeemedAt = now.toISOString();
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { code: normalizeVoucherCode(code) },
        UpdateExpression:
          'SET #status = :redeemed, redeemedAt = :redeemedAt, redeemedOrderId = :orderId, ' +
          'updatedAt = :updatedAt REMOVE reservedOrderId, reservedAt, reservationExpiresAt',
        ConditionExpression:
          'email = :email AND #status <> :redeemed AND #status <> :disabled AND (' +
          '(#status = :reserved AND reservedOrderId = :orderId) OR #status = :issued' +
          ')',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':redeemed': VOUCHER_STATUS.REDEEMED,
          ':reserved': VOUCHER_STATUS.RESERVED,
          ':issued': VOUCHER_STATUS.ISSUED,
          ':disabled': VOUCHER_STATUS.DISABLED,
          ':orderId': appOrderId,
          ':redeemedAt': redeemedAt,
          ':updatedAt': redeemedAt,
          ':email': normalizeEmail(email),
        },
      }),
    );
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      // Already redeemed for this order is success for idempotent webhooks.
      const current = await getVoucherByCode(dynamo, tableName, code);
      if (
        current?.status === VOUCHER_STATUS.REDEEMED &&
        current.redeemedOrderId === appOrderId
      ) {
        return true;
      }
      return false;
    }
    throw error;
  }
}

module.exports = {
  VOUCHER_STATUS,
  VOUCHER_KIND,
  DEFAULT_PAYABLE_AMOUNT_INR,
  DEFAULT_CAMPAIGN_VOUCHER_CODE,
  DEFAULT_VALIDITY_DAYS,
  DEFAULT_RESERVATION_TTL_MINUTES,
  INVALID_VOUCHER_MESSAGE,
  isConditionalCheckFailed,
  normalizeEmail,
  normalizeVoucherCode,
  getConfiguredPayableAmountInr,
  getConfiguredCampaignVoucherCode,
  isCampaignVoucherCode,
  getConfiguredValidityDays,
  getReservationTtlMinutes,
  generateVoucherCode,
  computeVoucherPricing,
  pricingFromVoucher,
  sampleRequestedAtIso,
  computeVoucherExpiryIso,
  isVoucherExpired,
  isReservationActive,
  formatExpiryForEmail,
  canIssueVoucherForSample,
  evaluateCampaignVoucher,
  evaluateVoucherForCheckout,
  evaluateCheckoutVoucherCode,
  publicVoucherPricing,
  getVoucherByCode,
  findVoucherByEmail,
  issueVoucherForSampleLead,
  reserveVoucher,
  releaseVoucherReservation,
  redeemVoucher,
};
