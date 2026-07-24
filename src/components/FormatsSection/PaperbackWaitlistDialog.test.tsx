import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaperbackWaitlistDialog } from './PaperbackWaitlistDialog';

vi.mock('../../lib/analytics', () => ({
  track: vi.fn(),
  getUtmProps: () => ({}),
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

describe('PaperbackWaitlistDialog', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          status: 'created',
          message: 'You have joined the paperback waitlist.',
        }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('masks PII fields for Clarity', () => {
    render(<PaperbackWaitlistDialog open onClose={() => {}} />);
    const masked = document.querySelectorAll('[data-clarity-mask="true"]');
    expect(masked.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('paperback-waitlist-form')).toBeTruthy();
    expect(screen.getByTestId('paperback-waitlist-modal')).toBeTruthy();
  });

  it('shows field validation errors without submitting', async () => {
    const user = userEvent.setup();
    render(<PaperbackWaitlistDialog open onClose={() => {}} />);

    await user.click(
      screen.getByRole('button', { name: /notify me/i }),
    );

    expect(await screen.findByText(/please enter your name/i)).toBeTruthy();
    expect(screen.getByText(/please enter a valid email/i)).toBeTruthy();
    expect(
      screen.getByText(/please accept the paperback notification consent/i),
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows success state after a successful registration', async () => {
    const user = userEvent.setup();
    render(<PaperbackWaitlistDialog open onClose={() => {}} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Pradeep Kumar');
    await user.type(
      screen.getByLabelText(/email address/i),
      'reader@example.com',
    );
    await user.click(
      screen.getByLabelText(/i agree to receive updates about the paperback/i),
    );
    await user.click(
      screen.getByRole('button', { name: /notify me/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('paperback-waitlist-success')).toBeTruthy();
    });
    expect(
      screen.getByTestId('paperback-waitlist-success').textContent,
    ).toMatch(/on the list/i);
  });

  it('preserves form values when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Unable to process' }),
      }),
    );

    const user = userEvent.setup();
    render(<PaperbackWaitlistDialog open onClose={() => {}} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Pradeep Kumar');
    await user.type(
      screen.getByLabelText(/email address/i),
      'reader@example.com',
    );
    await user.type(screen.getByLabelText(/city/i), 'Mysuru');
    await user.click(
      screen.getByLabelText(/i agree to receive updates about the paperback/i),
    );
    await user.click(
      screen.getByRole('button', { name: /notify me/i }),
    );

    expect(
      await screen.findByText(/could not add you to the waitlist/i),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^name$/i)).toHaveProperty(
      'value',
      'Pradeep Kumar',
    );
    expect(screen.getByLabelText(/email address/i)).toHaveProperty(
      'value',
      'reader@example.com',
    );
    expect(screen.getByLabelText(/city/i)).toHaveProperty('value', 'Mysuru');
  });
});
