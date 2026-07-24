#!/usr/bin/env node
/**
 * Send the sample-chapter Day 10 educational nurture email.
 *
 * Requires the Day 4 follow-up to have been sent. Skips purchasers and anyone
 * who already received sampleEducationEmailSentAt.
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... node scripts/send-sample-education.js --dry-run
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... node scripts/send-sample-education.js
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... node scripts/send-sample-education.js --days 10
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... node scripts/send-sample-education.js --email reader@example.com --force
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const {
  SAMPLE_EDUCATION_DAYS,
  buildSampleEducationEmail,
  isEligibleForSampleEducationEmail,
} = require('../src/sampleChapterFollowUp');

const sampleTable =
  process.env.SAMPLE_REQUESTS_TABLE ||
  process.env.SAMPLE_REQUESTS_TABLE_NAME ||
  '';
const ordersTable =
  process.env.ORDERS_TABLE || process.env.ORDERS_TABLE_NAME || '';
const siteUrl = (
  process.env.WEBSITE_URL || 'https://modern-java.classpath.in'
).replace(/\/$/, '');
const mailFrom = process.env.MAIL_FROM_EMAIL || 'no-reply@classpath.in';
const replyTo = process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in';
const sesRegion = process.env.SES_REGION || 'us-east-1';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const daysFlag = argv.indexOf('--days');
const minAgeDays =
  daysFlag >= 0
    ? Number(argv[daysFlag + 1]) || SAMPLE_EDUCATION_DAYS
    : Number(process.env.SAMPLE_EDUCATION_DAYS || SAMPLE_EDUCATION_DAYS);
const emailFlag = argv.indexOf('--email');
const onlyEmail =
  emailFlag >= 0 ? String(argv[emailFlag + 1] || '').trim().toLowerCase() : '';

if (!sampleTable) {
  console.error(
    'Set SAMPLE_REQUESTS_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({ region: sesRegion });

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
      'ORDERS_TABLE not set — cannot exclude existing purchasers from sample education email.',
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

const deliver = async (toEmail) => {
  const email = buildSampleEducationEmail({ siteUrl });
  await ses.send(
    new SendEmailCommand({
      Source: mailFrom,
      ReplyToAddresses: [replyTo],
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: email.subject },
        Body: {
          Text: { Data: email.text },
          Html: { Data: email.html },
        },
      },
    }),
  );
};

const markSent = async (email, { requireUnset = true } = {}) => {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: sampleTable,
      Key: { email },
      UpdateExpression: 'SET sampleEducationEmailSentAt = :now',
      ...(requireUnset
        ? {
            ConditionExpression:
              'attribute_not_exists(sampleEducationEmailSentAt)',
            ExpressionAttributeValues: { ':now': now },
          }
        : {
            ExpressionAttributeValues: { ':now': now },
          }),
    }),
  );
};

const main = async () => {
  console.log('Sample chapter Day 10 education email');
  console.log('====================================');
  console.log(`Sample table: ${sampleTable}`);
  console.log(`Orders table: ${ordersTable || '(not set)'}`);
  console.log(`Min age days: ${minAgeDays} (default ${SAMPLE_EDUCATION_DAYS})`);
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
    const hasPurchased = purchasers.has(email);
    if (force && onlyEmail && email === onlyEmail) {
      return Boolean(item.sampleFollowUpEmailSentAt);
    }
    return isEligibleForSampleEducationEmail(item, {
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
        `[dry-run] would send to ${email} (last preview ${ageDays}d ago)`,
      );
      continue;
    }
    try {
      await deliver(email);
      await markSent(email, {
        requireUnset: !(force && onlyEmail === email),
      });
      sent += 1;
      console.log(`Sent to ${email}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed for ${email}:`, error.message || error);
    }
  }

  if (!dryRun) {
    console.log('');
    console.log(`Sent: ${sent}`);
    console.log(`Failed: ${failed}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
