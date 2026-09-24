// Business profile (name, address, GSTIN, contact details, logo).
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { HttpError, requireFields, validateContact } = require('../utils/http');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Accept only PNG/JPG logos up to 2 MB (these formats also work inside the PDF).
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `logo-${req.userId}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg'].includes(file.mimetype);
    cb(ok ? null : new HttpError(400, 'Logo must be a PNG or JPG image'), ok);
  },
});

const getBusiness = (userId) => db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);

router.get('/', (req, res) => {
  res.json(getBusiness(req.userId));
});

router.put('/', (req, res) => {
  requireFields(req.body, ['name']);
  validateContact(req.body);
  const { name, address = '', gstin = '', email = '', phone = '' } = req.body;

  db.prepare('UPDATE businesses SET name = ?, address = ?, gstin = ?, email = ?, phone = ? WHERE user_id = ?')
    .run(name.trim(), address.trim(), gstin.trim().toUpperCase(), email.trim(), phone.trim(), req.userId);
  res.json(getBusiness(req.userId));
});

router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) throw new HttpError(400, 'Please choose an image to upload');

  // Remove the previous logo file so uploads don't pile up.
  const old = getBusiness(req.userId).logo;
  if (old) fs.rm(path.join(UPLOAD_DIR, old), { force: true }, () => {});

  db.prepare('UPDATE businesses SET logo = ? WHERE user_id = ?').run(req.file.filename, req.userId);
  res.json(getBusiness(req.userId));
});

module.exports = router;
