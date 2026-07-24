const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SAMPLE_FOLLOWUP_DAYS,
  buildSampleChapterFollowUpEmail,
  isEligibleForSampleChapterFollowUp,
} = require('./sampleChapterFollowUp');

describe('SAMPLE_FOLLOWUP_DAYS', () => {
  it('uses the 3-day short lead-magnet nurture window', () => {
    assert.equal(SAMPLE_FOLLOWUP_DAYS, 3);
  });
});

describe('buildSampleChapterFollowUpEmail', () => {
  it('soft-sells the full book with website primary and Amazon secondary', () => {
    const email = buildSampleChapterFollowUpEmail({
      siteUrl: 'https://modern-java.classpath.in',
      amazonUrl: 'https://www.amazon.in/dp/B0H6R4334W',
    });
    assert.equal(email.subject, 'How did you find the first chapters?');
    assert.match(email.text, /explore the Modern Java - The Mindset Shift chapter preview/);
    assert.match(email.text, /modern type design, pattern matching, modules/);
    assert.match(email.text, /Get the full book/);
    assert.match(email.text, /Prefer Amazon\? Continue here:/);
    assert.match(email.text, /https:\/\/modern-java\.classpath\.in\/#formats/);
    assert.match(email.text, /https:\/\/www\.amazon\.in\/dp\/B0H6R4334W/);
    assert.match(email.html, /Get the full book/);
    assert.match(email.html, /Prefer Amazon\?/);
    assert.match(email.html, /happy learning/i);
    assert.doesNotMatch(email.text, /companion ideas|treating you/i);
    assert.doesNotMatch(email.text, /discount|coupon|reward|must buy/i);
  });
});

describe('isEligibleForSampleChapterFollowUp', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const base = {
    email: 'reader@example.com',
    lastRequestedAt: '2026-07-20T12:00:00.000Z',
  };

  it('requires age, no prior send, and no purchase', () => {
    assert.equal(isEligibleForSampleChapterFollowUp(base, { now }), true);
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        { ...base, lastRequestedAt: '2026-07-23T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        { ...base, sampleFollowUpEmailSentAt: '2026-07-23T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleChapterFollowUp(base, { now, hasPurchased: true }),
      false,
    );
  });

  it('skips unsubscribed or withdrawn marketing consent', () => {
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        { ...base, marketingUnsubscribedAt: '2026-07-21T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        { ...base, marketingConsent: false },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        { ...base, marketingConsent: true },
        { now },
      ),
      true,
    );
  });

  it('uses lastRequestedAt over firstRequestedAt when both exist', () => {
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        {
          email: 'reader@example.com',
          firstRequestedAt: '2026-07-01T12:00:00.000Z',
          lastRequestedAt: '2026-07-23T12:00:00.000Z',
        },
        { now },
      ),
      false,
    );
  });
});
