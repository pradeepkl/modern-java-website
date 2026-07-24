const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getAppEnvironment,
  getRazorpayConfig,
  formatRazorpayDiagnostics,
  maskKeyId,
  resolvePaymentEnvironment,
} = require('./razorpayConfig');

const baseDev = {
  APP_ENV: 'dev',
  RAZORPAY_KEY_ID: 'rzp_test_ABCDEFGHijkl',
  RAZORPAY_KEY_SECRET: 'test_secret_value',
  RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
};

const baseProd = {
  APP_ENV: 'prod',
  RAZORPAY_KEY_ID: 'rzp_live_ABCDEFGHijkl',
  RAZORPAY_KEY_SECRET: 'live_secret_value',
  RAZORPAY_WEBHOOK_SECRET: 'live_webhook_secret',
};

describe('getAppEnvironment', () => {
  it('accepts dev and prod', () => {
    assert.equal(getAppEnvironment({ APP_ENV: 'dev' }), 'dev');
    assert.equal(getAppEnvironment({ APP_ENV: 'prod' }), 'prod');
  });

  it('rejects unsupported values', () => {
    assert.throws(() => getAppEnvironment({ APP_ENV: 'staging' }), /Unsupported APP_ENV/);
    assert.throws(() => getAppEnvironment({ APP_ENV: '' }), /Unsupported APP_ENV/);
    assert.throws(() => getAppEnvironment({}), /Unsupported APP_ENV/);
    assert.throws(() => getAppEnvironment({ APP_ENV: 'production' }), /Unsupported APP_ENV/);
  });
});

describe('getRazorpayConfig', () => {
  it('selects credentials for APP_ENV=dev', () => {
    const config = getRazorpayConfig(baseDev);
    assert.equal(config.environment, 'dev');
    assert.equal(config.keyId, baseDev.RAZORPAY_KEY_ID);
    assert.equal(config.keySecret, baseDev.RAZORPAY_KEY_SECRET);
    assert.equal(config.webhookSecret, baseDev.RAZORPAY_WEBHOOK_SECRET);
    assert.equal(config.isProduction, false);
    assert.equal(config.paymentProvider, 'razorpay');
  });

  it('selects credentials for APP_ENV=prod', () => {
    const config = getRazorpayConfig(baseProd);
    assert.equal(config.environment, 'prod');
    assert.equal(config.keyId, baseProd.RAZORPAY_KEY_ID);
    assert.equal(config.isProduction, true);
  });

  it('fails when test credentials are missing in dev', () => {
    assert.throws(
      () =>
        getRazorpayConfig({
          APP_ENV: 'dev',
          RAZORPAY_KEY_ID: 'rzp_test_ABCDEFGHijkl',
        }),
      /RAZORPAY_KEY_SECRET/,
    );
  });

  it('fails when live credentials are missing in prod', () => {
    assert.throws(
      () =>
        getRazorpayConfig({
          APP_ENV: 'prod',
          RAZORPAY_KEY_ID: 'rzp_live_ABCDEFGHijkl',
          RAZORPAY_KEY_SECRET: 'live_secret_value',
        }),
      /RAZORPAY_WEBHOOK_SECRET/,
    );
  });

  it('rejects test Key ID in prod mode', () => {
    assert.throws(
      () =>
        getRazorpayConfig({
          ...baseProd,
          RAZORPAY_KEY_ID: 'rzp_test_ABCDEFGHijkl',
        }),
      /rzp_live_/,
    );
  });

  it('rejects live Key ID in dev mode', () => {
    assert.throws(
      () =>
        getRazorpayConfig({
          ...baseDev,
          RAZORPAY_KEY_ID: 'rzp_live_ABCDEFGHijkl',
        }),
      /rzp_test_/,
    );
  });
});

describe('diagnostics', () => {
  it('masks Key ID and never includes secrets', () => {
    const config = getRazorpayConfig(baseProd);
    const text = formatRazorpayDiagnostics(config);
    assert.match(text, /Razorpay environment: prod/);
    assert.match(text, /rzp_live_\*{4}/);
    assert.doesNotMatch(text, /live_secret_value/);
    assert.doesNotMatch(text, /live_webhook_secret/);
    assert.equal(maskKeyId('rzp_live_ABCDEFGHijkl'), 'rzp_live_****ijkl');
  });
});

describe('resolvePaymentEnvironment', () => {
  it('treats missing historical values as dev', () => {
    assert.equal(resolvePaymentEnvironment({}), 'dev');
    assert.equal(resolvePaymentEnvironment(null), 'dev');
    assert.equal(resolvePaymentEnvironment({ paymentEnvironment: 'prod' }), 'prod');
  });
});
