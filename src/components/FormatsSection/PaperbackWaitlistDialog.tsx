import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { paperbackWaitlistCopy } from '../../data/paperbackWaitlistCopy';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { getUtmProps, track } from '../../lib/analytics';
import {
  hasWaitlistFieldErrors,
  normalizeWaitlistFormValues,
  validateWaitlistForm,
  type PaperbackWaitlistFieldErrors,
  type PaperbackWaitlistFormValues,
} from '../../lib/paperbackWaitlist';
import { isTurnstileConfigured } from '../../lib/turnstile';
import { CityInput } from '../shared/CityInput';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import './PaperbackOrderDialog.css';
import './PaperbackWaitlistDialog.css';


interface PaperbackWaitlistDialogProps {
  open: boolean;
  onClose: () => void;
}

type SuccessStatus = 'created' | 'already_registered';

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

const INITIAL_VALUES: PaperbackWaitlistFormValues = {
  name: '',
  email: '',
  city: '',
  paperbackConsent: false,
  promotionalConsent: false,
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

export function PaperbackWaitlistDialog({
  open,
  onClose,
}: PaperbackWaitlistDialogProps) {
  const [values, setValues] =
    useState<PaperbackWaitlistFormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] =
    useState<PaperbackWaitlistFieldErrors>({});
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successStatus, setSuccessStatus] = useState<SuccessStatus | null>(
    null,
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const nameErrorId = useId();
  const emailErrorId = useId();
  const consentErrorId = useId();
  useBodyScrollLock(open);

  const resetTransientState = useCallback(() => {
    setFieldErrors({});
    setProcessing(false);
    setErrorMessage('');
    setSuccessStatus(null);
    setCaptchaToken(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetTransientState();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, resetTransientState]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusables = getFocusableElements(dialogRef.current);
    focusables[0]?.focus();
  }, [open, successStatus]);

  if (!open) return null;

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusables = getFocusableElements(dialogRef.current);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateField = <K extends keyof PaperbackWaitlistFormValues>(
    key: K,
    value: PaperbackWaitlistFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (processing) return;

    const normalized = normalizeWaitlistFormValues(values);
    const errors = validateWaitlistForm(normalized);
    setFieldErrors(errors);
    setErrorMessage('');

    if (hasWaitlistFieldErrors(errors)) {
      track('paperback_waitlist_error', { error_type: 'validation' });
      return;
    }

    if (!ORDER_API_URL) {
      setErrorMessage(paperbackWaitlistCopy.serverError);
      track('paperback_waitlist_error', { error_type: 'server' });
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setErrorMessage('Please complete the captcha check before continuing.');
      track('paperback_waitlist_error', { error_type: 'validation' });
      return;
    }

    setProcessing(true);
    track('paperback_waitlist_submit');

    const utm = getUtmProps();
    const payload = {
      name: normalized.name,
      email: normalized.email,
      city: normalized.city || undefined,
      paperbackConsent: true,
      promotionalConsent: normalized.promotionalConsent,
      source: 'pricing_card',
      landingPage:
        typeof window !== 'undefined' ? window.location.href : undefined,
      referrer:
        typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      utmSource: utm.utm_source,
      utmMedium: utm.utm_medium,
      utmCampaign: utm.utm_campaign,
      utmContent: utm.utm_content,
      captchaToken: captchaToken || undefined,
    };

    try {
      const result = await fetch(`${ORDER_API_URL}/paperback-waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let body: {
        success?: boolean;
        status?: string;
        message?: string;
      } = {};
      try {
        body = await result.json();
      } catch {
        body = {};
      }

      if (!result.ok || body.success === false) {
        setErrorMessage(
          result.status >= 500
            ? paperbackWaitlistCopy.serverError
            : body.message || paperbackWaitlistCopy.serverError,
        );
        setCaptchaToken(null);
        turnstileRef.current?.reset();
        track('paperback_waitlist_error', {
          error_type: result.status >= 500 ? 'server' : 'validation',
        });
        setProcessing(false);
        return;
      }

      const registrationStatus: SuccessStatus =
        body.status === 'already_registered'
          ? 'already_registered'
          : 'created';

      setSuccessStatus(registrationStatus);
      track('paperback_waitlist_success', {
        registration_status: registrationStatus,
        source: 'pricing_card',
      });
      setProcessing(false);
    } catch {
      setErrorMessage(paperbackWaitlistCopy.serverError);
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      track('paperback_waitlist_error', { error_type: 'network' });
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
        ref={dialogRef}
        className="order-dialog paperback-waitlist-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        data-testid="paperback-waitlist-modal"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="order-dialog__header">
          <div>
            <p className="order-dialog__eyebrow">Paperback edition</p>
            <h2 id={headingId} className="order-dialog__title">
              {successStatus
                ? paperbackWaitlistCopy.successHeading
                : paperbackWaitlistCopy.modalTitle}
            </h2>
            <p id={descriptionId} className="order-dialog__description">
              {successStatus
                ? paperbackWaitlistCopy.successMessage
                : paperbackWaitlistCopy.modalDescription}
            </p>
          </div>
          <button
            type="button"
            className="order-dialog__close"
            onClick={onClose}
            aria-label="Close paperback waitlist form"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {successStatus ? (
          <div
            className="paperback-waitlist__success"
            role="status"
            aria-live="polite"
            data-testid="paperback-waitlist-success"
          >
            <CheckCircle2 size={34} strokeWidth={1.75} aria-hidden="true" />
            <h3>{paperbackWaitlistCopy.successHeading}</h3>
            <p>
              {successStatus === 'already_registered'
                ? paperbackWaitlistCopy.alreadyRegisteredMessage
                : paperbackWaitlistCopy.successMessage}
            </p>
            <p className="paperback-waitlist__success-secondary">
              {paperbackWaitlistCopy.successSecondary}
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
          <form
            className="paperback-waitlist-form"
            onSubmit={handleSubmit}
            noValidate
            data-testid="paperback-waitlist-form"
          >
            <label className="paperback-waitlist__field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                value={values.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                autoFocus
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? nameErrorId : undefined
                }
                data-clarity-mask="true"
              />
              {fieldErrors.name ? (
                <span id={nameErrorId} className="paperback-waitlist__field-error" role="alert">
                  {fieldErrors.name}
                </span>
              ) : null}
            </label>

            <label className="paperback-waitlist__field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                value={values.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={
                  fieldErrors.email ? emailErrorId : undefined
                }
                data-clarity-mask="true"
              />
              {fieldErrors.email ? (
                <span id={emailErrorId} className="paperback-waitlist__field-error" role="alert">
                  {fieldErrors.email}
                </span>
              ) : null}
            </label>

            <label className="paperback-waitlist__field">
              <span>
                City <span className="paperback-waitlist__optional">(optional)</span>
              </span>
              <CityInput
                value={values.city}
                onChange={(event) => updateField('city', event.target.value)}
                data-clarity-mask="true"
              />
            </label>

            <TurnstileWidget
              ref={turnstileRef}
              theme="light"
              onTokenChange={setCaptchaToken}
            />

            <label className="paperback-waitlist__consent">
              <input
                type="checkbox"
                name="paperbackConsent"
                checked={values.paperbackConsent}
                onChange={(event) =>
                  updateField('paperbackConsent', event.target.checked)
                }
                aria-invalid={Boolean(fieldErrors.paperbackConsent)}
                aria-describedby={
                  fieldErrors.paperbackConsent ? consentErrorId : undefined
                }
                data-clarity-mask="true"
              />
              <span>{paperbackWaitlistCopy.consentLabel}</span>
            </label>
            {fieldErrors.paperbackConsent ? (
              <span
                id={consentErrorId}
                className="paperback-waitlist__field-error"
                role="alert"
              >
                {fieldErrors.paperbackConsent}
              </span>
            ) : null}

            <label className="paperback-waitlist__consent">
              <input
                type="checkbox"
                name="promotionalConsent"
                checked={values.promotionalConsent}
                onChange={(event) =>
                  updateField('promotionalConsent', event.target.checked)
                }
                data-clarity-mask="true"
              />
              <span>{paperbackWaitlistCopy.promotionalConsentLabel}</span>
            </label>

            <p className="paperback-waitlist__disclaimer">
              {paperbackWaitlistCopy.disclaimer}
            </p>

            {errorMessage ? (
              <p className="order-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              className="button button-primary paperback-waitlist__submit"
              disabled={processing}
            >
              <Bell size={18} strokeWidth={2} aria-hidden="true" />
              {processing
                ? paperbackWaitlistCopy.submitting
                : paperbackWaitlistCopy.submit}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
