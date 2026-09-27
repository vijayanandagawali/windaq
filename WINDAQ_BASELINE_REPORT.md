# WinDaq — Baseline Report

**Date:** 2026-09-27 · **Commit:** `94372a5` · **Machine:** Windows 10, Node v24.21.0, npm 11.19.0
Nothing was modified to make the checks pass. Failures are recorded as-is.

## 1. Available scripts

| Where | Script | Notes |
|---|---|---|
| root | `dev`, `build`, `lint` | Fan out to workspaces (`--if-present`). Only `apps/web` defines `build`/`lint` |
| root | `test:e2e` → `playwright test` | `@playwright/test` **not installed**, so it can't run |
| root | `bootstrap:sandbox`, `teardown:sandbox`, `db:reset-and-seed` | Write to the DB in `.env` (not run during the baseline; see correction below) |
| apps/web | `dev`, `build`, `start`, `lint` | No `typecheck` script; ran `tsc --noEmit` directly |
| services/realtime | `start` | `test` is the npm placeholder (`exit 1`) |
| services/wallet | `postinstall: prisma skills sync` | No test script |

There's no `typecheck`, no unit-test script and no CI workflow anywhere in the repo.

## 2. Results

| Check | Command | Result | Details |
|---|---|---|---|
| Install | (existing `node_modules`) | ✅ present | Reinstall not needed; `npm audit` reports **0 known vulnerabilities** |
| Typecheck (web) | `npx tsc --noEmit -p apps/web` | ✅ **PASS** (exit 0) | Backend is plain JS, so there's no typecheck |
| Lint (web) | `npx eslint .` in `apps/web` | ❌ **FAIL** (exit 1) | **70 errors, 587 warnings** (breakdown below) |
| Build (web) | `npx next build` | ✅ **PASS** | 60 static pages + 29 dynamic API routes generated |
| Backend boot | not started | ⚠️ **SKIPPED** | Starting `services/realtime` immediately runs game loops that **write to the DB in `.env`** (`GameRound`, `ResultHistory`). There's no isolated test DB, so I didn't boot it |
| DB connectivity | Prisma `SELECT 1` (read-only) | ✅ reachable | 199 users, 193 wallets, 192 ledger tx, 285 statement tx, 4,305 rounds |
| Unit tests | — | ❌ **NONE EXIST** | |
| E2E | `npm run test:e2e` | ❌ **CANNOT RUN** | `@playwright/test` missing. 36 specs present; many target live URLs or use sandbox headers against the `.env` DB |
| Visual sweep | Scratchpad Playwright 1.63 (not added to repo) against `next start` on :3100, **frontend only** | ✅ completed | Results in `WINDAQ_UI_UX_AUDIT.md` |
| Live smoke (read-only GETs) | `curl` | ⚠️ see §5 | |

### Lint breakdown (apps/web)
| Rule | Count | Level |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 296 | warning |
| `@typescript-eslint/no-explicit-any` | 268 | warning |
| React Compiler: setState synchronously in effect | 42 | error |
| `react-hooks/exhaustive-deps` | 21 | warning |
| `react/no-unescaped-entities` | 10 | error |
| React Compiler: impure function during render (`Date.now`/`Math.random`) | 10 | error |
| React Compiler: variable accessed before declaration | 5 | error |
| React Compiler: refs accessed during render | 2 | error |
| `prefer-const` | 1 | error |

Most affected files: `admin/tables/page.tsx`, `hooks/useUniversalRound.ts`, `hooks/useAnimationOrchestrator.ts`, `games/[slug]/page.tsx`, `admin/games/page.tsx`, `wallet/page.tsx`, `games/slots/page.tsx`.

## 3. Financial reconciliation baseline (read-only SQL)

| Metric | Value |
|---|---|
| Wallets | 193 |
| Wallet balance == ledger net (`USER:<id>` credits − debits) | **2** |
| Mismatched wallets | **191** |
| Wallet balance with no ledger backing | **₹19,77,445.00** (197,744,500 paise) |
| Negative balances | 0 |
| `SYSTEM:WAGER_RESERVE` net | ₹3,100 (table-game losses never released) |
| `SYSTEM:REVENUE` net | −₹8,590 |
| `SYSTEM:EXTERNAL_BANK` net | −₹4,500 |
| Statement `Transaction` rows | 243 BET_PLACE, 31 BET_WIN, 7 DEPOSIT, 2 WITHDRAWAL, 2 REFUND |
| PaymentIntents | 22 MOCK_UPI deposits stuck `PENDING`; 4 "PhonePe" + 1 "UPI" deposits and 1 withdrawal marked `SUCCESS` with no real provider integration |
| Bets by table | table 120, slot 15, wager 11, roulette 3, colour 2, lotto 1, dice 0, scratch 0, blackjack 0 |
| Last `GameRound` written | 2026-09-21 08:31 UTC (no engine has run since) |

**Interpretation:** the ledger can't currently be used as the source of truth. The drift comes from balances seeded without ledger entries (login ₹500, default ₹10,000, guest ₹50,000) and from game paths that update `Wallet.balance` directly.

## 4. Performance baseline
Not measured in this pass. There was no running backend, and Lighthouse wasn't run. Page load timings from the visual sweep (local `next start`, frontend only) are in the UI audit. **No performance claims should be made yet.**

## 5. Live deployment probes (GET only)

| Probe | daqwon.in | windaq.vercel.app |
|---|---|---|
| `/` | 200 (0.63 s) | 200 (0.81 s) |
| `/api/ledger/balance` (no auth) | **200 with fabricated ₹10,000 balance** | 404 NOT_FOUND |
| `/api/games/roulette/history/latest` | 200, empty history | 404 |
| `/api/realtime/socket.io` | serves Next.js HTML (**realtime service not reachable**) | 404 |
| `/api/auth/me` with a forged unsigned `windaq_` token claiming SUPER_ADMIN | **200 — accepted as SUPER_ADMIN** | — |

## 6. Why some checks were deliberately not run
- **Backend boot, sandbox bootstrap, E2E, `test_*.js` scripts:** all of them write to the `DATABASE_URL` in `.env`, which I wrongly believed was a remote Postgres. **Correction:** it was the owner's local Postgres (`localhost:5432/windaq`); it was later wiped by an agent error in phase 2. Tests now use disposable databases from `npm run db:local`. There's no evidence that it's a disposable test DB. Running them could corrupt financial records.
- **Recommendation before the next phase:** provision an isolated Postgres (local Docker or a separate Neon/Supabase branch) with `DATABASE_URL_TEST`, then run the backend and E2E against it.
