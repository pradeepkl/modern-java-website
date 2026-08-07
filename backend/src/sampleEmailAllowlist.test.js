const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SAMPLE_EMAIL_ALLOWLIST_MESSAGE,
  CONSUMER_EMAIL_ALLOWLIST_MESSAGE,
  isAllowedSampleEmailDomain,
  emailDomain,
} = require('./sampleEmailAllowlist');

describe('sampleEmailAllowlist', () => {
  it('extracts the domain from an email', () => {
    assert.equal(emailDomain('Reader@Gmail.COM'), 'gmail.com');
    assert.equal(emailDomain('a+tag@yahoo.co.in'), 'yahoo.co.in');
    assert.equal(emailDomain('bad'), '');
  });

  it('allows known consumer vendors', () => {
    for (const email of [
      'you@gmail.com',
      'you@googlemail.com',
      'you@outlook.com',
      'you@hotmail.com',
      'you@live.com',
      'you@yahoo.com',
      'you@yahoo.co.in',
      'you@icloud.com',
      'you@me.com',
      'you@rediffmail.com',
      'You+Preview@Gmail.Com',
    ]) {
      assert.equal(isAllowedSampleEmailDomain(email), true, email);
    }
  });

  it('rejects disposable and corporate domains', () => {
    for (const email of [
      'x@davopa.com',
      'x@fentaoba.com',
      'x@mailinator.com',
      'x@company.com',
      'x@thoughtworks.com',
      'x@gmail.com.evil.example',
      'x@notgmail.com',
      'x@example.com',
    ]) {
      assert.equal(isAllowedSampleEmailDomain(email), false, email);
    }
  });

  it('exposes a clear rejection message', () => {
    assert.match(SAMPLE_EMAIL_ALLOWLIST_MESSAGE, /Gmail/i);
    assert.match(SAMPLE_EMAIL_ALLOWLIST_MESSAGE, /Rediff/i);
    assert.match(CONSUMER_EMAIL_ALLOWLIST_MESSAGE, /Gmail/i);
    assert.match(CONSUMER_EMAIL_ALLOWLIST_MESSAGE, /Rediff/i);
  });
});
