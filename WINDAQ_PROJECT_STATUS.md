# WinDaq — Project Status Dashboard

**Last verified:** 2026-09-27 (audit of commit `94372a5`). Status is based on code inspection and checks that actually ran. Code merely existing doesn't count as DONE.
Statuses: **DONE · IN PROGRESS · BLOCKED · NEEDS REVIEW · FAILED**

## Feature status

| Feature | Status | Tests | Known issues | Priority | Last verified |
|---|---|---|---|---|---|
| Web build (Next.js 16) | DONE | `next build` ✅, `tsc` ✅ | Lint still fails: 63 errors / 552 warnings (was 70 / 587) | P2 | 2026-09-27 |
| Authentication (backend JWT) | DONE | 49 backend + 3 cookie E2E tests ✅ | Server-side sessions (UserSession) checked on every request; role from DB; DB-backed hashed OTPs with atomic attempt limit; logout / logout-all / suspension revoke immediately; per-IP OTP rate limits | P1 | 2026-09-28 |
| Authentication (Next.js routes, used by UI) | DONE | cookie E2E ✅ | Session token only in an httpOnly SameSite=Lax cookie managed by the `/api` proxy; never in localStorage or response bodies; cross-site POSTs blocked; sockets use 60 s tickets | P1 | 2026-09-28 |
| Admin RBAC | NEEDS REVIEW | 13 routes × anon/player/forged-role tests ✅ | Role always read from DB; guards added to result correction, reconciliation, notifications, ledger, wager settle. Open: MFA is a plain-text header compare (S19) | P1 | 2026-09-27 |
| Wallet balance (server) | NEEDS REVIEW | none | Integer paise ✅, row locks in `walletService` ✅; many games bypass it | P0 | 2026-09-27 |
| Double-entry ledger | FAILED | wallet==ledger asserted in tests ✅ | New writes (Aviator, deposits, withdrawals) stay balanced. Historic drift (191 wallets, ₹19.77 lakh) not yet backfilled; most games still bypass the ledger | **P0** | 2026-09-27 |
| Deposit | NEEDS REVIEW | 6 API tests ✅, browser E2E ✅ | Manual UPI: UTR submitted → finance verifies → ledgered credit, exactly once. Needs `NEXT_PUBLIC_MERCHANT_UPI_ID`; real gateway pending | P1 | 2026-09-27 |
| Withdrawal | NEEDS REVIEW | 3 API tests incl. concurrency ✅ | Hold → finance pays out manually → approve (payout ref required) or reject (funds returned). Guests blocked. Open: KYC not enforced | P1 | 2026-09-27 |
| Payment gateway / webhooks | IN PROGRESS | webhook rejection test ✅ | Mock client routes disabled (410); webhook secret required + constant-time compare. Open: raw-body HMAC, real provider | P1 | 2026-09-27 |
| Transaction history | NEEDS REVIEW | UI specs | No `balanceBefore`/`status`; pending intents merged ad hoc | P1 | 2026-09-27 |
| Reconciliation | IN PROGRESS | auth tests ✅ | Now FINANCE/SUPER_ADMIN only. Open: scheduled job, historic backfill | P1 | 2026-09-27 |
| Realtime (Socket.io) | NEEDS REVIEW | 4 socket tests ✅ | Fixed: no global wallet broadcast; private rooms unjoinable (central guard). Open: Rummy/Teen Patti trust client userId (S12), CORS `*`, reconnect snapshots | **P0** | 2026-09-27 |
| Production realtime hosting | BLOCKED | live probe | Vercel serverless can't host persistent Socket.io + game loops | **P0** | 2026-09-27 |
| Production game play | IN PROGRESS | — | Browser simulator now shows a DEMO banner and refuses bets. Real play still blocked on hosting | **P0** | 2026-09-27 |
| Aviator | NEEDS REVIEW | 6 engine + 3 socket tests ✅, browser E2E ✅ | Server-authoritative bets/cashout/auto-cashout via ledger. Open: UI shows BET enabled ~3 s after server closes betting (server rejects); crash formula has no explicit house edge | P1 | 2026-09-27 |
| Dragon Tiger / Andar Bahar | IN PROGRESS | UI specs | Losses not settled from reserve | P1 | 2026-09-27 |
| European Roulette | NEEDS REVIEW | UI specs | Two parallel bet paths | P1 | 2026-09-27 |
| Colour / Dice / Lotto / Slots / Scratch / Blackjack / Poker | NEEDS REVIEW | UI specs | Bypass ledger; lock races; scratch trusts client userId | P1 | 2026-09-27 |
| Teen Patti / Rummy | FAILED | UI specs | Client-supplied userId (impersonation); rummy `Math.random` shuffle | P0 | 2026-09-27 |
| Live Roulette / Live Casino | FAILED | UI specs | `Math.random` result; stock video labelled "LIVE" | P1 | 2026-09-27 |
| Sportsbook | FAILED | UI specs | Any user can settle wagers | **P0** | 2026-09-27 |
| Result history / verification | IN PROGRESS | auth tests ✅ | Correction endpoint now SUPER_ADMIN/RISK only. Open: corrections do not trigger compensating ledger entries | P1 | 2026-09-27 |
| Game catalog | NEEDS REVIEW | none | Four divergent sources; third-party brand names | P2 | 2026-09-27 |
| Game artwork | IN PROGRESS | visual sweep | 54 original SVGs; stock video/photos on live pages | P3 | 2026-09-27 |
| Mobile layout | NEEDS REVIEW | visual sweep | See UI audit | P2 | 2026-09-27 |
| Legacy `server/` + `public/` stack | FAILED | none | RTP rigging switch; PII files tracked; stale deploy scripts | P1 (remove) | 2026-09-27 |
| E2E test suite | DONE | 8 Playwright tests ✅ (Aviator 3/3 repeat) | New suite in `tests/e2e` against real backend + production build; legacy specs kept under `test:e2e:legacy` (not maintained) | P1 | 2026-09-27 |
| Unit tests | IN PROGRESS | 41 backend tests (`npm run test:backend`) | No frontend unit tests yet | P1 | 2026-09-27 |
| CI/CD | DONE | GitHub Actions green on PR #1 (web, backend, e2e) | Lint uses a ratchet (63 errors / 547 warnings) | P2 | 2026-09-28 |
| Environment separation | DONE | guard refusal verified | `npm run db:local` (dev + test DBs); `.env` → `windaq_dev`; DB guard on scripts + dev server; destructive scripts need typed confirmation | P0 | 2026-09-27 |
| Observability | NEEDS REVIEW | — | Log redaction helper exists; no request IDs | P2 | 2026-09-27 |

