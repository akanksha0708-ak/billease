// Invoices: search/filter, create, edit, delete, duplicate, status, payments, PDF and email.
const router = require('express').Router();
const { db, transaction } = require('../db');
const { HttpError, requireFields, isEmail } = require('../utils/http');
const { calculateInvoice, round } = require('../utils/invoiceCalc');
const { INVOICE_LIST_SQL, getInvoiceDetails } = require('../utils/invoiceQueries');
const { buildInvoicePdf } = require('../utils/pdf');
const { sendMail } = require('../utils/mailer');

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque', 'Other'];
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

// ---------- helpers ----------

function findInvoice(userId, id) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(id, userId);
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  return invoice;
}

// Validates the invoice form and returns clean data with calculated totals.
function cleanInvoice(userId, body) {
  requireFields(body, ['customer_id', 'issue_date', 'due_date']);

  const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?').get(body.customer_id, userId);
  if (!customer) throw new HttpError(400, 'Please choose a valid customer');
  if (body.due_date < body.issue_date) throw new HttpError(400, 'Due date cannot be before the issue date');

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new HttpError(400, 'Add at least one item to the invoice');

  items.forEach((item, i) => {
    const n = i + 1;
    if (!String(item.description || '').trim()) throw new HttpError(400, `Item ${n}: description is required`);
    if (!(Number(item.quantity) > 0)) throw new HttpError(400, `Item ${n}: quantity must be more than 0`);
    if (!(Number(item.price) >= 0)) throw new HttpError(400, `Item ${n}: price must be 0 or more`);
    for (const field of ['discount', 'tax_rate']) {
      const v = Number(item[field] || 0);
      if (!(v >= 0 && v <= 100)) throw new HttpError(400, `Item ${n}: ${field.replace('_', ' ')} must be between 0 and 100`);
    }
  });

  return {
    customer_id: customer.id,
    issue_date: body.issue_date,
    due_date: body.due_date,
    notes: String(body.notes ?? '').trim(),
    terms: String(body.terms ?? '').trim(),
    ...calculateInvoice(items),
  };
}

