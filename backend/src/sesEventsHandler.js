/**
 * Lambda entrypoint for SES EventBridge notifications (us-east-1).
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { processSesEvent } = require('./sesEvents');

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.LEADS_TABLE_REGION || process.env.AWS_REGION || 'ap-south-1',
  }),
);

const TABLE =
  process.env.SAMPLE_REQUESTS_TABLE ||
  process.env.SAMPLE_REQUESTS_TABLE_NAME ||
  '';

exports.handler = async (event) => {
  console.info('SES event received', {
    detailType: event?.['detail-type'],
    source: event?.source,
    id: event?.id,
  });

  const result = await processSesEvent(event, {
    dynamo,
    UpdateCommand,
    tableName: TABLE,
  });

  console.info('SES event processed', result);
  return result;
};
