# WinDaq — UI/UX Forensic Audit

**Date:** 2026-09-27 · **Commit:** `94372a5`
**Method:** Production build served locally (`next start`, port 3100) with **no backend running**. That mirrors production today, where the realtime service is unreachable. I ran an automated Playwright sweep of **29 routes × 7 viewports** (360×800, 390×844, 430×932, 768×1024, 1280×720, 1440×900, 1920×1080 = 203 page loads), captured screenshots at 360/390/1440, and reviewed them manually.
Screenshots and raw JSON were kept in the session scratchpad and not committed.

## 1. Automated sweep: what passed
- **No page-level horizontal scroll** at any viewport (document `scrollWidth` ≤ viewport on all 203 loads).
- **No broken `<img>` elements**, and every `<img>` has an `alt` attribute.
- Every route renders without a white screen. `/games/unknown-slug` shows an intentional "GAME NOT FOUND" state.
- Local load time to `load` + 2.5 s settle: roughly 2.7–4.1 s per page (local machine, not a performance measurement).

## 2. Findings by severity

### Integrity / trust (highest priority, and a user-facing honesty problem)
| # | Finding | Where |
|---|---|---|
| U1 | **Fabricated "LIVE PAYOUTS" ticker** ("Player_8492 won ₹48,200 on Aviator…") isn't backed by any data | Home, `/lobby`, `/search` header strip |
| U2 | **Third-party brand shown as provider**: "Spribe / WinDaq", "Evolution & WinDaq" | Home hero, catalog (`defaultCatalog.ts:39`, `gameArtwork.ts:33,337`) |
| U3 | Unsubstantiated claims: "certified random number generation", "instant payouts", "256-bit SSL / Secure payouts". Production outcomes are browser `Math.random()` | Home hero, trust footer |
| U4 | **"LIVE DEALER STUDIO" over a looping stock casino video** (Mixkit) with an Unsplash poster. There's no live dealer. The video also fails to load, leaving just the poster | `/games/live-casino`, `/games/live-roulette` |
| U5 | Guest users see a **"GOLD" VIP badge** and a balance chip; the admin gate offers "PLAY AS GUEST (TEST MODE)" | Header, `/admin` |
| U6 | Test mode isn't visually distinct from real-money mode on game pages (only the wallet and admin pages mention test/demo) | All game pages |
| ✅ | Dragon Tiger labels itself honestly: "SIMULATED LIVE TABLE", "SIMULATED DEALER", "[SIMULATED BOT]", "Not a predictive system". **Use this as the pattern everywhere** | `/games/dragon-tiger` |

