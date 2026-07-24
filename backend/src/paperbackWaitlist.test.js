const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateAndNormalizeWaitlistPayload,
  buildCreateItem,
  buildExistingRegistrationUpdate,
  buildConfirmationEmail,
  isConditionalCheckFailed,
  joinPaperbackWaitlist,
  CREATED_MESSAGE,
  ALREADY_REGISTERED_MESSAGE,
} = require('./paperbackWaitlist');

describe('validateAndNormalizeWaitlistPayload', () => {
  it('rejects empty name', () => {
    assert.throws(
      () =>
        validateAndNormalizeWaitlistPayload({
          name: '  ',
          email: 'reader@example.com',
          paperbackConsent: true,
        }),
      /name/i,
    );
  });

  it('rejects invalid email', () => {
    assert.throws(
      () =>
        validateAndNormalizeWaitlistPayload({
          name: 'Pradeep',
          email: 'not-an-email',
          paperbackConsent: true,
        }),
      /email/i,
    );
  });

  it('rejects missing paperback consent', () => {
    assert.throws(
      () =>
        validateAndNormalizeWaitlistPayload({
          name: 'Pradeep',
          email: 'reader@example.com',
          paperbackConsent: false,
        }),
      /consent/i,
    );
  });

  it('normalizes email and keeps city optional', () => {
    const result = validateAndNormalizeWaitlistPayload({
      name: '  Pradeep Kumar  ',
      email: 'Reader@Example.COM',
      paperbackConsent: true,
      promotionalConsent: false,
    });
    assert.equal(result.name, 'Pradeep Kumar');
    assert.equal(result.email, 'reader@example.com');
    assert.equal(result.city, undefined);
    assert.equal(result.promotionalConsent, false);
  });

  it('accepts optional city and promotional consent', () => {
    const result = validateAndNormalizeWaitlistPayload({
      name: 'Pradeep',
      email: 'reader@example.com',
      city: ' Mysuru ',
      paperbackConsent: true,
      promotionalConsent: true,
    });
    assert.equal(result.city, 'Mysuru');
    assert.equal(result.promotionalConsent, true);
  });
});

describe('buildCreateItem', () => {
  it('stores consent timestamps and omits promotionalConsentAt when false', () => {
    const item = buildCreateItem(
      {
        name: 'Pradeep',
        email: 'reader@example.com',
        paperbackConsent: true,
        promotionalConsent: false,
        source: 'pricing_card',
      },
      '2026-07-24T10:00:00.000Z',
    );
    assert.equal(item.paperbackConsent, true);
    assert.equal(item.paperbackConsentAt, '2026-07-24T10:00:00.000Z');
    assert.equal(item.promotionalConsent, false);
    assert.equal(item.promotionalConsentAt, undefined);
    assert.equal(item.status, 'WAITING');
  });
});

