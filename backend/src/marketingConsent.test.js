const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CREATED_MESSAGE,
  ALREADY_ON_LIST_MESSAGE,
  AMAZON_EXIT_SOURCE,
  SOURCE_VERSION,
  isConditionalCheckFailed,
  resolveMarketingSource,
  normalizeAttribution,
  buildFirstOptInUpdate,
  buildExistingSubscriberUpdate,
  buildWelcomeEmail,
} = require('./marketingConsent');

describe('resolveMarketingSource', () => {
  it('defaults unknown sources to amazon_exit_modal', () => {
    assert.equal(resolveMarketingSource(''), AMAZON_EXIT_SOURCE);
    assert.equal(resolveMarketingSource('weird'), AMAZON_EXIT_SOURCE);
  });

  it('preserves allowlisted historical and current sources', () => {
    assert.equal(resolveMarketingSource('amazon-pre-navigation'), 'amazon-pre-navigation');
    assert.equal(resolveMarketingSource(AMAZON_EXIT_SOURCE), AMAZON_EXIT_SOURCE);
  });
});

describe('buildFirstOptInUpdate', () => {
  it('requires marketingConsent not already true and sets sourceVersion 2 for exit modal', () => {
    const update = buildFirstOptInUpdate({
      source: AMAZON_EXIT_SOURCE,
      consentVersion: '2026-07-24',
      attribution: {
        landingPage: 'https://modern-java.classpath.in/',
        utmSource: 'newsletter',
      },
      now: '2026-07-24T10:00:00.000Z',
    });

    assert.match(
      update.ConditionExpression,
      /attribute_not_exists\(marketingConsent\) OR marketingConsent = :notConsented/,
    );
    assert.equal(update.ExpressionAttributeValues[':source'], AMAZON_EXIT_SOURCE);
    assert.equal(update.ExpressionAttributeValues[':sourceVersion'], SOURCE_VERSION);
    assert.equal(update.ExpressionAttributeValues[':consented'], true);
    assert.equal(update.ExpressionAttributeValues[':landingPage'], 'https://modern-java.classpath.in/');
    assert.match(update.UpdateExpression, /SET /);
    assert.match(update.UpdateExpression, /REMOVE marketingUnsubscribedAt/);
    assert.ok(
      update.UpdateExpression.indexOf('#landingPage') <
        update.UpdateExpression.indexOf('REMOVE'),
    );
  });
});

describe('buildExistingSubscriberUpdate', () => {
  it('does not rewrite marketingConsentSource', () => {
    const update = buildExistingSubscriberUpdate({
      attribution: { utmCampaign: 'spring' },
      now: '2026-07-24T10:00:00.000Z',
    });

    assert.doesNotMatch(update.UpdateExpression, /marketingConsentSource/);
    assert.equal(update.ExpressionAttributeValues[':utmCampaign'], 'spring');
    assert.equal(update.ConditionExpression, 'marketingConsent = :consented');
  });
});

describe('buildWelcomeEmail', () => {
  it('includes benefits, independent review wording, and unsubscribe link', () => {
    const email = buildWelcomeEmail({
      siteUrl: 'https://modern-java.classpath.in',
    });
    assert.equal(email.subject, 'Welcome to the Classpath Reader List');
    assert.equal(
      email.unsubscribeUrl,
      'https://modern-java.classpath.in/unsubscribe',
    );
    assert.match(email.text, /early access to upcoming books/);
    assert.match(email.text, /reader-only launch offers/);
    assert.match(email.text, /Modern Java updates and practical articles/);
    assert.match(email.text, /paperback availability updates/);
    assert.match(
      email.text,
      /Your reader-list benefits are not dependent on leaving a review/,
    );
    assert.match(
      email.text,
      /You can unsubscribe at any time using the link below/,
    );
    assert.match(email.text, /https:\/\/modern-java\.classpath\.in\/unsubscribe/);
    assert.doesNotMatch(email.text, /after purchasing|review url|screenshot/i);
  });
});

describe('isConditionalCheckFailed', () => {
  it('detects DynamoDB conditional failures', () => {
    assert.equal(
      isConditionalCheckFailed({ name: 'ConditionalCheckFailedException' }),
      true,
    );
    assert.equal(isConditionalCheckFailed({ name: 'Other' }), false);
  });
});

describe('normalizeAttribution', () => {
  it('trims and drops empty attribution fields', () => {
    assert.deepEqual(
      normalizeAttribution({
        landingPage: '  https://example.com  ',
        referrer: ' ',
        utmSource: 'twitter',
      }),
      {
        landingPage: 'https://example.com',
        referrer: undefined,
        utmSource: 'twitter',
        utmMedium: undefined,
        utmCampaign: undefined,
      },
    );
  });
});

describe('messages', () => {
  it('exposes created and already-on-list copy', () => {
    assert.match(CREATED_MESSAGE, /Classpath Reader List/);
    assert.match(ALREADY_ON_LIST_MESSAGE, /already on the Classpath Reader List/);
  });
});
