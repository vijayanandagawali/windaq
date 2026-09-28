const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const h = require('./helpers');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const { initSockets } = require('../src/sockets/index');
const CoreSocketManager = require('../src/sockets/CoreSocketManager');
const ColourEngine = require('../src/services/colourEngine');
const { DiceEngine } = require('../src/services/diceEngine');
const { LottoEngine } = require('../src/services/lottoEngine');
const { DragonTigerEngine } = require('../src/services/tableGames/DragonTigerEngine');
const { AndarBaharEngine } = require('../src/services/tableGames/AndarBaharEngine');
const provablyFair = require('../src/services/ProvablyFairService');
const { RouletteEngine } = require('../src/services/tableGames/RouletteEngine');
const { UNIVERSAL_PHASES } = require('../src/services/engine/UniversalRoundEngine');
const walletService = require('../src/services/walletService');

let server;
let io;
let url;
const engines = {};
const clients = [];

function connect(user) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { transports: ['websocket'], auth: user ? { token: h.socketTicketFor(user) } : {}, forceNew: true, reconnection: false });
    clients.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}
const emitAck = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));
const balanceOf = async (userId) => (await h.getWallet(userId)).balance;

async function openRound(engine) {
  await engine.onCreateRound(engine.roundId);
  engine.currentPhase = UNIVERSAL_PHASES.BETTING_OPEN;
  engine.phaseEndsAt = Date.now() + 60000;
}

