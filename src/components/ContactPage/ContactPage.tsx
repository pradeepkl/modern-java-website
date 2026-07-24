import { FormEvent, useEffect, useRef, useState } from 'react';
import { assets } from '../../data/assets';
import { book } from '../../data/book';
import { isTurnstileConfigured } from '../../lib/turnstile';
import { Footer } from '../Footer/Footer';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from '../shared/TurnstileWidget';
import '../LegalPage/LegalPage.css';
import './ContactPage.css';

const ORDER_API_URL = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');

export function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  useEffect(() => {
    document.title = `Contact | ${book.title}`;
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
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const subject = String(data.get('subject') || '').trim();
    const body = String(data.get('message') || '').trim();

    if (!ORDER_API_URL) {
      setStatus('error');
      setMessage('Contact is not configured yet. Please email us instead.');
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
      const result = await fetch(`${ORDER_API_URL}/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          subject,
          message: body,
          captchaToken: captchaToken || undefined,
        }),
      });
      const payload = await result.json();

      if (!result.ok) {
        throw new Error(payload.message || 'Unable to send your message');
      }

      form.reset();
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setStatus('success');
      setMessage(
        payload.message ||
          'Thank you. Your message has been sent. We will reply by email.',
      );
    } catch (error) {
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send your message right now.',
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
          <p className="legal-page__eyebrow">Get in touch</p>
          <h1>Contact us</h1>
          <p className="legal-page__updated">
            Questions about Modern Java, bulk orders, or the paperback waitlist?
            Send a message and we will reply by email.
          </p>

          <div className="legal-page__content contact-page__content">
            <form className="contact-form" onSubmit={handleSubmit}>
              <label className="contact-form__field" htmlFor="contact-name">
                <span>Name</span>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  autoFocus
                  data-clarity-mask="true"
                />
              </label>

              <label className="contact-form__field" htmlFor="contact-email">
                <span>Email address</span>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  data-clarity-mask="true"
                />
              </label>

              <label className="contact-form__field" htmlFor="contact-subject">
                <span>Subject</span>
                <input
                  id="contact-subject"
                  type="text"
                  name="subject"
                  placeholder="How can we help?"
                  autoComplete="off"
                  required
                  maxLength={200}
                  data-clarity-mask="true"
                />
              </label>

              <label className="contact-form__field" htmlFor="contact-message">
                <span>Message</span>
                <textarea
                  id="contact-message"
                  name="message"
                  placeholder="Write your message…"
                  required
                  rows={7}
                  maxLength={5000}
                  data-clarity-mask="true"
                />
              </label>

              <TurnstileWidget
                ref={turnstileRef}
                theme="light"
                onTokenChange={setCaptchaToken}
              />

              <button
                type="submit"
                className={`button button-primary${submitting ? ' button-progress' : ''}`}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? 'Sending…' : 'Send message'}
              </button>

              <div
                className={`contact-form__status contact-form__status--${status}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            </form>

            <p className="contact-page__help">
              Prefer email instead? Write to{' '}
              <a href={`mailto:${book.email}`}>{book.email}</a>.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
