const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  getSignedUrl: getCloudFrontSignedUrl,
} = require('@aws-sdk/cloudfront-signer');
const { createAndSendInvoice } = require('./zohoInvoice');
const { joinPaperbackWaitlist } = require('./paperbackWaitlist');
const {
  CREATED_MESSAGE: MARKETING_CREATED_MESSAGE,
  ALREADY_ON_LIST_MESSAGE,
  AMAZON_EXIT_SOURCE,
  isConditionalCheckFailed: isMarketingConditionalCheckFailed,
  resolveMarketingSource,
  normalizeAttribution,
  buildFirstOptInUpdate,
  buildExistingSubscriberUpdate,
  buildWelcomeEmail,
} = require('./marketingConsent');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
// Domain identity is verified in us-east-1 (also where inbound MX points).
const ses = new SESClient({ region: process.env.SES_REGION || 'us-east-1' });
const s3 = new S3Client({});
const ssm = new SSMClient({});

const normalizePem = (value) =>
  String(value || '')
    .replace(/\\n/g, '\n')
    .trim();

const {
  ORDERS_TABLE,
  SAMPLE_REQUESTS_TABLE,
  PAPERBACK_WAITLIST_TABLE,
  DIGITAL_ASSETS_BUCKET,
  SAMPLE_PDF_KEY = 'sample/modern-java-preview.pdf',
  DIGITAL_PDF_KEY = 'digital/modern-java-drm-free_v1.0.pdf',
  DIGITAL_EPUB_KEY = 'digital/modern-java-drm-free_v1.0.epub',
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  ADMIN_EMAIL = 'pradeep@classpath.in',
  MAIL_FROM_EMAIL = 'no-reply@classpath.in',
  REPLY_TO_EMAIL = 'pradeep@classpath.in',
  ALLOWED_ORIGIN = '*',
  WEBSITE_URL = 'https://modern-java.classpath.in',
  DIGITAL_CHECKOUT_BYPASS_SECRET = '',
  TURNSTILE_SECRET_KEY = '',
  CLOUDFRONT_DOMAIN = '',
  CLOUDFRONT_KEY_PAIR_ID = '',
  CLOUDFRONT_PRIVATE_KEY_SSM_PARAM = '',
} = process.env;

let cloudFrontPrivateKeyPromise = null;

const loadCloudFrontPrivateKey = async () => {
  if (!CLOUDFRONT_PRIVATE_KEY_SSM_PARAM) return '';
  if (!cloudFrontPrivateKeyPromise) {
    cloudFrontPrivateKeyPromise = ssm
      .send(
        new GetParameterCommand({
          Name: CLOUDFRONT_PRIVATE_KEY_SSM_PARAM,
          WithDecryption: true,
        }),
      )
      .then((result) => normalizePem(result.Parameter?.Value))
      .catch((error) => {
        cloudFrontPrivateKeyPromise = null;
        console.error('Unable to load CloudFront signing key from SSM', error);
        throw error;
      });
  }
  return cloudFrontPrivateKeyPromise;
};

const SITE_URL = String(WEBSITE_URL).replace(/\/$/, '');
const ALLOWED_ORIGINS = String(ALLOWED_ORIGIN)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

let activeAllowOrigin = ALLOWED_ORIGINS[0] || '*';

const resolveAllowOrigin = (event) => {
  const requestOrigin =
    event?.headers?.origin ||
    event?.headers?.Origin ||
    event?.headers?.['Origin'];
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  if (ALLOWED_ORIGINS.includes('*')) {
    return '*';
  }
  return ALLOWED_ORIGINS[0] || '*';
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const encodeSubject = (subject) =>
  `=?UTF-8?B?${Buffer.from(String(subject), 'utf8').toString('base64')}?=`;

const toBase64Lines = (value) =>
  Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');

const buildRawMimeEmail = ({
  to,
  subject,
  text,
  html,
  attachments = [],
  replyTo,
}) => {
  const mixedBoundary = `Mixed_${randomUUID().replace(/-/g, '')}`;
  const altBoundary = `Alt_${randomUUID().replace(/-/g, '')}`;
  const chunks = [
    `From: ${MAIL_FROM_EMAIL}`,
    `To: ${to}`,
    `Reply-To: ${replyTo || REPLY_TO_EMAIL}`,
    `Subject: ${encodeSubject(subject)}`,
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
  ];

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
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  attachments = [],
  replyTo,
}) => {
  const replyToAddress = String(replyTo || REPLY_TO_EMAIL).trim() || REPLY_TO_EMAIL;

  if (attachments.length === 0) {
    return ses.send(
      new SendEmailCommand({
        Source: MAIL_FROM_EMAIL,
        ReplyToAddresses: [replyToAddress],
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: text },
            ...(html ? { Html: { Data: html } } : {}),
          },
        },
      }),
    );
  }

  console.info('Sending SES raw email with attachments', {
    to,
    attachmentCount: attachments.length,
    attachmentBytes: attachments.reduce(
      (sum, item) => sum + (item.content?.length || 0),
      0,
    ),
  });

  return ses.send(
    new SendRawEmailCommand({
      Source: MAIL_FROM_EMAIL,
      Destinations: [to],
      RawMessage: {
        Data: buildRawMimeEmail({
          to,
          subject,
          text,
          html,
          attachments,
          replyTo: replyToAddress,
        }),
      },
    }),
  );
};

