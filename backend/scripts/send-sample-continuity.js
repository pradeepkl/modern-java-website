#!/usr/bin/env node
/**
 * Send sample-chapter Email 1 (continuity) to an allowlisted set of leads.
 *
 * From: pradeep@classpath.in  ·  BCC: admin@classpath.in
 * Body + List-Unsubscribe use the existing SAMPLE_REQUESTS_TABLE preference
 * flow (one-click API + /unsubscribe page).
 *
 * Marks sampleContinuityEmailSentAt after each successful send.
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... UNSUBSCRIBE_TOKEN_SECRET=... PUBLIC_API_URL=... \
 *     node scripts/send-sample-continuity.js --dry-run
 *   SAMPLE_REQUESTS_TABLE=... UNSUBSCRIBE_TOKEN_SECRET=... PUBLIC_API_URL=... \
 *     node scripts/send-sample-continuity.js
 *   ... node scripts/send-sample-continuity.js --email reader@example.com --force
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { buildSampleContinuityEmail } = require('../src/sampleChapterFollowUp');
const { createEmailClickToken } = require('../src/emailClickToken');
const {
  createSesClient,
  buildListUnsubscribeUrl,
  sendMarketingEmail,
} = require('./nurtureSend');

const sampleTable =
  process.env.SAMPLE_REQUESTS_TABLE ||
  process.env.SAMPLE_REQUESTS_TABLE_NAME ||
  '';
const siteUrl = (
  process.env.WEBSITE_URL || 'https://modern-java.classpath.in'
).replace(/\/$/, '');
const mailFromEmail =
  process.env.MAIL_FROM_EMAIL || 'pradeep@classpath.in';
const replyToEmail = process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in';
const bccEmail = process.env.ADMIN_BCC_EMAIL || 'admin@classpath.in';

/** Final Email 1 allowlist (skips + domain fix applied). */
const ALLOWLIST = [
  'satyakiguha007@gmail.com',
  'kevin28.abraham@gmail.com',
  'raut.vinod.g@gmail.com',
  'jeyasurendar67@gmail.com',
  'm4muhassin@gmail.com',
  'er.sumitmalhotra@gmail.com',
  'chilaka429@gmail.com',
  'akaushik079@gmail.com',
  'subhashisrouth0@gmail.com',
  'sankarpdf@gmail.com',
  'kanneswara68@gmail.com',
  'spsenthilrm@gmail.com',
  'rrishu23102004@gmail.com',
  'billkart295@gmail.com',
  'sstika1920@gmail.com',
  'ping.shunmugaraj@gmail.com', // corrected from .con
  'atul.khot@gmail.com',
  'sharmamk1966@gmail.com',
  'fatirs0703@gmail.com',
  'abbyind.manu@gmail.com',
  'maltesh200119@gmail.com',
  'maltesh192001@gmail.com',
  'vinodbhai389175bhai@gmail.com',
  'danish037294@gmail.com',
  's.vishnuswaroop@gmail.com',
  'sreehar.ojili121@gmail.com',
  'sangeetashirodkar@gmail.com',
];

/** Legacy keys that should be migrated onto the allowlist address before send. */
const LEGACY_EMAIL_KEYS = {
  'ping.shunmugaraj@gmail.com': ['ping.shunmugaraj@gmail.con'],
};

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const emailFlag = argv.indexOf('--email');
const onlyEmail =
  emailFlag >= 0 ? String(argv[emailFlag + 1] || '').trim().toLowerCase() : '';

