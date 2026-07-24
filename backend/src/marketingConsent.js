/**
 * Classpath Reader List / marketing consent helpers for POST /marketing-consents.
 *
 * Historical marketingConsentSource values such as amazon-pre-navigation are
 * preserved on existing rows. New Amazon exit-modal signups use
 * amazon_exit_modal with sourceVersion "2".
 */

const CREATED_MESSAGE =
  'Your email preferences have been saved. You’re on the Classpath Reader List.';
const ALREADY_ON_LIST_MESSAGE =
  'You’re already on the Classpath Reader List.';
const AMAZON_EXIT_SOURCE = 'amazon_exit_modal';
const SOURCE_VERSION = '2';
const CONSENT_TYPE = 'reader_list_opt_in';
const ALLOWED_SOURCES = new Set([
  AMAZON_EXIT_SOURCE,
  'amazon-pre-navigation',
  'digital-checkout',
  'sample-chapter-form',
]);

function isConditionalCheckFailed(error) {
  return (
    error?.name === 'ConditionalCheckFailedException' ||
    error?.Code === 'ConditionalCheckFailedException' ||
    Boolean(error?.__type?.includes('ConditionalCheckFailed'))
  );
}

function resolveMarketingSource(rawSource) {
  const source = String(rawSource || '').trim();
  if (ALLOWED_SOURCES.has(source)) return source;
  return AMAZON_EXIT_SOURCE;
}

function optionalString(value, maxLength = 500) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function normalizeAttribution(json = {}) {
  return {
    landingPage: optionalString(json.landingPage, 1000),
    referrer: optionalString(json.referrer, 1000),
    utmSource: optionalString(json.utmSource, 200),
    utmMedium: optionalString(json.utmMedium, 200),
    utmCampaign: optionalString(json.utmCampaign, 200),
  };
}

function appendAttributionToUpdate(update, attribution) {
  const names = { ...(update.ExpressionAttributeNames || {}) };
  const values = { ...(update.ExpressionAttributeValues || {}) };
  const sets = [];

  const fields = [
    ['landingPage', attribution.landingPage],
    ['referrer', attribution.referrer],
    ['utmSource', attribution.utmSource],
    ['utmMedium', attribution.utmMedium],
    ['utmCampaign', attribution.utmCampaign],
  ];

  for (const [field, value] of fields) {
    if (value === undefined) continue;
    const nameKey = `#${field}`;
    const valueKey = `:${field}`;
    names[nameKey] = field;
    values[valueKey] = value;
    sets.push(`${nameKey} = ${valueKey}`);
  }

  if (sets.length === 0) {
    return update;
  }

  const expression = String(update.UpdateExpression);
  const removeIndex = expression.search(/\sREMOVE\s/i);
  const nextExpression =
    removeIndex === -1
      ? `${expression}, ${sets.join(', ')}`
      : `${expression.slice(0, removeIndex)}, ${sets.join(', ')}${expression.slice(removeIndex)}`;

  return {
    ...update,
    UpdateExpression: nextExpression,
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values,
  };
}

/**
 * Atomic first valid marketing opt-in.
 * Succeeds only when marketingConsent is missing or false.
 */
function buildFirstOptInUpdate({
  source,
  consentVersion,
  attribution = {},
  now,
}) {
  const resolvedSource = resolveMarketingSource(source);
  let update = {
    UpdateExpression:
      'SET marketingConsent = :consented, ' +
      'marketingConsentAt = if_not_exists(marketingConsentAt, :now), ' +
      'marketingConsentUpdatedAt = :now, ' +
      'consentVersion = :version, ' +
      'marketingConsentSource = :source, ' +
      'sourceVersion = :sourceVersion, ' +
      'consentType = :consentType, ' +
      'createdAt = if_not_exists(createdAt, :now), ' +
      'updatedAt = :now, ' +
      'marketingStatus = :status ' +
      'REMOVE marketingUnsubscribedAt',
    ConditionExpression:
      'attribute_not_exists(marketingConsent) OR marketingConsent = :notConsented',
    ExpressionAttributeValues: {
      ':consented': true,
      ':notConsented': false,
      ':now': now,
      ':version': String(consentVersion || 'unknown'),
      ':source': resolvedSource,
      ':sourceVersion':
        resolvedSource === AMAZON_EXIT_SOURCE ? SOURCE_VERSION : '1',
      ':consentType': CONSENT_TYPE,
      ':status': 'subscribed',
    },
  };

  update = appendAttributionToUpdate(update, attribution);
  return update;
}

