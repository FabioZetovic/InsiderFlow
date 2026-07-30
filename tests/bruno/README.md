# Bruno API tests

End-to-end API tests for every InsiderFlow endpoint, plus security behaviors (401 on
unauthenticated, 400 on invalid input, generic login errors, security headers, token
revocation). 36 requests / 67 assertions.

## Run

Requires a running backend on `http://localhost:8080` (`docker compose up -d`).

```bash
npm install -g @usebruno/cli
cd tests/bruno
bru run --env local
```

Or open the folder in the [Bruno desktop app](https://usebruno.com) and run the collection.

## Structure
- `01-auth` — register / login (captures token) / me / (logout-all is in `08-cleanup`)
- `02-trades` · `03-corporate` · `04-watchlist` · `05-market` · `06-status` — all endpoints
- `07-security` — unauthenticated→401, invalid-ticker→400, bad-login→401 (generic), weak-password→400, security headers
- `08-cleanup` — logout-all (runs last; invalidates the token)

Folders run in numeric order; `02-login` stores the JWT in the `token` env var used by the rest.
CI runs this suite against a live backend — see `.github/workflows/ci.yml`.
