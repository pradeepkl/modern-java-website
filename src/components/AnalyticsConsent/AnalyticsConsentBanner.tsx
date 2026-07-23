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
            Help us improve this site
          </p>
          <p id="analytics-consent-desc" className="analytics-consent__text">
            We use privacy-respecting analytics (Google Analytics and Microsoft
            Clarity) to understand which pages and checkout steps work well. We
            do not send your email, name, or payment details to these tools.{' '}
            <a href="/privacy-policy">Privacy policy</a>
          </p>
        </div>
        <div className="analytics-consent__actions">
          <button
            type="button"
            className="button button-secondary analytics-consent__essential"
            onClick={() => choose('denied')}
          >
            Essential only
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => choose('granted')}
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
