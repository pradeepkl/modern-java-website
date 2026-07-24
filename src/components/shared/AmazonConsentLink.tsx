import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Mail, X } from 'lucide-react';
import {
  AMAZON_EXIT_CONSENT_TYPE,
  AMAZON_EXIT_CONSENT_VERSION,
  AMAZON_EXIT_MODAL_SOURCE,
  AMAZON_EXIT_MODAL_SOURCE_VERSION,
  amazonExitModalCopy,
} from '../../data/amazonExitModalCopy';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { getUtmProps, track } from '../../lib/analytics';
import { isTurnstileConfigured } from '../../lib/turnstile';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from './TurnstileWidget';
import './AmazonConsentLink.css';

interface AmazonConsentLinkProps {
  href: string;
  className?: string;
  ariaLabel?: string;
  onIntent?: () => void;
  /** Non-PII analytics location for the Buy on Amazon control. */
  buttonLocation?: string;
  children: ReactNode;
  /** Formatting preview only. */
  preview?: {
    embed?: boolean;
    state?: 'form' | 'success' | 'already_registered';
  };
}

type SuccessStatus = 'created' | 'already_registered';

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

export function AmazonConsentLink({
  href,
  className,
  ariaLabel,
  onIntent,
  buttonLocation = 'unknown',
  children,
  preview,
}: AmazonConsentLinkProps) {
  const previewEmbed = Boolean(preview?.embed);
  const [open, setOpen] = useState(Boolean(preview));
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [successStatus, setSuccessStatus] = useState<SuccessStatus | null>(
    preview?.state === 'success'
      ? 'created'
      : preview?.state === 'already_registered'
        ? 'already_registered'
        : null,
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const exited = useRef(false);
  const submittingRef = useRef(false);
  const wasOpenRef = useRef(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const headingId = useId();
  const descriptionId = useId();
  const emailErrorId = useId();
  const turnstileErrorId = useId();
  useBodyScrollLock(open && !previewEmbed);
  submittingRef.current = submitting;

  const analyticsBase = {
    source: AMAZON_EXIT_MODAL_SOURCE,
    button_location: buttonLocation,
  };

  const closeModal = useCallback(() => {
    setOpen(false);
  }, []);

  const resetTransientState = useCallback(() => {
    setSubmitting(false);
    setErrorMessage('');
    setEmailError('');
    setTurnstileError(false);
    setSuccessStatus(null);
    setCaptchaToken(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (preview) {
      setSubmitting(false);
      setErrorMessage('');
      setEmailError('');
      setTurnstileError(false);
      setCaptchaToken(null);
      setSuccessStatus(
        preview.state === 'success'
          ? 'created'
          : preview.state === 'already_registered'
            ? 'already_registered'
            : null,
      );
      return undefined;
    }

    resetTransientState();
    exited.current = false;
    track('amazon_exit_modal_open', {
      source: AMAZON_EXIT_MODAL_SOURCE,
      button_location: buttonLocation,
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) closeModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeModal, resetTransientState, buttonLocation, preview]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusables = getFocusableElements(dialogRef.current);
    focusables[0]?.focus();
  }, [open, successStatus]);

  const continueToAmazon = (
    path: 'consent' | 'skip',
    eventName:
      | 'amazon_exit_continue_without_email'
      | 'amazon_exit_continue_after_signup',
  ) => {
    if (!exited.current) {
      exited.current = true;
      track(eventName, analyticsBase);
      track('amazon_exit', { path, ...analyticsBase });
    }
    window.location.assign(href);
  };

  const handleTurnstileError = (reason: 'load' | 'widget') => {
    setTurnstileError(true);
    track('amazon_exit_turnstile_error', {
      ...analyticsBase,
      error_type: reason,
    });
  };

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setErrorMessage('');
    setEmailError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError(amazonExitModalCopy.emailRequired);
      track('amazon_exit_email_error', {
        ...analyticsBase,
        error_type: 'validation',
      });
      return;
    }

    if (!ORDER_API_URL) {
      setErrorMessage(amazonExitModalCopy.apiUnavailable);
      track('amazon_exit_email_error', {
        ...analyticsBase,
        error_type: 'config',
      });
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setErrorMessage(
        turnstileError
          ? amazonExitModalCopy.turnstileError
          : amazonExitModalCopy.captchaRequired,
      );
      track('amazon_exit_email_error', {
        ...analyticsBase,
        error_type: turnstileError ? 'turnstile' : 'validation',
      });
      return;
    }

    setSubmitting(true);
    track('amazon_exit_email_submit', analyticsBase);

    const utm = getUtmProps();

    try {
      const result = await fetch(`${ORDER_API_URL}/marketing-consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          marketingConsent: true,
          consentVersion: AMAZON_EXIT_CONSENT_VERSION,
          consentType: AMAZON_EXIT_CONSENT_TYPE,
          source: AMAZON_EXIT_MODAL_SOURCE,
          sourceVersion: AMAZON_EXIT_MODAL_SOURCE_VERSION,
          landingPage:
            typeof window !== 'undefined' ? window.location.href : undefined,
          referrer:
            typeof document !== 'undefined'
              ? document.referrer || undefined
              : undefined,
          utmSource: utm.utm_source,
          utmMedium: utm.utm_medium,
          utmCampaign: utm.utm_campaign,
          captchaToken: captchaToken || undefined,
        }),
      });

      let payload: {
        success?: boolean;
        status?: string;
        message?: string;
      } = {};
      try {
        payload = await result.json();
      } catch {
        payload = {};
      }

      if (!result.ok) {
        throw new Error(payload.message || amazonExitModalCopy.apiError);
      }

      const registrationStatus: SuccessStatus =
        payload.status === 'already_registered'
          ? 'already_registered'
          : 'created';

      setSuccessStatus(registrationStatus);
      track('amazon_exit_email_success', {
        ...analyticsBase,
        registration_status: registrationStatus,
      });
      setSubmitting(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : amazonExitModalCopy.apiError,
      );
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      track('amazon_exit_email_error', {
        ...analyticsBase,
        error_type: 'server',
      });
      setSubmitting(false);
    }
  };

  return (
    <>
      {preview ? null : (
        <a
          ref={triggerRef}
          href={href}
          className={className}
          aria-label={ariaLabel}
          onClick={(event) => {
            event.preventDefault();
            onIntent?.();
            setOpen(true);
          }}
        >
          {children}
        </a>
      )}

      {open
        ? (() => {
            const modal = (
            <div
              className={`amazon-consent__backdrop${previewEmbed ? ' amazon-consent__backdrop--embed' : ''}`}
              onMouseDown={(event) => {
                if (
                  !previewEmbed &&
                  event.target === event.currentTarget &&
                  !submitting
                ) {
                  closeModal();
                }
              }}
            >
              <div
                ref={dialogRef}
                className="amazon-consent"
                role="dialog"
                aria-modal={!previewEmbed}
                aria-labelledby={headingId}
                aria-describedby={descriptionId}
                data-testid="amazon-exit-modal"
                onKeyDown={handleDialogKeyDown}
              >
                <button
                  type="button"
                  className="amazon-consent__close"
                  onClick={closeModal}
                  aria-label="Close"
                  disabled={submitting}
                >
                  <X size={20} strokeWidth={2} />
                </button>

                {successStatus ? (
                  <div
                    className="amazon-consent__success"
                    role="status"
                    aria-live="polite"
                    data-testid="amazon-exit-success"
                  >
                    <span className="amazon-consent__icon" aria-hidden="true">
                      <CheckCircle2 size={28} strokeWidth={1.75} />
                    </span>
                    <p className="amazon-consent__eyebrow">
                      {amazonExitModalCopy.eyebrow}
                    </p>
                    <h2 id={headingId}>{amazonExitModalCopy.successHeading}</h2>
                    <p
                      id={descriptionId}
                      className="amazon-consent__description"
                    >
                      {successStatus === 'already_registered'
                        ? amazonExitModalCopy.alreadyOnListMessage
                        : amazonExitModalCopy.successMessage}
                    </p>
                    <p className="amazon-consent__review-note amazon-consent__review-note--success">
                      {amazonExitModalCopy.successReviewNote}
                    </p>
                    <button
                      type="button"
                      className="button button-primary amazon-consent__submit"
                      data-testid="amazon-exit-continue-after-signup"
                      onClick={() =>
                        continueToAmazon(
                          'consent',
                          'amazon_exit_continue_after_signup',
                        )
                      }
                    >
                      {amazonExitModalCopy.continueToAmazonCta}
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="amazon-consent__icon" aria-hidden="true">
                      <Mail size={28} strokeWidth={1.75} />
                    </span>
                    <p className="amazon-consent__eyebrow">
                      {amazonExitModalCopy.eyebrow}
                    </p>
                    <h2 id={headingId}>{amazonExitModalCopy.heading}</h2>
                    <p
                      id={descriptionId}
                      className="amazon-consent__description"
                    >
                      {amazonExitModalCopy.description}
                    </p>
                    <ul className="amazon-consent__benefits">
                      {amazonExitModalCopy.benefits.map((benefit) => (
                        <li key={benefit}>{benefit}</li>
                      ))}
                    </ul>

                    <p className="amazon-consent__review-note">
                      {amazonExitModalCopy.reviewNote}
                    </p>

                    <form
                      onSubmit={handleSubmit}
                      data-testid="amazon-exit-form"
                      noValidate
                    >
                      <label htmlFor={`${headingId}-email`}>
                        {amazonExitModalCopy.emailLabel}
                      </label>
                      <input
                        id={`${headingId}-email`}
                        type="email"
                        name="email"
                        value={email}
                        placeholder={amazonExitModalCopy.emailPlaceholder}
                        autoComplete="email"
                        autoFocus
                        data-clarity-mask="true"
                        data-testid="amazon-exit-email"
                        aria-invalid={emailError ? true : undefined}
                        aria-describedby={
                          emailError ? emailErrorId : undefined
                        }
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (emailError) setEmailError('');
                        }}
                        onBlur={(event) => {
                          if (!event.currentTarget.value.trim()) {
                            track('form_field_abandon', {
                              form: AMAZON_EXIT_MODAL_SOURCE,
                              field: 'email',
                            });
                          }
                        }}
                      />
                      {emailError ? (
                        <p
                          id={emailErrorId}
                          className="amazon-consent__field-error"
                          role="alert"
                        >
                          {emailError}
                        </p>
                      ) : null}

                      <p className="amazon-consent__permission">
                        By joining, you agree to receive book updates, Java
                        articles, and occasional promotional offers from
                        Classpath. You can{' '}
                        <a href="/unsubscribe">unsubscribe</a> at any time.
                      </p>

                      <TurnstileWidget
                        ref={turnstileRef}
                        theme="light"
                        className="amazon-consent__captcha"
                        onTokenChange={(token) => {
                          setCaptchaToken(token);
                          if (token) setTurnstileError(false);
                        }}
                        onError={handleTurnstileError}
                      />

                      {turnstileError ? (
                        <p
                          id={turnstileErrorId}
                          className="amazon-consent__turnstile-error"
                          role="alert"
                        >
                          {amazonExitModalCopy.turnstileError}
                        </p>
                      ) : null}

                      {errorMessage ? (
                        <p className="amazon-consent__error" role="alert">
                          {errorMessage}
                        </p>
                      ) : null}

                      <button
                        type="submit"
                        className="button button-primary amazon-consent__submit"
                        disabled={submitting}
                        data-testid="amazon-exit-submit"
                      >
                        {submitting
                          ? amazonExitModalCopy.submittingCta
                          : amazonExitModalCopy.primaryCta}
                      </button>
                      <button
                        type="button"
                        className="amazon-consent__skip"
                        onClick={() =>
                          continueToAmazon(
                            'skip',
                            'amazon_exit_continue_without_email',
                          )
                        }
                        disabled={submitting}
                        data-testid="amazon-exit-skip"
                      >
                        {amazonExitModalCopy.secondaryCta}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
            );
            return previewEmbed ? modal : createPortal(modal, document.body);
          })()
        : null}
    </>
  );
}
