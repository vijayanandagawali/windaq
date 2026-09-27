# WinDaq — Repository Forensic Audit

**Audit date:** 2026-09-27 · **Commit audited:** `94372a5` (branch `main`, clean tree)
**Method:** Direct code inspection, read-only database queries, local build, read-only probes of the live deployment (`daqwon.in`, `windaq.vercel.app`). No code was modified.

> **Bottom line:** The repository contains a large amount of code, but the financial core is **not safe for real money**. Several endpoints let any logged-in user create balance out of nothing, anyone can mint an admin session, and the live production site runs games **entirely in the browser with `Math.random()`** while showing a fabricated balance. Earlier "COMPLETE / VERIFIED" reports in the repo (`WINDAQ_WALLET_*.md`) do not match the code.

---

## 1. Detected stack

| Layer | Actual implementation |
|---|---|
| Monorepo | npm workspaces (`apps/*`, `packages/*`, `services/*`). No Turborepo/Nx. |
| Frontend | **Next.js 16.3.5** (App Router), React 19.2.8, TypeScript 5 (`strict`), Tailwind CSS 4, Zustand 5, framer-motion 13, socket.io-client 4.8, lucide-react, canvas-confetti, react-hot-toast |
| Frontend API | 29 Next.js route handlers in `apps/web/src/app/api/**`. Mostly **proxies** to the realtime service; auth routes are a **separate, fake auth system** (see §6) |
| Backend | `services/realtime` — Express 5 + Socket.io 4.8 (CommonJS JS, no TypeScript), helmet, cors, express-rate-limit, jsonwebtoken |
| Database | PostgreSQL via **Prisma 5.22**. Schema: `services/wallet/prisma/schema.prisma` (~50 models). The client is generated at the repo root. |
| Cache | Redis is **mocked in memory** (`services/realtime/src/config/redisClient.js`). Real Redis is never used. |
| Game engines | `services/realtime/src/services/**` plus `packages/{poker-engine,slot-engine,teenpatti-engine,provably-fair}` |
| Legacy stack | `server/` (Express + SQLite + JSON-file wallet) and `public/` (vanilla JS SPA). Still in git, still referenced by `Dockerfile.backend`, `ecosystem.config.js`, `deploy.sh` and nginx config |
| Empty workspaces | `services/api`, `packages/ui`, `packages/config` contain only a `package.json` |
| Deployment | Vercel (`vercel.json` "services" config: `web` = Next app, `realtime` = Express). The project is linked to Vercel project `windaq`. There's also an **older VPS path** (PM2 + nginx + `deploy.sh`) that references a non-existent `frontend/` directory |
| Tests | 36 Playwright specs in `tests/` (`@playwright/test` **is not installed**), 12 ad-hoc Node scripts `services/realtime/test_*.js`. No unit-test runner (no Jest/Vitest). No CI configuration. |

## 2. Architecture (as actually wired)

```
Browser (Next.js pages, Zustand stores)
  │
  ├── fetch('/api/auth/*')  ──► Next.js route handlers  ──► FAKE auth (unsigned base64 tokens, hard-coded balances)
  ├── fetch('/api/ledger/*', '/api/games/*', '/api/admin/*')
  │        └► Next.js proxy ──► REALTIME_URL (defaults to http://localhost:4000)
  │                              └► on failure: some proxies return FABRICATED data (e.g. balance ₹10,000)
  ├── fetch(getApiUrl('/api/payments|...')) on non-localhost → relative path → Next.js → 404 (no such route)
  │
  └── getGameSocket(WS_BASE_URL)
          ├─ localhost: real socket.io → services/realtime :4000
          └─ any non-localhost host whose URL contains "localhost:4000" → VirtualGameSocket
               (IN-BROWSER game simulator: Math.random outcomes, mutates Zustand balance)

services/realtime (Express + Socket.io, single process, in-memory state)
  ├── REST: /api/auth, /api/ledger, /api/payments, /api/wager, /api/admin/*, /api/sports/admin, ...
  ├── Socket handlers per game (sockets/*.js)
  ├── Timed engines started in server.js (aviator, colour 1m/3m, lotto, dice, DT, roulette, AB, live roulette)
  ├── RoundRegistry / UniversalRoundEngine (GameRound + ResultHistory)
  └── Prisma → PostgreSQL (remote; DATABASE_URL in root .env)
```

