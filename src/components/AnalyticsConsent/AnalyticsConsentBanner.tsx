import { useEffect, useState } from 'react';
import {
  captureUtmParams,
  getConsent,
  initAnalytics,
  pageView,
  setConsent,
  type ConsentStatus,
} from '../../lib/analytics';
import './AnalyticsConsentBanner.css';

function notifyConsentGranted(): void {
  window.dispatchEvent(new Event('mj:analytics-consent'));
}

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    captureUtmParams();
    const existing = getConsent();
    if (existing === 'granted') {
      initAnalytics();
      pageView();
      return;
    }
    if (existing === null) {
      setVisible(true);
    }
  }, []);

  const choose = (status: ConsentStatus) => {
    setConsent(status);
    setVisible(false);
    if (status === 'granted') {
      notifyConsentGranted();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="analytics-consent"
      role="dialog"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-desc"
    >
      <div className="analytics-consent__inner page-container">
        <div className="analytics-consent__copy">
          <p id="analytics-consent-title" className="analytics-consent__title">
            We use cookies
          </p>
          <p id="analytics-consent-desc" className="analytics-consent__text">
            Optional analytics help us see which pages and ads help readers find
            this book—so we can improve the site. Choose{' '}
            <strong>Accept</strong> to allow analytics cookies, or{' '}
            <strong>Essential only</strong> to continue without them. Either way
            the site works the same. You can change your choice later by clearing
            site data.{' '}
            <a href="/privacy-policy">Privacy policy</a>
          </p>
        </div>
        <div className="analytics-consent__actions">
          <button
            type="button"
            className="button button-primary button-large analytics-consent__accept"
            onClick={() => choose('granted')}
          >
            Accept
          </button>
          <button
            type="button"
            className="button button-secondary analytics-consent__essential"
            onClick={() => choose('denied')}
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}
