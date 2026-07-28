import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, CreditCard, Minus, Plus, X } from 'lucide-react';
import {
  formatInrAmount,
  getAmountInr,
  paiseToInr,
} from '../../config/prices';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { track, trackPurchase, buildMetaAttributionPayload } from '../../lib/analytics';
import { loadRazorpayCheckout } from '../../lib/razorpay';
import { isTurnstileConfigured, shouldSkipCheckoutPayment } from '../../lib/turnstile';
import { CityInput } from '../shared/CityInput';
import {
  ModalStatusIcon,
  MODAL_ACTION_ICON_SIZE,
  MODAL_CLOSE_ICON_SIZE,
} from '../shared/ModalStatusIcon';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import './PaperbackOrderDialog.css';

interface PaperbackOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Formatting preview only — embeds dialog inline without portal/scroll lock. */
  embed?: boolean;
  /** Formatting preview only — force success confirmation UI. */
  previewState?: 'form' | 'success';
}

const PAPERBACK_PRICE = getAmountInr('paperback');
const PAPERBACK_PRICE_LABEL = formatInrAmount(PAPERBACK_PRICE);
const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');
const SKIP_CHECKOUT_PAYMENT = shouldSkipCheckoutPayment();
const TEST_ORDER_DEFAULTS = import.meta.env.DEV
  ? {
      name: 'Test Customer',
      email: 'admin@classpath.in',
      phone: '9999999999',
      address: '123 Test Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      notes: 'Dev mode test order',
    }
  : undefined;

const DELIVERY_STATES = [
  'Andhra Pradesh',
  'Delhi',
  'Gujarat',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Tamil Nadu',
  'Telangana',
] as const;

function RequiredLabel({ children }: { children: string }) {
  return (
    <span>
      {children}
      <span className="order-form__required" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </span>
  );
}

