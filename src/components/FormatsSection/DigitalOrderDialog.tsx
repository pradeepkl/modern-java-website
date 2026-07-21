import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CreditCard, Download, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { loadRazorpayCheckout } from '../../lib/razorpay';
import './DigitalOrderDialog.css';

interface DigitalOrderDialogProps {
  open: boolean;
  onClose: () => void;
}

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

export function DigitalOrderDialog({
  open,
  onClose,
}: DigitalOrderDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setErrorMessage('');
    setProcessing(false);
    setConfirmedOrderId(null);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    setErrorMessage('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email'));
    const marketingConsent = data.get('marketingConsent') === 'on';

    if (!ORDER_API_URL) {
      setErrorMessage('Digital checkout is not configured yet.');
      setProcessing(false);
      return;
    }

    try {
      await loadRazorpayCheckout();
      const createResult = await fetch(`${ORDER_API_URL}/digital-orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          marketingConsent,
          consentVersion: '2026-07-21',
        }),
      });
      const order = await createResult.json();

      if (!createResult.ok) {
        throw new Error(order.message || 'Unable to create the digital order');
      }

      const razorpay = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Modern Java — Direct Download',
        description: 'Direct download: PDF + ePub bundle',
        order_id: order.razorpayOrderId,
        prefill: { email },
        notes: { appOrderId: order.appOrderId },
        theme: { color: '#0b3f9f' },
        modal: {
          ondismiss: () => setProcessing(false),
        },
        handler: async (payment) => {
          try {
            const verifyResult = await fetch(
              `${ORDER_API_URL}/orders/verify`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  appOrderId: order.appOrderId,
                  razorpayOrderId: payment.razorpay_order_id,
                  razorpayPaymentId: payment.razorpay_payment_id,
                  razorpaySignature: payment.razorpay_signature,
                }),
              },
            );
            const verification = await verifyResult.json();

            if (!verifyResult.ok) {
              throw new Error(
                verification.message || 'Payment verification failed',
              );
            }

            setConfirmedOrderId(verification.appOrderId);
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'Payment verification failed',
            );
          } finally {
            setProcessing(false);
          }
        },
      });

      razorpay.on('payment.failed', (failure) => {
        setErrorMessage(
          failure.error?.description ||
            'Payment failed. No order has been confirmed.',
        );
        setProcessing(false);
      });

      razorpay.open();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start digital checkout',
      );
      setProcessing(false);
    }
  };

  return createPortal(
    <div
      className="order-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="order-dialog digital-order-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <div className="order-dialog__header">
          <div>
            <p className="order-dialog__eyebrow">Direct digital edition</p>
            <h2 id={headingId} className="order-dialog__title">
              Get the PDF + ePub bundle
            </h2>
            <p id={descriptionId} className="order-dialog__description">
              Pay ₹699 securely and receive both formats by email.
            </p>
          </div>
          <button
            type="button"
            className="order-dialog__close"
            onClick={onClose}
            aria-label="Close digital order form"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {confirmedOrderId ? (
          <div className="order-dialog__success digital-order__success">
            <CheckCircle2 size={34} strokeWidth={1.75} aria-hidden="true" />
            <h3>Payment confirmed</h3>
            <p>
              Your <strong>Modern Java direct download (PDF + ePub)</strong>{' '}
              order <strong>{confirmedOrderId}</strong> is complete. Secure
              download links have been emailed to you.
            </p>
            <button type="button" className="button button-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="digital-order-form" onSubmit={handleSubmit}>
            <ul className="digital-order__benefits">
              <li>
                <Download size={18} aria-hidden="true" />
                Secure links for PDF and ePub
              </li>
              <li>
                <CheckCircle2 size={18} aria-hidden="true" />
                Future revised editions included
              </li>
            </ul>

            <label className="digital-order__field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
            </label>

            <label className="digital-order__consent">
              <input type="checkbox" name="marketingConsent" />
              <span>
                Send me occasional book updates, Java articles, and promotional
                offers. Unsubscribe anytime.
              </span>
            </label>

            <p className="digital-order__notice">
              Purchase and revision emails are sent regardless of this optional
              preference.
            </p>

            {errorMessage ? (
              <p className="order-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="button button-primary digital-order__submit"
              disabled={processing}
            >
              <CreditCard size={18} strokeWidth={2} aria-hidden="true" />
              {processing ? 'Starting payment…' : 'Pay ₹699 securely'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
