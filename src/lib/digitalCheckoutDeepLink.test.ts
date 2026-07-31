import { afterEach, describe, expect, it } from 'vitest';
import {
  DIGITAL_CHECKOUT_HASH,
  buildDigitalCheckoutUrl,
  captureDigitalCheckoutIntent,
  clearCapturedDigitalCheckoutIntent,
  hasCapturedDigitalCheckoutIntent,
  hasDigitalCheckoutIntent,
  isDigitalCheckoutHash,
  readCheckoutVoucherFromUrl,
} from './digitalCheckoutDeepLink';

describe('digitalCheckoutDeepLink', () => {
  afterEach(() => {
    clearCapturedDigitalCheckoutIntent();
  });

  it('detects the checkout hash', () => {
    expect(DIGITAL_CHECKOUT_HASH).toBe('#digital-checkout');
    expect(isDigitalCheckoutHash('#digital-checkout')).toBe(true);
    expect(isDigitalCheckoutHash('#formats')).toBe(false);
  });

  it('treats voucher or checkout query as intent without a hash', () => {
    expect(
      hasDigitalCheckoutIntent({
        search: '?voucher=MJ-7X9K-PL42',
        hash: '',
      }),
    ).toBe(true);
    expect(
      hasDigitalCheckoutIntent({
        search: '?checkout=digital',
        hash: '',
      }),
    ).toBe(true);
    expect(hasDigitalCheckoutIntent({ search: '', hash: '' })).toBe(false);
  });

  it('builds a checkout URL with voucher + checkout query', () => {
    expect(
      buildDigitalCheckoutUrl('https://modern-java.classpath.in', {
        voucherCode: 'mj-7x9k-pl42',
      }),
    ).toBe(
      'https://modern-java.classpath.in/?voucher=MJ-7X9K-PL42&checkout=digital#digital-checkout',
    );
  });

  it('reads voucher from the query string', () => {
    expect(readCheckoutVoucherFromUrl('?voucher=mj-abc1-def2')).toBe(
      'MJ-ABC1-DEF2',
    );
    expect(readCheckoutVoucherFromUrl('')).toBe('');
  });

  it('persists intent in sessionStorage for Strict Mode remounts', () => {
    // Simulate a captured email deep link without touching window.location.
    sessionStorage.setItem('mj_open_digital_checkout', '1');
    expect(hasCapturedDigitalCheckoutIntent()).toBe(true);
    captureDigitalCheckoutIntent();
    expect(hasCapturedDigitalCheckoutIntent()).toBe(true);
  });
});
