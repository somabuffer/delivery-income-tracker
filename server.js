require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { verifyGoogleCredential, requireAuth, CLIENT_ID } = require('./lib/auth');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET is not set in .env — using an insecure default. Set it before real use.');
}

app.use(express.json());
app.use(cookieSession({
  name: 'ddit_session',
  secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  sameSite: 'lax'
}));

// ---------- Auth ----------

app.get('/api/auth/config', (req, res) => {
  res.json({ clientId: CLIENT_ID || null });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });
    const { email, name, picture } = await verifyGoogleCredential(credential);
    req.session.email = email;
    res.json({ authenticated: true, email, name, picture });
  } catch (e) {
    res.status(401).json({ error: e.message || 'Authentication failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.email) {
    res.json({ authenticated: true, email: req.session.email });
  } else {
    res.json({ authenticated: false });
  }
});

// ---------- Data ----------

app.get('/api/data', requireAuth, (req, res) => {
  res.json(store.readData());
});

function crudRoutes(name, collection) {
  app.post(`/api/${name}`, requireAuth, (req, res) => {
    const row = store.addRow(collection, req.body);
    res.status(201).json(row);
  });
  app.put(`/api/${name}/:id`, requireAuth, (req, res) => {
    const row = store.updateRow(collection, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
  app.delete(`/api/${name}/:id`, requireAuth, (req, res) => {
    const ok = store.deleteRow(collection, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });
}

crudRoutes('income', 'income');
crudRoutes('expenses', 'expenses');
crudRoutes('statements', 'statements');

app.post('/api/insurance-rates', requireAuth, (req, res) => {
  const { start, monthly } = req.body;
  if (!start || !monthly || monthly <= 0) {
    return res.status(400).json({ error: 'start and a positive monthly amount are required' });
  }
  const rates = store.upsertInsuranceRate({ start, monthly });
  res.status(201).json(rates);
});

app.delete('/api/insurance-rates/:start', requireAuth, (req, res) => {
  const ok = store.deleteInsuranceRate(req.params.start);
  if (!ok) return res.status(404).json({ error: 'Not found, or the only remaining rate' });
  res.status(204).end();
});

// ---------- Static frontend ----------

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`DriveLedger server running at http://localhost:${PORT}`);
});
