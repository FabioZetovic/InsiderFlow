# InsiderFlow — Security Audit

**Date:** 2026-07-22 · **Scope:** full stack (Spring Boot backend, React frontend, Docker Compose, ingestion scripts) · **Context:** assessment ahead of a possible public deployment.

This is an adversarial review — findings are ordered by severity, each with the concrete location, how an attacker would exploit it, and the fix. The app is currently **safe as a locally-run tool**; several items below are **blocking for public exposure**.

---

## Resolution status — updated 2026-07-22 (verified live + 30 unit tests + 36 Bruno API tests)

| ID | Finding | Status |
|----|---------|--------|
| **C1** | Mongo no auth + exposed port | ✅ **FIXED & VERIFIED** — compose runs `mongod --auth` with root creds from `.env`; **host port removed** (internal network only). Verified: external connect to 27017 → `ECONNREFUSED`; backend connects with auth. Prod uses MongoDB Atlas (auth-enforced). |
| **C2** | Vite dev server in prod | ✅ **FIXED** — frontend Dockerfile is now a multi-stage build served by **nginx**; Vercel serves a production build. |
| **C3** | No TLS | ⚙️ **Platform** — HTTPS provided by Vercel (frontend) and Railway/Render (backend); app honors `X-Forwarded-*` (`server.forward-headers-strategy=framework`). Not applicable to local dev. |
| **H1** | Weak brute-force protection | ✅ **FIXED & TESTED** — `LoginRateLimiter` now has a **per-IP cap** (40/10min) plus per-account (10/10min); 4 unit tests cover brute-force, credential-stuffing, IP isolation, success-reset. |
| **H2** | Open registration | ✅ **MITIGATED** — per-IP cap limits mass signup; `insiderflow.auth.registration-enabled` flag closes signups after launch. (CAPTCHA/email-verify still optional.) |
| **H3** | Unvalidated ticker → SSRF/cache-fill | ✅ **FIXED & TESTED** — ticker validated against `^[A-Z0-9.\-]{1,10}$` before any outbound URL; unit + Bruno tests confirm 400 on junk. |
| **H4** | No API rate limiting | ✅ **FIXED & VERIFIED** — global `RateLimitFilter` (120 req/min/IP over `/api/**`). Verified live: burst returned 429s after the cap. |
| **M1/M2** | Username/password validation | ✅ **FIXED** — `@Size`+charset on username, `@Size(8,72)` on password. |
| **M3** | Account enumeration | ✅ **FIXED & TESTED** — login runs a constant-time dummy BCrypt on unknown emails; generic "Invalid email or password" (Bruno-asserted). (Registration 409 still reveals existence — accepted; low value given per-IP throttle.) |
| **M4** | No token revocation | ✅ **FIXED** — per-user `tokenVersion` claim checked on every request; `POST /api/auth/logout-all` invalidates all sessions (Bruno-tested, 204). |
| **M5** | Missing security headers | ✅ **FIXED & VERIFIED** — CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, Referrer-Policy in `SecurityConfig` + `vercel.json`; Bruno asserts them on responses. |
| **M6** | Token in localStorage | ⚠️ **ACCEPTED** — kept, with a strict CSP as the compensating control; moving to httpOnly cookies is a future auth-flow redesign (would add CSRF handling). |
| **L1** | Loose `permitAll` default | ✅ **FIXED** — `anyRequest().authenticated()`. |
| **L2** | Email in committed config | ✅ **FIXED** — generic default; real contact via `SEC_USER_AGENT` env. |
| **L3** | CORS credentials mode | ✅ **FIXED** — `allowCredentials(false)`, env-driven origins, scoped headers. |
| **L4** | No body-size cap | ✅ **FIXED** — `max-request-size=1MB`, `max-swallow-size=2MB`. |
| **L5** | Search/sort injection | ✅ Already safe (`Pattern.quote`, sort whitelist) — confirmed, no change needed. |
| **L7** | No CI/CVE scanning | ✅ **ADDED** — `.github/workflows/ci.yml` runs backend tests, frontend build, `npm audit`, and the Bruno API suite against a live backend. |

**Net:** all Critical and High findings are fixed (C3 via the hosting platform); the only knowingly-deferred item is **M6** (localStorage token, accepted with CSP). Secrets are env-only; a hardened `.env.example` documents required config.

---

## 🔴 CRITICAL — must fix before any public/internet exposure

### C1. MongoDB runs with no authentication and is published to the host
- **Where:** `docker-compose.yml` — `mongo` service publishes `27017:27017`, no `MONGO_INITDB_ROOT_*` credentials; verified live: `authenticatedUsers: []`, an anonymous client reads `db.users` including `email` + bcrypt `passwordHash`.
- **Exploit:** on a public host, `27017` is open to the internet with zero auth. Anyone can dump every user's email + password hash (crack weak ones offline), read all data, or `db.dropDatabase()`. Automated bots scan for open Mongo constantly.
- **Fix:** enable auth (`MONGO_INITDB_ROOT_USERNAME/PASSWORD`, put credentials in `MONGODB_URI`); **do not publish 27017** — remove the `ports:` mapping so only the backend (same compose network) reaches it; bind to `127.0.0.1` if a host port is truly needed. Add a Mongo app user with least privilege (not root).

