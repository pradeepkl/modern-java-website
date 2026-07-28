const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  isAnalyticsConsentGranted,
  normalizeEmail,
  hashNormalizedEmail,
  extractMetaAttribution,
  getMetaCapiConfig,
  buildUserData,
  buildLeadEvent,
  buildPurchaseEvent,
  purchaseFieldsFromOrder,
  safeMetaLog,
  redactSecrets,
  buildCapiRequestBody,
  sendCapiEvent,
  sendMetaConversionSafely,
  sendPurchaseConversion,
  loadMetaAccessToken,
  LEAD_CUSTOM_DATA,
  __resetMetaTokenCacheForTests,
} = require('./metaConversionsApi');

describe('email normalization and hashing', () => {
  it('trims and lowercases email before hashing', () => {
    assert.equal(normalizeEmail('  Reader@Example.COM '), 'reader@example.com');
    const expected = createHash('sha256')
      .update('reader@example.com')
      .digest('hex');
    assert.equal(hashNormalizedEmail('  Reader@Example.COM '), expected);
  });

  it('returns empty hash for missing email', () => {
    assert.equal(hashNormalizedEmail(''), '');
    assert.equal(hashNormalizedEmail('not-an-email'), '');
  });
});

describe('consent gating', () => {
  it('accepts true / granted / "true"', () => {
    assert.equal(isAnalyticsConsentGranted(true), true);
    assert.equal(isAnalyticsConsentGranted('granted'), true);
    assert.equal(isAnalyticsConsentGranted('true'), true);
  });

  it('rejects absent or denied consent', () => {
    assert.equal(isAnalyticsConsentGranted(false), false);
    assert.equal(isAnalyticsConsentGranted('denied'), false);
    assert.equal(isAnalyticsConsentGranted(undefined), false);
    assert.equal(isAnalyticsConsentGranted(null), false);
  });
});

describe('payload builders', () => {
  it('builds Lead with required fields and custom data', () => {
    const event = buildLeadEvent({
      eventId: 'SR-ABC123',
      email: 'Reader@Example.COM',
      fbp: 'fb.1.123.456',
      fbc: 'fb.1.123.789',
      clientIpAddress: '203.0.113.10',
      clientUserAgent: 'Mozilla/5.0',
      eventSourceUrl: 'https://modern-java.classpath.in/#chapter-preview',
      eventTime: 1_700_000_000,
    });

    assert.equal(event.event_name, 'Lead');
    assert.equal(event.event_id, 'SR-ABC123');
    assert.equal(event.action_source, 'website');
    assert.equal(event.event_time, 1_700_000_000);
    assert.equal(
      event.event_source_url,
      'https://modern-java.classpath.in/#chapter-preview',
    );
    assert.deepEqual(event.custom_data, { ...LEAD_CUSTOM_DATA });
    assert.equal(event.user_data.em[0], hashNormalizedEmail('reader@example.com'));
    assert.equal(event.user_data.fbp, 'fb.1.123.456');
    assert.equal(event.user_data.fbc, 'fb.1.123.789');
    assert.equal(event.user_data.client_ip_address, '203.0.113.10');
    assert.equal(event.user_data.client_user_agent, 'Mozilla/5.0');
  });

  it('builds Purchase with order custom data', () => {
    const event = buildPurchaseEvent({
      eventId: 'MJ-D-ABCDEF12',
      orderId: 'MJ-D-ABCDEF12',
      value: 699,
      currency: 'INR',
      contentIds: ['modern_java_digital'],
      contentName: 'modern_java_digital',
      numItems: 1,
      email: 'buyer@example.com',
      eventSourceUrl: 'https://modern-java.classpath.in/#formats',
    });

    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, 'MJ-D-ABCDEF12');
    assert.deepEqual(event.custom_data, {
      content_ids: ['modern_java_digital'],
      content_name: 'modern_java_digital',
      content_type: 'product',
      value: 699,
      currency: 'INR',
      num_items: 1,
      order_id: 'MJ-D-ABCDEF12',
    });
  });

  it('maps digital and paperback orders', () => {
    const digital = purchaseFieldsFromOrder({
      appOrderId: 'MJ-D-1',
      productType: 'digital_bundle',
      amount: 500, // 500 paise = ₹5
      currency: 'INR',
      email: 'a@b.c',
      metaAttribution: { fbp: 'fb.1.1.1', analyticsConsent: true },
    });
    assert.equal(digital.value, 5);
    assert.deepEqual(digital.contentIds, ['modern_java_digital']);
    assert.equal(digital.numItems, 1);

    const paperback = purchaseFieldsFromOrder({
      appOrderId: 'MJ-2',
      amount: 1000, // 1000 paise = ₹10 for qty 2 at ₹5
      quantity: 2,
      currency: 'INR',
    });
    assert.equal(paperback.value, 10);
    assert.deepEqual(paperback.contentIds, ['modern_java_paperback']);
    assert.equal(paperback.numItems, 2);
  });

  it('requires event_id', () => {
    assert.throws(() => buildLeadEvent({ eventId: '' }), /event_id/);
  });
});