describe('buildExistingRegistrationUpdate', () => {
  it('updates name and never weakens consent when promotional is false', () => {
    const update = buildExistingRegistrationUpdate({
      name: 'Updated',
      promotionalConsent: false,
    });
    assert.match(update.UpdateExpression, /#name = :name/);
    assert.equal(update.ExpressionAttributeValues[':name'], 'Updated');
    assert.equal(update.ExpressionAttributeValues[':promotionalConsent'], undefined);
  });

  it('promotes promotionalConsent only when explicitly true', () => {
    const update = buildExistingRegistrationUpdate({
      name: 'Updated',
      promotionalConsent: true,
    });
    assert.match(update.UpdateExpression, /#promotionalConsent = :promotionalConsent/);
    assert.equal(update.ExpressionAttributeValues[':promotionalConsent'], true);
  });
});

describe('buildConfirmationEmail', () => {
  it('includes the visitor name and no-payment wording', () => {
    const email = buildConfirmationEmail({ name: 'Pradeep' });
    assert.match(email.subject, /paperback waitlist/i);
    assert.match(email.text, /Hi Pradeep/);
    assert.match(email.text, /No payment has been collected/);
  });
});

describe('joinPaperbackWaitlist', () => {
  const basePayload = {
    name: 'Pradeep Kumar',
    email: 'Reader@Example.com',
    city: 'Mysuru',
    paperbackConsent: true,
    promotionalConsent: false,
    source: 'pricing_card',
  };

  it('creates a new record with conditional PutItem then attempts email', async () => {
    const calls = { put: 0, update: 0, email: 0 };
    const result = await joinPaperbackWaitlist({
      event: {},
      parseBody: () => ({ json: basePayload }),
      response: (statusCode, body) => ({ statusCode, body }),
      verifyTurnstileCaptcha: async () => {},
      dynamo: {
        send: async (command) => {
          if (command.constructor?.name === 'PutCommand' || command.input?.Item) {
            calls.put += 1;
            assert.equal(command.input.ConditionExpression, 'attribute_not_exists(email)');
            return {};
          }
          throw new Error(`Unexpected command: ${command.constructor?.name}`);
        },
      },
      PutCommand: class PutCommand {
        constructor(input) {
          this.input = input;
        }
      },
      UpdateCommand: class UpdateCommand {
        constructor(input) {
          this.input = input;
        }
      },
      tableName: 'WaitlistTable',
      sendEmail: async () => {
        calls.email += 1;
      },
      notifyAdmin: async () => {},
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.status, 'created');
    assert.equal(result.body.message, CREATED_MESSAGE);
    assert.equal(calls.put, 1);
    assert.equal(calls.update, 0);
    assert.equal(calls.email, 1);
  });

  it('treats ConditionalCheckFailedException as already_registered and updates', async () => {
    const calls = { put: 0, update: 0, email: 0 };
    const result = await joinPaperbackWaitlist({
      event: {},
      parseBody: () => ({ json: basePayload }),
      response: (statusCode, body) => ({ statusCode, body }),
      verifyTurnstileCaptcha: async () => {},
      dynamo: {
        send: async (command) => {
          if (command.input?.Item) {
            calls.put += 1;
            const error = new Error('Conditional check failed');
            error.name = 'ConditionalCheckFailedException';
            throw error;
          }
          if (command.input?.Key) {
            calls.update += 1;
            return {};
          }
          throw new Error('Unexpected command');
        },
      },
      PutCommand: class PutCommand {
        constructor(input) {
          this.input = input;
        }
      },
      UpdateCommand: class UpdateCommand {
        constructor(input) {
          this.input = input;
        }
      },
      tableName: 'WaitlistTable',
      sendEmail: async () => {
        calls.email += 1;
      },
      notifyAdmin: async () => {},
    });

    assert.equal(result.body.status, 'already_registered');
    assert.equal(result.body.message, ALREADY_REGISTERED_MESSAGE);
    assert.equal(calls.put, 1);
    assert.equal(calls.update, 1);
    assert.equal(calls.email, 0);
  });

  it('keeps the registration successful when confirmation email fails', async () => {
    const result = await joinPaperbackWaitlist({
      event: {},
      parseBody: () => ({ json: basePayload }),
      response: (statusCode, body) => ({ statusCode, body }),
      verifyTurnstileCaptcha: async () => {},
      dynamo: {
        send: async () => ({}),
      },
      PutCommand: class PutCommand {
        constructor(input) {
          this.input = input;
        }
      },
      UpdateCommand: class UpdateCommand {
        constructor(input) {
          this.input = input;
        }
      },
      tableName: 'WaitlistTable',
      sendEmail: async () => {
        throw new Error('SES unavailable');
      },
      notifyAdmin: async () => {},
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.status, 'created');
  });

  it('rejects invalid payloads before persistence', async () => {
    let putCalls = 0;
    await assert.rejects(
      () =>
        joinPaperbackWaitlist({
          event: {},
          parseBody: () => ({
            json: { name: '', email: 'bad', paperbackConsent: false },
          }),
          response: (statusCode, body) => ({ statusCode, body }),
          verifyTurnstileCaptcha: async () => {},
          dynamo: {
            send: async () => {
              putCalls += 1;
            },
          },
          PutCommand: class PutCommand {
            constructor(input) {
              this.input = input;
            }
          },
          UpdateCommand: class UpdateCommand {
            constructor(input) {
              this.input = input;
            }
          },
          tableName: 'WaitlistTable',
          sendEmail: async () => {},
        }),
      /name|email|consent/i,
    );
    assert.equal(putCalls, 0);
  });
});

describe('isConditionalCheckFailed', () => {
  it('detects ConditionalCheckFailedException', () => {
    assert.equal(
      isConditionalCheckFailed({ name: 'ConditionalCheckFailedException' }),
      true,
    );
  });
});
