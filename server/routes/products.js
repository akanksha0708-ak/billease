// Products & services: list/search/filter, create, update, delete.
const router = require('express').Router();
const { db } = require('../db');
const { HttpError, requireFields } = require('../utils/http');

function findProduct(userId, id) {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, userId);
  if (!product) throw new HttpError(404, 'Product not found');
  return product;
}

function cleanProduct(body) {
  requireFields(body, ['name', 'price']);
  const price = Number(body.price);
  const taxRate = Number(body.tax_rate || 0);

  if (!['product', 'service'].includes(body.type)) throw new HttpError(400, 'Type must be product or service');
  if (!(price >= 0)) throw new HttpError(400, 'Price must be 0 or more');
  if (!(taxRate >= 0 && taxRate <= 100)) throw new HttpError(400, 'Tax rate must be between 0 and 100');

  return {
    type: body.type,
    name: body.name.trim(),
    description: String(body.description ?? '').trim(),
    price,
    tax_rate: taxRate,
    unit: String(body.unit || (body.type === 'service' ? 'hrs' : 'pcs')).trim(),
  };
}

// GET /api/products?search=abc&type=service
router.get('/', (req, res) => {
  const search = `%${req.query.search || ''}%`;
  const type = req.query.type || null;
  const products = db.prepare(`
    SELECT * FROM products
    WHERE user_id = ? AND (name LIKE ? OR description LIKE ?) AND (? IS NULL OR type = ?)
    ORDER BY name COLLATE NOCASE
  `).all(req.userId, search, search, type, type);
  res.json(products);
});

router.post('/', (req, res) => {
  const p = cleanProduct(req.body);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO products (user_id, type, name, description, price, tax_rate, unit) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.userId, p.type, p.name, p.description, p.price, p.tax_rate, p.unit);
  res.status(201).json(findProduct(req.userId, lastInsertRowid));
});

router.put('/:id', (req, res) => {
  findProduct(req.userId, req.params.id);
  const p = cleanProduct(req.body);
  db.prepare('UPDATE products SET type = ?, name = ?, description = ?, price = ?, tax_rate = ?, unit = ? WHERE id = ?')
    .run(p.type, p.name, p.description, p.price, p.tax_rate, p.unit, req.params.id);
  res.json(findProduct(req.userId, req.params.id));
});

// Deleting a product keeps old invoices intact (their lines store their own copy of the details).
router.delete('/:id', (req, res) => {
  findProduct(req.userId, req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
