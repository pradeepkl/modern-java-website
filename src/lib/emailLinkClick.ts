/** Query param carrying a signed email CTA click token (no raw email). */
export const CLICK_QUERY_PARAM = 'mj_click';

const CLICK_RECORDED_PREFIX = 'mj_email_click_recorded:';

export function readEmailClickToken(
  search = typeof window !== 'undefined' ? window.location.search : '',
): string {
  try {
    return String(new URLSearchParams(search).get(CLICK_QUERY_PARAM) || '').trim();
  } catch {
    return '';
  }
}

/** Strip mj_click from the URL after capture; keep section + UTMs. */
export function clearEmailClickTokenFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CLICK_QUERY_PARAM)) return;
    url.searchParams.delete(CLICK_QUERY_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', next || '/');
  } catch {
    /* ignore */
  }
}

/**
 * POST the signed click token to the Order API so SAMPLE_REQUESTS_TABLE
 * records engagement for the email sequence. Fire-and-forget; once per token.
 */
export function reportEmailLinkClick(token = readEmailClickToken()): void {
  if (typeof window === 'undefined') return;
  const value = String(token || '').trim();
  if (!value) return;

  const apiBase = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');
  if (!apiBase) return;

  try {
    const guardKey = `${CLICK_RECORDED_PREFIX}${value.slice(0, 48)}`;
    if (sessionStorage.getItem(guardKey) === '1') {
      clearEmailClickTokenFromUrl();
      return;
    }
    sessionStorage.setItem(guardKey, '1');
  } catch {
    /* private mode — still attempt once */
  }

  try {
    void fetch(`${apiBase}/email-link-clicks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: value }),
      keepalive: true,
      mode: 'cors',
    }).catch(() => {
      /* never block landing */
    });
  } catch {
    /* ignore */
  }

  clearEmailClickTokenFromUrl();
}