describe('attribution extraction', () => {
  it('reads consent and click ids from the request body', () => {
    const attribution = extractMetaAttribution({
      json: {
        analyticsConsent: true,
        fbp: 'fb.1.100.200',
        fbc: 'fb.1.100.300',
        eventSourceUrl: 'https://modern-java.classpath.in/',
        clientUserAgent: 'TestAgent/1.0',
      },
      event: {
        headers: { 'user-agent': 'HeaderAgent/1.0' },
      },
      getClientIp: () => '198.51.100.4',
    });

    assert.equal(attribution.analyticsConsent, true);
    assert.equal(attribution.fbp, 'fb.1.100.200');
    assert.equal(attribution.fbc, 'fb.1.100.300');
    assert.equal(attribution.clientIpAddress, '198.51.100.4');
    assert.equal(attribution.clientUserAgent, 'TestAgent/1.0');
  });

  it('falls back to request user-agent when body omits it', () => {
    const attribution = extractMetaAttribution({
      json: { analyticsConsent: 'granted' },
      event: { headers: { 'User-Agent': 'HeaderOnly/2' } },
      getClientIp: () => '',
    });
    assert.equal(attribution.analyticsConsent, true);
    assert.equal(attribution.clientUserAgent, 'HeaderOnly/2');
  });
});

describe('safe logging', () => {
  it('keeps only operational fields', () => {
    assert.deepEqual(
      safeMetaLog({
        event_name: 'Lead',
        event_id: 'SR-1',
        email: 'secret@example.com',
        fbp: 'fb.1',
        access_token: 'TOKEN',
        em: 'abc',
        reason: 'consent',
      }),
      {
        event_name: 'Lead',
        event_id: 'SR-1',
        reason: 'consent',
      },
    );
  });

  it('redacts access tokens from response snippets', () => {
    assert.equal(
      redactSecrets('token=SECRET123 failed SECRET123', 'SECRET123'),
      'token=[REDACTED] failed [REDACTED]',
    );
  });
});

describe('config and disable switch', () => {
  it('disables when META_CAPI_ENABLED is false', () => {
    const config = getMetaCapiConfig({
      META_CAPI_ENABLED: 'false',
      META_PIXEL_ID: '1844493498903023',
    });
    assert.equal(config.enabled, false);
  });

  it('disables when pixel id is missing', () => {
    const config = getMetaCapiConfig({
      META_CAPI_ENABLED: 'true',
      META_PIXEL_ID: '',
    });
    assert.equal(config.enabled, false);
  });

  it('treats empty or whitespace META_TEST_EVENT_CODE as absent', () => {
    for (const value of ['', '   ', undefined]) {
      const config = getMetaCapiConfig({
        META_CAPI_ENABLED: 'true',
        META_PIXEL_ID: '1844493498903023',
        META_TEST_EVENT_CODE: value,
      });
      assert.equal(config.testEventCode, '');
    }
  });
});

describe('buildCapiRequestBody test_event_code omission (prod)', () => {
  const lead = () =>
    buildLeadEvent({
      eventId: 'SR-PRODCHECK1',
      eventSourceUrl: 'https://modern-java.classpath.in/',
    });

  it('omits test_event_code entirely when META_TEST_EVENT_CODE is empty', () => {
    for (const testEventCode of ['', '   ', undefined, null]) {
      const body = buildCapiRequestBody({
        event: lead(),
        accessToken: 'meta-token',
        testEventCode,
      });
      const json = JSON.stringify(body);

      assert.equal(
        Object.prototype.hasOwnProperty.call(body, 'test_event_code'),
        false,
      );
      assert.equal(body.test_event_code, undefined);
      assert.equal(json.includes('"test_event_code"'), false);
      assert.equal(json.includes('TEST25149'), false);
      assert.doesNotMatch(json, /"test_event_code"\s*:\s*(""|null|"PROD")/);
      assert.equal(body.access_token, 'meta-token');
      assert.equal(Array.isArray(body.data), true);
    }
  });

  it('includes test_event_code only when a real code is configured', () => {
    const body = buildCapiRequestBody({
      event: lead(),
      accessToken: 'meta-token',
      testEventCode: 'TEST25149',
    });
    assert.equal(body.test_event_code, 'TEST25149');
  });

  it('safeMetaLog reports test_event_code_included false without secrets', () => {
    const logged = safeMetaLog({
      event_name: 'Lead',
      event_id: 'SR-1',
      test_event_code_included: false,
      pixel_id: '1844493498903023',
      access_token: 'should-not-appear',
      email: 'should-not-appear@example.com',
    });
    assert.equal(logged.test_event_code_included, false);
    assert.equal(logged.test_event_code, undefined);
    assert.equal(logged.access_token, undefined);
    assert.equal(logged.email, undefined);
  });
});

