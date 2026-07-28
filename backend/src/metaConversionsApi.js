/**
 * Meta Conversions API (CAPI) — Lead and Purchase only.
 *
 * Access token is loaded from SSM SecureString (or META_ACCESS_TOKEN for tests).
 * Never log tokens, raw emails, _fbp/_fbc, or hashed identifiers.
 * Delivery failures must not fail sample / purchase workflows.
 */

const { createHash } = require('node:crypto');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const DEFAULT_GRAPH_VERSION = 'v21.0';
const REQUEST_TIMEOUT_MS = 2500;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const LEAD_CUSTOM_DATA = Object.freeze({
  content_name: 'Modern Java Sample Chapter',
  content_category: 'Book sample',
});

/** @type {SSMClient | null} */
let defaultSsm = null;
/** @type {Map<string, { value: string, expiresAt: number }>} */
const tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

const getSsm = () => {
  if (!defaultSsm) defaultSsm = new SSMClient({});
  return defaultSsm;
};

/**
 * @param {unknown} value
 * @returns {boolean}
 */
const isAnalyticsConsentGranted = (value) =>
  value === true || value === 'true' || value === 'granted';

/**
 * @param {unknown} email
 * @returns {string}
 */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * @param {unknown} email
 * @returns {string} SHA-256 hex digest, or empty string when email is missing
 */
const hashNormalizedEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) return '';
  return createHash('sha256').update(normalized).digest('hex');
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const sanitizeClickId = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 512) return '';
  // Meta _fbp / _fbc are printable ASCII; reject obvious junk.
  if (!/^[\x20-\x7E]+$/.test(raw)) return '';
  return raw;
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const sanitizeUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 2048) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const sanitizeUserAgent = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 1024) return '';
  return raw;
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const sanitizeIp = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 64) return '';
  return raw;
};

/**
 * Pull Meta attribution + analytics consent from an API request body / headers.
 * Does not invent PII — only forwards consented click IDs already present.
 *
 * @param {{
 *   json?: Record<string, unknown>,
 *   event?: { headers?: Record<string, string | undefined>, requestContext?: any },
 *   getClientIp?: (event: unknown) => string,
 * }} input
 */
