import { FormEvent, useRef, useState } from 'react';
import { BookOpen, Check, Mail } from 'lucide-react';
import { track } from '../../lib/analytics';
import { isTurnstileConfigured } from '../../lib/turnstile';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import './SampleChapterSection.css';

const SAMPLE_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

export function SampleChapterSection() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
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
    const marketingConsent = data.get('marketingConsent') === 'on';

    track('sample_form_submit', { marketing_consent: marketingConsent });
    track('marketing_consent_toggle', {
      checked: marketingConsent,
      source: 'sample',
    });

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
          email: String(data.get('email')),
          marketingConsent,
          consentVersion: '2026-07-21',
          captchaToken: captchaToken || undefined,
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(payload.message || 'Unable to send the chapter preview');
      }

      form.reset();
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setStatus('success');
      setMessage('Check your inbox—the chapter preview is on its way.');
      track('sample_form_success', { marketing_consent: marketingConsent });
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
          ? 'The chapter preview service is not available yet. Please try again after it is configured.'
          : error instanceof Error
          ? error.message
          : 'Unable to send the chapter preview',
      );
      track('sample_form_error', {
        reason: isNetworkError ? 'network' : 'api',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="chapter-preview"
      className="sample-section"
      aria-labelledby="sample-heading"
    >
      <div className="sample-section__inner page-container">
        <div className="sample-card">
          <div className="sample-card__content">
            <SectionEyebrow className="sample-card__eyebrow">
              Free chapter preview
            </SectionEyebrow>
            <h2 id="sample-heading" className="sample-card__title">
              Preview the book before you decide
            </h2>
            <p className="sample-card__copy">
              Get the first two chapters of{' '}
              <em>Modern Java - The Mindset Shift</em> and experience its
              intent-first approach—not another feature list.
            </p>
            <ul
              className="sample-card__includes"
              aria-label="Chapter preview contents"
            >
              <li>
                <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                The first two chapters, complete
              </li>
              <li>
                <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                Diagrams included in those chapters
              </li>
            </ul>
          </div>

          <div className="sample-card__form-wrap">
            <span className="sample-card__book-icon" aria-hidden="true">
              <BookOpen size={30} strokeWidth={1.6} />
            </span>
            <form className="sample-form" onSubmit={handleSubmit}>
              <label htmlFor="sample-email">Email address</label>
              <div className="sample-form__controls">
                <span className="sample-form__input-wrap">
                  <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="sample-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
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
                  className={`button sample-form__submit${submitting ? ' button-progress' : ''}`}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? 'Sending…' : 'Get the preview'}
                </button>
              </div>

              <TurnstileWidget
                ref={turnstileRef}
                theme="dark"
                onTokenChange={setCaptchaToken}
              />

              <label className="sample-form__consent">
                <input type="checkbox" name="marketingConsent" />
                <span>
                  Send me occasional Modern Java articles, book updates, and
                  future releases.{' '}
                  <a href="/unsubscribe">Unsubscribe</a> anytime.
                </span>
              </label>

              <p className="sample-form__privacy">
                The chapter preview is sent whether or not you choose to receive
                updates.
              </p>

              <div
                className={`sample-form__status sample-form__status--${status}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
