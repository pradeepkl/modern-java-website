import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAmountInr } from '../../config/prices';

const DIGITAL_PRICE = getAmountInr('digital');
const DIGITAL_PRICE_PAISE = DIGITAL_PRICE * 100;

const analyticsMocks = vi.hoisted(() => ({
  track: vi.fn(),
  trackMetaConversion: vi.fn(),
  trackPurchase: vi.fn(),
  buildMetaAttributionPayload: vi.fn(() => ({
    analyticsConsent: true,
    eventSourceUrl: 'https://example.com/',
  })),
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
  trackMetaConversion: analyticsMocks.trackMetaConversion,
  trackPurchase: analyticsMocks.trackPurchase,
  buildMetaAttributionPayload: analyticsMocks.buildMetaAttributionPayload,
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
            amount: DIGITAL_PRICE_PAISE,
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

  it('fires InitiateCheckout after order create and before Razorpay opens', async () => {
    const user = userEvent.setup();
    vi.resetModules();
    const { DigitalOrderDialog } = await loadDigitalOrderDialog();
    render(<DigitalOrderDialog open onClose={() => {}} />);

    await user.type(screen.getByPlaceholderText(/your full name/i), 'Pradeep Kumar');
    await user.type(screen.getByPlaceholderText(/you@example.com/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: /pay .* securely/i }));

    await waitFor(() => {
      expect(analyticsMocks.trackMetaConversion).toHaveBeenCalledWith(
        'initiate-checkout:order_123',
        'InitiateCheckout',
        {
          content_ids: ['modern_java_digital'],
          content_name: 'Modern Java PDF + ePub',
          content_type: 'product',
          value: DIGITAL_PRICE,
          currency: 'INR',
          num_items: 1,
        },
        { eventID: 'order_123' },
      );
    });

    expect(analyticsMocks.trackPurchase).not.toHaveBeenCalled();
  });

  it('does not fire InitiateCheckout when order creation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Unable to create the digital order' }),
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
      expect(analyticsMocks.track).toHaveBeenCalledWith('checkout_fail', {
        format: 'digital',
        reason: 'start_failed',
      });
    });

    expect(analyticsMocks.trackMetaConversion).not.toHaveBeenCalled();
    expect(analyticsMocks.trackPurchase).not.toHaveBeenCalled();
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

    expect(analyticsMocks.trackPurchase).not.toHaveBeenCalled();

    await razorpayOptions?.handler({
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'sig_123',
    });

    await waitFor(() => {
      expect(analyticsMocks.trackPurchase).toHaveBeenCalledWith({
        format: 'digital',
        value: DIGITAL_PRICE,
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
            amount: DIGITAL_PRICE_PAISE,
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
