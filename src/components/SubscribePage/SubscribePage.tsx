import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  MODERN_JAVA_CONSENT_VERSION,
  resolveSubscribeSource,
} from '../../config/consent';
import { assets } from '../../data/assets';
import { book } from '../../data/book';
import {
  buildMetaAttributionPayload,
  track,
  trackMarketingSubscribeConversion,
} from '../../lib/analytics';
import {
  CONSUMER_EMAIL_ALLOWLIST_MESSAGE,
  isAllowedSampleEmailDomain,
} from '../../lib/sampleEmailAllowlist';
import { isTurnstileConfigured } from '../../lib/turnstile';
import { Footer } from '../Footer/Footer';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import '../LegalPage/LegalPage.css';
import './SubscribePage.css';

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

type FormStatus = 'idle' | 'success' | 'error';

export function SubscribePage() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const subscribeSource = useMemo(() => {
    try {
      return resolveSubscribeSource(
        new URLSearchParams(window.location.search).get('source'),
      );
    } catch {
      return resolveSubscribeSource(null);
    }
  }, []);

  useEffect(() => {
    document.title = `Stay Updated | ${book.title}`;
    window.scrollTo(0, 0);
    track('marketing_opt_in_form', { source: subscribeSource });
    if (subscribeSource === 'preview-pdf') {
      track('marketing_opt_in_preview_pdf', { source: subscribeSource });
    }

    return () => {
      document.title = `${book.title} - ${book.subtitle}`;
    };
  }, [subscribeSource]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('idle');
    setMessage('');

    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') || '').trim();

    if (!isAllowedSampleEmailDomain(email)) {
      setStatus('error');
      setMessage(CONSUMER_EMAIL_ALLOWLIST_MESSAGE);
      setSubmitting(false);
      return;
    }

    if (!ORDER_API_URL) {
      setStatus('error');
      setMessage('Email signup is not configured yet. Please try again later.');
      setSubmitting(false);
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setStatus('error');
      setMessage('Please complete the captcha check before continuing.');
      setSubmitting(false);
      return;
    }

    try {
      const result = await fetch(`${ORDER_API_URL}/marketing-consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          marketingConsent: true,
          source: subscribeSource,
          consentVersion: MODERN_JAVA_CONSENT_VERSION,
          captchaToken: captchaToken || undefined,
          ...buildMetaAttributionPayload(),
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(
          payload.message || 'Unable to save your email preferences',
        );
      }

      form.reset();
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setStatus('success');
      setMessage(
        payload.message ||
          'You’re subscribed. We’ll send occasional practical Java insights and Modern Java updates.',
      );
      track('marketing_opt_in_success', {
        source: subscribeSource,
        registration_status: payload.status || payload.registration_status,
      });
      trackMarketingSubscribeConversion(
        `marketing:subscribe:${subscribeSource}:${payload.status || payload.registration_status || 'ok'}`,
        { source: subscribeSource },
      );
    } catch (error) {
      setStatus('error');
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save your email preferences',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="site-shell">
      <header className="legal-header">
        <div className="legal-header__inner page-container">
          <a href="/" aria-label="Modern Java home">
            <img
              src={assets.brand.logo}
              alt="Modern Java — The Mindset Shift"
              width={300}
              height={72}
              className="legal-header__logo"
            />
          </a>
          <a href="/" className="legal-header__back">
            Back to website
          </a>
        </div>
      </header>

      <main className="legal-page">
        <div className="legal-page__inner">
          <p className="legal-page__eyebrow">Classpath Reader List</p>
          <h1>Stay Updated</h1>
          <p className="legal-page__updated">
            Practical Java insights, Modern Java updates, and occasional
            announcements about new books.
          </p>

          <div className="legal-page__content subscribe-page__content">
            {status === 'success' ? (
              <div className="subscribe-success" role="status" aria-live="polite">
                <p className="subscribe-success__heading">You’re subscribed.</p>
                <p className="subscribe-success__copy">
                  We’ll send you occasional practical Java insights and Modern
                  Java updates.
                </p>
                {message ? (
                  <p className="subscribe-success__detail">{message}</p>
                ) : null}
              </div>
            ) : (
              <form className="subscribe-form" onSubmit={handleSubmit}>
                <label htmlFor="subscribe-email">Email</label>
                <input
                  id="subscribe-email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  autoFocus
                />

                <TurnstileWidget
                  ref={turnstileRef}
                  onTokenChange={setCaptchaToken}
                />

                <button
                  type="submit"
                  className={`button button-primary${submitting ? ' button-progress' : ''}`}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? 'Subscribing…' : 'Subscribe'}
                </button>

                <p className="subscribe-form__note">Unsubscribe anytime.</p>

                <p className="subscribe-form__privacy">
                  <a href="/privacy-policy">
                    See our Privacy Policy for how we use your information.
                  </a>
                </p>

                <div
                  className={`subscribe-form__status subscribe-form__status--${status}`}
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