On the **live site**, `/api/realtime/socket.io` and `/socket.io` return the Next.js HTML page, and `/api/ledger/balance` returns the fabricated ₹10,000 fallback. So the realtime backend is **not reachable in production**, and every game there runs in `VirtualGameSocket`. No `GameRound` row has been written since **2026-09-21 08:31 UTC**.

## 3. Important directories

| Path | Purpose | Notes |
|---|---|---|
| `apps/web/src/app` | Next.js pages (≈60 routes) + API route handlers | 18 game pages, wallet, profile, admin (13 pages) |
| `apps/web/src/lib/gameSocket.ts` | Real socket factory + **VirtualGameSocket** client-side simulator (658 lines) | Financial-integrity hazard |
| `apps/web/src/lib/gameArtwork.ts`, `defaultCatalog.ts` | Two overlapping game catalogs | Duplicated configuration; names third-party brands |
| `apps/web/src/store/*` | Zustand: auth, wallet, bet slip, audio | Wallet store has `addWinnings`/`deductBalance` client mutators |
| `services/realtime/src/api` | 17 Express routers | Several missing authorization (see §7) |
| `services/realtime/src/sockets` | 15 socket handlers | Some trust client `userId` / payout |
| `services/realtime/src/services` | Engines, wallet, payments, reconciliation, simulation | `walletService.js` is the only ledger-aware path |
| `services/wallet/prisma/schema.prisma` | Single source DB schema | No migrations folder (schema pushed with `db push`) |
| `packages/*` | Poker/slot/teen-patti/provably-fair engines | `provably-fair` depends on `crypto-js` though Node `crypto` is used elsewhere |
| `server/`, `public/` | Legacy stack | Contains an **RTP rigging switch** (`admin_profit` mode) at an unauthenticated endpoint; tracked SQLite WAL files and `wallet_data.json` with phone numbers |
| `tests/` | Playwright specs | Many target live URLs and depend on sandbox headers |

## 4. Major modules

### Wallet / ledger
- `Wallet` holds integer paise `BigInt` balances (good), with `lockedBalance`, `pendingWithdrawal`, and so on.
- `LedgerTransaction` is a debit/credit pair table with a unique `idempotencyKey` (good design).
- `walletService.js` uses `SELECT … FOR UPDATE` row locks and ledger entries for `placeBet`, `settleWin`, `refundBet`, deposits and withdrawals (good).
- **However**, most games (colour, dice, lotto, slots, scratch, poker, teen patti, rummy, blackjack, aviator) and the payment service **mutate `Wallet.balance` directly** and skip the ledger (18 call sites). Several do it without row locks.
- `Transaction` (the statement table) has no `balanceBefore` and no `status`.
- **Measured drift (read-only query):** 191 of 193 wallets don't match their ledger account, and **₹19,77,445 of wallet balance has no ledger backing**. The cause is auto-provisioned balances (₹500 on login, ₹10,000 default, ₹50,000 guests) that are created with no ledger entry, plus the game paths that bypass the ledger.

### Payments
- Two parallel paths:
  1. `/api/ledger/deposit/instant` and `/withdraw/instant` are what the UI uses. **They credit or pay out immediately on the client's request, with no provider verification.**
  2. `/api/payments/*` with `paymentService` + `mockUpiAdapter` has webhook HMAC verification, but the secret has a hard-coded fallback, the comparison is not constant-time, and the HMAC is computed over re-serialized JSON rather than the raw body.
