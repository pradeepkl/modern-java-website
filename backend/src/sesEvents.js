/**
 * Process SES → EventBridge notification events into DynamoDB delivery status.
 */
const {
  normalizeEmail,
  classifySesBounce,
  buildHardBounceUpdate,
  buildComplaintUpdate,
  buildSoftBounceTelemetryUpdate,
  buildDeliveryTelemetryUpdate,
} = require('./emailDelivery');

function extractRecipientsFromBounce(bounce = {}) {
  const recipients = bounce.bouncedRecipients || [];
  return recipients
    .map((entry) => ({
      email: normalizeEmail(entry.emailAddress),
      diagnosticCode: entry.diagnosticCode,
    }))
    .filter((entry) => entry.email);
}

function extractRecipientsFromComplaint(complaint = {}) {
  const recipients = complaint.complainedRecipients || [];
  return recipients
    .map((entry) => normalizeEmail(entry.emailAddress))
    .filter(Boolean)
    .map((email) => ({ email }));
}

function extractRecipientsFromDelivery(delivery = {}) {
  return (delivery.recipients || [])
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
    .map((email) => ({ email }));
}

/**
 * Normalize EventBridge or SNS-wrapped SES event payloads.
 * @returns {{ eventType: string, mail: object, bounce?: object, complaint?: object, delivery?: object } | null}
 */
function normalizeSesEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // EventBridge SES events put the notification fields at the top level,
  // sometimes under detail when using the default bus shape.
  const detail = raw.detail && typeof raw.detail === 'object' ? raw.detail : raw;
  let payload = detail;

  // SNS → Lambda wrapper (Message is a JSON string).
  if (typeof detail.Message === 'string') {
    try {
      payload = JSON.parse(detail.Message);
    } catch {
      return null;
    }
  }

  const eventType = String(
    payload.eventType || payload.notificationType || raw['detail-type'] || '',
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (!eventType) return null;

  return {
    eventType,
    mail: payload.mail || {},
    bounce: payload.bounce,
    complaint: payload.complaint,
    delivery: payload.delivery,
    reject: payload.reject,
    failure: payload.failure,
  };
}

/**
 * @param {object} rawEvent
 * @param {{
 *   dynamo: { send: Function },
 *   UpdateCommand: new (args: object) => object,
 *   tableName: string,
 *   now?: string,
 * }} deps
 */
async function processSesEvent(rawEvent, deps) {
  const { dynamo, UpdateCommand, tableName, now = new Date().toISOString() } =
    deps;
  if (!tableName) {
    return { processed: 0, skipped: true, reason: 'missing_table' };
  }

  const event = normalizeSesEvent(rawEvent);
  if (!event) {
    return { processed: 0, skipped: true, reason: 'unrecognized_event' };
  }

  const messageId = event.mail?.messageId;
  const updates = [];

  if (event.eventType === 'BOUNCE' && event.bounce) {
    const classification = classifySesBounce(event.bounce);
    for (const recipient of extractRecipientsFromBounce(event.bounce)) {
      updates.push({
        email: recipient.email,
        update: classification.permanent
          ? buildHardBounceUpdate({
              now,
              reason: classification.reason,
              messageId,
              diagnosticCode: recipient.diagnosticCode,
            })
          : buildSoftBounceTelemetryUpdate({
              now,
              reason: classification.reason,
              messageId,
            }),
        kind: classification.permanent ? 'hard_bounce' : 'soft_bounce',
      });
    }
  } else if (event.eventType === 'COMPLAINT' && event.complaint) {
    for (const recipient of extractRecipientsFromComplaint(event.complaint)) {
      updates.push({
        email: recipient.email,
        update: buildComplaintUpdate({
          now,
          reason: 'COMPLAINT',
          messageId,
        }),
        kind: 'complaint',
      });
    }
  } else if (event.eventType === 'DELIVERY' && event.delivery) {
    for (const recipient of extractRecipientsFromDelivery(event.delivery)) {
      updates.push({
        email: recipient.email,
        update: buildDeliveryTelemetryUpdate({ now, messageId }),
        kind: 'delivery',
      });
    }
  } else if (
    event.eventType === 'REJECT' ||
    event.eventType === 'DELIVERY_DELAY' ||
    event.eventType === 'RENDERING_FAILURE' ||
    event.eventType === 'RENDERINGFAILURE'
  ) {
    // Telemetry-only for account monitoring; do not suppress the recipient.
    return {
      processed: 0,
      skipped: false,
      reason: 'telemetry_only',
      eventType: event.eventType,
      messageId,
    };
  } else {
    return {
      processed: 0,
      skipped: true,
      reason: 'ignored_event_type',
      eventType: event.eventType,
    };
  }

  let processed = 0;
  const results = [];
  for (const entry of updates) {
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { email: entry.email },
          ...entry.update,
          ConditionExpression: 'attribute_exists(email)',
        }),
      );
      processed += 1;
      results.push({ email: entry.email, kind: entry.kind, ok: true });
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') {
        // Missing lead row, or a future condition already satisfied.
        results.push({
          email: entry.email,
          kind: entry.kind,
          ok: false,
          reason: 'unknown_recipient',
        });
        continue;
      }
      throw error;
    }
  }

  return {
    processed,
    skipped: false,
    eventType: event.eventType,
    messageId,
    results,
  };
}

module.exports = {
  normalizeSesEvent,
  extractRecipientsFromBounce,
  extractRecipientsFromComplaint,
  extractRecipientsFromDelivery,
  processSesEvent,
};
