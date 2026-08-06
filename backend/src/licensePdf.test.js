const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { insertLicensePage, licensedPdfObjectKey } = require('./licensePdf');

async function tinyMasterPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Cover', { x: 40, y: 500, size: 24, font });
  return doc.save();
}

describe('licensedPdfObjectKey', () => {
  it('scopes under digital/orders', () => {
    assert.equal(
      licensedPdfObjectKey('MJ-D-0ADE8689'),
      'digital/orders/MJ-D-0ADE8689/modern-java-licensed.pdf',
    );
  });
});

describe('insertLicensePage', () => {
  it('prepends a license page before existing content', async () => {
    const master = await tinyMasterPdf();
    const stamped = await insertLicensePage(master, {
      customerName: 'Pradeep Kumar',
      customerEmail: 'pradeep.kumar44@gmail.com',
      appOrderId: 'MJ-D-TEST01',
      year: 2026,
    });
    const doc = await PDFDocument.load(stamped);
    assert.equal(doc.getPageCount(), 2);
    // Smoke: bytes grew and remain a valid PDF header
    assert.ok(stamped.byteLength > master.byteLength);
    assert.equal(Buffer.from(stamped.slice(0, 4)).toString('utf8'), '%PDF');
  });

  it('requires email', async () => {
    const master = await tinyMasterPdf();
    await assert.rejects(
      () =>
        insertLicensePage(master, {
          customerName: 'X',
          customerEmail: '',
          appOrderId: 'MJ-D-1',
        }),
      /customerEmail/,
    );
  });
});
