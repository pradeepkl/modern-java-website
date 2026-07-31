#!/usr/bin/env node
/**
 * Send the sample-chapter Day 4 exclusive reader voucher email.
 *
 * Default delay: 4 days after lastRequestedAt. Issues (or reuses) a unique
 * one-time voucher, then emails the code. Skips purchasers, prior sends,
 * marketing-suppressed leads, and leads whose voucher window has expired
 * (sample request timestamp + 7 days UTC).
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... VOUCHERS_TABLE=... \
 *     node scripts/send-sample-followup.js --dry-run
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... VOUCHERS_TABLE=... \
 *     node scripts/send-sample-followup.js
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... VOUCHERS_TABLE=... \
 *     node scripts/send-sample-followup.js --email reader@example.com --force
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  SAMPLE_FOLLOWUP_DAYS,
  buildSampleChapterFollowUpEmail,
  isEligibleForSampleChapterFollowUp,
} = require('../src/sampleChapterFollowUp');
const { issueVoucherForSampleLead } = require('../src/readerVoucher');
const { createSesClient, sendMarketingEmail } = require('./nurtureSend');

const sampleTable =
  process.env.SAMPLE_REQUESTS_TABLE ||
  process.env.SAMPLE_REQUESTS_TABLE_NAME ||
  '';
const ordersTable =
  process.env.ORDERS_TABLE || process.env.ORDERS_TABLE_NAME || '';
const vouchersTable =
  process.env.VOUCHERS_TABLE || process.env.VOUCHERS_TABLE_NAME || '';
const siteUrl = (
  process.env.WEBSITE_URL || 'https://modern-java.classpath.in'
).replace(/\/$/, '');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const daysFlag = argv.indexOf('--days');
const minAgeDays =
  daysFlag >= 0
    ? Number(argv[daysFlag + 1]) || SAMPLE_FOLLOWUP_DAYS
    : Number(process.env.SAMPLE_FOLLOWUP_DAYS || SAMPLE_FOLLOWUP_DAYS);
const emailFlag = argv.indexOf('--email');
const onlyEmail =
  emailFlag >= 0 ? String(argv[emailFlag + 1] || '').trim().toLowerCase() : '';

if (!sampleTable) {
  console.error(
    'Set SAMPLE_REQUESTS_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}
if (!vouchersTable) {
  console.error('Set VOUCHERS_TABLE to the deployed DynamoDB table name.');
  process.exit(1);
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = createSesClient();

const scanAll = async (tableName, params = {}) => {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await dynamo.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
        ...params,
      }),
    );
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
};

const loadPurchaserEmails = async () => {
  const purchased = new Set();
  if (!ordersTable) {
    console.warn(
      'ORDERS_TABLE not set — cannot exclude existing purchasers from sample follow-up.',
    );
    return purchased;
  }
  const paidOrders = await scanAll(ordersTable, {
    FilterExpression: '#status = :paid',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':paid': 'paid' },
  });
  for (const order of paidOrders) {
    if (order.checkoutBypass === true) continue;
    if (String(order.appOrderId || '').startsWith('MJ-T-')) continue;
    const email = String(order.email || '')
      .trim()
      .toLowerCase();
    if (email) purchased.add(email);
  }
  return purchased;
};

const deliver = async (item, voucher) => {
  const toEmail = String(item.email).trim().toLowerCase();
  const email = buildSampleChapterFollowUpEmail({
    siteUrl,
    voucherCode: voucher.code,
    basisAmountInr: voucher.basisAmountInr,
    discountAmountInr: voucher.discountAmountInr,
    payableAmountInr: voucher.payableAmountInr,
    expiresAt: voucher.expiresAt,
  });
  await sendMarketingEmail({
    ses,
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    recipientRecord: item,
    tags: {
      funnel: 'sample',
      sequenceDay: '4',
      voucherCode: voucher.code,
    },
  });
};

const markSent = async (email, voucherCode, { requireUnset = true } = {}) => {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: sampleTable,
      Key: { email },
      UpdateExpression:
        'SET sampleFollowUpEmailSentAt = :now, readerVoucherCode = :code',
      ...(requireUnset
        ? {
            ConditionExpression:
              'attribute_not_exists(sampleFollowUpEmailSentAt)',
            ExpressionAttributeValues: {
              ':now': now,
              ':code': voucherCode,
            },
          }
        : {
            ExpressionAttributeValues: {
              ':now': now,
              ':code': voucherCode,
            },
          }),
    }),
  );
};

const main = async () => {
  console.log('Sample chapter Day 4 reader voucher');
  console.log('===================================');
  console.log(`Sample table: ${sampleTable}`);
  console.log(`Orders table: ${ordersTable || '(not set)'}`);
  console.log(`Vouchers table: ${vouchersTable}`);
  console.log(`Min age days: ${minAgeDays} (default ${SAMPLE_FOLLOWUP_DAYS})`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Force single: ${force && onlyEmail ? onlyEmail : 'no'}`);
  console.log('');

  let candidates = [];
  if (onlyEmail) {
    const result = await dynamo.send(
      new GetCommand({
        TableName: sampleTable,
        Key: { email: onlyEmail },
      }),
    );
    if (!result.Item) {
      console.error(`No sample-request record found for ${onlyEmail}`);
      process.exit(1);
    }
    candidates = [result.Item];
  } else {
    candidates = await scanAll(sampleTable);
  }

  const purchasers = await loadPurchaserEmails();
  const now = new Date();
  const eligible = candidates.filter((item) => {
    const email = String(item.email || '')
      .trim()
      .toLowerCase();
    const hasPurchased =
      purchasers.has(email) ||
      String(item.leadStatus || '').toUpperCase() === 'CUSTOMER';
    if (force && onlyEmail && email === onlyEmail) {
      return Boolean(item.lastRequestedAt || item.firstRequestedAt);
    }
    return isEligibleForSampleChapterFollowUp(item, {
      now,
      minAgeDays,
      hasPurchased,
    });
  });

  console.log(`Sample leads scanned: ${candidates.length}`);
  console.log(`Known purchasers excluded via orders: ${purchasers.size}`);
  console.log(`Eligible: ${eligible.length}`);
  console.log('');

  if (eligible.length === 0) {
    console.log('Nothing to send.');
    return;
  }

  let sent = 0;
  let failed = 0;
  let reused = 0;
  let created = 0;

  for (const item of eligible) {
    const email = String(item.email).trim().toLowerCase();
    const requestedAt = item.lastRequestedAt || item.firstRequestedAt;
    const ageDays = requestedAt
      ? Math.floor(
          (now.getTime() - Date.parse(requestedAt)) / (24 * 60 * 60 * 1000),
        )
      : '?';
    if (dryRun) {
      console.log(
        `[dry-run] would issue voucher + send to ${email} (last preview ${ageDays}d ago)`,
      );
      continue;
    }
    try {
      const issued = await issueVoucherForSampleLead({
        dynamo,
        tableName: vouchersTable,
        sampleItem: item,
        now,
      });
      if (issued.created) created += 1;
      else reused += 1;

      await deliver(item, issued.voucher);
      await markSent(email, issued.voucher.code, {
        requireUnset: !(force && onlyEmail === email),
      });
      sent += 1;
      console.log(
        `Sent to ${email} (${issued.created ? 'new' : 'reused'} ${issued.voucher.code})`,
      );
    } catch (error) {
      failed += 1;
      console.error(`Failed for ${email}:`, error.message || error);
    }
  }

  if (!dryRun) {
    console.log('');
    console.log(`Sent: ${sent}`);
    console.log(`Vouchers created: ${created}`);
    console.log(`Vouchers reused: ${reused}`);
    console.log(`Failed: ${failed}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
