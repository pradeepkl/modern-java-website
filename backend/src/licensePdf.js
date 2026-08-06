/**
 * Social DRM: prepend a personalized license page to the master PDF.
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const BOOK_TITLE = 'Modern Java: The Mindset Shift';
const SUPPORT_EMAIL = 'pradeep@classpath.in';

const normalizeText = (value, fallback = '') => {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
};

/**
 * @param {Uint8Array|Buffer} masterPdfBytes
 * @param {{ customerName?: string, customerEmail: string, appOrderId: string, year?: number }} license
 * @returns {Promise<Uint8Array>}
 */
async function insertLicensePage(masterPdfBytes, license) {
  const customerEmail = normalizeText(license.customerEmail);
  if (!customerEmail) {
    throw new Error('customerEmail is required to stamp the license page');
  }
  const customerName = normalizeText(license.customerName, 'Valued reader');
  const appOrderId = normalizeText(license.appOrderId, 'UNKNOWN');
  const year = Number(license.year) || new Date().getUTCFullYear();

  const master = await PDFDocument.load(masterPdfBytes, {
    updateMetadata: false,
  });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  // Match first content page size when possible; fall back to US Letter.
  const firstPage = master.getPageCount() > 0 ? master.getPage(0) : null;
  const width = firstPage ? firstPage.getWidth() : 612;
  const height = firstPage ? firstPage.getHeight() : 792;
  const page = out.addPage([width, height]);

  const marginX = 54;
  let y = height - 72;
  const draw = (text, { size = 12, bold = false, color = rgb(0.12, 0.16, 0.22), gap = 18 } = {}) => {
    page.drawText(text, {
      x: marginX,
      y,
      size,
      font: bold ? fontBold : font,
      color,
      maxWidth: width - marginX * 2,
      lineHeight: size * 1.35,
    });
    y -= gap;
  };

  draw('Licensed digital edition', { size: 22, bold: true, gap: 28 });
  draw(`This copy of ${BOOK_TITLE} is licensed to:`, { size: 12, gap: 20 });
  draw(customerName, { size: 14, bold: true, gap: 16 });
  draw(customerEmail, { size: 14, bold: true, gap: 16 });
  draw(`Order ID: ${appOrderId}`, { size: 12, bold: true, gap: 28 });

  const body = [
    'It is for your personal use only. You may keep it on your own devices and make personal backups.',
    '',
    'Please do not share, upload, publish, or redistribute this file (or substantial parts of it), including posting it to shared drives, forums, or messaging groups. Unauthorized distribution may violate copyright law and the terms of your purchase.',
    '',
    `If you need a fresh download link, or if this file was shared with you in error, contact us at ${SUPPORT_EMAIL}. Quote your Order ID so we can help quickly.`,
    '',
    `© ${year} Pradeep Kumar L / Classpath Publications. All rights reserved.`,
  ];

  for (const line of body) {
    if (!line) {
      y -= 10;
      continue;
    }
    // Simple wrap for long paragraphs
    const maxWidth = width - marginX * 2;
    const words = line.split(' ');
    let row = '';
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (font.widthOfTextAtSize(next, 11) > maxWidth && row) {
        draw(row, { size: 11, gap: 15, color: rgb(0.27, 0.31, 0.38) });
        row = word;
      } else {
        row = next;
      }
    }
    if (row) {
      draw(row, { size: 11, gap: 15, color: rgb(0.27, 0.31, 0.38) });
    }
  }

  const copied = await out.copyPages(master, master.getPageIndices());
  for (const p of copied) {
    out.addPage(p);
  }

  return out.save({ useObjectStreams: false });
}

function licensedPdfObjectKey(appOrderId) {
  const id = normalizeText(appOrderId, 'unknown').replace(/[^\w.-]+/g, '_');
  return `digital/orders/${id}/modern-java-licensed.pdf`;
}

module.exports = {
  BOOK_TITLE,
  SUPPORT_EMAIL,
  insertLicensePage,
  licensedPdfObjectKey,
};
