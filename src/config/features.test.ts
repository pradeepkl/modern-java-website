import { describe, expect, it } from 'vitest';
import { resolvePaperbackMode } from './features';

describe('resolvePaperbackMode', () => {
  it('prefers sales when sales is enabled', () => {
    expect(resolvePaperbackMode(true, false)).toBe('sales');
  });

  it('shows waitlist when only waitlist is enabled', () => {
    expect(resolvePaperbackMode(false, true)).toBe('waitlist');
  });

  it('shows unavailable when both are disabled', () => {
    expect(resolvePaperbackMode(false, false)).toBe('unavailable');
  });

  it('prefers sales when both are enabled', () => {
    expect(resolvePaperbackMode(true, true)).toBe('sales');
  });
});
