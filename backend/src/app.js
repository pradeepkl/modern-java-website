const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
// Domain identity is verified in us-east-1 (also where inbound MX points).
const ses = new SESClient({ region: process.env.SES_REGION || 'us-east-1' });
const s3 = new S3Client({});

const {
  ORDERS_TABLE,
  SAMPLE_REQUESTS_TABLE,
  DIGITAL_ASSETS_BUCKET,
  SAMPLE_PDF_KEY = 'sample/modern-java-preview.pdf',
  DIGITAL_PDF_KEY = 'digital/modern-java.pdf',
  DIGITAL_EPUB_KEY = 'digital/modern-java.epub',
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  ADMIN_EMAIL = 'pradeep@classpath.in',
  MAIL_FROM_EMAIL = 'no-reply@classpath.in',
  REPLY_TO_EMAIL = 'pradeep@classpath.in',
  ALLOWED_ORIGIN = '*',
  WEBSITE_URL = 'https://modern-java.classpath.in',
} = process.env;

const SITE_URL = String(WEBSITE_URL).replace(/\/$/, '');

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sendEmail = ({ to, subject, text, html }) =>
  ses.send(
    new SendEmailCommand({
      Source: MAIL_FROM_EMAIL,
      ReplyToAddresses: [REPLY_TO_EMAIL],
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

const PAPERBACK_PRICE_PAISE = 49900;
const DIGITAL_BUNDLE_PRICE_PAISE = 39900;
const MAX_QUANTITY = 20;
const DOWNLOAD_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const SAMPLE_DOWNLOAD_LINK_TTL_SECONDS = 2 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\d{10}$/;
const PIN_PATTERN = /^\d{6}$/;
const SAMPLE_REQUEST_COOLDOWN_MS = 60 * 1000;

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'access-control-allow-origin': ALLOWED_ORIGIN,
    'access-control-allow-headers': 'content-type,x-razorpay-signature',
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

const createSignedDownloadUrl = (key, expiresIn = DOWNLOAD_LINK_TTL_SECONDS) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: DIGITAL_ASSETS_BUCKET,
      Key: key,
    }),
    { expiresIn },
  );

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

const requestSampleChapter = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }

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
    ? 'You also asked to receive occasional Modern Java articles and book updates.'
    : 'You have not been subscribed to marketing updates.';
  const sampleText = [
    'Thank you for your interest in Modern Java: The Mindset Shift.',
    '',
    'Download your sample chapter (button preferred in HTML email):',
    sampleChapterUrl,
    '',
    'This secure link remains valid for 2 days.',
    'The sample includes the preface and the first two chapters, with selected diagrams.',
    '',
    `Visit the book website: ${SITE_URL}`,
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

  return response(200, {
    message: 'Check your inbox—the sample chapter is on its way.',
  });
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
  if (!SAMPLE_REQUESTS_TABLE) {
    return response(503, {
      message: 'Email signup is not configured yet. Please try again later.',
    });
  }

  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: SAMPLE_REQUESTS_TABLE,
      Key: { email },
      UpdateExpression:
        'SET marketingConsent = :consented, ' +
        'marketingConsentAt = if_not_exists(marketingConsentAt, :now), ' +
        'marketingConsentUpdatedAt = :now, consentVersion = :version, ' +
        'marketingConsentSource = :source',
      ExpressionAttributeValues: {
        ':consented': true,
        ':now': now,
        ':version': String(json.consentVersion || 'unknown'),
        ':source': 'amazon-pre-navigation',
      },
    }),
  );

  return response(200, { message: 'Your email preferences have been saved.' });
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

const createDigitalOrder = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }

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

  const appOrderId = `MJ-D-${randomUUID().slice(0, 8).toUpperCase()}`;
  const razorpayOrder = await createRazorpayOrder({
    amount: DIGITAL_BUNDLE_PRICE_PAISE,
    receipt: appOrderId,
    notes: { appOrderId, productType: 'digital_bundle' },
  });
  const now = new Date().toISOString();
  const marketingConsent = json.marketingConsent === true;

  await dynamo.send(
    new PutCommand({
      TableName: ORDERS_TABLE,
      Item: {
        appOrderId,
        razorpayOrderId: razorpayOrder.id,
        productType: 'digital_bundle',
        email,
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

const sendPaperbackConfirmationEmails = async (order) => {
  const text = formatOrderEmail(order);
  const subject = `Modern Java paperback order ${order.appOrderId}`;

  await Promise.all([
    sendEmail({ to: ADMIN_EMAIL, subject, text }),
    sendEmail({
      to: order.email,
      subject: 'Your Modern Java paperback order is confirmed',
      text: `Thank you for your order. Payment was successful.\n\n${text}`,
    }),
  ]);
};

const createDigitalDownloadLinks = async () => {
  const [pdfUrl, epubUrl] = await Promise.all([
    createSignedDownloadUrl(DIGITAL_PDF_KEY),
    createSignedDownloadUrl(DIGITAL_EPUB_KEY),
  ]);

  return { pdfUrl, epubUrl };
};

const sendDigitalConfirmationEmails = async (order) => {
  const { pdfUrl, epubUrl } = await createDigitalDownloadLinks();
  const adminText = [
    `Order ID: ${order.appOrderId}`,
    `Payment ID: ${order.paymentId}`,
    `Amount: ₹${order.amount / 100}`,
    'Product: PDF + ePub digital bundle',
    `Email: ${order.email}`,
    `Marketing consent: ${order.marketingConsent ? 'Yes' : 'No'}`,
  ].join('\n');
  const customerText = [
    'Thank you for purchasing Modern Java: The Mindset Shift.',
    '',
    'Your secure download links are below and remain valid for 7 days:',
    '',
    `PDF: ${pdfUrl}`,
    `ePub: ${epubUrl}`,
    '',
    'You will receive access to revised editions at this email address.',
    'If a link expires before you download the files, contact admin@classpath.in.',
    '',
    `Order ID: ${order.appOrderId}`,
  ].join('\n');

  await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Modern Java digital order ${order.appOrderId}`,
      text: adminText,
    }),
    sendEmail({
      to: order.email,
      subject: 'Your Modern Java PDF and ePub downloads',
      text: customerText,
    }),
  ]);
};

const sendConfirmationEmails = async (order) => {
  if (order.productType === 'digital_bundle') {
    return sendDigitalConfirmationEmails(order);
  }

  return sendPaperbackConfirmationEmails(order);
};

const createOrder = async (event) => {
  const { json } = parseBody(event);
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
    const method = event.requestContext?.http?.method;
    const path = event.rawPath;

    if (method === 'OPTIONS') return response(204, {});
    if (method === 'POST' && path === '/sample-requests') {
      return await requestSampleChapter(event);
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
      /required|invalid|quantity/i.test(error.message || '');
    return response(isValidationError ? 400 : 500, {
      message: isValidationError
        ? error.message
        : 'Unable to process the request right now',
    });
  }
};
