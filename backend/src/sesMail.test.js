const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveBccAddresses,
  sendEmail,
  EMAIL_CATEGORY,
  buildRawMimeEmail,
} = require('./sesMail');

describe('resolveBccAddresses', () => {
  it('defaults to no BCC when omitted', () => {
    assert.deepEqual(resolveBccAddresses(undefined, 'buyer@example.com'), []);
    assert.deepEqual(resolveBccAddresses(null, 'buyer@example.com'), []);
  });

  it('skips BCC when it matches the primary recipient', () => {
    assert.deepEqual(
      resolveBccAddresses('pradeep@classpath.in', 'pradeep@classpath.in'),
      [],
    );
  });

  it('can be disabled with false or an empty list', () => {
    assert.deepEqual(resolveBccAddresses(false, 'buyer@example.com'), []);
    assert.deepEqual(resolveBccAddresses([], 'buyer@example.com'), []);
  });

  it('accepts an explicit list and dedupes', () => {
    assert.deepEqual(
      resolveBccAddresses(
        ['Pradeep@classpath.in', 'pradeep@classpath.in', 'ops@classpath.in'],
        'buyer@example.com',
      ),
      ['pradeep@classpath.in', 'ops@classpath.in'],
    );
  });
});

describe('sendEmail BCC wiring', () => {
  it('omits BccAddresses when bcc is not provided', async () => {
    const calls = [];
    const ses = {
      send: async (command) => {
        calls.push(command);
        return { MessageId: 'msg-0' };
      },
    };

    await sendEmail({
      ses,
      to: 'buyer@example.com',
      subject: 'Sample',
      text: 'Hello',
      category: EMAIL_CATEGORY.TRANSACTIONAL,
      configurationSetName: '',
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].input.Destination, {
      ToAddresses: ['buyer@example.com'],
    });
  });

  it('adds BccAddresses on simple SendEmailCommand', async () => {
    const calls = [];
    const ses = {
      send: async (command) => {
        calls.push(command);
        return { MessageId: 'msg-1' };
      },
    };

    await sendEmail({
      ses,
      to: 'buyer@example.com',
      subject: 'Test',
      text: 'Hello',
      category: EMAIL_CATEGORY.TRANSACTIONAL,
      bcc: 'pradeep@classpath.in',
      configurationSetName: '',
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].input.Destination, {
      ToAddresses: ['buyer@example.com'],
      BccAddresses: ['pradeep@classpath.in'],
    });
  });

  it('adds BCC only to Destinations for raw/attachment sends', async () => {
    const calls = [];
    const ses = {
      send: async (command) => {
        calls.push(command);
        return { MessageId: 'msg-2' };
      },
    };

    await sendEmail({
      ses,
      to: 'buyer@example.com',
      subject: 'Invoice',
      text: 'Attached',
      category: EMAIL_CATEGORY.TRANSACTIONAL,
      bcc: 'pradeep@classpath.in',
      configurationSetName: '',
      attachments: [
        {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('%PDF'),
        },
      ],
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].input.Destinations, [
      'buyer@example.com',
      'pradeep@classpath.in',
    ]);
    const raw = calls[0].input.RawMessage.Data.toString('utf8');
    assert.match(raw, /^To: buyer@example.com/m);
    assert.doesNotMatch(raw, /^Bcc:/m);
  });
});

describe('buildRawMimeEmail stays free of Bcc headers', () => {
  it('only addresses the primary To recipient in MIME', () => {
    const raw = buildRawMimeEmail({
      mailFrom: '"Test" <no-reply@classpath.in>',
      to: 'buyer@example.com',
      subject: 'Hi',
      text: 'Body',
      replyTo: 'pradeep@classpath.in',
    }).toString('utf8');
    assert.match(raw, /^To: buyer@example.com/m);
    assert.doesNotMatch(raw, /^Bcc:/m);
  });
});
