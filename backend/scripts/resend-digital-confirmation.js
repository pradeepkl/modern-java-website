#!/usr/bin/env node
/**
 * One-off: recreate Zoho invoice + resend digital confirmation for an order.
 *
 * Usage:
 *   node scripts/resend-digital-confirmation.js MJ-D-3187A267
 *   node scripts/resend-digital-confirmation.js MJ-D-3187A267 --dry-run
 *
 * Loads env from the production Order Lambda, then uses local zohoInvoice.js.
 */
const { execFileSync } = require('node:child_process');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SESClient } = require('@aws-sdk/client-ses');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getSignedUrl: getCloudFrontSignedUrl } = require('@aws-sdk/cloudfront-signer');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const STACK_NAME = process.env.STACK_NAME || 'modern-java-prod';
const DOWNLOAD_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const INSTAGRAM_URL = 'https://www.instagram.com/classpath_publications/';

const orderId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!orderId || orderId.startsWith('-')) {
  console.error(
    'Usage: node scripts/resend-digital-confirmation.js <appOrderId> [--dry-run]',
  );
  process.exit(1);
}

const normalizePem = (value) =>
  String(value || '')
    .replace(/\\n/g, '\n')
    .trim();

function awsJson(args) {
  const raw = execFileSync('aws', [...args, '--region', REGION, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function resolveOrderFunctionName() {
  try {
    const stacks = awsJson([
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      STACK_NAME,
    ]);
    const outputs = stacks.Stacks?.[0]?.Outputs || [];
    const fromOutput = outputs.find(
      (item) => item.OutputKey === 'OrderFunctionName',
    )?.OutputValue;
    if (fromOutput) return fromOutput;
  } catch {
    // fall through
  }
  return 'modern-java-prod-OrderFunction-STp1sSJQSniF';
}

function loadLambdaEnv(functionName) {
  const config = awsJson([
    'lambda',
    'get-function-configuration',
    '--function-name',
    functionName,
  ]);
  return config.Environment?.Variables || {};
}

async function main() {
  const functionName = resolveOrderFunctionName();
  console.log(`Loading env from ${functionName}`);
  const env = loadLambdaEnv(functionName);
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  // Ensure Zoho runs (dev skips invoice creation).
  process.env.APP_ENV = 'prod';

  // Require after env is set — zohoInvoice reads ZOHO_* at module load.
  const { createAndSendInvoice } = require('../src/zohoInvoice');
  const {
    BOOK_FULL_TITLE,
    wrapTransactionalEmail,
    emailHeadline,
    emailParagraph,
    emailSmallParagraph,
    emailButton,
    emailButtonRow,
    emailCallout,
    emailSiteLink,
    emailClosing,
    escapeHtml,
  } = require('../src/emailLayout');
  const { sendEmail, EMAIL_CATEGORY } = require('../src/sesMail');

  const ordersTable = process.env.ORDERS_TABLE;
  const bucket = process.env.DIGITAL_ASSETS_BUCKET;
  const pdfKey =
    process.env.DIGITAL_PDF_KEY || 'digital/modern-java-drm-free_v1.0.pdf';
  const epubKey =
    process.env.DIGITAL_EPUB_KEY || 'digital/modern-java-drm-free_v1.0.epub';
  const siteUrl = String(
    process.env.WEBSITE_URL || 'https://modern-java.classpath.in',
  ).replace(/\/$/, '');
  const adminEmail = process.env.ADMIN_EMAIL || 'pradeep@classpath.in';
  const sesRegion = process.env.SES_REGION || 'us-east-1';

  if (!ordersTable || !bucket) {
    throw new Error('ORDERS_TABLE / DIGITAL_ASSETS_BUCKET missing from Lambda env');
  }

  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const s3 = new S3Client({ region: REGION });
  const ssm = new SSMClient({ region: REGION });
  const ses = new SESClient({ region: sesRegion });

  const orderResult = await dynamo.send(
    new GetCommand({ TableName: ordersTable, Key: { appOrderId: orderId } }),
  );
  const order = orderResult.Item;
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }
  if (order.productType !== 'digital_bundle') {
    throw new Error(`Expected digital_bundle, got ${order.productType}`);
  }
  if (order.status !== 'paid') {
    throw new Error(`Expected paid order, got status=${order.status}`);
  }

  console.log('Order loaded', {
    appOrderId: order.appOrderId,
    email: order.email,
    name: order.name,
    amount: order.amount,
    existingInvoice: order.zohoInvoiceNumber || null,
  });

  const name =
    String(order.name || '').trim() ||
    String(order.email || '')
      .split('@')[0]
      .replace(/[._+-]+/g, ' ')
      .trim() ||
    'Modern Java customer';

  const lineItems = [
    {
      productCode: 'MJ-DIGITAL',
      name: 'Modern Java — DRM-free PDF + ePub',
      description:
        'Product code: MJ-DIGITAL. Direct digital edition (PDF + ePub).',
      quantity: 1,
      rate: Number(order.amount || 0) / 100,
      unit: 'nos',
    },
  ];

  if (dryRun) {
    const { buildInvoiceBuyerBillingAddress } = require('../src/zohoInvoice');
    const billing = buildInvoiceBuyerBillingAddress({
      email: order.email,
      name,
    });
    console.log('Dry run — billing_address payload:', billing);
    console.log(
      'Serialized length:',
      JSON.stringify(billing).length,
      '(must be <= 100)',
    );
    return;
  }

  console.log('Creating Zoho invoice…');
  const invoice = await createAndSendInvoice({
    email: order.email,
    name,
    lineItems,
    referenceNumber: order.appOrderId,
    paymentId: order.paymentId,
    paymentMode: order.checkoutBypass ? 'Other' : 'Razorpay',
  });

  if (!invoice) {
    throw new Error('createAndSendInvoice returned null (Zoho not configured?)');
  }

  console.log('Zoho invoice created', {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    pdfBytes: invoice.pdfBuffer?.length || 0,
    warning: invoice.warning || null,
  });

  await dynamo.send(
    new UpdateCommand({
      TableName: ordersTable,
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
  console.log('Order updated with Zoho invoice fields');

  const objectExists = async (key) => {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error) {
      if (
        error?.name === 'NotFound' ||
        error?.name === 'NoSuchKey' ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw error;
    }
  };

  const createSignedDownloadUrl = async (key) => {
    const domain = process.env.CLOUDFRONT_DOMAIN || '';
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID || '';
    const ssmParam = process.env.CLOUDFRONT_PRIVATE_KEY_SSM_PARAM || '';
    let privateKey = '';
    if (domain && keyPairId && ssmParam) {
      const param = await ssm.send(
        new GetParameterCommand({ Name: ssmParam, WithDecryption: true }),
      );
      privateKey = normalizePem(param.Parameter?.Value);
    }
    if (domain && keyPairId && privateKey) {
      const path = String(key)
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const url = `https://${domain}/${path}`;
      const dateLessThan = new Date(
        Date.now() + DOWNLOAD_LINK_TTL_SECONDS * 1000,
      ).toISOString();
      return getCloudFrontSignedUrl({
        url,
        keyPairId,
        privateKey,
        dateLessThan,
      });
    }
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: DOWNLOAD_LINK_TTL_SECONDS },
    );
  };

  const pdfUrl = await createSignedDownloadUrl(pdfKey);
  const hasEpub = await objectExists(epubKey);
  const epubUrl = hasEpub ? await createSignedDownloadUrl(epubKey) : null;

  const invoiceAttached = Boolean(invoice.pdfBuffer?.length);
  const invoiceText = invoiceAttached
    ? `Your invoice ${invoice.invoiceNumber} is attached to this email.`
    : `Your invoice number is ${invoice.invoiceNumber}.`;
  const invoiceHtml = invoiceAttached
    ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">Your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is attached to this email.</p>`
    : `<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">Your invoice number is <strong>${escapeHtml(invoice.invoiceNumber)}</strong>.</p>`;

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
  customerLines.push(
    '',
    invoiceText,
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
    `Visit the Modern Java website: ${siteUrl}`,
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
                ${invoiceHtml}
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
                ${emailSiteLink(siteUrl)}
                ${emailClosing()}
  `);

  const attachments = invoice.pdfBuffer?.length
    ? [
        {
          filename: `Modern-Java-Invoice-${String(invoice.invoiceNumber).replace(/[^\w.-]+/g, '-')}.pdf`,
          contentType: 'application/pdf',
          content: invoice.pdfBuffer,
        },
      ]
    : [];

  await sendEmail({
    ses,
    to: order.email,
    subject: epubUrl
      ? 'Your Modern Java digital edition is ready'
      : 'Your Modern Java PDF download is ready',
    text: customerLines.join('\n'),
    html: customerHtml,
    attachments,
    replyTo: process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in',
    mailFromEmail: process.env.MAIL_FROM_EMAIL || 'no-reply@classpath.in',
    configurationSetName:
      process.env.SES_CONFIGURATION_SET || 'classpath-email-prod',
    category: EMAIL_CATEGORY.TRANSACTIONAL,
    tags: {
      environment: 'prod',
      funnel: 'digital-checkout-resend',
      orderId: order.appOrderId,
    },
  });

  await sendEmail({
    ses,
    to: adminEmail,
    subject: `Modern Java digital order ${order.appOrderId} (invoice resent)`,
    text: [
      `Order ID: ${order.appOrderId}`,
      `Payment ID: ${order.paymentId}`,
      `Amount: ₹${Number(order.amount || 0) / 100}`,
      `Email: ${order.email}`,
      `Invoice: ${invoice.invoiceNumber}`,
      'Resent after Zoho billing_address fix.',
    ].join('\n'),
    category: EMAIL_CATEGORY.TRANSACTIONAL,
    replyTo: process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in',
    mailFromEmail: process.env.MAIL_FROM_EMAIL || 'no-reply@classpath.in',
    configurationSetName:
      process.env.SES_CONFIGURATION_SET || 'classpath-email-prod',
    tags: { environment: 'prod', funnel: 'digital-checkout-resend-admin' },
  });

  console.log(`Confirmation email sent to ${order.email}`);
  console.log(`Admin copy sent to ${adminEmail}`);
  if (invoice.warning) {
    console.warn('Invoice warning:', invoice.warning);
  }
}

main().catch((error) => {
  console.error('Resend failed:', error.message || error);
  if (error.zoho) {
    console.error('Zoho detail:', JSON.stringify(error.zoho));
  }
  process.exit(1);
});
