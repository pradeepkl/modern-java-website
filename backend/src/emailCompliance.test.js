const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  buildOneClickUnsubscribeUrl,
} = require('./unsubscribeToken');
const {
  isMarketingSendAllowed,
  classifySesBounce,
  EMAIL_DELIVERY,
  buildUnsubscribeUpdate,
} = require('./emailDelivery');
const { processSesEvent } = require('./sesEvents');
const { buildRawMimeEmail } = require('./sesMail');

const SECRET = 'test-unsubscribe-secret-value';

describe('unsubscribeToken', () => {
  it('round-trips a signed opaque token', () => {
    const token = createUnsubscribeToken('Reader@Example.com', {
      secret: SECRET,
      issuedAtMs: 1_700_000_000_000,
    });
    const verified = verifyUnsubscribeToken(token, { secret: SECRET });
    assert.equal(verified.email, 'reader@example.com');
    assert.equal(verified.issuedAtMs, 1_700_000_000_000);
  });

  it('rejects tampered tokens', () => {
    const token = createUnsubscribeToken('reader@example.com', {
      secret: SECRET,
    });
    assert.equal(
      verifyUnsubscribeToken(`${token}x`, { secret: SECRET }),
      null,
    );
    assert.equal(
      verifyUnsubscribeToken(token, { secret: 'other-secret' }),
      null,
    );
  });

  it('builds the one-click API URL', () => {
    assert.equal(
      buildOneClickUnsubscribeUrl({
        publicApiUrl: 'https://api.example.com/',
        token: 'abc.def',
      }),
      'https://api.example.com/marketing-consents/one-click/abc.def',
    );
  });
});

describe('isMarketingSendAllowed', () => {
  const base = {
    email: 'reader@example.com',
    marketingConsent: true,
  };

  it('requires consent, no unsubscribe, and ACTIVE delivery', () => {
    assert.equal(isMarketingSendAllowed(base), true);
    assert.equal(
      isMarketingSendAllowed({ ...base, marketingConsent: false }),
      false,
    );
    assert.equal(
      isMarketingSendAllowed({
        ...base,
        marketingUnsubscribedAt: '2026-07-21T00:00:00.000Z',
      }),
      false,
    );
    assert.equal(
      isMarketingSendAllowed({
        ...base,
        emailDeliveryStatus: EMAIL_DELIVERY.HARD_BOUNCED,
      }),
      false,
    );
    assert.equal(
      isMarketingSendAllowed({
        ...base,
        emailDeliveryStatus: EMAIL_DELIVERY.COMPLAINED,
      }),
      false,
    );
  });
});

describe('classifySesBounce', () => {
  it('treats permanent bounces as hard and transient as soft', () => {
    assert.equal(
      classifySesBounce({ bounceType: 'Permanent', bounceSubType: 'General' })
        .permanent,
      true,
    );
    assert.equal(
      classifySesBounce({ bounceType: 'Transient', bounceSubType: 'MailboxFull' })
        .permanent,
      false,
    );
  });
});

describe('buildRawMimeEmail list-unsubscribe headers', () => {
  it('includes RFC 8058 headers when a one-click URL is provided', () => {
    const raw = buildRawMimeEmail({
      mailFrom: '"Pradeep Kumar L | Classpath" <no-reply@classpath.in>',
      to: 'reader@example.com',
      subject: 'Hello',
      text: 'Hello',
      html: '<p>Hello</p>',
      replyTo: 'pradeep@classpath.in',
      listUnsubscribeUrl:
        'https://api.example.com/marketing-consents/one-click/token',
    }).toString('utf8');
    assert.match(
      raw,
      /List-Unsubscribe: <https:\/\/api\.example\.com\/marketing-consents\/one-click\/token>/,
    );
    assert.match(raw, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
  });
});

describe('processSesEvent', () => {
  it('hard-bounces, soft-bounces, complaints, and unknown recipients', async () => {
    const calls = [];
    const dynamo = {
      send: async (command) => {
        calls.push(command.input);
        if (command.input.Key.email === 'missing@example.com') {
          const error = new Error('missing');
          error.name = 'ConditionalCheckFailedException';
          throw error;
        }
      },
    };

    const hard = await processSesEvent(
      {
        'detail-type': 'Email Bounce',
        detail: {
          eventType: 'Bounce',
          mail: { messageId: 'm1' },
          bounce: {
            bounceType: 'Permanent',
            bounceSubType: 'General',
            bouncedRecipients: [
              { emailAddress: 'hard@example.com', diagnosticCode: '550' },
              { emailAddress: 'missing@example.com' },
            ],
          },
        },
      },
      {
        dynamo,
        UpdateCommand: class {
          constructor(input) {
            this.input = input;
          }
        },
        tableName: 'Leads',
        now: '2026-07-25T00:00:00.000Z',
      },
    );
    assert.equal(hard.processed, 1);
    assert.equal(
      calls[0].ExpressionAttributeValues[':status'],
      EMAIL_DELIVERY.HARD_BOUNCED,
    );

    calls.length = 0;
    const soft = await processSesEvent(
      {
        detail: {
          eventType: 'Bounce',
          mail: { messageId: 'm2' },
          bounce: {
            bounceType: 'Transient',
            bounceSubType: 'MailboxFull',
            bouncedRecipients: [{ emailAddress: 'soft@example.com' }],
          },
        },
      },
      {
        dynamo,
        UpdateCommand: class {
          constructor(input) {
            this.input = input;
          }
        },
        tableName: 'Leads',
        now: '2026-07-25T00:00:00.000Z',
      },
    );
    assert.equal(soft.processed, 1);
    assert.match(calls[0].UpdateExpression, /lastSoftBounceAt/);

    calls.length = 0;
    const complaint = await processSesEvent(
      {
        detail: {
          eventType: 'Complaint',
          mail: { messageId: 'm3' },
          complaint: {
            complainedRecipients: [{ emailAddress: 'spam@example.com' }],
          },
        },
      },
      {
        dynamo,
        UpdateCommand: class {
          constructor(input) {
            this.input = input;
          }
        },
        tableName: 'Leads',
        now: '2026-07-25T00:00:00.000Z',
      },
    );
    assert.equal(complaint.processed, 1);
    assert.equal(
      calls[0].ExpressionAttributeValues[':status'],
      EMAIL_DELIVERY.COMPLAINED,
    );
  });

  it('is idempotent for repeated unsubscribe field shapes', () => {
    const first = buildUnsubscribeUpdate({
      now: '2026-07-25T00:00:00.000Z',
      source: 'rfc8058-one-click',
    });
    const second = buildUnsubscribeUpdate({
      now: '2026-07-26T00:00:00.000Z',
      source: 'rfc8058-one-click',
    });
    assert.match(first.UpdateExpression, /if_not_exists\(marketingUnsubscribedAt/);
    assert.match(second.UpdateExpression, /if_not_exists\(marketingUnsubscribedAt/);
  });
});
