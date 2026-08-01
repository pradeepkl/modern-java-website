const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizePath,
  sanitizeUtmValue,
  extractConsentChoicePayload,
  recordAnalyticsConsentChoice,
} = require('./analyticsConsent');

describe('analyticsConsent helpers', () => {
  it('normalizes path and rejects non-path values', () => {
    assert.equal(sanitizePath('/formats'), '/formats');
    assert.equal(sanitizePath('formats'), '/');
    const longPath = `/${'x'.repeat(250)}`;
    assert.equal(sanitizePath(longPath).length, 200);
    assert.equal(sanitizePath(longPath).startsWith('/x'), true);
  });

  it('accepts simple utm tokens only', () => {
    assert.equal(sanitizeUtmValue('facebook'), 'facebook');
    assert.equal(sanitizeUtmValue('a'.repeat(121)), '');
    assert.equal(sanitizeUtmValue('bad value!'), '');
  });

  it('extracts granted/denied choices with optional utm', () => {
    const payload = extractConsentChoicePayload({
      choice: 'granted',
      path: '/formats?x=1#card',
      utm_source: 'facebook',
      email: 'should-ignore@example.com',
    });
    assert.equal(payload.choice, 'granted');
    assert.equal(payload.path, '/formats');
    assert.deepEqual(payload.utm, { utm_source: 'facebook' });
  });
});

describe('recordAnalyticsConsentChoice', () => {
  it('rejects invalid choice', async () => {
    const result = await recordAnalyticsConsentChoice({
      event: {},
      parseBody: () => ({ json: { choice: 'maybe' } }),
      response: (statusCode, body) => ({ statusCode, body }),
    });
    assert.equal(result.statusCode, 400);
  });

  it('records a valid denied choice', async () => {
    const logs = [];
    const original = console.info;
    console.info = (...args) => logs.push(args);
    try {
      const result = await recordAnalyticsConsentChoice({
        event: {},
        parseBody: () => ({
          json: {
            choice: 'denied',
            path: '/chapter-preview',
            utm_campaign: 'modern_java_launch',
          },
        }),
        response: (statusCode, body) => ({ statusCode, body }),
      });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.recorded, true);
      assert.equal(logs[0][0], 'analytics_consent_choice');
      assert.equal(logs[0][1].choice, 'denied');
      assert.equal(logs[0][1].utm_campaign, 'modern_java_launch');
      assert.equal(logs[0][1].email, undefined);
    } finally {
      console.info = original;
    }
  });
});
