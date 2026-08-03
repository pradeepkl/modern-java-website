/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORDER_API_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Set to "dev" for Amplify/dev builds — disables Turnstile and payment UI. */
  readonly VITE_APP_ENV?: string;
  readonly VITE_DIGITAL_CHECKOUT_BYPASS?: string;
  readonly VITE_DIGITAL_CHECKOUT_BYPASS_SECRET?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_CLARITY_ID?: string;
  /** Meta (Facebook) Pixel ID — production-only, consent-gated. */
  readonly VITE_META_PIXEL_ID?: string;
  /** Build-time flag. Requires rebuild + redeploy to change. */
  readonly VITE_PAPERBACK_SALES_ENABLED?: string;
  /** Build-time flag. Requires rebuild + redeploy to change. */
  readonly VITE_PAPERBACK_WAITLIST_ENABLED?: string;
  /** Build-time flag. Direct digital (PDF + ePub) checkout UI. */
  readonly VITE_DIGITAL_SALES_ENABLED?: string;
  /** Multi-use campaign promo code pre-filled on digital checkout. */
  readonly VITE_CAMPAIGN_VOUCHER_CODE?: string;
  /** Campaign payable amount in INR (must match backend READER_VOUCHER_PAYABLE_INR). */
  readonly VITE_CAMPAIGN_VOUCHER_PAYABLE_INR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
