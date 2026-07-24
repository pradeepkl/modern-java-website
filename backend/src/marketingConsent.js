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
  const site = String(siteUrl || 'https://modern-java.classpath.in').replace(
    /\/$/,
    '',
  );
  const text = [
    'Hi,',
    '',
    'Thank you for joining the Classpath Reader List.',
    '',
    'You’ll receive updates about upcoming books, reader offers, paperback availability, and practical Java resources.',
    '',
    'After you’ve had time to read Modern Java — The Mindset Shift, please consider leaving an honest review on Amazon. Reviews help other readers understand whether the book is useful for them.',
    '',
    'Your reader-list benefits are not dependent on leaving a review.',
    '',
    'Regards,',
    'Pradeep Kumar L',
    'Classpath',
    site.replace(/^https?:\/\//, ''),
  ].join('\n');

  return {
    subject: 'Welcome to the Classpath Reader List',
    text,
  };
}

module.exports = {
  CREATED_MESSAGE,
  ALREADY_ON_LIST_MESSAGE,
  AMAZON_EXIT_SOURCE,
  SOURCE_VERSION,
  CONSENT_TYPE,
  ALLOWED_SOURCES,
  isConditionalCheckFailed,
  resolveMarketingSource,
  normalizeAttribution,
  buildFirstOptInUpdate,
  buildExistingSubscriberUpdate,
  buildWelcomeEmail,
};