## Phase 1 — containment (completed 2026-09-27)
Done: 1 (demo banner, fabricated fallbacks removed), 2 (secret fallbacks removed; **key rotation still required by the owner**), 3 (Aviator), 4 (instant deposit/withdraw), 5 (mock-token, master OTPs), 8 (admin route guards). Also pulled forward: socket broadcast + room isolation (part of 9), `/me` auto-provisioning (part of 7).
Verification: 41 backend integration tests on an isolated DB (mutation-checked), browser E2E of login → deposit → admin approval → Aviator bet/cashout/auto-cashout with wallet == ledger.

## Phase 2 — foundations (2026-09-27)
Done: 10 (isolated dev/test databases, DB write guard, dev server guard), 18 (Playwright installed, maintained E2E suite, lint ratchet, CI workflow, TESTING.md).

### Incident — local database wiped (2026-09-27)
While testing the new DB guard, the agent ran `scripts/reset_and_seed_db.js` expecting a refusal. It resolved `services/wallet/.env` → the owner's local Postgres (`localhost:5432/windaq`), which the guard (then host-only) allowed, and the script deleted all rows (199 users, 193 wallets, ledger, statements, rounds) and re-seeded 13 synthetic users. Autovacuum reclaimed the rows a minute later, so no in-database recovery was possible. The owner chose to move `.env` to the disposable `windaq_dev` database. **Fix:** destructive scripts now always require `WINDAQ_CONFIRM_DESTRUCTIVE=<dbname>`, even on localhost.

