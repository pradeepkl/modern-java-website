/**
 * Sample-chapter nurture sequence.
 *
 * Day 0  — transactional chapter-preview email (sent by sample request handler)
 * Day 4  — exclusive reader voucher (conversion email; site checkout only)
 * Day 10 — educational / philosophy email (not a sales pitch)
 * Day 18 — final gentle purchase reminder, then stop direct selling
 *
 * After Day 18, readers stay on the Classpath Reader List editorial cadence.
 *
 * Suppression: site purchasers, prior send for that step, unsubscribe /
 * withdrawn consent. Amazon-direct purchases cannot be detected unless the
 * buyer email is known.
 */
const {
  escapeHtml,
  BOOK_FULL_TITLE,
  wrapTransactionalEmail,
  emailHeadline,
  emailParagraph,
  emailButton,
  emailCallout,
  emailSiteLink,
  emailInstagramFollowText,
  emailInstagramFollow,
  emailClosing,
  emailMutedNote,
} = require('./emailLayout');
const { isMarketingSendAllowed } = require('./emailDelivery');
const {
  formatExpiryForEmail,
  canIssueVoucherForSample,
} = require('./readerVoucher');

const SAMPLE_FOLLOWUP_DAYS = 4;
const SAMPLE_EDUCATION_DAYS = 10;
const SAMPLE_REMINDER_DAYS = 18;

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || 'https://modern-java.classpath.in').replace(
    /\/$/,
    '',
  );
}

function normalizeAmazonUrl(amazonUrl) {
  return String(amazonUrl || 'https://www.amazon.in/dp/B0H6R4334W').trim();
}

function hasMarketingSuppression(item) {
  return !isMarketingSendAllowed(item);
}

function sampleRequestedAtMs(item) {
  if (!item) return NaN;
  return Date.parse(item.lastRequestedAt || item.firstRequestedAt || '');
}

function isPastMinAge(timestampMs, now, minAgeDays) {
  if (!Number.isFinite(timestampMs)) return false;
  const minAgeMs = Math.max(0, Number(minAgeDays) || 0) * 24 * 60 * 60 * 1000;
  return timestampMs <= now.getTime() - minAgeMs;
}

/**
 * Day 4 — exclusive reader voucher conversion email.
 * Requires voucherCode + pricing; Amazon is not offered (voucher is site-only).
 */
