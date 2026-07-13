const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// On Vercel the filesystem is read-only (or, at best, an ephemeral per-instance
// temp dir that's wiped on every cold start/deploy), so data never survives.
// If a Redis-compatible store (Vercel KV / Upstash Redis) is connected, use it
// instead — it's durable and works from any serverless instance. Otherwise fall
// back to the JSON file on disk (local dev, or a host with a persistent disk
// like Render).
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = 'delivery-income-tracker:data';

let redis = null;
if (REDIS_URL && REDIS_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
}

function defaultDataDir() {
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'delivery-income-tracker');
  return path.join(__dirname, '..', 'data');
}
const DATA_DIR = process.env.DATA_DIR || defaultDataDir();
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

function normalize(parsed) {
  return {
    income: Array.isArray(parsed.income) ? parsed.income : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    statements: Array.isArray(parsed.statements) ? parsed.statements : [],
    insuranceRates: Array.isArray(parsed.insuranceRates) && parsed.insuranceRates.length
      ? parsed.insuranceRates
      : defaultData().insuranceRates
  };
}

// ---------- file-backed store (local dev / hosts with a persistent disk) ----------

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2));
  }
}

function readFileData() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return normalize(JSON.parse(raw));
  } catch (e) {
    return defaultData();
  }
}

// Atomic write: write to a temp file then rename, so a crash mid-write can't corrupt data.json.
function writeFileData(data) {
  ensureFile();
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  fs.renameSync(tmpFile, DATA_FILE);
}

// ---------- storage-agnostic API ----------

async function readData() {
  if (redis) {
    const raw = await redis.get(REDIS_KEY);
    if (!raw) return defaultData();
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalize(parsed);
  }
  return readFileData();
}

async function writeData(data) {
  if (redis) {
    await redis.set(REDIS_KEY, data);
    return;
  }
  writeFileData(data);
}

function uid() {
  return crypto.randomUUID();
}

async function addRow(collection, row) {
  const data = await readData();
  const newRow = { ...row, id: uid() };
  data[collection] = [newRow, ...data[collection]];
  await writeData(data);
  return newRow;
}

async function updateRow(collection, id, patch) {
  const data = await readData();
  let updated = null;
  data[collection] = data[collection].map(r => {
    if (r.id === id) {
      updated = { ...r, ...patch, id };
      return updated;
    }
    return r;
  });
  if (!updated) return null;
  await writeData(data);
  return updated;
}

async function deleteRow(collection, id) {
  const data = await readData();
  const before = data[collection].length;
  data[collection] = data[collection].filter(r => r.id !== id);
  if (data[collection].length === before) return false;
  await writeData(data);
  return true;
}

async function upsertInsuranceRate(rate) {
  const data = await readData();
  data.insuranceRates = [
    ...data.insuranceRates.filter(r => r.start !== rate.start),
    { start: rate.start, monthly: rate.monthly }
  ].sort((a, b) => (a.start < b.start ? -1 : 1));
  await writeData(data);
  return data.insuranceRates;
}

async function deleteInsuranceRate(start) {
  const data = await readData();
  if (data.insuranceRates.length <= 1) return false;
  const before = data.insuranceRates.length;
  data.insuranceRates = data.insuranceRates.filter(r => r.start !== start);
  if (data.insuranceRates.length === before) return false;
  await writeData(data);
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
