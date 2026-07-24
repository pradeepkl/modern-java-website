/**
 * Consent vs deliverability for outbound email.
 * SES account suppression remains the final safety net.
 *
 * Categories are explicit — never infer from template names:
 * - TRANSACTIONAL: purchase, invoice, requested sample, download links
 * - MARKETING: nurture, promotions, paperback announcements
 */

const EMAIL_CATEGORY = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  MARKETING: 'MARKETING',
};

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

function isDeliverySuppressed(item) {
  const status = resolveEmailDeliveryStatus(item);
  return (
    status === EMAIL_DELIVERY.HARD_BOUNCED ||
    status === EMAIL_DELIVERY.COMPLAINED ||
    status === EMAIL_DELIVERY.SUPPRESSED
  );
}

/**
 * Transactional mail (purchase, invoice, sample delivery, download links).
 * Marketing unsubscribe / withdrawn consent must NOT block these.
 * Hard bounce / complaint still blocks.
 *
 * Missing recipient records are allowed — SES account suppression is the net.
 */
function isTransactionalSendAllowed(item) {
  if (!item) return true;
  return !isDeliverySuppressed(item);
}

/**
 * Marketing / nurture / promotional mail.
 * Requires active consent, no unsubscribe, and ACTIVE delivery.
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
 * @param {'TRANSACTIONAL'|'MARKETING'} category
 * @param {object|null|undefined} item
 * @returns {{ allowed: boolean, reason: string|null }}
 */
function evaluateSendEligibility(category, item) {
  const normalized = String(category || '')
    .trim()
    .toUpperCase();

  if (normalized === EMAIL_CATEGORY.TRANSACTIONAL) {
    if (isTransactionalSendAllowed(item)) {
      return { allowed: true, reason: null };
    }
    return {
      allowed: false,
      reason: `delivery_status:${resolveEmailDeliveryStatus(item)}`,
    };
  }

  if (normalized === EMAIL_CATEGORY.MARKETING) {
    if (isMarketingSendAllowed(item)) {
      return { allowed: true, reason: null };
    }
    if (!item || !normalizeEmail(item?.email)) {
      return { allowed: false, reason: 'missing_recipient' };
    }
    if (item.marketingUnsubscribedAt) {
      return { allowed: false, reason: 'marketing_unsubscribed' };
    }
    if (resolveMarketingConsentStatus(item) !== MARKETING_CONSENT.CONSENTED) {
      return { allowed: false, reason: 'marketing_consent_inactive' };
    }
    return {
      allowed: false,
      reason: `delivery_status:${resolveEmailDeliveryStatus(item)}`,
    };
  }

  return { allowed: false, reason: 'invalid_category' };
}

function assertSendEligible(category, item) {
  const result = evaluateSendEligibility(category, item);
  if (result.allowed) return result;
  const error = new Error(
    `Email send blocked for category ${category}: ${result.reason}`,
  );
  error.name = 'EmailEligibilityError';
  error.reason = result.reason;
  error.category = category;
  throw error;
}

/**
 * Soft bounce / delay: keep ACTIVE, record telemetry only.
 * Hard bounce / complaint: permanently disable delivery status.
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
  EMAIL_CATEGORY,
  MARKETING_CONSENT,
  EMAIL_DELIVERY,
  normalizeEmail,
  resolveMarketingConsentStatus,
  resolveEmailDeliveryStatus,
  isDeliverySuppressed,
  isTransactionalSendAllowed,
  isMarketingSendAllowed,
  evaluateSendEligibility,
  assertSendEligible,
  classifySesBounce,
  buildUnsubscribeUpdate,
  buildHardBounceUpdate,
  buildComplaintUpdate,
  buildSoftBounceTelemetryUpdate,
  buildDeliveryTelemetryUpdate,
};
