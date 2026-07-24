const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const {
  verifyPaymentSignature,
  verifyWebhookSignature,
  publicOrderPaymentFields,
  persistedPaymentFields,
  createRazorpayOrder,
} = require('./razorpayClient');

const testConfig = {
  environment: 'dev',
  keyId: 'rzp_test_ABCDEFGHijkl',
  keySecret: 'test_secret_value',
  webhookSecret: 'test_webhook_secret',
  isProduction: false,
  paymentProvider: 'razorpay',
};

const liveConfig = {
  environment: 'prod',
  keyId: 'rzp_live_ABCDEFGHijkl',
  keySecret: 'live_secret_value',
  webhookSecret: 'live_webhook_secret',
  isProduction: true,
  paymentProvider: 'razorpay',
};

const signPayment = (orderId, paymentId, secret) =>
  createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

describe('verifyPaymentSignature', () => {
  it('validates with the test secret in dev', () => {
    const signature = signPayment('order_1', 'pay_1', testConfig.keySecret);
    assert.equal(
      verifyPaymentSignature(
        {
          razorpayOrderId: 'order_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: signature,
        },
        testConfig,
      ),
      true,
    );
  });

  it('validates with the live secret in prod', () => {
    const signature = signPayment('order_1', 'pay_1', liveConfig.keySecret);
    assert.equal(
      verifyPaymentSignature(
        {
          razorpayOrderId: 'order_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: signature,
        },
        liveConfig,
      ),
      true,
    );
  });

  it('rejects cross-environment signatures', () => {
    const testSigned = signPayment('order_1', 'pay_1', testConfig.keySecret);
    assert.equal(
      verifyPaymentSignature(
        {
          razorpayOrderId: 'order_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: testSigned,
        },
        liveConfig,
      ),
      false,
    );

    const liveSigned = signPayment('order_1', 'pay_1', liveConfig.keySecret);
    assert.equal(
      verifyPaymentSignature(
        {
          razorpayOrderId: 'order_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: liveSigned,
        },
        testConfig,
      ),
      false,
    );
  });

  it('fails securely on invalid signatures', () => {
    assert.equal(
      verifyPaymentSignature(
        {
          razorpayOrderId: 'order_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: 'not-a-valid-signature',
        },
        testConfig,
      ),
      false,
    );
  });
});

describe('verifyWebhookSignature', () => {
  it('validates with the environment webhook secret', () => {
    const rawBody = '{"event":"payment.captured"}';
    const signature = createHmac('sha256', testConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');
    assert.equal(
      verifyWebhookSignature({ rawBody, signature }, testConfig),
      true,
    );
  });

  it('rejects invalid webhook signatures', () => {
    assert.equal(
      verifyWebhookSignature(
        { rawBody: '{}', signature: 'bad' },
        liveConfig,
      ),
      false,
    );
  });

  it('rejects cross-environment webhook secrets', () => {
    const rawBody = '{"event":"payment.captured"}';
    const testSignature = createHmac('sha256', testConfig.webhookSecret)
      .update(rawBody)
      .digest('hex');
    assert.equal(
      verifyWebhookSignature({ rawBody, signature: testSignature }, liveConfig),
      false,
    );
  });
});

describe('public and persisted payment fields', () => {
  it('exposes only the selected Key ID to the frontend', () => {
    const fields = publicOrderPaymentFields(testConfig);
    assert.equal(fields.keyId, testConfig.keyId);
    assert.equal(fields.razorpayKeyId, testConfig.keyId);
    assert.equal(fields.paymentEnvironment, 'dev');
    assert.equal(fields.paymentProvider, 'razorpay');
    assert.equal('keySecret' in fields, false);
    assert.equal('webhookSecret' in fields, false);
  });

  it('persists payment provider and environment', () => {
    assert.deepEqual(persistedPaymentFields(liveConfig), {
      paymentProvider: 'razorpay',
      paymentEnvironment: 'prod',
    });
  });
});

describe('createRazorpayOrder', () => {
  it('uses the provided config credentials (dev client)', async () => {
    const originalFetch = global.fetch;
    let authHeader = '';
    global.fetch = mock.fn(async (_url, options) => {
      authHeader = options.headers.authorization;
      return {
        ok: true,
        json: async () => ({ id: 'order_test_1', amount: 100 }),
      };
    });

    try {
      const order = await createRazorpayOrder(
        { amount: 100, receipt: 'MJ-1', notes: { appOrderId: 'MJ-1' } },
        testConfig,
      );
      assert.equal(order.id, 'order_test_1');
      const expected = Buffer.from(
        `${testConfig.keyId}:${testConfig.keySecret}`,
      ).toString('base64');
      assert.equal(authHeader, `Basic ${expected}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('uses the provided config credentials (prod client)', async () => {
    const originalFetch = global.fetch;
    let authHeader = '';
    global.fetch = mock.fn(async (_url, options) => {
      authHeader = options.headers.authorization;
      return {
        ok: true,
        json: async () => ({ id: 'order_live_1', amount: 100 }),
      };
    });

    try {
      const order = await createRazorpayOrder(
        { amount: 100, receipt: 'MJ-1' },
        liveConfig,
      );
      assert.equal(order.id, 'order_live_1');
      const expected = Buffer.from(
        `${liveConfig.keyId}:${liveConfig.keySecret}`,
      ).toString('base64');
      assert.equal(authHeader, `Basic ${expected}`);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
