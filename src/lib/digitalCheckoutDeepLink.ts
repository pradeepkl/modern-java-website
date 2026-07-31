/** Opens the digital checkout dialog from email / outbound CTAs. */
export const DIGITAL_CHECKOUT_HASH = '#digital-checkout';

const INTENT_STORAGE_KEY = 'mj_open_digital_checkout';

export function isDigitalCheckoutHash(hash = window.location.hash): boolean {
  const normalized = String(hash || '')
    .trim()
    .toLowerCase();
  return (
    normalized === DIGITAL_CHECKOUT_HASH ||
    normalized.startsWith(`${DIGITAL_CHECKOUT_HASH}?`)
  );
}

/** Optional personal / campaign code from `?voucher=CODE`. */
export function readCheckoutVoucherFromUrl(
  search = window.location.search,
): string {
  try {
    const value = new URLSearchParams(search).get('voucher');
    return String(value || '')
      .trim()
      .toUpperCase();
  } catch {
    return '';
  }
}

/**
 * True when the URL asks to open digital checkout.
 * Query `?voucher=` alone counts — many email clients strip `#hash` fragments.
 */
export function hasDigitalCheckoutIntent(
  {
    search = typeof window !== 'undefined' ? window.location.search : '',
    hash = typeof window !== 'undefined' ? window.location.hash : '',
  }: { search?: string; hash?: string } = {},
): boolean {
  const checkoutFlag = (() => {
    try {
      return new URLSearchParams(search).get('checkout') === 'digital';
    } catch {
      return false;
    }
  })();
  return (
    isDigitalCheckoutHash(hash) ||
    checkoutFlag ||
    Boolean(readCheckoutVoucherFromUrl(search))
  );
}

/** Persist intent so React Strict Mode remounts still open the dialog. */
export function captureDigitalCheckoutIntent(): void {
  if (typeof window === 'undefined') return;
  if (hasDigitalCheckoutIntent()) {
    sessionStorage.setItem(INTENT_STORAGE_KEY, '1');
  }
}

export function hasCapturedDigitalCheckoutIntent(): boolean {
  if (typeof window === 'undefined') return false;
  captureDigitalCheckoutIntent();
  return sessionStorage.getItem(INTENT_STORAGE_KEY) === '1';
}

export function clearCapturedDigitalCheckoutIntent(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(INTENT_STORAGE_KEY);
}

export function buildDigitalCheckoutUrl(
  siteUrl: string,
  { voucherCode }: { voucherCode?: string } = {},
): string {
  const base = String(siteUrl || '').replace(/\/$/, '');
  const code = String(voucherCode || '')
    .trim()
    .toUpperCase();
  // Keep both query + hash. Query survives email clients that strip fragments.
  if (code) {
    return `${base}/?voucher=${encodeURIComponent(code)}&checkout=digital${DIGITAL_CHECKOUT_HASH}`;
  }
  return `${base}/?checkout=digital${DIGITAL_CHECKOUT_HASH}`;
}

/** Clear the checkout hash after capture; keep ?voucher= for prefill. */
export function clearDigitalCheckoutHash(): void {
  if (typeof window === 'undefined') return;
  if (!isDigitalCheckoutHash() && !/([?&])checkout=digital\b/.test(window.location.search)) {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.delete('checkout');
  const next = `${url.pathname}${url.search}`;
  window.history.replaceState(null, '', next || '/');
}
