// Shared SQL for reading invoices.
// "overdue" is not stored — it is worked out on every read from the due date,
// so an invoice becomes overdue automatically the day after it is due.
const { db } = require('../db');
const { HttpError } = require('./http');
const { taxSummary } = require('./invoiceCalc');

const INVOICE_LIST_SQL = `
  SELECT
    i.id, i.user_id, i.invoice_number, i.customer_id, c.name AS customer_name,
    i.issue_date, i.due_date, i.subtotal, i.discount_total, i.tax_total, i.total, i.amount_paid,
    ROUND(i.total - i.amount_paid, 2) AS balance,
    CASE
      WHEN i.status = 'sent' AND i.due_date < date('now', 'localtime') THEN 'overdue'
      ELSE i.status
    END AS status,
    CASE
      WHEN i.amount_paid <= 0 THEN 'unpaid'
      WHEN i.amount_paid < i.total THEN 'partial'
      ELSE 'paid'
    END AS payment_status
  FROM invoices i
  JOIN customers c ON c.id = i.customer_id
`;

// Everything needed to show, print or email one invoice.
function getInvoiceDetails(userId, id) {
  const summary = db.prepare(`SELECT * FROM (${INVOICE_LIST_SQL}) WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!summary) throw new HttpError(404, 'Invoice not found');

  const extra = db.prepare('SELECT notes, terms FROM invoices WHERE id = ?').get(id);
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id').all(id);
  const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC, id DESC').all(id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(summary.customer_id);
  const business = db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);

  return { ...summary, ...extra, items, payments, customer, business, tax_summary: taxSummary(items) };
}

module.exports = { INVOICE_LIST_SQL, getInvoiceDetails };
