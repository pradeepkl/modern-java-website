/**
 * Centralized Razorpay configuration.
 *
 * Each deployment stack injects only one credential set (from
 * sam-secrets.env.dev or sam-secrets.env.prod). APP_ENV selects validation
 * rules; there is no runtime fallback between test and live secrets.
 */

const ACCEPTED_ENVIRONMENTS = new Set(['dev', 'prod']);

const maskKeyId = (keyId) => {
  const value = String(keyId || '');
  if (value.length < 12) return '****';
  return `${value.slice(0, 9)}****${value.slice(-4)}`;
};

const requireEnv = (name, env = process.env) => {
  const value = String(env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'dev' | 'prod'}
 */
const getAppEnvironment = (env = process.env) => {
  const raw = String(env.APP_ENV || '').trim();
  if (!ACCEPTED_ENVIRONMENTS.has(raw)) {
    throw new Error(
      `Unsupported APP_ENV "${raw || '(empty)'}". Accepted values: dev, prod.`,
    );
  }
  return /** @type {'dev' | 'prod'} */ (raw);
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   environment: 'dev' | 'prod',
 *   keyId: string,
 *   keySecret: string,
 *   webhookSecret: string,
 *   isProduction: boolean,
 *   paymentProvider: 'razorpay',
 * }}
 */
const getRazorpayConfig = (env = process.env) => {
  const environment = getAppEnvironment(env);
  const keyId = requireEnv('RAZORPAY_KEY_ID', env);
  const keySecret = requireEnv('RAZORPAY_KEY_SECRET', env);
  const webhookSecret = requireEnv('RAZORPAY_WEBHOOK_SECRET', env);

  if (environment === 'dev') {
    if (!keyId.startsWith('rzp_test_')) {
      throw new Error(
        `APP_ENV=dev requires RAZORPAY_KEY_ID to start with rzp_test_ (got ${maskKeyId(keyId)})`,
      );
    }
    if (keyId.startsWith('rzp_live_')) {
      throw new Error('APP_ENV=dev must not use a live Razorpay key');
    }
  }

  if (environment === 'prod') {
    if (!keyId.startsWith('rzp_live_')) {
      throw new Error(
        `APP_ENV=prod requires RAZORPAY_KEY_ID to start with rzp_live_ (got ${maskKeyId(keyId)})`,
      );
    }
    if (keyId.startsWith('rzp_test_')) {
      throw new Error('APP_ENV=prod must not use a test Razorpay key');
    }
  }

  return {
    environment,
    keyId,
    keySecret,
    webhookSecret,
    isProduction: environment === 'prod',
    paymentProvider: 'razorpay',
  };
};

/**
 * Safe one-line diagnostic (never includes secrets).
 * @param {ReturnType<typeof getRazorpayConfig>} [config]
 */
const formatRazorpayDiagnostics = (config = getRazorpayConfig()) =>
  `Razorpay environment: ${config.environment}\nRazorpay key: ${maskKeyId(config.keyId)}`;

/**
 * Backward-compatible read for persisted orders.
 * Historical test-mode records (no paymentEnvironment) are treated as dev.
 * @param {{ paymentEnvironment?: string } | null | undefined} order
 * @returns {'dev' | 'prod'}
 */
const resolvePaymentEnvironment = (order) => {
  const value = String(order?.paymentEnvironment || '').trim();
  if (value === 'prod') return 'prod';
  return 'dev';
};

module.exports = {
  ACCEPTED_ENVIRONMENTS,
  getAppEnvironment,
  getRazorpayConfig,
  formatRazorpayDiagnostics,
  maskKeyId,
  resolvePaymentEnvironment,
};