/**
 * Fire-and-forget business alert to the admin inbox.
 * Never throws — customer flows must not fail because of notification errors.
 */
const notifyAdmin = async ({ subject, lines }) => {
  try {
    const text = (Array.isArray(lines) ? lines : [lines])
      .filter((line) => line !== undefined && line !== null && line !== '')
      .join('\n');
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[Modern Java] ${subject}`,
      text: `${text}\n\nSent: ${new Date().toISOString()}`,
    });
  } catch (error) {
    console.error('Admin notification failed', { subject, error });
  }
};

const invoiceEmailCopy = (invoice) => {
  if (!invoice?.invoiceNumber) {
    return { text: '', html: '' };
  }
  const attached = Boolean(invoice.pdfBuffer?.length);
  const text = attached
    ? `Your invoice ${invoice.invoiceNumber} is attached to this email.`
    : `Your invoice number is ${invoice.invoiceNumber}.`;
  const html = attached
    ? `
                <p style="margin:20px 0 8px;font-size:15px;line-height:1.55;color:#445066;">
                  Your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is also attached to this email.
                </p>`
    : `
                <p style="margin:20px 0 8px;font-size:15px;line-height:1.55;color:#445066;">
                  Your invoice number is <strong>${escapeHtml(invoice.invoiceNumber)}</strong>.
                </p>`;
  return { text, html };
};

const invoiceAttachments = (invoice) => {
  if (!invoice?.pdfBuffer?.length) {
    return [];
  }
  const safeNumber = String(invoice.invoiceNumber || 'invoice').replace(
    /[^\w.-]+/g,
    '-',
  );
  return [
    {
      filename: `Modern-Java-Invoice-${safeNumber}.pdf`,
      contentType: 'application/pdf',
      content: invoice.pdfBuffer,
    },
  ];
};

const PAPERBACK_PRICE_PAISE = 89900;
const DIGITAL_BUNDLE_PRICE_PAISE = 69900;
const MAX_QUANTITY = 20;
const DOWNLOAD_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const SAMPLE_DOWNLOAD_LINK_TTL_SECONDS = 2 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;
const PIN_PATTERN = /^\d{6}$/;
const SAMPLE_REQUEST_COOLDOWN_MS = 60 * 1000;
const CONTACT_TO_EMAIL = 'admin@classpath.in';
const CONTACT_MESSAGE_MAX_LENGTH = 5000;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'access-control-allow-origin': activeAllowOrigin,
    'access-control-allow-headers':
      'content-type,x-razorpay-signature,x-digital-bypass-secret',
    'access-control-allow-methods': 'POST,OPTIONS',
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  return { raw, json: raw ? JSON.parse(raw) : {} };
};

const safeEqual = (actual, expected) => {
  const actualBuffer = Buffer.from(actual || '', 'utf8');
  const expectedBuffer = Buffer.from(expected || '', 'utf8');
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const getClientIp = (event) => {
  const forwarded =
    event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return (
    event.requestContext?.http?.sourceIp ||
    event.requestContext?.identity?.sourceIp ||
    ''
  );
};

/**
 * Verify Cloudflare Turnstile when TURNSTILE_SECRET_KEY is configured.
 * Skips verification in environments where the secret is unset (local/dev).
 */
const verifyTurnstileCaptcha = async (event, token) => {
  const secret = String(TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) return;

  const captchaToken = String(token || '').trim();
  if (!captchaToken) {
    throw new Error('Invalid captcha token');
  }

  const body = new URLSearchParams({
    secret,
    response: captchaToken,
  });
  const clientIp = getClientIp(event);
  if (clientIp) body.set('remoteip', clientIp);

  let payload;
  try {
    const result = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    payload = await result.json();
  } catch (error) {
    console.error('Turnstile verification request failed', error);
    throw new Error('Invalid captcha token');
  }

  if (!payload?.success) {
    console.warn('Turnstile verification rejected', payload?.['error-codes']);
    throw new Error('Invalid captcha token');
  }
};

const validateOrder = (input) => {
  const quantity = Number(input.quantity);
  const required = [
    'name',
    'email',
    'phone',
    'address',
    'city',
    'state',
    'postalCode',
  ];

  for (const field of required) {
    if (!String(input[field] || '').trim()) {
      throw new Error(`${field} is required`);
    }
  }

  if (!EMAIL_PATTERN.test(input.email)) throw new Error('Invalid email address');
  if (!PHONE_PATTERN.test(input.phone)) throw new Error('Invalid phone number');
  if (!PIN_PATTERN.test(input.postalCode)) throw new Error('Invalid postal code');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error('Quantity must be between 1 and 20');
  }

  return {
    name: String(input.name).trim(),
    email: String(input.email).trim().toLowerCase(),
    phone: String(input.phone),
    quantity,
    address: String(input.address).trim(),
    city: String(input.city).trim(),
    state: String(input.state).trim(),
    postalCode: String(input.postalCode),
    country: 'India',
    notes: String(input.notes || '').trim(),
  };
};

const createSignedDownloadUrl = async (
  key,
  expiresIn = DOWNLOAD_LINK_TTL_SECONDS,
) => {
  const privateKey =
    CLOUDFRONT_DOMAIN && CLOUDFRONT_KEY_PAIR_ID
      ? await loadCloudFrontPrivateKey()
      : '';

  if (CLOUDFRONT_DOMAIN && CLOUDFRONT_KEY_PAIR_ID && privateKey) {
    const path = String(key)
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const url = `https://${CLOUDFRONT_DOMAIN}/${path}`;
    const dateLessThan = new Date(Date.now() + expiresIn * 1000).toISOString();
    return getCloudFrontSignedUrl({
      url,
      keyPairId: CLOUDFRONT_KEY_PAIR_ID,
      privateKey,
      dateLessThan,
    });
  }

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: DIGITAL_ASSETS_BUCKET,
      Key: key,
    }),
    { expiresIn },
  );
};

