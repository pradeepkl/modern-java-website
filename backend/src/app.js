const { randomUUID, timingSafeEqual } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SESClient } = require('@aws-sdk/client-ses');
const {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  getSignedUrl: getCloudFrontSignedUrl,
} = require('@aws-sdk/cloudfront-signer');
const { createAndSendInvoice } = require('./zohoInvoice');
const { insertLicensePage, licensedPdfObjectKey } = require('./licensePdf');
const {
  getDigitalBundlePricePaise,
  getPaperbackUnitPricePaise,
  getPaperbackTotalPaise,
} = require('./productPrices');
const {
  normalizeVoucherCode,
  evaluateCheckoutVoucherCode,
  publicVoucherPricing,
  getVoucherByCode,
  reserveVoucher,
  releaseVoucherReservation,
  redeemVoucher,
  isCampaignVoucherCode,
  VOUCHER_KIND,
  INVALID_VOUCHER_MESSAGE,
} = require('./readerVoucher');
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
const {
  buildUnsubscribeUpdate,
  MARKETING_CONSENT,
  EMAIL_DELIVERY,
  EMAIL_CATEGORY,
} = require('./emailDelivery');
const {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  buildOneClickUnsubscribeUrl,
} = require('./unsubscribeToken');
const { sendEmail: sendSesEmail } = require('./sesMail');
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  publicOrderPaymentFields,
  persistedPaymentFields,
} = require('./razorpayClient');
const { getRazorpayConfig, isDevAppEnvironment } = require('./razorpayConfig');
const {
  extractMetaAttribution,
  sendLeadConversion,
  sendPurchaseConversion,
} = require('./metaConversionsApi');
const { recordAnalyticsConsentChoice } = require('./analyticsConsent');
const {
  SAMPLE_EMAIL_ALLOWLIST_MESSAGE,
  isAllowedSampleEmailDomain,
} = require('./sampleEmailAllowlist');
const {
  escapeHtml,
  BOOK_FULL_TITLE,
  INSTAGRAM_URL,
  wrapTransactionalEmail,
  emailHeadline,
  emailParagraph,
  emailSmallParagraph,
  emailButton,
  emailButtonRow,
  emailCallout,
  emailSiteLink,
  emailInstagramFollowText,
  emailInstagramFollow,
  emailClosing,
  emailMutedNote,
} = require('./emailLayout');

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
  VOUCHERS_TABLE,
  DIGITAL_ASSETS_BUCKET,
  SAMPLE_PDF_KEY = 'sample/modern-java-preview.pdf',
  DIGITAL_PDF_KEY = 'digital/modern-java-drm-free_v1.0.pdf',
  DIGITAL_EPUB_KEY = 'digital/modern-java-drm-free_v1.0.epub',
  ADMIN_EMAIL = 'pradeep@classpath.in',
  MAIL_FROM_EMAIL = 'no-reply@classpath.in',
  REPLY_TO_EMAIL = 'pradeep@classpath.in',
  ALLOWED_ORIGIN = '*',
  WEBSITE_URL = 'https://modern-java.classpath.in',
  PUBLIC_API_URL = '',
  UNSUBSCRIBE_TOKEN_SECRET = '',
  SES_CONFIGURATION_SET = 'classpath-email-prod',
  APP_ENV = 'dev',
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

const resolvePublicApiUrl = (event) => {
  const configured = String(PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const domain = event?.requestContext?.domainName;
  const stage = event?.requestContext?.stage;
  if (domain) {
    return stage && stage !== '$default'
      ? `https://${domain}/${stage}`
      : `https://${domain}`;
  }
  return '';
};

const buildListUnsubscribeUrlForEmail = (email, event) => {
  if (!UNSUBSCRIBE_TOKEN_SECRET) return undefined;
  const publicApiUrl = resolvePublicApiUrl(event);
  if (!publicApiUrl) return undefined;
  try {
    const token = createUnsubscribeToken(email, {
      secret: UNSUBSCRIBE_TOKEN_SECRET,
    });
    return buildOneClickUnsubscribeUrl({ publicApiUrl, token });
  } catch (error) {
    console.error('Unable to build List-Unsubscribe URL', error);
    return undefined;
  }
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  attachments = [],
  replyTo,
  listUnsubscribeUrl,
  tags = {},
  category,
  recipientRecord = null,
  bcc,
}) => {
  if (attachments.length > 0) {
    console.info('Sending SES raw email with attachments', {
      to,
      attachmentCount: attachments.length,
      attachmentBytes: attachments.reduce(
        (sum, item) => sum + (item.content?.length || 0),
        0,
      ),
    });
  }

  return sendSesEmail({
    ses,
    to,
    subject,
    text,
    html,
    attachments,
    replyTo: replyTo || REPLY_TO_EMAIL,
    mailFromEmail: MAIL_FROM_EMAIL,
    configurationSetName: SES_CONFIGURATION_SET,
    listUnsubscribeUrl,
    category,
    recipientRecord,
    // BCC only when callers opt in (purchase confirmations).
    bcc,
    tags: {
      environment: APP_ENV,
      ...tags,
    },
  });
};

const loadLeadRecord = async (email) => {
  if (!SAMPLE_REQUESTS_TABLE || !email) return null;
  const result = await dynamo.send(
    new GetCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Key: { email: String(email).trim().toLowerCase() },
    }),
  );
  return result.Item || null;
};

const isCustomerLead = (lead) =>
  String(lead?.leadStatus || '').toUpperCase() === 'CUSTOMER';

/**
 * Convert a sample lead to CUSTOMER after a paid Modern Java website order.
 * Stops sample/voucher acquisition emails via hasPurchased + leadStatus checks.
 */