- The only adapter is `MOCK_UPI`. No real gateway (Cashfree/Easebuzz/PhonePe) is integrated, although `PaymentIntent` rows labelled `PhonePe` exist in the DB.

### Admin
- 13 admin pages in Next.js, plus RBAC middleware (`requireRole`) that reads the role from the DB. Good in principle, but it can be bypassed (see §7).
- Wallet adjustments use a request/approve workflow with an audit log (good pattern).
- Result correction endpoint exists and is **unauthenticated**.

### Realtime
- Socket.io with optional JWT auth: unauthenticated clients connect as `guest`.
- `join_room` lets **any socket join any room**, including `user:<otherUserId>` and `admin:realtime`.
- Wallet events are **broadcast to every connected socket** (`globalIo.emit`), which leaks every user's balance and ids.
- Sequence numbers exist in `CoreSocketManager.emitToRoom`, but reconnect snapshots are stubbed (commented out).
- All state is held in process memory, so the service can't run more than one instance and doesn't survive serverless.

## 5. Database
- PostgreSQL (remote host configured in `.env`), about 50 models. No `prisma/migrations` directory, so there's no migration history.
- Live row counts: 199 users, 193 wallets, 192 ledger transactions, 285 statement rows, 4,305 game rounds, 6 non-USER (admin) accounts, 22 `MOCK_UPI` deposits stuck in `PENDING`.
- **Whether this DB is production is unclear.** Local dev and the E2E scripts point at the same `DATABASE_URL`. Automated tests that mutate it would alter real records.

## 6. Authentication — two incompatible systems
1. **Realtime service** (`services/realtime/src/api/auth.js`): JWT (HS256).
   - `JWT_SECRET` falls back to `'super-secret-key-fallback'`.
   - OTPs `1234`, `0000` and `123456` are **always accepted**, which means login to any phone number.
   - `GET /api/auth/mock-token?userId=X&role=SUPER_ADMIN` **signs an arbitrary JWT** and is exposed publicly.
   - `/me` auto-creates a DB user using the role taken from the token. Combined with `mock-token`, that creates a real `SUPER_ADMIN` row, which then passes `requireRole`.
   - OTPs are printed to logs. Revocation is an in-memory `Set`, checked only by `/me`.
2. **Next.js routes** (`apps/web/src/app/api/auth/*`), which the browser actually calls:
   - Tokens are **unsigned base64 JSON** (`windaq_…`).
   - `/me` decodes any token without verifying it. **Verified on production:** a forged token returned `role: SUPER_ADMIN`.
   - Master OTPs `1234`, `123456` and `9999`.
   - Hard-coded balances (₹9,420 / ₹10,000 / ₹50,000 / ₹500).
   - `smsService.ts` contains a **hard-coded Fast2SMS API key committed to git**.

## 7. Security concerns (confirmed in code)

> **Phase 1 containment status (2026-09-27):** S1–S8, S10, S11, S13–S16 and S22 are fixed and covered by tests in `services/realtime/tests/`; S24 is fixed. S9 was a false finding (see row). Still open: S12, S17 (games other than Aviator), S18, S19, S20, S21 (unchanged, non-production only), S23. The webhook part of S16 still signs re-serialized JSON rather than the raw body.