## Phase 3 — login system (2026-09-28)
Done: 6 (single signed session system, httpOnly cookie via the /api proxy), 7 (no auto-provisioning; role and identity always from the database). Also: server-side session revocation (logout, logout-all, suspension), DB-backed OTPs, socket tickets, CSRF origin check, S20 rate-limit fix (TRUST_PROXY, loopback exemption only outside production). All game pages now use the shared authenticated socket (11 pages hard-coded `localhost:4000` with no auth).
Incident: during phase 3 testing one OTP SMS was most likely sent through the (still unrotated) Fast2SMS key to a test number (+91 98765 00001), because Prisma auto-loaded the key from .env into the test process. Test harnesses now force an empty key and the OTP service refuses to send under the harness.

## Top 20 priorities (ordered)

| # | Item | Category |
|---|---|---|
| 1 | Take real money offline / put production in explicit DEMO mode until P0s are fixed. Remove the fabricated balance fallbacks | Financial / legal |
| 2 | Rotate the Fast2SMS key and any other exposed secrets; purge from history; require `JWT_SECRET` (no fallback) | Security |
| 3 | Delete `aviator:cashout` client-amount crediting; move aviator bets/cashouts to server-side, ledger-backed settlement | Financial |
| 4 | Remove `/deposit/instant` and `/withdraw/instant` crediting; deposits only via verified webhook; withdrawals via hold → review → payout | Financial |
| 5 | Remove `/api/auth/mock-token` and all master OTPs; hash + rate-limit OTPs server-side | Auth |
| 6 | Unify auth: delete the fake Next.js auth routes; issue signed httpOnly session/JWT from one service | Auth |
| 7 | Stop `/me` / `ensureUserAndWallet` from auto-creating users, roles or balances from token claims | Auth / data integrity |
| 8 | Add auth + role checks to `resultHistoryApi` admin routes, `sportsAdmin`, reconciliation, notifications, `GET /api/ledger` | Authorization |
| 9 | Socket security: remove global wallet broadcast; whitelist `join_room`; derive identity only from `socket.user` | Realtime |
| 10 | Provision isolated dev/test databases; stop pointing local scripts at the shared DB | Data integrity |
| 11 | Route **every** game's bet/settle through `walletService` (row lock + ledger + idempotency key); settle losses | Financial |
| 12 | Backfill/opening-balance ledger entries (with audit) so wallet == ledger; add a reconciliation job and alerting | Financial |
| 13 | Replace `Math.random` in LiveRoulette and Rummy with the provably-fair RNG | Game integrity |
| 14 | Remove `VirtualGameSocket` from production builds (keep it only as a clearly labelled offline demo, never touching the wallet) | Game integrity |
| 15 | Host the realtime service on a persistent runtime; set `REALTIME_URL`/`NEXT_PUBLIC_WS_URL`; restrict CORS | Deployment |
| 16 | Delete the legacy `server/`, `public/`, `deploy.sh`, `ecosystem.config.js`, tracked SQLite/JSON PII | Security / debt |
| 17 | Hardened payment webhook (raw body, constant-time HMAC, required secret, replay window); a real provider adapter | Payments |
| 18 | Test infra: install `@playwright/test`, add Vitest for wallet/settlement unit tests, CI running lint/tsc/test/build | Quality |
| 19 | Single game catalog; remove third-party brand names; relabel "live" tables as Virtual/Simulated; replace stock video | Compliance / UI |
| 20 | Mobile UI fixes (header overflow, roulette touch targets, backend-down states) and lint error cleanup | UX |

## Recommended execution order
1. **Containment (day 0):** items 1, 2, 5, 3, 4, 8 (small, high-impact deletions/guards).
2. **Foundations:** 10, 18 (isolated DB + test harness) so later financial changes are verifiable.
3. **Auth unification:** 6, 7.
4. **Ledger correctness:** 11, 12, then 9 (realtime identity).
5. **Game integrity:** 13, 14, then per-game E2E (OPEN→BET→RESULT→SETTLE→BALANCE→HISTORY).
6. **Deployment:** 15, 16, 17.
7. **Product polish:** 19, 20, animation system consolidation, performance measurement.