const assertObjectExists = async (key) => {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: DIGITAL_ASSETS_BUCKET,
        Key: key,
      }),
    );
  } catch (error) {
    if (
      error?.name === 'NotFound' ||
      error?.name === 'NoSuchKey' ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      const missing = new Error(`Missing digital asset: ${key}`);
      missing.code = 'ASSET_MISSING';
      throw missing;
    }
    throw error;
  }
};

const objectExists = async (key) => {
  try {
    await assertObjectExists(key);
    return true;
  } catch (error) {
    if (error.code === 'ASSET_MISSING') {
      return false;
    }
    throw error;
  }
};

const requestSampleChapter = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }

  await verifyTurnstileCaptcha(event, json.captchaToken);

  if (!SAMPLE_REQUESTS_TABLE || !DIGITAL_ASSETS_BUCKET) {
    return response(503, {
      message: 'Sample delivery is not configured yet. Please try again later.',
    });
  }

  const existing = await dynamo.send(
    new GetCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Key: { email },
    }),
  );
  const previousRequest = existing.Item?.lastRequestedAt
    ? Date.parse(existing.Item.lastRequestedAt)
    : 0;

  if (Date.now() - previousRequest < SAMPLE_REQUEST_COOLDOWN_MS) {
    return response(200, {
      message: 'The sample chapter was sent recently. Please check your inbox.',
    });
  }

  try {
    await assertObjectExists(SAMPLE_PDF_KEY);
  } catch (error) {
    if (error.code === 'ASSET_MISSING') {
      return response(503, {
        message:
          'The sample chapter is being prepared. Please try again later.',
      });
    }
    throw error;
  }

  const sampleChapterUrl = await createSignedDownloadUrl(
    SAMPLE_PDF_KEY,
    SAMPLE_DOWNLOAD_LINK_TTL_SECONDS,
  );
  const marketingConsent = json.marketingConsent === true;
  const now = new Date().toISOString();
  const marketingLine = marketingConsent
    ? `You also asked to receive occasional Modern Java articles and book updates. Unsubscribe anytime: ${SITE_URL}/unsubscribe`
    : 'You have not been subscribed to marketing updates.';
  const sampleText = [
    'Thank you for your interest in Modern Java: The Mindset Shift.',
    '',
    'Open this email in HTML view and click “Download sample chapter”.',
    'The secure download remains valid for 2 days.',
    'The sample includes the preface and the first two chapters, with selected diagrams.',
    '',
    `Or visit the book site: ${SITE_URL}/#sample-chapter`,
    '',
    marketingLine,
  ].join('\n');
  const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a2332;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
                  Thank you for your interest in <strong>Modern Java: The Mindset Shift</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#445066;">
                  The sample includes the preface and the first two chapters, with selected diagrams.
                  This secure download remains valid for <strong>2 days</strong>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                  <tr>
                    <td align="center" bgcolor="#1a56db" style="border-radius:8px;">
                      <a href="${escapeHtml(sampleChapterUrl)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Download sample chapter
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.55;">
                  <a href="${escapeHtml(SITE_URL)}" style="color:#1a56db;font-weight:600;text-decoration:none;">
                    Visit the Modern Java website →
                  </a>
                </p>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#667085;">
                  ${escapeHtml(marketingLine)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  try {
    await sendEmail({
      to: email,
      subject: 'Your free Modern Java sample chapter',
      text: sampleText,
      html: sampleHtml,
    });
  } catch (error) {
    if (
      error?.name === 'MessageRejected' ||
      /not verified|sandbox/i.test(error?.message || '')
    ) {
      console.error('Sample chapter email rejected by SES', error);
      return response(503, {
        message:
          'Email delivery is temporarily unavailable. Please try again later, or contact pradeep@classpath.in.',
      });
    }
    throw error;
  }

  await dynamo.send(
    new PutCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Item: {
        email,
        firstRequestedAt: existing.Item?.firstRequestedAt || now,
        lastRequestedAt: now,
        requestCount: Number(existing.Item?.requestCount || 0) + 1,
        marketingConsent:
          existing.Item?.marketingConsent === true || marketingConsent,
        marketingConsentAt: marketingConsent
          ? now
          : existing.Item?.marketingConsentAt || null,
        marketingConsentUpdatedAt: marketingConsent
          ? now
          : existing.Item?.marketingConsentUpdatedAt || null,
        consentVersion: marketingConsent
          ? String(json.consentVersion || 'unknown')
          : existing.Item?.consentVersion || null,
        marketingConsentSource: marketingConsent
          ? 'sample-chapter-form'
          : existing.Item?.marketingConsentSource || null,
        source: 'sample-chapter-form',
      },
    }),
  );

  const requestCount = Number(existing.Item?.requestCount || 0) + 1;
  const storedMarketingConsent =
    existing.Item?.marketingConsent === true || marketingConsent;
  await notifyAdmin({
    subject: `Sample chapter requested — ${email}`,
    lines: [
      'Event: sample_chapter_requested',
      `Email: ${email}`,
      `Marketing opt-in (this request): ${marketingConsent ? 'Yes' : 'No'}`,
      `Marketing opt-in (stored): ${storedMarketingConsent ? 'Yes' : 'No'}`,
      `Request count: ${requestCount}`,
      `Time: ${now}`,
    ],
  });

  return response(200, {
    message: 'Check your inbox—the sample chapter is on its way.',
  });
};

