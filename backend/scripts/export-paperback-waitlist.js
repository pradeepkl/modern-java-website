#!/usr/bin/env node
/**
 * Protected paperback waitlist stats + optional CSV export.
 *
 * Requires AWS credentials with DynamoDB read access to PaperbackWaitlistTable.
 * Not exposed as a public API.
 *
 * Usage:
 *   node scripts/export-paperback-waitlist.mjs
 *   node scripts/export-paperback-waitlist.mjs --csv ./waitlist.csv
 *   PAPERBACK_WAITLIST_TABLE=... node scripts/export-paperback-waitlist.mjs
 */
const { writeFileSync } = require('node:fs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const tableName =
  process.env.PAPERBACK_WAITLIST_TABLE ||
  process.env.PAPERBACK_WAITLIST_TABLE_NAME ||
  '';

const csvFlagIndex = process.argv.indexOf('--csv');
const csvPath =
  csvFlagIndex >= 0 ? process.argv[csvFlagIndex + 1] : undefined;

if (!tableName) {
  console.error(
    'Set PAPERBACK_WAITLIST_TABLE to the deployed DynamoDB table name.',
  );
  process.exit(1);
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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

const daysAgoIso = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
};

const countBy = (items, keyFn) => {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || '(none)';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const csvEscape = (value) => {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const main = async () => {
  const items = await scanAll();
  const cutoff7 = daysAgoIso(7);
  const cutoff30 = daysAgoIso(30);

  const last7 = items.filter((item) => item.createdAt >= cutoff7);
  const last30 = items.filter((item) => item.createdAt >= cutoff30);
  const promotionalConsentCount = items.filter(
    (item) => item.promotionalConsent === true,
  ).length;

  console.log('Paperback waitlist demand summary');
  console.log('================================');
  console.log(`Table: ${tableName}`);
  console.log(`Total unique entries: ${items.length}`);
  console.log(`Entries last 7 days: ${last7.length}`);
  console.log(`Entries last 30 days: ${last30.length}`);
  console.log(`Promotional consent count: ${promotionalConsentCount}`);
  console.log('');
  console.log('City distribution:');
  for (const [city, count] of countBy(items, (item) => item.city)) {
    console.log(`  ${city}: ${count}`);
  }
  console.log('');
  console.log('UTM source distribution:');
  for (const [source, count] of countBy(items, (item) => item.utmSource)) {
    console.log(`  ${source}: ${count}`);
  }

  if (csvPath) {
    const header = [
      'name',
      'email',
      'city',
      'status',
      'promotionalConsent',
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'createdAt',
    ];
    const rows = items.map((item) =>
      [
        item.name,
        item.email,
        item.city,
        item.status,
        item.promotionalConsent === true,
        item.utmSource,
        item.utmMedium,
        item.utmCampaign,
        item.createdAt,
      ]
        .map(csvEscape)
        .join(','),
    );
    writeFileSync(csvPath, `${header.join(',')}\n${rows.join('\n')}\n`, 'utf8');
    console.log('');
    console.log(`CSV written to ${csvPath} (${items.length} rows)`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