### C2. Frontend is served by the Vite **dev server** in "production"
- **Where:** `frontend/Dockerfile` → `CMD ["npm","run","dev","--","--host","0.0.0.0"]`.
- **Exploit:** the Vite dev server is not a hardened web server — it exposes source, HMR websocket, and has had path-traversal/`server.fs.allow` bypass CVEs. Publicly exposed it leaks source and widens attack surface.
- **Fix:** build static assets (`npm run build`) and serve `dist/` via nginx (or `vite preview` at minimum). Add a multi-stage Dockerfile: node build stage → nginx serve stage.

### C3. No TLS anywhere
- **Where:** all services are plain HTTP (`server.port=8080`, frontend HTTP, API base `http://localhost:8080`).
- **Exploit:** JWTs and passwords travel in cleartext. On any shared network a man-in-the-middle captures a Bearer token (valid 24 h) or login credentials.
- **Fix:** terminate TLS at a reverse proxy (nginx/Caddy/Traefik) in front of both services; redirect HTTP→HTTPS; serve the API and app over HTTPS only.

---

## 🟠 HIGH

### H1. Weak brute-force / credential-stuffing protection
- **Where:** `auth/LoginRateLimiter.java` — throttle key is `ip|email`.
- **Exploit:** the per-(IP,email) key means **credential stuffing across many accounts from one IP is not limited** (each email is a fresh bucket of 10 tries). There's **no account lockout** and **no per-IP cap**. The limiter is in-memory per process, so a multi-instance deploy behind a load balancer multiplies the allowance and it resets on restart. An attacker with a proxy pool bypasses it entirely.
- **Fix:** add a per-IP global counter (independent of email) and a per-account failure counter with lockout/backoff; move the store to Redis (shared, survives restart) for multi-instance; consider CAPTCHA after N failures.

### H2. Open registration with no abuse controls
- **Where:** `AuthController.register` / `AuthService.register` — anyone can create unlimited accounts; success **resets** the rate-limit bucket so registration is effectively unthrottled per IP; no email verification, no CAPTCHA.
- **Exploit:** mass account creation (spam, resource/storage exhaustion), and each account can then hammer the authenticated API.
- **Fix:** rate-limit registration per IP (count successes too, or a separate register limiter), add email verification and/or CAPTCHA, and cap total accounts if this is a personal deployment.

### H3. Unvalidated `ticker` path param drives outbound requests + unbounded cache growth (SSRF-adjacent)
- **Where:** `AnalyticsService.tickerDetail` / `CorporateController.forTicker` → `PriceHistoryService.fetchFromYahoo` builds `"/v8/finance/chart/" + symbol + "?range=3y&interval=1d"`. `symbol` is the user path param, only `.toUpperCase()`/`.trim()`, no charset validation.
- **Exploit:** `GET /api/trades/ticker/<anything>` makes the server issue an outbound Yahoo request for an attacker-chosen string and, if Yahoo returns data, **persists a `price_history` doc** — unbounded storage growth (DoS) by enumerating junk symbols. URL metacharacters (`?`, `#`, `../`, `@`) injected into the path can also manipulate the outbound request (query-param injection / same-host path traversal).
- **Fix:** validate ticker against `^[A-Z0-9.\-]{1,10}$` at the controller boundary and reject otherwise; URL-encode the path segment; cap the number of distinct symbols cached per time window.

### H4. No per-user/API rate limiting → authenticated DoS
- **Where:** only `/api/auth/*` is rate-limited. Expensive endpoints (`/trades/digest`, `/trades/clusters`, `/trades/late-filers`, `/trades/compare`, `/trades/ticker/*`) run full scans / aggregations / outbound fetches with **no throttle**.
- **Exploit:** one logged-in user (trivially obtained via open registration) can spam `/clusters?days=180` or enumerate `/ticker/*` to pin CPU, Mongo, and outbound bandwidth.
- **Fix:** global request rate limiting (bucket4j / gateway / nginx `limit_req`); cache expensive aggregations; bound outbound fan-out.

---

## 🟡 MEDIUM

### M1. Username has no length/charset validation
- **Where:** `AuthDtos.RegisterRequest` — `username` is `@NotBlank` only.
- **Exploit:** register a multi-megabyte username (storage/DoS) or one containing markup/control chars. React escapes on render so browser XSS is unlikely, but the value flows into JWT claims, logs, and any future non-HTML surface (emails, admin views) where it could inject.
- **Fix:** `@Size(min=2,max=40)` + a charset pattern (e.g. `^[\w .'-]{2,40}$`).

