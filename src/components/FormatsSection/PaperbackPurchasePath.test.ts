import { describe, expect, it } from 'vitest';
import { PaperbackPurchaseCard } from './PaperbackPurchaseCard';
import { PaperbackOrderDialog } from './PaperbackOrderDialog';
import { formatOptions } from '../../data/formats';

describe('paperback purchase path compile smoke', () => {
  it('keeps purchase card and order dialog importable', () => {
    expect(typeof PaperbackPurchaseCard).toBe('function');
    expect(typeof PaperbackOrderDialog).toBe('function');
    const paperback = formatOptions.find((format) => format.id === 'paperback');
    expect(paperback?.ctaLabel).toBe('Place order');
    expect(paperback?.price).toBe('₹899');
  });
});
