/**
 * Sample-chapter nurture follow-up.
 *
 * Delay: 3 days after last preview request.
 * Marketing rationale: short lead magnets (sample chapters / whitepapers) are
 * typically followed up on day 3 — enough time to read, still within the warm
 * interest window, and just after the usual 2-day download-link expiry.
 *
 * Suppression: site purchasers, prior send, unsubscribe / withdrawn consent.
 * Amazon-direct purchases cannot be detected unless the buyer email is known.
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

const SAMPLE_FOLLOWUP_DAYS = 3;

function buildSampleChapterFollowUpEmail({
  siteUrl,
  amazonUrl = 'https://www.amazon.in/dp/B0H6R4334W',
}) {
  const site = String(siteUrl || 'https://modern-java.classpath.in').replace(
    /\/$/,
    '',
  );
  const formatsUrl = `${site}/#formats`;
  const reviewAmazonUrl = String(
    amazonUrl || 'https://www.amazon.in/dp/B0H6R4334W',
  ).trim();
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
 * Whether a sample-request lead is due for the chapter-preview nurture email.
 * @param {object} item SAMPLE_REQUESTS_TABLE row
 * @param {{ now?: Date, minAgeDays?: number, hasPurchased?: boolean }} [options]
 */
function isEligibleForSampleChapterFollowUp(
  item,
  { now = new Date(), minAgeDays = SAMPLE_FOLLOWUP_DAYS, hasPurchased = false } = {},
) {
  if (!item || !item.email) {
    return false;
  }
  if (hasPurchased) {
    return false;
  }
  if (item.sampleFollowUpEmailSentAt) {
    return false;
  }
  // Promotional nurture: skip unsubscribed or withdrawn marketing consent.
  if (item.marketingUnsubscribedAt) {
    return false;
  }
  if (item.marketingConsent === false) {
    return false;
  }
  // Prefer last request so a fresh re-download resets the nurture clock.
  const requestedAt = Date.parse(
    item.lastRequestedAt || item.firstRequestedAt || '',
  );
  if (!Number.isFinite(requestedAt)) {
    return false;
  }
  const minAgeMs = Math.max(0, Number(minAgeDays) || 0) * 24 * 60 * 60 * 1000;
  return requestedAt <= now.getTime() - minAgeMs;
}

module.exports = {
  SAMPLE_FOLLOWUP_DAYS,
  buildSampleChapterFollowUpEmail,
  isEligibleForSampleChapterFollowUp,
};
