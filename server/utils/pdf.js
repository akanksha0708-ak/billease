// Builds a clean, printable A4 PDF for an invoice using PDFKit.
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Built-in PDF fonts have no ₹ glyph, so amounts are written as "Rs. 1,234.00".
const money = (n) => 'Rs. ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const ACCENT = '#4f46e5';
const MUTED = '#6b7280';

// Returns a Promise<Buffer> so the PDF can be downloaded or attached to an email.
function buildInvoicePdf(inv) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const b = inv.business || {};
    const left = 50;
    const right = doc.page.width - 50;
    const width = right - left;

    // ---- Header: logo + business details on the left, invoice title on the right
    const logoPath = b.logo && path.join(__dirname, '..', 'uploads', b.logo);
    let y = 50;
    if (logoPath && fs.existsSync(logoPath)) {
      doc.image(logoPath, left, y, { fit: [70, 70] });
      y += 80;
    }
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111827').text(b.name || '', left, y);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (b.address) doc.text(b.address, { width: 250 });
    if (b.gstin) doc.text(`GSTIN: ${b.gstin}`);
    if (b.email || b.phone) doc.text([b.email, b.phone].filter(Boolean).join('  |  '));
    const headerBottom = doc.y;

    doc.font('Helvetica-Bold').fontSize(24).fillColor(ACCENT).text('INVOICE', left, 50, { width, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor('#111827')
      .text(`# ${inv.invoice_number}`, { width, align: 'right' })
      .fillColor(MUTED)
      .text(`Issue date: ${date(inv.issue_date)}`, { width, align: 'right' })
      .text(`Due date: ${date(inv.due_date)}`, { width, align: 'right' })
      .text(`Status: ${inv.status.toUpperCase()}`, { width, align: 'right' });

    // ---- Bill to
    y = Math.max(headerBottom, doc.y) + 25;
    const c = inv.customer;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('BILL TO', left, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(c.name);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (c.company) doc.text(c.company);
    if (c.billing_address) doc.text(c.billing_address, { width: 250 });
    if (c.gstin) doc.text(`GSTIN: ${c.gstin}`);
    if (c.email || c.phone) doc.text([c.email, c.phone].filter(Boolean).join('  |  '));

    // ---- Items table
    const cols = [
      { label: '#', x: left, w: 20 },
      { label: 'Item', x: left + 20, w: 190 },
      { label: 'Qty', x: left + 210, w: 50, align: 'right' },
      { label: 'Rate', x: left + 260, w: 75, align: 'right' },
      { label: 'Disc %', x: left + 335, w: 45, align: 'right' },
      { label: 'GST %', x: left + 380, w: 45, align: 'right' },
      { label: 'Amount', x: left + 425, w: width - 425, align: 'right' },
    ];
    const row = (values, yPos, font = 'Helvetica', color = '#111827') => {
      doc.font(font).fontSize(9).fillColor(color);
      cols.forEach((col, i) => doc.text(values[i], col.x + 4, yPos, { width: col.w - 8, align: col.align || 'left' }));
    };

    y = doc.y + 20;
    doc.rect(left, y, width, 20).fill(ACCENT);
    row(cols.map((c) => c.label), y + 6, 'Helvetica-Bold', '#ffffff');
    y += 26;

    inv.items.forEach((item, i) => {
      if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
      row([
        String(i + 1),
        item.description,
        `${item.quantity} ${item.unit || ''}`.trim(),
        money(item.price),
        String(item.discount),
        String(item.tax_rate),
        money(item.amount),
      ], y);
      y = Math.max(doc.y, y + 12) + 6;
      doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor('#e5e7eb').stroke();
    });

    // ---- Totals (right column)
    if (y > doc.page.height - 220) { doc.addPage(); y = 50; }
    y += 10;
    const totalsX = right - 220;
    const line = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor('#111827');
      doc.text(label, totalsX, y, { width: 120 });
      doc.text(value, totalsX + 120, y, { width: 100, align: 'right' });
      y += bold ? 18 : 14;
    };
    line('Subtotal', money(inv.subtotal));
    if (inv.discount_total > 0) line('Discount', '- ' + money(inv.discount_total));
    inv.tax_summary.forEach((t) => line(`GST @ ${t.rate}%`, money(t.tax)));
    doc.moveTo(totalsX, y).lineTo(right, y).strokeColor('#d1d5db').stroke();
    y += 6;
    line('Total', money(inv.total), true);
    line('Amount paid', money(inv.amount_paid));
    line('Balance due', money(inv.balance), true);

    // ---- Notes & terms
    y += 15;
    doc.x = left;
    if (inv.notes) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('NOTES', left, y);
      doc.font('Helvetica').fillColor('#111827').text(inv.notes, { width });
      y = doc.y + 10;
    }
    if (inv.terms) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text('PAYMENT TERMS', left, y);
      doc.font('Helvetica').fillColor('#111827').text(inv.terms, { width });
    }

    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text('Thank you for your business!', left, doc.page.height - 70, { width, align: 'center' });

    doc.end();
  });
}

module.exports = { buildInvoicePdf };
