/**
 * Sample-preview Meta Lead semantics.
 *
 * Meta Lead = first time an email becomes a sample-chapter lead.
 * Repeat PDF deliveries increment requestCount but must not emit another Lead.
 */

const FIRST_LEAD_PUT_CONDITION =
  // New email OR existing marketing-only row (no firstRequestedAt yet).
  // Prod audit 2026-08-11: every true sample lead has firstRequestedAt;
  // rows lacking it are amazon_exit / digital-checkout / unsubscribe only
  // and may still become a first sample Lead (spread preserves prior fields).
  'attribute_not_exists(email) OR attribute_not_exists(firstRequestedAt)';

/**
 * @param {Record<string, unknown>|null|undefined} existingItem
 * @returns {boolean}
 */
function isFirstSampleLead(existingItem) {
  if (!existingItem || typeof existingItem !== 'object') return true;
  const firstRequestedAt = String(existingItem.firstRequestedAt || '').trim();
  if (firstRequestedAt) return false;
  // Legacy / partial rows that already hold a sampleRequestId are existing leads.
  const sampleRequestId = String(existingItem.sampleRequestId || '').trim();
  if (sampleRequestId) return false;
  return true;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isConditionalCheckFailed(error) {
  return (
    error?.name === 'ConditionalCheckFailedException' ||
    error?.Code === 'ConditionalCheckFailedException' ||
    Boolean(error?.__type?.includes('ConditionalCheckFailed'))
  );
}

/**
 * @param {{
 *   existingItem?: Record<string, unknown>|null,
 *   email: string,
 *   sampleRequestId: string,
 *   now: string,
 *   consentFields: Record<string, unknown>,
 *   source: string,
 *   emailDeliveryActive: string,
 * }} input
 */
function buildSampleRequestItem({
  existingItem,
  email,
  sampleRequestId,
  now,
  consentFields,
  source,
  emailDeliveryActive,
}) {
  const previousCount = Number(existingItem?.requestCount || 0);
  const nextItem = {
    ...existingItem,
    email,
    sampleRequestId,
    firstRequestedAt: existingItem?.firstRequestedAt || now,
    lastRequestedAt: now,
    requestCount: previousCount + 1,
    marketingConsent: consentFields.marketingConsent,
    marketingConsentStatus: consentFields.marketingConsentStatus,
    emailDeliveryStatus:
      existingItem?.emailDeliveryStatus || emailDeliveryActive,
    marketingConsentAt: consentFields.marketingConsentAt,
    marketingConsentUpdatedAt: consentFields.marketingConsentUpdatedAt,
    consentVersion: consentFields.consentVersion,
    marketingConsentSource: consentFields.marketingConsentSource,
    source,
  };
  if (consentFields.clearUnsubscribe) {
    delete nextItem.marketingUnsubscribedAt;
  }
  return nextItem;
}

/**
 * Persist an accepted sample request and resolve whether this write created
 * the first Meta Lead for the email (concurrency-safe for first-lead claim).
 *
 * @param {{
 *   existingItem?: Record<string, unknown>|null,
 *   email: string,
 *   sampleRequestId: string,
 *   now: string,
 *   consentFields: Record<string, unknown>,
 *   source: string,
 *   emailDeliveryActive: string,
 *   tableName: string,
 *   dynamo: { send: Function },
 *   PutCommand: new (input: object) => object,
 *   GetCommand: new (input: object) => object,
 * }} input
 * @returns {Promise<{
 *   newLead: boolean,
 *   item: Record<string, unknown>,
 *   leadEventId: string,
 *   requestCount: number,
 * }>}
 */
async function persistSampleRequestLead({
  existingItem,
  email,
  sampleRequestId,
  now,
  consentFields,
  source,
  emailDeliveryActive,
  tableName,
  dynamo,
  PutCommand,
  GetCommand,
}) {
  const intendedFirstLead = isFirstSampleLead(existingItem);
  let item = buildSampleRequestItem({
    existingItem,
    email,
    sampleRequestId,
    now,
    consentFields,
    source,
    emailDeliveryActive,
  });

  if (intendedFirstLead) {
    try {
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
          ConditionExpression: FIRST_LEAD_PUT_CONDITION,
        }),
      );
      return {
        newLead: true,
        item,
        leadEventId: String(item.sampleRequestId),
        requestCount: Number(item.requestCount),
      };
    } catch (error) {
      if (!isConditionalCheckFailed(error)) throw error;

      const fresh = await dynamo.send(
        new GetCommand({
          TableName: tableName,
          Key: { email },
        }),
      );
      const winner = fresh?.Item || existingItem || null;
      const winnerLeadId =
        String(winner?.sampleRequestId || '').trim() || sampleRequestId;
      item = buildSampleRequestItem({
        existingItem: winner,
        email,
        sampleRequestId: winnerLeadId,
        now,
        consentFields,
        source,
        emailDeliveryActive,
      });
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        }),
      );
      return {
        newLead: false,
        item,
        leadEventId: String(item.sampleRequestId),
        requestCount: Number(item.requestCount),
      };
    }
  }

  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );
  return {
    newLead: false,
    item,
    leadEventId: String(item.sampleRequestId),
    requestCount: Number(item.requestCount),
  };
}

module.exports = {
  FIRST_LEAD_PUT_CONDITION,
  isFirstSampleLead,
  isConditionalCheckFailed,
  buildSampleRequestItem,
  persistSampleRequestLead,
};
