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
  it('puts only buyer name and email on the invoice Bill To block', () => {
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
      },
    );
  });

  it('omits city and country even when digital checkout has none', () => {
    const address = buildInvoiceBuyerBillingAddress({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    assert.deepEqual(address, {
      attention: 'Ada Lovelace',
      address: 'ada@example.com',
    });
    assert.equal(address.city, undefined);
    assert.equal(address.country, undefined);
    assert.equal(address.zip, undefined);
  });

  it('keeps the serialized billing_address under Zoho’s 100-char limit', () => {
    const address = buildInvoiceBuyerBillingAddress({
      name: 'Balagopal Ramavarma',
      email: 'balagopal.ramavarmausb@gmail.com',
    });
    assert.equal(JSON.stringify(address).length <= 100, true);
    assert.equal(address.attention, 'Balagopal Ramavarma');
    assert.equal(address.address, 'balagopal.ramavarmausb@gmail.com');
  });

  it('truncates long name/email so the JSON stays under 100 chars', () => {
    const address = buildInvoiceBuyerBillingAddress({
      name: 'A'.repeat(80),
      email: `${'b'.repeat(60)}@example.com`,
    });
    assert.equal(JSON.stringify(address).length <= 100, true);
    assert.ok(address.attention.length >= 1);
    assert.ok(address.address.length >= 1);
  });
});
