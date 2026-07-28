import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
  trackPurchase: vi.fn(),
}));

let razorpayOptions:
  | {
      handler: (payment: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => void | Promise<void>;
      onDismiss?: () => void;
      paymentFailed?: (response: { error?: { description?: string } }) => void;
    }
  | null = null;

vi.mock('../../lib/analytics', () => ({
  track: analyticsMocks.track,
  trackPurchase: analyticsMocks.trackPurchase,
}));

vi.mock('../../lib/turnstile', () => ({
  isTurnstileConfigured: () => false,
  shouldSkipCheckoutPayment: () => false,
}));

vi.mock('../../lib/razorpay', () => ({
  loadRazorpayCheckout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../shared/TurnstileWidget', async () => {
  const React = await import('react');
  return {
    TurnstileWidget: React.forwardRef(function MockTurnstile() {
      return null;
    }),
  };
});

async function loadDigitalOrderDialog() {
  return import('./DigitalOrderDialog');
}

describe('DigitalOrderDialog purchase tracking', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ORDER_API_URL', 'https://api.example.com');
    vi.stubEnv('VITE_DIGITAL_CHECKOUT_BYPASS', 'false');
    vi.stubEnv('VITE_DIGITAL_CHECKOUT_BYPASS_SECRET', '');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            appOrderId: 'APP-123',
            razorpayOrderId: 'order_123',
            amount: 69900,
            currency: 'INR',
            razorpayKeyId: 'rzp_test_123',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            appOrderId: 'APP-123',
          }),
        }),
    );

    window.Razorpay = class MockRazorpay {
      constructor(options: {
        handler: (payment: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => void | Promise<void>;
        modal: { ondismiss: () => void };
      }) {
        razorpayOptions = {
          handler: options.handler,
          onDismiss: options.modal.ondismiss,
        };
      }

      on(
        event: 'payment.failed',
        handler: (response: { error?: { description?: string } }) => void,
      ) {
        if (event === 'payment.failed' && razorpayOptions) {
          razorpayOptions.paymentFailed = handler;
        }
      }

      open() {}
    } as typeof window.Razorpay;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    razorpayOptions = null;
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'Razorpay');
  });

  it('tracks purchase only after successful payment verification', async () => {
    const user = userEvent.setup();
    vi.resetModules();
    const { DigitalOrderDialog } = await loadDigitalOrderDialog();
    render(<DigitalOrderDialog open onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/your full name/i), 'Pradeep Kumar');
    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: /pay .* securely/i }));

    await waitFor(() => {
      expect(razorpayOptions).not.toBeNull();
    });

    await razorpayOptions?.handler({
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig_123',
    });

    await waitFor(() => {
      expect(analyticsMocks.trackPurchase).toHaveBeenCalledWith({
        format: 'digital',
        value: 699,
        transactionId: 'APP-123',
        paymentMethod: 'razorpay',
      });
    });
  });

  it('does not track purchase when verification fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            appOrderId: 'APP-123',
            razorpayOrderId: 'order_123',
            amount: 69900,
            currency: 'INR',
            razorpayKeyId: 'rzp_test_123',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            message: 'Payment verification failed',
          }),
        }),
    );

    const user = userEvent.setup();
    vi.resetModules();
    const { DigitalOrderDialog } = await loadDigitalOrderDialog();
    render(<DigitalOrderDialog open onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/your full name/i), 'Pradeep Kumar');
    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: /pay .* securely/i }));

    await waitFor(() => {
      expect(razorpayOptions).not.toBeNull();
    });

    await razorpayOptions?.handler({
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig_123',
    });

    await waitFor(() => {
      expect(analyticsMocks.track).toHaveBeenCalledWith('checkout_fail', {
        format: 'digital',
        reason: 'verification_failed',
      });
    });

    expect(analyticsMocks.trackPurchase).not.toHaveBeenCalled();
  });
});
