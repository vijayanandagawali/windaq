const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const h = require('./helpers');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const { initSockets } = require('../src/sockets/index');
const CoreSocketManager = require('../src/sockets/CoreSocketManager');
const AviatorEngine = require('../src/services/aviatorEngine');
const walletService = require('../src/services/walletService');
const { UNIVERSAL_PHASES } = require('../src/services/engine/UniversalRoundEngine');

let server;
let io;
let url;
let aviatorEngine;
const clients = [];

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { transports: ['websocket'], auth: token ? { token } : {}, forceNew: true, reconnection: false });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function emitAck(socket, event, data) {
  return new Promise((resolve) => socket.emit(event, data, resolve));
}

test.before(async () => {
  await h.resetDb();
  server = http.createServer();
  io = new Server(server);
  walletService.setIo(io);
  aviatorEngine = new AviatorEngine(io);
  aviatorEngine.currentPhase = UNIVERSAL_PHASES.BETTING_OPEN;
  initSockets(new CoreSocketManager(io), io, { aviatorEngine });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  clients.forEach((c) => c.close());
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await h.prisma.$disconnect();
});

test('client-supplied winAmount is ignored: cashout without a bet pays nothing', async () => {
  const user = await h.createUser({ balancePaise: 0n });
  const socket = await connect(h.socketTicketFor(user));
  const res = await emitAck(socket, 'aviator:cashout', { amount: 100, multiplier: 1000, winAmount: 10000000, userId: user.id });
  assert.equal(res.success, false);
  assert.equal(res.code, 'NO_ACTIVE_BET');
  assert.equal((await h.getWallet(user.id)).balance, 0n);
});

test('unauthenticated sockets cannot bet or cash out', async () => {
  const socket = await connect(null);
  assert.equal((await emitAck(socket, 'place_bet', { amount: 100 })).code, 'AUTH_REQUIRED');
  assert.equal((await emitAck(socket, 'aviator:cashout', { winAmount: 5000 })).code, 'AUTH_REQUIRED');
});

test('socket bet + cashout round trip settles through the ledger', async () => {
  const user = await h.createUser({ balancePaise: 50000n });
  const socket = await connect(h.socketTicketFor(user));
  const bet = await emitAck(socket, 'place_bet', { amount: 100, slot: 0 });
  assert.equal(bet.success, true, JSON.stringify(bet));
  assert.equal(bet.newBalance, 400);

  aviatorEngine.currentPhase = UNIVERSAL_PHASES.BETTING_LOCKED;
  aviatorEngine.isFlying = true;
  aviatorEngine.multiplier = 1.8;
  aviatorEngine.crashPoint = 4;
  const out = await emitAck(socket, 'aviator:cashout', { slot: 0, winAmount: 99999 });
  assert.equal(out.success, true, JSON.stringify(out));
  assert.equal(out.payout, 180);
  assert.equal((await h.getWallet(user.id)).balance, 58000n);
  await h.assertLedgerMatchesWallet(assert, user.id);

  aviatorEngine.isFlying = false;
  aviatorEngine.currentPhase = UNIVERSAL_PHASES.BETTING_OPEN;
});

test('private rooms cannot be joined and wallet events reach only their owner', async () => {
  const victim = await h.createUser({ balancePaise: 10000n });
  const attacker = await h.createUser({ balancePaise: 0n });
  const victimSocket = await connect(h.socketTicketFor(victim));
  const attackerSocket = await connect(h.socketTicketFor(attacker));

  const leaked = [];
  attackerSocket.onAny((event, payload) => leaked.push({ event, payload }));
  attackerSocket.emit('join_room', `user:${victim.id}`);
  attackerSocket.emit('round:join', { gameId: 'user', room: victim.id });
  attackerSocket.emit('round:join', { gameId: 'admin', room: 'realtime' });

  const victimEvents = [];
  victimSocket.on('WALLET_UPDATED', (p) => victimEvents.push(p));
  await new Promise((r) => setTimeout(r, 150));

  walletService.emitWalletEvent(victim.id, 'WALLET_UPDATED', { userId: victim.id, balance: 100 });
  io.to('admin:realtime').emit('admin:realtime_update', { secret: true });
  await new Promise((r) => setTimeout(r, 200));

  assert.equal(victimEvents.length, 1, 'owner receives their wallet update');
  const leakedWallet = leaked.filter((e) => e.event === 'WALLET_UPDATED' || e.event === 'admin:realtime_update');
  assert.equal(leakedWallet.length, 0, `attacker received: ${JSON.stringify(leakedWallet)}`);
});

test('session tokens are not accepted as socket credentials; revoked sessions lose socket access', async () => {
  const user = await h.createUser({ balancePaise: 50000n });

  const withSessionToken = await connect(h.tokenFor(user));
  assert.equal((await emitAck(withSessionToken, 'place_bet', { amount: 100 })).code, 'AUTH_REQUIRED');

  const ticket = h.socketTicketFor(user);
  await h.prisma.userSession.update({ where: { id: user.sid }, data: { revokedAt: new Date() } });
  const withRevokedTicket = await connect(ticket);
  assert.equal((await emitAck(withRevokedTicket, 'place_bet', { amount: 100 })).code, 'AUTH_REQUIRED');
  assert.equal((await h.getWallet(user.id)).balance, 50000n);
});
