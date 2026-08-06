/**
 * Social DRM for the digital PDF:
 * 1) Insert a personalized license page before the cover
 * 2) Stamp a license footer on every page except the cover (and the license page)
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
 * Manning-style footer copy (no order id).
 * @param {{ customerName?: string, customerEmail: string }} license
 */
function buildLicenseFooterText(license) {
  const customerEmail = normalizeText(license.customerEmail);
  if (!customerEmail) {
    throw new Error('customerEmail is required to stamp the license footer');
  }
  const customerName = normalizeText(license.customerName, 'Valued reader');
  return `Licensed to ${customerName} <${customerEmail}> · Personal use only — do not redistribute`;
}

const drawWrappedLines = (page, font, lines, { x, startY, size, color, maxWidth, lineGap }) => {
  let y = startY;
  for (const line of lines) {
    if (!line) {
      y -= lineGap * 0.6;
      continue;
    }
    const words = String(line).split(' ');
    let row = '';
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && row) {
        page.drawText(row, { x, y, size, font, color });
        y -= lineGap;
        row = word;
      } else {
        row = next;
      }
    }
    if (row) {
      page.drawText(row, { x, y, size, font, color });
      y -= lineGap;
    }
  }
  return y;
};

/**
 * Draw footer on selected pages of an already-open PDFDocument.
 * @param {import('pdf-lib').PDFDocument} doc
 * @param {string} footer
 * @param {{ skipPageIndexes?: Set<number>|number[] }} [options]
 */
async function applyFooterToPages(doc, footer, options = {}) {
  const skip = new Set(
    Array.isArray(options.skipPageIndexes)
      ? options.skipPageIndexes
      : [...(options.skipPageIndexes || [])],
  );
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 7;
  const color = rgb(0.35, 0.38, 0.42);
  const pageCount = doc.getPageCount();

  for (let i = 0; i < pageCount; i += 1) {
    if (skip.has(i)) continue;
    const page = doc.getPage(i);
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(footer, size);
    const x = Math.max(24, (width - textWidth) / 2);
    page.drawText(footer, {
      x,
      y: 14,
      size,
      font,
      color,
    });
  }
}

/**
 * Stamp footer on master pages, skipping the cover (page index 0).
 * @param {Uint8Array|Buffer} masterPdfBytes
 * @param {{ customerName?: string, customerEmail: string }} license
 * @returns {Promise<Uint8Array>}
 */
async function stampLicenseFooter(masterPdfBytes, license) {
  const footer = buildLicenseFooterText(license);
  const doc = await PDFDocument.load(masterPdfBytes, {
    updateMetadata: false,
  });
  // Cover is page 0 in the master book PDF — leave it unmarked.
  await applyFooterToPages(doc, footer, { skipPageIndexes: [0] });
  return doc.save({ useObjectStreams: false });
}

/**
 * Full social-DRM package:
 * - page 1: personalized license page
 * - page 2: original cover (no footer)
 * - remaining pages: original content + license footer
 *
 * @param {Uint8Array|Buffer} masterPdfBytes
 * @param {{ customerName?: string, customerEmail: string, appOrderId?: string, year?: number }} license
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
  const footer = buildLicenseFooterText(license);

  const master = await PDFDocument.load(masterPdfBytes, {
    updateMetadata: false,
  });
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  const firstPage = master.getPageCount() > 0 ? master.getPage(0) : null;
  const width = firstPage ? firstPage.getWidth() : 612;
  const height = firstPage ? firstPage.getHeight() : 792;
  const licensePage = out.addPage([width, height]);

  const marginX = 54;
  let y = height - 72;
  const titleColor = rgb(0.12, 0.16, 0.22);
  const bodyColor = rgb(0.27, 0.31, 0.38);

  licensePage.drawText('Licensed digital edition', {
    x: marginX,
    y,
    size: 22,
    font: fontBold,
    color: titleColor,
  });
  y -= 28;
  licensePage.drawText(`This copy of ${BOOK_TITLE} is licensed to:`, {
    x: marginX,
    y,
    size: 12,
    font,
    color: titleColor,
  });
  y -= 22;
  licensePage.drawText(customerName, {
    x: marginX,
    y,
    size: 14,
    font: fontBold,
    color: titleColor,
  });
  y -= 18;
  licensePage.drawText(customerEmail, {
    x: marginX,
    y,
    size: 14,
    font: fontBold,
    color: titleColor,
  });
  y -= 18;
  licensePage.drawText(`Order ID: ${appOrderId}`, {
    x: marginX,
    y,
    size: 12,
    font: fontBold,
    color: titleColor,
  });
  y -= 28;

  drawWrappedLines(
    licensePage,
    font,
    [
      'It is for your personal use only. You may keep it on your own devices and make personal backups.',
      '',
      'Please do not share, upload, publish, or redistribute this file (or substantial parts of it), including posting it to shared drives, forums, or messaging groups. Unauthorized distribution may violate copyright law and the terms of your purchase.',
      '',
      `If you need a fresh download link, or if this file was shared with you in error, contact us at ${SUPPORT_EMAIL}. Quote your Order ID so we can help quickly.`,
      '',
      `© ${year} Pradeep Kumar L / Classpath Publications. All rights reserved.`,
    ],
    {
      x: marginX,
      startY: y,
      size: 11,
      color: bodyColor,
      maxWidth: width - marginX * 2,
      lineGap: 15,
    },
  );

  const copied = await out.copyPages(master, master.getPageIndices());
  for (const page of copied) {
    out.addPage(page);
  }

  // Skip license page (0) and cover (1). Footer starts on the first content page.
  await applyFooterToPages(out, footer, { skipPageIndexes: [0, 1] });

  return out.save({ useObjectStreams: false });
}

function licensedPdfObjectKey(appOrderId) {
  const id = normalizeText(appOrderId, 'unknown').replace(/[^\w.-]+/g, '_');
  return `digital/orders/${id}/modern-java-licensed.pdf`;
}

module.exports = {
  BOOK_TITLE,
  SUPPORT_EMAIL,
  buildLicenseFooterText,
  insertLicensePage,
  stampLicenseFooter,
  licensedPdfObjectKey,
};
