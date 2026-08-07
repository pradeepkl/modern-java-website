#!/usr/bin/env node
/**
 * Ops CLI for Day 18 sample reminder (part of automated nurture).
 * Prefer the daily EventBridge job; use this for dry-run / force.
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... ORDERS_TABLE=... PUBLIC_API_URL=... \
 *     UNSUBSCRIBE_TOKEN_SECRET=... node scripts/send-sample-reminder.js --dry-run
 *   ... node scripts/send-sample-reminder.js --email reader@example.com --force
 */
const {
  SAMPLE_REMINDER_DAYS,
} = require('../src/sampleChapterFollowUp');
const { runSampleNurtureJob, STEPS } = require('../src/sampleNurtureJob');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const daysFlag = argv.indexOf('--days');
const reminderDays =
  daysFlag >= 0
    ? Number(argv[daysFlag + 1]) || SAMPLE_REMINDER_DAYS
    : Number(process.env.SAMPLE_REMINDER_DAYS || SAMPLE_REMINDER_DAYS);
const emailFlag = argv.indexOf('--email');
const onlyEmail =
  emailFlag >= 0 ? String(argv[emailFlag + 1] || '').trim().toLowerCase() : '';

if (
  !process.env.SAMPLE_REQUESTS_TABLE &&
  !process.env.SAMPLE_REQUESTS_TABLE_NAME
) {
  console.error(
    'Set SAMPLE_REQUESTS_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}

runSampleNurtureJob({
  dryRun,
  onlyEmail,
  force: force && Boolean(onlyEmail),
  forceStep: force && onlyEmail ? STEPS.reminder : null,
  reminderDays,
  continuityDays: Number.MAX_SAFE_INTEGER,
  educationDays: force ? 0 : Number.MAX_SAFE_INTEGER,
})
  .then((summary) => {
    if (summary.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
