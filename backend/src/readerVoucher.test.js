const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  VOUCHER_STATUS,
  VOUCHER_KIND,
  DEFAULT_PAYABLE_AMOUNT_INR,
  DEFAULT_CAMPAIGN_VOUCHER_CODE,
  generateVoucherCode,
  computeVoucherPricing,
  computeVoucherExpiryIso,
  isVoucherExpired,
  isReservationActive,
  canIssueVoucherForSample,
  evaluateVoucherForCheckout,
  evaluateCheckoutVoucherCode,
  isCampaignVoucherCode,
  normalizeVoucherCode,
  getConfiguredPayableAmountInr,
} = require('./readerVoucher');
const { getAmountInr } = require('./productPrices');

describe('generateVoucherCode', () => {
  it('returns MJ-XXXX-XXXX uppercase non-PII codes', () => {
    const code = generateVoucherCode();
    assert.match(code, /^MJ-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    assert.notEqual(generateVoucherCode(), code);
  });
});

describe('computeVoucherPricing', () => {
  it('uses fixed payable against current digital amountInr', () => {
    const basis = getAmountInr('digital');
    assert.equal(basis, 899);
    assert.equal(DEFAULT_PAYABLE_AMOUNT_INR, 699);
    const pricing = computeVoucherPricing({
      basisAmountInr: basis,
      payableAmountInr: 699,
    });
    assert.equal(pricing.basisAmountInr, 899);
    assert.equal(pricing.payableAmountInr, 699);
    assert.equal(pricing.discountAmountInr, 200);
    assert.equal(pricing.payableAmountPaise, 69900);
    assert.equal(pricing.discountPercent, undefined);
  });

  it('defaults payable to configured ₹699', () => {
    assert.equal(getConfiguredPayableAmountInr({}), 699);
  });
});

describe('computeVoucherExpiryIso', () => {
  it('expires exactly 7 × 24 hours after sample request UTC', () => {
    assert.equal(
      computeVoucherExpiryIso('2026-07-31T10:00:00.000Z', { validityDays: 7 }),
      '2026-08-07T10:00:00.000Z',
    );
  });
});

describe('canIssueVoucherForSample', () => {
  it('allows issue before expiry and blocks after', () => {
    const sample = {
      email: 'reader@example.com',
      lastRequestedAt: '2026-07-31T10:00:00.000Z',
    };
    assert.equal(
      canIssueVoucherForSample(sample, {
        now: new Date('2026-08-04T10:00:00.000Z'),
      }),
      true,
    );
    assert.equal(
      canIssueVoucherForSample(sample, {
        now: new Date('2026-08-07T10:00:00.000Z'),
      }),
      false,
    );
  });
});

describe('evaluateVoucherForCheckout', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');
  const base = {
    code: 'MJ-7X9K-PL42',
    email: 'reader@example.com',
    status: VOUCHER_STATUS.ISSUED,
    basisAmountInr: 899,
    discountAmountInr: 200,
    payableAmountInr: 699,
    expiresAt: '2026-08-07T10:00:00.000Z',
  };

  it('requires matching email, unexpired, unredeemed voucher', () => {
    const ok = evaluateVoucherForCheckout(base, {
      email: 'reader@example.com',
      now,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.pricing.payableAmountInr, 699);
    assert.equal(
      evaluateVoucherForCheckout(base, {
        email: 'other@example.com',
        now,
      }).ok,
      false,
    );
    assert.equal(
      evaluateVoucherForCheckout(
        { ...base, status: VOUCHER_STATUS.REDEEMED },
        { email: 'reader@example.com', now },
      ).ok,
      false,
    );
    assert.equal(
      evaluateVoucherForCheckout(base, {
        email: 'reader@example.com',
        now,
        hasPurchased: true,
      }).ok,
      false,
    );
    assert.equal(
      isVoucherExpired(base, new Date('2026-08-07T10:00:00.000Z')),
      true,
    );
  });

  it('blocks active foreign reservations and allows same order', () => {
    const reserved = {
      ...base,
      status: VOUCHER_STATUS.RESERVED,
      reservedOrderId: 'MJ-D-AAAA',
      reservationExpiresAt: '2026-08-04T12:30:00.000Z',
    };
    assert.equal(isReservationActive(reserved, now), true);
    assert.equal(
      evaluateVoucherForCheckout(reserved, {
        email: 'reader@example.com',
        now,
        appOrderId: 'MJ-D-BBBB',
      }).ok,
      false,
    );
    assert.equal(
      evaluateVoucherForCheckout(reserved, {
        email: 'reader@example.com',
        now,
        appOrderId: 'MJ-D-AAAA',
      }).ok,
      true,
    );
  });

  it('treats expired reservations as available', () => {
    const reserved = {
      ...base,
      status: VOUCHER_STATUS.RESERVED,
      reservedOrderId: 'MJ-D-AAAA',
      reservationExpiresAt: '2026-08-04T11:00:00.000Z',
    };
    assert.equal(
      evaluateVoucherForCheckout(reserved, {
        email: 'reader@example.com',
        now,
      }).ok,
      true,
    );
  });
});

describe('normalizeVoucherCode', () => {
  it('uppercases and strips spaces', () => {
    assert.equal(normalizeVoucherCode(' mj-7x9k-pl42 '), 'MJ-7X9K-PL42');
  });
});

describe('campaign voucher code', () => {
  it('applies fixed ₹899 → ₹699 without email binding', () => {
    assert.equal(DEFAULT_CAMPAIGN_VOUCHER_CODE, 'MODERNJAVA');
    assert.equal(isCampaignVoucherCode('modernjava'), true);
    const evaluation = evaluateCheckoutVoucherCode('MODERNJAVA');
    assert.equal(evaluation.ok, true);
    assert.equal(evaluation.kind, VOUCHER_KIND.CAMPAIGN);
    assert.equal(evaluation.pricing.basisAmountInr, 899);
    assert.equal(evaluation.pricing.payableAmountInr, 699);
  });

  it('still requires a personal voucher row for non-campaign codes', () => {
    assert.equal(
      evaluateCheckoutVoucherCode('MJ-7X9K-PL42', {
        email: 'reader@example.com',
      }).ok,
      false,
    );
  });
});
