#!/usr/bin/env node
/**
 * One-off ₹2 live payment smoke test against modern-java-prod.
 * Does not change public product prices.
 *
 * Usage:
 *   node backend/scripts/test-live-rupee-payment.js
 */
const { createHmac, randomUUID } = require('node:crypto');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ROOT = resolve(__dirname, '../..');
const SECRETS = resolve(__dirname, '../sam-secrets.env.prod');
const OUT_DIR = resolve(ROOT, '.payment-test');
const AMOUNT_PAISE = 200; // ₹2
const TO_EMAIL = process.env.TEST_EMAIL || 'pradeep.kumar44@gmail.com';
const TO_NAME = process.env.TEST_NAME || 'Pradeep Kumar';
const ORDER_API =
  process.env.VITE_ORDER_API_URL ||
  'https://9f9sd2yf04.execute-api.ap-south-1.amazonaws.com';
const TABLE =
  process.env.ORDERS_TABLE || 'modern-java-prod-OrdersTable-10094NAFUW2S9';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const loadSecrets = () => {
  const vals = {};
  for (const line of readFileSync(SECRETS, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#') || !line.includes('=')) {
      continue;
    }
    const i = line.indexOf('=');
    vals[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return vals;
};

const mask = (keyId) =>
  keyId.length < 12 ? '****' : `${keyId.slice(0, 9)}****${keyId.slice(-4)}`;

(async () => {
  const secrets = loadSecrets();
  const keyId = secrets.RAZORPAY_KEY_ID;
  const keySecret = secrets.RAZORPAY_KEY_SECRET;
  if (!keyId?.startsWith('rzp_live_') || !keySecret) {
    throw new Error('Need live Razorpay credentials in sam-secrets.env.prod');
  }

  const appOrderId = `MJ-T-${randomUUID().slice(0, 8).toUpperCase()}`;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  console.log('Creating Razorpay live order for ₹2…');
  console.log('Key:', mask(keyId));
  console.log('App order:', appOrderId);

  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      amount: AMOUNT_PAISE,
      currency: 'INR',
      receipt: appOrderId,
      notes: {
        appOrderId,
        productType: 'digital_bundle',
        smokeTest: 'rupee2',
      },
    }),
  });
  const razorpayOrder = await rzpRes.json();
  if (!rzpRes.ok) {
    console.error(razorpayOrder);
    throw new Error('Razorpay order creation failed');
  }

  const now = new Date().toISOString();
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        appOrderId,
        razorpayOrderId: razorpayOrder.id,
        productType: 'digital_bundle',
        name: TO_NAME,
        email: TO_EMAIL,
        amount: AMOUNT_PAISE,
        currency: 'INR',
        status: 'payment_pending',
        paymentProvider: 'razorpay',
        paymentEnvironment: 'prod',
        revisionUpdates: true,
        marketingConsent: false,
        smokeTest: true,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(appOrderId)',
    }),
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const htmlPath = resolve(OUT_DIR, 'checkout.html');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>₹2 live payment test</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; }
    button { font-size: 1.1rem; padding: 0.75rem 1.25rem; cursor: pointer; }
    .ok { color: #0a7; } .err { color: #c00; } code { word-break: break-all; }
  </style>
</head>
<body>
  <h1>Modern Java — ₹2 live smoke test</h1>
  <p>Order <code>${appOrderId}</code></p>
  <p>Razorpay order <code>${razorpayOrder.id}</code></p>
  <p>Amount: <strong>₹2.00</strong> (live mode)</p>
  <button id="pay" type="button">Pay ₹2</button>
  <p id="status"></p>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    const ORDER_API = ${JSON.stringify(ORDER_API)};
    const statusEl = document.getElementById('status');
    document.getElementById('pay').onclick = () => {
      statusEl.textContent = 'Opening Razorpay Checkout…';
      const rzp = new Razorpay({
        key: ${JSON.stringify(keyId)},
        amount: ${AMOUNT_PAISE},
        currency: 'INR',
        name: 'Modern Java — smoke test',
        description: '₹2 live payment test',
        order_id: ${JSON.stringify(razorpayOrder.id)},
        prefill: { name: ${JSON.stringify(TO_NAME)}, email: ${JSON.stringify(TO_EMAIL)} },
        notes: { appOrderId: ${JSON.stringify(appOrderId)} },
        theme: { color: '#0b3f9f' },
        handler: async (payment) => {
          statusEl.textContent = 'Verifying payment…';
          try {
            const res = await fetch(ORDER_API + '/orders/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                appOrderId: ${JSON.stringify(appOrderId)},
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
              }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || 'Verify failed');
            statusEl.className = 'ok';
            statusEl.innerHTML = 'Paid and verified.<br>Payment: <code>' +
              payment.razorpay_payment_id + '</code><br>Check ' +
              ${JSON.stringify(TO_EMAIL)} + ' for confirmation / invoice.';
          } catch (err) {
            statusEl.className = 'err';
            statusEl.textContent = err.message || String(err);
          }
        },
        modal: { ondismiss: () => { statusEl.textContent = 'Checkout dismissed.'; } },
      });
      rzp.on('payment.failed', (resp) => {
        statusEl.className = 'err';
        statusEl.textContent = (resp.error && resp.error.description) || 'Payment failed';
      });
      rzp.open();
    };
  </script>
</body>
</html>
`;
  writeFileSync(htmlPath, html);

  const metaPath = resolve(OUT_DIR, 'last-test.json');
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        appOrderId,
        razorpayOrderId: razorpayOrder.id,
        amountPaise: AMOUNT_PAISE,
        email: TO_EMAIL,
        orderApi: ORDER_API,
        keyId: mask(keyId),
        checkoutHtml: htmlPath,
        createdAt: now,
      },
      null,
      2,
    ),
  );

  console.log('DynamoDB pending order written.');
  console.log('Checkout page:', htmlPath);
  console.log('Open that file in a browser and click Pay ₹2.');
  console.log('Confirmation email / invoice will go to:', TO_EMAIL);
})().catch((err) => {
  console.error('FAILED', err.message || err);
  process.exit(1);
});
