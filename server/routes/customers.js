// Customers: list/search, create, update, delete, and view with invoice history.
const router = require('express').Router();
const { db } = require('../db');
const { HttpError, requireFields, validateContact } = require('../utils/http');
const { INVOICE_LIST_SQL } = require('../utils/invoiceQueries');

const FIELDS = ['name', 'email', 'phone', 'company', 'gstin', 'billing_address'];

function findCustomer(userId, id) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND user_id = ?').get(id, userId);
  if (!customer) throw new HttpError(404, 'Customer not found');
  return customer;
}

function cleanCustomer(body) {
  requireFields(body, ['name']);
  validateContact(body);
  const data = Object.fromEntries(FIELDS.map((f) => [f, String(body[f] ?? '').trim()]));
  data.gstin = data.gstin.toUpperCase();
  return data;
}

// GET /api/customers?search=abc  — list with invoice totals for each customer
router.get('/', (req, res) => {
  const search = `%${req.query.search || ''}%`;
  const customers = db.prepare(`
    SELECT c.*,
      COUNT(i.id)                      AS invoice_count,
      COALESCE(SUM(i.total), 0)        AS total_billed,
      COALESCE(SUM(i.total - i.amount_paid), 0) AS balance_due
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'draft'
    WHERE c.user_id = ?
      AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company LIKE ?)
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `).all(req.userId, search, search, search, search);
  res.json(customers);
});

// GET /api/customers/:id — details + invoice history + purchase (item) history
router.get('/:id', (req, res) => {
  const customer = findCustomer(req.userId, req.params.id);
  const invoices = db.prepare(`SELECT * FROM (${INVOICE_LIST_SQL}) WHERE customer_id = ? ORDER BY issue_date DESC, id DESC`).all(customer.id);
  const purchases = db.prepare(`
    SELECT ii.description, ii.unit, SUM(ii.quantity) AS quantity, SUM(ii.amount) AS amount, MAX(i.issue_date) AS last_purchased
    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.customer_id = ? AND i.status != 'draft'
    GROUP BY ii.description, ii.unit
    ORDER BY amount DESC
  `).all(customer.id);
  res.json({ ...customer, invoices, purchases });
});

router.post('/', (req, res) => {
  const c = cleanCustomer(req.body);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO customers (user_id, name, email, phone, company, gstin, billing_address) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.userId, c.name, c.email, c.phone, c.company, c.gstin, c.billing_address);
  res.status(201).json(findCustomer(req.userId, lastInsertRowid));
});

router.put('/:id', (req, res) => {
  findCustomer(req.userId, req.params.id);
  const c = cleanCustomer(req.body);
  db.prepare(`
    UPDATE customers SET name = ?, email = ?, phone = ?, company = ?, gstin = ?, billing_address = ? WHERE id = ?
  `).run(c.name, c.email, c.phone, c.company, c.gstin, c.billing_address, req.params.id);
  res.json(findCustomer(req.userId, req.params.id));
});

router.delete('/:id', (req, res) => {
  findCustomer(req.userId, req.params.id);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM invoices WHERE customer_id = ?').get(req.params.id);
  if (count > 0) throw new HttpError(409, `This customer has ${count} invoice(s). Delete those first.`);

  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
