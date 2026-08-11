import {
  getConfiguredMetaPixelId,
  initializeMetaPixel,
  trackMetaCustomEvent,
  trackMetaEventOnce,
} from './metaPixel';

/** Canonical Meta custom event for the final Amazon Kindle outbound click. */
export const AMAZON_CLICK_EVENT = 'AmazonClick' as const;

export const AMAZON_CLICK_PARAMS = {
  content_ids: ['modern_java_kindle'],
  content_type: 'product',
  content_name: 'Modern Java Kindle',
  destination: 'amazon',
} as const;

const CONSENT_STORAGE_KEY = 'mj_analytics_consent';
const UTM_STORAGE_KEY = 'mj_utm';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() || '';
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID?.trim() || '';

export type ConsentStatus = 'granted' | 'denied';

type AnalyticsScalar = string | number | boolean | null | undefined;
type AnalyticsArrayValue = ReadonlyArray<string | number | boolean>;
export type AnalyticsProps = Record<
  string,
  AnalyticsScalar | AnalyticsArrayValue
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

const PII_PARAM_KEYS = new Set([
  'address',
  'billing_address',
  'city',
  'customer_name',
  'delivery_address',
  'email',
  'first_name',
  'full_name',
  'last_name',
  'name',
  'phone',
  'postal',
  'postal_code',
  'shipping_address',
  'state',
  'street',
  'street_address',
  'zip',
  'zip_code',
]);

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

/**
 * First-party Accept / Essential-only measurement. Works for both choices
 * (denied visitors never load GA/Meta). No email or other PII.
 */
export function reportAnalyticsConsentChoice(status: ConsentStatus): void {
  if (typeof window === 'undefined') return;
  const apiBase = import.meta.env.VITE_ORDER_API_URL?.replace(/\/$/, '');
  if (!apiBase) return;

  captureUtmParams();
  const body = JSON.stringify({
    choice: status,
    path: window.location.pathname || '/',
    ...getUtmProps(),
  });

  try {
    void fetch(`${apiBase}/analytics-consents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      mode: 'cors',
    }).catch(() => {
      /* never block the banner */
    });
  } catch {
    /* ignore */
  }
}

export function setConsent(status: ConsentStatus): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, status);
  } catch {
    /* ignore */
  }

  reportAnalyticsConsentChoice(status);

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

/** Load GA4 / Clarity / Meta Pixel only after analytics consent is granted. */
export function initAnalytics(): void {
  if (getConsent() !== 'granted') return;

  const metaPixelId = getConfiguredMetaPixelId();

  if (!trackersLoaded) {
    if (GA_MEASUREMENT_ID || CLARITY_ID || metaPixelId) {
      trackersLoaded = true;
      loadGtag();
      loadClarity();
    }
  }

  // Meta PageView is owned by MetaPageViewTracker (avoids duplicate PageViews).
  if (metaPixelId) {
    initializeMetaPixel(metaPixelId);
  }
}

function sanitizeProps(props?: AnalyticsProps): Record<string, string | number | boolean> {
  const base = { ...getUtmProps(), ...props };
  const clean: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || value === null) continue;
    if (PII_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) continue;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      continue;
    }
    clean[key] = value;
  }

  return clean;
}

function sanitizeMetaProps(
  props?: AnalyticsProps,
): Record<string, string | number | boolean | readonly (string | number | boolean)[]> {
  const base = { ...getUtmProps(), ...props };
  const clean: Record<
    string,
    string | number | boolean | readonly (string | number | boolean)[]
  > = {};

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || value === null) continue;
    if (PII_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (entry): entry is string | number | boolean =>
          typeof entry === 'string' ||
          typeof entry === 'number' ||
          typeof entry === 'boolean',
      );
      if (filtered.length > 0) {
        clean[key] = filtered;
      }
      continue;
    }
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

function readBrowserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const encoded = encodeURIComponent(name);
    const parts = document.cookie.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith(`${encoded}=`) && !trimmed.startsWith(`${name}=`)) {
        continue;
      }
      const raw = trimmed.slice(trimmed.indexOf('=') + 1);
      return decodeURIComponent(raw);
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Meta click IDs already set by the Pixel (_fbp / _fbc). Empty when consent
 * was never granted or cookies are blocked — never invent values.
 */
export function getMetaBrowserIds(): { fbp?: string; fbc?: string } {
  if (getConsent() !== 'granted') return {};
  const fbp = readBrowserCookie('_fbp')?.trim();
  const fbc = readBrowserCookie('_fbc')?.trim();
  return {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
  };
}

/**
 * Fields the backend needs for Conversions API Lead / Purchase.
 * Only includes analyticsConsent when the visitor accepted analytics.
 */
export function buildMetaAttributionPayload(): {
  analyticsConsent: boolean;
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
  clientUserAgent?: string;
} {
  const analyticsConsent = getConsent() === 'granted';
  if (!analyticsConsent || typeof window === 'undefined') {
    return { analyticsConsent: false };
  }

  return {
    analyticsConsent: true,
    ...getMetaBrowserIds(),
    eventSourceUrl: window.location.href,
    clientUserAgent: window.navigator?.userAgent,
  };
}

export function trackMetaConversion(
  dedupeKey: string,
  eventName: 'ViewContent' | 'Lead' | 'InitiateCheckout' | 'Purchase',
  props?: AnalyticsProps,
  options?: { eventID?: string },
): void {
  if (getConsent() !== 'granted') return;
  if (!trackersLoaded) initAnalytics();
  trackMetaEventOnce(dedupeKey, eventName, sanitizeMetaProps(props), options);
}

/**
 * Meta custom event for a marketing / reader-list acquisition
 * (not-subscribed → subscribed). Callers must gate on backend transition
 * signals (`newMarketingSubscriber` or status === 'created') — never on
 * mere UX success or already_registered.
 */
const marketingSubscribeKeys = new Set<string>();

export function trackMarketingSubscribeConversion(
  dedupeKey: string,
  props?: AnalyticsProps,
  options?: { eventID?: string },
): void {
  if (getConsent() !== 'granted') return;
  const key = dedupeKey.trim();
  if (!key || marketingSubscribeKeys.has(key)) return;
  marketingSubscribeKeys.add(key);
  if (!trackersLoaded) initAnalytics();
  try {
    trackMetaCustomEvent(
      'MarketingSubscribe',
      sanitizeMetaProps({
        content_name: 'Classpath Reader List',
        content_category: 'marketing_opt_in',
        ...props,
      }),
      { eventID: options?.eventID || key },
    );
  } catch {
    /* never break the opt-in UX */
  }
}

/**
 * Stable unique Meta event_id for AmazonClick (browser Pixel).
 * Format: AMZ- + 12 uppercase hex chars (matches SR-/MJ- style ids).
 */
export function createAmazonClickEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `AMZ-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    }
  } catch {
    /* fall through */
  }

  const bytes = new Uint8Array(6);
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  } catch {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `AMZ-${hex}`;
}

