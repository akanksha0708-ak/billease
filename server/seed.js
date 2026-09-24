// Fills the database with a demo account and sample data.
// Run with: npm run seed   →   login: demo@billease.in / demo123
const bcrypt = require('bcryptjs');
const { db, transaction } = require('./db');
const { calculateInvoice } = require('./utils/invoiceCalc');

const EMAIL = 'demo@billease.in';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

transaction(() => {
  // Start fresh: remove the old demo account (everything else cascades).
  const old = db.prepare('SELECT id FROM users WHERE email = ?').get(EMAIL);
  if (old) {
    db.prepare('DELETE FROM invoices WHERE user_id = ?').run(old.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(old.id);
  }

  const userId = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run('Aarav Sharma', EMAIL, bcrypt.hashSync('demo123', 10)).lastInsertRowid;

  db.prepare('INSERT INTO businesses (user_id, name, address, gstin, email, phone) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, 'Pixel Craft Studio', '4th Floor, Orchid Towers\nMG Road, Pune, Maharashtra 411001', '27AAPFP1234C1Z5', 'billing@pixelcraft.in', '+91 98765 43210');

  const addCustomer = db.prepare(`
    INSERT INTO customers (user_id, name, company, email, phone, gstin, billing_address) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const customers = [
    ['Priya Mehta', 'Mehta Organics', 'priya@mehtaorganics.in', '+91 99200 11223', '27ABCDE1234F1Z5', '12 Baner Road, Pune 411045'],
    ['Rohan Gupta', 'Gupta Traders', 'rohan@guptatraders.com', '+91 98111 22334', '07AAACG5678K1Z2', '45 Chandni Chowk, Delhi 110006'],
    ['Sneha Iyer', 'Brew & Bean Cafe', 'sneha@brewbean.in', '+91 90040 55667', '', '8 Indiranagar 100ft Road, Bengaluru 560038'],
    ['Karan Patel', 'Patel Logistics', 'karan@patellogistics.in', '+91 97250 88990', '24AAECP4321L1Z9', 'Plot 22, GIDC, Ahmedabad 382445'],
    ['Ananya Rao', '', 'ananya.rao@gmail.com', '+91 91234 56780', '', 'Flat 3B, Jubilee Hills, Hyderabad 500033'],
  ].map((c) => addCustomer.run(userId, ...c).lastInsertRowid);

  const addProduct = db.prepare(`
    INSERT INTO products (user_id, type, name, description, price, tax_rate, unit) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const products = [
    ['service', 'Website Design', 'Responsive website design, up to 5 pages', 25000, 18, 'project'],
    ['service', 'Logo & Branding', 'Logo, colour palette and brand guide', 12000, 18, 'project'],
    ['service', 'Consulting', 'Strategy & technical consulting', 2000, 18, 'hrs'],
    ['service', 'Annual Maintenance', 'Updates, backups and support for 12 months', 18000, 18, 'year'],
    ['product', 'Printed Brochures', 'A4 tri-fold, glossy', 25, 12, 'pcs'],
    ['product', 'Business Cards', 'Premium matte, box of 100', 450, 5, 'box'],
  ].map((p) => ({ id: addProduct.run(userId, ...p).lastInsertRowid, name: p[1], price: p[3], tax_rate: p[4], unit: p[5] }));

  const item = (p, quantity, discount = 0) => ({ product_id: p.id, description: p.name, unit: p.unit, quantity, price: p.price, tax_rate: p.tax_rate, discount });

  // [customer index, issued days ago, due after days, status, items, payments [amount fraction, days ago, method]]
  const invoices = [
    [0, 160, 15, 'sent', [item(products[0], 1), item(products[1], 1, 10)], [[1, 150, 'Bank Transfer']]],
    [1, 130, 30, 'sent', [item(products[4], 500), item(products[5], 4)], [[1, 110, 'UPI']]],
    [2, 100, 15, 'sent', [item(products[2], 12)], [[0.5, 95, 'UPI'], [0.5, 70, 'Cash']]],
    [3, 75, 30, 'sent', [item(products[3], 1), item(products[2], 5)], [[1, 50, 'Cheque']]],
    [0, 45, 15, 'sent', [item(products[2], 8, 5)], [[0.4, 20, 'UPI']]],
    [4, 40, 15, 'sent', [item(products[1], 1)], []],
    [1, 20, 30, 'sent', [item(products[4], 1000, 8)], [[1, 5, 'Bank Transfer']]],
    [3, 10, 30, 'sent', [item(products[0], 1), item(products[3], 1)], [[0.3, 3, 'Card']]],
    [2, 2, 15, 'draft', [item(products[5], 2), item(products[4], 200)], []],
  ];

  const addInvoice = db.prepare(`
    INSERT INTO invoices (user_id, customer_id, invoice_number, issue_date, due_date, status, notes, terms,
                          subtotal, discount_total, tax_total, total, amount_paid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const addItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, product_id, description, unit, quantity, price, discount, tax_rate, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const addPayment = db.prepare('INSERT INTO payments (invoice_id, amount, date, method, note) VALUES (?, ?, ?, ?, ?)');

  invoices.forEach(([c, ago, dueIn, status, items, payments], i) => {
    const calc = calculateInvoice(items);
    const paid = payments.reduce((sum, [fraction]) => sum + Math.round(calc.total * fraction * 100) / 100, 0);
    const finalStatus = paid >= calc.total ? 'paid' : status;

    const invoiceId = addInvoice.run(
      userId, customers[c], `INV-${String(i + 1).padStart(4, '0')}`, day(-ago), day(-ago + dueIn), finalStatus,
      'Thank you for your business!', 'Please pay within the due date via bank transfer or UPI.',
      calc.subtotal, calc.discount_total, calc.tax_total, calc.total, paid
    ).lastInsertRowid;

    calc.lines.forEach((l) => addItem.run(invoiceId, l.product_id, l.description, l.unit, l.quantity, l.price, l.discount, l.tax_rate, l.amount));
    payments.forEach(([fraction, pAgo, method]) =>
      addPayment.run(invoiceId, Math.round(calc.total * fraction * 100) / 100, day(-pAgo), method, ''));
  });

  db.prepare('UPDATE users SET invoice_counter = ? WHERE id = ?').run(invoices.length, userId);
});

console.log(`Demo data ready. Log in with ${EMAIL} / demo123`);
