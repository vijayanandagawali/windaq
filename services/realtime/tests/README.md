# Realtime service integration tests

These tests exercise the real Express routes, Socket.io handlers, wallet service and ledger against a
**disposable** PostgreSQL database. Every run truncates all tables.

## Safety rails (enforced in `helpers.js`)
- `DATABASE_URL_TEST` must be set explicitly.
- It must differ from the `DATABASE_URL` in the repo's `.env`.
- The host must be local (`localhost` / `127.0.0.1`) unless `ALLOW_REMOTE_TEST_DB=true`.
- A throwaway `JWT_SECRET` is always used; SMS sending is hard-disabled (`FAST2SMS_API_KEY` forced empty, `WINDAQ_TEST_HARNESS=1`).

## Running

1. Start any local Postgres (Docker, a local install, or `embedded-postgres`), e.g.
   `docker run --rm -p 55432:5432 -e POSTGRES_USER=windaq -e POSTGRES_PASSWORD=windaq_test -e POSTGRES_DB=windaq_test postgres:15-alpine`
2. Create the schema:
   `DATABASE_URL=postgresql://windaq:windaq_test@127.0.0.1:55432/windaq_test npx prisma db push --schema services/wallet/prisma/schema.prisma --skip-generate`
3. Run the tests from the repo root:
   `DATABASE_URL_TEST=postgresql://windaq:windaq_test@127.0.0.1:55432/windaq_test npm run test:backend`

## Coverage
| File | What it proves |
|---|---|
| `security.unit.test.js` | Required JWT secret, room guard, exact paise parsing |
| `auth.api.test.js` | No `mock-token`, no universal OTPs, OTP-verified register/login, zero starting balance, forged/unsigned/`alg=none` tokens rejected, `/me` never creates users or trusts role claims |
| `sessions.api.test.js` | DB-backed hashed OTPs (cooldown, single use, concurrent attempt limit, no SMS in production without a provider), server-side sessions: logout, logout-all, expiry, suspension revoke; socket tickets |
| `payments.api.test.js` | Deposits never credit without finance approval; single credit under concurrent approvals; UTR reuse blocked; guests blocked; withdrawal holds, review, concurrency and overdraw protection; wallet == ledger |
| `authorization.api.test.js` | Admin routes reject anonymous users and players (even with forged role claims); sandbox headers ignored in production |
| `aviator.engine.test.js` | Server-authoritative Aviator: ledgered bets, server-multiplier cashouts, no double cashout, loss settlement, auto cashout |
| `sockets.test.js` | Client `winAmount` ignored end-to-end; private rooms unjoinable; wallet events only reach their owner |
