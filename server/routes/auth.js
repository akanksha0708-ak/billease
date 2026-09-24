// Register, login and "who am I".
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { createToken, requireAuth } = require('../utils/auth');
const { HttpError, requireFields, isEmail } = require('../utils/http');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

router.post('/register', (req, res) => {
  requireFields(req.body, ['name', 'email', 'password']);
  const { name, password } = req.body;
  const email = req.body.email.trim().toLowerCase();

  if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), email, hash);

  // Every user gets an (empty) business profile to fill in later.
  db.prepare('INSERT INTO businesses (user_id, name, email) VALUES (?, ?, ?)').run(lastInsertRowid, `${name.trim()}'s Business`, email);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ token: createToken(user.id), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  requireFields(req.body, ['email', 'password']);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(req.body.password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  res.json({ token: createToken(user.id), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) throw new HttpError(401, 'Please log in again');
  res.json(publicUser(user));
});

module.exports = router;
