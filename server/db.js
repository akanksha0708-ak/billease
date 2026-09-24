// SQLite database (built into Node.js — no separate DB server needed).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'billing.db'));

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    invoice_counter INTEGER NOT NULL DEFAULT 0,   -- used to generate unique invoice numbers
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS businesses (
    user_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name     TEXT,
    address  TEXT,
    gstin    TEXT,
    email    TEXT,
    phone    TEXT,
    logo     TEXT                                 -- file name inside /uploads
  );

  CREATE TABLE IF NOT EXISTS customers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    company         TEXT,
    gstin           TEXT,
    billing_address TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'service')),
    name        TEXT NOT NULL,
    description TEXT,
    price       REAL NOT NULL DEFAULT 0,
    tax_rate    REAL NOT NULL DEFAULT 0,
    unit        TEXT DEFAULT 'pcs',
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id    INTEGER NOT NULL REFERENCES customers(id),
    invoice_number TEXT NOT NULL,
    issue_date     TEXT NOT NULL,
    due_date       TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
    notes          TEXT,
    terms          TEXT,
    subtotal       REAL NOT NULL DEFAULT 0,
    discount_total REAL NOT NULL DEFAULT 0,
    tax_total      REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL DEFAULT 0,
    amount_paid    REAL NOT NULL DEFAULT 0,
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, invoice_number)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    unit        TEXT,
    quantity    REAL NOT NULL,
    price       REAL NOT NULL,
    discount    REAL NOT NULL DEFAULT 0,          -- discount % on this line
    tax_rate    REAL NOT NULL DEFAULT 0,          -- GST % on this line
    amount      REAL NOT NULL                     -- line total incl. tax
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount     REAL NOT NULL,
    date       TEXT NOT NULL,
    method     TEXT NOT NULL,
    note       TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Runs a function inside a transaction so multi-step writes are all-or-nothing.
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { db, transaction };