### Broken or incomplete states (backend unavailable)
| # | Finding | Where |
|---|---|---|
| U7 | Games sit forever on "Connecting RNG… / WAITING FOR NEXT ROUND 0". There's no error, retry, or "offline" state (Phase 29 requirement) | Aviator, Roulette ("WAITING"), Teen Patti ("Waiting for players… Spectating") and other socket games |
| U8 | **Unhandled promise rejection** (`PAGEERROR Failed to fetch`) | `/promotions` (bonus campaigns), `/games/[slug]` (catalog) |
| U9 | Catalog fetch fails silently; the lobby falls back to the static catalog with no notice | Home, lobby, search |
| U10 | Wallet page logs "Error loading transactions/wagers" with no user-facing state | `/wallet` (when logged in) |
| U11 | Live Casino betting grid shows **only numbers 1–18** (no 0, no 19–36) | `/games/live-casino` |
| U12 | European roulette **"0" cell renders as a white pill glyph** instead of the digit (desktop) | `/games/european-roulette` @1440 |
| U13 | Red/Black outside bets are shown as colour swatches only, with no text label (colour-only information, accessibility) | European roulette |
| U14 | Aviator second bet panel defaults to **₹0**; balance shows ₹0.00 while BET is enabled | `/games/aviator` |
| U15 | Home hero at desktop has a **large empty dark area** on the right (hero artwork doesn't render in the card) | Home @1440 |

### Mobile
| # | Finding | Where |
|---|---|---|
| U16 | **Header overflows at 360–390 px**: REGISTER is cut off and LOGIN is clipped at the edge (hidden by `overflow-hidden`, so it doesn't show up as page scroll) | Every page |
| U17 | European roulette number grid at 360 px: 12 columns of about 22 px each. Numbers touch and targets are far below the 44 px guideline, so **accidental bets are likely** | `/games/european-roulette` |
| U18 | Undersized interactive elements (< 32 px in one dimension), counted per page at 390 px: home/lobby/search **70**, roulette **44**, aviator 14, live-casino 12 | see counts |
| U19 | The game-phase stepper on Dragon Tiger ("1. CREATED → 2. BETTING OPEN → …") overflows horizontally and gets cropped at 360 px | `/games/dragon-tiger` |
| U20 | Simulated-bot seat cards are cropped at both edges at 360 px | `/games/dragon-tiger` |
| U21 | Fixed bottom nav (centre "SPIN" button) covers the lower part of the bet panel | `/games/live-casino` |

### Visual design / consistency
| # | Finding |
|---|---|
| U22 | Slots uses **emoji and playing-card letters** (🧜 💎 ⭐ A K Q J) as reel symbols, which looks placeholder-grade next to the SVG card art |
| U23 | Brand, palette and typography are consistent (deep navy + neon mint, heavy display type), but game pages have **no `<h1>`** (all 16 game routes), which hurts both hierarchy and screen readers |
| U24 | Duplicated trust badges ("PROVABLY FAIR" appears twice in the footer row); admin gate copy says "view your private wallet" |
| U25 | Artwork: 54 original SVGs (card/hero/mobile × 18 slugs) exist and resolve. A duplicate legacy copy lives in root `public/artwork`. No central `AssetResolver`/`GameImage` component: `GameCard.tsx`, `HeroBanner.tsx` and `[slug]/page.tsx` each re-implement the fallback logic (`thumbnailUrl.includes('unsplash.com')` checks) |
| U26 | Two `GameCard` components (`components/games/GameCard.tsx` and `components/ui/cards/GameCard.tsx`) |
| U27 | `/design-system` and `/games/bet-panel-demo` are dev showcase pages shipped to production |
| U28 | Root-level `chaska_*.png` / `chaska99_*.png` screenshots appear to be reference captures of another operator's site. Don't use them as design sources (Phase 11) |

### Accessibility
- Game pages have no `<h1>` (U23), and colour-only bet cells (U13).
- There are many icon-only buttons (bell, audio, back); screen-reader labels need checking.
- `prefers-reduced-motion`: honoured only in `AnimatedWalletBalance.tsx`, `useAnimationOrchestrator.ts` and `audioEngine.ts`. There is no global `MotionConfig`, so most framer-motion animations ignore it.
- Focus states: not audited interactively in this pass.

## 3. Pages reviewed

| Area | Routes | Overall |
|---|---|---|
| Home / Lobby / Search | `/`, `/lobby`, `/search` | Polished visually; fake ticker, brand misuse, empty hero area, header overflow |
| Game pages (16) | `/games/*` | Visually rich; no offline/error states; mobile touch targets on table games |
| Wallet | `/wallet`, `/wallet/deposit`, `/wallet/withdraw`, `/wallet/transactions/[id]` | Clean auth gate. Flows call the instant deposit/withdraw endpoints (see repository audit S2/S3) |
| Profile | `/profile`, `/profile/bonuses`, `/profile/rg` | Auth-gated; not reviewed logged-in |
| Admin | `/admin/*` (13) | Client-side gate only; real protection depends on the backend RBAC, which is bypassable |
| Static | `/promotions`, `/fairness`, `/terms`, `/privacy`, `/support`, `/responsible-gaming` | `/promotions` throws an unhandled error without the backend |

## 4. Not covered in this pass
- Logged-in flows (skipped during the audit to avoid writing to the `.env` database; logged-in flows are now covered by `tests/e2e`).
- Win/loss animations and result reveals (need live rounds).
- Modals (deposit, withdraw, auth sheet) in interactive states.
- LCP/CLS/bundle measurements.
