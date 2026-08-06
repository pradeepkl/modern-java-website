#!/usr/bin/env node
/**
 * Export all orders from DynamoDB into ops/orders.json (+ .md) with PII masked.
 *
 * Usage:
 *   node scripts/export-order-summaries.js
 *   STACK_NAME=modern-java-prod node scripts/export-order-summaries.js
 *   ORDERS_TABLE=<table> node scripts/export-order-summaries.js
 */
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  summariesByOrderId,
  markdownTable,
} = require('../src/orderSummary');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const STACK_NAME = process.env.STACK_NAME || 'modern-java-prod';
const ROOT_DIR = join(__dirname, '../..');
const OUT_JSON = process.env.ORDERS_SUMMARY_JSON || join(ROOT_DIR, 'ops/orders.json');
const OUT_MD = process.env.ORDERS_SUMMARY_MD || join(ROOT_DIR, 'ops/orders.md');

function awsJson(args) {
  const raw = execFileSync('aws', [...args, '--region', REGION, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function resolveOrdersTable() {
  if (process.env.ORDERS_TABLE) return process.env.ORDERS_TABLE;
  try {
    const stacks = awsJson([
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      STACK_NAME,
    ]);
    const outputs = stacks.Stacks?.[0]?.Outputs || [];
    const fromOutput = outputs.find(
      (item) => item.OutputKey === 'OrdersTableName',
    )?.OutputValue;
    if (fromOutput) return fromOutput;
  } catch {
    // fall through
  }
  const resources = awsJson([
    'cloudformation',
    'describe-stack-resources',
    '--stack-name',
    STACK_NAME,
  ]);
  const match = (resources.StackResources || []).find(
    (item) => item.LogicalResourceId === 'OrdersTable',
  );
  if (!match?.PhysicalResourceId) {
    throw new Error(
      `Could not resolve OrdersTable for stack ${STACK_NAME}. Set ORDERS_TABLE.`,
    );
  }
  return match.PhysicalResourceId;
}

async function scanAll(tableName) {
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
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
}

async function main() {
  const tableName = resolveOrdersTable();
  console.error(`Scanning ${tableName} (${STACK_NAME})…`);
  const orders = await scanAll(tableName);
  const recordedAt = new Date().toISOString();
  const table = summariesByOrderId(orders, { recordedAt });
  const count = Object.keys(table).length;

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(table, null, 2)}\n`, 'utf8');
  writeFileSync(OUT_MD, markdownTable(table), 'utf8');

  console.error(`Wrote ${count} masked order summar${count === 1 ? 'y' : 'ies'}`);
  console.error(`  ${OUT_JSON}`);
  console.error(`  ${OUT_MD}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
