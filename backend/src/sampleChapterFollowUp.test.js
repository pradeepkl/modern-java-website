const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SAMPLE_FOLLOWUP_DAYS,
  SAMPLE_EDUCATION_DAYS,
  SAMPLE_REMINDER_DAYS,
  buildSampleChapterFollowUpEmail,
  buildSampleEducationEmail,
  buildSampleReminderEmail,
  isEligibleForSampleChapterFollowUp,
  isEligibleForSampleEducationEmail,
  isEligibleForSampleReminderEmail,
} = require('./sampleChapterFollowUp');

describe('sample nurture delays', () => {
  it('uses the trust-first sample cadence (4 / 10 / 18)', () => {
    assert.equal(SAMPLE_FOLLOWUP_DAYS, 4);
    assert.equal(SAMPLE_EDUCATION_DAYS, 10);
    assert.equal(SAMPLE_REMINDER_DAYS, 18);
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

describe('buildSampleEducationEmail', () => {
  it('teaches philosophy with a soft continue-reading CTA', () => {
    const email = buildSampleEducationEmail({
      siteUrl: 'https://modern-java.classpath.in',
    });
    assert.equal(
      email.subject,
      'Why Modern Java focuses on mindset instead of features',
    );
    assert.match(email.text, /mindset instead of features/);
    assert.match(email.text, /Continue reading:/);
    assert.match(email.html, /Continue reading →/);
    assert.doesNotMatch(email.text, /discount|coupon|must buy|limited time/i);
  });
});

describe('buildSampleReminderEmail', () => {
  it('is a final gentle format reminder, then stops selling', () => {
    const email = buildSampleReminderEmail({
      siteUrl: 'https://modern-java.classpath.in',
      amazonUrl: 'https://www.amazon.in/dp/B0H6R4334W',
    });
    assert.equal(email.subject, 'Still thinking about Modern Java?');
    assert.match(email.text, /available formats/);
    assert.match(email.text, /last purchase reminder/);
    assert.match(email.html, /See available formats/);
    assert.doesNotMatch(email.text, /discount|coupon|limited time/i);
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
        { ...base, lastRequestedAt: '2026-07-21T12:00:00.000Z' },
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
          lastRequestedAt: '2026-07-21T12:00:00.000Z',
        },
        { now },
      ),
      false,
    );
  });
});

describe('isEligibleForSampleEducationEmail', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const base = {
    email: 'reader@example.com',
    lastRequestedAt: '2026-07-14T12:00:00.000Z',
    sampleFollowUpEmailSentAt: '2026-07-18T12:00:00.000Z',
  };

  it('requires day-4 send, age, and no prior education send', () => {
    assert.equal(isEligibleForSampleEducationEmail(base, { now }), true);
    assert.equal(
      isEligibleForSampleEducationEmail(
        { ...base, sampleFollowUpEmailSentAt: undefined },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleEducationEmail(
        { ...base, sampleEducationEmailSentAt: '2026-07-20T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleEducationEmail(base, { now, hasPurchased: true }),
      false,
    );
    assert.equal(
      isEligibleForSampleEducationEmail(
        { ...base, lastRequestedAt: '2026-07-16T12:00:00.000Z' },
        { now },
      ),
      false,
    );
  });
});

describe('isEligibleForSampleReminderEmail', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const base = {
    email: 'reader@example.com',
    lastRequestedAt: '2026-07-06T12:00:00.000Z',
    sampleFollowUpEmailSentAt: '2026-07-10T12:00:00.000Z',
    sampleEducationEmailSentAt: '2026-07-16T12:00:00.000Z',
  };

  it('requires day-10 send, age, and no prior reminder', () => {
    assert.equal(isEligibleForSampleReminderEmail(base, { now }), true);
    assert.equal(
      isEligibleForSampleReminderEmail(
        { ...base, sampleEducationEmailSentAt: undefined },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleReminderEmail(
        { ...base, sampleReminderEmailSentAt: '2026-07-22T12:00:00.000Z' },
        { now },
      ),
      false,
    );
    assert.equal(
      isEligibleForSampleReminderEmail(base, { now, hasPurchased: true }),
      false,
    );
  });
});
