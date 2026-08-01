const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  WEBSITE_PURCHASE_CONTACT_NAME,
  buildInvoiceBuyerBillingAddress,
  contactDisplayName,
} = require('./zohoInvoice');

describe('Website Purchase shared Zoho contact', () => {
  it('uses a stable catch-all contact name', () => {
    assert.equal(WEBSITE_PURCHASE_CONTACT_NAME, 'Website Purchase');
  });
});

describe('contactDisplayName', () => {
  it('prefers the provided name', () => {
    assert.equal(
      contactDisplayName({ name: 'Ada Lovelace', email: 'ada@example.com' }),
      'Ada Lovelace',
    );
  });

  it('falls back to a cleaned email local-part', () => {
    assert.equal(
      contactDisplayName({ email: 'ada.lovelace+mj@example.com' }),
      'ada lovelace mj',
    );
  });
});

describe('buildInvoiceBuyerBillingAddress', () => {
  it('puts buyer name and email on the invoice Bill To block', () => {
    assert.deepEqual(
      buildInvoiceBuyerBillingAddress({
        name: 'Ada Lovelace',
        email: 'Ada@Example.com',
        city: 'Bengaluru',
        postalCode: '560001',
      }),
      {
        attention: 'Ada Lovelace',
        address: 'ada@example.com',
        city: 'Bengaluru',
        country: 'India',
        zip: '560001',
      },
    );
  });

  it('uses Online as city when digital checkout has none', () => {
    const address = buildInvoiceBuyerBillingAddress({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    assert.equal(address.city, 'Online');
    assert.equal(address.attention, 'Ada Lovelace');
    assert.equal(address.address, 'ada@example.com');
    assert.equal(address.zip, undefined);
  });
});