/**
 * Fire exactly one Meta custom AmazonClick for the final Amazon outbound.
 * Never throws — callers must still navigate to Amazon if tracking fails.
 */
export function trackAmazonClick(): string | undefined {
  try {
    if (getConsent() !== 'granted') return undefined;
    // Always re-enter init so pixel is ready even if GA loaded first.
    initAnalytics();

    const eventId = createAmazonClickEventId();
    trackMetaCustomEvent(
      AMAZON_CLICK_EVENT,
      sanitizeMetaProps({ ...AMAZON_CLICK_PARAMS }),
      { eventID: eventId },
    );
    return eventId;
  } catch {
    return undefined;
  }
}

/** Brief pause so Meta Pixel can flush AmazonClick before page unload. */
export const AMAZON_CLICK_NAV_DELAY_MS = 400;

/**
 * Fire AmazonClick (if consented), then navigate to Amazon after a short delay.
 * Tracking failures never prevent navigation. One call schedules one navigation.
 */
export function navigateToAmazon(url: string): void {
  try {
    trackAmazonClick();
  } catch {
    /* tracking must never block Amazon navigation */
  }

  const go = () => {
    try {
      window.location.assign(url);
    } catch {
      window.location.href = url;
    }
  };

  try {
    window.setTimeout(go, AMAZON_CLICK_NAV_DELAY_MS);
  } catch {
    go();
  }
}

/**
 * Fire GA4 + Meta Purchase after verified payment.
 * `value` must be the charged total in INR rupees (not paise).
 * Callers should convert with paiseToInr(order.amount).
 */
export function trackPurchase(params: {
  format: 'digital' | 'paperback';
  /** Charged order total in INR rupees (100 paise = 1 INR). */
  value: number;
  transactionId: string;
  paymentMethod: 'razorpay' | 'bypass';
  quantity?: number;
}): void {
  if (getConsent() !== 'granted') return;
  if (!trackersLoaded) initAnalytics();

  const quantity = params.quantity ?? 1;
  if (window.gtag && GA_MEASUREMENT_ID) {
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

  // eventID must match server Conversions API event_id (app order id).
  const contentName =
    params.format === 'paperback'
      ? 'Modern Java Paperback'
      : 'Modern Java PDF + ePub';
  trackMetaConversion(
    `purchase:${params.transactionId}`,
    'Purchase',
    {
      currency: 'INR',
      value: params.value,
      content_name: contentName,
      content_ids: [`modern_java_${params.format}`],
      content_type: 'product',
      num_items: quantity,
    },
    { eventID: params.transactionId },
  );
}
