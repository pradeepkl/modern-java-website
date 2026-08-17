import { FormEvent, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { MODERN_JAVA_CONSENT_VERSION } from '../../config/consent';
import {
  buildMetaAttributionPayload,
  track,
  trackMarketingSubscribeConversion,
  trackMetaConversion,
} from '../../lib/analytics';
import {
  SAMPLE_EMAIL_ALLOWLIST_MESSAGE,
  isAllowedSampleEmailDomain,
} from '../../lib/sampleEmailAllowlist';
import { isTurnstileConfigured } from '../../lib/turnstile';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import './PreviewChapterLead.css';

const SAMPLE_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

type FormStatus = 'idle' | 'success' | 'error';

export function PreviewChapterLead() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const formStarted = useRef(false);
  const emailTouchedEmpty = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('idle');
    setMessage('');

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const marketingConsent = data.get('marketingConsent') === 'on';

    track('sample_form_submit', { marketing_consent: marketingConsent });
    track('marketing_consent_toggle', {
      checked: marketingConsent,
      source: 'sample',
    });
    if (marketingConsent) {
      track('marketing_opt_in_preview_form', { source: 'formats-preview-lead' });
    }

    if (!isAllowedSampleEmailDomain(email)) {
      setStatus('error');
      setMessage(SAMPLE_EMAIL_ALLOWLIST_MESSAGE);
      setSubmitting(false);
      track('sample_form_error', { reason: 'email_domain' });
      return;
    }

    if (!SAMPLE_API_URL) {
      setStatus('error');
      setMessage(
        'Chapter preview delivery is not configured yet. Please try again later.',
      );
      setSubmitting(false);
      track('sample_form_error', { reason: 'not_configured' });
      return;
    }

    if (isTurnstileConfigured() && !captchaToken) {
      setStatus('error');
      setMessage('Please complete the captcha check before continuing.');
      setSubmitting(false);
      track('sample_form_error', { reason: 'captcha_missing' });
      return;
    }

    try {
      const result = await fetch(`${SAMPLE_API_URL}/sample-requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          marketingConsent,
          consentVersion: MODERN_JAVA_CONSENT_VERSION,
          captchaToken: captchaToken || undefined,
          ...buildMetaAttributionPayload(),
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(payload.message || 'Unable to send the chapter preview');
      }

      form.reset();
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      const resolvedRequestId =
        typeof payload.sampleRequestId === 'string'
          ? payload.sampleRequestId.trim()
          : '';
      setStatus('success');
      setMessage(
        typeof payload.message === 'string' ? payload.message.trim() : '',
      );
      track('sample_form_success', { marketing_consent: marketingConsent });

      if (
        payload.accepted === true &&
        payload.newLead === true &&
        resolvedRequestId
      ) {
        trackMetaConversion(
          `lead:sample-preview:${resolvedRequestId}`,
          'Lead',
          {
            content_name: 'Modern Java Sample Chapter',
            content_category: 'Book sample',
          },
          { eventID: resolvedRequestId },
        );
      }

      if (marketingConsent && payload.marketingConsent === true) {
        track('marketing_opt_in_success', {
          source: 'formats-preview-lead',
        });
      }
      if (payload.newMarketingSubscriber === true) {
        trackMarketingSubscribeConversion(
          `marketing:sample-form:${resolvedRequestId || 'unknown'}`,
          { source: 'formats-preview-lead' },
        );
      }
    } catch (error) {
      setStatus('error');
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          /load failed|failed to fetch|network/i.test(error.message));
      setMessage(
        isNetworkError
          ? 'We couldn\'t send your preview right now. Please try again.'
          : error instanceof Error
            ? error.message
            : 'We couldn\'t send your preview right now. Please try again.',
      );
      track('sample_form_error', {
        reason: isNetworkError ? 'network' : 'api',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="chapter-preview" className="preview-lead">
      {status === 'success' ? (
        <div className="preview-lead__success" role="status" aria-live="polite">
          <p className="preview-lead__heading">Your preview is on its way.</p>
          <p className="preview-lead__copy">
            Check your inbox for the Modern Java preview chapter.
          </p>
          {message &&
          !/preview is on its way|check your inbox/i.test(message) ? (
            <p className="preview-lead__detail">{message}</p>
          ) : null}
        </div>
      ) : (
        <form className="preview-lead__form" onSubmit={handleSubmit}>
          <h3 className="preview-lead__heading">
            Want to read a preview chapter before you buy?
          </h3>
          <p className="preview-lead__copy">
            If you&apos;d rather sample the writing first, enter your email and
            we&apos;ll send the preview chapter so you can decide with the book
            in front of you.
          </p>

          <label className="preview-lead__label" htmlFor="preview-lead-email">
            Email address
          </label>
          <div className="preview-lead__controls">
            <span className="preview-lead__input-wrap">
              <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
              <input
                id="preview-lead-email"
                type="email"
                name="email"
                placeholder="you@gmail.com"
                autoComplete="email"
                required
                onFocus={() => {
                  if (!formStarted.current) {
                    formStarted.current = true;
                    track('sample_form_start');
                  }
                }}
                onBlur={(event) => {
                  if (
                    !event.currentTarget.value.trim() &&
                    !emailTouchedEmpty.current
                  ) {
                    emailTouchedEmpty.current = true;
                    track('form_field_abandon', {
                      form: 'sample',
                      field: 'email',
                    });
                  }
                }}
              />
            </span>
            <button
              type="submit"
              className={`button button-secondary preview-lead__submit${submitting ? ' button-progress' : ''}`}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Sending…' : 'Send the preview'}
            </button>
          </div>

          <TurnstileWidget
            ref={turnstileRef}
            theme="light"
            onTokenChange={setCaptchaToken}
          />

          <div className="preview-lead__consent">
            <input
              type="checkbox"
              id="preview-marketingConsent"
              name="marketingConsent"
            />
            <label htmlFor="preview-marketingConsent">
              <span>
                Send me practical Java insights, Modern Java updates and
                occasional book offers.
              </span>
              <span className="preview-lead__consent-note">
                Unsubscribe anytime.
              </span>
            </label>
          </div>

          <p className="preview-lead__privacy">
            The chapter preview is sent whether or not you choose to receive
            updates. We don&apos;t spam. We aim to follow India&apos;s DPDP Act
            <a
              className="preview-lead__dpdp-mark"
              href="#dpdp-note"
              aria-label="Data handling note in the footer"
            >
              *
            </a>
            .{' '}
            <a href="/privacy-policy">
              See our Privacy Policy for how we use your information.
            </a>
          </p>

          <div
            className={`preview-lead__status preview-lead__status--${status}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        </form>
      )}
    </div>
  );
}