if (!sampleTable) {
  console.error(
    'Set SAMPLE_REQUESTS_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}

if (!process.env.UNSUBSCRIBE_TOKEN_SECRET || !process.env.PUBLIC_API_URL) {
  console.error(
    'Set UNSUBSCRIBE_TOKEN_SECRET and PUBLIC_API_URL so unsubscribe links update SAMPLE_REQUESTS_TABLE.',
  );
  process.exit(1);
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = createSesClient();

const normalize = (value) => String(value || '').trim().toLowerCase();

async function getLead(email) {
  const result = await dynamo.send(
    new GetCommand({
      TableName: sampleTable,
      Key: { email },
    }),
  );
  return result.Item || null;
}

/**
 * Ensure the lead row is keyed by the send address (fixes typo domains).
 * Returns the record that will be used for consent checks + markSent.
 */
async function resolveLeadForSend(sendEmail) {
  const primary = await getLead(sendEmail);
  if (primary) return { item: primary, emailKey: sendEmail, migrated: false };

  const legacyKeys = LEGACY_EMAIL_KEYS[sendEmail] || [];
  for (const legacy of legacyKeys) {
    const legacyItem = await getLead(legacy);
    if (!legacyItem) continue;
    if (dryRun) {
      return { item: { ...legacyItem, email: sendEmail }, emailKey: sendEmail, migrated: true, legacy };
    }
    const now = new Date().toISOString();
    const migrated = {
      ...legacyItem,
      email: sendEmail,
      updatedAt: now,
      emailCorrectedFrom: legacy,
      emailCorrectedAt: now,
    };
    await dynamo.send(
      new PutCommand({
        TableName: sampleTable,
        Item: migrated,
        ConditionExpression: 'attribute_not_exists(email)',
      }),
    );
    try {
      await dynamo.send(
        new DeleteCommand({
          TableName: sampleTable,
          Key: { email: legacy },
        }),
      );
    } catch (error) {
      console.warn(`Could not delete legacy key ${legacy}:`, error.message || error);
    }
    return { item: migrated, emailKey: sendEmail, migrated: true, legacy };
  }

  return { item: null, emailKey: sendEmail, migrated: false };
}

const deliver = async (item, toEmail) => {
  const listUnsubscribeUrl = buildListUnsubscribeUrl(toEmail);
  if (!listUnsubscribeUrl) {
    throw new Error('Failed to build List-Unsubscribe URL for ' + toEmail);
  }
  const clickToken = createEmailClickToken(toEmail, {
    secret: process.env.UNSUBSCRIBE_TOKEN_SECRET,
    sequence: 'sample-continuity',
  });
  // Body link: site unsubscribe page (updates SAMPLE_REQUESTS_TABLE on submit).
  // Header: RFC 8058 one-click URL (updates the same table on client Unsubscribe).
  // CTA: signed mj_click token attributes formats clicks to the lead row.
  const email = buildSampleContinuityEmail({
    siteUrl,
    unsubscribeUrl: `${siteUrl}/unsubscribe`,
    clickToken,
  });
  await sendMarketingEmail({
    ses,
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    recipientRecord: { ...item, email: toEmail },
    mailFromEmail,
    replyTo: replyToEmail,
    bcc: bccEmail,
    tags: { funnel: 'sample', sequenceDay: '1', emailName: 'continuity' },
  });
  return { listUnsubscribeUrl, formatsUrl: email.formatsUrl };
};

const markSent = async (email, { requireUnset = true } = {}) => {
  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: sampleTable,
      Key: { email },
      UpdateExpression: 'SET sampleContinuityEmailSentAt = :now, updatedAt = :now',
      ...(requireUnset
        ? {
            ConditionExpression:
              'attribute_not_exists(sampleContinuityEmailSentAt)',
            ExpressionAttributeValues: { ':now': now },
          }
        : {
            ExpressionAttributeValues: { ':now': now },
          }),
    }),
  );
};

const main = async () => {
  const targets = onlyEmail
    ? ALLOWLIST.includes(onlyEmail)
      ? [onlyEmail]
      : force
        ? [onlyEmail]
        : []
    : ALLOWLIST;

  if (onlyEmail && targets.length === 0) {
    console.error(
      `${onlyEmail} is not on the Email 1 allowlist. Use --force to override.`,
    );
    process.exit(1);
  }

  console.log('Sample chapter Email 1 (continuity)');
  console.log('==================================');
  console.log(`Sample table: ${sampleTable}`);
  console.log(`From: ${mailFromEmail}`);
  console.log(`Reply-To: ${replyToEmail}`);
  console.log(`BCC: ${bccEmail}`);
  console.log(`Recipients: ${targets.length}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const toEmail of targets) {
    try {
      const resolved = await resolveLeadForSend(toEmail);
      if (!resolved.item) {
        skipped += 1;
        console.log(`[skip] no sample-request row for ${toEmail}`);
        continue;
      }
      if (resolved.item.sampleContinuityEmailSentAt && !(force && onlyEmail === toEmail)) {
        skipped += 1;
        console.log(`[skip] already sent continuity to ${toEmail}`);
        continue;
      }
      if (resolved.migrated) {
        console.log(
          `[migrate] ${resolved.legacy || 'legacy'} → ${toEmail}`,
        );
      }

      if (dryRun) {
        const unsub = buildListUnsubscribeUrl(toEmail);
        const clickToken = createEmailClickToken(toEmail, {
          secret: process.env.UNSUBSCRIBE_TOKEN_SECRET,
          sequence: 'sample-continuity',
        });
        const preview = buildSampleContinuityEmail({
          siteUrl,
          clickToken,
        });
        console.log(
          `[dry-run] would send to ${toEmail} (unsubscribe + mj_click → SAMPLE_REQUESTS_TABLE)`,
        );
        console.log(`          list-unsubscribe: ${unsub}`);
        console.log(`          formats CTA: ${preview.formatsUrl}`);
        continue;
      }

      await deliver(resolved.item, toEmail);
      await markSent(toEmail, {
        requireUnset: !(force && onlyEmail === toEmail),
      });
      sent += 1;
      console.log(`Sent to ${toEmail}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed for ${toEmail}:`, error.message || error);
    }
  }

  if (!dryRun) {
    console.log('');
    console.log(`Sent: ${sent}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
