/**
 * Shared, test-only E2E settings. None of these values are used outside local/CI test runs.
 */
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 3200);

const E2E = {
  backendUrl: `http://localhost:${BACKEND_PORT}`,
  webUrl: `http://localhost:${WEB_PORT}`,
  backendPort: BACKEND_PORT,
  webPort: WEB_PORT,
  // Fixed OTP honoured only because the E2E backend runs with NODE_ENV=test.
  otp: '1234',
  merchantUpi: 'e2e-merchant@upi',
  bankSmsToken: 'e2e-only-bank-sms-token-' + 'b'.repeat(40),
  jwtSecret: 'e2e-only-jwt-secret-' + 'e'.repeat(48),
  finance: { id: 'usr_e2e_finance', phone: '9000000099', phoneE164: '+919000000099' }
};

module.exports = { E2E };