const extractMetaAttribution = ({
  json = {},
  event = {},
  getClientIp = () => '',
} = {}) => {
  const analyticsConsent = isAnalyticsConsentGranted(json.analyticsConsent);
  const headers = event.headers || {};
  const headerUa =
    headers['user-agent'] || headers['User-Agent'] || headers['user-Agent'] || '';

  return {
    analyticsConsent,
    fbp: sanitizeClickId(json.fbp),
    fbc: sanitizeClickId(json.fbc),
    eventSourceUrl: sanitizeUrl(json.eventSourceUrl),
    clientUserAgent: sanitizeUserAgent(json.clientUserAgent || headerUa),
    clientIpAddress: sanitizeIp(getClientIp(event)),
  };
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
const isMetaCapiEnabled = (env = process.env) => {
  const flag = String(env.META_CAPI_ENABLED || 'true').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  return true;
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
const getMetaCapiConfig = (env = process.env) => {
  const pixelId = String(env.META_PIXEL_ID || '').trim();
  const graphVersion =
    String(env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION).trim() ||
    DEFAULT_GRAPH_VERSION;
  const accessTokenSsmParam = String(
    env.META_ACCESS_TOKEN_SSM_PARAM || '',
  ).trim();
  const testEventCode = String(env.META_TEST_EVENT_CODE || '').trim();
  const enabled = isMetaCapiEnabled(env) && Boolean(pixelId);

  return {
    enabled,
    pixelId,
    graphVersion,
    accessTokenSsmParam,
    testEventCode,
  };
};

/**
 * @param {{
 *   ssmParam?: string,
 *   env?: NodeJS.ProcessEnv,
 *   ssmClient?: SSMClient,
 *   now?: number,
 * }} [options]
 * @returns {Promise<string>}
 */
const loadMetaAccessToken = async ({
  ssmParam,
  env = process.env,
  ssmClient = getSsm(),
  now = Date.now(),
} = {}) => {
  const inline = String(env.META_ACCESS_TOKEN || '').trim();
  if (inline) return inline;

  const paramName =
    String(ssmParam || env.META_ACCESS_TOKEN_SSM_PARAM || '').trim();
  if (!paramName) return '';

  const cached = tokenCache.get(paramName);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const result = await ssmClient.send(
      new GetParameterCommand({
        Name: paramName,
        WithDecryption: true,
      }),
    );
    const value = String(result.Parameter?.Value || '').trim();
    if (value) {
      tokenCache.set(paramName, {
        value,
        expiresAt: now + TOKEN_CACHE_TTL_MS,
      });
    }
    return value;
  } catch (error) {
    console.error('meta_capi_token_load_failed', {
      paramConfigured: Boolean(paramName),
      errorName: error?.name || 'Error',
    });
    return '';
  }
};

/**
 * @param {{
 *   email?: string,
 *   fbp?: string,
 *   fbc?: string,
 *   clientIpAddress?: string,
 *   clientUserAgent?: string,
 * }} input
 */
const buildUserData = ({
  email,
  fbp,
  fbc,
  clientIpAddress,
  clientUserAgent,
} = {}) => {
  /** @type {Record<string, string | string[]>} */
  const userData = {};
  const em = hashNormalizedEmail(email);
  if (em) userData.em = [em];

  const cleanFbp = sanitizeClickId(fbp);
  if (cleanFbp) userData.fbp = cleanFbp;

  const cleanFbc = sanitizeClickId(fbc);
  if (cleanFbc) userData.fbc = cleanFbc;

  const ip = sanitizeIp(clientIpAddress);
  if (ip) userData.client_ip_address = ip;

  const ua = sanitizeUserAgent(clientUserAgent);
  if (ua) userData.client_user_agent = ua;

  return userData;
};

/**
 * @param {{
 *   eventName: 'Lead' | 'Purchase',
 *   eventId: string,
 *   eventTime?: number,
 *   eventSourceUrl?: string,
 *   userData?: Record<string, unknown>,
 *   customData?: Record<string, unknown>,
 * }} input
 */
const buildCapiEvent = ({
  eventName,
  eventId,
  eventTime = Math.floor(Date.now() / 1000),
  eventSourceUrl,
  userData = {},
  customData = {},
}) => {
  const id = String(eventId || '').trim();
  if (!eventName || !id) {
    throw new Error('Meta CAPI event requires event_name and event_id');
  }

  /** @type {Record<string, unknown>} */
  const event = {
    event_name: eventName,
    event_time: eventTime,
    event_id: id,
    action_source: 'website',
    user_data: userData,
  };

  const url = sanitizeUrl(eventSourceUrl);
  if (url) event.event_source_url = url;

  if (customData && Object.keys(customData).length > 0) {
    event.custom_data = customData;
  }

  return event;
};

/**
 * @param {{
 *   eventId: string,
 *   eventSourceUrl?: string,
 *   email?: string,
 *   fbp?: string,
 *   fbc?: string,
 *   clientIpAddress?: string,
 *   clientUserAgent?: string,
 *   eventTime?: number,
 * }} input
 */
const buildLeadEvent = (input) =>
  buildCapiEvent({
    eventName: 'Lead',
    eventId: input.eventId,
    eventTime: input.eventTime,
    eventSourceUrl: input.eventSourceUrl,
    userData: buildUserData(input),
    customData: { ...LEAD_CUSTOM_DATA },
  });

/**
 * @param {{
 *   eventId: string,
 *   orderId: string,
 *   value: number,
 *   currency?: string,
 *   contentIds: string[],
 *   contentName: string,
 *   numItems?: number,
 *   eventSourceUrl?: string,
 *   email?: string,
 *   fbp?: string,
 *   fbc?: string,
 *   clientIpAddress?: string,
 *   clientUserAgent?: string,
 *   eventTime?: number,
 * }} input
 */
const buildPurchaseEvent = (input) => {
  const contentIds = Array.isArray(input.contentIds)
    ? input.contentIds.filter((id) => typeof id === 'string' && id.trim())
    : [];

  return buildCapiEvent({
    eventName: 'Purchase',
    eventId: input.eventId,
    eventTime: input.eventTime,
    eventSourceUrl: input.eventSourceUrl,
    userData: buildUserData(input),
    customData: {
      content_ids: contentIds,
      content_name: String(input.contentName || ''),
      content_type: 'product',
      value: Number(input.value),
      currency: String(input.currency || 'INR'),
      num_items: Number(input.numItems || 1),
      order_id: String(input.orderId || input.eventId),
    },
  });
};

/**
 * Map a paid order record to Purchase CAPI fields.
 * @param {Record<string, any>} order
 */
const purchaseFieldsFromOrder = (order) => {
  const isDigital = order.productType === 'digital_bundle';
  const format = isDigital ? 'digital' : 'paperback';
  const quantity = Math.max(1, Number(order.quantity || 1));
  const amountPaise = Number(order.amount || 0);
  const value = amountPaise / 100;
  const contentId = `modern_java_${format}`;

  return {
    eventId: String(order.appOrderId || ''),
    orderId: String(order.appOrderId || ''),
    value,
    currency: String(order.currency || 'INR'),
    contentIds: [contentId],
    contentName: contentId,
    numItems: quantity,
    email: order.email,
    fbp: order.metaAttribution?.fbp,
    fbc: order.metaAttribution?.fbc,
    eventSourceUrl: order.metaAttribution?.eventSourceUrl,
    clientUserAgent: order.metaAttribution?.clientUserAgent,
    clientIpAddress: order.metaAttribution?.clientIpAddress,
  };
};

/**
 * Safe operational log fields only.
 * @param {Record<string, unknown>} fields
 */
const safeMetaLog = (fields) => {
  const allowed = [
    'event_name',
    'event_id',
    'event_time',
    'action_source',
    'event_source_url',
    'test_event_code',
    'pixel_id',
    'value',
    'currency',
    'events_received',
    'messages',
    'status',
    'reason',
    'attempt',
    'httpStatus',
    'enabled',
    'pixelConfigured',
    'tokenConfigured',
    'consent',
    'source',
  ];
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of allowed) {
    if (fields[key] !== undefined) out[key] = fields[key];
  }
  return out;
};