/**
 * Upsert marketing preference on the shared sample-requests / leads table.
 */
const upsertMarketingPreference = async ({
  email,
  consented,
  source,
  consentVersion,
}) => {
  if (!SAMPLE_REQUESTS_TABLE) return;

  const now = new Date().toISOString();
  const values = {
    ':consented': consented === true,
    ':now': now,
    ':version': String(consentVersion || 'unknown'),
    ':source': String(source || 'unknown'),
  };

  if (consented) {
    await dynamo.send(
      new UpdateCommand({
        TableName: SAMPLE_REQUESTS_TABLE,
        Key: { email },
        UpdateExpression:
          'SET marketingConsent = :consented, ' +
          'marketingConsentAt = if_not_exists(marketingConsentAt, :now), ' +
          'marketingConsentUpdatedAt = :now, consentVersion = :version, ' +
          'marketingConsentSource = :source ' +
          'REMOVE marketingUnsubscribedAt',
        ExpressionAttributeValues: values,
      }),
    );
    return;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Key: { email },
      UpdateExpression:
        'SET marketingConsent = :consented, ' +
        'marketingConsentUpdatedAt = :now, ' +
        'marketingUnsubscribedAt = :now, ' +
        'consentVersion = :version, ' +
        'marketingConsentSource = :source',
      ExpressionAttributeValues: values,
    }),
  );
};

const recordMarketingConsent = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }
  if (json.marketingConsent !== true) {
    throw new Error('Marketing consent is required');
  }

  await verifyTurnstileCaptcha(event, json.captchaToken);

  if (!SAMPLE_REQUESTS_TABLE) {
    return response(503, {
      message: 'Email signup is not configured yet. Please try again later.',
    });
  }

  const now = new Date().toISOString();
  const source = resolveMarketingSource(json.source || AMAZON_EXIT_SOURCE);
  const attribution = normalizeAttribution(json);
  const firstOptIn = buildFirstOptInUpdate({
    source,
    consentVersion: json.consentVersion,
    attribution,
    now,
  });

  let registrationStatus = 'created';

  try {
    // Atomic: only one concurrent request can establish the first valid opt-in.
    await dynamo.send(
      new UpdateCommand({
        TableName: SAMPLE_REQUESTS_TABLE,
        Key: { email },
        ...firstOptIn,
      }),
    );
  } catch (error) {
    if (!isMarketingConditionalCheckFailed(error)) {
      throw error;
    }

    registrationStatus = 'already_registered';
    const existingUpdate = buildExistingSubscriberUpdate({
      attribution,
      now,
    });
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: SAMPLE_REQUESTS_TABLE,
          Key: { email },
          ...existingUpdate,
        }),
      );
    } catch (existingError) {
      // Row may have flipped between checks; still treat as already registered.
      if (!isMarketingConditionalCheckFailed(existingError)) {
        throw existingError;
      }
    }
  }

  if (registrationStatus === 'created') {
    try {
      const welcome = buildWelcomeEmail({ siteUrl: SITE_URL });
      await sendEmail({
        to: email,
        subject: welcome.subject,
        text: welcome.text,
      });
    } catch (error) {
      console.error('Classpath Reader List welcome email failed', {
        email,
        error,
      });
      await notifyAdmin({
        subject: `Reader list welcome email failed — ${email}`,
        lines: [
          'Event: marketing_welcome_email_failed',
          `Email: ${email}`,
          `Source: ${source}`,
          `Error: ${error?.message || String(error)}`,
        ],
      });
    }

    await notifyAdmin({
      subject: `Marketing opt-in — ${email}`,
      lines: [
        'Event: marketing_opt_in',
        `Email: ${email}`,
        `Source: ${source}`,
        `Consent version: ${String(json.consentVersion || 'unknown')}`,
        'Registration status: created',
      ],
    });
  }

  return response(200, {
    success: true,
    status: registrationStatus,
    message:
      registrationStatus === 'created'
        ? MARKETING_CREATED_MESSAGE
        : ALREADY_ON_LIST_MESSAGE,
  });
};

const unsubscribeMarketing = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }
  if (!SAMPLE_REQUESTS_TABLE) {
    return response(503, {
      message: 'Email preferences are not configured yet. Please try again later.',
    });
  }

  await upsertMarketingPreference({
    email,
    consented: false,
    source: 'unsubscribe-page',
    consentVersion: json.consentVersion || '2026-07-24',
  });

  await notifyAdmin({
    subject: `Marketing unsubscribe — ${email}`,
    lines: [
      'Event: marketing_unsubscribe',
      `Email: ${email}`,
      'Source: unsubscribe-page',
    ],
  });

  // Always succeed with the same message so callers cannot probe membership.
  return response(200, {
    message:
      'You have been unsubscribed from optional marketing emails. Purchase and sample delivery messages are unaffected.',
  });
};

