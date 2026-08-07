const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SAMPLE_FOLLOWUP_DAYS,
  SAMPLE_EDUCATION_DAYS,
  SAMPLE_REMINDER_DAYS,
  CONTINUITY_TEASE_ITEMS,
  buildSampleContinuityEmail,
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

describe('buildSampleContinuityEmail', () => {
  it('is a short continuity Email 1 with one formats CTA and a tease', () => {
    const email = buildSampleContinuityEmail({
      siteUrl: 'https://modern-java.classpath.in',
    });
    assert.equal(email.subject, 'After the sample chapters…');
    assert.equal(
      email.formatsUrl,
      'https://modern-java.classpath.in/?section=formats#formats',
    );

    const bodyWords = email.text.split(/\s+/).filter(Boolean).length;
    assert.ok(
      bodyWords >= 350 && bodyWords <= 500,
      `expected ~350–500 words, got ${bodyWords}`,
    );
    assert.equal(CONTINUITY_TEASE_ITEMS.length, 5);
    for (const item of CONTINUITY_TEASE_ITEMS) {
      assert.match(email.text, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(email.text, /Whether you've skimmed them or dug in/);
    assert.match(email.text, /at most two more emails/);
    assert.match(email.text, /See formats & continue reading:/);
    assert.match(email.html, /See formats &amp; continue reading|See formats & continue reading/);
    assert.match(email.html, /\?section=formats#formats/);

    // One primary CTA — no voucher/checkout soft-sell or catalog dump.
    assert.equal(
      (email.html.match(/display:inline-block;padding:14px 28px/g) || []).length,
      1,
    );
    assert.doesNotMatch(email.text, /voucher|discount|checkout|✓|👉/i);
    assert.doesNotMatch(
      email.text,
      /Who this book is for|Composition over Inheritance|Putting It All Together/i,
    );
    assert.doesNotMatch(email.text, /A few days ago/);
  });
});

describe('buildSampleChapterFollowUpEmail', () => {
  it('sends an exclusive reader voucher conversion email (site-only)', () => {
    const email = buildSampleChapterFollowUpEmail({
      siteUrl: 'https://modern-java.classpath.in',
      voucherCode: 'MJ-7X9K-PL42',
      basisAmountInr: 899,
      discountAmountInr: 200,
      payableAmountInr: 699,
      expiresAt: '2026-08-07T10:00:00.000Z',
    });
    assert.equal(email.subject, 'Your exclusive Modern Java reader offer');
    assert.match(email.text, /exclusive reader benefit/);
    assert.match(email.text, /MJ-7X9K-PL42/);
    assert.match(email.text, /₹899 → ₹699/);
    assert.doesNotMatch(email.text, /You save|%|percent/i);
    assert.match(email.text, /not valid on Amazon/i);
    assert.match(email.text, /Reply to this email if you have questions/);
    assert.match(
      email.text,
      /https:\/\/modern-java\.classpath\.in\/\?voucher=MJ-7X9K-PL42&checkout=digital#digital-checkout/,
    );
    assert.doesNotMatch(email.text, /Prefer Amazon|amazon\.in\/dp/i);
    assert.match(email.html, /Your personal voucher/);
    assert.match(email.html, /MJ-7X9K-PL42/);
    assert.match(email.html, /Continue to checkout/);
    assert.match(email.html, /#digital-checkout/);
    assert.match(email.text, /IST/);
    assert.doesNotMatch(email.text, /\(UTC\)/);
    assert.match(email.html, /Follow on Instagram/);
    assert.match(
      email.html,
      /https:\/\/www\.instagram\.com\/classpath_publications\//,
    );
  });

  it('requires voucher fields', () => {
    assert.throws(
      () =>
        buildSampleChapterFollowUpEmail({
          siteUrl: 'https://modern-java.classpath.in',
        }),
      /voucherCode is required/,
    );
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
    marketingConsent: true,
  };

  it('requires age, open voucher window, no prior send, and no purchase', () => {
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

  it('skips leads whose voucher window has already closed', () => {
    assert.equal(
      isEligibleForSampleChapterFollowUp(
        {
          ...base,
          lastRequestedAt: '2026-07-10T12:00:00.000Z',
        },
        { now },
      ),
      false,
    );
  });

  it('skips unsubscribed, withdrawn consent, or non-active delivery', () => {
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
        { ...base, emailDeliveryStatus: 'HARD_BOUNCED' },
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
          marketingConsent: true,
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
    marketingConsent: true,
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
    marketingConsent: true,
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
