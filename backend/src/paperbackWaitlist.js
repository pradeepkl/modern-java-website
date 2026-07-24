const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CREATED_MESSAGE = 'You have joined the paperback priority list.';
const ALREADY_REGISTERED_MESSAGE =
  'You are already on the paperback priority list. We will notify you when ordering opens.';

/**
 * Normalize and validate a waitlist payload.
 * Throws Error with a client-safe message on validation failure.
 */
function validateAndNormalizeWaitlistPayload(json = {}) {
  const name = String(json.name || '').trim();
  const email = String(json.email || '').trim().toLowerCase();
  const city = String(json.city || '').trim();
  const paperbackConsent = json.paperbackConsent === true;
  const promotionalConsent = json.promotionalConsent === true;

  if (!name) {
    throw new Error('Please enter your name.');
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (!paperbackConsent) {
    throw new Error('Please accept the paperback notification consent.');
  }

  const optionalString = (value) => {
    const trimmed = String(value || '').trim();
    return trimmed || undefined;
  };

  return {
    name,
    email,
    city: city || undefined,
    paperbackConsent: true,
    promotionalConsent,
    source: optionalString(json.source) || 'pricing_card',
    landingPage: optionalString(json.landingPage),
    referrer: optionalString(json.referrer),
    utmSource: optionalString(json.utmSource),
    utmMedium: optionalString(json.utmMedium),
    utmCampaign: optionalString(json.utmCampaign),
    utmContent: optionalString(json.utmContent),
  };
}

function buildCreateItem(payload, now = new Date().toISOString()) {
  const item = {
    email: payload.email,
    name: payload.name,
    city: payload.city || null,
    paperbackConsent: true,
    paperbackConsentAt: now,
    promotionalConsent: payload.promotionalConsent === true,
    source: payload.source,
    landingPage: payload.landingPage || null,
    referrer: payload.referrer || null,
    utmSource: payload.utmSource || null,
    utmMedium: payload.utmMedium || null,
    utmCampaign: payload.utmCampaign || null,
    utmContent: payload.utmContent || null,
    status: 'WAITING',
    createdAt: now,
    updatedAt: now,
  };

  // Omit promotionalConsentAt when false so later if_not_exists upgrades work.
  if (payload.promotionalConsent === true) {
    item.promotionalConsentAt = now;
  }

  return item;
}

/**
 * Consent-safe update for an existing waitlist record.
 * - Never weakens paperbackConsent
 * - promotionalConsent may only move false → true when explicitly selected
 */
function buildExistingRegistrationUpdate(payload, now = new Date().toISOString()) {
  const values = {
    ':name': payload.name,
    ':updatedAt': now,
  };
  const sets = ['#name = :name', '#updatedAt = :updatedAt'];

  if (payload.city) {
    values[':city'] = payload.city;
    sets.push('#city = :city');
  }

  if (payload.promotionalConsent === true) {
    values[':promotionalConsent'] = true;
    values[':promotionalConsentAt'] = now;
    // Only stamp promotionalConsentAt when consent was not already true.
    sets.push('#promotionalConsent = :promotionalConsent');
    sets.push(
      '#promotionalConsentAt = if_not_exists(#promotionalConsentAt, :promotionalConsentAt)',
    );
  }

  const expressionAttributeNames = {
    '#name': 'name',
    '#updatedAt': 'updatedAt',
  };
  if (payload.city) expressionAttributeNames['#city'] = 'city';
  if (payload.promotionalConsent === true) {
    expressionAttributeNames['#promotionalConsent'] = 'promotionalConsent';
    expressionAttributeNames['#promotionalConsentAt'] = 'promotionalConsentAt';
  }

  return {
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: values,
  };
}

function buildConfirmationEmail({
  name,
  siteUrl = 'https://modern-java.classpath.in',
}) {
  const {
    escapeHtml,
    BOOK_FULL_TITLE,
    wrapTransactionalEmail,
    emailHeadline,
    emailParagraph,
    emailSiteLink,
    emailClosing,
  } = require('./emailLayout');

  const site = String(siteUrl).replace(/\/$/, '');
  const text = [
    `Hi ${name},`,
    '',
    `Thank you for joining the priority list for the paperback edition of ${BOOK_FULL_TITLE}.`,
    '',
    'When ordering opens, we’ll send an email to your registered email address with the available ordering options. Readers on this list will receive priority access to the next print batch.',
    '',
    'No payment has been collected, and joining the priority list does not create any purchase obligation.',
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline('You’re on the paperback priority list')}
                ${emailParagraph(
                  `Hi ${escapeHtml(name)}, thank you for joining the priority list for the paperback edition of <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong>.`,
                )}
                ${emailParagraph(
                  'When ordering opens, we’ll send an email to your registered email address with the available ordering options. Readers on this list will receive priority access to the next print batch.',
                )}
                ${emailParagraph(
                  'No payment has been collected, and joining the priority list does not create any purchase obligation.',
                  '0 0 8px',
                )}
                ${emailSiteLink(site)}
                ${emailClosing()}
  `);

  return {
    subject: 'You’re on the Modern Java paperback priority list',
    text,
    html,
  };
}

function isConditionalCheckFailed(error) {
  return (
    error?.name === 'ConditionalCheckFailedException' ||
    error?.Code === 'ConditionalCheckFailedException' ||
    /ConditionalCheckFailedException/i.test(String(error?.message || ''))
  );
}

/**
 * Join or refresh the paperback waitlist.
 *
 * Sequence: validate → turnstile → atomic persist → return success → SES attempt.
 * SES failures are logged and never flip a successful persist into an API error.
 */
async function joinPaperbackWaitlist({
  event,
  parseBody,
  response,
  verifyTurnstileCaptcha,
  dynamo,
  PutCommand,
  UpdateCommand,
  tableName,
  sendEmail,
  notifyAdmin,
}) {
  const { json } = parseBody(event);
  const payload = validateAndNormalizeWaitlistPayload(json);

  await verifyTurnstileCaptcha(event, json.captchaToken);

  if (!tableName) {
    return response(503, {
      message:
        'The paperback waitlist is not configured yet. Please try again later.',
    });
  }

  const now = new Date().toISOString();
  const item = buildCreateItem(payload, now);

  let registrationStatus = 'created';

  try {
    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(email)',
      }),
    );
  } catch (error) {
    if (!isConditionalCheckFailed(error)) {
      throw error;
    }

    registrationStatus = 'already_registered';
    const update = buildExistingRegistrationUpdate(payload, now);
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { email: payload.email },
        ...update,
      }),
    );
  }

  const apiBody = {
    success: true,
    status: registrationStatus,
    message:
      registrationStatus === 'created'
        ? CREATED_MESSAGE
        : ALREADY_REGISTERED_MESSAGE,
  };

  // Persist succeeded — attempt confirmation email only for new registrations.
  if (registrationStatus === 'created') {
    try {
      const email = buildConfirmationEmail({
        name: payload.name,
        siteUrl: process.env.WEBSITE_URL || 'https://modern-java.classpath.in',
      });
      await sendEmail({
        to: payload.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        category: 'TRANSACTIONAL',
        recipientRecord: { email: payload.email },
        tags: { funnel: 'paperback-waitlist' },
      });
    } catch (error) {
      console.error('Paperback waitlist confirmation email failed', {
        email: payload.email,
        error,
      });
      if (typeof notifyAdmin === 'function') {
        await notifyAdmin({
          subject: `Waitlist email failed — ${payload.email}`,
          lines: [
            'Event: paperback_waitlist_email_failed',
            `Email: ${payload.email}`,
            `Name: ${payload.name}`,
            `Error: ${error?.message || String(error)}`,
          ],
        });
      }
    }

    if (typeof notifyAdmin === 'function') {
      await notifyAdmin({
        subject: `Paperback waitlist — ${payload.email}`,
        lines: [
          'Event: paperback_waitlist_created',
          `Name: ${payload.name}`,
          `Email: ${payload.email}`,
          `City: ${payload.city || '(none)'}`,
          `Promotional consent: ${payload.promotionalConsent}`,
          `Source: ${payload.source}`,
          `UTM: ${payload.utmSource || '-'} / ${payload.utmMedium || '-'} / ${payload.utmCampaign || '-'}`,
        ],
      });
    }
  }

  return response(200, apiBody);
}

module.exports = {
  EMAIL_PATTERN,
  CREATED_MESSAGE,
  ALREADY_REGISTERED_MESSAGE,
  validateAndNormalizeWaitlistPayload,
  buildCreateItem,
  buildExistingRegistrationUpdate,
  buildConfirmationEmail,
  isConditionalCheckFailed,
  joinPaperbackWaitlist,
};