test.before(async () => {
  await h.resetDb();
  server = http.createServer();
  io = new Server(server);
  walletService.setIo(io);
  const core = new CoreSocketManager(io);
  engines.colour = new ColourEngine(io, '1min', 60000);
  engines.dice = new DiceEngine('1min', io);
  engines.lotto = new LottoEngine('5min', io);
  engines.dt = new DragonTigerEngine('Standard', core);
  engines.roulette = new RouletteEngine('Auto', core);
  engines.ab = new AndarBaharEngine('Auto', core);
  initSockets(core, io, {
    colourEngines: { '1min': engines.colour },
    diceEngine: engines.dice,
    lottoEngine: engines.lotto,
    dragontigerEngine: engines.dt,
    andarbaharEngine: engines.ab,
    rouletteEngine: engines.roulette
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  clients.forEach((c) => c.close());
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await h.prisma.$disconnect();
});

// ---------------- Colour ----------------
test('colour: bets use the session identity, reject negative/closed bets, and settle via the ledger', async () => {
  const victim = await h.createUser({ balancePaise: 100000n });
  const player = await h.createUser({ balancePaise: 100000n });
  const socket = await connect(player);
  await openRound(engines.colour);

  // Negative stake used to mint money.
  assert.equal((await emitAck(socket, 'colour:bet', { room: '1min', betType: 'color', betValue: 'red', amount: -500000 })).code, 'INVALID_AMOUNT');
  // Spoofed userId is ignored: the victim is never charged.
  const bet = await emitAck(socket, 'colour:bet', { userId: victim.id, room: '1min', betType: 'color', betValue: 'red', amount: 10000 });
  assert.equal(bet.success, true, JSON.stringify(bet));
  assert.equal(await balanceOf(victim.id), 100000n);
  assert.equal(await balanceOf(player.id), 90000n);
  const lose = await emitAck(socket, 'colour:bet', { room: '1min', betType: 'number', betValue: '7', amount: 10000 });
  assert.equal(lose.success, true);

  await engines.colour.onSettlement(engines.colour.roundId, { color: 'red', number: 2, size: 'small' });
  await engines.colour.onSettlement(engines.colour.roundId, { color: 'red', number: 2, size: 'small' }); // idempotent
  assert.equal(await balanceOf(player.id), 80000n + 20000n, 'red 2x paid once, number bet lost');
  await h.assertLedgerMatchesWallet(assert, player.id);

  engines.colour.currentPhase = UNIVERSAL_PHASES.BETTING_LOCKED;
  assert.equal((await emitAck(socket, 'colour:bet', { room: '1min', betType: 'color', betValue: 'red', amount: 10000 })).code, 'BETTING_CLOSED');
});

// ---------------- Dice ----------------
test('dice: validates market and stake, pays sic-bo odds once, settles losses', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const socket = await connect(player);
  await openRound(engines.dice);

  assert.equal((await emitAck(socket, 'dice:bet', { room: '1min', market: 'MAGIC', amount: 100 })).code, 'INVALID_BET');
  assert.equal((await emitAck(socket, 'dice:bet', { room: '1min', market: 'BIG', amount: 'abc' })).code, 'INVALID_AMOUNT');
  assert.equal((await emitAck(socket, 'dice:bet', { room: '1min', market: 'BIG', amount: 100 })).success, true);
  assert.equal((await emitAck(socket, 'dice:bet', { room: '1min', market: 'SMALL', amount: 100 })).success, true);

  const settledEvents = [];
  socket.on('bet:settled', (e) => settledEvents.push(e));
  await engines.dice.onSettlement(engines.dice.roundId, { dice: [4, 5, 6] }); // sum 15: BIG wins
  await engines.dice.onSettlement(engines.dice.roundId, { dice: [4, 5, 6] });
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(settledEvents.map((e) => [e.game, e.stake, e.payout]).sort(), [['dice', 100, 0], ['dice', 100, 200]],
    'the player is told each real outcome exactly once');
  assert.equal(await balanceOf(player.id), 100000n - 20000n + 20000n);
  await h.assertLedgerMatchesWallet(assert, player.id);
});

// ---------------- Lotto ----------------
test('lotto: tickets cost ₹100 through the ledger and pay once by matches', async () => {
  const player = await h.createUser({ balancePaise: 50000n });
  const socket = await connect(player);
  await openRound(engines.lotto);

  assert.equal((await emitAck(socket, 'lotto:buy', { numbers: [1, 2, 3, 4, 5, 5] })).code, 'INVALID_BET');
  assert.equal((await emitAck(socket, 'lotto:buy', { numbers: [1, 2, 3, 4, 5, 60] })).code, 'INVALID_BET');
  const buy = await emitAck(socket, 'lotto:buy', { userId: 'someone-else', numbers: [1, 2, 3, 4, 5, 6] });
  assert.equal(buy.success, true, JSON.stringify(buy));
  assert.equal(buy.data.newBalance, 400);

  await engines.lotto.onSettlement(engines.lotto.roundId, { winningNumbers: [1, 2, 3, 40, 41, 42] }); // 3 matches = ₹500
  await engines.lotto.onSettlement(engines.lotto.roundId, { winningNumbers: [1, 2, 3, 40, 41, 42] });
  assert.equal(await balanceOf(player.id), 40000n + 50000n);
  await h.assertLedgerMatchesWallet(assert, player.id);
});

// ---------------- Dragon Tiger ----------------
test('dragon tiger: malformed amounts cannot crash the server; wins and losses settle', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const socket = await connect(player);
  await openRound(engines.dt);

  assert.equal((await emitAck(socket, 'tg:bet', { gameId: 'dragon-tiger', room: 'Standard', market: 'DRAGON', amount: 'NaN' })).code, 'INVALID_AMOUNT');
  // Missing ack callback + garbage payload must not take the process down.
  socket.emit('tg:bet', { gameId: 'dragon-tiger', amount: { x: 1 } });
  assert.equal((await emitAck(socket, 'tg:bet', { gameId: 'dragon-tiger', room: 'Standard', market: 'BANKER', amount: 100 })).code, 'INVALID_BET');
  assert.equal((await emitAck(socket, 'tg:bet', { gameId: 'dragon-tiger', room: 'Standard', market: 'DRAGON', amount: 100 })).success, true);
  assert.equal((await emitAck(socket, 'tg:bet', { gameId: 'dragon-tiger', room: 'Standard', market: 'TIE', amount: 100 })).success, true);

  await engines.dt.onSettlement(engines.dt.roundId, { winner: 'DRAGON' });
  await engines.dt.onSettlement(engines.dt.roundId, { winner: 'DRAGON' });
  assert.equal(await balanceOf(player.id), 100000n - 20000n + 20000n);
  await h.assertLedgerMatchesWallet(assert, player.id);
  const [reserve] = await h.prisma.$queryRaw`SELECT COALESCE(SUM(CASE WHEN "creditAccountId"='SYSTEM:WAGER_RESERVE' THEN amount ELSE -amount END),0)::bigint AS net FROM "LedgerTransaction" WHERE 'SYSTEM:WAGER_RESERVE' IN ("creditAccountId","debitAccountId") AND "referenceId" IN (SELECT id FROM "TableGameBet")`;
  assert.equal(BigInt(reserve.net), 0n, 'losing stakes are released from the wager reserve');
});

