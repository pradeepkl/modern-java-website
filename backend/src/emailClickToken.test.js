const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createEmailClickToken,
  verifyEmailClickToken,
  buildEmailLinkClickUpdate,
  formatUtcAndIst,
  CLICK_QUERY_PARAM,
} = require('./emailClickToken');

const SECRET = 'test-email-click-secret-value';

describe('emailClickToken', () => {
  it('round-trips email + sequence', () => {
    const token = createEmailClickToken('Reader@Example.com', {
      secret: SECRET,
      sequence: 'sample-continuity',
      issuedAtMs: 1_700_000_000_000,
    });
    const verified = verifyEmailClickToken(token, { secret: SECRET });
    assert.deepEqual(verified, {
      email: 'reader@example.com',
      sequence: 'sample-continuity',
      issuedAtMs: 1_700_000_000_000,
    });
  });

  it('rejects tampered tokens', () => {
    const token = createEmailClickToken('a@b.com', {
      secret: SECRET,
      sequence: 'sample-continuity',
    });
    assert.equal(
      verifyEmailClickToken(`${token}x`, { secret: SECRET }),
      null,
    );
    assert.equal(verifyEmailClickToken(token, { secret: 'other' }), null);
  });

  it('builds continuity first-click update for SAMPLE_REQUESTS_TABLE', () => {
    const update = buildEmailLinkClickUpdate({
      sequence: 'sample-continuity',
      now: '2026-08-07T12:00:00.000Z',
    });
    assert.match(update.UpdateExpression, /sampleContinuityLinkClickedAt/);
    assert.match(update.UpdateExpression, /sampleContinuityLinkClickedAtIst/);
    assert.match(update.UpdateExpression, /lastEmailLinkClickedAtIst/);
    assert.match(update.UpdateExpression, /emailLinkClickCount/);
    assert.equal(update.ExpressionAttributeValues[':seq'], 'sample-continuity');
    assert.equal(
      update.ExpressionAttributeValues[':nowUtc'],
      '2026-08-07T12:00:00.000Z',
    );
    assert.equal(
      update.ExpressionAttributeValues[':nowIst'],
      '2026-08-07 17:30:00 IST',
    );
  });

  it('formats UTC and IST timestamp pairs', () => {
    // 10:00 UTC = 15:30 IST
    assert.deepEqual(formatUtcAndIst('2026-08-07T10:00:00.000Z'), {
      utc: '2026-08-07T10:00:00.000Z',
      ist: '2026-08-07 15:30:00 IST',
    });
  });

  it('exports the query param name used in email CTAs', () => {
    assert.equal(CLICK_QUERY_PARAM, 'mj_click');
  });
});
