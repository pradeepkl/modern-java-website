import { CLICK_QUERY_PARAM } from './emailLinkClick';

/**
 * Landing-page section deep links (`/#formats`, `/?section=formats`).
 *
 * Native hash scrolling runs before React mounts section nodes, so cold loads
 * of `/#formats` stay at the hero. Query `?section=` survives email clients
 * that strip `#hash` fragments (same pattern as digital checkout).
 */

const SECTION_QUERY = 'section';

/** Hashes handled by checkout deep-link logic, not section scroll. */
const NON_SECTION_HASHES = new Set(['digital-checkout']);

export function readSectionIdFromHash(hash = ''): string {
  const id = String(hash || '')
    .replace(/^#/, '')
    .split(/[/?]/)[0]
    .trim()
    .toLowerCase();
  if (!id || NON_SECTION_HASHES.has(id)) return '';
  return id;
}

export function readSectionIdFromSearch(search = ''): string {
  try {
    const value = new URLSearchParams(search).get(SECTION_QUERY);
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^#/, '');
  } catch {
    return '';
  }
}

/** Prefer hash; fall back to `?section=` when email clients strip the fragment. */
export function resolveSectionDeepLinkId(
  {
    hash = typeof window !== 'undefined' ? window.location.hash : '',
    search = typeof window !== 'undefined' ? window.location.search : '',
  }: { hash?: string; search?: string } = {},
): string {
  return readSectionIdFromHash(hash) || readSectionIdFromSearch(search);
}

export function scrollToSectionId(sectionId: string): boolean {
  const id = String(sectionId || '')
    .trim()
    .replace(/^#/, '');
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ block: 'start' });
  return true;
}

/**
 * Build a resilient formats deep link for emails/outbound CTAs.
 * Query survives hash stripping; hash still works for in-browser nav.
 */
export function buildFormatsSectionUrl(
  siteUrl: string,
  {
    clickToken,
    utmSource = 'email',
    utmMedium = 'sample_nurture',
    utmCampaign = 'continuity',
  }: {
    clickToken?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  } = {},
): string {
  const base = String(siteUrl || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set(SECTION_QUERY, 'formats');
  if (utmSource) params.set('utm_source', utmSource);
  if (utmMedium) params.set('utm_medium', utmMedium);
  if (utmCampaign) params.set('utm_campaign', utmCampaign);
  if (clickToken) params.set(CLICK_QUERY_PARAM, clickToken);
  return `${base}/?${params.toString()}#formats`;
}
