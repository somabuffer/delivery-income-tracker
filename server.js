require('dotenv').config();
const path = require('path');
const express = require('express');
const { requireAuth, PUBLISHABLE_KEY } = require('./lib/auth');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------- Auth ----------
// Clerk handles sign-in/sign-up/sign-out entirely client-side. Every API request
// below carries a Clerk session token as a Bearer header, which requireAuth verifies
// (and checks the account's email against ALLOWED_EMAIL) — no server-side session state.

app.get('/api/auth/config', (req, res) => {
  res.json({ publishableKey: PUBLISHABLE_KEY || null });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ authenticated: true, email: req.userEmail });
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
