import { describe, expect, it } from 'vitest';
import {
  SAMPLE_EMAIL_ALLOWLIST_MESSAGE,
  CONSUMER_EMAIL_ALLOWLIST_MESSAGE,
  isAllowedSampleEmailDomain,
  emailDomain,
} from './sampleEmailAllowlist';

describe('sampleEmailAllowlist', () => {
  it('extracts the domain from an email', () => {
    expect(emailDomain('Reader@Gmail.COM')).toBe('gmail.com');
    expect(emailDomain('a+tag@yahoo.co.in')).toBe('yahoo.co.in');
    expect(emailDomain('bad')).toBe('');
  });

  it('allows known consumer vendors', () => {
    for (const email of [
      'you@gmail.com',
      'you@googlemail.com',
      'you@outlook.com',
      'you@hotmail.com',
      'you@live.com',
      'you@yahoo.com',
      'you@yahoo.co.in',
      'you@icloud.com',
      'you@me.com',
      'you@rediffmail.com',
      'You+Preview@Gmail.Com',
    ]) {
      expect(isAllowedSampleEmailDomain(email)).toBe(true);
    }
  });

  it('rejects disposable and corporate domains', () => {
    for (const email of [
      'x@davopa.com',
      'x@fentaoba.com',
      'x@mailinator.com',
      'x@company.com',
      'x@gmail.com.evil.example',
      'x@notgmail.com',
      'x@example.com',
    ]) {
      expect(isAllowedSampleEmailDomain(email)).toBe(false);
    }
  });

  it('exposes a clear rejection message', () => {
    expect(SAMPLE_EMAIL_ALLOWLIST_MESSAGE).toMatch(/Gmail/i);
    expect(SAMPLE_EMAIL_ALLOWLIST_MESSAGE).toMatch(/Rediff/i);
    expect(CONSUMER_EMAIL_ALLOWLIST_MESSAGE).toMatch(/Gmail/i);
    expect(CONSUMER_EMAIL_ALLOWLIST_MESSAGE).toMatch(/Rediff/i);
  });
});
