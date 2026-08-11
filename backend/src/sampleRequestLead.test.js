const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  FIRST_LEAD_PUT_CONDITION,
  isFirstSampleLead,
  isConditionalCheckFailed,
  buildSampleRequestItem,
  persistSampleRequestLead,
} = require('./sampleRequestLead');

const consentFields = {
  marketingConsent: false,
  marketingConsentStatus: null,
  marketingConsentAt: null,
  marketingConsentUpdatedAt: null,
  consentVersion: 'modern-java-email-v1',
  marketingConsentSource: null,
};

class FakePutCommand {
  constructor(input) {
    this.input = input;
  }
}

class FakeGetCommand {
  constructor(input) {
    this.input = input;
  }
}

describe('isFirstSampleLead', () => {
  it('treats missing item as first lead', () => {
    assert.equal(isFirstSampleLead(null), true);
    assert.equal(isFirstSampleLead(undefined), true);
  });

  it('uses firstRequestedAt as the primary existing-lead signal', () => {
    assert.equal(
      isFirstSampleLead({ firstRequestedAt: '2026-07-24T17:24:32.382Z' }),
      false,
    );
  });

  it('treats sampleRequestId-only rows as existing leads', () => {
    assert.equal(isFirstSampleLead({ sampleRequestId: 'SR-EXISTING' }), false);
  });

  it('treats marketing-only rows without preview fields as first lead', () => {
    assert.equal(
      isFirstSampleLead({
        email: 'reader@gmail.com',
        marketingConsent: true,
        marketingConsentSource: 'amazon_exit_modal',
      }),
      true,
    );
  });
});

describe('buildSampleRequestItem', () => {
  it('creates first-lead item with requestCount 1', () => {
    const item = buildSampleRequestItem({
      existingItem: null,
      email: 'reader@gmail.com',
      sampleRequestId: 'SR-NEW123',
      now: '2026-08-11T10:00:00.000Z',
      consentFields,
      source: 'sample-chapter-form',
      emailDeliveryActive: 'ACTIVE',
    });
    assert.equal(item.requestCount, 1);
    assert.equal(item.firstRequestedAt, '2026-08-11T10:00:00.000Z');
    assert.equal(item.sampleRequestId, 'SR-NEW123');
  });

  it('increments requestCount and preserves original lead id', () => {
    const item = buildSampleRequestItem({
      existingItem: {
        email: 'reader@gmail.com',
        sampleRequestId: 'SR-ORIG',
        firstRequestedAt: '2026-07-01T00:00:00.000Z',
        requestCount: 3,
      },
      email: 'reader@gmail.com',
      sampleRequestId: 'SR-ORIG',
      now: '2026-08-11T10:00:00.000Z',
      consentFields,
      source: 'sample-chapter-form',
      emailDeliveryActive: 'ACTIVE',
    });
    assert.equal(item.requestCount, 4);
    assert.equal(item.firstRequestedAt, '2026-07-01T00:00:00.000Z');
    assert.equal(item.sampleRequestId, 'SR-ORIG');
  });
});

