const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const {
  buildLicenseFooterText,
  stampLicenseFooter,
  insertLicensePage,
  licensedPdfObjectKey,
} = require('./licensePdf');

async function tinyMasterPdf(pageCount = 1) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([400, 600]);
    page.drawText(i === 0 ? 'Cover' : `Page ${i + 1}`, {
      x: 40,
      y: 500,
      size: 24,
      font,
    });
  }
  return doc.save();
}

describe('buildLicenseFooterText', () => {
  it('formats name and email without order id', () => {
    assert.equal(
      buildLicenseFooterText({
        customerName: 'Pradeep',
        customerEmail: 'pradeep.kumar44@gmail.com',
      }),
      'Licensed to Pradeep <pradeep.kumar44@gmail.com> · Personal use only — do not redistribute',
    );
  });
});

describe('licensedPdfObjectKey', () => {
  it('scopes under digital/orders', () => {
    assert.equal(
      licensedPdfObjectKey('MJ-D-0ADE8689'),
      'digital/orders/MJ-D-0ADE8689/modern-java-licensed.pdf',
    );
  });
});

describe('stampLicenseFooter', () => {
  it('keeps page count when skipping the cover', async () => {
    const master = await tinyMasterPdf(3);
    const stamped = await stampLicenseFooter(master, {
      customerName: 'Pradeep',
      customerEmail: 'pradeep.kumar44@gmail.com',
    });
    const doc = await PDFDocument.load(stamped);
    assert.equal(doc.getPageCount(), 3);
    assert.ok(stamped.byteLength >= master.byteLength);
  });

  it('requires email', async () => {
    const master = await tinyMasterPdf();
    await assert.rejects(
      () =>
        stampLicenseFooter(master, {
          customerName: 'X',
          customerEmail: '',
        }),
      /customerEmail/,
    );
  });
});

describe('insertLicensePage', () => {
  it('prepends a license page before the cover', async () => {
    const master = await tinyMasterPdf(2);
    const stamped = await insertLicensePage(master, {
      customerName: 'Pradeep',
      customerEmail: 'pradeep.kumar44@gmail.com',
      appOrderId: 'MJ-D-TEST01',
      year: 2026,
    });
    const doc = await PDFDocument.load(stamped);
    // license + original 2 pages
    assert.equal(doc.getPageCount(), 3);
    assert.ok(stamped.byteLength > master.byteLength);
    assert.equal(Buffer.from(stamped.slice(0, 4)).toString('utf8'), '%PDF');
  });
});