const submitContactMessage = async (event) => {
  const { json } = parseBody(event);
  const name = String(json.name || '').trim();
  const email = String(json.email || '').trim().toLowerCase();
  const subject = String(json.subject || '').trim();
  const message = String(json.message || '').trim();

  if (!name) throw new Error('Please enter your name.');
  if (!EMAIL_PATTERN.test(email)) throw new Error('Invalid email address');
  if (!subject) throw new Error('Please enter a subject.');
  if (!message) throw new Error('Please enter a message.');
  if (subject.length > 200) {
    throw new Error('Subject must be 200 characters or fewer.');
  }
  if (message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    throw new Error('Message must be 5000 characters or fewer.');
  }

  await verifyTurnstileCaptcha(event, json.captchaToken);

  const text = [
    'New website contact form message',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    '',
    message,
    '',
    `Sent: ${new Date().toISOString()}`,
    `Site: ${SITE_URL}/contact`,
  ].join('\n');

  try {
    await sendEmail({
      to: CONTACT_TO_EMAIL,
      subject: `[Modern Java contact] ${subject}`,
      text,
      replyTo: email,
    });
  } catch (error) {
    console.error('Contact form email failed', { email, error });
    if (
      error?.name === 'MessageRejected' ||
      /not verified|sandbox/i.test(error?.message || '')
    ) {
      return response(503, {
        message:
          'Email delivery is temporarily unavailable. Please try again later, or write to admin@classpath.in.',
      });
    }
    throw error;
  }

  return response(200, {
    message:
      'Thank you. Your message has been sent. We will reply by email.',
  });
};

const createRazorpayOrder = async ({ amount, receipt, notes }) => {
  const authorization = Buffer.from(
    `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`,
  ).toString('base64');
  const result = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Basic ${authorization}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt,
      notes,
    }),
  });

  const payload = await result.json();
  if (!result.ok) {
    console.error('Razorpay order creation failed', payload);
    throw new Error('Unable to initialize payment');
  }
  return payload;
};

const validateDigitalCustomer = (input) => {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const city = String(input.city || '').trim();
  const postalCode = String(input.postalCode || input.zipcode || '').trim();

  if (!name) throw new Error('Name is required');
  if (!EMAIL_PATTERN.test(email)) throw new Error('Invalid email address');
  if (!city) throw new Error('City is required');
  if (!PIN_PATTERN.test(postalCode)) throw new Error('Invalid postal code');

  return { name, email, city, postalCode };
};

const createDigitalOrder = async (event) => {
  const { json } = parseBody(event);
  const { name, email, city, postalCode } = validateDigitalCustomer(json);

  await verifyTurnstileCaptcha(event, json.captchaToken);

  if (!DIGITAL_ASSETS_BUCKET) {
    return response(503, {
      message: 'Digital delivery is not configured yet. Please try again later.',
    });
  }

  try {
    await Promise.all([
      assertObjectExists(DIGITAL_PDF_KEY),
      assertObjectExists(DIGITAL_EPUB_KEY),
    ]);
  } catch (error) {
    if (error.code === 'ASSET_MISSING') {
      return response(503, {
        message:
          'The direct digital edition is being prepared. Please try again later.',
      });
    }
    throw error;
  }

  const bypassSecret = String(DIGITAL_CHECKOUT_BYPASS_SECRET || '');
  const providedSecret = String(
    event.headers?.['x-digital-bypass-secret'] ||
      event.headers?.['X-Digital-Bypass-Secret'] ||
      '',
  );
  const skipPayment =
    json.skipPayment === true &&
    bypassSecret.length > 0 &&
    safeEqual(providedSecret, bypassSecret);

  const appOrderId = `MJ-D-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const marketingConsent = json.marketingConsent === true;
  const customerFields = { name, email, city, postalCode };

  if (marketingConsent) {
    try {
      await upsertMarketingPreference({
        email,
        consented: true,
        source: 'digital-checkout',
        consentVersion: json.consentVersion,
      });
      await notifyAdmin({
        subject: `Marketing opt-in — ${email}`,
        lines: [
          'Event: marketing_opt_in',
          `Email: ${email}`,
          'Source: digital-checkout',
          `Consent version: ${String(json.consentVersion || 'unknown')}`,
        ],
      });
    } catch (error) {
      console.error('Digital order marketing consent sync failed', error);
    }
  }

  if (skipPayment) {
    const paymentId = `bypass_${randomUUID().slice(0, 12)}`;
    await dynamo.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          appOrderId,
          razorpayOrderId: `order_bypass_${appOrderId}`,
          productType: 'digital_bundle',
          ...customerFields,
          amount: DIGITAL_BUNDLE_PRICE_PAISE,
          currency: 'INR',
          status: 'paid',
          paymentId,
          revisionUpdates: true,
          marketingConsent,
          marketingConsentAt: marketingConsent ? now : null,
          consentVersion: marketingConsent
            ? String(json.consentVersion || 'unknown')
            : null,
          checkoutBypass: true,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(appOrderId)',
      }),
    );

    const order = {
      appOrderId,
      paymentId,
      amount: DIGITAL_BUNDLE_PRICE_PAISE,
      ...customerFields,
      marketingConsent,
      productType: 'digital_bundle',
      checkoutBypass: true,
    };
    const downloads = await createDigitalDownloadLinks();
    try {
      await sendConfirmationEmails(order);
    } catch (error) {
      console.error('Bypass order paid but confirmation email failed', error);
    }

    return response(201, {
      appOrderId,
      skippedPayment: true,
      downloads,
    });
  }

  const razorpayOrder = await createRazorpayOrder({
    amount: DIGITAL_BUNDLE_PRICE_PAISE,
    receipt: appOrderId,
    notes: { appOrderId, productType: 'digital_bundle' },
  });

  await dynamo.send(
    new PutCommand({
      TableName: ORDERS_TABLE,
      Item: {
        appOrderId,
        razorpayOrderId: razorpayOrder.id,
        productType: 'digital_bundle',
        ...customerFields,
        amount: DIGITAL_BUNDLE_PRICE_PAISE,
        currency: 'INR',
        status: 'payment_pending',
        revisionUpdates: true,
        marketingConsent,
        marketingConsentAt: marketingConsent ? now : null,
        consentVersion: marketingConsent
          ? String(json.consentVersion || 'unknown')
          : null,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(appOrderId)',
    }),
  );

  return response(201, {
    appOrderId,
    razorpayOrderId: razorpayOrder.id,
    amount: DIGITAL_BUNDLE_PRICE_PAISE,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID,
  });
};

const formatOrderEmail = (order) => [
  `Order ID: ${order.appOrderId}`,
  `Payment ID: ${order.paymentId}`,
  `Amount: ₹${order.amount / 100}`,
  `Quantity: ${order.quantity}`,
  '',
  `Name: ${order.name}`,
  `Email: ${order.email}`,
  `Phone: +91 ${order.phone}`,
  '',
  'Delivery address:',
  order.address,
  `${order.city}, ${order.state} - ${order.postalCode}`,
  order.country,
  '',
  `Notes: ${order.notes || 'None'}`,
].join('\n');

const sendPaperbackConfirmationEmails = async (order, invoice = null) => {
  const invoiceCopy = invoiceEmailCopy(invoice);
  const text = [formatOrderEmail(order), '', invoiceCopy.text]
    .filter(Boolean)
    .join('\n');
  const subject = `Modern Java paperback order ${order.appOrderId}`;
  const customerHtml = `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a2332;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
                  Thank you for your <strong>Modern Java</strong> paperback order. Payment was successful.
                </p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#445066;white-space:pre-line;">${escapeHtml(formatOrderEmail(order))}</p>
                ${invoiceCopy.html}
                <p style="margin:20px 0 0;font-size:15px;line-height:1.55;">
                  <a href="${escapeHtml(SITE_URL)}" style="color:#1a56db;font-weight:600;text-decoration:none;">
                    Visit the Modern Java website →
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  await Promise.all([
    sendEmail({ to: ADMIN_EMAIL, subject, text }),
    sendEmail({
      to: order.email,
      subject: 'Your Modern Java paperback order is confirmed',
      text: `Thank you for your order. Payment was successful.\n\n${text}`,
      html: customerHtml,
      attachments: invoiceAttachments(invoice),
    }),
  ]);
};