// ---------------- Andar Bahar ----------------
test('andar bahar: deals a real deck and settles main and joker bets', async () => {
  const deal = provablyFair.deriveAndarBaharResult('server-seed', 'client-seed', 1).outcome;
  const last = deal.dealtCards[deal.dealtCards.length - 1];
  assert.equal(last.card.rank, deal.joker.rank, 'the deal stops on the first card matching the joker rank');
  assert.equal(last.side, deal.winner);
  assert.equal(deal.dealtCards.filter((c) => c.card.rank === deal.joker.rank).length, 1);
  assert.equal(deal.dealtCards[0].side, 'ANDAR');

  const player = await h.createUser({ balancePaise: 100000n });
  const socket = await connect(player);
  await openRound(engines.ab);
  for (const market of ['ANDAR', 'BAHAR', 'JOKER_RED']) {
    const res = await emitAck(socket, 'tg:bet', { gameId: 'andar-bahar', room: 'Auto', market, amount: 100 });
    assert.equal(res.success, true, JSON.stringify(res));
  }
  const result = { joker: { suit: 'H', rank: 7 }, winner: 'BAHAR', dealtCards: [] };
  await engines.ab.onSettlement(engines.ab.roundId, result);
  await engines.ab.onSettlement(engines.ab.roundId, result);
  assert.equal(await balanceOf(player.id), 100000n - 30000n + 20000n + 19000n, 'BAHAR 2x and JOKER_RED 1.9x paid once');
  await h.assertLedgerMatchesWallet(assert, player.id);
});

// ---------------- Roulette ----------------
test('roulette: a market cannot cover more numbers than it should; valid bets settle', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const socket = await connect(player);
  await openRound(engines.roulette);

  const all = Array.from({ length: 37 }, (_, i) => i);
  assert.equal((await emitAck(socket, 'roulette:bet', { market: 'STRAIGHT', targets: all, amount: 100 })).code, 'INVALID_BET');
  assert.equal((await emitAck(socket, 'roulette:bet', { market: 'SPLIT', targets: [1, 36], amount: 100 })).code, 'INVALID_BET');
  assert.equal((await emitAck(socket, 'roulette:bet', { market: 'DOZEN', targets: [1, 2, 3], amount: 100 })).code, 'INVALID_BET');
  // RED ignores client targets entirely.
  const red = await emitAck(socket, 'roulette:bet', { market: 'RED', targets: [0, 2, 4], amount: 100 });
  assert.equal(red.success, true, JSON.stringify(red));
  assert.equal(red.data.targets.includes(0), false);
  assert.equal((await emitAck(socket, 'roulette:bet', { market: 'STRAIGHT', targets: [17], amount: 100 })).success, true);

  await engines.roulette.onSettlement(engines.roulette.roundId, { resultNumber: 17 }); // 17 is black
  await engines.roulette.onSettlement(engines.roulette.roundId, { resultNumber: 17 });
  assert.equal(await balanceOf(player.id), 100000n - 20000n + 360000n, 'straight 35:1 paid once, red lost');
  await h.assertLedgerMatchesWallet(assert, player.id);
});

// ---------------- Slots ----------------
test('slots: spins debit and settle atomically; paytable returns well under 100%', async () => {
  const player = await h.createUser({ balancePaise: 500000n });
  const socket = await connect(player);
  assert.equal((await emitAck(socket, 'slot:spin', { stake: -10000 })).code, 'INVALID_AMOUNT');
  assert.equal((await emitAck(socket, 'slot:spin', { stake: 1050 })).code, 'INVALID_AMOUNT');
  for (let i = 0; i < 10; i++) {
    const spin = await emitAck(socket, 'slot:spin', { stake: 1000 });
    assert.equal(spin.success, true, JSON.stringify(spin));
    assert.equal(spin.data.newBalance, Number(await balanceOf(player.id)));
  }
  await h.assertLedgerMatchesWallet(assert, player.id);

  const { SlotEngine } = require('slot-engine');
  const crypto = require('crypto');
  const engine = new SlotEngine();
  let staked = 0;
  let won = 0;
  for (let i = 0; i < 60000; i++) {
    const seed = crypto.createHash('sha256').update(`rtp-${i}`).digest('hex');
    won += Math.floor(engine.evaluate(engine.generateGrid(seed, 'c', 1), 2000).totalWin);
    staked += 2000;
  }
  const rtp = (won / staked) * 100;
  assert.ok(rtp > 90 && rtp < 99, `slot RTP ${rtp.toFixed(2)}% must stay below 100%`);
});

