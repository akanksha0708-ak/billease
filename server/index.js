// Entry point: sets up Express, mounts the API routes and serves the React build.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('./utils/auth');

// On hosted demos, (re)create the demo account on every start.
if (process.env.SEED_DEMO === 'true') require('./seed');

const app = express();
app.use(cors());
app.use(express.json());

// Uploaded logos are public images.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/business', requireAuth, require('./routes/business'));
app.use('/api/customers', requireAuth, require('./routes/customers'));
app.use('/api/products', requireAuth, require('./routes/products'));
app.use('/api/invoices', requireAuth, require('./routes/invoices'));
app.use('/api/payments', requireAuth, require('./routes/payments'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---- Frontend (after `npm run build` in /client). Any non-API route returns index.html.
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*any}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ---- One place that turns any thrown error into a JSON response.
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') err = { status: 400, message: 'File is too large (max 2 MB)' };
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : err.message });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
