/** Consent copy version for Modern Java preview / reader-list opt-in. */
export const MODERN_JAVA_CONSENT_VERSION = 'modern-java-email-v1';

/** Source recorded when the visitor opts in on the preview form checkbox. */
export const SAMPLE_CHAPTER_FORM_SOURCE = 'sample-chapter-form';

/** Alias aligned with funnel naming (same value as SAMPLE_CHAPTER_FORM_SOURCE). */
export const PREVIEW_FORM_SOURCE = SAMPLE_CHAPTER_FORM_SOURCE;

/** Source recorded when the visitor opts in from the preview success screen. */
export const PREVIEW_SUCCESS_SOURCE = 'preview-success';

/** Source recorded when the visitor opts in from the preview PDF CTA. */
export const PREVIEW_PDF_SOURCE = 'preview-pdf';

/** Source recorded when the visitor opts in on the dedicated /subscribe page. */
export const WEBSITE_SUBSCRIBE_SOURCE = 'website-subscribe';

const KNOWN_SUBSCRIBE_SOURCES = new Set([
  SAMPLE_CHAPTER_FORM_SOURCE,
  PREVIEW_SUCCESS_SOURCE,
  PREVIEW_PDF_SOURCE,
  WEBSITE_SUBSCRIBE_SOURCE,
]);

/**
 * Resolve ?source= on /subscribe. Unknown values fall back to website-subscribe.
 * Never embeds email in the URL — source is attribution only.
 */
export function resolveSubscribeSource(
  raw: string | null | undefined,
): string {
  const source = String(raw || '').trim();
  if (KNOWN_SUBSCRIBE_SOURCES.has(source)) return source;
  return WEBSITE_SUBSCRIBE_SOURCE;
}