// ---------------- Scratch ----------------
test('scratch: reveal is owner-only, pays exactly once, and never double-credits', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const other = await h.createUser({ balancePaise: 0n });
  const socket = await connect(player);
  const otherSocket = await connect(other);

  const buy = await emitAck(socket, 'scratch:buy', { tierId: 'Gold' });
  assert.equal(buy.success, true, JSON.stringify(buy));
  assert.equal(await balanceOf(player.id), 80000n);

  assert.equal((await emitAck(otherSocket, 'scratch:reveal', { ticketId: buy.data.ticketId })).code, 'NOT_FOUND');
  const [a, b] = await Promise.all([
    emitAck(socket, 'scratch:reveal', { ticketId: buy.data.ticketId }),
    emitAck(socket, 'scratch:reveal', { ticketId: buy.data.ticketId })
  ]);
  assert.equal([a, b].filter((r) => r.success).length, 1);
  const ticket = await h.prisma.scratchTicket.findUnique({ where: { id: buy.data.ticketId } });
  assert.equal(await balanceOf(player.id), 80000n + ticket.payout);
  await h.assertLedgerMatchesWallet(assert, player.id);
});

// ---------------- Blackjack ----------------
test('blackjack: hidden information stays hidden, only the owner can act, hands settle once', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const intruder = await h.createUser({ balancePaise: 0n });
  const socket = await connect(player);
  const intruderSocket = await connect(intruder);

  const join = await emitAck(socket, 'bj:join', {});
  assert.equal(join.success, true, JSON.stringify(join));
  assert.equal((await emitAck(socket, 'bj:bet', { gameId: join.gameId, amount: -100 })).code, 'INVALID_AMOUNT');
  assert.equal((await emitAck(intruderSocket, 'bj:bet', { gameId: join.gameId, amount: 100 })).code, 'NOT_FOUND');

  const bet = await emitAck(socket, 'bj:bet', { gameId: join.gameId, amount: 100 });
  assert.equal(bet.success, true, JSON.stringify(bet));
  assert.equal(bet.state.shoe, undefined, 'the shoe is never sent to the client');
  if (bet.state.status === 'PLAYING') {
    assert.deepEqual(bet.state.dealerCards[1], { hidden: true }, 'hole card hidden while playing');
    const hand = bet.state.hands[0];
    assert.equal((await emitAck(intruderSocket, 'bj:action', { gameId: bet.gameId, handId: hand.id, actionType: 'STAND' })).code, 'NOT_FOUND');
    const stood = await emitAck(socket, 'bj:action', { gameId: bet.gameId, handId: hand.id, actionType: 'STAND' });
    assert.equal(stood.success, true, JSON.stringify(stood));
    assert.equal(stood.state.status, 'SETTLED');
  }

  const game = await h.prisma.blackjackGame.findUnique({ where: { id: bet.gameId }, include: { hands: true } });
  const payout = game.hands[0].payout;
  assert.equal(await balanceOf(player.id), 90000n + payout);
  await h.assertLedgerMatchesWallet(assert, player.id);

  // Next round on the same table starts a fresh game.
  const again = await emitAck(socket, 'bj:bet', { gameId: bet.gameId, amount: 100 });
  assert.equal(again.success, true, JSON.stringify(again));
  assert.notEqual(again.gameId, bet.gameId);
});

// ---------------- Disabled tables ----------------
test('multiplayer card tables and sportsbook do not accept real money', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const socket = await connect(player);
  for (const event of ['tp:join', 'poker_join', 'rm:join', 'rm:declare']) {
    assert.equal((await emitAck(socket, event, { userId: player.id })).code, 'COMING_SOON', event);
  }
  const httpServer = await h.startHttp();
  try {
    const res = await httpServer.request('POST', '/api/wager/place', { token: h.tokenFor(player), body: { stake: 100 } });
    assert.equal(res.status, 503);
  } finally {
    await httpServer.close();
  }
  assert.equal(await balanceOf(player.id), 100000n);
});
