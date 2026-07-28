/**
 * Meta Pixel (Facebook Pixel) helpers.
 *
 * Loaded only in production builds when VITE_META_PIXEL_ID is set and the
 * visitor has granted analytics consent (same banner as GA4 / Clarity).
 * Never sends email, phone, name, or other customer PII.
 */

export type MetaStandardEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'InitiateCheckout'
  | 'Purchase';

type FbqCommand = 'init' | 'track' | 'trackCustom' | 'consent';

type FbqFunction = {
  (command: FbqCommand, ...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded?: boolean;
  version?: string;
  push: (...args: unknown[]) => number;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

const META_PIXEL_SCRIPT_SRC =
  'https://connect.facebook.net/en_US/fbevents.js';
const META_PIXEL_SCRIPT_ATTR = 'data-meta-pixel';

let scriptInserted = false;
let initializedPixelId: string | null = null;
let lastPageViewLocation: string | null = null;
const sentEventKeys = new Set<string>();

function readConfiguredPixelId(): string {
  return import.meta.env.VITE_META_PIXEL_ID?.trim() || '';
}

/** True when Meta Pixel may run (production build with a configured ID). */
export function isMetaPixelEnvironmentEnabled(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  // Vitest / non-production builds stay silent unless a future convention changes.
  if (!import.meta.env.PROD) return false;
  return Boolean(readConfiguredPixelId());
}

export function getConfiguredMetaPixelId(): string {
  if (!isMetaPixelEnvironmentEnabled()) return '';
  return readConfiguredPixelId();
}

function currentLocationKey(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`;
}

function ensureFbqStub(): FbqFunction | null {
  if (typeof window === 'undefined') return null;
  if (window.fbq) return window.fbq;

  const fbq = function fbq(command: FbqCommand, ...args: unknown[]) {
    const self = fbq as FbqFunction;
    if (typeof self.callMethod === 'function') {
      self.callMethod.call(self, command, ...args);
    } else {
      self.queue.push([command, ...args]);
    }
  } as FbqFunction;

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = (...args: unknown[]) => fbq.queue.push(args);

  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  return fbq;
}

function insertMetaPixelScript(): void {
  if (typeof document === 'undefined' || scriptInserted) return;

  const existing = document.querySelector(
    `script[${META_PIXEL_SCRIPT_ATTR}="true"], script[src="${META_PIXEL_SCRIPT_SRC}"]`,
  );
  if (existing) {
    scriptInserted = true;
    return;
  }

  try {
    const script = document.createElement('script');
    script.async = true;
    script.src = META_PIXEL_SCRIPT_SRC;
    script.setAttribute(META_PIXEL_SCRIPT_ATTR, 'true');
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
    scriptInserted = true;
  } catch {
    /* Ad blockers / CSP may prevent insertion — fail silently. */
  }
}

/**
 * Load fbevents.js once and call fbq('init', pixelId) once.
 * No-ops when ID/environment/window is unavailable.
 */
export function initializeMetaPixel(pixelId: string): void {
  const id = pixelId?.trim();
  if (!id) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!import.meta.env.PROD) return;
  if (initializedPixelId === id) return;

  const fbq = ensureFbqStub();
  if (!fbq) return;

  insertMetaPixelScript();

  try {
    fbq('init', id);
    initializedPixelId = id;
  } catch {
    /* never throw if Meta is blocked */
  }
}

export function isMetaPixelAvailable(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.fbq &&
      initializedPixelId &&
      import.meta.env.PROD,
  );
}

/**
 * Track a PageView for the current (or provided) location.
 * Deduplicates identical pathname+search so StrictMode remounts
 * and repeated calls do not double-fire.
 */
export function trackMetaPageView(locationKey?: string): void {
  if (!initializedPixelId || typeof window === 'undefined') return;
  if (!window.fbq) return;

  const key = locationKey ?? currentLocationKey();
  if (lastPageViewLocation === key) return;
  lastPageViewLocation = key;

  try {
    window.fbq('track', 'PageView');
  } catch {
    /* ignore */
  }
}

const PII_PARAM_KEYS = new Set([
  'email',
  'phone',
  'name',
  'address',
  'postal',
  'first_name',
  'last_name',
  'fn',
  'ln',
  'em',
  'ph',
]);

function sanitizeParameters(
  parameters?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!parameters) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null) continue;
    if (PII_PARAM_KEYS.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export type MetaEventOptions = {
  /** Shared with Conversions API for browser/server deduplication. */
  eventID?: string;
};

/** Standard Meta events (Purchase / Lead / etc.). */
export function trackMetaEvent(
  eventName: MetaStandardEvent,
  parameters?: Record<string, unknown>,
  options?: MetaEventOptions,
): void {
  if (!initializedPixelId || typeof window === 'undefined') return;
  if (!window.fbq) return;
  if (eventName === 'PageView') {
    trackMetaPageView();
    return;
  }

  try {
    const clean = sanitizeParameters(parameters);
    const eventID = options?.eventID?.trim();
    const eventData = eventID ? { eventID } : undefined;
    if (clean && eventData) {
      window.fbq('track', eventName, clean, eventData);
    } else if (clean) {
      window.fbq('track', eventName, clean);
    } else if (eventData) {
      window.fbq('track', eventName, {}, eventData);
    } else {
      window.fbq('track', eventName);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Track a standard Meta event once for a caller-provided dedupe key.
 * Useful for purchase confirmations, modal opens, and lead captures where
 * duplicate handler execution would otherwise double-count conversions.
 */
export function trackMetaEventOnce(
  dedupeKey: string,
  eventName: Exclude<MetaStandardEvent, 'PageView'>,
  parameters?: Record<string, unknown>,
  options?: MetaEventOptions,
): void {
  const key = dedupeKey.trim();
  if (!key || sentEventKeys.has(key)) return;
  sentEventKeys.add(key);
  trackMetaEvent(eventName, parameters, options);
}

export function trackMetaCustomEvent(
  eventName: string,
  parameters?: Record<string, unknown>,
): void {
  if (!initializedPixelId || typeof window === 'undefined') return;
  if (!window.fbq || !eventName.trim()) return;

  try {
    const clean = sanitizeParameters(parameters);
    if (clean) {
      window.fbq('trackCustom', eventName, clean);
    } else {
      window.fbq('trackCustom', eventName);
    }
  } catch {
    /* ignore */
  }
}

/** Test helper — clears module guards between cases. */
export function __resetMetaPixelForTests(): void {
  scriptInserted = false;
  initializedPixelId = null;
  lastPageViewLocation = null;
  sentEventKeys.clear();
  if (typeof window !== 'undefined') {
    delete window.fbq;
    delete window._fbq;
  }
  if (typeof document !== 'undefined') {
    document
      .querySelectorAll(
        `script[${META_PIXEL_SCRIPT_ATTR}="true"], script[src="${META_PIXEL_SCRIPT_SRC}"]`,
      )
      .forEach((node) => node.remove());
  }
}
