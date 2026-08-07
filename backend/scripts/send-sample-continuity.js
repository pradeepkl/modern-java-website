#!/usr/bin/env node
/**
 * Ops CLI for the automated sample nurture sequence
 * (Day 4 continuity → Day 10 education → Day 18 reminder).
 *
 * Primary path is the daily EventBridge Lambda (SampleNurtureFunction).
 * Use this script for dry-runs and forced single-lead sends.
 *
 * From: pradeep@classpath.in  ·  BCC: admin@classpath.in
 *
 * Usage:
 *   SAMPLE_REQUESTS_TABLE=... UNSUBSCRIBE_TOKEN_SECRET=... PUBLIC_API_URL=... \
 *     node scripts/send-sample-continuity.js --dry-run
 *   ... node scripts/send-sample-continuity.js
 *   ... node scripts/send-sample-continuity.js --email reader@example.com --force
 *   ... node scripts/send-sample-continuity.js --email reader@example.com --force --step education
 */
const { runSampleNurtureJob, STEPS } = require('../src/sampleNurtureJob');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const force = argv.includes('--force');
const emailFlag = argv.indexOf('--email');
const onlyEmail =
  emailFlag >= 0 ? String(argv[emailFlag + 1] || '').trim().toLowerCase() : '';
const stepFlag = argv.indexOf('--step');
const forceStepRaw =
  stepFlag >= 0 ? String(argv[stepFlag + 1] || '').trim().toLowerCase() : '';
const forceStep = Object.values(STEPS).includes(forceStepRaw)
  ? forceStepRaw
  : null;

if (
  !process.env.SAMPLE_REQUESTS_TABLE &&
  !process.env.SAMPLE_REQUESTS_TABLE_NAME
) {
  console.error(
    'Set SAMPLE_REQUESTS_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}

if (!process.env.UNSUBSCRIBE_TOKEN_SECRET || !process.env.PUBLIC_API_URL) {
  console.error(
    'Set UNSUBSCRIBE_TOKEN_SECRET and PUBLIC_API_URL so unsubscribe + click links work.',
  );
  process.exit(1);
}

runSampleNurtureJob({
  dryRun,
  onlyEmail,
  force: force && Boolean(onlyEmail),
  forceStep,
})
  .then((summary) => {
    if (summary.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