/**
 * @param {unknown} text
 * @param {string} token
 */
const redactSecrets = (text, token) => {
  let out = String(text || '');
  if (token) {
    out = out.split(token).join('[REDACTED]');
  }
  return out;
};

/**
 * @param {{
 *   event: Record<string, unknown>,
 *   config?: ReturnType<typeof getMetaCapiConfig>,
 *   accessToken?: string,
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 * }} input
 * @returns {Promise<{
 *   sent: boolean,
 *   reason?: string,
 *   httpStatus?: number,
 *   attempts: number,
 * }>}
 */
const sendCapiEvent = async ({
  event,
  config = getMetaCapiConfig(),
  accessToken,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) => {
  if (!config.enabled) {
    return { sent: false, reason: 'disabled', attempts: 0 };
  }

  const token = String(accessToken || '').trim();
  if (!token) {
    console.info(
      'meta_capi_skipped',
      safeMetaLog({
        event_name: event.event_name,
        event_id: event.event_id,
        reason: 'missing_token',
        pixelConfigured: Boolean(config.pixelId),
        tokenConfigured: false,
      }),
    );
    return { sent: false, reason: 'missing_token', attempts: 0 };
  }

  if (typeof fetchImpl !== 'function') {
    return { sent: false, reason: 'fetch_unavailable', attempts: 0 };
  }

  const endpoint = `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`;
  /** @type {Record<string, unknown>} */
  const body = {
    data: [event],
    access_token: token,
  };
  if (config.testEventCode) {
    body.test_event_code = config.testEventCode;
  }

  let attempts = 0;
  let lastStatus;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      lastStatus = response.status;

      if (response.ok) {
        let metaMessages = [];
        let eventsReceived;
        try {
          const payload = await response.json();
          eventsReceived = payload?.events_received;
          metaMessages = Array.isArray(payload?.messages)
            ? payload.messages
            : [];
        } catch {
          metaMessages = [];
        }
        const customData =
          event.custom_data && typeof event.custom_data === 'object'
            ? event.custom_data
            : {};
        console.info(
          'meta_capi_sent',
          safeMetaLog({
            event_name: event.event_name,
            event_id: event.event_id,
            event_time: event.event_time,
            action_source: event.action_source,
            event_source_url: event.event_source_url || null,
            test_event_code: config.testEventCode || null,
            pixel_id: config.pixelId,
            value: customData.value,
            currency: customData.currency,
            events_received: eventsReceived,
            messages: metaMessages,
            status: 'ok',
            httpStatus: response.status,
            attempt: attempts,
          }),
        );
        return { sent: true, httpStatus: response.status, attempts };
      }

      const retryable = RETRYABLE_STATUS.has(response.status);
      let responseText = '';
      try {
        responseText = await response.text();
      } catch {
        responseText = '';
      }

      console.error(
        'meta_capi_http_error',
        safeMetaLog({
          event_name: event.event_name,
          event_id: event.event_id,
          httpStatus: response.status,
          attempt: attempts,
          reason: retryable ? 'transient_http' : 'http_error',
        }),
        redactSecrets(responseText.slice(0, 200), token),
      );

      if (!retryable || attempts >= MAX_ATTEMPTS) {
        return {
          sent: false,
          reason: 'http_error',
          httpStatus: response.status,
          attempts,
        };
      }
    } catch (error) {
      const reason =
        error?.name === 'AbortError' ? 'timeout' : 'network_error';
      console.error(
        'meta_capi_request_failed',
        safeMetaLog({
          event_name: event.event_name,
          event_id: event.event_id,
          attempt: attempts,
          reason,
        }),
      );
      if (attempts >= MAX_ATTEMPTS) {
        return { sent: false, reason, httpStatus: lastStatus, attempts };
      }
    } finally {
      clearTimeout(timer);
    }

    await sleep(150 * attempts);
  }

  return { sent: false, reason: 'exhausted', httpStatus: lastStatus, attempts };
};

