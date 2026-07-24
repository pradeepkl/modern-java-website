const { createHmac, timingSafeEqual } = require('node:crypto');
const { getRazorpayConfig } = require('./razorpayConfig');

const safeEqual = (actual, expected) => {
  const actualBuffer = Buffer.from(actual || '', 'utf8');
  const expectedBuffer = Buffer.from(expected || '', 'utf8');
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

/**
 * Create a Razorpay order using the active environment credentials.
 * @param {{ amount: number, receipt: string, notes?: Record<string, string> }} params
 * @param {ReturnType<typeof getRazorpayConfig>} [config]
 */
const createRazorpayOrder = async (
  { amount, receipt, notes },
  config = getRazorpayConfig(),
) => {
  console.info(`Creating Razorpay order in ${config.environment} mode`);

  const authorization = Buffer.from(
    `${config.keyId}:${config.keySecret}`,
  ).toString('base64');

  const result = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Basic ${authorization}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt,
      notes,
    }),
  });

  const payload = await result.json();
  if (!result.ok) {
    console.error('Razorpay order creation failed', {
      environment: config.environment,
      status: result.status,
      error: payload?.error?.description || payload?.error || 'unknown',
    });
    throw new Error('Unable to initialize payment');
  }
  return payload;
};

/**
 * Verify checkout payment signature with the active environment key secret.
 * Never falls back to another environment's secret.
 */
const verifyPaymentSignature = (
  { razorpayOrderId, razorpayPaymentId, razorpaySignature },
  config = getRazorpayConfig(),
) => {
  const expectedSignature = createHmac('sha256', config.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const valid = safeEqual(razorpaySignature, expectedSignature);
  if (!valid) {
    console.error(
      `Razorpay signature verification failed (${config.environment})`,
    );
  }
  return valid;
};

/**
 * Verify webhook signature with the active environment webhook secret.
 */
const verifyWebhookSignature = (
  { rawBody, signature },
  config = getRazorpayConfig(),
) => {
  const expected = createHmac('sha256', config.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const valid = safeEqual(signature, expected);
  if (!valid) {
    console.error(
      `Razorpay webhook signature verification failed (${config.environment})`,
    );
  } else {
    console.info(
      `Razorpay webhook received for ${config.environment} environment`,
    );
  }
  return valid;
};

/**
 * Fields returned to the browser after order creation (Key ID only).
 */
const publicOrderPaymentFields = (config = getRazorpayConfig()) => ({
  keyId: config.keyId,
  razorpayKeyId: config.keyId,
  paymentEnvironment: config.environment,
  paymentProvider: config.paymentProvider,
});

/**
 * Fields persisted on order / payment records.
 */
const persistedPaymentFields = (config = getRazorpayConfig()) => ({
  paymentProvider: config.paymentProvider,
  paymentEnvironment: config.environment,
});

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  publicOrderPaymentFields,
  persistedPaymentFields,
  safeEqual,
};
