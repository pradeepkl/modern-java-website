import { describe, expect, it } from 'vitest';
import { getFormattedPrice } from '../../config/prices';
import { formatOptions } from '../../data/formats';
import { PaperbackOrderDialog } from './PaperbackOrderDialog';
import { PaperbackPurchaseCard } from './PaperbackPurchaseCard';

describe('paperback purchase path compile smoke', () => {
  it('keeps purchase card and order dialog importable', () => {
    expect(typeof PaperbackPurchaseCard).toBe('function');
    expect(typeof PaperbackOrderDialog).toBe('function');
    const paperback = formatOptions.find((format) => format.id === 'paperback');
    expect(paperback?.ctaLabel).toBe('Place order');
    expect(paperback?.price).toBe(getFormattedPrice('paperback'));
  });
});
