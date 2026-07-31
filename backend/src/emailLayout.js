/**
 * Shared transactional email layout helpers.
 * Keep customer emails consistent in structure, spacing, and tone.
 */

const BOOK_FULL_TITLE = 'Modern Java - The Mindset Shift';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrapTransactionalEmail = (innerHtml) =>
  `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a2332;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
            <tr>
              <td>
                ${innerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

const emailHeadline = (text) =>
  `<p style="margin:0 0 8px;font-size:20px;line-height:1.35;font-weight:700;color:#1a2332;">${escapeHtml(text)}</p>`;

const emailParagraph = (html, margin = '0 0 20px') =>
  `<p style="margin:${margin};font-size:15px;line-height:1.55;color:#445066;">${html}</p>`;

const emailSmallParagraph = (html, margin = '0 0 8px') =>
  `<p style="margin:${margin};font-size:14px;line-height:1.55;color:#445066;">${html}</p>`;

const emailButton = ({ href, label, bgcolor = '#1a56db' }) => `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
                  <tr>
                    <td align="center" bgcolor="${bgcolor}" style="border-radius:8px;">
                      <a href="${escapeHtml(href)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        ${escapeHtml(label)}
                      </a>
                    </td>
                  </tr>
                </table>`;

const emailButtonRow = (buttons) => {
  const cells = buttons
    .map(
      (button, index) => `
                    ${
                      index > 0
                        ? `<td width="12" style="font-size:0;line-height:0;">&nbsp;</td>`
                        : ''
                    }
                    <td align="center" bgcolor="${button.bgcolor || '#1a56db'}" style="border-radius:8px;">
                      <a href="${escapeHtml(button.href)}"
                         style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                        ${escapeHtml(button.label)}
                      </a>
                    </td>`,
    )
    .join('');

  return `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    ${cells}
                  </tr>
                </table>`;
};

const emailCallout = ({ label, value, note }) => `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background:#f4f6f8;border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <p style="margin:0 0 4px;font-size:12px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:#667085;font-weight:700;">
                        ${escapeHtml(label)}
                      </p>
                      <p style="margin:0 0 8px;font-size:16px;line-height:1.4;font-weight:700;color:#1a2332;">
                        ${escapeHtml(value)}
                      </p>
                      ${
                        note
                          ? `<p style="margin:0;font-size:13px;line-height:1.5;color:#445066;">${escapeHtml(note)}</p>`
                          : ''
                      }
                    </td>
                  </tr>
                </table>`;

const emailSiteLink = (siteUrl) => `
                <p style="margin:16px 0 0;font-size:15px;line-height:1.55;">
                  <a href="${escapeHtml(siteUrl)}" style="color:#1a56db;font-weight:600;text-decoration:none;">
                    Visit the Modern Java website →
                  </a>
                </p>`;

const INSTAGRAM_URL = 'https://www.instagram.com/classpath_publications/';

const INSTAGRAM_FOLLOW_LINES = [
  'Follow Classpath Publications on Instagram for updates and reader highlights:',
  INSTAGRAM_URL,
];

/** Plain-text Instagram follow closer for customer emails. */
const emailInstagramFollowText = () => INSTAGRAM_FOLLOW_LINES.join('\n');

const emailInstagramFollow = (margin = '16px 0 0') =>
  `<p style="margin:${margin};font-size:15px;line-height:1.55;color:#445066;">
                  Follow Classpath Publications on Instagram for updates and reader highlights:<br/>
                  <a href="${escapeHtml(INSTAGRAM_URL)}" style="color:#1a56db;font-weight:600;text-decoration:none;">Follow on Instagram →</a>
                </p>`;

const emailClosing = (text = 'Thank you again — happy learning!') =>
  `<p style="margin:28px 0 0;font-size:15px;line-height:1.55;color:#1a2332;">${escapeHtml(text)}</p>`;

const emailMutedNote = (html, margin = '24px 0 0') =>
  `<p style="margin:${margin};font-size:13px;line-height:1.5;color:#667085;">${html}</p>`;

const emailBulletList = (items) => {
  const rows = items
    .map(
      (item) => `
                  <tr>
                    <td valign="top" style="padding:0 0 8px;width:18px;color:#1a56db;font-size:15px;line-height:1.55;">•</td>
                    <td style="padding:0 0 8px;font-size:15px;line-height:1.55;color:#445066;">${escapeHtml(item)}</td>
                  </tr>`,
    )
    .join('');

  return `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                  ${rows}
                </table>`;
};

module.exports = {
  BOOK_FULL_TITLE,
  INSTAGRAM_URL,
  escapeHtml,
  wrapTransactionalEmail,
  emailHeadline,
  emailParagraph,
  emailSmallParagraph,
  emailButton,
  emailButtonRow,
  emailCallout,
  emailSiteLink,
  emailInstagramFollowText,
  emailInstagramFollow,
  emailClosing,
  emailMutedNote,
  emailBulletList,
};
