# Deploying InsiderFlow

The app is **three pieces** that must be hosted differently — Vercel alone cannot run the Java
backend or the database.

| Piece | Host | Why |
|-------|------|-----|
| Frontend (Vite/React) | **Vercel** | static build over HTTPS — perfect fit |
| Backend (Spring Boot) | **Railway** or **Render** | long-running JVM + scheduled ingestion; runs the Dockerfile |
| Database (MongoDB) | **MongoDB Atlas** (free M0) | managed, auth-enforced, not internet-exposed |

---

## 1. MongoDB Atlas (do first — the backend needs its URL)
1. Create a free **M0** cluster at mongodb.com/atlas.
2. Database Access → add a user (username + strong password).
3. Network Access → allow your backend host's IPs (Railway/Render give egress ranges) or, to start, `0.0.0.0/0` (then tighten).
4. Copy the connection string: `mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/insiderflow?retryWrites=true&w=majority`.

## 2. Backend on Railway (or Render)
1. New project → **Deploy from GitHub repo** → pick the repo, set **root directory = `backend`** (it builds the Dockerfile).
2. Set environment variables:
   - `MONGODB_URI` = the Atlas string above
   - `JWT_SECRET` = a 64+ char random string (persistent sessions)
   - `FINNHUB_API_KEY` = your Finnhub key
   - `CORS_ALLOWED_ORIGINS` = your Vercel URL (e.g. `https://insiderflow.vercel.app`) — set after step 3, or use a temporary `*`-free placeholder and update
   - `SEC_USER_AGENT` = `InsiderFlow/1.0 (your-email)`
   - `REGISTRATION_ENABLED` = `true` (set `false` after you've made your account)
3. Deploy. Note the public backend URL (e.g. `https://insiderflow-api.up.railway.app`). First boot ingests data (~20s trades; SEC Form 4 backfill a few minutes).
   - **Note:** the senate eFD scraper needs Chrome and runs on your machine, not the server. Commit an up-to-date `data/senate_efd_transactions.json` (already in the repo) or run the scraper periodically and redeploy. The backend reads it if present.

## 3. Frontend on Vercel
1. New Project → import the repo → set **root directory = `frontend`** (Vercel auto-detects Vite).
2. Environment variable: `VITE_API_URL` = your backend URL from step 2 (no trailing slash, no `/api`).
3. Deploy. Vercel builds the production bundle and serves it over HTTPS. `vercel.json` handles SPA routing + security headers.
4. Go back to the backend and set `CORS_ALLOWED_ORIGINS` to the final Vercel URL; redeploy the backend.

## 4. After it's live
- Register your account, then set `REGISTRATION_ENABLED=false` on the backend to close public signups.
- Confirm HTTPS on both, and that the browser calls the backend URL (not localhost) in DevTools → Network.
- Keep secrets only in the host dashboards — never commit `.env`.

## Local production-like run (optional)
`cp .env.example .env`, fill in `MONGO_PASSWORD` + `JWT_SECRET`, then `docker compose up -d --build`.
Mongo runs with auth and is not exposed to the host; frontend is served by nginx on :5173.
