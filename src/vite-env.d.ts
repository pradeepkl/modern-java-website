/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORDER_API_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_DIGITAL_CHECKOUT_BYPASS?: string;
  readonly VITE_DIGITAL_CHECKOUT_BYPASS_SECRET?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_CLARITY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
