const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  maskEmail,
  maskName,
  toOrderSummary,
  summariesByOrderId,
} = require('./orderSummary');

describe('maskEmail', () => {
  it('masks local and domain', () => {
    assert.equal(maskEmail('prk.usa@gmail.com'), 'p***@g***.com');
  });

  it('handles empty', () => {
    assert.equal(maskEmail(''), '');
  });
});

describe('maskName', () => {
  it('masks each word keeping first letter', () => {
    assert.equal(maskName('Ramakrishna Pydipati'), 'R********** P*******');
  });
});

describe('toOrderSummary', () => {
  it('omits raw PII and keeps order ids', () => {
    const summary = toOrderSummary(
      {
        appOrderId: 'MJ-D-0ADE8689',
        status: 'paid',
        productType: 'digital_bundle',
        amount: 69900,
        currency: 'INR',
        name: 'Ramakrishna Pydipati',
        email: 'prk.usa@gmail.com',
        razorpayOrderId: 'order_TJPnK4iuTlihGO',
        paymentId: 'pay_TJPnwV1W87rbKG',
        metaAttribution: {
          clientIpAddress: '183.83.170.87',
          fbc: 'secret',
        },
      },
      { recordedAt: '2026-08-06T02:00:00Z' },
    );

    assert.equal(summary.emailMasked, 'p***@g***.com');
    assert.equal(summary.customerNameMasked, 'R********** P*******');
    assert.equal(summary.amountInr, 699);
    assert.equal(summary.appOrderId, 'MJ-D-0ADE8689');
    assert.equal(summary.email, undefined);
    assert.equal(summary.name, undefined);
    assert.equal(summary.metaAttribution, undefined);
  });
});

describe('summariesByOrderId', () => {
  it('keys every order by appOrderId', () => {
    const table = summariesByOrderId(
      [
        { appOrderId: 'MJ-D-1', amount: 100, email: 'a@b.com', name: 'Ann' },
        { appOrderId: 'MJ-2', amount: 200, email: 'c@d.com', name: 'Bob' },
      ],
      { recordedAt: '2026-08-06T02:00:00Z' },
    );
    assert.deepEqual(Object.keys(table).sort(), ['MJ-2', 'MJ-D-1']);
  });
});
