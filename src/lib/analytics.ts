const CONSENT_STORAGE_KEY = 'mj_analytics_consent';
const UTM_STORAGE_KEY = 'mj_utm';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || '';
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID?.trim() || '';

export type ConsentStatus = 'granted' | 'denied';

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

type GtagFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFunction;
    clarity?: (...args: unknown[]) => void;
  }
}

let trackersLoaded = false;
let utmCaptured = false;

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

export function getConsent(): ConsentStatus | null {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (value === 'granted' || value === 'denied') return value;
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

export function setConsent(status: ConsentStatus): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, status);
  } catch {
    /* ignore */
  }

  if (status === 'granted') {
    initAnalytics();
    pageView();
  }
}

export function captureUtmParams(): void {
  if (utmCaptured || typeof window === 'undefined') return;
  utmCaptured = true;

  try {
    if (sessionStorage.getItem(UTM_STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};

    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }

    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    /* ignore */
  }
}

export function getUtmProps(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = parsed[key];
      if (typeof value === 'string' && value) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function loadGtag(): void {
  if (!GA_MEASUREMENT_ID || window.gtag) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function loadClarity(): void {
  if (!CLARITY_ID || window.clarity) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(script);
}

/** Load GA4 / Clarity only after analytics consent is granted. */
export function initAnalytics(): void {
  if (trackersLoaded || getConsent() !== 'granted') return;
  if (!GA_MEASUREMENT_ID && !CLARITY_ID) return;

  trackersLoaded = true;
  loadGtag();
  loadClarity();
}

function sanitizeProps(props?: AnalyticsProps): Record<string, string | number | boolean> {
  const base = { ...getUtmProps(), ...props };
  const clean: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || value === null) continue;
    // Never send emails, names, phones, or addresses to analytics.
    if (/email|name|phone|address|postal/i.test(key)) continue;
    clean[key] = value;
  }

  return clean;
}

export function track(event: string, props?: AnalyticsProps): void {
  if (getConsent() !== 'granted') return;
  if (!trackersLoaded) initAnalytics();
  if (!window.gtag || !GA_MEASUREMENT_ID) return;

  window.gtag('event', event, sanitizeProps(props));
}

export function pageView(path = window.location.pathname): void {
  if (getConsent() !== 'granted') return;
  if (!trackersLoaded) initAnalytics();
  if (!window.gtag || !GA_MEASUREMENT_ID) return;

  window.gtag('event', 'page_view', {
    page_path: path || '/',
    page_title: document.title,
    ...sanitizeProps(),
  });
}

export function trackOutboundClick(url: string, label?: string): void {
  track('outbound_click', {
    link_url: url,
    link_label: label,
  });
}

export function trackCtaClick(cta: string, location: string): void {
  track('cta_click', { cta, location });
}

export function trackPurchase(params: {
  format: 'digital' | 'paperback';
  value: number;
  transactionId: string;
  paymentMethod: 'razorpay' | 'bypass';
  quantity?: number;
}): void {
  if (getConsent() !== 'granted') return;
  if (!trackersLoaded) initAnalytics();
  if (!window.gtag || !GA_MEASUREMENT_ID) return;

  const quantity = params.quantity ?? 1;
  window.gtag('event', 'purchase', {
    currency: 'INR',
    value: params.value,
    transaction_id: params.transactionId,
    ...sanitizeProps({
      format: params.format,
      payment_method: params.paymentMethod,
      quantity,
    }),
    items: [
      {
        item_id: params.format,
        item_name: `Modern Java — ${params.format}`,
        price: params.value / quantity,
        quantity,
      },
    ],
  });
}
