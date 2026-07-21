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

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({});

const {
  ORDERS_TABLE,
  SAMPLE_REQUESTS_TABLE,
  SAMPLE_CHAPTER_URL,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  ADMIN_EMAIL,
  ALLOWED_ORIGIN = '*',
} = process.env;

const PAPERBACK_PRICE_PAISE = 89900;
const MAX_QUANTITY = 20;
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

const requestSampleChapter = async (event) => {
  const { json } = parseBody(event);
  const email = String(json.email || '').trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Invalid email address');
  }

  if (!SAMPLE_REQUESTS_TABLE || !SAMPLE_CHAPTER_URL) {
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

  const marketingConsent = json.marketingConsent === true;
  const now = new Date().toISOString();

  await ses.send(
    new SendEmailCommand({
      Source: ADMIN_EMAIL,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Your free Modern Java sample chapter' },
        Body: {
          Text: {
            Data: [
              'Thank you for your interest in Modern Java: The Mindset Shift.',
              '',
              `Download your sample chapter: ${SAMPLE_CHAPTER_URL}`,
              '',
              'The sample includes the preface, complete table of contents, Chapter 1, and selected diagrams.',
              '',
              marketingConsent
                ? 'You also asked to receive occasional Modern Java articles and book updates.'
                : 'You have not been subscribed to marketing updates.',
            ].join('\n'),
          },
        },
      },
    }),
  );

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
        consentVersion: marketingConsent
          ? String(json.consentVersion || 'unknown')
          : existing.Item?.consentVersion || null,
        source: 'sample-chapter-form',
      },
    }),
  );

  return response(200, {
    message: 'Check your inbox—the sample chapter is on its way.',
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

const sendConfirmationEmails = async (order) => {
  const text = formatOrderEmail(order);
  const subject = `Modern Java paperback order ${order.appOrderId}`;

  await Promise.all([
    ses.send(
      new SendEmailCommand({
        Source: ADMIN_EMAIL,
        Destination: { ToAddresses: [ADMIN_EMAIL] },
        Message: {
          Subject: { Data: subject },
          Body: { Text: { Data: text } },
        },
      }),
    ),
    ses.send(
      new SendEmailCommand({
        Source: ADMIN_EMAIL,
        Destination: { ToAddresses: [order.email] },
        Message: {
          Subject: { Data: 'Your Modern Java paperback order is confirmed' },
          Body: {
            Text: {
              Data: `Thank you for your order. Payment was successful.\n\n${text}`,
            },
          },
        },
      }),
    ),
  ]);
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
      return requestSampleChapter(event);
    }
    if (method === 'POST' && path === '/orders') return createOrder(event);
    if (method === 'POST' && path === '/orders/verify') {
      return verifyOrder(event);
    }
    if (method === 'POST' && path === '/webhooks/razorpay') {
      return processWebhook(event);
    }
    return response(404, { message: 'Not found' });
  } catch (error) {
    console.error(error);
    const isValidationError =
      error instanceof SyntaxError ||
      /required|invalid|quantity/i.test(error.message);
    return response(isValidationError ? 400 : 500, {
      message: isValidationError
        ? error.message
        : 'Unable to process the order right now',
    });
  }
};
