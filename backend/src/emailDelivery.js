/**
 * Consent vs deliverability for marketing sends.
 * SES account suppression remains the final safety net.
 */

const MARKETING_CONSENT = {
  CONSENTED: 'CONSENTED',
  WITHDRAWN: 'WITHDRAWN',
};

const EMAIL_DELIVERY = {
  ACTIVE: 'ACTIVE',
  HARD_BOUNCED: 'HARD_BOUNCED',
  COMPLAINED: 'COMPLAINED',
  SUPPRESSED: 'SUPPRESSED',
};

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function resolveMarketingConsentStatus(item) {
  if (!item) return null;
  if (item.marketingConsentStatus === MARKETING_CONSENT.CONSENTED) {
    return MARKETING_CONSENT.CONSENTED;
  }
  if (item.marketingConsentStatus === MARKETING_CONSENT.WITHDRAWN) {
    return MARKETING_CONSENT.WITHDRAWN;
  }
  if (item.marketingConsent === true) return MARKETING_CONSENT.CONSENTED;
  if (item.marketingConsent === false) return MARKETING_CONSENT.WITHDRAWN;
  return null;
}

function resolveEmailDeliveryStatus(item) {
  if (!item) return EMAIL_DELIVERY.ACTIVE;
  const status = String(item.emailDeliveryStatus || EMAIL_DELIVERY.ACTIVE);
  if (Object.values(EMAIL_DELIVERY).includes(status)) return status;
  return EMAIL_DELIVERY.ACTIVE;
}

/**
 * Whether a lead may receive nurture / promotional email.
 */
function isMarketingSendAllowed(item) {
  if (!item || !normalizeEmail(item.email)) return false;
  if (item.marketingUnsubscribedAt) return false;
  if (resolveMarketingConsentStatus(item) !== MARKETING_CONSENT.CONSENTED) {
    return false;
  }
  return resolveEmailDeliveryStatus(item) === EMAIL_DELIVERY.ACTIVE;
}

/**
 * Soft bounce / delay: keep ACTIVE, record telemetry only.
 * Hard bounce / complaint: permanently disable marketing delivery.
 */
function classifySesBounce(bounce) {
  const bounceType = String(bounce?.bounceType || '').toUpperCase();
  const bounceSubType = String(bounce?.bounceSubType || '').toUpperCase();
  if (bounceType === 'PERMANENT') {
    return {
      permanent: true,
      reason: `BOUNCE:${bounceType}:${bounceSubType || 'GENERAL'}`,
    };
  }
  return {
    permanent: false,
    reason: `BOUNCE:${bounceType || 'UNDIAGNOSED'}:${bounceSubType || 'GENERAL'}`,
  };
}

function buildUnsubscribeUpdate({ now, source = 'one-click' } = {}) {
  const timestamp = now || new Date().toISOString();
  return {
    UpdateExpression:
      'SET marketingConsent = :withdrawn, ' +
      'marketingConsentStatus = :consentStatus, ' +
      'marketingConsentUpdatedAt = :now, ' +
      'marketingUnsubscribedAt = if_not_exists(marketingUnsubscribedAt, :now), ' +
      'marketingStatus = :marketingStatus, ' +
      'updatedAt = :now, ' +
      'unsubscribeSource = :source',
    ExpressionAttributeValues: {
      ':withdrawn': false,
      ':consentStatus': MARKETING_CONSENT.WITHDRAWN,
      ':now': timestamp,
      ':marketingStatus': 'unsubscribed',
      ':source': String(source || 'one-click'),
    },
  };
}

function buildHardBounceUpdate({
  now,
  reason,
  messageId,
  diagnosticCode,
} = {}) {
  const timestamp = now || new Date().toISOString();
  const values = {
    ':status': EMAIL_DELIVERY.HARD_BOUNCED,
    ':now': timestamp,
    ':reason': String(reason || 'BOUNCE:PERMANENT'),
  };
  let expression =
    'SET emailDeliveryStatus = :status, ' +
    'bounceRecordedAt = if_not_exists(bounceRecordedAt, :now), ' +
    'suppressionReason = :reason, ' +
    'updatedAt = :now';

  if (messageId) {
    expression += ', lastSesMessageId = :messageId';
    values[':messageId'] = String(messageId);
  }
  if (diagnosticCode) {
    expression += ', lastBounceDiagnostic = :diagnostic';
    values[':diagnostic'] = String(diagnosticCode).slice(0, 1000);
  }

  return {
    UpdateExpression: expression,
    ExpressionAttributeValues: values,
  };
}

function buildComplaintUpdate({ now, reason, messageId } = {}) {
  const timestamp = now || new Date().toISOString();
  const values = {
    ':status': EMAIL_DELIVERY.COMPLAINED,
    ':now': timestamp,
    ':reason': String(reason || 'COMPLAINT'),
  };
  let expression =
    'SET emailDeliveryStatus = :status, ' +
    'complaintRecordedAt = if_not_exists(complaintRecordedAt, :now), ' +
    'suppressionReason = :reason, ' +
    'updatedAt = :now';

  if (messageId) {
    expression += ', lastSesMessageId = :messageId';
    values[':messageId'] = String(messageId);
  }

  return {
    UpdateExpression: expression,
    ExpressionAttributeValues: values,
  };
}

function buildSoftBounceTelemetryUpdate({ now, reason, messageId } = {}) {
  const timestamp = now || new Date().toISOString();
  const values = {
    ':now': timestamp,
    ':reason': String(reason || 'BOUNCE:TRANSIENT'),
  };
  let expression =
    'SET lastSoftBounceAt = :now, lastSoftBounceReason = :reason, updatedAt = :now';
  if (messageId) {
    expression += ', lastSesMessageId = :messageId';
    values[':messageId'] = String(messageId);
  }
  return {
    UpdateExpression: expression,
    ExpressionAttributeValues: values,
  };
}

function buildDeliveryTelemetryUpdate({ now, messageId } = {}) {
  const timestamp = now || new Date().toISOString();
  const values = { ':now': timestamp };
  let expression = 'SET lastDeliveredAt = :now, updatedAt = :now';
  if (messageId) {
    expression += ', lastSesMessageId = :messageId';
    values[':messageId'] = String(messageId);
  }
  return {
    UpdateExpression: expression,
    ExpressionAttributeValues: values,
  };
}

module.exports = {
  MARKETING_CONSENT,
  EMAIL_DELIVERY,
  normalizeEmail,
  resolveMarketingConsentStatus,
  resolveEmailDeliveryStatus,
  isMarketingSendAllowed,
  classifySesBounce,
  buildUnsubscribeUpdate,
  buildHardBounceUpdate,
  buildComplaintUpdate,
  buildSoftBounceTelemetryUpdate,
  buildDeliveryTelemetryUpdate,
};
