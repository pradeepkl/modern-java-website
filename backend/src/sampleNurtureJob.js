/**
 * Automated sample-chapter nurture job (Day 4 / 10 / 18).
 *
 * Scans SAMPLE_REQUESTS_TABLE and sends at most one due step per lead per run,
 * timed from that lead's sample download timestamp.
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  SAMPLE_CONTINUITY_DAYS,
  SAMPLE_EDUCATION_DAYS,
  SAMPLE_REMINDER_DAYS,
  buildSampleContinuityEmail,
  buildSampleEducationEmail,
  buildSampleReminderEmail,
  isEligibleForSampleContinuityEmail,
  isEligibleForSampleEducationEmail,
  isEligibleForSampleReminderEmail,
} = require('./sampleChapterFollowUp');
const { createEmailClickToken } = require('./emailClickToken');
const {
  createSesClient,
  buildListUnsubscribeUrl,
  sendMarketingEmail,
  resolveAdminBcc,
} = require('./nurtureMail');

const STEPS = {
  continuity: 'continuity',
  education: 'education',
  reminder: 'reminder',
};

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function resolveSiteUrl() {
  return String(
    process.env.WEBSITE_URL || 'https://modern-java.classpath.in',
  ).replace(/\/$/, '');
}

function resolveAmazonUrl() {
  return (
    String(process.env.AMAZON_URL || '').trim() ||
    'https://www.amazon.in/dp/B0H6R4334W'
  );
}

function resolveTable(name, fallbackEnv) {
  return String(
    process.env[name] || process.env[fallbackEnv] || '',
  ).trim();
}

async function scanAll(dynamo, tableName, params = {}) {
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
}

async function loadPurchaserEmails(dynamo, ordersTable) {
  const purchased = new Set();
  if (!ordersTable) return purchased;

  const paidOrders = await scanAll(dynamo, ordersTable, {
    FilterExpression: '#status = :paid',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':paid': 'paid' },
  });
  for (const order of paidOrders) {
    if (order.checkoutBypass === true) continue;
    if (String(order.appOrderId || '').startsWith('MJ-T-')) continue;
    const email = normalizeEmail(order.email);
    if (email) purchased.add(email);
  }
  return purchased;
}

function leadHasPurchased(item, purchasers) {
  const email = normalizeEmail(item?.email);
  return (
    purchasers.has(email) ||
    String(item?.leadStatus || '').toUpperCase() === 'CUSTOMER'
  );
}

function ageDays(item, now) {
  const requestedAt = item.lastRequestedAt || item.firstRequestedAt;
  if (!requestedAt) return null;
  const ms = Date.parse(requestedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((now.getTime() - ms) / (24 * 60 * 60 * 1000));
}

/**
 * Pick the next due automated step for a lead (continuity → education → reminder).
 */
function resolveDueStep(
  item,
  {
    now = new Date(),
    hasPurchased = false,
    continuityDays = SAMPLE_CONTINUITY_DAYS,
    educationDays = SAMPLE_EDUCATION_DAYS,
    reminderDays = SAMPLE_REMINDER_DAYS,
  } = {},
) {
  if (
    isEligibleForSampleContinuityEmail(item, {
      now,
      minAgeDays: continuityDays,
      hasPurchased,
    })
  ) {
    return STEPS.continuity;
  }
  if (
    isEligibleForSampleEducationEmail(item, {
      now,
      minAgeDays: educationDays,
      hasPurchased,
    })
  ) {
    return STEPS.education;
  }
  if (
    isEligibleForSampleReminderEmail(item, {
      now,
      minAgeDays: reminderDays,
      hasPurchased,
    })
  ) {
    return STEPS.reminder;
  }
  return null;
}

/**
 * When forcing a single email, pick the next unsent step (or an explicit step).
 */
function resolveForcedStep(item, forceStep = null) {
  if (forceStep && Object.values(STEPS).includes(forceStep)) {
    return forceStep;
  }
  if (!item?.sampleContinuityEmailSentAt) return STEPS.continuity;
  if (!item?.sampleEducationEmailSentAt) return STEPS.education;
  if (!item?.sampleReminderEmailSentAt) return STEPS.reminder;
  return STEPS.continuity;
}

