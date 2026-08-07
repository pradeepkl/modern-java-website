import { FormEvent, useRef, useState } from 'react';
import { BookOpen, Check, Mail } from 'lucide-react';
import {
  MODERN_JAVA_CONSENT_VERSION,
  PREVIEW_SUCCESS_SOURCE,
} from '../../config/consent';
import {
  track,
  trackMetaConversion,
  trackMarketingSubscribeConversion,
  buildMetaAttributionPayload,
} from '../../lib/analytics';
import {
  SAMPLE_EMAIL_ALLOWLIST_MESSAGE,
  isAllowedSampleEmailDomain,
} from '../../lib/sampleEmailAllowlist';
import { isTurnstileConfigured } from '../../lib/turnstile';
import { SectionEyebrow } from '../shared/SectionEyebrow';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import './SampleChapterSection.css';

const SAMPLE_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

type FormStatus = 'idle' | 'success' | 'error';
type SecondaryStatus = 'invite' | 'subscribed' | 'dismissed' | 'error';

export function SampleChapterSection() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [sampleRequestId, setSampleRequestId] = useState('');
  const [storedMarketingConsent, setStoredMarketingConsent] = useState(false);
  const [secondaryStatus, setSecondaryStatus] =
    useState<SecondaryStatus>('invite');
  const [secondaryMessage, setSecondaryMessage] = useState('');
  const [secondarySubmitting, setSecondarySubmitting] = useState(false);
  const [secondaryCaptchaToken, setSecondaryCaptchaToken] = useState<
    string | null
  >(null);
  const formStarted = useRef(false);
  const emailTouchedEmpty = useRef(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const secondaryTurnstileRef = useRef<TurnstileWidgetHandle>(null);

  const resetSecondaryState = () => {
    setSecondaryStatus('invite');
    setSecondaryMessage('');
    setSecondarySubmitting(false);
    setSecondaryCaptchaToken(null);
    secondaryTurnstileRef.current?.reset();
  };

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
      track('marketing_opt_in_preview_form', { source: 'sample-chapter-form' });
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
      setSubmittedEmail(email);
      const resolvedRequestId =
        typeof payload.sampleRequestId === 'string'
          ? payload.sampleRequestId.trim()
          : '';
      setSampleRequestId(resolvedRequestId);
      const consentStored = payload.marketingConsent === true;
      setStoredMarketingConsent(consentStored);
      resetSecondaryState();
      setStatus('success');
      setMessage(
        typeof payload.message === 'string' ? payload.message.trim() : '',
      );
      track('sample_form_success', { marketing_consent: marketingConsent });

      // Fire browser Lead only for newly accepted sends; eventID matches CAPI.
      if (payload.accepted === true && resolvedRequestId) {
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

      if (marketingConsent && consentStored) {
        track('marketing_opt_in_success', {
          source: 'sample-chapter-form',
        });
        trackMarketingSubscribeConversion(
          `marketing:sample-form:${resolvedRequestId || 'unknown'}`,
          { source: 'sample-chapter-form' },
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

  const handleSecondaryOptIn = async () => {
    if (secondarySubmitting || !submittedEmail) return;

    if (!SAMPLE_API_URL) {
      setSecondaryStatus('error');
      setSecondaryMessage(
        'Your preview is still on its way. We couldn\'t save your email preferences. Please try again.',
      );
      return;
    }

    if (isTurnstileConfigured() && !secondaryCaptchaToken) {
      setSecondaryStatus('error');
      setSecondaryMessage('Please complete the captcha check before continuing.');
      return;
    }

    setSecondarySubmitting(true);
    setSecondaryMessage('');
    track('marketing_opt_in_success_screen', {
      source: PREVIEW_SUCCESS_SOURCE,
    });

    try {
      const result = await fetch(`${SAMPLE_API_URL}/marketing-consents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: submittedEmail,
          marketingConsent: true,
          source: PREVIEW_SUCCESS_SOURCE,
          consentVersion: MODERN_JAVA_CONSENT_VERSION,
          captchaToken: secondaryCaptchaToken || undefined,
          ...buildMetaAttributionPayload(),
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(
          payload.message || 'Unable to save your email preferences',
        );
      }

      setStoredMarketingConsent(true);
      setSecondaryStatus('subscribed');
      setSecondaryMessage('');
      track('marketing_opt_in_success', {
        source: PREVIEW_SUCCESS_SOURCE,
        registration_status: payload.status || payload.registration_status,
      });
      trackMarketingSubscribeConversion(
        `marketing:preview-success:${sampleRequestId || 'unknown'}`,
        { source: PREVIEW_SUCCESS_SOURCE },
      );
    } catch {
      setSecondaryStatus('error');
      setSecondaryCaptchaToken(null);
      secondaryTurnstileRef.current?.reset();
      setSecondaryMessage(
        'Your preview is still on its way. We couldn\'t save your email preferences. Please try again.',
      );
    } finally {
      setSecondarySubmitting(false);
    }
  };

  const handleNotNow = () => {
    setSecondaryStatus('dismissed');
    setSecondaryMessage('');
  };

  const showSecondaryInvite =
    status === 'success' &&
    !storedMarketingConsent &&
    (secondaryStatus === 'invite' || secondaryStatus === 'error');

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

            {status === 'success' ? (
              <div className="sample-success" role="status" aria-live="polite">
                <p className="sample-success__heading">
                  Your preview is on its way.
                </p>
                <p className="sample-success__copy">
                  Check your inbox for the Modern Java preview.
                </p>
                {message &&
                !/preview is on its way|check your inbox/i.test(message) ? (
                  <p className="sample-success__detail">{message}</p>
                ) : null}

                {showSecondaryInvite ? (
                  <div className="sample-success__opt-in">
                    <p className="sample-success__opt-heading">
                      Want to keep learning?
                    </p>
                    <p className="sample-success__opt-copy">
                      Get practical Java insights, new chapter updates and
                      occasional book announcements.
                    </p>
                    <p className="sample-success__opt-note">
                      No spam. Unsubscribe anytime.
                    </p>

                    <TurnstileWidget
                      ref={secondaryTurnstileRef}
                      theme="dark"
                      onTokenChange={setSecondaryCaptchaToken}
                    />

                    <div className="sample-success__actions">
                      <button
                        type="button"
                        className={`button sample-success__cta${secondarySubmitting ? ' button-progress' : ''}`}
                        disabled={secondarySubmitting}
                        aria-busy={secondarySubmitting}
                        onClick={handleSecondaryOptIn}
                      >
                        {secondarySubmitting
                          ? 'Saving…'
                          : 'Keep Me Updated'}
                      </button>
                      <button
                        type="button"
                        className="sample-success__dismiss"
                        disabled={secondarySubmitting}
                        onClick={handleNotNow}
                      >
                        Not now
                      </button>
                    </div>

                    {secondaryStatus === 'error' && secondaryMessage ? (
                      <p
                        className="sample-success__opt-error"
                        role="alert"
                      >
                        {secondaryMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {secondaryStatus === 'subscribed' ? (
                  <div className="sample-success__subscribed">
                    <p className="sample-success__opt-heading">
                      You’re subscribed.
                    </p>
                    <p className="sample-success__opt-copy">
                      We’ll occasionally send practical Java insights and Modern
                      Java updates.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <form className="sample-form" onSubmit={handleSubmit}>
                <label htmlFor="sample-email">Email address</label>
                <div className="sample-form__controls">
                  <span className="sample-form__input-wrap">
                    <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
                    <input
                      id="sample-email"
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

                <div className="sample-form__consent">
                  <input
                    type="checkbox"
                    id="marketingConsent"
                    name="marketingConsent"
                  />
                  <label htmlFor="marketingConsent">
                    <span>
                      Keep me updated with practical Java insights, new book
                      releases and occasional offers.
                    </span>
                    <span className="sample-form__consent-note">
                      Unsubscribe anytime.
                    </span>
                  </label>
                </div>

                <p className="sample-form__privacy">
                  The chapter preview is sent whether or not you choose to
                  receive updates.{' '}
                  <a href="/privacy-policy">
                    See our Privacy Policy for how we use your information.
                  </a>
                </p>

                <div
                  className={`sample-form__status sample-form__status--${status}`}
                  role="status"
                  aria-live="polite"
                >
                  {message}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
