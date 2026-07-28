import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SampleChapterSection } from './SampleChapterSection';

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
  trackMetaConversion: vi.fn(),
}));

vi.mock('../../lib/analytics', () => ({
  track: analyticsMocks.track,
  trackMetaConversion: analyticsMocks.trackMetaConversion,
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

describe('SampleChapterSection Meta lead tracking', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fires Lead after a successful sample request', async () => {
    const user = userEvent.setup();
    render(<SampleChapterSection />);

    await user.type(screen.getByLabelText(/email address/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_success', {
        marketing_consent: false,
      });
    });

    expect(analyticsMocks.trackMetaConversion).toHaveBeenCalledWith(
      'lead:sample-preview',
      'Lead',
      {
        content_name: 'sample_chapter',
        content_category: 'book_preview',
      },
    );
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

    await user.type(screen.getByLabelText(/email address/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: /get the preview/i }));

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('sample_form_error', {
        reason: 'api',
      });
    });

    expect(analyticsMocks.trackMetaConversion).not.toHaveBeenCalled();
  });
});
