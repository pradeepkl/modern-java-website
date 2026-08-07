/**
 * Shared helpers for nurture CLI send scripts.
 */
const { SESClient } = require('@aws-sdk/client-ses');
const { isMarketingSendAllowed } = require('../src/emailDelivery');
const { sendEmail } = require('../src/sesMail');
const {
  createUnsubscribeToken,
  buildOneClickUnsubscribeUrl,
} = require('../src/unsubscribeToken');

function createSesClient() {
  return new SESClient({ region: process.env.SES_REGION || 'us-east-1' });
}

function resolvePublicApiUrl() {
  return String(process.env.PUBLIC_API_URL || process.env.ORDER_API_URL || '')
    .trim()
    .replace(/\/$/, '');
}

function buildListUnsubscribeUrl(email) {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET || '';
  const publicApiUrl = resolvePublicApiUrl();
  if (!secret || !publicApiUrl) return undefined;
  const token = createUnsubscribeToken(email, { secret });
  return buildOneClickUnsubscribeUrl({ publicApiUrl, token });
}

async function sendMarketingEmail({
  ses,
  to,
  subject,
  text,
  html,
  recipientRecord,
  tags = {},
  mailFromEmail = process.env.MAIL_FROM_EMAIL,
  replyTo = process.env.REPLY_TO_EMAIL,
  bcc,
}) {
  return sendEmail({
    ses: ses || createSesClient(),
    to,
    subject,
    text,
    html,
    category: 'MARKETING',
    recipientRecord: recipientRecord || { email: to },
    listUnsubscribeUrl: buildListUnsubscribeUrl(to),
    mailFromEmail,
    replyTo,
    bcc,
    configurationSetName:
      process.env.SES_CONFIGURATION_SET ||
      `classpath-email-${process.env.APP_ENV || 'prod'}`,
    tags: {
      funnel: tags.funnel,
      sequenceDay: tags.sequenceDay,
      ...tags,
    },
  });
}

module.exports = {
  createSesClient,
  isMarketingSendAllowed,
  buildListUnsubscribeUrl,
  sendMarketingEmail,
};
