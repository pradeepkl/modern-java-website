import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLICK_QUERY_PARAM,
  clearEmailClickTokenFromUrl,
  readEmailClickToken,
  reportEmailLinkClick,
} from './emailLinkClick';

describe('emailLinkClick', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    sessionStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads mj_click from the query string', () => {
    window.history.replaceState({}, '', '/?section=formats&mj_click=tok.en#formats');
    expect(readEmailClickToken()).toBe('tok.en');
    expect(CLICK_QUERY_PARAM).toBe('mj_click');
  });

  it('posts the token once and strips it from the URL', async () => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    window.history.replaceState(
      {},
      '',
      '/?section=formats&utm_campaign=continuity&mj_click=signed.token#formats',
    );

    reportEmailLinkClick();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/email-link-clicks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'signed.token',
          userAgent: navigator.userAgent,
        }),
      }),
    );
    expect(window.location.search).not.toContain('mj_click=');
    expect(window.location.search).toContain('section=formats');

    reportEmailLinkClick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clearEmailClickTokenFromUrl keeps other params', () => {
    window.history.replaceState(
      {},
      '',
      '/?section=formats&mj_click=x.y&utm_source=email#formats',
    );
    clearEmailClickTokenFromUrl();
    expect(window.location.href).toContain('section=formats');
    expect(window.location.href).toContain('utm_source=email');
    expect(window.location.href).not.toContain('mj_click=');
  });
});
