#!/usr/bin/env node
/**
 * Send the Amazon Day 21 educational email (soft review ask, no separate review mail).
 *
 * Requires the Day 7 buying-intent follow-up (amazonReviewEmailSentAt).
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-education-followup.js --dry-run
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-education-followup.js
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-education-followup.js --days 21
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-education-followup.js --email reader@example.com --force
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
  AMAZON_EDUCATION_DAYS,
  buildAmazonEducationEmail,
  isEligibleForAmazonEducationEmail,
} = require('../src/marketingConsent');

const tableName =
  process.env.SAMPLE_REQUESTS_TABLE ||
  process.env.SAMPLE_REQUESTS_TABLE_NAME ||
  '';
const siteUrl = (
  process.env.WEBSITE_URL || 'https://modern-java.classpath.in'
).replace(/\/$/, '');
const amazonUrl =
  process.env.AMAZON_URL || 'https://www.amazon.in/dp/B0H6R4334W';
const mailFrom = process.env.MAIL_FROM_EMAIL || 'no-reply@classpath.in';
const replyTo = process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in';
const sesRegion = process.env.SES_REGION || 'us-east-1';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const daysFlag = argv.indexOf('--days');
const minAgeDays =
  daysFlag >= 0
    ? Number(argv[daysFlag + 1]) || AMAZON_EDUCATION_DAYS
    : Number(process.env.AMAZON_EDUCATION_DAYS || AMAZON_EDUCATION_DAYS);
const emailFlag = argv.indexOf('--email');
const onlyEmail =
  emailFlag >= 0 ? String(argv[emailFlag + 1] || '').trim().toLowerCase() : '';

if (!tableName) {
  console.error(
    'Set SAMPLE_REQUESTS_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({ region: sesRegion });

const scanAll = async () => {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await dynamo.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      }),
    );
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
};

const deliver = async (item) => {
  const email = buildAmazonEducationEmail({
    siteUrl,
    amazonUrl,
    name: item.name,
  });
  await ses.send(
    new SendEmailCommand({
      Source: mailFrom,
      ReplyToAddresses: [replyTo],
      Destination: { ToAddresses: [item.email] },
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
      TableName: tableName,
      Key: { email },
      UpdateExpression:
        'SET amazonEducationEmailSentAt = :now, updatedAt = :now',
      ...(requireUnset
        ? {
            ConditionExpression:
              'marketingConsent = :consented AND attribute_not_exists(amazonEducationEmailSentAt)',
            ExpressionAttributeValues: {
              ':now': now,
              ':consented': true,
            },
          }
        : {
            ExpressionAttributeValues: {
              ':now': now,
            },
          }),
    }),
  );
};

const main = async () => {
  console.log('Amazon Day 21 education follow-up');
  console.log('================================');
  console.log(`Table: ${tableName}`);
  console.log(`Min age days: ${minAgeDays} (default ${AMAZON_EDUCATION_DAYS})`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Force single: ${force && onlyEmail ? onlyEmail : 'no'}`);
  console.log('');

  let candidates = [];
  if (onlyEmail) {
    const result = await dynamo.send(
      new GetCommand({
        TableName: tableName,
        Key: { email: onlyEmail },
      }),
    );
    if (!result.Item) {
      console.error(`No record found for ${onlyEmail}`);
      process.exit(1);
    }
    candidates = [result.Item];
  } else {
    candidates = await scanAll();
  }

  const now = new Date();
  const eligible = candidates.filter((item) => {
    if (force && onlyEmail && item.email === onlyEmail) {
      return (
        item.marketingConsent === true && Boolean(item.amazonReviewEmailSentAt)
      );
    }
    return isEligibleForAmazonEducationEmail(item, { now, minAgeDays });
  });

  console.log(`Leads scanned: ${candidates.length}`);
  console.log(`Eligible: ${eligible.length}`);
  console.log('');

  if (eligible.length === 0) {
    console.log('Nothing to send.');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const item of eligible) {
    const ageDays = item.marketingConsentAt
      ? Math.floor(
          (now.getTime() - Date.parse(item.marketingConsentAt)) /
            (24 * 60 * 60 * 1000),
        )
      : '?';
    if (dryRun) {
      console.log(
        `[dry-run] would send to ${item.email} (opted in ${ageDays}d ago via ${item.marketingConsentSource || 'unknown'})`,
      );
      continue;
    }
    try {
      await deliver(item);
      await markSent(item.email, {
        requireUnset: !(force && onlyEmail === item.email),
      });
      sent += 1;
      console.log(`Sent to ${item.email}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed for ${item.email}:`, error.message || error);
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
