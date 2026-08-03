/**
 * Shared SES send helper: configuration set, optional RFC 8058 headers, tags.
 * Requires an explicit email category — never infer from template names.
 */
const { randomUUID } = require('node:crypto');
const { SESClient, SendEmailCommand, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const {
  EMAIL_CATEGORY,
  assertSendEligible,
} = require('./emailDelivery');

const DEFAULT_MAIL_FROM_EMAIL = 'no-reply@classpath.in';
const DEFAULT_REPLY_TO = 'pradeep@classpath.in';
const DEFAULT_CONFIG_SET = 'classpath-email-prod';
const DISPLAY_NAME = 'Pradeep Kumar L | Classpath';

function formatMailFrom(mailFromEmail = DEFAULT_MAIL_FROM_EMAIL) {
  return `"${DISPLAY_NAME}" <${mailFromEmail}>`;
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(String(subject), 'utf8').toString('base64')}?=`;
}

function toBase64Lines(value) {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');
}

function normalizeTags(tags = {}) {
  return Object.entries(tags)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([Name, Value]) => ({
      Name: String(Name).slice(0, 256),
      Value: String(Value).slice(0, 256),
    }));
}

function normalizeCategory(category) {
  const value = String(category || '')
    .trim()
    .toUpperCase();
  if (
    value !== EMAIL_CATEGORY.TRANSACTIONAL &&
    value !== EMAIL_CATEGORY.MARKETING
  ) {
    const error = new Error(
      'sendEmail requires an explicit category: TRANSACTIONAL or MARKETING',
    );
    error.name = 'EmailCategoryError';
    throw error;
  }
  return value;
}

function normalizeEmailAddress(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Resolve BCC recipients. Opt-in only — no default archive copy.
 * Pass a string/list to BCC; `false` / `[]` / omitted means none.
 * Addresses matching `to` are dropped so admin-only mail is not doubled.
 */
function resolveBccAddresses(bcc, to) {
  const toAddress = normalizeEmailAddress(to);
  let candidates;
  if (bcc === false || bcc === undefined || bcc === null) {
    candidates = [];
  } else if (Array.isArray(bcc)) {
    candidates = bcc;
  } else {
    candidates = [bcc];
  }

  const seen = new Set();
  const addresses = [];
  for (const entry of candidates) {
    const email = normalizeEmailAddress(entry);
    if (!email || email === toAddress || seen.has(email)) continue;
    seen.add(email);
    addresses.push(email);
  }
  return addresses;
}

function buildRawMimeEmail({
  mailFrom,
  to,
  subject,
  text,
  html,
  attachments = [],
  replyTo,
  listUnsubscribeUrl,
}) {
  const mixedBoundary = `Mixed_${randomUUID().replace(/-/g, '')}`;
  const altBoundary = `Alt_${randomUUID().replace(/-/g, '')}`;
  const chunks = [
    `From: ${mailFrom}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeSubject(subject)}`,
  ];

  if (listUnsubscribeUrl) {
    chunks.push(
      `List-Unsubscribe: <${listUnsubscribeUrl}>`,
      'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
    );
  }

  chunks.push(
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    toBase64Lines(text),
    '',
  );

  if (html) {
    chunks.push(
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      toBase64Lines(html),
      '',
    );
  }

  chunks.push(`--${altBoundary}--`, '');

  for (const attachment of attachments) {
    const filename = String(attachment.filename || 'attachment.bin').replace(
      /["\r\n]/g,
      '_',
    );
    const contentType = attachment.contentType || 'application/octet-stream';
    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(attachment.content || '');
    chunks.push(
      `--${mixedBoundary}`,
      `Content-Type: ${contentType}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      content.toString('base64').replace(/(.{76})/g, '$1\r\n'),
      '',
    );
  }

  chunks.push(`--${mixedBoundary}--`, '');
  return Buffer.from(chunks.join('\r\n'), 'utf8');
}

