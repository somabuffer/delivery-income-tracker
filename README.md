# DriveLedger

A delivery/rideshare income, expense, and Québec tax tracker. Runs as a small Node.js server
(Express) with data stored in a local JSON file, gated behind Google Sign-In so only you can
access it.

## 1. Create a Google OAuth Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or use an existing one).
2. Go to **APIs & Services > OAuth consent screen** and configure it (External is fine; you don't need to publish it — just add your own Gmail address as a test user).
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: add `http://localhost:3000` for local dev, and your deployed URL (e.g. `https://your-app.onrender.com`) once you have one — see below.
4. Copy the generated **Client ID**.

## 2. Run locally

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

```bash
npm install
npm start
```

Open `http://localhost:3000`, sign in with your Google account, and start tracking.

## 3. Deploy (Render)

This app is a regular always-on Node/Express server with data written to a local file, so it
needs a host with a persistent disk — **not** a serverless platform like Vercel (those have
read-only, ephemeral filesystems, so writes to `data.json` would silently disappear).

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the [Render dashboard](https://dashboard.render.com/), click **New > Blueprint**, and point it at this repo. Render will read `render.yaml` and set up:
   - A web service running `npm install` / `npm start`
   - A 1GB persistent disk mounted at `/data`, with `DATA_DIR=/data` so `data.json` survives deploys and restarts
3. Render will prompt you for the env vars marked `sync: false` in `render.yaml`:
   - `GOOGLE_CLIENT_ID`
   - `ALLOWED_EMAIL`
   - (`SESSION_SECRET` is generated for you automatically)
4. **Note:** a persistent disk requires Render's Starter plan or higher (not the free tier) — see [Render's pricing](https://render.com/pricing).
5. Once deployed, copy the `https://your-app.onrender.com` URL Render gives you and add it as an **Authorized JavaScript origin** on your Google OAuth Client ID (step 1 above) — Google Sign-In will fail until you do this.

## Data storage

All income, expenses, monthly statements, and insurance rates are stored in a `data.json` file
on disk (created automatically on first run) — at `./data/data.json` locally, or wherever
`DATA_DIR` points (e.g. `/data` on Render's persistent disk). Back this file up if you want —
it's plain JSON.

## Project structure

- `server.js` — Express app: Google auth, REST API, static file serving
- `lib/auth.js` — Google ID token verification + session middleware
- `lib/store.js` — JSON file persistence (income/expenses/statements/insuranceRates)
- `public/index.html` — the frontend (React, loaded via CDN, no build step)
- `legacy/original-artifact-export.html` — the original browser-only (localStorage) version, kept for reference
