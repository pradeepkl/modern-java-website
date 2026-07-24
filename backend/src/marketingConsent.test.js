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
  buildAmazonReviewFollowUpEmail,
  isEligibleForAmazonReviewFollowUp,
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
  it('includes benefits, membership focus, and unsubscribe link', () => {
    const email = buildWelcomeEmail({
      siteUrl: 'https://modern-java.classpath.in',
    });
    assert.equal(email.subject, 'Welcome to the Classpath Reader List');
    assert.equal(
      email.unsubscribeUrl,
      'https://modern-java.classpath.in/unsubscribe',
    );
    assert.match(email.text, /Early access to upcoming books/);
    assert.match(email.text, /Reader-only launch offers/);
    assert.match(email.text, /Practical Modern Java articles and book updates/);
    assert.match(email.text, /Priority notifications for paperback availability/);
    assert.match(
      email.text,
      /We’ll only send occasional emails that are relevant to Classpath readers/,
    );
    assert.match(email.text, /Unsubscribe anytime/);
    assert.match(email.text, /https:\/\/modern-java\.classpath\.in\/unsubscribe/);
    assert.match(email.html, /Welcome to the Classpath Reader List/);
    assert.match(email.html, /happy learning/i);
    assert.doesNotMatch(email.text, /Amazon|review/i);
    assert.doesNotMatch(email.html, /Amazon|review/i);
  });
});

describe('buildAmazonReviewFollowUpEmail', () => {
  it('acknowledges unknown purchase with buy paths then optional review', () => {
    const email = buildAmazonReviewFollowUpEmail({
      siteUrl: 'https://modern-java.classpath.in',
      amazonUrl: 'https://www.amazon.in/dp/B0H6R4334W',
      name: 'Pradeep',
    });
    assert.equal(email.subject, 'A quick follow-up on Modern Java');
    assert.match(email.text, /^Hi Pradeep,/);
    assert.match(email.text, /you showed interest in Modern Java - The Mindset Shift/);
    assert.match(email.text, /Buy directly from Classpath/);
    assert.match(email.text, /https:\/\/modern-java\.classpath\.in\/#formats/);
    assert.match(email.text, /Buy on Amazon/);
    assert.match(email.text, /If you’ve already purchased the book/);
    assert.match(email.text, /Even a few sentences/);
    assert.match(
      email.text,
      /does not affect any Classpath Reader List benefits/,
    );
    assert.doesNotMatch(email.text, /preview|chapter preview|preface/i);
    assert.doesNotMatch(email.text, /Enjoying Modern Java\?/);
    assert.match(email.html, /Buy directly from Classpath/);
    assert.match(email.html, /Leave an honest Amazon review/);
    assert.match(email.html, /happy learning/i);
    const buyIndex = email.text.indexOf('Buy directly from Classpath');
    const reviewIndex = email.text.indexOf('Leave an honest Amazon review');
    assert.ok(buyIndex >= 0 && reviewIndex > buyIndex);
    assert.doesNotMatch(
      email.text,
      /discount|coupon|reward|screenshot|review link|after purchasing/i,
    );
  });
});

describe('isEligibleForAmazonReviewFollowUp', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const base = {
    email: 'reader@example.com',
    marketingConsent: true,
    marketingConsentSource: 'amazon_exit_modal',
    marketingConsentAt: '2026-07-20T12:00:00.000Z',
  };

  it('requires Amazon-intent opt-in past the delay with active consent', () => {
    assert.equal(isEligibleForAmazonReviewFollowUp(base, { now }), true);
    assert.equal(
      isEligibleForAmazonReviewFollowUp(
        { ...base, marketingConsentAt: '2026-07-23T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForAmazonReviewFollowUp(
        { ...base, marketingConsentSource: 'sample-chapter-form' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForAmazonReviewFollowUp(
        { ...base, marketingConsent: false },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForAmazonReviewFollowUp(
        { ...base, marketingUnsubscribedAt: '2026-07-21T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForAmazonReviewFollowUp(
        { ...base, amazonReviewEmailSentAt: '2026-07-22T12:00:00.000Z' },
        { now },
      ),
      false,
    );
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