### M2. No maximum password length
- **Where:** `AuthDtos` password `.{8,}` has no upper bound; BCrypt silently truncates at 72 bytes.
- **Exploit:** oversized passwords waste bandwidth/CPU and the >72-byte truncation is a silent correctness/lockout footgun.
- **Fix:** `@Size(min=8,max=72)`.

### M3. Account enumeration (registration message + login timing)
- **Where:** `AuthService.register` returns `409 "An account with this email already exists"`; `login` runs BCrypt only when the email exists → measurable timing difference between unknown-email and wrong-password.
- **Exploit:** an attacker maps which emails have accounts (targeted phishing / credential stuffing).
- **Fix:** generic registration response, and always run a dummy BCrypt compare on unknown emails to equalize timing.

### M4. No stateless-JWT revocation; 24 h lifetime; logout is client-only
- **Where:** `JwtService` (24 h expiry), `AuthContext.logout` just deletes the local token.
- **Exploit:** a leaked/stolen token stays valid for up to 24 h — there is no server-side invalidation, no refresh rotation, no "log out everywhere."
- **Fix:** shorter access-token TTL (~15 min) + refresh tokens with rotation and a server-side revocation list (or a per-user token-version claim checked on each request).

### M5. Missing security response headers
- **Where:** `SecurityConfig` sets no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS.
- **Exploit:** clickjacking (no frame-ancestors), MIME sniffing, and no defense-in-depth against XSS.
- **Fix:** add Spring Security headers (`headers().frameOptions().deny()`, a strict CSP, HSTS behind TLS, `nosniff`).

### M6. Token stored in `localStorage`
- **Where:** `auth/AuthContext.tsx`, `api/client.ts`.
- **Exploit:** any XSS (none found today, but the risk is permanent) can read the token from `localStorage` and exfiltrate it. No `dangerouslySetInnerHTML`/`eval` exist currently, which is good.
- **Fix:** prefer an `httpOnly`, `Secure`, `SameSite=Strict` cookie for the token (paired with CSRF protection), or accept the tradeoff with a strict CSP as compensating control.

---

## 🟢 LOW / hardening

- **L1. `anyRequest().permitAll()`** (`SecurityConfig`) — anything outside `/api/**` is open by default; a future non-`/api` endpoint would be unauthenticated. Prefer `anyRequest().authenticated()` (or `denyAll()`) as the safe default.
- **L2. Developer email in committed config** — `insiderflow.sec.user-agent` default embeds `zetovicfabio1@gmail.com` in `application.properties` (in VCS). Move to env-only; SEC requires a contact UA but it needn't be committed.
- **L3. CORS `allowCredentials(true)` with Bearer-token auth** — credentials mode isn't needed (no cookies) and must be re-scoped to the real origin on deploy, never `*`.
- **L4. No request body size cap** — a huge JSON body to `/api/auth/*` can pressure memory; set `server.tomcat.max-swallow-size` / a filter limit.
- **L5. Verbose search is a regex query** — mitigated: `buildCriteria` wraps user search in `Pattern.quote`, so ReDoS/regex-injection is **not** exploitable (good). Sort is whitelisted (`SORTABLE_FIELDS`) — also good. Mongo criteria use typed `.is()` values, so NoSQL operator injection is not reachable from string params (good).
- **L6. Scraper CLI args** (`scripts/senate-efd-scraper.js`) take `--since/--out` — local-only, not web-reachable; low risk, but never wire these to untrusted input.
- **L7. No dependency/CVE monitoring** — `npm audit` currently clean (0), backend deps not scanned. Add Dependabot/`mvn versions`/`npm audit` to CI.

---

## What is already done well
- Passwords hashed with **BCrypt** (`SecurityConfig`).
- **No stack traces leaked** to clients (`GlobalExceptionHandler` returns generic 500, logs server-side).
- **Sort field whitelist** and **`Pattern.quote`-escaped** search prevent injection/ReDoS.
- **Login message is generic** ("Invalid email or password") — no message-based enumeration on login.
- JWT signing key is **random per-process when unset** (no shipped default secret to forge with).
- **No `dangerouslySetInnerHTML`/`eval`** in the frontend; React auto-escaping mitigates stored XSS from external (SEC/congress) data.
- **CSRF** correctly disabled for a stateless Bearer-token API (not cookie-based).
- Stateless sessions; no Spring Actuator exposed.

---

## Suggested remediation order for going public
1. **C1, C2, C3** (Mongo auth + no exposed port, real web server for the frontend, TLS proxy) — non-negotiable.
2. **H1, H2, H4** (rate limiting: auth + global API; registration abuse controls).
3. **H3, M1, M2, M5** (input validation on ticker/username/password; security headers).
4. **M3, M4, M6, L1–L4** (enumeration, token lifecycle, header/config hardening).