const markLeadAsCustomer = async (email, { appOrderId } = {}) => {
  if (!SAMPLE_REQUESTS_TABLE || !email) return;
  const normalized = String(email).trim().toLowerCase();
  const now = new Date().toISOString();
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: SAMPLE_REQUESTS_TABLE,
        Key: { email: normalized },
        UpdateExpression:
          'SET leadStatus = :customer, customerAt = if_not_exists(customerAt, :now), ' +
          'customerAppOrderId = :orderId, updatedAt = :now',
        ConditionExpression: 'attribute_exists(email)',
        ExpressionAttributeValues: {
          ':customer': 'CUSTOMER',
          ':now': now,
          ':orderId': appOrderId || null,
        },
      }),
    );
  } catch (error) {
    if (isMarketingConditionalCheckFailed(error)) return;
    console.error('mark_lead_as_customer_failed', {
      email: normalized,
      appOrderId,
      errorName: error?.name || 'Error',
    });
  }
};

const redeemOrderVoucherIfPresent = async (order) => {
  const code = normalizeVoucherCode(order?.voucherCode);
  if (!code || !order?.email || !order?.appOrderId) {
    return;
  }
  // Campaign codes are multi-use and are not stored / redeemed per lead.
  if (isCampaignVoucherCode(code) || order.voucherKind === VOUCHER_KIND.CAMPAIGN) {
    return;
  }
  if (!VOUCHERS_TABLE) return;
  const redeemed = await redeemVoucher({
    dynamo,
    tableName: VOUCHERS_TABLE,
    code,
    email: order.email,
    appOrderId: order.appOrderId,
  });
  if (!redeemed) {
    console.error('voucher_redeem_failed', {
      appOrderId: order.appOrderId,
      voucherCode: code,
    });
  }
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
      category: EMAIL_CATEGORY.TRANSACTIONAL,
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
                <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">
                  Your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is attached to this email.
                </p>`
    : `
                <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">
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

const readMetaAttribution = (event, json) =>
  extractMetaAttribution({
    json,
    event,
    getClientIp,
  });

/**
 * Claim exclusive right to emit a Meta Purchase CAPI event for this order.
 * Prevents verify + webhook races from double-sending.
 * @param {string} appOrderId
 * @returns {Promise<boolean>}
 */
const claimMetaPurchaseSend = async (appOrderId) => {
  if (!ORDERS_TABLE || !appOrderId) return false;
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { appOrderId },
        UpdateExpression: 'SET metaPurchaseSentAt = :now',
        ConditionExpression: 'attribute_not_exists(metaPurchaseSentAt)',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
        },
      }),
    );
    return true;
  } catch (error) {
    if (isMarketingConditionalCheckFailed(error)) return false;
    console.error('meta_capi_purchase_claim_failed', {
      event_name: 'Purchase',
      event_id: appOrderId,
      errorName: error?.name || 'Error',
    });
    return false;
  }
};

/**
 * Send Purchase CAPI at most once per order. Never throws.
 * @param {Record<string, any>} order
 * @param {string} source
 */
const maybeSendPurchaseConversion = async (order, source) => {
  if (!order?.appOrderId) return;
  const claimed = await claimMetaPurchaseSend(order.appOrderId);
  if (!claimed) return;
  await sendPurchaseConversion({ order, source });
};

const isLocalClientOrigin = (event) => {
  const candidates = [
    event.headers?.origin,
    event.headers?.Origin,
    event.headers?.referer,
    event.headers?.Referer,
  ];

  for (const value of candidates) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    try {
      const { hostname } = new URL(raw);
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      // ignore invalid header values
    }
  }

  return false;
};

/**
 * Verify Cloudflare Turnstile.
 * - Production (APP_ENV=prod, non-localhost): captcha is mandatory.
 * - APP_ENV=dev or localhost Origin: skipped for faster local/dev testing.
 */
