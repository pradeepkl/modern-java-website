#!/usr/bin/env node
/**
 * Resend digital confirmation with fresh 7-day CloudFront download links.
 *
 * Usage:
 *   node scripts/resend-digital-confirmation.js MJ-D-3187A267
 *   node scripts/resend-digital-confirmation.js MJ-D-3187A267 --dry-run
 *   node scripts/resend-digital-confirmation.js MJ-D-3187A267 --skip-invoice
 *
 * Verifies PDF/ePub signed URLs (HTTP 200) before sending.
 * BCCs ADMIN_EMAIL on the customer message.
 * Loads env from the production Order Lambda.
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
const SUPPORT_NOTE =
  'If you run into any download issues now or in the future, just reply to this email — we will help right away and resend fresh links whenever you need them.';

const orderId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const skipInvoice = process.argv.includes('--skip-invoice');

if (!orderId || orderId.startsWith('-')) {
  console.error(
    'Usage: node scripts/resend-digital-confirmation.js <appOrderId> [--dry-run] [--skip-invoice]',
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

  let invoice = null;
  const shouldCreateInvoice = !skipInvoice && !order.zohoInvoiceId;
  if (skipInvoice) {
    console.log('Skipping Zoho invoice recreate (--skip-invoice)');
    if (order.zohoInvoiceNumber) {
      invoice = {
        invoiceId: order.zohoInvoiceId || null,
        invoiceNumber: order.zohoInvoiceNumber,
        invoiceUrl: order.zohoInvoiceUrl || null,
        pdfBuffer: null,
      };
    }
  } else if (shouldCreateInvoice) {
    console.log('Creating Zoho invoice…');
    invoice = await createAndSendInvoice({
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
  } else {
    console.log('Reusing existing Zoho invoice', {
      invoiceNumber: order.zohoInvoiceNumber,
      invoiceId: order.zohoInvoiceId,
    });
    invoice = {
      invoiceId: order.zohoInvoiceId || null,
      invoiceNumber: order.zohoInvoiceNumber,
      invoiceUrl: order.zohoInvoiceUrl || null,
      pdfBuffer: null,
    };
  }

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
      return {
        url: getCloudFrontSignedUrl({
          url,
          keyPairId,
          privateKey,
          dateLessThan,
        }),
        expiresAt: dateLessThan,
      };
    }
    const expiresAt = new Date(
      Date.now() + DOWNLOAD_LINK_TTL_SECONDS * 1000,
    ).toISOString();
    return {
      url: await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: DOWNLOAD_LINK_TTL_SECONDS },
      ),
      expiresAt,
    };
  };

  const verifyDownloadUrl = async (label, url, expectedMinBytes = 1) => {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const length = Number(head.headers.get('content-length') || 0);
    console.log('Verified download link', {
      label,
      status: head.status,
      contentLength: length || null,
      contentType: head.headers.get('content-type') || null,
    });
    if (!head.ok) {
      throw new Error(
        `${label} download link verification failed: HTTP ${head.status}`,
      );
    }
    if (length > 0 && length < expectedMinBytes) {
      throw new Error(
        `${label} download link content-length too small: ${length}`,
      );
    }
    // Confirm a few bytes can be read (HEAD alone can lie on some CDNs).
    const partial = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      redirect: 'follow',
    });
    if (!(partial.status === 206 || partial.status === 200)) {
      throw new Error(
        `${label} ranged GET failed: HTTP ${partial.status}`,
      );
    }
    const buf = Buffer.from(await partial.arrayBuffer());
    if (buf.length < 1) {
      throw new Error(`${label} ranged GET returned empty body`);
    }
  };

  if (!(await objectExists(pdfKey))) {
    throw new Error(`PDF missing in S3: ${pdfKey}`);
  }
  const hasEpub = await objectExists(epubKey);
  if (!hasEpub) {
    throw new Error(`ePub missing in S3: ${epubKey}`);
  }

  const pdfSigned = await createSignedDownloadUrl(pdfKey);
  const epubSigned = await createSignedDownloadUrl(epubKey);
  const pdfUrl = pdfSigned.url;
  const epubUrl = epubSigned.url;
  const linksExpireAt = pdfSigned.expiresAt;

  console.log('Minted 7-day download links', { expiresAt: linksExpireAt });
  await verifyDownloadUrl('PDF', pdfUrl, 1_000_000);
  await verifyDownloadUrl('ePub', epubUrl, 1_000_000);
  console.log('Download links verified OK — sending email');

  const invoiceNumber = invoice?.invoiceNumber || order.zohoInvoiceNumber || null;
  const invoiceAttached = Boolean(invoice?.pdfBuffer?.length);
  const invoiceText = invoiceNumber
    ? invoiceAttached
      ? `Your invoice ${invoiceNumber} is attached to this email.`
      : `Your invoice number is ${invoiceNumber}.`
    : null;
  const invoiceHtml = invoiceNumber
    ? invoiceAttached
      ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">Your invoice <strong>${escapeHtml(invoiceNumber)}</strong> is attached to this email.</p>`
      : `<p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">Your invoice number is <strong>${escapeHtml(invoiceNumber)}</strong>.</p>`
    : '';

  const customerLines = [
    `Thank you for purchasing ${BOOK_FULL_TITLE}.`,
    '',
    'Here are fresh secure download links for your DRM-free digital edition. Please download and save your files soon — these links remain valid for 7 days.',
    '',
    `Download PDF: ${pdfUrl}`,
    `Download ePub: ${epubUrl}`,
    '',
  ];
  if (invoiceText) {
    customerLines.push(invoiceText, '');
  }
  customerLines.push(
    `Order ID: ${order.appOrderId}`,
    'Please quote this Order ID in any communication about your purchase.',
    '',
    'Need help or the files again later?',
    SUPPORT_NOTE,
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

  const downloadButtons = emailButtonRow([
    { href: pdfUrl, label: 'Download PDF', bgcolor: '#1a56db' },
    { href: epubUrl, label: 'Download ePub', bgcolor: '#0f6b5c' },
  ]);

  const customerHtml = wrapTransactionalEmail(`
                ${emailHeadline('Your downloads are ready')}
                ${emailParagraph(
                  `Here are <strong>fresh secure links</strong> for your DRM-free copy of <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong>. Download and save your files soon — these links remain valid for <strong>7 days</strong>.`,
                )}
                ${downloadButtons}
                ${invoiceHtml}
                ${emailCallout({
                  label: 'Order ID',
                  value: order.appOrderId,
                  note: 'Please quote this Order ID in any communication about your purchase.',
                })}
                ${emailSmallParagraph(
                  `<strong style="color:#1a2332;">Need help or the files again later?</strong><br/>${escapeHtml(SUPPORT_NOTE)}`,
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

  const attachments = invoice?.pdfBuffer?.length
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
    subject: 'Your Modern Java digital downloads (fresh 7-day links)',
    text: customerLines.join('\n'),
    html: customerHtml,
    attachments,
    replyTo: process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in',
    mailFromEmail: process.env.MAIL_FROM_EMAIL || 'no-reply@classpath.in',
    configurationSetName:
      process.env.SES_CONFIGURATION_SET || 'classpath-email-prod',
    category: EMAIL_CATEGORY.TRANSACTIONAL,
    bcc: adminEmail,
    tags: {
      environment: 'prod',
      funnel: 'digital-checkout-resend',
      orderId: order.appOrderId,
    },
  });

  console.log(`Confirmation email sent to ${order.email} (bcc: ${adminEmail})`);
  console.log(`Links expire at ${linksExpireAt}`);
  if (invoice?.warning) {
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
