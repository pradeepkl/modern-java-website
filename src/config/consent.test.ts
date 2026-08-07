import { describe, expect, it } from 'vitest';
import {
  MODERN_JAVA_CONSENT_VERSION,
  PREVIEW_FORM_SOURCE,
  PREVIEW_PDF_SOURCE,
  PREVIEW_SUCCESS_SOURCE,
  SAMPLE_CHAPTER_FORM_SOURCE,
  WEBSITE_SUBSCRIBE_SOURCE,
  resolveSubscribeSource,
} from './consent';

describe('consent config', () => {
  it('centralizes the Modern Java consent wording version', () => {
    expect(MODERN_JAVA_CONSENT_VERSION).toBe('modern-java-email-v1');
  });

  it('keeps preview-form aliased to the sample chapter form source', () => {
    expect(PREVIEW_FORM_SOURCE).toBe(SAMPLE_CHAPTER_FORM_SOURCE);
    expect(PREVIEW_SUCCESS_SOURCE).toBe('preview-success');
    expect(PREVIEW_PDF_SOURCE).toBe('preview-pdf');
    expect(WEBSITE_SUBSCRIBE_SOURCE).toBe('website-subscribe');
  });

  it('resolves subscribe page sources without embedding email', () => {
    expect(resolveSubscribeSource('preview-pdf')).toBe(PREVIEW_PDF_SOURCE);
    expect(resolveSubscribeSource('website-subscribe')).toBe(
      WEBSITE_SUBSCRIBE_SOURCE,
    );
    expect(resolveSubscribeSource('preview-success')).toBe(PREVIEW_SUCCESS_SOURCE);
    expect(resolveSubscribeSource('unknown')).toBe(WEBSITE_SUBSCRIBE_SOURCE);
    expect(resolveSubscribeSource(null)).toBe(WEBSITE_SUBSCRIBE_SOURCE);
  });
});
