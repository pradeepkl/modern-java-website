/**
 * Social DRM: stamp a personalized license footer on every PDF page.
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

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

/**
 * @param {Uint8Array|Buffer} masterPdfBytes
 * @param {{ customerName?: string, customerEmail: string, appOrderId?: string }} license
 * @returns {Promise<Uint8Array>}
 */
async function insertLicensePage(masterPdfBytes, license) {
  // Kept name for call-site compatibility; implementation is every-page footer.
  return stampLicenseFooter(masterPdfBytes, license);
}

/**
 * @param {Uint8Array|Buffer} masterPdfBytes
 * @param {{ customerName?: string, customerEmail: string }} license
 * @returns {Promise<Uint8Array>}
 */
async function stampLicenseFooter(masterPdfBytes, license) {
  const footer = buildLicenseFooterText(license);
  const doc = await PDFDocument.load(masterPdfBytes, {
    updateMetadata: false,
  });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pageCount = doc.getPageCount();
  const size = 7;
  const color = rgb(0.35, 0.38, 0.42);

  for (let i = 0; i < pageCount; i += 1) {
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

  return doc.save({ useObjectStreams: false });
}

function licensedPdfObjectKey(appOrderId) {
  const id = normalizeText(appOrderId, 'unknown').replace(/[^\w.-]+/g, '_');
  return `digital/orders/${id}/modern-java-licensed.pdf`;
}

module.exports = {
  buildLicenseFooterText,
  insertLicensePage,
  stampLicenseFooter,
  licensedPdfObjectKey,
};
