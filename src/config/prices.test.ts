import { describe, expect, it } from 'vitest';
import packagedPrices from '../../backend/src/product-prices.json';
import {
  formatInrAmount,
  getAmountInr,
  getFormattedListPrice,
  getFormattedPrice,
  getListAmountInr,
  paiseToInr,
  productPrices,
} from './prices';

describe('product prices config', () => {
  it('loads Kindle, digital, and paperback amounts from config', () => {
    expect(productPrices.currency).toBe('INR');
    expect(productPrices.discountLabel).toBe('20% off');
    expect(getAmountInr('kindle')).toBe(productPrices.kindle.amountInr);
    expect(getAmountInr('digital')).toBe(productPrices.digital.amountInr);
    expect(getAmountInr('paperback')).toBe(productPrices.paperback.amountInr);
    expect(getListAmountInr('kindle')).toBe(productPrices.kindle.listAmountInr);
    expect(getListAmountInr('digital')).toBe(productPrices.digital.listAmountInr);
    expect(getListAmountInr('paperback')).toBe(
      productPrices.paperback.listAmountInr,
    );
    expect(productPrices.kindle.amountInr).toBeGreaterThan(0);
    expect(productPrices.digital.amountInr).toBeGreaterThan(0);
    expect(productPrices.paperback.amountInr).toBeGreaterThan(0);
  });

  it('converts Razorpay paise amounts to INR rupees for Pixel/GA', () => {
    expect(paiseToInr(500)).toBe(5);
    expect(paiseToInr(productPrices.digital.amountInr * 100)).toBe(
      productPrices.digital.amountInr,
    );
    expect(paiseToInr(0)).toBe(0);
  });

  it('formats INR display strings from config amounts', () => {
    expect(formatInrAmount(productPrices.kindle.amountInr)).toBe(
      getFormattedPrice('kindle'),
    );
    expect(getFormattedPrice('digital')).toBe(
      `₹${productPrices.digital.amountInr}`,
    );
    expect(getFormattedPrice('paperback')).toBe(
      `₹${productPrices.paperback.amountInr}`,
    );
    expect(getFormattedListPrice('paperback')).toBe(
      `₹${productPrices.paperback.listAmountInr}`,
    );
  });

  it('matches the Lambda-packaged copy under backend/src', () => {
    expect(packagedPrices).toEqual(productPrices);
  });
});