async function deliverContinuity({ ses, item, siteUrl }) {
  const toEmail = normalizeEmail(item.email);
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET || '';
  if (!secret) {
    throw new Error('UNSUBSCRIBE_TOKEN_SECRET is not configured');
  }
  const listUnsubscribeUrl = buildListUnsubscribeUrl(toEmail);
  if (!listUnsubscribeUrl) {
    throw new Error(
      'PUBLIC_API_URL (or ORDER_API_URL) is required for List-Unsubscribe',
    );
  }
  const clickToken = createEmailClickToken(toEmail, {
    secret,
    sequence: 'sample-continuity',
  });
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
    recipientRecord: item,
    bcc: resolveAdminBcc(),
    tags: { funnel: 'sample', sequenceDay: '4', emailName: 'continuity' },
  });
  return { step: STEPS.continuity, formatsUrl: email.formatsUrl };
}

async function deliverEducation({ ses, item, siteUrl }) {
  const toEmail = normalizeEmail(item.email);
  const email = buildSampleEducationEmail({ siteUrl });
  await sendMarketingEmail({
    ses,
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    recipientRecord: item,
    bcc: resolveAdminBcc(),
    tags: { funnel: 'sample', sequenceDay: '10', emailName: 'education' },
  });
  return { step: STEPS.education };
}

async function deliverReminder({ ses, item, siteUrl, amazonUrl }) {
  const toEmail = normalizeEmail(item.email);
  const email = buildSampleReminderEmail({ siteUrl, amazonUrl });
  await sendMarketingEmail({
    ses,
    to: toEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    recipientRecord: item,
    bcc: resolveAdminBcc(),
    tags: { funnel: 'sample', sequenceDay: '18', emailName: 'reminder' },
  });
  return { step: STEPS.reminder };
}

async function markStepSent(dynamo, sampleTable, email, step, { requireUnset = true } = {}) {
  const now = new Date().toISOString();
  const attrByStep = {
    [STEPS.continuity]: 'sampleContinuityEmailSentAt',
    [STEPS.education]: 'sampleEducationEmailSentAt',
    [STEPS.reminder]: 'sampleReminderEmailSentAt',
  };
  const attr = attrByStep[step];
  if (!attr) throw new Error(`Unknown nurture step: ${step}`);

  await dynamo.send(
    new UpdateCommand({
      TableName: sampleTable,
      Key: { email },
      UpdateExpression: `SET ${attr} = :now, updatedAt = :now`,
      ...(requireUnset
        ? {
            ConditionExpression: `attribute_not_exists(${attr})`,
            ExpressionAttributeValues: { ':now': now },
          }
        : {
            ExpressionAttributeValues: { ':now': now },
          }),
    }),
  );
}

/**
 * @param {{
 *   dryRun?: boolean,
 *   onlyEmail?: string,
 *   force?: boolean,
 *   forceStep?: string|null,
 *   continuityDays?: number,
 *   educationDays?: number,
 *   reminderDays?: number,
 *   now?: Date,
 *   dynamo?: object,
 *   ses?: object,
 *   logger?: { log: Function, warn: Function, error: Function },
 * }} [options]
 */
