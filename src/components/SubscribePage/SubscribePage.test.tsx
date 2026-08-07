import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MODERN_JAVA_CONSENT_VERSION,
  PREVIEW_PDF_SOURCE,
  WEBSITE_SUBSCRIBE_SOURCE,
} from '../../config/consent';
import { SubscribePage } from './SubscribePage';

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
  trackMarketingSubscribeConversion: vi.fn(),
  buildMetaAttributionPayload: vi.fn(() => ({
    analyticsConsent: true,
    eventSourceUrl: 'https://example.com/subscribe',
  })),
}));

vi.mock('../../lib/analytics', () => ({
  track: analyticsMocks.track,
  trackMarketingSubscribeConversion:
    analyticsMocks.trackMarketingSubscribeConversion,
  buildMetaAttributionPayload: analyticsMocks.buildMetaAttributionPayload,
}));

vi.mock('../../lib/turnstile', () => ({
  isTurnstileConfigured: () => false,
}));

vi.mock('../shared/TurnstileWidget', async () => {
  const React = await import('react');
  return {
    TurnstileWidget: React.forwardRef(function MockTurnstile() {
      return null;
    }),
  };
});

describe('SubscribePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    window.history.pushState({}, '', '/subscribe');
    window.scrollTo = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'created',
          message: 'You’re on the Classpath Reader List.',
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('submits explicit marketing consent with website-subscribe source', async () => {
    const user = userEvent.setup();
    render(<SubscribePage />);

    expect(screen.getByRole('heading', { name: /stay updated/i })).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledWith('marketing_opt_in_form', {
      source: WEBSITE_SUBSCRIBE_SOURCE,
    });

    await user.type(screen.getByLabelText(/^email$/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /^subscribe$/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const body = JSON.parse(
      String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body),
    );
    expect(body).toMatchObject({
      email: 'reader@gmail.com',
      marketingConsent: true,
      source: WEBSITE_SUBSCRIBE_SOURCE,
      consentVersion: MODERN_JAVA_CONSENT_VERSION,
    });
    expect(
      await screen.findByText(/you.?re subscribed/i),
    ).toBeTruthy();
    expect(analyticsMocks.trackMarketingSubscribeConversion).toHaveBeenCalled();
  });

  it('rejects non-allowlisted email domains before calling the API', async () => {
    const user = userEvent.setup();
    render(<SubscribePage />);

    await user.type(screen.getByLabelText(/^email$/i), 'x@davopa.com');
    await user.click(screen.getByRole('button', { name: /^subscribe$/i }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/Gmail/i);
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(analyticsMocks.trackMarketingSubscribeConversion).not.toHaveBeenCalled();
  });

  it('attributes preview-pdf source from the query string', async () => {
    window.history.pushState({}, '', '/subscribe?source=preview-pdf');
    const user = userEvent.setup();
    render(<SubscribePage />);

    expect(analyticsMocks.track).toHaveBeenCalledWith(
      'marketing_opt_in_preview_pdf',
      { source: PREVIEW_PDF_SOURCE },
    );

    await user.type(screen.getByLabelText(/^email$/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /^subscribe$/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const body = JSON.parse(
      String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body),
    );
    expect(body.source).toBe(PREVIEW_PDF_SOURCE);
  });
});
