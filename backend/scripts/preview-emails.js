#!/usr/bin/env node
/**
 * Local HTML gallery of customer transactional emails.
 * Writes public/email-preview.html for Vite to serve.
 *
 * Usage:
 *   node backend/scripts/preview-emails.js
 *   open http://127.0.0.1:5173/email-preview.html
 */
const { writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { buildWelcomeEmail } = require('../src/marketingConsent');
const {
  buildAmazonReviewFollowUpEmail,
  buildAmazonEducationEmail,
} = require('../src/marketingConsent');
const { buildConfirmationEmail } = require('../src/paperbackWaitlist');
const {
  buildSampleChapterFollowUpEmail,
  buildSampleEducationEmail,
  buildSampleReminderEmail,
} = require('../src/sampleChapterFollowUp');
const {
  escapeHtml,
  BOOK_FULL_TITLE,
  wrapTransactionalEmail,
  emailHeadline,
  emailParagraph,
  emailSmallParagraph,
  emailButton,
  emailButtonRow,
  emailCallout,
  emailSiteLink,
  emailClosing,
  emailMutedNote,
} = require('../src/emailLayout');

const SITE = 'https://modern-java.classpath.in';
const AMAZON = 'https://www.amazon.in/dp/B0H6R4334W';
const REPLY = 'pradeep@classpath.in';

const chapterPreview = (() => {
  const url = `${SITE}/#chapter-preview`;
  const marketingLine =
    'You also asked to receive occasional Modern Java articles and book updates. Unsubscribe anytime: ' +
    `${SITE}/unsubscribe`;
  const html = wrapTransactionalEmail(`
                ${emailHeadline('Your chapter preview is ready')}
                ${emailParagraph(
                  `Thank you for your interest in <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong>. Your free preview includes the first two chapters.`,
                )}
                ${emailParagraph(
                  'Download and save the file soon — this secure link remains valid for <strong>2 days</strong>.',
                )}
                ${emailButton({ href: url, label: 'Download PDF' })}
                ${emailSiteLink(SITE)}
                ${emailMutedNote(escapeHtml(marketingLine))}
                ${emailClosing()}
  `);
  return {
    id: 'chapter-preview',
    label: '1. Chapter preview',
    subject: 'Your Modern Java chapter preview is ready',
    html,
  };
})();

const digital = (() => {
  const pdfUrl = `${SITE}/#formats`;
  const epubUrl = `${SITE}/#formats`;
  const html = wrapTransactionalEmail(`
                ${emailHeadline('Thank you for your purchase')}
                ${emailParagraph(
                  `Your DRM-free copy of <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong> is ready. Download and save your files soon — these secure links remain valid for <strong>7 days</strong>.`,
                )}
                ${emailButtonRow([
                  { href: pdfUrl, label: 'Download PDF', bgcolor: '#1a56db' },
                  { href: epubUrl, label: 'Download ePub', bgcolor: '#0f6b5c' },
                ])}
                ${emailSmallParagraph(
                  'Your invoice <strong>INV-26-27-18</strong> is attached to this email.',
                  '0 0 20px',
                )}
                ${emailCallout({
                  label: 'Order ID',
                  value: 'MJ-D-PREVIEW01',
                  note: 'Please quote this Order ID in any communication about your purchase.',
                })}
                ${emailSmallParagraph(
                  `We’ll notify you at this email address when revised editions become available. If a download link expires before you have saved the files, contact <a href="mailto:${escapeHtml(REPLY)}" style="color:#1a56db;text-decoration:none;">${escapeHtml(REPLY)}</a>.`,
                )}
                ${emailSiteLink(SITE)}
                ${emailClosing()}
  `);
  return {
    id: 'digital',
    label: '2. Digital purchase',
    subject: 'Your Modern Java digital edition is ready',
    html,
  };
})();

const paperback = (() => {
  const html = wrapTransactionalEmail(`
                ${emailHeadline('Thank you for your purchase')}
                ${emailParagraph(
                  `Your <strong style="color:#1a2332;">${escapeHtml(BOOK_FULL_TITLE)}</strong> paperback order is confirmed. Payment was successful, and we’ll prepare your order for shipment.`,
                )}
                ${emailParagraph(
                  'We’ll email you again when your order has been shipped.',
                )}
                ${emailCallout({
                  label: 'Order ID',
                  value: 'MJ-P-PREVIEW01',
                  note: 'Please quote this Order ID in any communication about your purchase.',
                })}
                ${emailSmallParagraph(
                  '<strong style="color:#1a2332;">Ship to:</strong> Pradeep Kumar<br/>123 Example Street<br/>Bengaluru, Karnataka - 560001<br/>India',
                  '0 0 12px',
                )}
                ${emailSmallParagraph(
                  '<strong style="color:#1a2332;">Quantity:</strong> 1 &nbsp;·&nbsp; <strong style="color:#1a2332;">Amount:</strong> ₹899',
                  '0 0 12px',
                )}
                ${emailSmallParagraph(
                  'Your invoice <strong>INV-26-27-18</strong> is attached to this email.',
                  '0 0 20px',
                )}
                ${emailSiteLink(SITE)}
                ${emailClosing('Thank you for your order — happy learning!')}
  `);
  return {
    id: 'paperback',
    label: '3. Paperback purchase',
    subject: 'Your Modern Java paperback order is confirmed',
    html,
  };
})();

const waitlist = buildConfirmationEmail({
  name: 'Pradeep',
  siteUrl: SITE,
});
const welcome = buildWelcomeEmail({ siteUrl: SITE });
const review = buildAmazonReviewFollowUpEmail({
  siteUrl: SITE,
  amazonUrl: AMAZON,
  // name is optional — Amazon exit usually has email only → greets with "Hi,"
});
const reviewNamed = buildAmazonReviewFollowUpEmail({
  siteUrl: SITE,
  amazonUrl: AMAZON,
  name: 'Pradeep',
});
const sampleFollowUp = buildSampleChapterFollowUpEmail({
  siteUrl: SITE,
  amazonUrl: AMAZON,
});
const sampleEducation = buildSampleEducationEmail({ siteUrl: SITE });
const sampleReminder = buildSampleReminderEmail({
  siteUrl: SITE,
  amazonUrl: AMAZON,
});
const amazonEducation = buildAmazonEducationEmail({
  siteUrl: SITE,
  amazonUrl: AMAZON,
});
const amazonEducationNamed = buildAmazonEducationEmail({
  siteUrl: SITE,
  amazonUrl: AMAZON,
  name: 'Pradeep',
});

const emails = [
  chapterPreview,
  digital,
  paperback,
  {
    id: 'priority-list',
    label: '4. Paperback priority list',
    subject: waitlist.subject,
    html: waitlist.html,
  },
  {
    id: 'welcome',
    label: '5. Classpath Reader List welcome',
    subject: welcome.subject,
    html: welcome.html,
  },
  {
    id: 'review-followup',
    label: '6. Amazon buying-intent follow-up (day 7) — Hi,',
    subject: review.subject,
    html: review.html,
  },
  {
    id: 'review-followup-named',
    label: '6b. Same email with name variable — Hi Pradeep,',
    subject: reviewNamed.subject,
    html: reviewNamed.html,
  },
  {
    id: 'sample-followup',
    label: '7. Sample chapter nurture (day 4)',
    subject: sampleFollowUp.subject,
    html: sampleFollowUp.html,
  },
  {
    id: 'sample-education',
    label: '8. Sample chapter education (day 10)',
    subject: sampleEducation.subject,
    html: sampleEducation.html,
  },
  {
    id: 'sample-reminder',
    label: '9. Sample chapter final reminder (day 18)',
    subject: sampleReminder.subject,
    html: sampleReminder.html,
  },
  {
    id: 'amazon-education',
    label: '10. Amazon education + soft review (day 21) — Hi,',
    subject: amazonEducation.subject,
    html: amazonEducation.html,
  },
  {
    id: 'amazon-education-named',
    label: '10b. Same email with name — Hi Pradeep,',
    subject: amazonEducationNamed.subject,
    html: amazonEducationNamed.html,
  },
];

const nav = emails
  .map(
    (email) =>
      `<a href="#${email.id}">${escapeHtml(email.label)}</a>`,
  )
  .join(' · ');

const sections = emails
  .map(
    (email) => `
    <section id="${email.id}" class="email-block">
      <div class="meta">
        <h2>${escapeHtml(email.label)}</h2>
        <p><strong>Subject:</strong> ${escapeHtml(email.subject)}</p>
      </div>
      <iframe
        title="${escapeHtml(email.label)}"
        srcdoc="${escapeHtml(email.html)}"
      ></iframe>
    </section>`,
  )
  .join('\n');

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Modern Java email preview</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #e8ecf1;
      color: #1a2332;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 16px 20px;
      background: #0b1f44;
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,.15);
    }
    header h1 { margin: 0 0 8px; font-size: 1.15rem; }
    header p { margin: 0 0 10px; opacity: .85; font-size: .9rem; }
    header a { color: #9fc3ff; text-decoration: none; font-size: .85rem; }
    header a:hover { text-decoration: underline; }
    main { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
    .email-block { margin-bottom: 36px; }
    .meta {
      margin-bottom: 10px;
      padding: 12px 14px;
      background: #fff;
      border-radius: 10px;
      border: 1px solid #d5dde8;
    }
    .meta h2 { margin: 0 0 6px; font-size: 1rem; }
    .meta p { margin: 0; font-size: .9rem; color: #445066; }
    iframe {
      width: 100%;
      height: 640px;
      border: 0;
      border-radius: 12px;
      background: #f4f6f8;
      box-shadow: 0 10px 28px rgba(4, 25, 70, 0.12);
    }
  </style>
</head>
<body>
  <header>
    <h1>Modern Java — email preview (localhost)</h1>
    <p>Generated locally from backend templates. Not linked from the public site.</p>
    <nav>${nav}</nav>
  </header>
  <main>
    ${sections}
  </main>
</body>
</html>
`;

const outPath = resolve(__dirname, '../../public/email-preview.html');
mkdirSync(resolve(__dirname, '../../public'), { recursive: true });
writeFileSync(outPath, page, 'utf8');
console.log(`Wrote ${outPath}`);
console.log('Open http://127.0.0.1:5173/email-preview.html');