const verifyTurnstileCaptcha = async (event, token) => {
  if (isDevAppEnvironment()) {
    console.info('Skipping Turnstile verification (APP_ENV=dev)');
    return;
  }

  if (isLocalClientOrigin(event)) {
    console.info('Skipping Turnstile verification (localhost origin)');
    return;
  }

  const secret = String(TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    throw new Error('Captcha is required but is not configured');
  }

  const captchaToken = String(token || '').trim();
  if (!captchaToken) {
    throw new Error('Please complete the captcha check before continuing.');
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

const streamToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

/**
 * Build (or reuse) a per-order PDF with a personalized license page as page 1.
 * Uploads to digital/orders/{appOrderId}/ and returns the object key.
 */
const ensureLicensedDigitalPdf = async (order) => {
  const appOrderId = String(order?.appOrderId || '').trim();
  const email = String(order?.email || '').trim().toLowerCase();
  if (!appOrderId || !email) {
    throw new Error('Order appOrderId and email are required to license the PDF');
  }
  if (!DIGITAL_ASSETS_BUCKET) {
    throw new Error('DIGITAL_ASSETS_BUCKET is not configured');
  }

  const key = licensedPdfObjectKey(appOrderId);
  if (order.licensedPdfKey && (await objectExists(order.licensedPdfKey))) {
    return order.licensedPdfKey;
  }
  if (await objectExists(key)) {
    return key;
  }

  const master = await s3.send(
    new GetObjectCommand({
      Bucket: DIGITAL_ASSETS_BUCKET,
      Key: DIGITAL_PDF_KEY,
    }),
  );
  const masterBytes = await streamToBuffer(master.Body);
  const stamped = await insertLicensePage(masterBytes, {
    customerName: order.name,
    customerEmail: email,
    appOrderId,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: DIGITAL_ASSETS_BUCKET,
      Key: key,
      Body: Buffer.from(stamped),
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="modern-java-licensed.pdf"`,
      Metadata: {
        'app-order-id': appOrderId,
        'licensed-email': email.slice(0, 200),
      },
    }),
  );

  if (ORDERS_TABLE) {
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE,
          Key: { appOrderId },
          UpdateExpression:
            'SET licensedPdfKey = :key, licensedPdfAt = :at, updatedAt = :at',
          ExpressionAttributeValues: {
            ':key': key,
            ':at': new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      console.warn('Could not persist licensedPdfKey on order', {
        appOrderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info('Licensed PDF ready', { appOrderId, key, bytes: stamped.length });
  return key;
};

const createDigitalDownloadLinks = async (order) => {
  const licensedPdfKey = await ensureLicensedDigitalPdf(order);
  const pdfUrl = await createSignedDownloadUrl(licensedPdfKey);
  const hasEpub = await objectExists(DIGITAL_EPUB_KEY);
  const epubUrl = hasEpub
    ? await createSignedDownloadUrl(DIGITAL_EPUB_KEY)
    : null;

  return { pdfUrl, epubUrl, licensedPdfKey };
};

const requestSampleChapter = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();
  const metaAttribution = readMetaAttribution(event, json);

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }

  if (!isAllowedSampleEmailDomain(email)) {
    return response(400, { message: SAMPLE_EMAIL_ALLOWLIST_MESSAGE });
  }

  await verifyTurnstileCaptcha(event, json.captchaToken);

  if (!SAMPLE_REQUESTS_TABLE || !DIGITAL_ASSETS_BUCKET) {
    return response(503, {
      message:
        'Chapter preview delivery is not configured yet. Please try again later.',
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
  const sampleRequestId =
    String(existing.Item?.sampleRequestId || '').trim() ||
    `SR-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  if (Date.now() - previousRequest < SAMPLE_REQUEST_COOLDOWN_MS) {
    return response(200, {
      message:
        'The chapter preview was sent recently. Please check your inbox.',
      accepted: false,
      sampleRequestId: existing.Item?.sampleRequestId || undefined,
    });
  }

  try {
    await assertObjectExists(SAMPLE_PDF_KEY);
  } catch (error) {
    if (error.code === 'ASSET_MISSING') {
      return response(503, {
        message:
          'The chapter preview is being prepared. Please try again later.',
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
    ? `You also asked to receive occasional Modern Java articles and book updates. If you stay opted in, I may send a few short follow-up notes about the book. Unsubscribe anytime: ${SITE_URL}/unsubscribe`
    : 'You have not been subscribed to marketing updates.';
  const sampleText = [
    `Thank you for your interest in ${BOOK_FULL_TITLE}.`,
    '',
    'Your free chapter preview is ready. It includes the first two chapters.',
    'Download and save the file soon — this secure link remains valid for 2 days.',
    '',
    `Download PDF: ${sampleChapterUrl}`,
    '',
    `Visit the Modern Java website: ${SITE_URL}`,
    '',
    marketingLine,
    '',
    emailInstagramFollowText(),
    '',
    'Thank you again — happy learning!',
  ].join('\n');
  const sampleHtml = wrapTransactionalEmail(`
                ${emailHeadline('Your chapter preview is ready')}
                ${emailParagraph(
                  `Thank you for your interest in <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong>. Your free preview includes the first two chapters.`,
                )}
                ${emailParagraph(
                  'Download and save the file soon — this secure link remains valid for <strong>2 days</strong>.',
                )}
                ${emailButton({
                  href: sampleChapterUrl,
                  label: 'Download PDF',
                })}
                ${emailSiteLink(SITE_URL)}
                ${emailMutedNote(escapeHtml(marketingLine))}
                ${emailInstagramFollow()}
                ${emailClosing()}
  `);

  try {
    await sendEmail({
      to: email,
      subject: 'Your Modern Java chapter preview is ready',
      text: sampleText,
      html: sampleHtml,
      category: EMAIL_CATEGORY.TRANSACTIONAL,
      recipientRecord: existing.Item || { email },
      tags: {
        funnel: 'sample',
        sequenceDay: '0',
      },
    });
  } catch (error) {
    if (error?.name === 'EmailEligibilityError') {
      console.error('Chapter preview email blocked by delivery status', {
        email,
        reason: error.reason,
      });
      return response(503, {
        message:
          'Email delivery is temporarily unavailable. Please try again later, or contact pradeep@classpath.in.',
      });
    }
    if (
      error?.name === 'MessageRejected' ||
      /not verified|sandbox/i.test(error?.message || '')
    ) {
      console.error('Chapter preview email rejected by SES', error);
      return response(503, {
        message:
          'Email delivery is temporarily unavailable. Please try again later, or contact pradeep@classpath.in.',
      });
    }
    throw error;
  }

  const consentedNow =
    existing.Item?.marketingConsent === true || marketingConsent;

  await dynamo.send(
    new PutCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Item: {
        ...existing.Item,
        email,
        sampleRequestId,
        firstRequestedAt: existing.Item?.firstRequestedAt || now,
        lastRequestedAt: now,
        requestCount: Number(existing.Item?.requestCount || 0) + 1,
        marketingConsent: consentedNow,
        marketingConsentStatus: consentedNow
          ? MARKETING_CONSENT.CONSENTED
          : existing.Item?.marketingConsentStatus ||
            (existing.Item?.marketingConsent === false
              ? MARKETING_CONSENT.WITHDRAWN
              : null),
        emailDeliveryStatus:
          existing.Item?.emailDeliveryStatus || EMAIL_DELIVERY.ACTIVE,
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
        ...(marketingConsent ? { marketingUnsubscribedAt: undefined } : {}),
      },
    }),
  );

  const requestCount = Number(existing.Item?.requestCount || 0) + 1;
  const storedMarketingConsent =
    existing.Item?.marketingConsent === true || marketingConsent;
  await notifyAdmin({
    subject: `Chapter preview requested — ${email}`,
    lines: [
      'Event: chapter_preview_requested',
      `Email: ${email}`,
      `Marketing opt-in (this request): ${marketingConsent ? 'Yes' : 'No'}`,
      `Marketing opt-in (stored): ${storedMarketingConsent ? 'Yes' : 'No'}`,
      `Request count: ${requestCount}`,
      `Time: ${now}`,
    ],
  });

  // Meta CAPI Lead — never fails the sample workflow.
  try {
    await sendLeadConversion({
      sampleRequestId,
      email,
      attribution: metaAttribution,
      source: 'sample_request',
    });
  } catch (error) {
    console.error('meta_capi_lead_failed', {
      event_name: 'Lead',
      event_id: sampleRequestId,
      errorName: error?.name || 'Error',
    });
  }

  return response(200, {
    message: 'Check your inbox—the chapter preview is on its way.',
    accepted: true,
    sampleRequestId,
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
          'marketingConsentStatus = :consentStatus, ' +
          'marketingConsentAt = if_not_exists(marketingConsentAt, :now), ' +
          'marketingConsentUpdatedAt = :now, consentVersion = :version, ' +
          'marketingConsentSource = :source, ' +
          'emailDeliveryStatus = if_not_exists(emailDeliveryStatus, :deliveryActive) ' +
          'REMOVE marketingUnsubscribedAt',
        ExpressionAttributeValues: {
          ...values,
          ':consentStatus': MARKETING_CONSENT.CONSENTED,
          ':deliveryActive': EMAIL_DELIVERY.ACTIVE,
        },
      }),
    );
    return;
  }

  const unsubscribeUpdate = buildUnsubscribeUpdate({
    now,
    source: String(source || 'unsubscribe-page'),
  });
  await dynamo.send(
    new UpdateCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Key: { email },
      UpdateExpression: `${unsubscribeUpdate.UpdateExpression}, consentVersion = :version`,
      ExpressionAttributeValues: {
        ...unsubscribeUpdate.ExpressionAttributeValues,
        ':version': String(consentVersion || 'unknown'),
      },
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

  // Consent is already persisted. Welcome mail is best-effort and must never
  // undo the subscription or delay Amazon navigation on SES failure.
  if (registrationStatus === 'created') {
    try {
      const welcome = buildWelcomeEmail({ siteUrl: SITE_URL });
      await sendEmail({
        to: email,
        subject: welcome.subject,
        text: welcome.text,
        html: welcome.html,
        category: EMAIL_CATEGORY.MARKETING,
        recipientRecord: {
          email,
          marketingConsent: true,
          marketingConsentStatus: MARKETING_CONSENT.CONSENTED,
          emailDeliveryStatus: EMAIL_DELIVERY.ACTIVE,
        },
        listUnsubscribeUrl: buildListUnsubscribeUrlForEmail(email, event),
        tags: {
          funnel: 'reader-list',
          sequenceDay: '0',
        },
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
    registration_status: registrationStatus,
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
      'You have been unsubscribed from optional marketing emails. Purchase and chapter preview delivery messages are unaffected.',
  });
};

/**
 * RFC 8058 one-click unsubscribe. Mutates only on POST.
 * GET must not unsubscribe (link scanners).
 */
const oneClickUnsubscribe = async (event) => {
  const method = event.requestContext?.http?.method || 'GET';
  const token = decodeURIComponent(
    String(event.pathParameters?.token || '').trim(),
  );

  if (method === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: 'To unsubscribe, use the Unsubscribe button in your email client, or visit the website unsubscribe page.',
    };
  }

  if (method !== 'POST') {
    return response(405, { message: 'Method not allowed' });
  }

  if (!SAMPLE_REQUESTS_TABLE || !UNSUBSCRIBE_TOKEN_SECRET) {
    return response(503, {
      message: 'Email preferences are not configured yet. Please try again later.',
    });
  }

  const verified = verifyUnsubscribeToken(token, {
    secret: UNSUBSCRIBE_TOKEN_SECRET,
  });
  // Always 200 for invalid tokens to avoid leaking validity to scanners.
  if (!verified?.email) {
    return {
      statusCode: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: 'OK',
    };
  }

  const unsubscribeUpdate = buildUnsubscribeUpdate({
    source: 'rfc8058-one-click',
  });
  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: SAMPLE_REQUESTS_TABLE,
        Key: { email: verified.email },
        ...unsubscribeUpdate,
      }),
    );
  } catch (error) {
    // Idempotent even when the lead row does not exist yet.
    console.error('One-click unsubscribe update failed', {
      email: verified.email,
      error,
    });
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: 'OK',
  };
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
      category: EMAIL_CATEGORY.TRANSACTIONAL,
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

const validateDigitalCustomer = (input) => {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();

  if (!name) throw new Error('Name is required');
  if (!EMAIL_PATTERN.test(email)) throw new Error('Invalid email address');

  // Digital checkout collects only name + email — no city or postal code.
  return { name, email };
};

const resolveDigitalCheckoutPricing = async ({
  email,
  voucherCode,
  appOrderId = null,
}) => {
  const fullAmountPaise = getDigitalBundlePricePaise();
  const code = normalizeVoucherCode(voucherCode);
  if (!code) {
    return {
      amountPaise: fullAmountPaise,
      voucherCode: null,
      voucherKind: null,
      voucherFields: {},
      pricing: null,
    };
  }

  if (isCampaignVoucherCode(code)) {
    const evaluation = evaluateCheckoutVoucherCode(code);
    if (!evaluation.ok) {
      const error = new Error(evaluation.message);
      error.code = 'VOUCHER_INVALID';
      throw error;
    }
    return {
      amountPaise: evaluation.pricing.payableAmountPaise,
      voucherCode: code,
      voucherKind: VOUCHER_KIND.CAMPAIGN,
      voucherFields: {
        voucherCode: code,
        voucherKind: VOUCHER_KIND.CAMPAIGN,
        originalAmount: evaluation.pricing.basisAmountPaise,
        discountAmount: evaluation.pricing.discountAmountPaise,
      },
      pricing: evaluation.pricing,
    };
  }

  if (!VOUCHERS_TABLE) {
    const error = new Error(INVALID_VOUCHER_MESSAGE);
    error.code = 'VOUCHER_INVALID';
    throw error;
  }

  const lead = await loadLeadRecord(email);
  const voucher = await getVoucherByCode(dynamo, VOUCHERS_TABLE, code);
  const evaluation = evaluateCheckoutVoucherCode(code, {
    voucher,
    email,
    appOrderId,
    hasPurchased: isCustomerLead(lead),
  });
  if (!evaluation.ok) {
    const error = new Error(evaluation.message);
    error.code = 'VOUCHER_INVALID';
    throw error;
  }

  return {
    amountPaise: evaluation.pricing.payableAmountPaise,
    voucherCode: code,
    voucherKind: VOUCHER_KIND.PERSONAL,
    voucherFields: {
      voucherCode: code,
      voucherKind: VOUCHER_KIND.PERSONAL,
      originalAmount: evaluation.pricing.basisAmountPaise,
      discountAmount: evaluation.pricing.discountAmountPaise,
    },
    pricing: evaluation.pricing,
  };
};

const validateReaderVoucher = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '')
    .trim()
    .toLowerCase();
  const voucherCode = normalizeVoucherCode(json.voucherCode || json.code);

  if (!voucherCode) {
    return response(400, { message: INVALID_VOUCHER_MESSAGE });
  }

  if (isCampaignVoucherCode(voucherCode)) {
    const evaluation = evaluateCheckoutVoucherCode(voucherCode);
    if (!evaluation.ok) {
      return response(400, { message: evaluation.message });
    }
    return response(200, {
      valid: true,
      voucherCode,
      voucherKind: VOUCHER_KIND.CAMPAIGN,
      ...publicVoucherPricing(evaluation.pricing),
    });
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }
  if (!VOUCHERS_TABLE) {
    return response(503, {
      message: 'Reader vouchers are not configured yet.',
    });
  }

  const lead = await loadLeadRecord(email);
  const voucher = await getVoucherByCode(dynamo, VOUCHERS_TABLE, voucherCode);
  const evaluation = evaluateCheckoutVoucherCode(voucherCode, {
    voucher,
    email,
    hasPurchased: isCustomerLead(lead),
  });

  if (!evaluation.ok) {
    return response(400, { message: evaluation.message });
  }

  return response(200, {
    valid: true,
    voucherCode,
    voucherKind: VOUCHER_KIND.PERSONAL,
    ...publicVoucherPricing(evaluation.pricing),
    expiresAt: voucher?.expiresAt,
  });
};

const createDigitalOrder = async (event) => {
  const { json } = parseBody(event);
  const { name, email } = validateDigitalCustomer(json);
  const metaAttribution = readMetaAttribution(event, json);
  const requestedVoucherCode = normalizeVoucherCode(
    json.voucherCode || json.promoCode,
  );

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
  const bypassAuthorized =
    bypassSecret.length > 0 && safeEqual(providedSecret, bypassSecret);
  const localDevClient = isLocalClientOrigin(event);
  if (
    json.skipPayment === true &&
    !isDevAppEnvironment() &&
    !localDevClient &&
    !bypassAuthorized
  ) {
    return response(403, {
      message: 'Payment skip is not allowed in this environment',
    });
  }
  const skipPayment =
    isDevAppEnvironment() ||
    (json.skipPayment === true && (localDevClient || bypassAuthorized));

  const appOrderId = `MJ-D-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const marketingConsent = json.marketingConsent === true;
  const customerFields = { name, email };

  let checkoutPricing;
  try {
    checkoutPricing = await resolveDigitalCheckoutPricing({
      email,
      voucherCode: requestedVoucherCode,
      appOrderId,
    });
  } catch (error) {
    if (error.code === 'VOUCHER_INVALID' || error.code === 'VOUCHER_RESERVED') {
      return response(400, { message: error.message });
    }
    throw error;
  }

  const amountPaise = checkoutPricing.amountPaise;
  const voucherFields = checkoutPricing.voucherFields;

  if (
    checkoutPricing.voucherCode &&
    checkoutPricing.voucherKind === VOUCHER_KIND.PERSONAL
  ) {
    try {
      await reserveVoucher({
        dynamo,
        tableName: VOUCHERS_TABLE,
        code: checkoutPricing.voucherCode,
        email,
        appOrderId,
        hasPurchased: isCustomerLead(await loadLeadRecord(email)),
      });
    } catch (error) {
      if (error.code === 'VOUCHER_INVALID' || error.code === 'VOUCHER_RESERVED') {
        return response(400, { message: error.message });
      }
      throw error;
    }
  }

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
    const paymentMeta = paymentMetaForSkippedCheckout();
    const paidOrder = {
      appOrderId,
      razorpayOrderId: `order_bypass_${appOrderId}`,
      productType: 'digital_bundle',
      ...customerFields,
      amount: amountPaise,
      currency: 'INR',
      status: 'paid',
      paymentId,
      ...paymentMeta,
      ...voucherFields,
      revisionUpdates: true,
      marketingConsent,
      marketingConsentAt: marketingConsent ? now : null,
      consentVersion: marketingConsent
        ? String(json.consentVersion || 'unknown')
        : null,
      checkoutBypass: true,
      metaAttribution,
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: paidOrder,
        ConditionExpression: 'attribute_not_exists(appOrderId)',
      }),
    );

    await redeemOrderVoucherIfPresent(paidOrder);
    await markLeadAsCustomer(email, { appOrderId });

    const order = {
      appOrderId,
      paymentId,
      amount: amountPaise,
      ...customerFields,
      marketingConsent,
      productType: 'digital_bundle',
      checkoutBypass: true,
      metaAttribution,
      ...voucherFields,
    };
    const downloads = await createDigitalDownloadLinks(paidOrder);
    try {
      await sendConfirmationEmails(order);
    } catch (error) {
      console.error('Bypass order paid but confirmation email failed', error);
    }
    await maybeSendPurchaseConversion(paidOrder, 'digital_bypass');

    return response(201, {
      appOrderId,
      skippedPayment: true,
      amount: amountPaise,
      currency: 'INR',
      downloads,
      ...(checkoutPricing.pricing
        ? publicVoucherPricing(checkoutPricing.pricing)
        : {}),
    });
  }

  let razorpayOrder;
  try {
    const razorpayConfig = getRazorpayConfig();
    razorpayOrder = await createRazorpayOrder({
      amount: amountPaise,
      receipt: appOrderId,
      notes: {
        appOrderId,
        productType: 'digital_bundle',
        ...(checkoutPricing.voucherCode
          ? { voucherCode: checkoutPricing.voucherCode }
          : {}),
      },
    }, razorpayConfig);

    await dynamo.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: {
          appOrderId,
          razorpayOrderId: razorpayOrder.id,
          productType: 'digital_bundle',
          ...customerFields,
          amount: amountPaise,
          currency: 'INR',
          status: 'payment_pending',
          ...persistedPaymentFields(razorpayConfig),
          ...voucherFields,
          revisionUpdates: true,
          marketingConsent,
          marketingConsentAt: marketingConsent ? now : null,
          consentVersion: marketingConsent
            ? String(json.consentVersion || 'unknown')
            : null,
          metaAttribution,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(appOrderId)',
      }),
    );

    return response(201, {
      appOrderId,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      ...(checkoutPricing.pricing
        ? {
            voucherCode: checkoutPricing.voucherCode,
            ...publicVoucherPricing(checkoutPricing.pricing),
          }
        : {}),
      ...publicOrderPaymentFields(razorpayConfig),
    });
  } catch (error) {
    if (
      checkoutPricing.voucherCode &&
      checkoutPricing.voucherKind === VOUCHER_KIND.PERSONAL
    ) {
      try {
        await releaseVoucherReservation({
          dynamo,
          tableName: VOUCHERS_TABLE,
          code: checkoutPricing.voucherCode,
          appOrderId,
        });
      } catch (releaseError) {
        console.error('voucher_release_after_order_failure', releaseError);
      }
    }
    throw error;
  }
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
  const adminText = [formatOrderEmail(order), '', invoiceCopy.text]
    .filter(Boolean)
    .join('\n');
  const adminSubject = `Modern Java paperback order ${order.appOrderId}`;
  const customerTextLines = [
    `Thank you for your ${BOOK_FULL_TITLE} paperback order.`,
    '',
    'Payment was successful. We’ll prepare your order for shipment.',
    'We’ll email you again when your order has been shipped.',
    '',
    `Order ID: ${order.appOrderId}`,
    'Please quote this Order ID in any communication about your purchase.',
    '',
    `Name: ${order.name}`,
    `Email: ${order.email}`,
    `Phone: +91 ${order.phone}`,
    `Quantity: ${order.quantity}`,
    `Amount: ₹${order.amount / 100}`,
    '',
    'Delivery address:',
    order.address,
    `${order.city}, ${order.state} - ${order.postalCode}`,
    order.country,
  ];

  if (order.notes) {
    customerTextLines.push('', `Notes: ${order.notes}`);
  }
  if (invoiceCopy.text) {
    customerTextLines.push('', invoiceCopy.text);
  }
  customerTextLines.push(
    '',
    `Visit the Modern Java website: ${SITE_URL}`,
    '',
    emailInstagramFollowText(),
    '',
    'Thank you for your order — happy learning!',
  );
  const customerText = customerTextLines.join('\n');

  const customerHtml = wrapTransactionalEmail(`
                ${emailHeadline('Thank you for your purchase')}
                ${emailParagraph(
                  `Your <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong> paperback order is confirmed. Payment was successful, and we’ll prepare your order for shipment.`,
                )}
                ${emailParagraph(
                  'We’ll email you again when your order has been shipped.',
                )}
                ${emailCallout({
                  label: 'Order ID',
                  value: order.appOrderId,
                  note: 'Please quote this Order ID in any communication about your purchase.',
                })}
                ${emailSmallParagraph(
                  `<strong style="color:#1a2332;">Ship to:</strong> ${escapeHtml(order.name)}<br/>
                  ${escapeHtml(order.address)}<br/>
                  ${escapeHtml(`${order.city}, ${order.state} - ${order.postalCode}`)}<br/>
                  ${escapeHtml(order.country)}`,
                  '0 0 12px',
                )}
                ${emailSmallParagraph(
                  `<strong style="color:#1a2332;">Quantity:</strong> ${escapeHtml(String(order.quantity))} &nbsp;·&nbsp; <strong style="color:#1a2332;">Amount:</strong> ₹${escapeHtml(String(order.amount / 100))}`,
                  '0 0 12px',
                )}
                ${
                  order.notes
                    ? emailSmallParagraph(
                        `<strong style="color:#1a2332;">Notes:</strong> ${escapeHtml(order.notes)}`,
                        '0 0 12px',
                      )
                    : ''
                }
                ${invoiceCopy.html}
                ${emailSiteLink(SITE_URL)}
                ${emailInstagramFollow()}
                ${emailClosing('Thank you for your order — happy learning!')}
  `);

  await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: adminSubject,
      text: adminText,
      category: EMAIL_CATEGORY.TRANSACTIONAL,
    }),
    sendEmail({
      to: order.email,
      subject: 'Your Modern Java paperback order is confirmed',
      text: customerText,
      html: customerHtml,
      attachments: invoiceAttachments(invoice),
      category: EMAIL_CATEGORY.TRANSACTIONAL,
      recipientRecord: await loadLeadRecord(order.email),
      bcc: ADMIN_EMAIL,
      tags: { funnel: 'paperback-checkout' },
    }),
  ]);
};

const sendDigitalConfirmationEmails = async (order, invoice = null) => {
  const { pdfUrl, epubUrl } = await createDigitalDownloadLinks(order);
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
    `Thank you for purchasing ${BOOK_FULL_TITLE}.`,
    '',
    'Your DRM-free digital edition is ready. Download and save your files soon — these secure links remain valid for 7 days.',
    '',
    `Download PDF: ${pdfUrl}`,
  ];

  if (epubUrl) {
    customerLines.push(`Download ePub: ${epubUrl}`);
  } else {
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
    `Order ID: ${order.appOrderId}`,
    'Please quote this Order ID in any communication about your purchase.',
    '',
    'Need the files again later?',
    'Just reply to this email and we’ll resend your digital edition anytime — even after the download links expire.',
    '',
    'We’ll also notify you at this email address when revised editions become available.',
    '',
    'Stay connected',
    'Follow Classpath Publications on Instagram for updates and reader highlights:',
    INSTAGRAM_URL,
    '',
    'If the book helps you, please consider leaving an honest review or a short note on our Instagram page. It helps other readers find the book.',
    '',
    `Visit the Modern Java website: ${SITE_URL}`,
    '',
    'Thank you again — happy learning!',
  );

  const downloadButtons = epubUrl
    ? emailButtonRow([
        { href: pdfUrl, label: 'Download PDF', bgcolor: '#1a56db' },
        { href: epubUrl, label: 'Download ePub', bgcolor: '#0f6b5c' },
      ])
    : `${emailButton({ href: pdfUrl, label: 'Download PDF' })}
                ${emailSmallParagraph(
                  'The ePub edition will be emailed to this address when it becomes available.',
                  '0 0 20px',
                )}`;

  const customerHtml = wrapTransactionalEmail(`
                ${emailHeadline('Thank you for your purchase')}
                ${emailParagraph(
                  `Your DRM-free copy of <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong> is ready. Download and save your files soon — these secure links remain valid for <strong>7 days</strong>.`,
                )}
                ${downloadButtons}
                ${invoiceCopy.html}
                ${emailCallout({
                  label: 'Order ID',
                  value: order.appOrderId,
                  note: 'Please quote this Order ID in any communication about your purchase.',
                })}
                ${emailSmallParagraph(
                  '<strong style="color:#1a2332;">Need the files again later?</strong><br/>Just reply to this email and we’ll resend your digital edition anytime — even after the download links expire.',
                  '0 0 12px',
                )}
                ${emailSmallParagraph(
                  'We’ll also notify you at this email address when revised editions become available.',
                  '0 0 16px',
                )}
                ${emailSmallParagraph(
                  `<strong style="color:#1a2332;">Stay connected</strong><br/>Follow Classpath Publications on Instagram for updates and reader highlights:<br/><a href="${escapeHtml(INSTAGRAM_URL)}" style="color:#1a56db;text-decoration:none;">${escapeHtml(INSTAGRAM_URL)}</a>`,
                  '0 0 12px',
                )}
                ${emailSmallParagraph(
                  `If the book helps you, please consider leaving an honest review or a short note on our <a href="${escapeHtml(INSTAGRAM_URL)}" style="color:#1a56db;text-decoration:none;">Instagram page</a>. It helps other readers find the book.`,
                  '0 0 8px',
                )}
                ${emailSiteLink(SITE_URL)}
                ${emailClosing()}
  `);

  await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Modern Java digital order ${order.appOrderId}`,
      text: adminText,
      category: EMAIL_CATEGORY.TRANSACTIONAL,
    }),
    sendEmail({
      to: order.email,
      subject: epubUrl
        ? 'Your Modern Java digital edition is ready'
        : 'Your Modern Java PDF download is ready',
      text: customerLines.join('\n'),
      html: customerHtml,
      attachments: invoiceAttachments(invoice),
      category: EMAIL_CATEGORY.TRANSACTIONAL,
      recipientRecord: await loadLeadRecord(order.email),
      bcc: ADMIN_EMAIL,
      tags: { funnel: 'digital-checkout' },
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
  if (order.checkoutBypass) {
    console.info(
      'Skipping Zoho invoice creation (checkout bypass / local-dev skip)',
    );
    return null;
  }

  const isDigital = order.productType === 'digital_bundle';
  const lineItems = isDigital
    ? [
        {
          productCode: 'MJ-DIGITAL',
          name: 'Modern Java — DRM-free PDF + ePub',
          description:
            'Product code: MJ-DIGITAL. Direct digital edition (PDF + ePub).',
          quantity: 1,
          rate: Number(order.amount || getDigitalBundlePricePaise()) / 100,
          unit: 'nos',
        },
      ]
    : [
        {
          productCode: 'MJ-PAPERBACK',
          name: 'Modern Java — Paperback',
          description: 'Product code: MJ-PAPERBACK. Print edition.',
          quantity: Number(order.quantity || 1),
          rate: getPaperbackUnitPricePaise() / 100,
          unit: 'nos',
        },
      ];

  const invoice = await createAndSendInvoice({
    email: order.email,
    name: customerNameFromOrder(order),
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

const paymentMetaForSkippedCheckout = () => {
  try {
    return persistedPaymentFields(getRazorpayConfig());
  } catch (error) {
    console.warn(
      'Using fallback payment meta for skipped checkout',
      error instanceof Error ? error.message : error,
    );
    return {
      paymentProvider: 'razorpay',
      paymentEnvironment: isDevAppEnvironment() ? 'dev' : 'prod',
    };
  }
};

const createOrder = async (event) => {
  const { json } = parseBody(event);
  await verifyTurnstileCaptcha(event, json.captchaToken);
  const orderInput = validateOrder(json);
  const metaAttribution = readMetaAttribution(event, json);
  const appOrderId = `MJ-${randomUUID().slice(0, 8).toUpperCase()}`;
  const amount = getPaperbackTotalPaise(orderInput.quantity);
  const now = new Date().toISOString();
  const skipPayment =
    isDevAppEnvironment() || isLocalClientOrigin(event);

  if (skipPayment) {
    const paymentId = `bypass_${randomUUID().slice(0, 12)}`;
    const paymentMeta = paymentMetaForSkippedCheckout();
    const paidOrder = {
      appOrderId,
      razorpayOrderId: `order_bypass_${appOrderId}`,
      ...orderInput,
      amount,
      currency: 'INR',
      status: 'paid',
      paymentId,
      ...paymentMeta,
      checkoutBypass: true,
      metaAttribution,
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(
      new PutCommand({
        TableName: ORDERS_TABLE,
        Item: paidOrder,
        ConditionExpression: 'attribute_not_exists(appOrderId)',
      }),
    );

    const order = {
      appOrderId,
      paymentId,
      amount,
      ...orderInput,
      checkoutBypass: true,
      metaAttribution,
    };
    try {
      await sendConfirmationEmails(order);
    } catch (error) {
      console.error(
        'Dev paperback order paid but confirmation email failed',
        error,
      );
    }
    await markLeadAsCustomer(orderInput.email, { appOrderId });
    await maybeSendPurchaseConversion(paidOrder, 'paperback_bypass');

    return response(201, {
      appOrderId,
      amount,
      currency: 'INR',
      skippedPayment: true,
      ...paymentMeta,
    });
  }

  const razorpayConfig = getRazorpayConfig();
  const razorpayOrder = await createRazorpayOrder({
    amount,
    receipt: appOrderId,
    notes: { appOrderId },
  }, razorpayConfig);

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
        ...persistedPaymentFields(razorpayConfig),
        metaAttribution,
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
    ...publicOrderPaymentFields(razorpayConfig),
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

  if (
    !verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    })
  ) {
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
    await redeemOrderVoucherIfPresent(updated.Attributes);
    await markLeadAsCustomer(updated.Attributes?.email, { appOrderId });
    try {
      await sendConfirmationEmails(updated.Attributes);
    } catch (error) {
      console.error('Order paid but confirmation email failed', error);
    }
    await maybeSendPurchaseConversion(updated.Attributes, 'orders_verify');
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

  if (!verifyWebhookSignature({ rawBody: raw, signature })) {
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
        await redeemOrderVoucherIfPresent(updated.Attributes);
        await markLeadAsCustomer(updated.Attributes?.email, {
          appOrderId: order.appOrderId,
        });
        try {
          await sendConfirmationEmails(updated.Attributes);
        } catch (error) {
          console.error('Webhook reconciled payment but email failed', error);
        }
        await maybeSendPurchaseConversion(
          updated.Attributes,
          'razorpay_webhook',
        );
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
    if (method === 'POST' && path === '/analytics-consents') {
      return await recordAnalyticsConsentChoice({
        event,
        parseBody,
        response,
      });
    }
    if (method === 'POST' && path === '/marketing-consents/unsubscribe') {
      return await unsubscribeMarketing(event);
    }
    if (
      (method === 'POST' || method === 'GET') &&
      path?.startsWith('/marketing-consents/one-click/')
    ) {
      const token = path.slice('/marketing-consents/one-click/'.length);
      return await oneClickUnsubscribe({
        ...event,
        pathParameters: { ...(event.pathParameters || {}), token },
      });
    }
    if (method === 'POST' && path === '/marketing-consents') {
      return await recordMarketingConsent(event);
    }
    if (method === 'POST' && path === '/digital-orders') {
      return await createDigitalOrder(event);
    }
    if (method === 'POST' && path === '/vouchers/validate') {
      return await validateReaderVoucher(event);
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