describe('sendCapiEvent retry and failure isolation', () => {
  beforeEach(() => {
    __resetMetaTokenCacheForTests();
  });

  it('retries transient HTTP failures then succeeds', async () => {
    let calls = 0;
    const fetchImpl = async (_url, options) => {
      calls += 1;
      const body = JSON.parse(options.body);
      assert.equal(body.test_event_code, 'TEST123');
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => 'unavailable',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1, messages: [] }),
      };
    };

    const result = await sendCapiEvent({
      event: buildLeadEvent({ eventId: 'SR-1', email: 'a@b.c' }),
      config: {
        enabled: true,
        pixelId: '123',
        graphVersion: 'v21.0',
        accessTokenSsmParam: '',
        testEventCode: 'TEST123',
      },
      accessToken: 'meta-token',
      fetchImpl,
      sleep: async () => {},
    });

    assert.equal(result.sent, true);
    assert.equal(result.attempts, 2);
    assert.equal(calls, 2);
  });

  it('includes test_event_code and purchase value/currency in payload', async () => {
    let captured;
    const fetchImpl = async (_url, options) => {
      captured = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1, messages: [] }),
      };
    };

    const result = await sendCapiEvent({
      event: buildPurchaseEvent({
        eventId: 'MJ-D-TEST1',
        orderId: 'MJ-D-TEST1',
        value: 699,
        currency: 'INR',
        contentIds: ['modern_java_digital'],
        contentName: 'modern_java_digital',
        eventSourceUrl: 'https://modern-java.classpath.in/',
      }),
      config: {
        enabled: true,
        pixelId: '1844493498903023',
        graphVersion: 'v21.0',
        accessTokenSsmParam: '',
        testEventCode: 'TEST25149',
      },
      accessToken: 'meta-token',
      fetchImpl,
      sleep: async () => {},
    });

    assert.equal(result.sent, true);
    assert.equal(captured.test_event_code, 'TEST25149');
    assert.equal(captured.data[0].event_name, 'Purchase');
    assert.equal(captured.data[0].event_id, 'MJ-D-TEST1');
    assert.equal(captured.data[0].action_source, 'website');
    assert.equal(
      captured.data[0].event_source_url,
      'https://modern-java.classpath.in/',
    );
    assert.equal(captured.data[0].custom_data.value, 699);
    assert.equal(captured.data[0].custom_data.currency, 'INR');
    assert.equal(typeof captured.data[0].event_time, 'number');
  });

  it('does not retry permanent HTTP errors', async () => {
    let calls = 0;
    const fetchImpl = async (_url, options) => {
      calls += 1;
      const body = JSON.parse(options.body);
      assert.equal(body.access_token, 'meta-token');
      assert.equal(
        Object.prototype.hasOwnProperty.call(body, 'test_event_code'),
        false,
      );
      assert.equal(String(options.body).includes('"test_event_code"'), false);
      return {
        ok: false,
        status: 400,
        text: async () => 'bad request meta-token should redact',
      };
    };

    const result = await sendCapiEvent({
      event: buildPurchaseEvent({
        eventId: 'MJ-1',
        orderId: 'MJ-1',
        value: 699,
        contentIds: ['modern_java_digital'],
        contentName: 'modern_java_digital',
      }),
      config: {
        enabled: true,
        pixelId: '123',
        graphVersion: 'v21.0',
        accessTokenSsmParam: '',
        testEventCode: '',
      },
      accessToken: 'meta-token',
      fetchImpl,
      sleep: async () => {},
    });

    assert.equal(result.sent, false);
    assert.equal(result.reason, 'http_error');
    assert.equal(calls, 1);
  });

  it('skips when token missing', async () => {
    const result = await sendCapiEvent({
      event: buildLeadEvent({ eventId: 'SR-1' }),
      config: {
        enabled: true,
        pixelId: '123',
        graphVersion: 'v21.0',
        accessTokenSsmParam: '',
        testEventCode: '',
      },
      accessToken: '',
      fetchImpl: async () => {
        throw new Error('should not fetch');
      },
    });
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'missing_token');
  });
});

