import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CreditCard, Download, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { track, trackPurchase } from '../../lib/analytics';
import { loadRazorpayCheckout } from '../../lib/razorpay';
import { isTurnstileConfigured } from '../../lib/turnstile';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import './DigitalOrderDialog.css';

interface DigitalOrderDialogProps {
  open: boolean;
  onClose: () => void;
}

interface DigitalDownloads {
  pdfUrl: string;
  epubUrl: string | null;
}

const DIGITAL_PRICE = 699;
const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');
const DIGITAL_CHECKOUT_BYPASS =
  import.meta.env.DEV &&
  import.meta.env.VITE_DIGITAL_CHECKOUT_BYPASS === 'true' &&
  Boolean(import.meta.env.VITE_DIGITAL_CHECKOUT_BYPASS_SECRET);

export function DigitalOrderDialog({
  open,
  onClose,
}: DigitalOrderDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<DigitalDownloads | null>(null);
  const [usedBypass, setUsedBypass] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const completedRef = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const headingId = useId();
  const descriptionId = useId();
  useBodyScrollLock(open);

  const requestClose = useCallback(() => {
    if (!completedRef.current) {
      track('checkout_abandon', { format: 'digital' });
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setErrorMessage('');
    setProcessing(false);
    setConfirmedOrderId(null);
    setDownloads(null);
    setUsedBypass(false);
    setCaptchaToken(null);
    completedRef.current = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    setErrorMessage('');
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const marketingConsent = data.get('marketingConsent') === 'on';
    const customerPayload = {
      name,
      email,
      marketingConsent,
      consentVersion: '2026-07-21',
      captchaToken: captchaToken || undefined,
    };

    track('checkout_submit', {
      format: 'digital',
      marketing_consent: marketingConsent,
    });
    track('marketing_consent_toggle', {
      checked: marketingConsent,
      source: 'digital_checkout',
    });

    if (!ORDER_API_URL) {
      setErrorMessage('Digital checkout is not configured yet.');
      setProcessing(false);
      track('checkout_fail', { format: 'digital', reason: 'not_configured' });
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setErrorMessage('Please complete the captcha check before continuing.');
      setProcessing(false);
      track('checkout_fail', { format: 'digital', reason: 'captcha_missing' });
      return;
    }

    try {
      if (DIGITAL_CHECKOUT_BYPASS) {
        const bypassResult = await fetch(`${ORDER_API_URL}/digital-orders`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-digital-bypass-secret': String(
              import.meta.env.VITE_DIGITAL_CHECKOUT_BYPASS_SECRET,
            ),
          },
          body: JSON.stringify({
            ...customerPayload,
            skipPayment: true,
          }),
        });
        const bypassOrder = await bypassResult.json();

        if (!bypassResult.ok) {
          throw new Error(
            bypassOrder.message || 'Unable to complete the bypass checkout',
          );
        }

        setUsedBypass(true);
        setDownloads(bypassOrder.downloads ?? null);
        setConfirmedOrderId(bypassOrder.appOrderId);
        completedRef.current = true;
        trackPurchase({
          format: 'digital',
          value: DIGITAL_PRICE,
          transactionId: bypassOrder.appOrderId,
          paymentMethod: 'bypass',
        });
        setProcessing(false);
        return;
      }

      await loadRazorpayCheckout();
      const createResult = await fetch(`${ORDER_API_URL}/digital-orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(customerPayload),
      });
      const order = await createResult.json();

      if (!createResult.ok) {
        throw new Error(order.message || 'Unable to create the digital order');
      }

      track('checkout_payment_start', {
        format: 'digital',
        payment_method: 'razorpay',
      });

      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId || order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Modern Java — Direct Download',
        description: 'Direct download: PDF + ePub bundle',
        order_id: order.razorpayOrderId,
        prefill: { name, email },
        notes: { appOrderId: order.appOrderId },
        theme: { color: '#0b3f9f' },
        modal: {
          ondismiss: () => {
            track('checkout_fail', {
              format: 'digital',
              reason: 'payment_dismissed',
            });
            setProcessing(false);
          },
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
            completedRef.current = true;
            trackPurchase({
              format: 'digital',
              value: DIGITAL_PRICE,
              transactionId: verification.appOrderId,
              paymentMethod: 'razorpay',
            });
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'Payment verification failed',
            );
            track('checkout_fail', {
              format: 'digital',
              reason: 'verification_failed',
            });
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
        track('checkout_fail', {
          format: 'digital',
          reason: 'payment_failed',
        });
        setProcessing(false);
      });

      razorpay.open();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start digital checkout',
      );
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      track('checkout_fail', { format: 'digital', reason: 'start_failed' });
      setProcessing(false);
    }
  };

  return createPortal(
    <div
      className="order-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
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
              {DIGITAL_CHECKOUT_BYPASS
                ? 'Localhost bypass is on — submit an email to receive download links without Razorpay.'
                : 'Pay ₹699 securely and receive both formats by email.'}
            </p>
          </div>
          <button
            type="button"
            className="order-dialog__close"
            onClick={requestClose}
            aria-label="Close digital order form"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {confirmedOrderId ? (
          <div className="order-dialog__success digital-order__success">
            <CheckCircle2 size={34} strokeWidth={1.75} aria-hidden="true" />
            <h3>{usedBypass ? 'Delivery ready' : 'Payment confirmed'}</h3>
            <p className="digital-order__success-lead">
              Your PDF + ePub bundle is ready.
            </p>
            <p className="digital-order__order-id">
              Order ID - <strong>{confirmedOrderId}</strong>
            </p>
            <p className="digital-order__success-note">
              Secure download links have been emailed to you.
            </p>
            {downloads ? (
              <div className="digital-order__download-links">
                <a
                  className="button button-primary"
                  href={downloads.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF
                </a>
                {downloads.epubUrl ? (
                  <a
                    className="button button-primary"
                    href={downloads.epubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download ePub
                  </a>
                ) : null}
              </div>
            ) : null}
            <button type="button" className="button button-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="digital-order-form" onSubmit={handleSubmit}>
            <ul className="digital-order__benefits">
              <li>
                <span className="digital-order__benefit-lines">
                  <span className="digital-order__benefit-line">
                    <Download size={18} aria-hidden="true" />
                    Secure links for PDF and ePub
                  </span>
                  <span className="digital-order__benefit-line">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Future revised editions included
                  </span>
                </span>
              </li>
            </ul>

            <label className="digital-order__field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                placeholder="Your full name"
                autoComplete="name"
                required
                autoFocus
                onBlur={(event) => {
                  if (!event.currentTarget.value.trim()) {
                    track('form_field_abandon', {
                      form: 'digital_checkout',
                      field: 'name',
                    });
                  }
                }}
              />
              <span className="digital-order__field-hint">
                This name will appear on your invoice.
              </span>
            </label>

            <label className="digital-order__field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                onBlur={(event) => {
                  if (!event.currentTarget.value.trim()) {
                    track('form_field_abandon', {
                      form: 'digital_checkout',
                      field: 'email',
                    });
                  }
                }}
              />
            </label>

            <TurnstileWidget
              ref={turnstileRef}
              theme="light"
              onTokenChange={setCaptchaToken}
            />

            <label className="digital-order__consent">
              <input type="checkbox" name="marketingConsent" />
              <span>
                Send me occasional book updates, Java articles, and promotional
                offers. <a href="/unsubscribe">Unsubscribe</a> anytime.
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
              {DIGITAL_CHECKOUT_BYPASS ? (
                <Download size={18} strokeWidth={2} aria-hidden="true" />
              ) : (
                <CreditCard size={18} strokeWidth={2} aria-hidden="true" />
              )}
              {processing
                ? DIGITAL_CHECKOUT_BYPASS
                  ? 'Sending downloads…'
                  : 'Starting payment…'
                : DIGITAL_CHECKOUT_BYPASS
                  ? 'Send download links (no payment)'
                  : 'Pay ₹699 securely'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
