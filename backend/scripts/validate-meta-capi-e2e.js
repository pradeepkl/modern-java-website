#!/usr/bin/env node
/**
 * Meta CAPI validation helper (Lead + Purchase).
 *
 * Sends server events with optional test_event_code so they appear in
 * Events Manager → Test events. Pair with browser Pixel events that use the
 * same event_id values (see printed instructions).
 *
 * Usage:
 *   META_TEST_EVENT_CODE=TEST1234 node scripts/validate-meta-capi-e2e.js
 *
 * Requires AWS credentials that can read SSM /modern-java/meta/access-token.
 * Never logs tokens, raw emails, or match keys.
 */
const { createHash, randomUUID } = require('node:crypto');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const PIXEL_ID = process.env.META_PIXEL_ID || '1844493498903023';
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const TEST_CODE = String(process.env.META_TEST_EVENT_CODE || '').trim();
const SSM_PARAM =
  process.env.META_ACCESS_TOKEN_SSM_PARAM || '/modern-java/meta/access-token';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const SOURCE_URL =
  process.env.META_EVENT_SOURCE_URL || 'https://modern-java.classpath.in/';
const EMAIL = String(
  process.env.META_VALIDATION_EMAIL || 'capi-validation@classpath.in',
)
  .trim()
  .toLowerCase();

const hashEmail = (email) =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

const loadToken = async () => {
  if (process.env.META_ACCESS_TOKEN) {
    return String(process.env.META_ACCESS_TOKEN).trim();
  }
  const client = new SSMClient({ region: REGION });
  const result = await client.send(
    new GetParameterCommand({ Name: SSM_PARAM, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter empty: ${SSM_PARAM}`);
  return value;
};

const sendEvent = async (token, event) => {
  const body = {
    data: [event],
    access_token: token,
  };
  if (TEST_CODE) body.test_event_code = TEST_CODE;

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json };
};

const main = async () => {
  if (!TEST_CODE) {
    console.error(
      'META_TEST_EVENT_CODE is required (copy from Meta Events Manager → Test events).',
    );
    process.exit(1);
  }

  const token = await loadToken();
  const now = Math.floor(Date.now() / 1000);
  const leadEventId = `SR-VAL${randomUUID().slice(0, 8).toUpperCase()}`;
  const purchaseEventId = `MJ-D-VAL${randomUUID().slice(0, 6).toUpperCase()}`;
  const em = hashEmail(EMAIL);

  const lead = {
    event_name: 'Lead',
    event_time: now,
    event_id: leadEventId,
    action_source: 'website',
    event_source_url: SOURCE_URL,
    user_data: {
      em: [em],
      client_user_agent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    custom_data: {
      content_name: 'Modern Java Sample Chapter',
      content_category: 'Book sample',
    },
  };

  const purchase = {
    event_name: 'Purchase',
    event_time: now + 1,
    event_id: purchaseEventId,
    action_source: 'website',
    event_source_url: SOURCE_URL,
    user_data: {
      em: [em],
      client_user_agent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    custom_data: {
      content_ids: ['modern-java-digital'],
      content_name: 'Modern Java DRM-free',
      content_type: 'product',
      value: 699,
      currency: 'INR',
      num_items: 1,
      order_id: purchaseEventId,
    },
  };

  console.log('Sending server Lead…');
  const leadResult = await sendEvent(token, lead);
  console.log(
    JSON.stringify(
      {
        event_name: 'Lead',
        event_id: leadEventId,
        http_status: leadResult.status,
        events_received: leadResult.json.events_received,
        messages: leadResult.json.messages || [],
        error: leadResult.json.error || null,
      },
      null,
      2,
    ),
  );

  console.log('Sending server Purchase…');
  const purchaseResult = await sendEvent(token, purchase);
  console.log(
    JSON.stringify(
      {
        event_name: 'Purchase',
        event_id: purchaseEventId,
        http_status: purchaseResult.status,
        events_received: purchaseResult.json.events_received,
        messages: purchaseResult.json.messages || [],
        error: purchaseResult.json.error || null,
      },
      null,
      2,
    ),
  );

  console.log(`
Next — fire matching browser Pixel events (same event_id) on the live site
after Accept analytics, then confirm Test Events shows Browser + Server
deduped into one Lead and one Purchase:

  fbq('track', 'Lead', { content_name: 'sample_chapter' }, { eventID: '${leadEventId}' });
  fbq('track', 'Purchase', { value: 699, currency: 'INR' }, { eventID: '${purchaseEventId}' });
`);

  if (!leadResult.ok || !purchaseResult.ok) process.exit(2);
};

main().catch((error) => {
  console.error('validate_meta_capi_failed', error?.name || 'Error');
  process.exit(1);
});
