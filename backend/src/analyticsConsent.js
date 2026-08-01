/**
 * First-party analytics cookie-banner choice logging.
 *
 * Records only Accept / Essential-only aggregates for CloudWatch Insights.
 * No email, name, IP hashing for identity, or advertising identifiers.
 */

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

const sanitizePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '/';
  const pathOnly = raw.split('?')[0].split('#')[0] || '/';
  return pathOnly.slice(0, 200);
};

const sanitizeUtmValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 120) return '';
  if (!/^[\w./:@%+\-]+$/i.test(raw)) return '';
  return raw;
};

/**
 * @param {Record<string, unknown>} json
 */
const extractConsentChoicePayload = (json = {}) => {
  const choice =
    json.choice === 'granted' || json.choice === 'denied' ? json.choice : null;
  /** @type {Record<string, string>} */
  const utm = {};
  for (const key of UTM_KEYS) {
    const value = sanitizeUtmValue(json[key]);
    if (value) utm[key] = value;
  }
  return {
    choice,
    path: sanitizePath(json.path),
    utm,
  };
};

/**
 * @param {{
 *   event: unknown,
 *   parseBody: (event: unknown) => { json: Record<string, unknown> },
 *   response: (statusCode: number, body: Record<string, unknown>) => unknown,
 * }} input
 */
const recordAnalyticsConsentChoice = async ({ event, parseBody, response }) => {
  const { json } = parseBody(event);
  const payload = extractConsentChoicePayload(json);

  if (!payload.choice) {
    return response(400, { message: 'choice must be granted or denied' });
  }

  console.info('analytics_consent_choice', {
    choice: payload.choice,
    path: payload.path,
    ...payload.utm,
  });

  return response(200, { recorded: true });
};

module.exports = {
  UTM_KEYS,
  sanitizePath,
  sanitizeUtmValue,
  extractConsentChoicePayload,
  recordAnalyticsConsentChoice,
};
