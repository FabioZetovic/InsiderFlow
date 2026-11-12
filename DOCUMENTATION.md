# InsiderFlow — Developer Documentation

> **Maintenance rule:** this file is updated with every change to the project. Newest changes are at the top of the [Changelog](#changelog).

## 1. What this app is

InsiderFlow is a locally-run full-stack web app with two main views:

- **Insiders** — every stock trade disclosed by members of the US Congress under the STOCK Act, with filtering, member profiles, sector drill-downs, weekly sector performance, hot-ticker highlighting, and a Pelosi/Trump spotlight.
- **Market Flow** — daily SPDR sector-ETF heatmap, upcoming macro events (FOMC/CPI/PPI/NFP/GDP), S&P 500 quote strip, and this week's earnings calendar.

Access requires a local account (JWT auth, BCrypt-hashed passwords in MongoDB).

## 2. Architecture

```
insiderflow/
├── backend/   Spring Boot 3 (Java 17 target), Maven wrapper included
│   └── src/main/java/com/insiderflow/
│       ├── config/    SecurityConfig (JWT filter chain, CORS for :5173, BCrypt bean)
│       ├── auth/      User model, UserRepository, JwtService (jjwt 0.12), JwtAuthFilter,
│       │              AuthService, AuthController, LoginRateLimiter
│       ├── trades/    Trade model, TradeMapper (pure/testable), TradeIngestionService,
│       │              MemberDirectory (name→canonical+party+committees), CommitteeSectorMap,
│       │              SectorService, TradeService (queries + cached aggregates),
│       │              AnalyticsService (leaderboard + alpha, ticker detail),
│       │              InsightsService (digest, late-filers, clusters, earnings-proximity),
│       │              IngestListeners (post-ingest fan-out), TradeController
│       ├── corporate/ InsiderTrade model, Form4IngestionService (SEC EDGAR), CorporateController
│       ├── watchlist/ Watchlist model, WatchlistController (per-user follows + feed)
│       ├── market/    FinnhubClient, MarketService (sector flow, weekly sectors via Yahoo,
│       │              SPX, earnings, events), PriceHistoryService, MarketController
│       └── common/    ApiException, GlobalExceptionHandler, StatusService/-Controller (freshness)
│   └── src/main/resources/
│       ├── application.properties   all config incl. env-var overrides
│       ├── sectors.json             ~650 ticker → GICS sector seed (S&P 500 + ETFs + populars)
│       ├── legislators.json         1,144 STOCK-Act-era members: canonical name, party, state,
│       │                            aliases, and committee memberships (see scripts/gen-legislators.js)
│       └── market_events.json       2026 FOMC/CPI/PPI/NFP/GDP schedule (editable)
├── scripts/   senate-efd-scraper.js (headless-Chrome eFD scraper), gen-legislators.js
└── frontend/  Vite + React 18 + TypeScript + Tailwind CSS v4 (+ React Router, Axios, Recharts)
    └── src/
        ├── api/         axios client (JWT interceptor, 401 → /login) + typed API functions
        ├── auth/        AuthContext (localStorage token), ProtectedRoute
        ├── watchlist/   WatchlistContext (follows loaded once, shared to star buttons)
        ├── types/       all API response interfaces (no `any` anywhere)
        ├── components/  Layout, TradeTable, FilterBar, Pagination, SectorWeeklyStrip,
        │                SpotlightCards, DigestPanel, WatchButton, SectorHeatmap, ui.tsx (+ flags)
        └── pages/       Login, Register, Insiders, MemberDetail, SectorDetail, TickerDetail,
                         Leaderboard, Signals, Corporate, Compare, Feed, MarketFlow
```

**Datastores (MongoDB `insiderflow` db):**

| Collection | Contents |
|---|---|
| `users` | accounts (email unique, BCrypt hash) |
| `trades` | all congress + presidential trades; unique index on `dedupKey` |
| `insider_trades` | SEC Form 4 corporate-insider transactions (F10) |
| `watchlists` | one doc per user: followed members + tickers (F6) |
| `tickers` | cached ticker → sector resolutions (each Finnhub lookup done once) |
| `price_history` | cached daily close series per ticker (Yahoo, 12 h TTL) — powers ticker chart, leaderboard, alpha |
| `sector_flow` | latest daily quote per sector ETF + SPY |
| `sector_weekly` | weekly (5 trading days) performance per sector ETF |
| `earnings` | this week's earnings calendar entries |

## 3. Data sources & why

| Data | Source | Notes |
|---|---|---|
| Senate trades (≤ Mar 2021) | S3 `senate-stock-watcher-data…` (dead, 403), fallback GitHub `timothycarambat/senate-stock-watcher-data` | The mirror's **last commit is 2021-03-16** — historical only. |
| Senate trades (Mar 2021 →) | **Own scraper** of the official `efdsearch.senate.gov` (`scripts/senate-efd-scraper.js`) | Headless-Chrome based (the site's Akamai CDN blocks plain HTTP clients by TLS fingerprint and blocks the default HeadlessChrome UA — a normal Chrome UA passes). Accepts the eFD agreement, pages the internal DataTables JSON API (report type 11 = PTR), parses each electronic PTR's transaction table. Writes `data/senate_efd_transactions.json` (mirror schema; incremental + resumable). Backend ingests this file on every ingest run. Paper (scanned) filings are skipped. |
| House trades | S3 `house-stock-watcher-data…` (dead, 403), fallback GitHub `TattooedHead/house-stock-watcher-data` | The fallback mirror **commits daily** (~08:20 UTC). Uses `source_url` instead of `ptr_link` — both are read. |
| Trump (President) trades | GitHub `HerringtonDarkholme/trump-portfolio-tracker` `src/data/dataset.json` | Presidents file OGE Form 278-T, not congressional PTRs — that's why Trump was absent from congress data. This dataset is the 2026-05-08 filing (3,642 transactions, Jan–Mar 2026) re-extracted cleanly from the OGE PDF. Ingested as member "Donald Trump", chamber `EXECUTIVE`, with the official OGE PDF as the filing link. Static until he files again. His earlier filings (Feb/Apr 2026) are **scanned-image PDFs** — see the F11 note in the changelog for why they aren't auto-ingested. |
| Corporate insiders (Form 4) | **SEC EDGAR** daily index + Form 4 XML (`Form4IngestionService`) | Officers/directors/10%-owners' own-stock trades. To bound fetch volume, only filings whose CIK maps to a **Congress-traded ticker** are downloaded (via SEC `company_tickers.json`) — the overlap is the point. Startup backfills 45 days, then daily at 07:00 UTC (last 4 days). Requires a descriptive `User-Agent` (SEC fair-access rule); `Accept-Encoding: identity` (the simple request factory doesn't decompress gzip). |
| Member party / state / committees | bundled `legislators.json` from `unitedstates/congress-legislators` | 1,144 STOCK-Act-era members with name aliases + committee memberships. `MemberDirectory` canonicalizes every source's name spelling to one person and attaches party/state; `CommitteeSectorMap` maps a member's committees to the sectors they oversee (conflict flag). Regenerate with `node scripts/gen-legislators.js`. |
| Ticker → sector | `sectors.json` seed, then `asset_type` classification, then Finnhub `/stock/profile2` | Seed from the `datasets/s-and-p-500-companies` GICS dataset + curated ETFs/populars. Non-equity assets (bonds/funds/crypto/options) are classified from `asset_type` before any lookup; remaining unknown tickers resolved via Finnhub post-ingest (rate-limited 1.1 s/call, ≤300/run), cached in `tickers`. |
| Sector ETF daily quotes, SPY, earnings | Finnhub free tier (`FINNHUB_API_KEY`) | Refreshed every 15 min during US market hours (quotes) / daily 05:30 UTC (earnings) + on startup. |
| **Weekly** sector performance | **Yahoo Finance** chart API (`query1.finance.yahoo.com/v8/finance/chart/{symbol}`, keyless, needs a browser User-Agent) | Finnhub free tier has no historical candles, and Stooq now serves an anti-bot JS challenge to non-browsers. Weekly % = last daily close vs close 5 trading days earlier. Refreshed on startup + 06:30/22:30 UTC. |
| Macro events | static `market_events.json` | BLS/Fed publish schedules a year ahead; 2026 seeded. |

**Ingestion details** (`TradeIngestionService`): runs async on startup + daily 06:00 UTC cron, pulling four sources: senate mirror, senate eFD scraper file, house mirror, Trump 278-T dataset. Normalizes everything into one schema (`BUY`/`SELL`/`EXCHANGE`; house `district` → `state`; `Hon.` prefix stripped; control characters stripped; tickers `--`/`N/A` → null, with ticker recovery from descriptions like "Citigroup New Inc (C)"). Each trade is enriched with: canonical member name + party (via `MemberDirectory`), numeric amount bounds (low/mid/high), a suspicious-date flag, disclosure lag + late-filer flag (STOCK Act 45-day rule), and a committee-conflict flag. Dedup via unique `dedupKey` = `member|ticker|transactionDate|amountRange|transactionType` (+ per-filing row number for Trump) with bulk upserts → idempotent re-runs. **Note:** changing the canonical name form (e.g. regenerating `legislators.json`) changes the dedupKey, so the `trades` collection must be dropped and rebuilt after such a change or old-name and new-name duplicates coexist.

**Post-ingest fan-out** (`IngestListeners`, async): refresh freshness timestamps, invalidate the members/sectors aggregate caches, recompute the leaderboard, and run the earnings-proximity enrichment pass.

**Data freshness** (checked 2026-07-08): house mirror commits daily; senate eFD scraper pulls from the official source (2 PTRs already filed in July 2026 were picked up); backend re-ingests everything daily at 06:00 UTC; ETF quotes every 15 min in market hours. The senate scraper itself must run daily too — see §6.

## 4. API reference

All `/api/**` routes except `/api/auth/register|login` require `Authorization: Bearer <jwt>` (24 h expiry). Errors are structured JSON: `{status, error, message, timestamp, fieldErrors}`.

### Auth
| Endpoint | Description |
|---|---|
| `POST /api/auth/register` | email/username/password (regex `^(?=.*[0-9])(?=.*[A-Z]).{8,}$` enforced server-side too) → 201 + JWT |
| `POST /api/auth/login` | → JWT + user info |
| `GET /api/auth/me` | current user |

### Trades
| Endpoint | Description |
|---|---|
| `GET /api/trades?member=&sector=&chamber=&type=&search=&from=&to=&page=&size=&sort=` | paginated (default 50/page, size ≤200). `search` = ticker/company; `from`/`to` = ISO date range; `sort` = `field,dir`. Suspicious-dated rows sort last. |
| `GET /api/trades/members` | distinct members with trade/buy/sell counts + estimated $ volume (cached 10 min) |
| `GET /api/trades/sectors` | distinct sectors with counts, buy/sell split + estimated $ volume (cached 10 min) |
| `GET /api/trades/members/{member}/summary` | totals, top-10 tickers, sector breakdown, estimated volume, party |
| `GET /api/trades/sectors/{sector}/timeline` | per-month buy/sell counts |
| `GET /api/trades/hot-tickers` | tickers bought or sold **>5×** in the **last 90 days**, `highlight: BUY\|SELL` |
| `GET /api/trades/spotlight` | featured members (Pelosi, Trump): totals + 6 recent trades |
| `GET /api/trades/ticker/{ticker}` | **F6/F10** ticker detail: 1-yr price series, per-member activity, recent trades |
| `GET /api/trades/leaderboard` | **F7** members ranked by avg return of last-12-mo buys, with **alpha vs SPY**; async-computed, `computing` flag while building |
| `GET /api/trades/digest?since=` | **F1** new filings since a date (default: last 3 disclosure days) — counts, biggest trades, top tickers, top members |
| `GET /api/trades/late-filers` | **F2** members ranked by STOCK Act late disclosures (count, rate, avg/max lag) |
| `GET /api/trades/clusters?days=&direction=` | **F5** tickers where ≥3 members traded the same direction within ~14 days |
| `GET /api/trades/compare?members=A&members=B` | **F8** side-by-side summaries for up to 3 members |

### Corporate insiders (F10)
| Endpoint | Description |
|---|---|
| `GET /api/corporate?ticker=&type=&page=&size=` | paginated Form 4 trades, filterable by ticker / BUY\|SELL\|GRANT\|OTHER |
| `GET /api/corporate/ticker/{ticker}` | latest 50 corporate-insider trades for one ticker (shown on the ticker page) |

### Watchlist (F6, per-user)
| Endpoint | Description |
|---|---|
| `GET /api/watchlist` | current user's followed members + tickers |
| `POST /api/watchlist/toggle` `{type, value}` | follow/unfollow a member or ticker |
| `GET /api/watchlist/feed?page=&size=` | recent trades by any followed member or on any followed ticker |

### Status & Market
| Endpoint | Description |
|---|---|
| `GET /api/status` | **F12** total trades, last ingest time, per-source freshness, senate-stale + new-Trump-filing flags |
| `GET /api/market/sector-flow` · `sector-weekly` · `events?from=&to=` · `spx` · `earnings` | sector heatmap, weekly perf, macro events, SPY strip, weekly earnings |

## 5. Frontend behavior notes

**Tabs:** Insiders · Corporate · Leaderboard · Signals · Compare · Feed · Market. All lazy-loaded (route-level code splitting). Data-freshness footer + stale-data banners on every page (Layout).

- **Insiders page (top → bottom):** weekly sector strip → **digest panel** (latest filings: biggest trades / top tickers / top members) → Pelosi/Trump spotlight → filter bar (member, sector, chamber, buy/sell, ticker search, date range) → sortable trade table + pagination. Filters + sort live in the URL query string.
- **Trade flags** render on each row: **LATE** (amber, disclosed >45 days after the trade), **COMMITTEE** (violet, member's committee oversees the sector), **EARNINGS** (blue, traded within ~2 weeks before a report), plus the ⚠ suspicious-date icon.
- **Hot-ticker highlighting:** bought >5× in 90 days → **blue** badge; sold >5× → **grey**.
- **Ticker page:** 1-year price chart with green/red congress buy-sell markers, member-activity list, recent trades, and a **corporate insiders (Form 4)** table for the same ticker.
- **Signals page:** STOCK Act late-filers table + buy/sell cluster cards (member/direction/window toggles).
- **Leaderboard:** avg return **and alpha vs SPY** (return in excess of the market over the same holding period — an honest measure; some members are negative).
- **Corporate page:** Form 4 feed with insider name/title (Director, CFO, …), BUY/SELL/GRANT, shares, value, SEC filing link.
- **Compare page:** up to 3 members side-by-side (stats, sector pie, top tickers); selection in the URL.
- **Feed page:** trades by followed members/tickers. Star (☆) buttons on member and ticker pages toggle follows via `WatchlistContext`.
- Every data view has a loading skeleton and an error state with retry. Pagination keeps prior rows visible (dimmed) instead of flashing skeletons.
- Auth: JWT in localStorage; axios interceptor attaches it and redirects to /login on 401; expired tokens dropped at startup.

## 6. Running locally

See [README.md](README.md) for the full setup. Short version:

```
docker run -d --name insiderflow-mongo -p 27017:27017 -v insiderflow-mongo-data:/data/db mongo:7
cd backend  && .\mvnw.cmd spring-boot:run     # port 8080
cd frontend && npm run dev                    # port 5173
```

`FINNHUB_API_KEY` is set as a **user-level Windows environment variable** (set 2026-07-07). New terminals inherit it; if the backend logs "FINNHUB_API_KEY not set", restart the terminal or set `$env:FINNHUB_API_KEY` inline.

Environment: no system Maven (wrapper used), Java 26 JDK (targets 17), Node 22, MongoDB via Docker Desktop (must be started manually).

## 7. Known quirks / decisions

- Both stock-watcher S3 buckets are dead (403) — GitHub mirrors are the de-facto sources (automatic fallback, warning logged).
- Source data has occasional future-dated transaction dates (filing typos, e.g. "Dec 26, 2026") — displayed as-is, and they sort first under transactionDate desc.
- ~13k trades have sector "Unknown": mostly non-stock assets (null ticker) plus unseeded tickers; the Finnhub enrichment pass shrinks the latter after each ingest (300 tickers/run max).
- Finnhub free tier: no historical candles (hence Yahoo for weekly numbers; SPX sparkline degrades to quote-only), 60 req/min (enrichment sleeps 1.1 s between calls).
- Stooq was tried first for weekly closes but now returns a JavaScript proof-of-work challenge to non-browser clients — Yahoo's chart API replaced it.
- Password regex is enforced in both the register UI (live checklist) and the backend DTO validation.
- **Timezone gotcha:** Spring Data MongoDB persists `LocalDate` at *system-zone* midnight, not UTC. Date-range query bounds must be built with `ZoneId.systemDefault()` (not `ZoneOffset.UTC`) or same-day rows are dropped — this bit the digest endpoint (fixed).
- **Member re-canonicalization is now self-healing** (fixed 2026-07-22): the dedupKey uses the raw source member name, so regenerating `legislators.json` updates existing rows in place instead of duplicating. (Previously it embedded the canonical name and required a manual `trades` drop.)
- Corporate insiders (Form 4) are limited to companies Congress also trades — by design, to bound SEC fetch volume and because the cross-over is the interesting comparison.
- SEC requires a descriptive `User-Agent`; gzip must be disabled (`Accept-Encoding: identity`) because the simple HTTP request factory doesn't auto-decompress.

## Changelog

### 2026-11-12 — Corporate tab renamed to Trades
- The tab is now **Trades** at `/trades` (page `pages/Trades.tsx`), since it holds both the congress list and corporate insiders. `/corporate` redirects to `/trades` and keeps its query string, so old links like `/corporate?view=corporate` still work.

### 2026-11-12 — All trades moved to the Corporate tab
- The full congress/President trade list (filters, sort, pagination) moved from Insiders into `components/AllTrades.tsx` and now lives on the Corporate tab. A sliding two-way toggle switches between **All trades** (default) and **Corporate trades** (SEC Form 4, `?view=corporate`). Each view keeps its own URL filters, and switching resets them.
- Insiders is now an overview (hero, sector ring, latest filings, spotlight) with a "Browse all trades" link. Detail-page back links point to the Corporate tab.

### 2026-11-12 — Latest filings redesign
- `DigestPanel` now opens with a KPI strip (new trades, buys, sells and est. volume, all counting up) plus an animated buy/sell balance bar and a live "since" pulse.
- Biggest trades show a buy/sell accent bar, ticker, side and member. Most traded tickers are ranked with sector, volume and a proportional buy/sell split bar. Most active members get party-tinted initials avatars and a relative-volume bar. Bars grow in (`.bar-grow`).

### 2026-11-12 — Hero, footer and finishing touches
- **Insiders hero** (`components/Hero.tsx`): headline, short pitch, live counts (trades tracked from `/api/status`, members, sectors) that count up, two calls to action, and an animated SVG illustration (Capitol line art, growing volume bars, a trend line that draws up to an amber arrow).
- **`CountUp`** (`ui.tsx`): eased number animation, also used for the member, ticker and spotlight buy/sell/trade counts.
- **Page titles** get a short brand-to-amber accent bar. The body background adds a faint dot grid and a warm corner glow.
- **Footer**: logo, blurb, site links, data sources, freshness line and a disclaimer. A **Back to top** button appears after scrolling one screen.

### 2026-11-12 — Layout, motion and brand overhaul
- **Logo**: new SVG mark (magnifier over the Capitol dome, trend arrow, volume bars) in `components/Logo.tsx` (`LogoMark`, `Logo` lockup), used in the header and on the auth pages. `public/favicon.svg` is the same mark on a navy tile.
- **Motion** (`index.css`): page entrance (`animate-rise`, keyed on route), staggered sections (`stagger`), cascading table rows and list items (`rows-in`), hover lift (`lift`), shimmer skeletons, a sliding nav indicator, and animated Recharts charts. All of it respects `prefers-reduced-motion`.
- **Sector ring** (`SectorWeeklyStrip`): replaces the scrollbar strip. Tiles rotate continuously right to left and bend away on a virtual cylinder at the edges. They can be dragged either way with momentum, and rotation pauses on hover. A drag never triggers a tile click.
- **Flat surfaces**: `Card` is now a single-tone section with no border and no rounded corners (`plain` drops the background). All borders, dividers, rings and radii were removed app-wide. Inputs are filled rather than outlined. Tables keep their structure with soft zebra rows and no lines.
- **Grouped layouts**: Insiders puts Latest filings and Spotlight in one row. Leaderboard has a "Top alpha" side column. Feed puts the followed members and tickers beside the feed. Member detail puts the sector and ticker panels beside the trades. Ticker detail puts the chart beside member activity and the trades beside the SEC Form 4 insiders. Sector detail puts the chart beside the trades. Market Flow puts the heatmap beside the S&P 500 and events, with earnings in day columns. Signals uses two columns from `lg`.
- **No emoji or decorative icons**: nav, headings, banners, flags and spotlight are text-only. The star watch toggle is now a Follow / Following button. Filing links, pagination and back links are words. Only the search, dropdown and sort-direction glyphs remain.
- New `ui.tsx` helpers: `PageHeader`, `SectionLabel`, `Stat`.

### 2026-11-12 — Demo mode on by default
- `insiderflow.auth.demo-mode` (`DEMO_MODE`) now defaults to `true` in `application.properties`, `AuthService` and `docker-compose.yml`, so anyone running the public project signs in with any email and password. CI sets `DEMO_MODE=false` so the Bruno security tests still exercise real-credential auth.
- The login and register error fallbacks no longer say "is the backend running?". The demo-mode banner uses the brand color.

### 2026-11-12 — Visual redesign: color system
- **Design tokens** in `frontend/src/index.css` (`@theme`): `ink` navy-slate neutrals; **primary `brand` indigo** (`#5b57e8`/`#7472f8`) for nav, buttons, links, focus and the logo; **secondary cyan** (`#22b5d2`) for informational tags (earnings, exchanges, BMO); **accent amber** (`#e9a323`) for highlights (hot tickers, LATE flags, warnings); semantic **`up`/`down`** green/red for buys/gains and sells/losses only.
- Branding no longer shares green with "buy". Party colors (D blue, R red) are unchanged; Independent is neutral now that violet is gone.
- Recharts colors (axes, grids, tooltips, pie palettes) use the same tokens. Inter and JetBrains Mono load from Google Fonts. Numbers use tabular figures. The header, nav and cards were refined.
- Added `react-is` as an explicit dependency (recharts peer dependency). It was missing from the lockfile, and the build failed without it when `legacy-peer-deps` was on.
- `.gitignore` and `.env.example` files are no longer tracked (kept locally).

### 2026-07-22 — Security hardening + Bruno API tests + deploy readiness
Full remediation of the security audit ([docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md)) — all Critical/High findings fixed, verified live, and covered by tests.
- **MongoDB locked down** (C1): compose runs `mongod --auth` with creds from `.env`, host port removed (internal-only). Verified external `ECONNREFUSED`.
- **Global API rate limiting** (H4): `RateLimitFilter` 120 req/min/IP over `/api/**` (verified 429 under burst). **Login limiter** now per-IP + per-account (H1).
- **Auth hardening**: constant-time login + generic message (M3), `tokenVersion` revocation + `POST /api/auth/logout-all` (M4), `registration-enabled` flag (H2), input validation on username/password/ticker (M1/M2/H3), security headers CSP/HSTS/frame/nosniff (M5), `authenticated()` default (L1), CORS env-driven + credentials off (L3), body-size caps (L4).
- **Deploy config**: frontend API base URL via `VITE_API_URL`; backend CORS via `CORS_ALLOWED_ORIGINS`; `X-Forwarded-*` honored; frontend Dockerfile → nginx production build; `vercel.json` (SPA rewrites + headers); `.env.example`. See [DEPLOYMENT.md](DEPLOYMENT.md).
- **Tests**: 30 backend unit tests (added rate-limiter + ticker-validation) and a **Bruno collection** (`tests/bruno/`, 36 requests / 67 assertions) covering every endpoint + security behaviors; wired into `.github/workflows/ci.yml`.

### 2026-07-22 — Fixes: self-healing dedup, See Remarks, earnings links, PMM ticker
- **Self-healing member dedup** — `dedupKey` now uses the **raw source member name** instead of the canonical one. Regenerating `legislators.json` (which can change a member's canonical display name) no longer creates duplicate documents; the existing row updates in place and its `member` field is overwritten with the new canonical name. Eliminates the previous need for a manual `db.trades.drop()`. (Deploying this change once required a single re-ingest since the key scheme changed.)
- **Ticker page renders for corporate-only tickers** — `GET /api/trades/ticker/{t}` no longer 404s when a ticker has no congress trades but does have price history (or Form 4 data). It 404s only when there's genuinely nothing. Fixes the dead-end when clicking a ticker (e.g. PMM) from the Corporate tab or Earnings list.
- **"See Remarks" corporate-insider titles cleaned** — Form 4 filers often put placeholder strings ("See Remarks", "See remarks below", "See footnotes", "N/A") in the `officerTitle` field. `Form4IngestionService.titleOf` now detects these and falls back to the role (Director / Officer / 10% Owner / "Director & 10% Owner").
- **Earnings tickers are links** — the Market Flow → Earnings-this-week list now links each ticker to its detail page.
- **PMM/BofA note:** verified the "Bank of America 10% owner of PMM" display is correct SEC data — "10% Owner" is a regulatory threshold (banks hold >10% of many small closed-end funds via brokerage arms), not a takeover. No code change.

### 2026-07-20 — Feature expansion F1–F11 (analytics, corporate insiders, watchlists)
Eleven new features across data-quality, analytics, and a whole new data source. New backend packages `corporate/` and `watchlist/`; new services `AnalyticsService`, `InsightsService`, `MemberDirectory`, `CommitteeSectorMap`, `Form4IngestionService`, `StatusService`; new frontend pages Signals, Corporate, Compare, Feed + DigestPanel, WatchButton.

- **F1 Daily digest** (`/api/trades/digest`) — DigestPanel on the Insiders home: latest filings with biggest trades, most-traded tickers, most-active members. Defaults to the last 3 disclosure days.
- **F2 Late-filer accountability** (`/api/trades/late-filers`) — ranks members by STOCK Act late disclosures (>45-day lag). Shown on the Signals page. (Trump 83% late, David Perdue 100% in current data.)
- **F3 Committee conflict flags** — `legislators.json` regenerated with committee memberships; `CommitteeSectorMap` flags a trade when the member's committee oversees the sector (e.g. Armed Services → Industrials). Violet COMMITTEE badge on rows.
- **F4 Dollar-weighting** — `amountMid` summed into estimated-$ volume on member stats, sector stats, member summary, and the digest.
- **F5 Buy/sell clusters** (`/api/trades/clusters`) — detects ≥3 members trading the same ticker within ~14 days. Signals page (SPCX, ABT, ZTS, AMD clusters found).
- **F7 Alpha vs SPY** — leaderboard now shows return in excess of the S&P over the same holding window (honest measure; some members negative). Uses cached SPY history.
- **F9 Earnings-proximity flag** — post-ingest pass pulls the recent Finnhub earnings calendar and flags trades made ≤14 days before a report (blue EARNINGS badge). `nearEarnings` uses `setOnInsert` so re-ingest doesn't clobber it.
- **F6 Watchlists + My Feed** — per-user `watchlists` collection; star buttons on member/ticker pages (`WatchlistContext`); Feed tab shows trades by followed members/tickers.
- **F8 Member comparison** (`/api/trades/compare`) — Compare tab, up to 3 members side-by-side with sector pies and top tickers.
- **F10 SEC Form 4 corporate insiders** — new EDGAR ingestion (`Form4IngestionService`): daily index → Form 4 XML for Congress-traded CIKs only; Corporate tab + a section on each ticker page. ~7k insider trades ingested (officers/directors, real BUY/SELL/value/filing links).
- **F11 Trump's earlier filings — deliberately NOT auto-ingested.** The Feb 26 & Apr 20 2026 OGE 278-T PDFs are **scanned images** with no text layer (pdftotext yields ~8 chars); the community tracker author measured 47% wrong dates from OCR and had to re-extract via AI vision. Ingesting raw OCR would corrupt the clean dataset, so these are left as reference links only. The Trump filing-watcher (`StatusService`) still detects when new OGE filings appear.

Two bugs found & fixed during verification: (1) SEC `company_tickers.json` failed to parse because gzip wasn't decompressed → `Accept-Encoding: identity`; (2) digest returned 0 because date bounds used UTC instead of system-zone midnight. Backend unit tests now 24 (added `CommitteeSectorMapTest`, late-disclosure cases). Frontend bundle still code-split; type-check clean.

**Known follow-up:** regenerating `legislators.json` (1,253 → 1,144 members, +committees) changed some canonical name forms, so the live `trades` collection has stale-name/new-name member duplicates (e.g. "Angus King" vs "Angus S. King, Jr."). Fix is a `trades` drop + re-ingest with the current directory — pending user approval of the destructive DB op.

### 2026-07-19 — Auto-restart policies
- Added `restart: unless-stopped` to all three Docker Compose services — once Docker Desktop is set to start on sign-in, the stack survives reboots without manual intervention. (Context: three reboots in a row required manually restarting Docker/Mongo/backend.)
- Daily catch-up run: senate scraper filled the July 9–19 gap (4 PTRs, 24 transactions); house mirror +53 trades; total now 38,055.

### 2026-07-08 — The big 18: data quality, analytics, UX, and engineering health
All 18 improvement suggestions implemented in one pass:

**Data correctness**
1. **Member identity normalization** — new `legislators.json` resource (generated from `unitedstates/congress-legislators`, 1,253 STOCK-Act-era members, 2,424 name aliases) + `MemberDirectory` service. "Shelley M Capito" (eFD), "Shelley Moore Capito" (mirror), "Pelosi, Nancy", "Hon. …" all canonicalize to one member during ingestion — no more split trade histories.
2. **Party & full state for everyone** — resolved from the same directory; `party` now populated on trades, member stats, summaries, spotlight; D/R/I badges throughout the UI.
3. **Smarter sector classification** — `TradeMapper.classifyNonEquity` buckets bonds/munis/treasuries → "Fixed Income", funds/ETF-like → "Fund", crypto → "Crypto", options/real-estate/trusts → "Other Assets" before any Finnhub lookup; only real stocks hit GICS resolution.
4. **Suspicious-date flag** — `suspiciousDate=true` when transaction date is after disclosure date or >30 days in the future (filing typos); flagged rows sort last and show an amber warning icon.
5. **Numeric amounts** — `amountLow/Mid/High` parsed from every range; enables amount sorting and the "Est. volume" stat on member pages.

**Features**
6. **Ticker detail page** (`/insiders/ticker/:ticker`, `GET /api/trades/ticker/{t}`) — 1-year price chart (Yahoo, cached 12h in `price_history`) with green/red congress buy/sell markers, member activity list, recent trades. Every ticker in the app links to it.
7. **Trader leaderboard** (`/leaderboard`, `GET /api/trades/leaderboard`) — members ranked by average return of last-12-months buys vs latest close (min 5 scored buys, top-400 tickers priced per run). Computed async after each ingest; frontend polls while computing.
8. **Trump filing watcher** — daily check of the OGE Domino JSON index for a 278-T newer than 2026-05-08; sets a flag in `/api/status` and the UI shows a banner.
9. **Search + date range** — `search=` (ticker prefix or company-name regex) and `from=`/`to=` params on `/api/trades`; debounced search box and date inputs in the filter bar.
10. **Sortable headers** — click column headers to sort (member/ticker/type/amount/date/sector, asc/desc), wired to the existing backend sort.

**UX**
11. **Mobile layout** — trade table renders as cards below the `md` breakpoint.
12. **Freshness indicator** — `GET /api/status` reports total trades, last ingest, per-source freshness; footer shows it, and amber/blue banners warn when the senate scraper file is >3 days old or a new Trump filing is detected.
13. **Smooth pagination** — previous rows stay visible (dimmed) while the next page loads; skeletons only on first load.

**Engineering**
14. **Unit tests** — 18 tests over `TradeMapper` (dates, types, tickers, amounts, classification, dedup) and `MemberDirectory` (alias resolution). One real bug found & fixed: "Stock Option" was classified as equity.
15. **Docker Compose** — `docker compose up -d` runs Mongo+backend+frontend (Dockerfiles added for both apps).
16. **Aggregate caching** — `/members` and `/sectors` cached 10 min, invalidated by the post-ingest event.
17. **Code splitting** — all pages lazy-loaded; main bundle 688 KB → 266 KB, Recharts loads only on chart pages.
18. **Auth hardening** — per-IP+email sliding-window rate limit (10 fails/10 min) on login/register; JWT secret now defaults to a random per-process key (set `JWT_SECRET` for persistent sessions).

Ingestion pipeline refactor: mapping logic extracted to `TradeMapper` (pure, testable); `IngestCompletedEvent` drives cache invalidation + leaderboard recompute + freshness timestamps.

### 2026-07-08 — Trump trades, Senate eFD scraper, Insiders redesign, centered heatmap
- **Trump's trades are in**: 3,642 transactions from his 2026-05-08 OGE Form 278-T filing (Jan–Mar 2026) ingested from the cleaned `trump-portfolio-tracker` dataset as chamber `EXECUTIVE`. His spotlight card now shows real data (2,346 buys / 1,296 sells) and a "President" toggle was added to the chamber filter.
- **Senate data freshness fixed**: discovered the senate mirror died 2021-03-16 (house mirror commits daily, so house was fine). Built `scripts/senate-efd-scraper.js` (headless Chrome, resumable, incremental saves) against the official eFD site and backfilled 633 PTRs / 5,575 transactions from Mar 2021 → today. Backend ingests the scraper's output file each run. The scraper should run daily — scheduling it via Task Scheduler needs the user to run one command (see §6).
- **Insiders page redesigned** for readability: page title + subtitle, labeled sections (Spotlight / All trades), filter bar moved into the table card, two-line member and asset cells, merged transaction/filed date column, zebra striping, sticky table header, roomier padding.
- **Market Flow heatmap** now centers incomplete bottom rows (flex layout instead of grid).
- Ticker recovery added for eFD-style descriptions ("Citigroup New Inc (C)" → ticker `C`) when the ticker column is "--".

### 2026-07-08 — Screenshots, earnings-list fix
- Fixed the earnings list's per-day sticky header (`top-14` → `top-0` inside its scroll container — it previously floated over the rows).
- Added real screenshots (`docs/screenshot-insiders.png`, `docs/screenshot-market.png`) and wired them into README; captured via a headless-Chrome script.
- Verified Finnhub sector enrichment is working: trades with sector "Unknown" dropped 13,313 → 10,886 after the first enrichment passes (continues shrinking ~300 tickers per ingest run).

### 2026-07-07 — Weekly sectors strip, hot tickers, spotlight, Finnhub key
- Set `FINNHUB_API_KEY` as user-level env var; backend now runs with live Finnhub data (sector heatmap, SPX strip, earnings, sector enrichment all active).
- **New: weekly sector performance strip** at the top of the Insiders page — 11 SPDR sector ETFs, up/down arrow + weekly %, green/red cards, click-through to the sector's congress trades. Backend: `sector_weekly` collection fed from Yahoo Finance daily closes (keyless; Stooq was tried first but blocks non-browser clients), `GET /api/market/sector-weekly`, refresh on startup + 06:30/22:30 UTC.
- **New: hot-ticker highlighting** — tickers bought >5× in the last 90 days render blue, sold >5× render grey in the trade table (tooltip with counts). Backend: `GET /api/trades/hot-tickers` aggregation.
- **New: spotlight cards** for Nancy Pelosi and Donald Trump above the trade table — party-colored cards with recent trades and buy/sell totals; Trump shows an explanatory empty state (no congressional PTR filings exist for him).
- Created this documentation file.

### 2026-07-07 — Initial build
- Full-stack app built from spec: Spring Boot 3 backend (JWT auth, congress-trade ingestion, Finnhub market data, global error handling), Vite/React 18/TS frontend (dark dense UI, login/register with live password checklist, Insiders + Market Flow tabs, member/sector detail pages with Recharts).
- Ingestion verified against live sources: 7,887 senate + 23,618 house trades. S3 buckets found dead (403); GitHub fallbacks wired (`TattooedHead/house-stock-watcher-data` found as replacement house mirror) and verified.
- Sector seed (`sectors.json`, ~650 entries with real GICS sectors) generated from the s-and-p-500-companies dataset + curated ETF/popular-ticker additions.
- Control-character sanitization added for house mirror's PDF-extraction artifacts.
- End-to-end verified in browser: register/login, trade table, member detail (pie chart, top tickers), Market Flow (events calendar; Finnhub widgets showed error states pre-key).
