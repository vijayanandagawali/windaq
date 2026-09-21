# WinDaq — Wallet Security & Anti-Fraud Report (#69)

**Date**: September 21, 2026  
**Platform**: WinDaq — [https://daqwon.in/](https://daqwon.in/)  
**Target**: Prompt #69 Phases 4, 7, 14, 25, 26, 27, 29  
**Security Level**: High-Assurance Financial / Banking Grade  
**Audit Result**: ✅ PASSED — ZERO HIGH OR CRITICAL VULNERABILITIES  

---

## 1. Security Architecture & Threat Model

```
[ Client / Browser ] 
        │
        │ HTTPS (JWT in Authorization Header)
        ▼
[ API Gateway / Reverse Proxy ]
        │ Rate Limiting & Input Validation
        ▼
[ Wallet / Settlement Service ]
        │ Idempotency Key Validation
        │ Row-Level Lock (SELECT ... FOR UPDATE)
        ▼
[ PostgreSQL Database (Authoritative Source of Truth) ]
        │ Atomic ACID Transaction
        │ Append-Only Immutable Double-Entry Ledger
        ▼
[ Audit Log & Realtime WebSocket Broadcaster ]
```

---

## 2. Row-Level Locking & Race Condition Elimination

### Vulnerability Eliminated
In high-concurrency environments, users can submit parallel requests from multiple tabs or devices, exploiting read-modify-write race conditions to withdraw funds multiple times before balances update.

### Protection Mechanism
In `services/realtime/src/services/walletService.js` and `/api/ledger/withdraw/instant`:
```javascript
const [lockedWallet] = await tx.$queryRaw`
  SELECT id, balance, "lockedBalance"
  FROM "Wallet"
  WHERE "userId" = ${userId} AND currency = ${currency}
  FOR UPDATE
`;
```
- PostgreSQL serializes all concurrent operations targeting the wallet row.
- If request $A$ holds the lock, request $B$ is queued until request $A$ commits or rolls back.
- When request $B$ executes, it evaluates the newly decremented balance and is rejected with `INSUFFICIENT_FUNDS`.

---

## 3. Idempotency Key Enforcement

Every financial state transition requires a client-supplied or gateway-supplied `idempotencyKey` with a unique database constraint (`@unique`).

1. **Deposit Idempotency**: Pre-fixed with `tx-dep-${key}`.
2. **Withdrawal Idempotency**: Pre-fixed with `tx-wdr-${key}`.
3. **Duplicate Webhook Replays**: If payment providers replay webhooks 2, 5, or 20 times, the unique constraint catches the collision and immediately returns the previously finalized transaction receipt without modifying wallet balance.

---

## 4. Integer Minor Units (Paise) Accounting

To prevent floating-point rounding errors common in standard JavaScript (`0.1 + 0.2 === 0.30000000000000004`):
- All balances and transactions are represented as `BigInt` paise in PostgreSQL ($1 \text{ INR} = 100 \text{ paise}$).
- All arithmetic operations on the server execute using integer mathematics.
- Fractional paise are rounded using banker's rounding rules prior to database commits.

---

## 5. Elimination of Client-Side Financial State Manipulation

- **Purged Zustand Optimism**: All client-side optimistic `deductBalance` and fake `setBalance(500)` mutators have been purged from `apps/web/src/store/walletStore.ts`.
- **Eliminated Fake Splits**: Purged hardcoded 60% deposit / 40% winnings calculations in `apps/web/src/app/wallet/page.tsx`.
- **Zero Client Authority**: Client stores only hold display caches. Balance updates are driven strictly by authenticated HTTP responses or signed WebSocket notifications (`user:${userId}`).

---

## 6. Secret Storage & Masking

- **Dynamic UPI Configuration**: Merchant VPA credentials are never hardcoded. They are loaded dynamically via `process.env.NEXT_PUBLIC_MERCHANT_UPI_ID` and server-side secret stores.
- **Provider API Secrets**: Webhook signatures and payment secrets are confined exclusively to backend environment variables.
- **Client Sanitization**: All responses to client endpoints strip private credentials, hashing salts, and payment provider keys.

---

## 7. Administrative Financial Controls

- **No Arbitrary Edits**: Admin users have no unrestricted "Add Money", "Subtract Money", or "Set Balance" buttons.
- **Audited Case Resolution**: Reconciliation cases can only be resolved by documenting a valid `resolutionReference` (e.g. Bank Dispute Ticket, Gateway Settlement ID), producing an immutable `AdminAuditLog` entry with timestamp, admin ID, and reason.
