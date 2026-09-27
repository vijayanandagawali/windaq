# WinDaq — Game Inventory (verified against code)

**Date:** 2026-09-27 · **Commit:** `94372a5`

Legend: ✅ present and sound · ⚠️ present with defects · ❌ missing/broken · — n/a

**Global caveat:** on every non-localhost deployment (including `daqwon.in`) the frontend replaces the real socket with `VirtualGameSocket` (`apps/web/src/lib/gameSocket.ts`). That means **all games in production are browser-side simulations** with `Math.random()` outcomes and a client-side balance. The "Backend" columns below describe what exists in `services/realtime`. None of it is reachable in production today.

| Game | Route | Frontend | Backend engine / handler | DB models | Bet & settlement path | Ledger-backed? | RNG | History | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Aviator (crash) | `/games/aviator` | ✅ 492 LOC | `AviatorEngine` loop + bet/cashout inline in `sockets/index.js` | `GameRound` only (no bet table) | `place_bet` reads balance → absolute write (race). `aviator:cashout` **credits client-supplied `winAmount`** | ❌ | ✅ HMAC crash point | ✅ RoundRegistry | UI specs only | **FAILED (critical exploit)** |
| Colour prediction | `/games/color-prediction` (alias `/colour-prediction`) | ✅ 448 | `ColourEngine` 1m + 3m, `colourHandler` | `ColourRound`, `ColourBet` | Direct `wallet.update`; settlement read-then-write without lock | ❌ | ✅ HMAC | ✅ | UI specs | **NEEDS REVIEW** |
| Dice (sic-bo style) | `/games/dice` | ✅ 449 | `DiceEngine` 1m, `diceHandler` | `DiceRoll`, `DiceBet` | Direct wallet mutation | ❌ | ✅ crypto | ✅ | UI specs | **NEEDS REVIEW** (0 real bets in DB) |
| Lotto | `/games/lotto` | ✅ 409 | `LottoEngine` 5m, `lottoHandler` | `LottoDraw`, `LottoTicket` | Direct wallet mutation | ❌ | ✅ HMAC | ✅ | UI specs | **NEEDS REVIEW** |
| Slots ("Vegas 777") | `/games/slots` | ⚠️ 312, emoji/letter symbols | `slotHandler` + `packages/slot-engine` | `SlotSpin` | Single tx but balance check without `FOR UPDATE`; no max stake | ❌ | ✅ crypto seeds | ⚠️ per-spin only | UI specs | **NEEDS REVIEW** |
| Scratch cards | `/games/scratch` | ✅ 340 | `scratchEngine`, `scratchHandler` | `ScratchTicket` | Buy in tx; **reveal trusts client `userId`** | ❌ | ⚠️ prize crypto, grid layout `Math.random` | ⚠️ | UI specs | **NEEDS REVIEW** |
| Dragon Tiger | `/games/dragon-tiger` | ✅ 320 + `SimulatedLiveTable` | `DragonTigerEngine` (BaseTableEngine), `tableHandler` | `TableGameRound`, `TableGameBet` | `walletService.placeBet` / `settleWin` (row lock + idempotency keys). **Losses never settled** (reserve accrues) | ⚠️ partial | ✅ HMAC | ✅ roadmap | UI specs | **IN PROGRESS** (best-implemented path) |
| Andar Bahar | `/games/andar-bahar` | ✅ 437 | `AndarBaharEngine` (BaseTableEngine) | same as DT | same as DT | ⚠️ partial | ✅ | ✅ | UI specs | **IN PROGRESS** |
| European Roulette | `/games/european-roulette` | ✅ 533, `RouletteWheel` | `RouletteEngine` (BaseTableEngine) **and** legacy `rouletteHandler` → `RouletteBet` | `TableGameBet` + `RouletteBet` | Two parallel paths (one ledgered, one direct) | ⚠️ | ✅ | ✅ | UI specs | **NEEDS REVIEW** (duplicate paths) |
| Live Roulette | `/games/live-roulette` (alias `/lightning-roulette`) | ⚠️ 234 | `LiveRouletteEngine` "automated dealer", `liveDealerHandler` | `LiveTable`, `LiveRound`, `LiveBet` | ledgered | ✅ | ❌ **`Math.random()`** result | ⚠️ | UI specs | **FAILED (RNG)** |
| Live Casino | `/games/live-casino` | ⚠️ 231. Stock casino video + "LIVE DEALER STUDIO" label; grid shows only 1–18 | reuses live roulette | — | — | — | — | — | — | **FAILED (misleading "live" imagery; incomplete table)** |
| Blackjack | `/games/blackjack` | ✅ 302 | `BlackjackEngine` (static), `blackjackHandler` | `BlackjackGame`, `BlackjackHand` | Direct wallet mutation | ❌ | needs review | ⚠️ | UI specs | **NEEDS REVIEW** (0 real hands in DB) |
| Teen Patti | `/games/teen-patti` | ✅ 311 | `TeenPattiRoom` + `packages/teenpatti-engine` | `TeenPattiHand`, `TeenPattiAction` | Direct wallet; **actions take client `userId`** | ❌ | needs review; bot logic uses `Math.random` | ⚠️ | UI specs | **FAILED (impersonation)** |
| Texas Hold'em | `/games/texas-holdem` | ✅ 286 | `pokerHandler` + `packages/poker-engine` (pokersolver) | none dedicated | Direct wallet (4 sites) | ❌ | needs review | ❌ | UI specs | **NEEDS REVIEW** |
| Rummy | `/games/rummy` | ✅ 305 | `RummyRoom`, `MeldEngine`, `rummyHandler` | `RummyGame`, `RummyHand` | Direct wallet; **all actions use client `data.userId`** | ❌ | ❌ `Math.random` shuffle | ❌ | UI specs | **FAILED (impersonation + RNG)** |
| Sportsbook | `/games/sportsbook` | ⚠️ 167 | `wagerService`, `MockSportsProvider`, `sportsAdmin` | `Wager`, `Sport*` | ledgered, but **any user can call settle** | ⚠️ | — (mock odds) | ⚠️ | UI specs | **FAILED (settlement auth)** |
| Dynamic slug | `/games/[slug]` | ✅ 123 generic page | — | `Game` | — | — | — | — | — | Catch-all landing |
| Bet panel demo | `/games/bet-panel-demo` | dev showcase | — | — | — | — | — | — | — | Should not ship to production |
| Mines | legacy `public/games/mines.js` only | ❌ not in Next app | legacy `server/` | SQLite | legacy | ❌ | — | — | — | **Legacy only** |
| Wingo | legacy `public/games/wingo.js` only | ❌ | legacy | SQLite | legacy | ❌ | legacy RTP modes | — | — | **Legacy only** |

### Catalog consistency
- Game definitions live in **four places**: `apps/web/src/lib/defaultCatalog.ts`, `apps/web/src/lib/gameArtwork.ts`, DB `Game` + `GameConfig`, and `adminGameConfigService` (in-memory). They disagree on names and providers.
- The catalog names third-party brands as providers ("Spribe / WinDaq", "Evolution & WinDaq"). WinDaq doesn't license these games, so this is a **trademark/misrepresentation risk**.
- The lobby advertises "16+ games". About 6 have a sound server path, and **none are reachable in production**.

### Assets
- 54 original SVGs in `apps/web/public/artwork/games` (card / hero / mobile for 18 slugs). That's good coverage, but they're SVG illustrations, so check quality per game.
- There's a duplicate copy in root `public/artwork/games` (legacy).
- External assets: Unsplash photos (design-system page, live-casino/live-roulette posters) and a Mixkit stock roulette video presented as a live stream.

### Per-game E2E verification (OPEN → BET → RESULT → SETTLEMENT → BALANCE → HISTORY)
**Not performed.** This needs the backend running against an isolated DB (see baseline §6). Existing specs verify the UI, not ledger consistency.