/**
 * @param {object} options
 * @param {'TRANSACTIONAL'|'MARKETING'} options.category Explicit send category
 * @param {object|null} [options.recipientRecord] Lead/subscriber row for eligibility
 * @param {import('@aws-sdk/client-ses').SESClient} [options.ses]
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {string} [options.html]
 * @param {Array} [options.attachments]
 * @param {string} [options.replyTo]
 * @param {string} [options.mailFromEmail]
 * @param {string} [options.configurationSetName]
 * @param {string} [options.listUnsubscribeUrl] RFC 8058 URL (marketing only)
 * @param {Record<string, string>} [options.tags]
 * @param {string|string[]|false} [options.bcc] Optional archive copies (opt-in)
 */
async function sendEmail({
  category,
  recipientRecord = null,
  ses,
  to,
  subject,
  text,
  html,
  attachments = [],
  replyTo = process.env.REPLY_TO_EMAIL || DEFAULT_REPLY_TO,
  mailFromEmail = process.env.MAIL_FROM_EMAIL || DEFAULT_MAIL_FROM_EMAIL,
  configurationSetName = process.env.SES_CONFIGURATION_SET || DEFAULT_CONFIG_SET,
  listUnsubscribeUrl,
  tags = {},
  bcc,
}) {
  const resolvedCategory = normalizeCategory(category);
  const record =
    recipientRecord && typeof recipientRecord === 'object'
      ? { ...recipientRecord, email: recipientRecord.email || to }
      : null;

  // Marketing requires a recipient record for consent/unsubscribe checks.
  // Transactional may omit the record (admin mail, first-time buyers).
  assertSendEligible(resolvedCategory, record);

  const client =
    ses ||
    new SESClient({ region: process.env.SES_REGION || 'us-east-1' });
  const mailFrom = formatMailFrom(mailFromEmail);
  const replyToAddress =
    String(replyTo || DEFAULT_REPLY_TO).trim() || DEFAULT_REPLY_TO;
  const bccAddresses = resolveBccAddresses(bcc, to);
  const marketingUnsubscribe =
    resolvedCategory === EMAIL_CATEGORY.MARKETING
      ? String(listUnsubscribeUrl || '').trim() || undefined
      : undefined;
  const emailTags = normalizeTags({
    emailCategory: resolvedCategory,
    ...tags,
  });
  const configSet = String(configurationSetName || '').trim();
  const needsRaw = attachments.length > 0 || Boolean(marketingUnsubscribe);

  if (!needsRaw) {
    return client.send(
      new SendEmailCommand({
        Source: mailFrom,
        ReplyToAddresses: [replyToAddress],
        Destination: {
          ToAddresses: [to],
          ...(bccAddresses.length ? { BccAddresses: bccAddresses } : {}),
        },
        Message: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: text },
            ...(html ? { Html: { Data: html } } : {}),
          },
        },
        ...(configSet ? { ConfigurationSetName: configSet } : {}),
        ...(emailTags.length ? { Tags: emailTags } : {}),
      }),
    );
  }

  // SES raw: list BCC only in Destinations — do not add a Bcc MIME header,
  // so the primary recipient never sees the archive address.
  return client.send(
    new SendRawEmailCommand({
      Source: mailFrom,
      Destinations: [to, ...bccAddresses],
      RawMessage: {
        Data: buildRawMimeEmail({
          mailFrom,
          to,
          subject,
          text,
          html,
          attachments,
          replyTo: replyToAddress,
          listUnsubscribeUrl: marketingUnsubscribe,
        }),
      },
      ...(configSet ? { ConfigurationSetName: configSet } : {}),
      ...(emailTags.length ? { Tags: emailTags } : {}),
    }),
  );
}

module.exports = {
  DEFAULT_CONFIG_SET,
  DISPLAY_NAME,
  EMAIL_CATEGORY,
  formatMailFrom,
  buildRawMimeEmail,
  resolveBccAddresses,
  sendEmail,
};