describe('persistSampleRequestLead', () => {
  it('Test A — first successful preview claims newLead and uses conditional Put', async () => {
    const puts = [];
    const dynamo = {
      send: async (command) => {
        if (command instanceof FakePutCommand) {
          puts.push(command.input);
          return {};
        }
        throw new Error(`unexpected command ${command.constructor.name}`);
      },
    };

    const result = await persistSampleRequestLead({
      existingItem: null,
      email: 'new@gmail.com',
      sampleRequestId: 'SR-NEW123',
      now: '2026-08-11T10:00:00.000Z',
      consentFields,
      source: 'sample-chapter-form',
      emailDeliveryActive: 'ACTIVE',
      tableName: 'SampleRequests',
      dynamo,
      PutCommand: FakePutCommand,
      GetCommand: FakeGetCommand,
    });

    assert.equal(result.newLead, true);
    assert.equal(result.leadEventId, 'SR-NEW123');
    assert.equal(result.requestCount, 1);
    assert.equal(puts.length, 1);
    assert.equal(puts[0].ConditionExpression, FIRST_LEAD_PUT_CONDITION);
    assert.equal(puts[0].Item.sampleRequestId, 'SR-NEW123');
  });

  it('Test B — returning lead after cooldown does not claim newLead', async () => {
    const puts = [];
    const dynamo = {
      send: async (command) => {
        if (command instanceof FakePutCommand) {
          puts.push(command.input);
          return {};
        }
        throw new Error('unexpected');
      },
    };

    const result = await persistSampleRequestLead({
      existingItem: {
        email: 'old@gmail.com',
        sampleRequestId: 'SR-EXISTING',
        firstRequestedAt: '2026-07-01T00:00:00.000Z',
        lastRequestedAt: '2026-08-01T00:00:00.000Z',
        requestCount: 2,
      },
      email: 'old@gmail.com',
      sampleRequestId: 'SR-EXISTING',
      now: '2026-08-11T10:00:00.000Z',
      consentFields,
      source: 'sample-chapter-form',
      emailDeliveryActive: 'ACTIVE',
      tableName: 'SampleRequests',
      dynamo,
      PutCommand: FakePutCommand,
      GetCommand: FakeGetCommand,
    });

    assert.equal(result.newLead, false);
    assert.equal(result.leadEventId, 'SR-EXISTING');
    assert.equal(result.requestCount, 3);
    assert.equal(puts.length, 1);
    assert.equal(puts[0].ConditionExpression, undefined);
  });

  it('Test E — concurrent first requests: loser is not newLead and keeps winner id', async () => {
    let putAttempts = 0;
    const puts = [];
    const dynamo = {
      send: async (command) => {
        if (command instanceof FakePutCommand) {
          putAttempts += 1;
          puts.push(command.input);
          if (putAttempts === 1 && command.input.ConditionExpression) {
            const error = new Error('conditional');
            error.name = 'ConditionalCheckFailedException';
            throw error;
          }
          return {};
        }
        if (command instanceof FakeGetCommand) {
          return {
            Item: {
              email: 'race@gmail.com',
              sampleRequestId: 'SR-WINNER',
              firstRequestedAt: '2026-08-11T09:59:59.000Z',
              requestCount: 1,
            },
          };
        }
        throw new Error('unexpected');
      },
    };

    const result = await persistSampleRequestLead({
      existingItem: null,
      email: 'race@gmail.com',
      sampleRequestId: 'SR-LOSER',
      now: '2026-08-11T10:00:00.000Z',
      consentFields,
      source: 'sample-chapter-form',
      emailDeliveryActive: 'ACTIVE',
      tableName: 'SampleRequests',
      dynamo,
      PutCommand: FakePutCommand,
      GetCommand: FakeGetCommand,
    });

    assert.equal(result.newLead, false);
    assert.equal(result.leadEventId, 'SR-WINNER');
    assert.equal(result.requestCount, 2);
    assert.equal(puts[0].ConditionExpression, FIRST_LEAD_PUT_CONDITION);
    assert.equal(puts[1].ConditionExpression, undefined);
    assert.equal(puts[1].Item.sampleRequestId, 'SR-WINNER');
  });

  it('AC9 — existing multi-request records remain existing leads', async () => {
    const result = await persistSampleRequestLead({
      existingItem: {
        email: 'legacy@gmail.com',
        sampleRequestId: 'SR-EE93723C98DC',
        firstRequestedAt: '2026-07-24T17:24:32.382Z',
        requestCount: 9,
      },
      email: 'legacy@gmail.com',
      sampleRequestId: 'SR-EE93723C98DC',
      now: '2026-08-11T10:00:00.000Z',
      consentFields: { ...consentFields, marketingConsent: true },
      source: 'sample-chapter-form',
      emailDeliveryActive: 'ACTIVE',
      tableName: 'SampleRequests',
      dynamo: {
        send: async () => ({}),
      },
      PutCommand: FakePutCommand,
      GetCommand: FakeGetCommand,
    });

    assert.equal(result.newLead, false);
    assert.equal(result.leadEventId, 'SR-EE93723C98DC');
    assert.equal(result.requestCount, 10);
  });
});

describe('isConditionalCheckFailed', () => {
  it('detects ConditionalCheckFailedException', () => {
    assert.equal(
      isConditionalCheckFailed({ name: 'ConditionalCheckFailedException' }),
      true,
    );
    assert.equal(isConditionalCheckFailed({ name: 'Other' }), false);
  });
});
