const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Local Vite, Amplify APP_ENV=dev builds, and localhost hosts skip Turnstile.
 * Production builds always require captcha when VITE_TURNSTILE_SITE_KEY is set.
 */
export function shouldDisableTurnstile() {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_APP_ENV === 'dev') return true;
  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return true;
  }
  return false;
}

export function isTurnstileConfigured() {
  if (shouldDisableTurnstile()) return false;
  return Boolean(TURNSTILE_SITE_KEY);
}

/**
 * Skip Razorpay checkout UI and complete without payment.
 * Pair with APP_ENV=dev (or the digital bypass secret against a configured API).
 */
export function shouldSkipCheckoutPayment() {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_APP_ENV === 'dev') return true;
  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return true;
  }
  return false;
}

export interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'flexible' | 'compact';
  appearance?: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileApi {
  render: (
    container: HTMLElement | string,
    options: TurnstileRenderOptions,
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="https://challenges.cloudflare.com/turnstile/"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Unable to load Cloudflare Turnstile')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Unable to load Cloudflare Turnstile'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}
