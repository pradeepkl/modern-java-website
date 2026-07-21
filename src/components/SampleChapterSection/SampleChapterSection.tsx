import { FormEvent, useState } from 'react';
import { BookOpen, Check, Mail } from 'lucide-react';
import './SampleChapterSection.css';

const SAMPLE_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

export function SampleChapterSection() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('idle');
    setMessage('');

    const form = event.currentTarget;
    const data = new FormData(form);

    if (!SAMPLE_API_URL) {
      setStatus('error');
      setMessage('Sample delivery is not configured yet. Please try again later.');
      setSubmitting(false);
      return;
    }

    try {
      const result = await fetch(`${SAMPLE_API_URL}/sample-requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email')),
          marketingConsent: data.get('marketingConsent') === 'on',
          consentVersion: '2026-07-21',
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(payload.message || 'Unable to send the sample chapter');
      }

      form.reset();
      setStatus('success');
      setMessage('Check your inbox—the sample chapter is on its way.');
    } catch (error) {
      setStatus('error');
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error &&
          /load failed|failed to fetch|network/i.test(error.message));
      setMessage(
        isNetworkError
          ? 'The sample service is not available yet. Please try again after it is configured.'
          : error instanceof Error
          ? error.message
          : 'Unable to send the sample chapter',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="sample-chapter"
      className="sample-section"
      aria-labelledby="sample-heading"
    >
      <div className="sample-section__inner page-container">
        <div className="sample-card">
          <div className="sample-card__content">
            <p className="sample-card__eyebrow">Free sample chapter</p>
            <h2 id="sample-heading" className="sample-card__title">
              Read a chapter before you decide
            </h2>
            <p className="sample-card__copy">
              Get a complete sample from <em>Modern Java: The Mindset Shift</em>{' '}
              and experience its intent-first approach—not another feature
              list.
            </p>
            <ul className="sample-card__includes" aria-label="Sample contents">
              <li>
                <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                Preface and complete table of contents
              </li>
              <li>
                <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                Full Chapter 1 with selected diagrams
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
                  />
                </span>
                <button
                  type="submit"
                  className="button sample-form__submit"
                  disabled={submitting}
                >
                  {submitting ? 'Sending…' : 'Send me the sample'}
                </button>
              </div>

              <label className="sample-form__consent">
                <input type="checkbox" name="marketingConsent" />
                <span>
                  Send me occasional Modern Java articles, book updates, and
                  future releases. Unsubscribe anytime.
                </span>
              </label>

              <p className="sample-form__privacy">
                The sample is sent whether or not you choose to receive updates.
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
