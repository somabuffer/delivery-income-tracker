const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// DATA_DIR lets a host with a mounted persistent disk (e.g. Render) point storage
// there instead of the project folder, which is wiped/read-only on most PaaS deploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const INSURANCE_START = '2026-06-23';
const INSURANCE_MONTHLY = 147.56;

function defaultData() {
  return {
    income: [],
    expenses: [],
    statements: [],
    insuranceRates: [{ start: INSURANCE_START, monthly: INSURANCE_MONTHLY }]
  };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2));
  }
}

function readData() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      income: Array.isArray(parsed.income) ? parsed.income : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      statements: Array.isArray(parsed.statements) ? parsed.statements : [],
      insuranceRates: Array.isArray(parsed.insuranceRates) && parsed.insuranceRates.length
        ? parsed.insuranceRates
        : defaultData().insuranceRates
    };
  } catch (e) {
    return defaultData();
  }
}

// Atomic write: write to a temp file then rename, so a crash mid-write can't corrupt data.json.
function writeData(data) {
  ensureFile();
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, DATA_FILE);
}

function uid() {
  return crypto.randomUUID();
}

function addRow(collection, row) {
  const data = readData();
  const newRow = { ...row, id: uid() };
  data[collection] = [newRow, ...data[collection]];
  writeData(data);
  return newRow;
}

function updateRow(collection, id, patch) {
  const data = readData();
  let updated = null;
  data[collection] = data[collection].map(r => {
    if (r.id === id) {
      updated = { ...r, ...patch, id };
      return updated;
    }
    return r;
  });
  if (!updated) return null;
  writeData(data);
  return updated;
}

function deleteRow(collection, id) {
  const data = readData();
  const before = data[collection].length;
  data[collection] = data[collection].filter(r => r.id !== id);
  if (data[collection].length === before) return false;
  writeData(data);
  return true;
}

function upsertInsuranceRate(rate) {
  const data = readData();
  data.insuranceRates = [
    ...data.insuranceRates.filter(r => r.start !== rate.start),
    { start: rate.start, monthly: rate.monthly }
  ].sort((a, b) => (a.start < b.start ? -1 : 1));
  writeData(data);
  return data.insuranceRates;
}

function deleteInsuranceRate(start) {
  const data = readData();
  if (data.insuranceRates.length <= 1) return false;
  const before = data.insuranceRates.length;
  data.insuranceRates = data.insuranceRates.filter(r => r.start !== start);
  if (data.insuranceRates.length === before) return false;
  writeData(data);
  return true;
}

module.exports = {
  readData,
  writeData,
  addRow,
  updateRow,
  deleteRow,
  upsertInsuranceRate,
  deleteInsuranceRate
};
