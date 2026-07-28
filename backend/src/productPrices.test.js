const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  productPrices,
  assertValidPrices,
  inrToPaise,
  getAmountInr,
  getDigitalBundlePricePaise,
  getPaperbackUnitPricePaise,
  getPaperbackTotalPaise,
} = require('./productPrices');

describe('productPrices', () => {
  it('loads expected catalog amounts', () => {
    assert.equal(productPrices.currency, 'INR');
    assert.equal(productPrices.kindle.amountInr, 499);
    assert.equal(productPrices.digital.amountInr, 699);
    assert.equal(productPrices.paperback.amountInr, 899);
  });

  it('exposes paise helpers used by checkout', () => {
    assert.equal(inrToPaise(699), 69900);
    assert.equal(getAmountInr('digital'), 699);
    assert.equal(getDigitalBundlePricePaise(), 69900);
    assert.equal(getPaperbackUnitPricePaise(), 89900);
    assert.equal(getPaperbackTotalPaise(2), 179800);
  });

  it('rejects invalid paperback quantities', () => {
    assert.throws(() => getPaperbackTotalPaise(0), /positive integer/);
    assert.throws(() => getPaperbackTotalPaise(1.5), /positive integer/);
  });

  it('rejects unknown formats', () => {
    assert.throws(() => getAmountInr('hardcover'), /Unknown product format/);
  });

  it('validates malformed price catalogs', () => {
    assert.throws(
      () => assertValidPrices({ currency: 'USD' }),
      /currency must be INR/,
    );
    assert.throws(
      () =>
        assertValidPrices({
          currency: 'INR',
          kindle: { amountInr: 499, listAmountInr: 624 },
          digital: { amountInr: 699, listAmountInr: 874 },
          paperback: { amountInr: -1, listAmountInr: 100 },
        }),
      /paperback\.amountInr/,
    );
  });

  it('stays in sync with repo config/product-prices.json when present', () => {
    const sharedPath = path.join(
      __dirname,
      '..',
      '..',
      'config',
      'product-prices.json',
    );
    if (!fs.existsSync(sharedPath)) {
      return;
    }
    const shared = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
    assert.deepEqual(productPrices, shared);
  });
});
