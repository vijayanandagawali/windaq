const test = require('node:test');
const assert = require('node:assert/strict');

test('security config rejects missing or short JWT secrets', () => {
  const { getJwtSecret } = require('../src/config/security');
  const saved = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
    process.env.JWT_SECRET = 'super-secret-key-fallback';
    assert.throws(() => getJwtSecret(), /at least 32/);
    process.env.JWT_SECRET = 'a'.repeat(32);
    assert.equal(getJwtSecret(), 'a'.repeat(32));
  } finally {
    if (saved === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = saved;
  }
});

test('room guard blocks private and malformed rooms', () => {
  const { isAllowedClientRoom, installRoomGuard } = require('../src/sockets/roomGuard');
  assert.equal(isAllowedClientRoom('aviator'), true);
  assert.equal(isAllowedClientRoom('dragon-tiger:Standard'), true);
  assert.equal(isAllowedClientRoom('user:usr_victim'), false);
  assert.equal(isAllowedClientRoom('USER:usr_victim'), false);
  assert.equal(isAllowedClientRoom('admin:realtime'), false);
  assert.equal(isAllowedClientRoom({ toString: () => 'aviator' }), false);
  assert.equal(isAllowedClientRoom('x'.repeat(100)), false);

  const joined = [];
  const fakeSocket = { id: 's1', join: (rooms) => joined.push(...[].concat(rooms)) };
  const serverJoin = installRoomGuard(fakeSocket);
  fakeSocket.join(['aviator', 'user:someone-else']);
  fakeSocket.join('admin:realtime');
  serverJoin('user:me');
  assert.deepEqual(joined, ['aviator', 'user:me']);
});

test('OTP service: no fixed OTP in production, hashed single-use codes, attempt limit', async () => {
  const savedEnv = { NODE_ENV: process.env.NODE_ENV, DEV_FIXED_OTP: process.env.DEV_FIXED_OTP, FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY };
  const otp = require('../src/services/otpService');
  try {
    // Production without an SMS provider: issuing fails, nothing is stored, no universal code works.
    process.env.NODE_ENV = 'production';
    process.env.DEV_FIXED_OTP = '1234';
    delete process.env.FAST2SMS_API_KEY;
    const phone = '+919876500001';
    const issued = await otp.issueOtp(phone);
    assert.equal(issued.ok, false);
    assert.equal(issued.code, 'SMS_PROVIDER_NOT_CONFIGURED');
    for (const code of ['1234', '0000', '123456', '9999']) {
      assert.equal(otp.verifyOtp(phone, code).ok, false);
    }

    // Test mode: fixed code, stored hashed, single use.
    process.env.NODE_ENV = 'test';
    delete process.env.DEV_FIXED_OTP;
    const phone2 = '+919876500002';
    assert.equal((await otp.issueOtp(phone2)).ok, true);
    const stored = otp._otpStore.get(phone2);
    assert.ok(stored.hash && !JSON.stringify(stored).includes('1234'), 'OTP must not be stored in plain text');
    assert.equal((await otp.issueOtp(phone2)).code, 'OTP_COOLDOWN');
    assert.equal(otp.verifyOtp(phone2, '1234').ok, true);
    assert.equal(otp.verifyOtp(phone2, '1234').code, 'OTP_NOT_REQUESTED', 'OTP must be single use');

    // Attempt limit
    const phone3 = '+919876500003';
    await otp.issueOtp(phone3);
    for (let i = 0; i < 5; i++) assert.equal(otp.verifyOtp(phone3, '0000').code, 'INVALID_OTP');
    assert.equal(otp.verifyOtp(phone3, '1234').code, 'OTP_ATTEMPTS_EXCEEDED');
  } finally {
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('manual payment amount parsing uses exact integer paise', () => {
  const { toPaise } = require('../src/services/manualPaymentService');
  assert.equal(toPaise('100'), 10000n);
  assert.equal(toPaise(100.5), 10050n);
  assert.equal(toPaise('0.1'), 10n);
  assert.equal(toPaise('199.99'), 19999n);
  for (const bad of ['-5', 'abc', '1e5', '10.001', '', null, undefined, 'NaN']) {
    assert.throws(() => toPaise(bad), /valid amount/, `should reject ${bad}`);
  }
});