export function PaperbackOrderDialog({
  open,
  onClose,
  embed = false,
  previewState = 'form',
}: PaperbackOrderDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const completedRef = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const headingId = useId();
  const descriptionId = useId();
  useBodyScrollLock(open && !embed);
  const totalPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(quantity * PAPERBACK_PRICE);

  const requestClose = useCallback(() => {
    if (!completedRef.current) {
      track('checkout_abandon', { format: 'paperback' });
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setErrorMessage('');
    if (previewState === 'success') {
      setConfirmedOrderId('MJ-PREVIEW01');
      completedRef.current = true;
    } else {
      setConfirmedOrderId(null);
      completedRef.current = false;
    }
    setCaptchaToken(null);

    if (embed) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, requestClose, previewState, embed]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    setErrorMessage('');
    const data = new FormData(event.currentTarget);

    track('checkout_submit', {
      format: 'paperback',
      quantity,
    });

    if (!ORDER_API_URL) {
      setErrorMessage(
        'Payment is not configured yet. Set VITE_ORDER_API_URL after deploying the order API.',
      );
      setProcessing(false);
      track('checkout_fail', {
        format: 'paperback',
        reason: 'not_configured',
      });
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setErrorMessage('Please complete the captcha check before continuing.');
      setProcessing(false);
      track('checkout_fail', {
        format: 'paperback',
        reason: 'captcha_missing',
      });
      return;
    }

    const orderInput = {
      name: String(data.get('name')),
      email: String(data.get('email')),
      phone: String(data.get('phone')),
      quantity: Number(data.get('quantity')),
      address: String(data.get('address')),
      city: String(data.get('city')),
      state: String(data.get('state')),
      postalCode: String(data.get('postalCode')),
      country: 'India',
      notes: String(data.get('notes') || ''),
      captchaToken: captchaToken || undefined,
    };

    try {
      const createResult = await fetch(`${ORDER_API_URL}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...orderInput,
          ...buildMetaAttributionPayload(),
        }),
      });
      const order = await createResult.json();

      if (!createResult.ok) {
        throw new Error(order.message || 'Unable to create the order');
      }

      if (order.skippedPayment) {
        setConfirmedOrderId(order.appOrderId);
        completedRef.current = true;
        trackPurchase({
          format: 'paperback',
          // Order amount is paise; Pixel/GA expect INR rupees.
          value: paiseToInr(
            order.amount ?? PAPERBACK_PRICE * orderInput.quantity * 100,
          ),
          transactionId: order.appOrderId,
          paymentMethod: 'bypass',
          quantity: orderInput.quantity,
        });
        setProcessing(false);
        return;
      }

      if (SKIP_CHECKOUT_PAYMENT) {
        throw new Error(
          'Dev checkout skip requires the APP_ENV=dev API (modern-java-dev).',
        );
      }

      await loadRazorpayCheckout();

      track('checkout_payment_start', {
        format: 'paperback',
        payment_method: 'razorpay',
        quantity: orderInput.quantity,
      });

      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId || order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Modern Java — Paperback',
        description: `Paperback edition × ${orderInput.quantity}`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: orderInput.name,
          email: orderInput.email,
          contact: `+91${orderInput.phone}`,
        },
        notes: { appOrderId: order.appOrderId },
        theme: { color: '#0b3f9f' },
        modal: {
          ondismiss: () => {
            track('checkout_fail', {
              format: 'paperback',
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
              format: 'paperback',
              // Order amount is paise; Pixel/GA expect INR rupees.
              value: paiseToInr(
                order.amount ?? PAPERBACK_PRICE * orderInput.quantity * 100,
              ),
              transactionId: verification.appOrderId,
              paymentMethod: 'razorpay',
              quantity: orderInput.quantity,
            });
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : 'Payment verification failed',
            );
            track('checkout_fail', {
              format: 'paperback',
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
          format: 'paperback',
          reason: 'payment_failed',
        });
        setProcessing(false);
      });

      razorpay.open();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start payment right now',
      );
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      track('checkout_fail', { format: 'paperback', reason: 'start_failed' });
      setProcessing(false);
    }
  };

  if (!open) return null;

  const dialog = (
    <div
      className={`order-dialog__backdrop${embed ? ' order-dialog__backdrop--embed' : ''}`}
      onMouseDown={(event) => {
        if (!embed && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        className="order-dialog"
        role="dialog"
        aria-modal={!embed}
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
      >
        <div className="order-dialog__header">
          <div>
            <p className="order-dialog__eyebrow">Paperback order</p>
            <h2 id={headingId} className="order-dialog__title">
              Enter your delivery details
            </h2>
            <p id={descriptionId} className="order-dialog__description">
              {SKIP_CHECKOUT_PAYMENT
                ? `${PAPERBACK_PRICE_LABEL} per copy. Dev mode — submit delivery details without Razorpay.`
                : `${PAPERBACK_PRICE_LABEL} per copy. Complete your delivery details and pay securely through Razorpay.`}
            </p>
          </div>
          <button
            type="button"
            className="order-dialog__close"
            onClick={requestClose}
            aria-label="Close order form"
          >
            <X size={MODAL_CLOSE_ICON_SIZE} strokeWidth={2} />
          </button>
        </div>

        {confirmedOrderId ? (
          <div className="order-dialog__success">
            <ModalStatusIcon icon={CheckCircle2} />
            <h3>Payment successful</h3>
            <p className="order-dialog__success-lead">
              Your paperback order
              {quantity > 1 ? ` (${quantity} copies)` : ''} is confirmed.
            </p>
            <p className="order-dialog__order-id">
              Order ID - <strong>{confirmedOrderId}</strong>
            </p>
            <p className="order-dialog__success-note">
              Confirmation details have been emailed to you.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
        <form className="order-form" onSubmit={handleSubmit}>
          <div className="order-form__grid">
            <label className="order-form__field">
              <RequiredLabel>Full name</RequiredLabel>
              <input
                name="name"
                autoComplete="name"
                defaultValue={TEST_ORDER_DEFAULTS?.name}
                required
                autoFocus
                onBlur={(event) => {
                  if (!event.currentTarget.value.trim()) {
                    track('form_field_abandon', {
                      form: 'paperback_checkout',
                      field: 'name',
                    });
                  }
                }}
              />
            </label>

            <label className="order-form__field">
              <RequiredLabel>Email</RequiredLabel>
              <input
                type="email"
                name="email"
                autoComplete="email"
                defaultValue={TEST_ORDER_DEFAULTS?.email}
                title="Enter a valid email address"
                required
                onBlur={(event) => {
                  if (!event.currentTarget.value.trim()) {
                    track('form_field_abandon', {
                      form: 'paperback_checkout',
                      field: 'email',
                    });
                  }
                }}
              />
            </label>

            <label className="order-form__field order-form__field--phone">
              <RequiredLabel>Phone number</RequiredLabel>
              <span className="order-form__phone">
                <span
                  className="order-form__phone-prefix"
                  aria-label="India country code plus 91"
                >
                  <span
                    className="order-form__india-flag"
                    aria-hidden="true"
                  />
                  <span>+91</span>
                </span>
                <input
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  defaultValue={TEST_ORDER_DEFAULTS?.phone}
                  title="Enter a 10-digit phone number"
                  aria-label="10-digit phone number"
                  required
                />
              </span>
            </label>

            <label className="order-form__field order-form__field--quantity">
              <RequiredLabel>Quantity</RequiredLabel>
              <span className="order-form__quantity">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  disabled={quantity === 1}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} strokeWidth={2} />
                </button>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  max="20"
                  value={quantity}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setQuantity(Math.min(20, Math.max(1, next || 1)));
                  }}
                  aria-label="Paperback quantity"
                  required
                />
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.min(20, current + 1))}
                  disabled={quantity === 20}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
              </span>
            </label>

            <label className="order-form__field order-form__field--price">
              <span>Total price</span>
              <input
                name="totalPrice"
                value={totalPrice}
                readOnly
                aria-readonly="true"
              />
            </label>

            {quantity > 4 ? (
              <p className="order-form__bulk-note" role="status">
                Eligible for discount — contact{' '}
                <a href="mailto:pradeep@classpath.in">pradeep@classpath.in</a>
              </p>
            ) : null}

            <label className="order-form__field order-form__field--full">
              <RequiredLabel>Street address</RequiredLabel>
              <textarea
                name="address"
                rows={2}
                autoComplete="street-address"
                defaultValue={TEST_ORDER_DEFAULTS?.address}
                required
              />
            </label>

            <label className="order-form__field">
              <RequiredLabel>City</RequiredLabel>
              <CityInput
                defaultValue={TEST_ORDER_DEFAULTS?.city}
                required
              />
            </label>

            <label className="order-form__field">
              <RequiredLabel>State</RequiredLabel>
              <select
                name="state"
                autoComplete="address-level1"
                defaultValue={TEST_ORDER_DEFAULTS?.state}
                required
              >
                <option value="">Select state</option>
                {DELIVERY_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label className="order-form__field">
              <RequiredLabel>Postal code</RequiredLabel>
              <input
                name="postalCode"
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[0-9]{6}"
                maxLength={6}
                defaultValue={TEST_ORDER_DEFAULTS?.postalCode}
                title="Enter a valid 6-digit Indian postal code"
                required
              />
            </label>

            <label className="order-form__field">
              <span>Country</span>
              <input
                name="country"
                value="India"
                readOnly
                aria-readonly="true"
              />
            </label>

            <label className="order-form__field order-form__field--full">
              <span>Notes (optional)</span>
              <textarea
                name="notes"
                rows={2}
                defaultValue={TEST_ORDER_DEFAULTS?.notes}
              />
            </label>
          </div>

          <TurnstileWidget
            ref={turnstileRef}
            theme="light"
            className="order-form__captcha"
            onTokenChange={setCaptchaToken}
          />

          {errorMessage ? (
            <p className="order-form__error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="order-form__actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={requestClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button button-primary${processing ? ' button-progress' : ''}`}
              disabled={processing}
              aria-busy={processing}
            >
              <CreditCard
                size={MODAL_ACTION_ICON_SIZE}
                strokeWidth={2}
                aria-hidden="true"
              />
              {processing
                ? SKIP_CHECKOUT_PAYMENT
                  ? 'Confirming order…'
                  : 'Starting payment…'
                : SKIP_CHECKOUT_PAYMENT
                  ? 'Confirm order (no payment)'
                  : 'Proceed to pay'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );

  if (embed) return dialog;
  return createPortal(dialog, document.body);
}
