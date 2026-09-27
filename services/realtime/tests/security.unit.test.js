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
