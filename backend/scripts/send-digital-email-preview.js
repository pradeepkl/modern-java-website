#!/usr/bin/env node
/**
 * One-off preview of the digital confirmation email (local template copy).
 * Usage: node backend/scripts/send-digital-email-preview.js [to-email]
 */
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const TO = process.argv[2] || 'pradeep.kumar44@gmail.com';
const MAIL_FROM = 'no-reply@classpath.in';
const REPLY_TO = 'pradeep@classpath.in';
const SITE_URL = 'https://modern-java.classpath.in';
const ORDER_ID = 'MJ-D-PREVIEW01';
const INVOICE_NUMBER = 'INV-26-27-18';
const PDF_URL = `${SITE_URL}/#formats`;
const EPUB_URL = `${SITE_URL}/#formats`;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const text = [
  'Thank you for purchasing Modern Java - The Mindset Shift.',
  '',
  'Your DRM-free digital edition is ready. Download and save your files soon — these secure links remain valid for 7 days.',
  '',
  `Download PDF: ${PDF_URL}`,
  `Download ePub: ${EPUB_URL}`,
  '',
  `Your invoice ${INVOICE_NUMBER} is attached to this email.`,
  '',
  `Order ID: ${ORDER_ID}`,
  'Please include this Order ID in any future communication about your purchase.',
  '',
  'You will receive access to revised editions at this email address.',
  `If a download link expires before you have saved the files, contact ${REPLY_TO}.`,
  '',
  `Visit the Modern Java website: ${SITE_URL}`,
  '',
  'Thank you again — happy learning!',
  '',
  '(Preview email — download links point to the website, not signed CloudFront URLs.)',
].join('\n');

const html = `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a2332;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:20px;line-height:1.35;font-weight:700;color:#1a2332;">
                  Thank you for your purchase
                </p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#445066;">
                  Your DRM-free copy of <strong style="color:#1a2332;">Modern Java - The Mindset Shift</strong>
                  is ready. Download and save your files soon — these secure links remain valid for
                  <strong>7 days</strong>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" bgcolor="#1a56db" style="border-radius:8px;">
                      <a href="${escapeHtml(PDF_URL)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Download PDF
                      </a>
                    </td>
                    <td width="12" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td align="center" bgcolor="#0f6b5c" style="border-radius:8px;">
                      <a href="${escapeHtml(EPUB_URL)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        Download ePub
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#445066;">
                  Your invoice <strong>${escapeHtml(INVOICE_NUMBER)}</strong> is attached to this email.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background:#f4f6f8;border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 4px;font-size:12px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:#667085;font-weight:700;">
                        Order ID
                      </p>
                      <p style="margin:0 0 8px;font-size:16px;line-height:1.4;font-weight:700;color:#1a2332;">
                        ${escapeHtml(ORDER_ID)}
                      </p>
                      <p style="margin:0;font-size:13px;line-height:1.5;color:#445066;">
                        Please include this Order ID in any future communication about your purchase.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#445066;">
                  You will receive access to revised editions at this email address.
                  If a download link expires before you have saved the files, contact
                  <a href="mailto:${escapeHtml(REPLY_TO)}" style="color:#1a56db;text-decoration:none;">${escapeHtml(REPLY_TO)}</a>.
                </p>
                <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">
                  <a href="${escapeHtml(SITE_URL)}" style="color:#1a56db;font-weight:600;text-decoration:none;">
                    Visit the Modern Java website →
                  </a>
                </p>
                <p style="margin:28px 0 0;font-size:15px;line-height:1.55;color:#1a2332;">
                  Thank you again — happy learning!
                </p>
                <p style="margin:20px 0 0;font-size:12px;line-height:1.45;color:#98a2b3;">
                  Preview email — download buttons link to the website, not live signed downloads. No invoice PDF attached.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

(async () => {
  const ses = new SESClient({ region: process.env.SES_REGION || 'us-east-1' });
  await ses.send(
    new SendEmailCommand({
      Source: MAIL_FROM,
      ReplyToAddresses: [REPLY_TO],
      Destination: { ToAddresses: [TO] },
      Message: {
        Subject: {
          Data: '[Preview] Your Modern Java digital edition is ready',
        },
        Body: {
          Text: { Data: text },
          Html: { Data: html },
        },
      },
    }),
  );
  console.log(`Sent digital confirmation preview to ${TO}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
