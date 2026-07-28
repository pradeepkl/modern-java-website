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
  it('loads catalog amounts from product-prices.json', () => {
    assert.equal(productPrices.currency, 'INR');
    assert.equal(getAmountInr('kindle'), productPrices.kindle.amountInr);
    assert.equal(getAmountInr('digital'), productPrices.digital.amountInr);
    assert.equal(getAmountInr('paperback'), productPrices.paperback.amountInr);
    assert.ok(productPrices.kindle.amountInr > 0);
    assert.ok(productPrices.digital.amountInr > 0);
    assert.ok(productPrices.paperback.amountInr > 0);
  });

  it('exposes paise helpers used by checkout', () => {
    const digitalInr = productPrices.digital.amountInr;
    const paperbackInr = productPrices.paperback.amountInr;
    assert.equal(inrToPaise(digitalInr), digitalInr * 100);
    assert.equal(getDigitalBundlePricePaise(), digitalInr * 100);
    assert.equal(getPaperbackUnitPricePaise(), paperbackInr * 100);
    assert.equal(getPaperbackTotalPaise(2), paperbackInr * 200);
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
