#!/usr/bin/env node
/**
 * Send the Amazon buying-intent Day 7 follow-up to Classpath Reader List members who:
 * - opted in via amazon_exit_modal / amazon-pre-navigation
 * - still have marketingConsent === true
 * - opted in at least --days ago (default 7 — covers Amazon India + international delivery)
 * - have not already received amazonReviewEmailSentAt
 *
 * Purchase completion is unknown; the email offers both buy paths and a soft review ask.
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-review-followup.js --dry-run
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-review-followup.js
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-review-followup.js --days 7
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-review-followup.js --email reader@example.com
 *   SAMPLE_REQUESTS_TABLE=... node scripts/send-amazon-review-followup.js --email reader@example.com --force
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  AMAZON_FOLLOWUP_DAYS,
  buildAmazonReviewFollowUpEmail,
  isEligibleForAmazonReviewFollowUp,
} = require('../src/marketingConsent');
const { createSesClient, sendMarketingEmail } = require('./nurtureSend');

const tableName =
  process.env.SAMPLE_REQUESTS_TABLE ||
  process.env.SAMPLE_REQUESTS_TABLE_NAME ||
  '';
const siteUrl = (
  process.env.WEBSITE_URL || 'https://modern-java.classpath.in'
).replace(/\/$/, '');
const amazonUrl =
  process.env.AMAZON_URL || 'https://www.amazon.in/dp/B0H6R4334W';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const daysFlag = argv.indexOf('--days');
const minAgeDays =
  daysFlag >= 0
    ? Number(argv[daysFlag + 1]) || AMAZON_FOLLOWUP_DAYS
    : Number(process.env.REVIEW_FOLLOWUP_DAYS || AMAZON_FOLLOWUP_DAYS);
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
const ses = createSesClient();

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
  const email = buildAmazonReviewFollowUpEmail({
    siteUrl,
    amazonUrl,
    name: item.name,
  });
  await sendMarketingEmail({
    ses,
    to: item.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    recipientRecord: item,
    tags: { funnel: 'amazon', sequenceDay: '7' },
  });
};



const markSent = async (email, { requireUnset = true } = {}) => {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { email },
      UpdateExpression: 'SET amazonReviewEmailSentAt = :now, updatedAt = :now',
      ...(requireUnset
        ? {
            ConditionExpression:
              'marketingConsent = :consented AND attribute_not_exists(amazonReviewEmailSentAt)',
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
  console.log('Amazon buying-intent follow-up');
  console.log('==============================');
  console.log(`Table: ${tableName}`);
  console.log(`Min age days: ${minAgeDays} (default ${AMAZON_FOLLOWUP_DAYS})`);
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
      return item.marketingConsent === true;
    }
    return isEligibleForAmazonReviewFollowUp(item, { now, minAgeDays });
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
