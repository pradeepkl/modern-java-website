/**
 * Product prices loaded from product-prices.json (INR major units).
 * Keep backend/src/product-prices.json in sync with config/product-prices.json.
 */

const productPrices = require('./product-prices.json');

const FORMAT_IDS = new Set(['kindle', 'digital', 'paperback']);

const assertValidPrices = (prices = productPrices) => {
  if (!prices || typeof prices !== 'object') {
    throw new Error('product-prices.json must export an object');
  }
  if (prices.currency !== 'INR') {
    throw new Error('product-prices.json currency must be INR');
  }
  for (const id of FORMAT_IDS) {
    const entry = prices[id];
    if (!entry || typeof entry !== 'object') {
      throw new Error(`product-prices.json missing "${id}"`);
    }
    const amount = Number(entry.amountInr);
    const listAmount = Number(entry.listAmountInr);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`product-prices.json ${id}.amountInr must be a positive integer`);
    }
    if (!Number.isInteger(listAmount) || listAmount < amount) {
      throw new Error(
        `product-prices.json ${id}.listAmountInr must be an integer >= amountInr`,
      );
    }
  }
  return prices;
};

assertValidPrices(productPrices);

const inrToPaise = (amountInr) => Math.round(Number(amountInr) * 100);

const getAmountInr = (formatId) => {
  if (!FORMAT_IDS.has(formatId)) {
    throw new Error(`Unknown product format: ${formatId}`);
  }
  return Number(productPrices[formatId].amountInr);
};

const getDigitalBundlePricePaise = () => inrToPaise(getAmountInr('digital'));

const getPaperbackUnitPricePaise = () => inrToPaise(getAmountInr('paperback'));

const getPaperbackTotalPaise = (quantity) => {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error('Paperback quantity must be a positive integer');
  }
  return getPaperbackUnitPricePaise() * qty;
};

module.exports = {
  productPrices,
  assertValidPrices,
  inrToPaise,
  getAmountInr,
  getDigitalBundlePricePaise,
  getPaperbackUnitPricePaise,
  getPaperbackTotalPaise,
};