| # | Severity | Issue | Location |
|---|---|---|---|
| S1 | CRITICAL | `aviator:cashout` credits **client-supplied `winAmount`** to the wallet with no bet, round or multiplier check | `services/realtime/src/sockets/index.js:173-213` |
| S2 | CRITICAL | `/api/ledger/deposit/instant` credits any amount on request, with no payment proof | `services/realtime/src/api/ledger.js:306` |
| S3 | CRITICAL | `/api/ledger/withdraw/instant` finalizes payouts instantly, with no review, KYC or provider call. Guest ₹50,000 test credits are withdrawable | `ledger.js:387` |
| S4 | CRITICAL | `/api/auth/mock-token` mints JWTs for any userId/role | `api/auth.js:396` |
| S5 | CRITICAL | Universal OTP bypass codes (backend and Next.js) | `api/auth.js:184`, `apps/web/src/lib/smsService.ts:82` |
| S6 | CRITICAL | Next.js auth tokens unsigned; `/api/auth/me` trusts them (**confirmed live**) | `apps/web/src/app/api/auth/*` |
| S7 | CRITICAL | Fast2SMS API key hard-coded and committed. **Rotate the key**; it remains in git history | `apps/web/src/lib/smsService.ts:6` |
| S8 | CRITICAL | `resultHistoryApi` is mounted on `/api` **without auth**: `/api/admin/results/:id/correct` defaults the role to `SUPER_ADMIN` | `server.js:118`, `api/resultHistoryApi.js:138` |
| ~~S9~~ | ~~CRITICAL~~ | **Retracted (2026-09-27):** `sportsAdmin.js` already applies `router.use(requireRole(['SUPER_ADMIN','RISK','FINANCE']))`, so these routes were protected. Now covered by an automated test. | `api/sportsAdmin.js:8` |
| S10 | HIGH | Wallet events broadcast to **all sockets** (balance and userId leak) | `walletService.js:22` |
| S11 | HIGH | `join_room` accepts any room name (`user:<id>`, `admin:realtime`) | `sockets/index.js:77` |
| S12 | HIGH | Rummy and Teen Patti socket actions use **client-supplied `userId`** (impersonation). Scratch reveal also takes `userId` from the client | `sockets/rummyHandler.js`, `teenPattiHandler.js`, `scratchHandler.js:83` |
| S13 | HIGH | Reconciliation run/resolve has no role check (any user) | `api/reconciliationApi.js` |
| S14 | HIGH | `GET /api/ledger` returns the **entire platform ledger** to any logged-in user | `api/ledger.js:537` |
| S15 | HIGH | Notification admin logs/retry are unauthenticated | `api/notifications.js:9,25` |
| S16 | HIGH | Payment webhook secret fallback `mock-secret-key-123`; non-constant-time compare; HMAC over re-serialized JSON | `paymentAdapters/mockUpiAdapter.js` |
| S17 | HIGH | Race conditions: `place_bet` (aviator), slots, colour settle and others read the balance and then write an absolute value with no `FOR UPDATE`, which can cause lost updates or double spends | `sockets/index.js`, `slotHandler.js`, `colourEngine.js:155` |
| S18 | HIGH | Legacy `server/server.js` exposes `POST /api/v1/admin/rtp` (unauthenticated) with an `admin_profit` mode that **biases crash outcomes** | `server/gameEngine.js:115`, `server/server.js:765` |
| S19 | MEDIUM | MFA "verification" compares a header to the stored secret in plain text (not TOTP) | `middleware/AdminRBAC.js:53` |
| S20 | MEDIUM | CORS `*` on Socket.io and REST fallback; the rate limiter skips all loopback IPs (behind a proxy, every request looks like loopback unless `trust proxy` is set) | `server.js` |
| S21 | MEDIUM | Sandbox header auth (`x-user-id`, `x-admin-user-id`) is active whenever `NODE_ENV !== 'production'` **and** `ENABLE_SANDBOX_DEMO=true`, or `NODE_ENV=test`. Next.js proxies forward these headers | `middleware/auth.js` |
| S22 | MEDIUM | Next.js proxies return **fabricated** success data on backend failure (balance ₹10,000, **confirmed live**) | `apps/web/src/app/api/ledger/balance/route.ts:30` |
| S23 | MEDIUM | Tracked personal data: `server/wallet_data.json` (phone numbers), SQLite WAL/SHM files | `server/` |
| S24 | MEDIUM | `/api/payments/intent/:id` is unauthenticated (IDOR on status) | `api/payments.js:47` |

