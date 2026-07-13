# DriveLedger

A delivery/rideshare income, expense, and Québec tax tracker. Runs as a small Node.js server
(Express) with data stored in a local JSON file, gated behind Clerk authentication so only you
can access it.

## 1. Create a Clerk application

1. Go to the [Clerk Dashboard](https://dashboard.clerk.com/) and create an application (choose whatever sign-in methods you like — email, Google, etc. — it doesn't matter which, since access is still restricted below).
2. Go to **API Keys** and copy the **Publishable key** and **Secret key**.
3. Clerk's development keys work against `http://localhost:3000` immediately, no extra config needed. For a deployed URL (e.g. Render), add it under **Configure > Domains** once you have one.

## 2. Run locally

```bash
cp .env.example .env
```

Edit `.env`:
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — from step 1
- `ALLOWED_EMAIL` — only this email address is allowed to access the data, no matter which account signs in through Clerk

```bash
npm install
npm start
```

Open `http://localhost:3000`, sign in, and start tracking.

## 3. Deploy (Render)

This app is a regular always-on Node/Express server with data written to a local file, so it
needs a host with a persistent disk — **not** a serverless platform like Vercel (those have
read-only, ephemeral filesystems, so writes to `data.json` would silently disappear).

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the [Render dashboard](https://dashboard.render.com/), click **New > Blueprint**, and point it at this repo. Render will read `render.yaml` and set up:
   - A web service running `npm install` / `npm start`
   - A 1GB persistent disk mounted at `/data`, with `DATA_DIR=/data` so `data.json` survives deploys and restarts
3. Render will prompt you for the env vars marked `sync: false` in `render.yaml`:
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `ALLOWED_EMAIL`
4. **Note:** a persistent disk requires Render's Starter plan or higher (not the free tier) — see [Render's pricing](https://render.com/pricing).
5. Once deployed, add the `https://your-app.onrender.com` URL Render gives you under **Configure > Domains** in the Clerk Dashboard — sign-in will fail until you do this.

## Data storage

All income, expenses, monthly statements, and insurance rates are stored in a `data.json` file
on disk (created automatically on first run) — at `./data/data.json` locally, or wherever
`DATA_DIR` points (e.g. `/data` on Render's persistent disk). Back this file up if you want —
it's plain JSON.

## Project structure

- `server.js` — Express app: Clerk token verification, REST API, static file serving
- `lib/auth.js` — Clerk session token verification + the `ALLOWED_EMAIL` authorization gate
- `lib/store.js` — JSON file persistence (income/expenses/statements/insuranceRates)
- `public/index.html` — the frontend (React, loaded via CDN, no build step; Clerk's JS SDK loaded dynamically using the publishable key)
- `legacy/original-artifact-export.html` — the original browser-only (localStorage) version, kept for reference
