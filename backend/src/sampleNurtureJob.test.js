const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  STEPS,
  resolveDueStep,
  resolveForcedStep,
} = require('./sampleNurtureJob');

describe('resolveDueStep', () => {
  const now = new Date('2026-08-07T12:00:00.000Z');

  it('selects continuity at day 4 when consented and not purchased', () => {
    const step = resolveDueStep(
      {
        email: 'a@b.com',
        lastRequestedAt: '2026-08-03T12:00:00.000Z',
        marketingConsent: true,
      },
      { now },
    );
    assert.equal(step, STEPS.continuity);
  });

  it('selects education after continuity when age >= 10', () => {
    const step = resolveDueStep(
      {
        email: 'a@b.com',
        lastRequestedAt: '2026-07-28T12:00:00.000Z',
        sampleContinuityEmailSentAt: '2026-08-01T12:00:00.000Z',
        marketingConsent: true,
      },
      { now },
    );
    assert.equal(step, STEPS.education);
  });

  it('selects reminder after education when age >= 18', () => {
    const step = resolveDueStep(
      {
        email: 'a@b.com',
        lastRequestedAt: '2026-07-20T12:00:00.000Z',
        sampleContinuityEmailSentAt: '2026-07-24T12:00:00.000Z',
        sampleEducationEmailSentAt: '2026-07-30T12:00:00.000Z',
        marketingConsent: true,
      },
      { now },
    );
    assert.equal(step, STEPS.reminder);
  });

  it('returns null when marketing consent is inactive', () => {
    const step = resolveDueStep(
      {
        email: 'a@b.com',
        lastRequestedAt: '2026-08-01T12:00:00.000Z',
        marketingConsent: false,
      },
      { now },
    );
    assert.equal(step, null);
  });
});

describe('resolveForcedStep', () => {
  it('walks the unsent chain', () => {
    assert.equal(resolveForcedStep({ email: 'a@b.com' }), STEPS.continuity);
    assert.equal(
      resolveForcedStep({
        email: 'a@b.com',
        sampleContinuityEmailSentAt: 'x',
      }),
      STEPS.education,
    );
    assert.equal(
      resolveForcedStep({
        email: 'a@b.com',
        sampleContinuityEmailSentAt: 'x',
        sampleEducationEmailSentAt: 'y',
      }),
      STEPS.reminder,
    );
  });
});
