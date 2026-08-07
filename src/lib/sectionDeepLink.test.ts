import { describe, expect, it } from 'vitest';
import {
  buildFormatsSectionUrl,
  readSectionIdFromHash,
  readSectionIdFromSearch,
  resolveSectionDeepLinkId,
} from './sectionDeepLink';

describe('sectionDeepLink', () => {
  it('reads section ids from hash and ignores checkout hashes', () => {
    expect(readSectionIdFromHash('#formats')).toBe('formats');
    expect(readSectionIdFromHash('#Formats')).toBe('formats');
    expect(readSectionIdFromHash('#digital-checkout')).toBe('');
    expect(readSectionIdFromHash('')).toBe('');
  });

  it('reads section ids from query when hash is stripped', () => {
    expect(readSectionIdFromSearch('?section=formats')).toBe('formats');
    expect(readSectionIdFromSearch('?voucher=X&section=formats')).toBe(
      'formats',
    );
    expect(readSectionIdFromSearch('')).toBe('');
  });

  it('prefers hash over query', () => {
    expect(
      resolveSectionDeepLinkId({
        hash: '#author',
        search: '?section=formats',
      }),
    ).toBe('author');
    expect(
      resolveSectionDeepLinkId({
        hash: '',
        search: '?section=formats',
      }),
    ).toBe('formats');
  });

  it('builds resilient formats URLs for email CTAs', () => {
    expect(buildFormatsSectionUrl('https://modern-java.classpath.in/')).toBe(
      'https://modern-java.classpath.in/?section=formats&utm_source=email&utm_medium=sample_nurture&utm_campaign=continuity#formats',
    );
    expect(
      buildFormatsSectionUrl('https://modern-java.classpath.in', {
        clickToken: 'abc.def',
        utmMedium: 'email',
      }),
    ).toContain('utm_medium=email');
    expect(
      buildFormatsSectionUrl('https://modern-java.classpath.in', {
        clickToken: 'abc.def',
      }),
    ).toContain('mj_click=abc.def');
  });
});
