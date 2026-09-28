const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const L = require('../src/services/ludo/ludoRules');
const ludo = require('../src/services/ludo/ludoPractice');

const players = (...tokenSets) => tokenSets.map(([seat, tokens]) => ({ seat, tokens }));

test('movement: a 6 brings a token out, exact roll to home, nothing past home', () => {
  assert.equal(L.target(-1, 5), null);
  assert.equal(L.target(-1, 6), 0);
  assert.equal(L.target(50, 3), 53, 'enters the home column');
  assert.equal(L.target(53, 3), 56);
  assert.equal(L.target(53, 4), null, 'overshooting home is not allowed');
  assert.equal(L.target(56, 1), null);
  assert.deepEqual(L.legalMoves([-1, 10, 56, 54], 3), [1]);
});

test('captures send opponents home, except on safe squares; home column is private', () => {
  // Red token at 5 rolls 4 to land on red-relative 9 = absolute 9. Yellow (start 26) at relative 35 is absolute 9.
  let r = L.applyMove(players([0, [5, -1, -1, -1]], [2, [35, -1, -1, -1]]), 0, 0, 4);
  assert.deepEqual(r.captured, [{ seat: 2, token: 0 }]);
  assert.equal(r.players[1].tokens[0], -1);
  assert.equal(r.extraTurn, true, 'a capture earns another roll');

  // Absolute 8 is a star (safe): no capture.
  r = L.applyMove(players([0, [4, -1, -1, -1]], [2, [34, -1, -1, -1]]), 0, 0, 4);
  assert.deepEqual(r.captured, []);

  // Tokens in a home column are never on the shared track.
  assert.equal(L.absSquare(0, 52), null);
  r = L.applyMove(players([0, [50, -1, -1, -1]], [1, [37, -1, -1, -1]]), 0, 0, 2);
  assert.deepEqual(r.captured, []);
});

test('starts and stars are the eight safe squares, 13 apart per seat', () => {
  assert.deepEqual([...L.SAFE_SQUARES].sort((a, b) => a - b), [0, 8, 13, 21, 26, 34, 39, 47]);
  assert.deepEqual([0, 1, 2, 3].map((s) => L.absSquare(s, 0)), [0, 13, 26, 39]);
  assert.equal(L.absSquare(1, 50), 11, 'green turns into its home column before its start');
});

test('practice games run to a winner, dice come from the committed seed, and turns are enforced', () => {
  for (const opponents of [1, 3]) {
    for (let t = 0; t < 8; t++) {
      const owner = `lt-${opponents}-${t}`;
      const g = ludo.start(owner, { opponents, fresh: true });
      assert.equal(ludo.toPublic(g).serverSeed, null);
      let guard = 0;
      while (g.winner === null && guard++ < 2000) {
        const view = ludo.toPublic(g);
        assert.equal(view.yourTurn, true, 'after every call it is the player turn again, or the game ended');
        const { game } = ludo.roll(owner, g.id);
        const pv = ludo.toPublic(game);
        if (pv.legalMoves.length) {
          assert.throws(() => ludo.roll(owner, g.id), { code: 'MOVE_PENDING' });
          ludo.move(owner, g.id, L.chooseMove(game.players, game.current, game.roll));
        }
      }
      assert.notEqual(g.winner, null, `game ${opponents}/${t} finished`);
      const winnerTokens = g.players.find((p) => (g.winner === 'you' ? p.kind === 'you' : p.seat === g.winner)).tokens;
      assert.ok(L.hasWon(winnerTokens));
      const pub = ludo.toPublic(g);
      assert.equal(pub.serverSeedHash, crypto.createHash('sha256').update(pub.serverSeed).digest('hex'));
      assert.throws(() => ludo.roll(owner, g.id), { code: 'GAME_OVER' });
    }
  }
  assert.throws(() => ludo.roll('nobody', 'x'), { code: 'NOT_FOUND' });
});
