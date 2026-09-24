// Numbers for the dashboard home page.
const router = require('express').Router();
const { db } = require('../db');
const { INVOICE_LIST_SQL } = require('../utils/invoiceQueries');

router.get('/', (req, res) => {
  const userId = req.userId;
  const list = `SELECT * FROM (${INVOICE_LIST_SQL}) WHERE user_id = ?`;

  // Drafts are not real bills yet, so they are left out of the money totals.
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0)                                           AS total_invoiced,
      COALESCE(SUM(amount_paid), 0)                                     AS total_received,
      COALESCE(SUM(balance), 0)                                         AS outstanding,
      COALESCE(SUM(CASE WHEN status = 'overdue' THEN balance END), 0)   AS overdue_amount
    FROM (${list}) WHERE status != 'draft'
  `).get(userId);

  const statusRows = db.prepare(`SELECT status, COUNT(*) AS count FROM (${list}) GROUP BY status`).all(userId);
  const status_counts = { draft: 0, sent: 0, paid: 0, overdue: 0 };
  statusRows.forEach((r) => { status_counts[r.status] = r.count; });

  // Payments received in each of the last 6 months (months with no payments show as 0).
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const month = d.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM
    const { amount } = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) AS amount
      FROM payments p JOIN invoices i ON i.id = p.invoice_id
      WHERE i.user_id = ? AND substr(p.date, 1, 7) = ?
    `).get(userId, month);
    monthly.push({ month, amount });
  }

  const recent_invoices = db.prepare(`${list} ORDER BY id DESC LIMIT 6`).all(userId);
  const counts = db.prepare(`
    SELECT (SELECT COUNT(*) FROM customers WHERE user_id = ?) AS customers,
           (SELECT COUNT(*) FROM products  WHERE user_id = ?) AS products
  `).get(userId, userId);

  res.json({ ...totals, status_counts, monthly, recent_invoices, ...counts });
});

module.exports = router;
