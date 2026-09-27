# Testing WinDaq

All automated tests use **disposable local databases** and **play money**. Nothing here may point at
a real player database.

## 1. Local databases (no Docker needed)

```bash
npm run db:local
```

Starts PostgreSQL 15 on `127.0.0.1:55432` (data in git-ignored `.local/pgdata`), creates two UTF-8
databases, pushes the Prisma schema to both and prints:

| Database | Variable | Used by |
|---|---|---|
| `windaq_dev` | `DATABASE_URL` in `.env` | `npm run dev`, seed scripts |
| `windaq_test` | `DATABASE_URL_TEST` | backend tests and E2E (wiped on every run) |

Keep it running in its own terminal.

## 2. Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` for the web app |
| `node scripts/lint-ratchet.js` | ESLint for the web app; fails if errors or warnings exceed `lint-baseline.json` |
| `npm run test:backend` | 41 integration tests (auth, payments, authorization, Aviator, sockets) against `DATABASE_URL_TEST` |
| `npm run test:e2e` | Playwright: boots the real backend + a production build of the web app against `DATABASE_URL_TEST` |
| `npm run test:e2e:legacy` | The pre-audit Playwright specs in `tests/*.spec.js` (many target live URLs; kept for reference) |

Example (bash):
```bash
export DATABASE_URL_TEST=postgresql://windaq:windaq_local@127.0.0.1:55432/windaq_test
npm run test:backend
npm run test:e2e
```

## 3. Safety rails
- **Test harnesses** (`services/realtime/tests/helpers.js`, `tests/e2e/support/start-backend.js`) refuse to run unless
  `DATABASE_URL_TEST` is set, is on a local host, and differs from `.env`'s `DATABASE_URL`.
- **DB-writing scripts** (seeders, `test_*.js`, `reset_and_seed_db.js`, …) and the realtime server in non-production
  go through `services/realtime/src/config/dbSafety.js`:
  - remote hosts are refused unless `WINDAQ_ALLOW_REMOTE_DB_WRITE=<exact hostname>`;
  - **destructive** scripts (`db:reset-and-seed`, `teardown:sandbox`) additionally require
    `WINDAQ_CONFIRM_DESTRUCTIVE=<database name>` — even on localhost — and never run with `NODE_ENV=production`.
- E2E runs the backend with `NODE_ENV=development` and a dev-only fixed OTP; production never honours a fixed OTP.

## 4. What the suites cover
- **Backend** (`services/realtime/tests/README.md`): no mock tokens or universal OTPs, forged/unsigned tokens rejected,
  deposits credited only after finance approval (exactly once under concurrency), withdrawal holds and review,
  admin route authorization, server-authoritative Aviator settlement, socket room isolation. Wallet == ledger is
  asserted after every money movement.
- **E2E** (`tests/e2e`): proxy security (no fabricated balances, stripped sandbox headers), deposit → finance approval
  in the admin UI, withdrawal rejection returning funds, and a live Aviator round (bet → cashout or loss) where the UI
  balance matches the server.

## 5. CI
`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:
1. **web** — typecheck, lint ratchet, production build
2. **backend** — Postgres 15 service, schema push, `npm run test:backend`
3. **e2e** — Postgres 15 service, Playwright Chromium, `npm run test:e2e` (report uploaded on failure)
