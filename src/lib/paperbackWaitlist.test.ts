import { describe, expect, it } from 'vitest';
import {
  hasWaitlistFieldErrors,
  normalizeWaitlistFormValues,
  validateWaitlistForm,
} from './paperbackWaitlist';

describe('paperback waitlist form validation', () => {
  it('rejects empty name', () => {
    const errors = validateWaitlistForm({
      name: '   ',
      email: 'reader@example.com',
      city: '',
      paperbackConsent: true,
      promotionalConsent: false,
    });
    expect(errors.name).toMatch(/name/i);
  });

  it('rejects invalid email', () => {
    const errors = validateWaitlistForm({
      name: 'Pradeep',
      email: 'not-valid',
      city: '',
      paperbackConsent: true,
      promotionalConsent: false,
    });
    expect(errors.email).toMatch(/email/i);
  });

  it('rejects missing consent', () => {
    const errors = validateWaitlistForm({
      name: 'Pradeep',
      email: 'reader@example.com',
      city: '',
      paperbackConsent: false,
      promotionalConsent: false,
    });
    expect(errors.paperbackConsent).toMatch(/consent/i);
  });

  it('accepts optional city and optional promotional consent', () => {
    const errors = validateWaitlistForm({
      name: 'Pradeep',
      email: 'reader@example.com',
      city: 'Mysuru',
      paperbackConsent: true,
      promotionalConsent: false,
    });
    expect(hasWaitlistFieldErrors(errors)).toBe(false);
  });

  it('normalizes email to lowercase and trims fields', () => {
    const normalized = normalizeWaitlistFormValues({
      name: '  Pradeep  ',
      email: 'Reader@Example.COM',
      city: ' Mysuru ',
      paperbackConsent: true,
      promotionalConsent: true,
    });
    expect(normalized).toEqual({
      name: 'Pradeep',
      email: 'reader@example.com',
      city: 'Mysuru',
      paperbackConsent: true,
      promotionalConsent: true,
    });
  });
});
