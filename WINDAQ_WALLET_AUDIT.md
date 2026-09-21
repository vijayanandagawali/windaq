# WINDAQ FORENSIC WALLET & FINANCIAL AUDIT REPORT
**Document Version:** 1.0.0-PROD-AUDIT  
**System:** WinDaq FinTech Ledger & Payment Infrastructure  
**Authoritative Source of Truth:** PostgreSQL (`Wallet`, `LedgerTransaction`, `LedgerAccount`, `PaymentIntent`, `Transaction`)  
**Audit Target:** Prompts #61–#65 Core Systems vs Prompt #69 FinTech Specifications

---

## 1. Executive Summary

A comprehensive forensic audit of the WinDaq codebase was executed to inspect all financial pathways, wallet states, ledger accounts, deposit/withdrawal handlers, payment provider integrations, and client-side state managers.

While the underlying PostgreSQL database possesses a foundational double-entry ledger (`LedgerAccount` and `LedgerTransaction`) and atomic row-level locks for betting wagers (`placeBet`), the audit uncovered multiple critical architectural vulnerabilities:
1. **Client-Side Financial State Mutation:** Zustand store (`walletStore.ts`) implemented optimistic `deposit()` and `withdraw()` mutators that modified balance in browser memory without waiting for authoritative PostgreSQL transaction confirmation.
2. **Fabricated Balance Breakdown:** `/api/ledger/balance` returned an artificial hardcoded split (`winningRupees = totalRupees * 0.4`, `depositRupees = totalRupees * 0.6`, `bonusRupees = 500.00`), violating the core fintech rule that balances must never be fabricated.
3. **Missing Explicit Wallet Sub-Balances:** The `Wallet` model tracked only a single `balance` BigInt, lacking distinct columns for `lockedBalance`, `pendingDeposit`, `pendingWithdrawal`, and `bonusBalance`.
4. **Race Condition in Instant Deposit/Withdrawal APIs:** Unlike `placeBet()`, endpoints in `/api/ledger/withdraw/instant` did not execute `SELECT ... FOR UPDATE` row locks, exposing users to overdraft risks during rapid double-click submissions or concurrent tab requests.
5. **Hardcoded Merchant Credentials in Frontend:** `DepositModal.tsx` embedded a hardcoded merchant UPI VPA (`s0090792546529042@slc`) directly in client code rather than consuming environment-controlled server configurations.
6. **Absence of a Formal Reconciliation Service & Admin Dashboard:** No automated discrepancy detector existed between `PaymentIntent`, `LedgerTransaction`, and `Wallet` balances to flag mismatches or manage dispute workflows.

---

## 2. Forensic Findings Matrix

| Component | Status | Risk Level | Root Cause & Description | Required Remediation |
|---|---|---|---|---|
| **`Wallet` Model** | Deficient | **HIGH** | Only tracks total `balance`. No explicit columns for `lockedBalance`, `pendingWithdrawal`, `pendingDeposit`, or `bonusBalance`. | Extend schema with explicit accounting columns; push via Prisma. |
| **`/api/ledger/balance`** | Fabricated | **HIGH** | Hardcoded virtual split: `winnings = balance * 0.4`, `deposit = balance * 0.6`, `bonus = 500`. | Derive exact balances from PostgreSQL `balance`, `lockedBalance`, and active bonus models. |
| **`walletStore.ts`** | Vulnerable | **CRITICAL** | Optimistic `deposit()` and `withdraw()` functions manipulate memory balance. Initial state has dummy transactions. | Purge dummy data. Remove client-side mutators; enforce server-authoritative sync. |
| **`DepositModal.tsx`** | Hardcoded / Mocked | **HIGH** | Hardcoded UPI ID. Auto-credits sandbox deposit locally via `setTimeout` and fire-and-forgets API. | Move merchant info to server config. Use true server-side lifecycle polling / webhooks. |
| **`WithdrawModal.tsx`** | Insecure Fallback | **CRITICAL** | On API failure, catch block executes client-side `withdraw()`, deducting local balance when server failed. | Remove local deduction fallback. Only reflect state changes confirmed by the server. |
| **`withdraw/instant`** | Missing Row Lock | **HIGH** | Queries wallet with normal find; no `SELECT ... FOR UPDATE`. Susceptible to race condition overdrafts. | Wrap in `$transaction` with row-level `FOR UPDATE` lock. Check `availableBalance >= amount`. |
| **Reconciliation Engine** | Missing | **HIGH** | No background discrepancy detector between provider status, ledger records, and wallet rows. | Build `WalletReconciliationService` and `ReconciliationCase` database entity. |
| **Admin Reconciliation** | Missing | **MEDIUM** | Admin has no interface to audit payment mismatches or resolve discrepancies with audit trails. | Build `/admin/reconciliation` with case management (no arbitrary add/subtract buttons). |
| **Animations** | Uncalibrated | **MEDIUM** | No `<AnimatedWalletBalance />` or `<TransactionStatusAnimation />` component with `prefers-reduced-motion`. | Create institutional-grade Framer Motion animation components. |

