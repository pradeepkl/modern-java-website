import { describe, expect, it, vi } from 'vitest';
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

describe('isDigitalSalesEnabled', () => {
  it('is false unless VITE_DIGITAL_SALES_ENABLED is the string true', async () => {
    vi.stubEnv('VITE_DIGITAL_SALES_ENABLED', undefined);
    vi.resetModules();
    expect((await import('./features')).isDigitalSalesEnabled()).toBe(false);

    vi.stubEnv('VITE_DIGITAL_SALES_ENABLED', 'false');
    vi.resetModules();
    expect((await import('./features')).isDigitalSalesEnabled()).toBe(false);

    vi.stubEnv('VITE_DIGITAL_SALES_ENABLED', 'true');
    vi.resetModules();
    expect((await import('./features')).isDigitalSalesEnabled()).toBe(true);
  });
});
