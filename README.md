# DriveLedger

A delivery/rideshare income, expense, and Québec tax tracker. Runs as a small Node.js server
(Express) with data stored in a local JSON file, gated behind Google Sign-In so only you can
access it.

## 1. Create a Google OAuth Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or use an existing one).
2. Go to **APIs & Services > OAuth consent screen** and configure it (External is fine; you don't need to publish it — just add your own Gmail address as a test user).
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000` (or whatever port you use)
4. Copy the generated **Client ID**.

## 2. Configure the server

```bash
cp .env.example .env
```

Edit `.env`:
- `GOOGLE_CLIENT_ID` — the client ID from step 1
- `ALLOWED_EMAIL` — your Gmail address (only this account will be allowed to sign in)
- `SESSION_SECRET` — a random string, e.g. generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## 3. Install and run

```bash
npm install
npm start
```

Open `http://localhost:3000`, sign in with your Google account, and start tracking.

## Data storage

All income, expenses, monthly statements, and insurance rates are stored in `data/data.json`
on disk (created automatically on first run). Back this file up if you want — it's plain JSON.

## Project structure

- `server.js` — Express app: Google auth, REST API, static file serving
- `lib/auth.js` — Google ID token verification + session middleware
- `lib/store.js` — JSON file persistence (income/expenses/statements/insuranceRates)
- `public/index.html` — the frontend (React, loaded via CDN, no build step)
- `legacy/original-artifact-export.html` — the original browser-only (localStorage) version, kept for reference
