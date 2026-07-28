import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatInrAmount,
  getAmountInr,
  getFormattedListPrice,
  getFormattedPrice,
  getListAmountInr,
  productPrices,
} from './prices';

describe('product prices config', () => {
  it('loads Kindle, digital, and paperback amounts from config', () => {
    expect(productPrices.currency).toBe('INR');
    expect(productPrices.discountLabel).toBe('20% off');
    expect(getAmountInr('kindle')).toBe(499);
    expect(getAmountInr('digital')).toBe(699);
    expect(getAmountInr('paperback')).toBe(899);
    expect(getListAmountInr('kindle')).toBe(624);
    expect(getListAmountInr('digital')).toBe(874);
    expect(getListAmountInr('paperback')).toBe(1124);
  });

  it('formats INR display strings from config amounts', () => {
    expect(formatInrAmount(499)).toBe('₹499');
    expect(getFormattedPrice('kindle')).toBe('₹499');
    expect(getFormattedPrice('digital')).toBe('₹699');
    expect(getFormattedPrice('paperback')).toBe('₹899');
    expect(getFormattedListPrice('paperback')).toBe('₹1124');
  });

  it('matches the Lambda-packaged copy under backend/src', () => {
    const packaged = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'backend/src/product-prices.json'),
        'utf8',
      ),
    );
    expect(packaged).toEqual(productPrices);
  });
});
