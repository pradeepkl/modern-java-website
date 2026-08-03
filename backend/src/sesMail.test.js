const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveBccAddresses,
  sendEmail,
  EMAIL_CATEGORY,
  buildRawMimeEmail,
} = require('./sesMail');

describe('resolveBccAddresses', () => {
  const previous = {
    MAIL_BCC_EMAIL: process.env.MAIL_BCC_EMAIL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  };

  beforeEach(() => {
    delete process.env.MAIL_BCC_EMAIL;
    delete process.env.ADMIN_EMAIL;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults to pradeep@classpath.in when env is unset', () => {
    assert.deepEqual(resolveBccAddresses(undefined, 'buyer@example.com'), [
      'pradeep@classpath.in',
    ]);
  });

  it('prefers MAIL_BCC_EMAIL over ADMIN_EMAIL', () => {
    process.env.ADMIN_EMAIL = 'admin@classpath.in';
    process.env.MAIL_BCC_EMAIL = 'archive@classpath.in';
    assert.deepEqual(resolveBccAddresses(undefined, 'buyer@example.com'), [
      'archive@classpath.in',
    ]);
  });

  it('skips BCC when it matches the primary recipient', () => {
    process.env.ADMIN_EMAIL = 'pradeep@classpath.in';
    assert.deepEqual(resolveBccAddresses(undefined, 'pradeep@classpath.in'), []);
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