/**
 * Light update for an already-subscribed reader.
 * Does not rewrite marketingConsentSource (preserves amazon-pre-navigation etc.).
 */
function buildExistingSubscriberUpdate({ attribution = {}, now }) {
  let update = {
    UpdateExpression:
      'SET marketingConsentUpdatedAt = :now, updatedAt = :now, marketingStatus = :status',
    ExpressionAttributeValues: {
      ':now': now,
      ':status': 'subscribed',
      ':consented': true,
    },
    ConditionExpression: 'marketingConsent = :consented',
  };

  update = appendAttributionToUpdate(update, attribution);
  return update;
}

function buildWelcomeEmail({ siteUrl }) {
  const {
    escapeHtml,
    wrapTransactionalEmail,
    emailHeadline,
    emailParagraph,
    emailBulletList,
    emailSiteLink,
    emailClosing,
    emailMutedNote,
  } = require('./emailLayout');

  const site = String(siteUrl || 'https://modern-java.classpath.in').replace(
    /\/$/,
    '',
  );
  const unsubscribeUrl = `${site}/unsubscribe`;
  const benefits = [
    'Early access to upcoming books',
    'Reader-only launch offers',
    'Practical Modern Java articles and book updates',
    'Priority notifications for paperback availability',
  ];
  const text = [
    'Thank you for joining the Classpath Reader List.',
    '',
    'As a registered reader, you can expect:',
    '',
    ...benefits.map((item) => `• ${item}`),
    '',
    'We’ll only send occasional emails that are relevant to Classpath readers.',
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline('Welcome to the Classpath Reader List')}
                ${emailParagraph(
                  'Thank you for joining. As a registered reader, you can expect:',
                )}
                ${emailBulletList(benefits)}
                ${emailParagraph(
                  'We’ll only send occasional emails that are relevant to Classpath readers.',
                  '0 0 8px',
                )}
                ${emailSiteLink(site)}
                ${emailMutedNote(
                  `You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#667085;font-weight:600;">unsubscribe</a> anytime.`,
                )}
                ${emailClosing()}
  `);

  return {
    subject: 'Welcome to the Classpath Reader List',
    text,
    html,
    unsubscribeUrl,
  };
}

/**
 * Amazon buying-intent follow-up.
 *
 * Recipients showed interest (email + continue to Amazon) but purchase completion
 * is unknown. Copy acknowledges both paths: complete purchase, or leave a review
 * if they already bought. Never mentions the chapter preview.
 *
 * Compliance: never ties benefits, discounts, or offers to leaving a review.
 * Never asks for review URLs, screenshots, or other proof.
 */
function buildAmazonReviewFollowUpEmail({
  siteUrl,
  amazonUrl = 'https://www.amazon.in/dp/B0H6R4334W',
  name,
}) {
  const {
    escapeHtml,
    BOOK_FULL_TITLE,
    wrapTransactionalEmail,
    emailHeadline,
    emailParagraph,
    emailButton,
    emailSiteLink,
    emailClosing,
    emailMutedNote,
  } = require('./emailLayout');

  const site = String(siteUrl || 'https://modern-java.classpath.in').replace(
    /\/$/,
    '',
  );
  const formatsUrl = `${site}/#formats`;
  const amazonLink = String(
    amazonUrl || 'https://www.amazon.in/dp/B0H6R4334W',
  ).trim();
  const unsubscribeUrl = `${site}/unsubscribe`;
  const greetingName = String(name || '').trim();
  const greeting = greetingName ? `Hi ${greetingName},` : 'Hi,';

  const text = [
    greeting,
    '',
    `A few days ago, you showed interest in ${BOOK_FULL_TITLE}.`,
    '',
    'If you haven’t had a chance to get your copy yet, you can choose whichever option works best for you:',
    '',
    'Buy directly from Classpath',
    formatsUrl,
    '',
    'Buy on Amazon',
    amazonLink,
    '',
    'If you’ve already purchased the book and found it helpful, we’d be grateful if you would consider leaving an honest review on Amazon. Even a few sentences can help other Java developers decide whether the book is right for them.',
    '',
    `Leave an honest Amazon review: ${amazonLink}`,
    '',
    'Leaving a review is entirely optional and does not affect any Classpath Reader List benefits.',
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline('A quick follow-up on Modern Java')}
                ${emailParagraph(escapeHtml(greeting), '0 0 16px')}
                ${emailParagraph(
                  `A few days ago, you showed interest in <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong>.`,
                )}
                ${emailParagraph(
                  'If you haven’t had a chance to get your copy yet, you can choose whichever option works best for you:',
                )}
                ${emailButton({
                  href: formatsUrl,
                  label: 'Buy directly from Classpath',
                })}
                ${emailParagraph(
                  `<a href="${escapeHtml(amazonLink)}" style="color:#1a56db;font-weight:600;text-decoration:none;">Buy on Amazon →</a>`,
                )}
                ${emailParagraph(
                  'If you’ve already purchased the book and found it helpful, we’d be grateful if you would consider leaving an honest review on Amazon. Even a few sentences can help other Java developers decide whether the book is right for them.',
                )}
                ${emailButton({
                  href: amazonLink,
                  label: 'Leave an honest Amazon review',
                  bgcolor: '#0f6b5c',
                })}
                ${emailParagraph(
                  'Leaving a review is entirely optional and does not affect any Classpath Reader List benefits.',
                  '0 0 8px',
                )}
                ${emailSiteLink(site)}
                ${emailMutedNote(
                  `You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#667085;font-weight:600;">unsubscribe</a> anytime.`,
                )}
                ${emailClosing()}
  `);

  return {
    subject: 'A quick follow-up on Modern Java',
    text,
    html,
    unsubscribeUrl,
    formatsUrl,
    amazonUrl: amazonLink,
  };
}

const AMAZON_INTENT_SOURCES = new Set([
  AMAZON_EXIT_SOURCE,
  'amazon-pre-navigation',
]);

/** Default delay after Amazon exit / reader-list opt-in before this follow-up. */
const AMAZON_FOLLOWUP_DAYS = 3;

/**
 * Whether a Classpath Reader List lead from Amazon buying intent is due.
 * Targets email + continue-to-Amazon signups; purchase completion is unknown.
 * @param {object} item SAMPLE_REQUESTS_TABLE row
 * @param {{ now?: Date, minAgeDays?: number }} [options]
 */
function isEligibleForAmazonReviewFollowUp(
  item,
  { now = new Date(), minAgeDays = AMAZON_FOLLOWUP_DAYS } = {},
) {
  if (!item || !item.email) {
    return false;
  }
  if (item.marketingConsent !== true) {
    return false;
  }
  if (item.marketingUnsubscribedAt) {
    return false;
  }
  if (item.amazonReviewEmailSentAt) {
    return false;
  }
  const source = String(item.marketingConsentSource || '');
  if (!AMAZON_INTENT_SOURCES.has(source)) {
    return false;
  }
  const consentedAt = Date.parse(item.marketingConsentAt || '');
  if (!Number.isFinite(consentedAt)) {
    return false;
  }
  const minAgeMs = Math.max(0, Number(minAgeDays) || 0) * 24 * 60 * 60 * 1000;
  return consentedAt <= now.getTime() - minAgeMs;
}

module.exports = {
  CREATED_MESSAGE,
  ALREADY_ON_LIST_MESSAGE,
  AMAZON_EXIT_SOURCE,
  SOURCE_VERSION,
  CONSENT_TYPE,
  ALLOWED_SOURCES,
  AMAZON_INTENT_SOURCES,
  AMAZON_FOLLOWUP_DAYS,
  isConditionalCheckFailed,
  resolveMarketingSource,
  normalizeAttribution,
  buildFirstOptInUpdate,
  buildExistingSubscriberUpdate,
  buildWelcomeEmail,
  buildAmazonReviewFollowUpEmail,
  isEligibleForAmazonReviewFollowUp,
};
