import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Mail, X } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { track } from '../../lib/analytics';
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
  children: ReactNode;
}

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

export function AmazonConsentLink({
  href,
  className,
  ariaLabel,
  onIntent,
  children,
}: AmazonConsentLinkProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const exited = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const headingId = useId();
  const descriptionId = useId();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setErrorMessage('');
    setCaptchaToken(null);
    track('amazon_consent_shown');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const continueToAmazon = (path: 'consent' | 'skip') => {
    if (!exited.current) {
      exited.current = true;
      track('amazon_exit', { path });
    }
    window.location.assign(href);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    const data = new FormData(event.currentTarget);

    track('amazon_consent_submit');

    if (!ORDER_API_URL) {
      setErrorMessage(
        'Email signup is unavailable right now. You can still continue to Amazon.',
      );
      setSubmitting(false);
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setErrorMessage('Please complete the captcha check before continuing.');
      setSubmitting(false);
      return;
    }

    try {
      const result = await fetch(`${ORDER_API_URL}/marketing-consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email')),
          marketingConsent: true,
          consentVersion: '2026-07-22',
          captchaToken: captchaToken || undefined,
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(payload.message || 'Unable to save your email');
      }

      continueToAmazon('consent');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your email. You can still continue to Amazon.',
      );
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setSubmitting(false);
    }
  };

  return (
    <>
      <a
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

      {open
        ? createPortal(
            <div
              className="amazon-consent__backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="amazon-consent"
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                aria-describedby={descriptionId}
              >
                <button
                  type="button"
                  className="amazon-consent__close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X size={20} strokeWidth={2} />
                </button>

                <span className="amazon-consent__icon" aria-hidden="true">
                  <Mail size={28} strokeWidth={1.75} />
                </span>
                <p className="amazon-consent__eyebrow">Before you visit Amazon</p>
                <h2 id={headingId}>Stay updated on Modern Java</h2>
                <p id={descriptionId} className="amazon-consent__description">
                  Optionally share your email to receive:
                </p>
                <ul className="amazon-consent__benefits">
                  <li>Notifications about upcoming books</li>
                  <li>Promotional offers and launch discounts</li>
                  <li>Modern Java updates and new Java articles</li>
                </ul>

                <form onSubmit={handleSubmit}>
                  <label htmlFor={`${headingId}-email`}>Email address</label>
                  <input
                    id={`${headingId}-email`}
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    autoFocus
                    onBlur={(event) => {
                      if (!event.currentTarget.value.trim()) {
                        track('form_field_abandon', {
                          form: 'amazon_consent',
                          field: 'email',
                        });
                      }
                    }}
                  />
                  <p className="amazon-consent__permission">
                    By sharing your email, you agree to receive promotional
                    updates. You can{' '}
                    <a href="/unsubscribe">unsubscribe</a> anytime.
                  </p>

                  <TurnstileWidget
                    ref={turnstileRef}
                    theme="light"
                    className="amazon-consent__captcha"
                    onTokenChange={setCaptchaToken}
                  />

                  {errorMessage ? (
                    <p className="amazon-consent__error" role="alert">
                      {errorMessage}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="button button-primary amazon-consent__submit"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving…' : 'Share email and continue'}
                  </button>
                  <button
                    type="button"
                    className="amazon-consent__skip"
                    onClick={() => continueToAmazon('skip')}
                    disabled={submitting}
                  >
                    Continue without sharing
                  </button>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