const createDigitalDownloadLinks = async () => {
  const pdfUrl = await createSignedDownloadUrl(DIGITAL_PDF_KEY);
  const hasEpub = await objectExists(DIGITAL_EPUB_KEY);
  const epubUrl = hasEpub
    ? await createSignedDownloadUrl(DIGITAL_EPUB_KEY)
    : null;

  return { pdfUrl, epubUrl };
};

const sendDigitalConfirmationEmails = async (order, invoice = null) => {
  const { pdfUrl, epubUrl } = await createDigitalDownloadLinks();
  const invoiceCopy = invoiceEmailCopy(invoice);
  const adminText = [
    `Order ID: ${order.appOrderId}`,
    `Payment ID: ${order.paymentId}`,
    `Amount: ₹${order.amount / 100}`,
    'Product: DRM-free digital edition (PDF' + (epubUrl ? ' + ePub' : '') + ')',
    `Email: ${order.email}`,
    `Marketing consent: ${order.marketingConsent ? 'Yes' : 'No'}`,
    invoice ? `Invoice: ${invoice.invoiceNumber}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const customerLines = [
    'Thank you for purchasing Modern Java: The Mindset Shift.',
    '',
    'Your secure downloads remain valid for 7 days.',
    'Open this email in HTML view and click “Download PDF”' +
      (epubUrl ? ' and “Download ePub”' : '') +
      '.',
  ];

  if (!epubUrl) {
    customerLines.push(
      '',
      'The ePub edition will be emailed to this address when it becomes available.',
    );
  }

  if (invoiceCopy.text) {
    customerLines.push('', invoiceCopy.text);
  }

  customerLines.push(
    '',
    'You will receive access to revised editions at this email address.',
    `If a download expires before you save the files, contact ${REPLY_TO_EMAIL}.`,
    '',
    `Order ID: ${order.appOrderId}`,
    '',
    `Visit the book website: ${SITE_URL}`,
  );

  const epubButton = epubUrl
    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
                  <tr>
                    <td align="center" bgcolor="#0f6b5c" style="border-radius:8px;">
                      <a href="${escapeHtml(epubUrl)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Download ePub
                      </a>
                    </td>
                  </tr>
                </table>`
    : `
                <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">
                  The ePub edition will be emailed to this address when it becomes available.
                </p>`;

  const customerHtml = `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a2332;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
                  Thank you for purchasing <strong>Modern Java: The Mindset Shift</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#445066;">
                  Your DRM-free digital edition is ready. These secure downloads remain valid for
                  <strong>7 days</strong>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
                  <tr>
                    <td align="center" bgcolor="#1a56db" style="border-radius:8px;">
                      <a href="${escapeHtml(pdfUrl)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Download PDF
                      </a>
                    </td>
                  </tr>
                </table>
                ${epubButton}
                ${invoiceCopy.html}
                <p style="margin:20px 0 8px;font-size:15px;line-height:1.55;">
                  <a href="${escapeHtml(SITE_URL)}" style="color:#1a56db;font-weight:600;text-decoration:none;">
                    Visit the Modern Java website →
                  </a>
                </p>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#667085;">
                  Order ID: ${escapeHtml(order.appOrderId)}. You will receive access to revised
                  editions at this email address. If a link expires, contact
                  <a href="mailto:${escapeHtml(REPLY_TO_EMAIL)}" style="color:#667085;">${escapeHtml(REPLY_TO_EMAIL)}</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Modern Java digital order ${order.appOrderId}`,
      text: adminText,
    }),
    sendEmail({
      to: order.email,
      subject: epubUrl
        ? 'Your Modern Java PDF and ePub downloads'
        : 'Your Modern Java DRM-free PDF download',
      text: customerLines.join('\n'),
      html: customerHtml,
      attachments: invoiceAttachments(invoice),
    }),
  ]);
};