function insertItems(invoiceId, lines) {
  const insert = db.prepare(`
    INSERT INTO invoice_items (invoice_id, product_id, description, unit, quantity, price, discount, tax_rate, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const l of lines) {
    insert.run(invoiceId, l.product_id || null, l.description.trim(), l.unit || '', l.quantity, l.price, l.discount, l.tax_rate, l.amount);
  }
}

// Creates a new invoice with the next unique number (INV-0001, INV-0002, ...).
// The counter never goes down, so numbers are never reused even after deletes.
function createInvoice(userId, data, status = 'draft') {
  return transaction(() => {
    db.prepare('UPDATE users SET invoice_counter = invoice_counter + 1 WHERE id = ?').run(userId);
    const { invoice_counter } = db.prepare('SELECT invoice_counter FROM users WHERE id = ?').get(userId);
    const number = `INV-${String(invoice_counter).padStart(4, '0')}`;

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO invoices (user_id, customer_id, invoice_number, issue_date, due_date, status, notes, terms,
                            subtotal, discount_total, tax_total, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, data.customer_id, number, data.issue_date, data.due_date, status, data.notes, data.terms,
      data.subtotal, data.discount_total, data.tax_total, data.total);

    insertItems(lastInsertRowid, data.lines);
    return lastInsertRowid;
  });
}

// Keeps amount_paid and the Paid status in line with the recorded payments.
function syncPayments(invoiceId) {
  const { paid } = db.prepare('SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ?').get(invoiceId);
  const inv = db.prepare('SELECT status, total FROM invoices WHERE id = ?').get(invoiceId);

  let status = inv.status;
  if (inv.total > 0 && paid >= inv.total) status = 'paid';
  else if (status === 'paid') status = 'sent';
  else if (paid > 0 && status === 'draft') status = 'sent'; // receiving money means it was sent

  db.prepare('UPDATE invoices SET amount_paid = ?, status = ? WHERE id = ?').run(round(paid), status, invoiceId);
}

// ---------- routes ----------

// GET /api/invoices?search=&customer_id=&status=&payment_status=&from=&to=&min=&max=
router.get('/', (req, res) => {
  const q = req.query;
  const where = ['user_id = ?'];
  const params = [req.userId];

  if (q.search) {
    where.push('(invoice_number LIKE ? OR customer_name LIKE ?)');
    params.push(`%${q.search}%`, `%${q.search}%`);
  }
  if (q.customer_id) { where.push('customer_id = ?'); params.push(q.customer_id); }
  if (q.status) { where.push('status = ?'); params.push(q.status); }
  if (q.payment_status) { where.push('payment_status = ?'); params.push(q.payment_status); }
  if (q.from) { where.push('issue_date >= ?'); params.push(q.from); }
  if (q.to) { where.push('issue_date <= ?'); params.push(q.to); }
  if (q.min) { where.push('total >= ?'); params.push(Number(q.min)); }
  if (q.max) { where.push('total <= ?'); params.push(Number(q.max)); }

  const invoices = db.prepare(`
    SELECT * FROM (${INVOICE_LIST_SQL}) WHERE ${where.join(' AND ')} ORDER BY issue_date DESC, id DESC
  `).all(...params);
  res.json(invoices);
});

router.get('/:id', (req, res) => {
  res.json(getInvoiceDetails(req.userId, req.params.id));
});

router.post('/', (req, res) => {
  const data = cleanInvoice(req.userId, req.body);
  const status = req.body.status === 'sent' ? 'sent' : 'draft';
  const id = createInvoice(req.userId, data, status);
  res.status(201).json(getInvoiceDetails(req.userId, id));
});

router.put('/:id', (req, res) => {
  const invoice = findInvoice(req.userId, req.params.id);
  const data = cleanInvoice(req.userId, req.body);
  if (data.total < invoice.amount_paid) {
    throw new HttpError(400, 'The new total is less than the amount already paid. Remove a payment first.');
  }

  transaction(() => {
    db.prepare(`
      UPDATE invoices SET customer_id = ?, issue_date = ?, due_date = ?, notes = ?, terms = ?,
             subtotal = ?, discount_total = ?, tax_total = ?, total = ?
      WHERE id = ?
    `).run(data.customer_id, data.issue_date, data.due_date, data.notes, data.terms,
      data.subtotal, data.discount_total, data.tax_total, data.total, invoice.id);

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice.id);
    insertItems(invoice.id, data.lines);
    syncPayments(invoice.id);
  });
  res.json(getInvoiceDetails(req.userId, invoice.id));
});

router.delete('/:id', (req, res) => {
  const invoice = findInvoice(req.userId, req.params.id);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(invoice.id); // items & payments cascade
  res.status(204).end();
});

// Copies an invoice into a new Draft with a new number and today's date.
router.post('/:id/duplicate', (req, res) => {
  const original = getInvoiceDetails(req.userId, req.params.id);

  const days = Math.round((new Date(original.due_date) - new Date(original.issue_date)) / 86400000);
  const due = new Date();
  due.setDate(due.getDate() + days);

  const data = {
    customer_id: original.customer_id,
    issue_date: today(),
    due_date: due.toLocaleDateString('en-CA'),
    notes: original.notes,
    terms: original.terms,
    ...calculateInvoice(original.items),
  };
  const id = createInvoice(req.userId, data, 'draft');
  res.status(201).json(getInvoiceDetails(req.userId, id));
});

// Manually switch between Draft and Sent. (Paid is set automatically by payments,
// Overdue automatically by the due date.)
router.patch('/:id/status', (req, res) => {
  const invoice = findInvoice(req.userId, req.params.id);
  const { status } = req.body;

  if (!['draft', 'sent'].includes(status)) throw new HttpError(400, 'Status can only be set to draft or sent');
  if (invoice.status === 'paid') throw new HttpError(400, 'This invoice is already paid');
  if (status === 'draft' && invoice.amount_paid > 0) throw new HttpError(400, 'An invoice with payments cannot go back to draft');

  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, invoice.id);
  res.json(getInvoiceDetails(req.userId, invoice.id));
});

// ---------- payments ----------

router.post('/:id/payments', (req, res) => {
  const invoice = findInvoice(req.userId, req.params.id);
  requireFields(req.body, ['amount', 'date', 'method']);

  const amount = round(Number(req.body.amount));
  const remaining = round(invoice.total - invoice.amount_paid);

  if (!(amount > 0)) throw new HttpError(400, 'Payment amount must be more than 0');
  if (amount > remaining) throw new HttpError(400, `Payment cannot be more than the balance due (${remaining.toFixed(2)})`);
  if (!PAYMENT_METHODS.includes(req.body.method)) throw new HttpError(400, 'Please choose a valid payment method');

  transaction(() => {
    db.prepare('INSERT INTO payments (invoice_id, amount, date, method, note) VALUES (?, ?, ?, ?, ?)')
      .run(invoice.id, amount, req.body.date, req.body.method, String(req.body.note ?? '').trim());
    syncPayments(invoice.id);
  });
  res.status(201).json(getInvoiceDetails(req.userId, invoice.id));
});

router.delete('/:id/payments/:paymentId', (req, res) => {
  const invoice = findInvoice(req.userId, req.params.id);
  transaction(() => {
    db.prepare('DELETE FROM payments WHERE id = ? AND invoice_id = ?').run(req.params.paymentId, invoice.id);
    syncPayments(invoice.id);
  });
  res.json(getInvoiceDetails(req.userId, invoice.id));
});

// ---------- PDF & email ----------

router.get('/:id/pdf', async (req, res) => {
  const invoice = getInvoiceDetails(req.userId, req.params.id);
  const pdf = await buildInvoicePdf(invoice);
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${invoice.invoice_number}.pdf"`,
  });
  res.send(pdf);
});

router.post('/:id/email', async (req, res) => {
  const invoice = getInvoiceDetails(req.userId, req.params.id);
  const to = String(req.body.to || invoice.customer.email || '').trim();
  if (!isEmail(to)) throw new HttpError(400, 'Please enter a valid recipient email');

  const business = invoice.business;
  const subject = req.body.subject || `Invoice ${invoice.invoice_number} from ${business.name}`;
  const text = req.body.message ||
    `Hi ${invoice.customer.name},\n\nPlease find attached invoice ${invoice.invoice_number} ` +
    `for Rs. ${invoice.balance.toFixed(2)}, due on ${invoice.due_date}.\n\nThank you,\n${business.name}`;

  const pdf = await buildInvoicePdf(invoice);
  let result;
  try {
    result = await sendMail({
      from: `"${business.name}" <${business.email || 'no-reply@example.com'}>`,
      replyTo: business.email || undefined,
      to,
      subject,
      text,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdf }],
    });
  } catch (err) {
    console.error('Email failed:', err.message);
    throw new HttpError(502, 'Could not send the email. Please check the email settings and try again.');
  }

  if (invoice.status === 'draft') db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(invoice.id);
  res.json({ message: `Invoice emailed to ${to}`, previewUrl: result.previewUrl });
});

module.exports = router;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
