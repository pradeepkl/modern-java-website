/**
 * Sample-chapter nurture sequence.
 *
 * Day 0  — transactional chapter-preview email (sent by sample request handler)
 * Day 4  — soft full-book follow-up (enough time to read two chapters)
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
  emailSiteLink,
  emailClosing,
  emailMutedNote,
} = require('./emailLayout');

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
  if (!item) return true;
  if (item.marketingUnsubscribedAt) return true;
  if (item.marketingConsent === false) return true;
  return false;
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

function buildSampleChapterFollowUpEmail({
  siteUrl,
  amazonUrl = 'https://www.amazon.in/dp/B0H6R4334W',
}) {
  const site = normalizeSiteUrl(siteUrl);
  const formatsUrl = `${site}/#formats`;
  const reviewAmazonUrl = normalizeAmazonUrl(amazonUrl);
  const unsubscribeUrl = `${site}/unsubscribe`;

  const text = [
    `Hope you had a chance to explore the ${BOOK_FULL_TITLE} chapter preview.`,
    '',
    `If the first two chapters resonated with you, the full book continues with the same practical, mindset-first approach—covering modern type design, pattern matching, modules, concurrency, collections, streams, and more.`,
    '',
    `Get the full book: ${formatsUrl}`,
    '',
    `Prefer Amazon? Continue here: ${reviewAmazonUrl}`,
    '',
    `Visit the Modern Java website: ${site}`,
    '',
    `Unsubscribe anytime: ${unsubscribeUrl}`,
    '',
    'Thank you again — happy learning!',
  ].join('\n');

  const html = wrapTransactionalEmail(`
                ${emailHeadline('How did you find the first chapters?')}
                ${emailParagraph(
                  `Hope you had a chance to explore the <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong> chapter preview.`,
                )}
                ${emailParagraph(
                  'If the first two chapters resonated with you, the full book continues with the same practical, mindset-first approach—covering modern type design, pattern matching, modules, concurrency, collections, streams, and more.',
                )}
                ${emailButton({
                  href: formatsUrl,
                  label: 'Get the full book',
                })}
                ${emailParagraph(
                  `Prefer Amazon? <a href="${escapeHtml(reviewAmazonUrl)}" style="color:#1a56db;font-weight:600;text-decoration:none;">Continue here →</a>`,
                  '0 0 8px',
                )}
                ${emailSiteLink(site)}
                ${emailMutedNote(
                  `You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#667085;font-weight:600;">unsubscribe</a> anytime.`,
                )}
                ${emailClosing()}
  `);

  return {
    subject: 'How did you find the first chapters?',
    text,
    html,
    unsubscribeUrl,
    formatsUrl,
    amazonUrl: reviewAmazonUrl,
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
  return isPastMinAge(sampleRequestedAtMs(item), now, minAgeDays);
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