function buildSampleChapterFollowUpEmail({
  siteUrl,
  voucherCode,
  basisAmountInr,
  discountAmountInr,
  payableAmountInr,
  expiresAt,
}) {
  const site = normalizeSiteUrl(siteUrl);
  const formatsUrl = `${site}/#formats`;
  const unsubscribeUrl = `${site}/unsubscribe`;
  const code = String(voucherCode || '').trim().toUpperCase();
  const basis = Number(basisAmountInr);
  const discount = Number(discountAmountInr);
  const payable = Number(payableAmountInr);
  const expiryLabel = formatExpiryForEmail(expiresAt);

  if (!code) {
    throw new Error('voucherCode is required for the Day 4 follow-up email');
  }
  if (![basis, discount, payable].every((n) => Number.isInteger(n) && n > 0)) {
    throw new Error('Voucher pricing amounts must be positive integers');
  }

  const text = [
    `Hope you've had a chance to explore the first two chapters of ${BOOK_FULL_TITLE}.`,
    '',
    `As a thank-you for downloading the sample, here's an exclusive reader benefit for the Classpath digital edition (PDF + ePub).`,
    '',
    `Your personal voucher: ${code}`,
    `₹${basis} → ₹${payable}`,
    `Valid until ${expiryLabel} (UTC).`,
    '',
    'Use this code at website checkout with the same email address you used for the sample. One-time use. Not valid on Amazon.',
    '',
    'The full book continues with the same practical, mindset-first approach—covering modern type design, pattern matching, modules, concurrency, collections, streams, and more.',
    '',
    `Get the full book: ${formatsUrl}`,
    '',
    'Reply to this email if you have questions.',
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    emailInstagramFollowText(),
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline('An exclusive reader offer for you')}
                ${emailParagraph(
                  `Hope you've had a chance to explore the first two chapters of <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong>.`,
                )}
                ${emailParagraph(
                  'As a thank-you for downloading the sample, here\'s an exclusive reader benefit for the Classpath digital edition (PDF + ePub).',
                )}
                ${emailCallout({
                  label: 'Your personal voucher',
                  value: code,
                  note: `₹${basis} → ₹${payable}. Valid until ${expiryLabel} (UTC).`,
                })}
                ${emailParagraph(
                  'Use this code at website checkout with the same email address you used for the sample. One-time use. Not valid on Amazon.',
                )}
                ${emailParagraph(
                  'The full book continues with the same practical, mindset-first approach—covering modern type design, pattern matching, modules, concurrency, collections, streams, and more.',
                )}
                ${emailButton({
                  href: formatsUrl,
                  label: 'Get the full book',
                })}
                ${emailParagraph(
                  'Reply to this email if you have questions.',
                  '0 0 8px',
                )}
                ${emailSiteLink(site)}
                ${emailInstagramFollow()}
                ${emailMutedNote(
                  `You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#667085;font-weight:600;">unsubscribe</a> anytime.`,
                )}
                ${emailClosing()}
  `);

  return {
    subject: 'Your exclusive Modern Java reader offer',
    text,
    html,
    unsubscribeUrl,
    formatsUrl,
    voucherCode: code,
  };
}

/**
 * Day 10 — editorial email about the book’s philosophy.
 * Value first; soft continue-reading CTA at the bottom.
 */
function buildSampleEducationEmail({ siteUrl }) {
  const site = normalizeSiteUrl(siteUrl);
  const formatsUrl = `${site}/#formats`;
  const unsubscribeUrl = `${site}/unsubscribe`;

  const text = [
    `Why ${BOOK_FULL_TITLE} focuses on mindset instead of features`,
    '',
    'Most Java books walk version by version through new language features. That catalog is useful—but it rarely helps when you are designing an API, reviewing a pull request, or deciding how a system should evolve.',
    '',
    'Modern Java is written around a different question: how should an experienced engineer think when using today’s language?',
    '',
    'The preview chapters introduce that shift. The full book continues it—through type design, pattern matching, modules, concurrency, collections, and streams—always with judgment ahead of syntax.',
    '',
    `Continue reading: ${formatsUrl}`,
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    emailInstagramFollowText(),
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline(
                  'Why Modern Java focuses on mindset instead of features',
                )}
                ${emailParagraph(
                  'Most Java books walk version by version through new language features. That catalog is useful—but it rarely helps when you are designing an API, reviewing a pull request, or deciding how a system should evolve.',
                )}
                ${emailParagraph(
                  'Modern Java is written around a different question: how should an experienced engineer think when using today’s language?',
                )}
                ${emailParagraph(
                  'The preview chapters introduce that shift. The full book continues it—through type design, pattern matching, modules, concurrency, collections, and streams—always with judgment ahead of syntax.',
                )}
                ${emailButton({
                  href: formatsUrl,
                  label: 'Continue reading →',
                })}
                ${emailSiteLink(site)}
                ${emailInstagramFollow()}
                ${emailMutedNote(
                  `You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#667085;font-weight:600;">unsubscribe</a> anytime.`,
                )}
                ${emailClosing()}
  `);

  return {
    subject: 'Why Modern Java focuses on mindset instead of features',
    text,
    html,
    unsubscribeUrl,
    formatsUrl,
  };
}

/**
 * Day 18 — last gentle purchase reminder for sample readers.
 * After this, stop direct selling; stay on Reader List cadence only.
 */
function buildSampleReminderEmail({
  siteUrl,
  amazonUrl = 'https://www.amazon.in/dp/B0H6R4334W',
}) {
  const site = normalizeSiteUrl(siteUrl);
  const formatsUrl = `${site}/#formats`;
  const reviewAmazonUrl = normalizeAmazonUrl(amazonUrl);
  const unsubscribeUrl = `${site}/unsubscribe`;

  const text = [
    `Still thinking about ${BOOK_FULL_TITLE}?`,
    '',
    'Here are the available formats if you want to continue when you are ready:',
    '',
    `Classpath (DRM-free digital & paperback): ${formatsUrl}`,
    '',
    `Amazon: ${reviewAmazonUrl}`,
    '',
    'No pressure—this is the last purchase reminder from this sequence. You will still receive occasional Modern Java articles and publishing updates unless you unsubscribe.',
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    emailInstagramFollowText(),
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline('Still thinking about Modern Java?')}
                ${emailParagraph(
                  'Here are the available formats if you want to continue when you are ready:',
                )}
                ${emailButton({
                  href: formatsUrl,
                  label: 'See available formats',
                })}
                ${emailParagraph(
                  `Prefer Amazon? <a href="${escapeHtml(reviewAmazonUrl)}" style="color:#1a56db;font-weight:600;text-decoration:none;">Continue here →</a>`,
                )}
                ${emailParagraph(
                  'No pressure—this is the last purchase reminder from this sequence. You will still receive occasional Modern Java articles and publishing updates unless you unsubscribe.',
                  '0 0 8px',
                )}
                ${emailSiteLink(site)}
                ${emailInstagramFollow()}
                ${emailMutedNote(
                  `You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#667085;font-weight:600;">unsubscribe</a> anytime.`,
                )}
                ${emailClosing()}
  `);

  return {
    subject: 'Still thinking about Modern Java?',
    text,
    html,
    unsubscribeUrl,
    formatsUrl,
    amazonUrl: reviewAmazonUrl,
  };
}

/**
 * Whether a sample-request lead is due for the day-4 chapter-preview nurture.
 * @param {object} item SAMPLE_REQUESTS_TABLE row
 * @param {{ now?: Date, minAgeDays?: number, hasPurchased?: boolean }} [options]
 */
function isEligibleForSampleChapterFollowUp(
  item,
  { now = new Date(), minAgeDays = SAMPLE_FOLLOWUP_DAYS, hasPurchased = false } = {},
) {
  if (!item || !item.email) return false;
  if (hasPurchased) return false;
  if (item.sampleFollowUpEmailSentAt) return false;
  if (hasMarketingSuppression(item)) return false;
  if (!isPastMinAge(sampleRequestedAtMs(item), now, minAgeDays)) return false;
  // Day 4 is the voucher email — skip once the voucher window has closed.
  return canIssueVoucherForSample(item, { now });
}

/**
 * Day 10 educational email — after the soft-sell follow-up, if still not purchased.
 */
function isEligibleForSampleEducationEmail(
  item,
  {
    now = new Date(),
    minAgeDays = SAMPLE_EDUCATION_DAYS,
    hasPurchased = false,
  } = {},
) {
  if (!item || !item.email) return false;
  if (hasPurchased) return false;
  if (!item.sampleFollowUpEmailSentAt) return false;
  if (item.sampleEducationEmailSentAt) return false;
  if (hasMarketingSuppression(item)) return false;
  return isPastMinAge(sampleRequestedAtMs(item), now, minAgeDays);
}

/**
 * Day 18 final reminder — last direct sell in the sample sequence.
 */
function isEligibleForSampleReminderEmail(
  item,
  {
    now = new Date(),
    minAgeDays = SAMPLE_REMINDER_DAYS,
    hasPurchased = false,
  } = {},
) {
  if (!item || !item.email) return false;
  if (hasPurchased) return false;
  if (!item.sampleEducationEmailSentAt) return false;
  if (item.sampleReminderEmailSentAt) return false;
  if (hasMarketingSuppression(item)) return false;
  return isPastMinAge(sampleRequestedAtMs(item), now, minAgeDays);
}

module.exports = {
  SAMPLE_FOLLOWUP_DAYS,
  SAMPLE_EDUCATION_DAYS,
  SAMPLE_REMINDER_DAYS,
  buildSampleChapterFollowUpEmail,
  buildSampleEducationEmail,
  buildSampleReminderEmail,
  isEligibleForSampleChapterFollowUp,
  isEligibleForSampleEducationEmail,
  isEligibleForSampleReminderEmail,
};