async function runSampleNurtureJob(options = {}) {
  const {
    dryRun = false,
    onlyEmail = '',
    force = false,
    forceStep = null,
    continuityDays = Number(process.env.SAMPLE_CONTINUITY_DAYS) ||
      SAMPLE_CONTINUITY_DAYS,
    educationDays = Number(process.env.SAMPLE_EDUCATION_DAYS) ||
      SAMPLE_EDUCATION_DAYS,
    reminderDays = Number(process.env.SAMPLE_REMINDER_DAYS) ||
      SAMPLE_REMINDER_DAYS,
    now = new Date(),
    logger = console,
  } = options;

  const sampleTable = resolveTable(
    'SAMPLE_REQUESTS_TABLE',
    'SAMPLE_REQUESTS_TABLE_NAME',
  );
  const ordersTable = resolveTable('ORDERS_TABLE', 'ORDERS_TABLE_NAME');
  if (!sampleTable) {
    throw new Error('SAMPLE_REQUESTS_TABLE is not configured');
  }

  const dynamo =
    options.dynamo ||
    DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const ses = options.ses || createSesClient();
  const siteUrl = resolveSiteUrl();
  const amazonUrl = resolveAmazonUrl();
  const bcc = resolveAdminBcc();
  const targetEmail = normalizeEmail(onlyEmail);

  logger.log('Sample nurture job');
  logger.log('==================');
  logger.log(`Sample table: ${sampleTable}`);
  logger.log(`Orders table: ${ordersTable || '(not set)'}`);
  logger.log(`From: ${process.env.MAIL_FROM_EMAIL || 'pradeep@classpath.in'}`);
  logger.log(`Reply-To: ${process.env.REPLY_TO_EMAIL || 'pradeep@classpath.in'}`);
  logger.log(`BCC: ${bcc}`);
  logger.log(
    `Days: continuity=${continuityDays} education=${educationDays} reminder=${reminderDays}`,
  );
  logger.log(`Dry run: ${dryRun}`);
  logger.log(`Force single: ${force && targetEmail ? targetEmail : 'no'}`);
  logger.log('');

  let candidates = [];
  if (targetEmail) {
    const result = await dynamo.send(
      new GetCommand({
        TableName: sampleTable,
        Key: { email: targetEmail },
      }),
    );
    if (!result.Item) {
      throw new Error(`No sample-request record found for ${targetEmail}`);
    }
    candidates = [result.Item];
  } else {
    candidates = await scanAll(dynamo, sampleTable);
  }

  const purchasers = await loadPurchaserEmails(dynamo, ordersTable);
  const due = [];

  for (const item of candidates) {
    const email = normalizeEmail(item.email);
    if (!email) continue;
    const hasPurchased = leadHasPurchased(item, purchasers);
    const step =
      force && targetEmail && email === targetEmail
        ? resolveForcedStep(item, forceStep)
        : resolveDueStep(item, {
            now,
            hasPurchased,
            continuityDays,
            educationDays,
            reminderDays,
          });
    if (!step) continue;
    due.push({ item, email, step, ageDays: ageDays(item, now) });
  }

  logger.log(`Sample leads scanned: ${candidates.length}`);
  logger.log(`Known purchasers excluded via orders: ${purchasers.size}`);
  logger.log(`Due sends: ${due.length}`);
  logger.log('');

  const summary = {
    scanned: candidates.length,
    purchasers: purchasers.size,
    due: due.length,
    sent: 0,
    failed: 0,
    byStep: {
      continuity: 0,
      education: 0,
      reminder: 0,
    },
    failures: [],
  };

  if (due.length === 0) {
    logger.log('Nothing to send.');
    return summary;
  }

  for (const { item, email, step, ageDays: age } of due) {
    const label = `${step} → ${email} (preview ${age ?? '?'}d ago)`;
    if (dryRun) {
      logger.log(`[dry-run] would send ${label}`);
      summary.byStep[step] += 1;
      continue;
    }
    try {
      if (step === STEPS.continuity) {
        await deliverContinuity({ ses, item, siteUrl });
      } else if (step === STEPS.education) {
        await deliverEducation({ ses, item, siteUrl });
      } else if (step === STEPS.reminder) {
        await deliverReminder({ ses, item, siteUrl, amazonUrl });
      } else {
        throw new Error(`Unknown step ${step}`);
      }
      await markStepSent(dynamo, sampleTable, email, step, {
        requireUnset: !(force && targetEmail === email),
      });
      summary.sent += 1;
      summary.byStep[step] += 1;
      logger.log(`Sent ${label}`);
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({ email, step, message: error.message || String(error) });
      logger.error(`Failed ${label}:`, error.message || error);
    }
  }

  if (!dryRun) {
    logger.log('');
    logger.log(`Sent: ${summary.sent}`);
    logger.log(`Failed: ${summary.failed}`);
    logger.log(
      `By step: continuity=${summary.byStep.continuity} education=${summary.byStep.education} reminder=${summary.byStep.reminder}`,
    );
  }

  return summary;
}

module.exports = {
  STEPS,
  resolveDueStep,
  resolveForcedStep,
  runSampleNurtureJob,
  loadPurchaserEmails,
  markStepSent,
};