describe('sendMetaConversionSafely consent and disable', () => {
  it('does not send without analytics consent', async () => {
    const result = await sendMetaConversionSafely({
      eventName: 'Lead',
      analyticsConsent: false,
      source: 'test',
      env: {
        META_CAPI_ENABLED: 'true',
        META_PIXEL_ID: '123',
        META_ACCESS_TOKEN: 'token',
      },
      buildEvent: () => buildLeadEvent({ eventId: 'SR-1' }),
      send: async () => {
        throw new Error('should not send');
      },
    });
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'consent');
  });

  it('never throws when builder or send fails', async () => {
    const result = await sendMetaConversionSafely({
      eventName: 'Purchase',
      analyticsConsent: true,
      source: 'test',
      env: {
        META_CAPI_ENABLED: 'true',
        META_PIXEL_ID: '123',
        META_ACCESS_TOKEN: 'token',
      },
      buildEvent: () => {
        throw new Error('boom');
      },
    });
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'unexpected_error');
  });
});

describe('Lead / Purchase helpers', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    process.env.META_PIXEL_ID = '1844493498903023';
    process.env.META_CAPI_ENABLED = 'true';
    process.env.META_ACCESS_TOKEN = 'test-token';
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) delete process.env[key];
    }
    Object.assign(process.env, previousEnv);
    __resetMetaTokenCacheForTests();
  });

  it('sends Lead when consented via mocked send path', async () => {
    /** @type {Record<string, unknown> | undefined} */
    let captured;
    const result = await sendMetaConversionSafely({
      eventName: 'Lead',
      analyticsConsent: true,
      source: 'sample_request',
      env: {
        META_CAPI_ENABLED: 'true',
        META_PIXEL_ID: '123',
        META_ACCESS_TOKEN: 'token',
      },
      buildEvent: () => buildLeadEvent({ eventId: 'SR-XYZ', email: 'a@b.c' }),
      send: async ({ event }) => {
        captured = event;
        return { sent: true, attempts: 1, httpStatus: 200 };
      },
    });
    assert.equal(result.sent, true);
    assert.equal(captured?.event_id, 'SR-XYZ');
  });

  it('Purchase helper respects stored order attribution consent', async () => {
    const result = await sendPurchaseConversion({
      order: {
        appOrderId: 'MJ-D-1',
        productType: 'digital_bundle',
        amount: 69900,
        currency: 'INR',
        email: 'buyer@example.com',
        metaAttribution: { analyticsConsent: false },
      },
      source: 'verify',
    });
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'consent');
  });
});

describe('token loading', () => {
  afterEach(() => {
    __resetMetaTokenCacheForTests();
  });

  it('prefers inline META_ACCESS_TOKEN for tests', async () => {
    const token = await loadMetaAccessToken({
      env: { META_ACCESS_TOKEN: 'inline-token' },
      ssmClient: {
        send: async () => {
          throw new Error('ssm should not be called');
        },
      },
    });
    assert.equal(token, 'inline-token');
  });

  it('loads from SSM SecureString and caches', async () => {
    let calls = 0;
    const ssmClient = {
      send: async () => {
        calls += 1;
        return { Parameter: { Value: 'ssm-token' } };
      },
    };

    const first = await loadMetaAccessToken({
      env: {},
      ssmParam: '/modern-java/meta/access-token',
      ssmClient,
      now: 1000,
    });
    const second = await loadMetaAccessToken({
      env: {},
      ssmParam: '/modern-java/meta/access-token',
      ssmClient,
      now: 2000,
    });

    assert.equal(first, 'ssm-token');
    assert.equal(second, 'ssm-token');
    assert.equal(calls, 1);
  });
});

describe('deduplication event ids', () => {
  it('uses sample request id and order id as event_id', () => {
    const lead = buildLeadEvent({ eventId: 'SR-STABLE' });
    const purchase = buildPurchaseEvent({
      eventId: 'MJ-D-STABLE',
      orderId: 'MJ-D-STABLE',
      value: 699,
      contentIds: ['modern_java_digital'],
      contentName: 'modern_java_digital',
    });
    assert.equal(lead.event_id, 'SR-STABLE');
    assert.equal(purchase.event_id, 'MJ-D-STABLE');
    assert.equal(purchase.custom_data.order_id, 'MJ-D-STABLE');
  });
});

describe('buildUserData omits empty fields', () => {
  it('does not include empty hashes or click ids', () => {
    assert.deepEqual(buildUserData({ email: '', fbp: '', fbc: '' }), {});
  });
});