const customerNameFromOrder = (order) => {
  const explicit = String(order.name || '').trim();
  if (explicit) {
    return explicit;
  }
  const local = String(order.email || '')
    .split('@')[0]
    .replace(/[._+-]+/g, ' ')
    .trim();
  if (!local) {
    return 'Modern Java customer';
  }
  return local.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

const createInvoiceForOrder = async (order) => {
  const isDigital = order.productType === 'digital_bundle';
  const lineItems = isDigital
    ? [
        {
          productCode: 'MJ-DIGITAL',
          name: 'Modern Java — DRM-free PDF + ePub',
          description:
            'Product code: MJ-DIGITAL. Direct digital edition (PDF + ePub).',
          quantity: 1,
          rate: Number(order.amount || DIGITAL_BUNDLE_PRICE_PAISE) / 100,
          unit: 'nos',
        },
      ]
    : [
        {
          productCode: 'MJ-PAPERBACK',
          name: 'Modern Java — Paperback',
          description: 'Product code: MJ-PAPERBACK. Print edition.',
          quantity: Number(order.quantity || 1),
          rate: PAPERBACK_PRICE_PAISE / 100,
          unit: 'nos',
        },
      ];

  const invoice = await createAndSendInvoice({
    email: order.email,
    name: customerNameFromOrder(order),
    city: order.city,
    postalCode: order.postalCode,
    lineItems,
    referenceNumber: order.appOrderId,
    paymentId: order.paymentId,
    paymentMode: order.checkoutBypass ? 'Other' : 'Razorpay',
  });

  if (!invoice) {
    return null;
  }

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { appOrderId: order.appOrderId },
        UpdateExpression:
          'SET zohoInvoiceId = :invoiceId, zohoInvoiceNumber = :invoiceNumber, zohoInvoiceUrl = :invoiceUrl, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':invoiceId': invoice.invoiceId,
          ':invoiceNumber': invoice.invoiceNumber,
          ':invoiceUrl': invoice.invoiceUrl || null,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  } catch (error) {
    console.error('Failed to store Zoho invoice fields on order', error);
    await notifyAdmin({
      subject: `Zoho invoice save failed — ${order.appOrderId}`,
      lines: [
        'Event: zoho_invoice_store_failed',
        `Order ID: ${order.appOrderId}`,
        `Customer: ${order.email}`,
        `Invoice: ${invoice.invoiceNumber || invoice.invoiceId}`,
        `Error: ${error.message || error}`,
      ],
    });
  }

  if (invoice.warning) {
    await notifyAdmin({
      subject: `Zoho invoice warning — ${order.appOrderId}`,
      lines: [
        'Event: zoho_invoice_warning',
        `Order ID: ${order.appOrderId}`,
        `Customer: ${order.email}`,
        `Product: ${order.productType || 'paperback'}`,
        `Invoice: ${invoice.invoiceNumber || invoice.invoiceId}`,
        `Warning: ${invoice.warning}`,
      ],
    });
  }

  return invoice;
};

const sendConfirmationEmails = async (order) => {
  let invoice = null;
  try {
    invoice = await createInvoiceForOrder(order);
  } catch (error) {
    console.error('Zoho invoice creation/send failed', error);
    const zohoDetail =
      error?.zoho && typeof error.zoho === 'object'
        ? JSON.stringify(error.zoho)
        : null;
    await notifyAdmin({
      subject: `Zoho invoice failed — ${order.appOrderId}`,
      lines: [
        'Event: zoho_invoice_failed',
        `Order ID: ${order.appOrderId}`,
        `Customer: ${order.email}`,
        `Name: ${order.name || '—'}`,
        `Product: ${order.productType || 'paperback'}`,
        `Amount: ₹${Number(order.amount || 0) / 100}`,
        `Payment ID: ${order.paymentId || '—'}`,
        `Error: ${error.message || error}`,
        zohoDetail ? `Zoho detail: ${zohoDetail}` : null,
        'Action: check Zoho OAuth refresh token / API credentials if token-related.',
      ],
    });
  }

  if (order.productType === 'digital_bundle') {
    return sendDigitalConfirmationEmails(order, invoice);
  }

  return sendPaperbackConfirmationEmails(order, invoice);
};

