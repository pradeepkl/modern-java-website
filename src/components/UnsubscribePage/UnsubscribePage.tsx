import { FormEvent, useEffect, useState } from 'react';
import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { Footer } from '../Footer/Footer';
import '../LegalPage/LegalPage.css';
import './UnsubscribePage.css';

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

export function UnsubscribePage() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = `Unsubscribe | ${book.title}`;
    window.scrollTo(0, 0);

    return () => {
      document.title = `${book.title} - ${book.subtitle}`;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('idle');
    setMessage('');

    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') || '').trim();

    if (!ORDER_API_URL) {
      setStatus('error');
      setMessage('Unsubscribe is not configured yet. Please email us instead.');
      setSubmitting(false);
      return;
    }

    try {
      const result = await fetch(
        `${ORDER_API_URL}/marketing-consents/unsubscribe`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(payload.message || 'Unable to update your preference');
      }

      form.reset();
      setStatus('success');
      setMessage(
        payload.message ||
          'You have been unsubscribed from optional marketing emails.',
      );
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update your preference',
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
          <p className="legal-page__eyebrow">Email preferences</p>
          <h1>Unsubscribe</h1>
          <p className="legal-page__updated">
            Stop optional Modern Java articles, book updates, and promotional
            emails. Transactional messages for purchases and chapter preview
            downloads are unaffected.
          </p>

          <div className="legal-page__content unsubscribe-page__content">
            <form className="unsubscribe-form" onSubmit={handleSubmit}>
              <label htmlFor="unsubscribe-email">Email address</label>
              <input
                id="unsubscribe-email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                autoFocus
              />
              <button
                type="submit"
                className={`button button-primary${submitting ? ' button-progress' : ''}`}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? 'Updating…' : 'Unsubscribe from marketing emails'}
              </button>
              <div
                className={`unsubscribe-form__status unsubscribe-form__status--${status}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            </form>

            <p className="unsubscribe-page__help">
              Prefer email instead? Write to{' '}
              <a href={`mailto:${book.email}`}>{book.email}</a> and we will
              update your preference.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
