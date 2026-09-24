// Full payment history across all invoices.
const router = require('express').Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const payments = db.prepare(`
    SELECT p.*, i.invoice_number, c.name AS customer_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN customers c ON c.id = i.customer_id
    WHERE i.user_id = ?
    ORDER BY p.date DESC, p.id DESC
  `).all(req.userId);
  res.json(payments);
});

module.exports = router;
