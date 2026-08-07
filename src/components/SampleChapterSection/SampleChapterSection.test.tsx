import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODERN_JAVA_CONSENT_VERSION, PREVIEW_SUCCESS_SOURCE } from '../../config/consent';
import { SampleChapterSection } from './SampleChapterSection';

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
  trackMetaConversion: vi.fn(),
  trackMarketingSubscribeConversion: vi.fn(),
  buildMetaAttributionPayload: vi.fn(() => ({
    analyticsConsent: true,
    fbp: 'fb.1.1.1',
    eventSourceUrl: 'https://example.com/',
    clientUserAgent: 'TestAgent',
  })),
}));

vi.mock('../../lib/analytics', () => ({
  track: analyticsMocks.track,
  trackMetaConversion: analyticsMocks.trackMetaConversion,
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

describe('SampleChapterSection', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          accepted: true,
          sampleRequestId: 'SR-TEST1234',
          marketingConsent: false,
          message: 'Check your inbox—the chapter preview is on its way.',
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('defaults the marketing checkbox to unchecked', () => {
    render(<SampleChapterSection />);
    const checkbox = screen.getByRole('checkbox', {
      name: /send me practical java insights/i,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('submits marketingConsent false when unchecked and shows secondary opt-in', async () => {
    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const sampleCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => String(call[0]).includes('/sample-requests'),
    );
    expect(sampleCall).toBeTruthy();
    const body = JSON.parse(String(sampleCall![1].body));
    expect(body.consentVersion).toBe(MODERN_JAVA_CONSENT_VERSION);
    expect(body.marketingConsent).toBe(false);

    expect(
      await screen.findByText(/your preview is on its way/i),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /yes, keep me updated/i }),
    ).toBeTruthy();
    expect(analyticsMocks.trackMetaConversion).toHaveBeenCalledWith(
      'lead:sample-preview:SR-TEST1234',
      'Lead',
      {
        content_name: 'Modern Java Sample Chapter',
        content_category: 'Book sample',
      },
      { eventID: 'SR-TEST1234' },
    );
    expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_success', {
      marketing_consent: false,
    });
    expect(analyticsMocks.trackMarketingSubscribeConversion).not.toHaveBeenCalled();
  });

  it('includes marketingConsent true when checked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepted: true,
          sampleRequestId: 'SR-OPTIN1',
          marketingConsent: true,
        }),
      }),
    );

    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(
      screen.getByRole('checkbox', {
        name: /send me practical java insights/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith(
        'marketing_opt_in_preview_form',
        { source: 'sample-chapter-form' },
      );
    });

    const body = JSON.parse(
      String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body),
    );
    expect(body.marketingConsent).toBe(true);

    expect(
      await screen.findByText(/your preview is on its way/i),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /yes, keep me updated/i }),
    ).not.toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledWith('marketing_opt_in_success', {
      source: 'sample-chapter-form',
    });
    expect(analyticsMocks.trackMarketingSubscribeConversion).toHaveBeenCalled();
  });

  it('does not show secondary opt-in when stored marketingConsent is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accepted: true,
          sampleRequestId: 'SR-EXISTING',
          marketingConsent: true,
          message: 'Check your inbox.',
        }),
      }),
    );

    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    expect(
      await screen.findByText(/your preview is on its way/i),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /yes, keep me updated/i }),
    ).not.toBeTruthy();
  });

  it('records consent from Keep Me Updated without granting consent on Not now', async () => {
    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    expect(
      await screen.findByRole('button', { name: /yes, keep me updated/i }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /not now/i }));
    expect(
      screen.queryByRole('button', { name: /yes, keep me updated/i }),
    ).not.toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);

    // Fresh submit to get secondary invite again
    cleanup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/marketing-consents')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              status: 'created',
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            accepted: true,
            sampleRequestId: 'SR-TEST1234',
            marketingConsent: false,
          }),
        };
      }),
    );

    render(<SampleChapterSection />);
    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));
    await user.click(
      await screen.findByRole('button', { name: /yes, keep me updated/i }),
    );

    await waitFor(() => {
      const marketingCall = (
        fetch as unknown as ReturnType<typeof vi.fn>
      ).mock.calls.find((call) => String(call[0]).includes('/marketing-consents'));
      expect(marketingCall).toBeTruthy();
    });

    const marketingCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => String(call[0]).includes('/marketing-consents'),
    );
    expect(marketingCall).toBeTruthy();
    const marketingBody = JSON.parse(String(marketingCall![1].body));
    expect(marketingBody).toMatchObject({
      email: 'reader@gmail.com',
      marketingConsent: true,
      source: PREVIEW_SUCCESS_SOURCE,
      consentVersion: MODERN_JAVA_CONSENT_VERSION,
    });

    expect(analyticsMocks.track).toHaveBeenCalledWith(
      'marketing_opt_in_success_screen',
      { source: PREVIEW_SUCCESS_SOURCE },
    );
    expect(analyticsMocks.track).toHaveBeenCalledWith('marketing_opt_in_success', {
      source: PREVIEW_SUCCESS_SOURCE,
      registration_status: 'created',
    });
    expect(
      await screen.findByText(/you.?re subscribed/i),
    ).toBeTruthy();
  });

  it('fires Lead after a successful sample request', async () => {
    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_success', {
        marketing_consent: false,
      });
    });

    expect(analyticsMocks.trackMetaConversion).toHaveBeenCalledWith(
      'lead:sample-preview:SR-TEST1234',
      'Lead',
      {
        content_name: 'Modern Java Sample Chapter',
        content_category: 'Book sample',
      },
      { eventID: 'SR-TEST1234' },
    );
  });

  it('does not fire Lead on cooldown / non-accepted responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'The chapter preview was sent recently. Please check your inbox.',
          accepted: false,
          sampleRequestId: 'SR-OLD',
          marketingConsent: false,
        }),
      }),
    );

    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_success', {
        marketing_consent: false,
      });
    });

    expect(analyticsMocks.trackMetaConversion).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: /yes, keep me updated/i }),
    ).toBeTruthy();
  });

  it('does not fire Lead when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Unable to send the chapter preview' }),
      }),
    );

    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_error', {
        reason: 'api',
      });
    });

    expect(analyticsMocks.trackMetaConversion).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /yes, keep me updated/i }),
    ).not.toBeTruthy();
  });

  it('rejects non-allowlisted email domains before calling the API', async () => {
    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'x@davopa.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_error', {
        reason: 'email_domain',
      });
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/Gmail/i);
    expect(analyticsMocks.trackMetaConversion).not.toHaveBeenCalled();
  });

  it('keeps preview success when secondary opt-in fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/marketing-consents')) {
          return {
            ok: false,
            json: async () => ({ message: 'Unable to save' }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            accepted: true,
            sampleRequestId: 'SR-TEST1234',
            marketingConsent: false,
          }),
        };
      }),
    );

    render(<SampleChapterSection />);
    await user.type(screen.getByLabelText(/email address/i), 'reader@gmail.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));
    await user.click(
      await screen.findByRole('button', { name: /yes, keep me updated/i }),
    );

    expect(
      await screen.findByText(/your preview is still on its way/i),
    ).toBeTruthy();
    expect(screen.getByText(/your preview is on its way/i)).toBeTruthy();
  });
});