const createOrder = async (event) => {
  const { json } = parseBody(event);
  await verifyTurnstileCaptcha(event, json.captchaToken);
  const orderInput = validateOrder(json);
  const appOrderId = `MJ-${randomUUID().slice(0, 8).toUpperCase()}`;
  const amount = orderInput.quantity * PAPERBACK_PRICE_PAISE;
  const razorpayOrder = await createRazorpayOrder({
    amount,
    receipt: appOrderId,
    notes: { appOrderId },
  });
  const now = new Date().toISOString();

  await dynamo.send(
    new PutCommand({
      TableName: ORDERS_TABLE,
      Item: {
        appOrderId,
        razorpayOrderId: razorpayOrder.id,
        ...orderInput,
        amount,
        currency: 'INR',
        status: 'payment_pending',
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(appOrderId)',
    }),
  );

  return response(201, {
    appOrderId,
    razorpayOrderId: razorpayOrder.id,
    amount,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID,
  });
};

const verifyOrder = async (event) => {
  const { json } = parseBody(event);
  const {
    appOrderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = json;

  if (
    !appOrderId ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return response(400, { message: 'Missing payment verification details' });
  }

  const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (!safeEqual(razorpaySignature, expectedSignature)) {
    return response(400, { message: 'Payment verification failed' });
  }

  const existing = await dynamo.send(
    new GetCommand({
      TableName: ORDERS_TABLE,
      Key: { appOrderId },
    }),
  );
  const order = existing.Item;

  if (!order || order.razorpayOrderId !== razorpayOrderId) {
    return response(404, { message: 'Order not found' });
  }

  const updated = await dynamo.send(
    new UpdateCommand({
      TableName: ORDERS_TABLE,
      Key: { appOrderId },
      UpdateExpression:
        'SET #status = :paid, paymentId = :paymentId, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':paid': 'paid',
        ':paymentId': razorpayPaymentId,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }),
  );

  if (order.status !== 'paid') {
    try {
      await sendConfirmationEmails(updated.Attributes);
    } catch (error) {
      console.error('Order paid but confirmation email failed', error);
    }
  }

  return response(200, {
    appOrderId,
    status: 'paid',
    message: 'Payment verified and order confirmed',
  });
};

const processWebhook = async (event) => {
  const { raw, json } = parseBody(event);
  const signature =
    event.headers?.['x-razorpay-signature'] ||
    event.headers?.['X-Razorpay-Signature'];
  const expected = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');

  if (!safeEqual(signature, expected)) {
    return response(400, { message: 'Invalid webhook signature' });
  }

  if (json.event === 'payment.captured') {
    const payment = json.payload?.payment?.entity;
    if (payment?.order_id) {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: ORDERS_TABLE,
          IndexName: 'RazorpayOrderIndex',
          KeyConditionExpression: 'razorpayOrderId = :orderId',
          ExpressionAttributeValues: { ':orderId': payment.order_id },
          Limit: 1,
        }),
      );
      const order = result.Items?.[0];
      if (order && order.status !== 'paid') {
        const updated = await dynamo.send(
          new UpdateCommand({
            TableName: ORDERS_TABLE,
            Key: { appOrderId: order.appOrderId },
            UpdateExpression:
              'SET #status = :paid, paymentId = :paymentId, updatedAt = :updatedAt',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':paid': 'paid',
              ':paymentId': payment.id,
              ':updatedAt': new Date().toISOString(),
            },
            ReturnValues: 'ALL_NEW',
          }),
        );
        try {
          await sendConfirmationEmails(updated.Attributes);
        } catch (error) {
          console.error('Webhook reconciled payment but email failed', error);
        }
      }
    }
  }

  return response(200, { received: true });
};

exports.handler = async (event) => {
  try {
    activeAllowOrigin = resolveAllowOrigin(event);
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;

    if (method === 'OPTIONS') return response(204, {});
    if (method === 'POST' && path === '/paperback-waitlist') {
      return await joinPaperbackWaitlist({
        event,
        parseBody,
        response,
        verifyTurnstileCaptcha,
        dynamo,
        PutCommand,
        UpdateCommand,
        tableName: PAPERBACK_WAITLIST_TABLE,
        sendEmail,
        notifyAdmin,
      });
    }
    if (method === 'POST' && path === '/contact') {
      return await submitContactMessage(event);
    }
    if (method === 'POST' && path === '/sample-requests') {
      return await requestSampleChapter(event);
    }
    if (method === 'POST' && path === '/marketing-consents/unsubscribe') {
      return await unsubscribeMarketing(event);
    }
    if (method === 'POST' && path === '/marketing-consents') {
      return await recordMarketingConsent(event);
    }
    if (method === 'POST' && path === '/digital-orders') {
      return await createDigitalOrder(event);
    }
    if (method === 'POST' && path === '/orders') {
      return await createOrder(event);
    }
    if (method === 'POST' && path === '/orders/verify') {
      return await verifyOrder(event);
    }
    if (method === 'POST' && path === '/webhooks/razorpay') {
      return await processWebhook(event);
    }
    return response(404, { message: 'Not found' });
  } catch (error) {
    console.error(error);
    const isValidationError =
      error instanceof SyntaxError ||
      /required|invalid|quantity|captcha|please enter|please accept|consent/i.test(
        error.message || '',
      );
    return response(isValidationError ? 400 : 500, {
      message: isValidationError
        ? error.message
        : 'Unable to process the request right now',
    });
  }
};