/**
 * Fire-and-forget safe sender. Never throws.
 * @param {{
 *   eventName: 'Lead' | 'Purchase',
 *   buildEvent: () => Record<string, unknown>,
 *   analyticsConsent: boolean,
 *   source: string,
 *   env?: NodeJS.ProcessEnv,
 *   loadToken?: typeof loadMetaAccessToken,
 *   send?: typeof sendCapiEvent,
 * }} input
 */
const sendMetaConversionSafely = async ({
  eventName,
  buildEvent,
  analyticsConsent,
  source,
  env = process.env,
  loadToken = loadMetaAccessToken,
  send = sendCapiEvent,
}) => {
  try {
    const config = getMetaCapiConfig(env);
    if (!config.enabled) {
      console.info(
        'meta_capi_skipped',
        safeMetaLog({
          event_name: eventName,
          reason: 'disabled',
          source,
          enabled: false,
        }),
      );
      return { sent: false, reason: 'disabled' };
    }

    if (!isAnalyticsConsentGranted(analyticsConsent)) {
      console.info(
        'meta_capi_skipped',
        safeMetaLog({
          event_name: eventName,
          reason: 'consent',
          source,
          consent: false,
        }),
      );
      return { sent: false, reason: 'consent' };
    }

    const event = buildEvent();
    const accessToken = await loadToken({ env });
    return await send({ event, config, accessToken });
  } catch (error) {
    console.error(
      'meta_capi_unexpected_error',
      safeMetaLog({
        event_name: eventName,
        reason: error?.name || 'Error',
        source,
      }),
    );
    return { sent: false, reason: 'unexpected_error' };
  }
};

/**
 * @param {{
 *   sampleRequestId: string,
 *   attribution: ReturnType<typeof extractMetaAttribution>,
 *   email?: string,
 *   source?: string,
 * }} input
 */
const sendLeadConversion = async ({
  sampleRequestId,
  attribution,
  email,
  source = 'sample_request',
}) =>
  sendMetaConversionSafely({
    eventName: 'Lead',
    analyticsConsent: attribution.analyticsConsent,
    source,
    buildEvent: () =>
      buildLeadEvent({
        eventId: sampleRequestId,
        email,
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        eventSourceUrl: attribution.eventSourceUrl,
        clientUserAgent: attribution.clientUserAgent,
        clientIpAddress: attribution.clientIpAddress,
      }),
  });

/**
 * @param {{
 *   order: Record<string, any>,
 *   source?: string,
 * }} input
 */
const sendPurchaseConversion = async ({ order, source = 'payment_verified' }) => {
  const attribution = order.metaAttribution || {};
  const fields = purchaseFieldsFromOrder(order);

  return sendMetaConversionSafely({
    eventName: 'Purchase',
    analyticsConsent: attribution.analyticsConsent === true,
    source,
    buildEvent: () => buildPurchaseEvent(fields),
  });
};

/** Test helper */
const __resetMetaTokenCacheForTests = () => {
  tokenCache.clear();
};

module.exports = {
  DEFAULT_GRAPH_VERSION,
  LEAD_CUSTOM_DATA,
  isAnalyticsConsentGranted,
  normalizeEmail,
  hashNormalizedEmail,
  sanitizeClickId,
  extractMetaAttribution,
  isMetaCapiEnabled,
  getMetaCapiConfig,
  loadMetaAccessToken,
  buildUserData,
  buildCapiEvent,
  buildLeadEvent,
  buildPurchaseEvent,
  purchaseFieldsFromOrder,
  safeMetaLog,
  redactSecrets,
  sendCapiEvent,
  sendMetaConversionSafely,
  sendLeadConversion,
  sendPurchaseConversion,
  __resetMetaTokenCacheForTests,
};