---

## 3. Database Schema Evaluation

### Current Schema State:
- `Wallet`: `id`, `userId`, `currency`, `balance` (BigInt in paise).
- `Transaction`: `id`, `walletId`, `idempotencyKey` (unique), `type`, `amount`, `balanceAfter`, `reference`.
- `LedgerAccount`: `id`, `type`, `currency`.
- `LedgerTransaction`: `id`, `idempotencyKey` (unique), `referenceType`, `referenceId`, `debitAccountId`, `creditAccountId`, `amount`, `status`, `auditMetadata`.
- `PaymentIntent`: `id`, `userId`, `amount`, `type`, `provider`, `providerReference` (unique), `status`, `metadata`.

### Schema Deficiencies Identified:
1. `Wallet` lacks:
   - `lockedBalance` (BigInt @default(0)) — Critical for withdrawal holds.
   - `pendingDeposit` (BigInt @default(0)) — Critical for in-flight payment tracking.
   - `pendingWithdrawal` (BigInt @default(0)) — Critical for pending payouts.
   - `bonusBalance` (BigInt @default(0)) — Critical for promotional credits.
   - `totalDeposited`, `totalWithdrawn`, `totalWon`, `totalLost` (BigInt @default(0)) — Lifetime accounting statistics.
2. Missing `ReconciliationCase` entity to track discrepancies between external payment gateway reports and internal double-entry ledgers.

---

## 4. Race Condition & Concurrency Analysis

### Scenario A: Parallel Double-Click Withdrawal
- **Issue:** If a user submits two withdrawal requests for ₹5,000 simultaneously when their balance is ₹6,000, un-locked queries can read balance ₹6,000 in both threads and approve both, resulting in an unauthorized ₹10,000 withdrawal and negative balance (-₹4,000).
- **Remediation:** Enforce PostgreSQL row-level lock:
  ```sql
  SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE "userId" = $1 AND "currency" = 'INR' FOR UPDATE;
  ```
  Immediately move funds from available to locked in the transaction before committing.

### Scenario B: Webhook Duplicate Replays
- **Issue:** Payment gateways (Razorpay, PhonePe, Cashfree) routinely retry webhooks up to 10 times. Without strict transactional idempotency checks on `providerReference` and `idempotencyKey`, a single deposit could credit multiple times.
- **Remediation:** Enforce unique constraint on `idempotencyKey` in `LedgerTransaction` and `PaymentIntent`, and verify intent status in transaction:
  ```js
  if (intent.status === 'SUCCESS' || intent.status === 'COMPLETED') {
    return { success: true, message: 'Already processed (Idempotent)' };
  }
  ```

---

## 5. Architectural Remediation Roadmap

1. **Prisma Schema Update:** Add `lockedBalance`, `pendingDeposit`, `pendingWithdrawal`, `bonusBalance`, lifetime stats, and `ReconciliationCase` model. Execute `npx prisma db push`.
2. **Server-Side Authoritative Wallet Engine:**
   - Enhance `walletService.js` to handle `availableBalance = balance - lockedBalance`.
   - Update `/api/ledger/balance` to return 100% authoritative figures.
   - Secure deposit/withdrawal endpoints with atomic row locks and idempotency.
3. **Reconciliation Service:**
   - Implement `WalletReconciliationService.js` detecting `MISSING_LEDGER`, `AMOUNT_MISMATCH`, `STATUS_MISMATCH`, `DUPLICATE_PAYMENT`.
   - Build Admin Reconciliation dashboard at `/admin/reconciliation`.
4. **Client-Side Realtime & Animations:**
   - Remove client-side balance mutators from `walletStore.ts`.
   - Implement `<AnimatedWalletBalance />` and `<TransactionStatusAnimation />`.
   - Refactor `DepositModal.tsx` and `WithdrawModal.tsx` to rely strictly on server confirmation.
5. **E2E & Automated Verification:**
   - Build `tests/wallet_reconciliation_prompt69.spec.js` covering concurrency, idempotency, mathematical zero-drift, UI animations, and mobile responsiveness.

---
**Audit Complete.** System is primed for implementation in accordance with Prompt #69 directives.