## 8. Game-result integrity
- Server engines mostly use `crypto` HMAC commit–reveal (aviator, colour, dice, lotto, table games): **good**.
- `LiveRouletteEngine` result uses `Math.random()` (`live/LiveRouletteEngine.js:226`). The Rummy shuffle uses `Math.random()`.
- The client simulator (`VirtualGameSocket`) decides **every production outcome in the browser** with `Math.random()`. Slots, for example, force a ~45% win rate with multipliers up to 25×. The site presents this as "Provably Fair" and "certified RNG".
- Admin result "correction" rewrites historical results. It doesn't trigger any compensating ledger flow, and it's unauthenticated (S8).
- Legacy RTP rigging switch (S18).

## 9. Deployment
- `vercel.json` declares two services. On the live site the realtime service isn't reachable (socket path serves HTML), and `REALTIME_URL` either isn't set or doesn't point to it. A long-running Socket.io server with `setInterval` game loops **can't run on Vercel serverless functions** anyway. It needs a persistent host (VM, container, Fly/Render/Railway) with the Next.js app on Vercel.
- `windaq.vercel.app/api/*` returns Vercel `NOT_FOUND`, while `daqwon.in` serves the Next.js API. The two domains are on different deployments/configs.
- `deploy.sh` / `ecosystem.config.js` / nginx target the legacy `server/` + non-existent `frontend/`. They're stale and dangerous if run.
- No CI pipeline, and no environment separation (dev/staging/prod share one `DATABASE_URL`).

## 10. Testing
- `npm run test:e2e` fails because `@playwright/test` isn't installed.
- Specs mostly check that UI elements exist and screenshots render, and many rely on sandbox auth headers or live URLs. None assert ledger invariants against an isolated test DB.
- `services/realtime/test_*.js` are manual scripts that write to whatever DB `.env` points to.
- No unit tests for the wallet, settlement or engines.

## 11. Known technical debt
- Two game catalogs (`defaultCatalog.ts`, `gameArtwork.ts`) + DB `Game`/`GameConfig` tables + `adminGameConfigService` in-memory config.
- Three wallet implementations: legacy JSON/SQLite, `walletService` ledger, and direct Prisma updates in game code.
- Two roulette bet paths (`rouletteHandler` → `RouletteBet`, and `BaseTableEngine` → `TableGameBet`).
- Table-game losses are never moved out of `SYSTEM:WAGER_RESERVE` (no `settleLoss` call), so the reserve accumulates (currently ₹3,100).
- `TableGameBet` has no `status`, and "LOST" is inferred in the API.
- Large components: `SimulatedLiveTable.tsx` (1,025 lines), `wallet/page.tsx` (982), `audioEngine.ts` (957).
- Lint: 70 errors, 587 warnings (268 `any`, 296 unused vars, 42 setState-in-effect).
- Many `new PrismaClient()` instances (one per module), which risks exhausting the connection pool.
- Root-level stray PNG screenshots (`chaska_*.png`) named after another brand.
- Committed AI-tool skill folders (`services/wallet/.agents|.claude|.cursor|.devin`).

## 12. Missing functionality
- A real payment gateway (deposit collection, payout), webhook-driven deposit crediting in the UI, and a withdrawal review queue wired to the UI.
- Real OTP verification (server-side, rate-limited, hashed, with expiry) and one unified auth system.
- A production realtime host, horizontal scaling (Redis adapter), and reconnect snapshots.
- Settlement for table-game losses and ledger coverage for all games.
- Test DB isolation, a unit-test suite and CI.
- Mines and Wingo exist only in the legacy `public/` app.

## 13. Performance concerns (not yet measured; see baseline)
- Single Node process running 10+ interval loops, plus a 1 s admin broadcast.
- Settlement loops do one transaction per bet sequentially (N round-trips).
- Many PrismaClient instances.
- All Next.js pages are client components (`'use client'`) with heavy framer-motion use.
