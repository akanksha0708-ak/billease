// Small helpers for sending errors from route handlers.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Throws a 400 error listing any required fields that are empty.
function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || String(body[f]).trim() === '');
  if (missing.length) throw new HttpError(400, `Please fill in: ${missing.join(', ')}`);
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// GSTIN format: 2-digit state code + PAN + entity + Z + checksum, e.g. 27ABCDE1234F1Z5
const isGstin = (v) => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v);

// Checks optional email/GSTIN fields when present.
function validateContact(body) {
  if (body.email && !isEmail(body.email)) throw new HttpError(400, 'Please enter a valid email address');
  if (body.gstin && !isGstin(body.gstin.toUpperCase())) throw new HttpError(400, 'Please enter a valid 15-character GSTIN');
}

module.exports = { HttpError, requireFields, isEmail, validateContact };
