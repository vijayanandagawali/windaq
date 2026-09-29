const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/services/fantasy/fantasyRules');

function squad() {
  const roles = ['WK', 'WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL'];
  const out = [];
  for (const team of ['A', 'B']) roles.forEach((role, i) => out.push({ id: `${team}${i}`, team, role, credits: 9 }));
  return out;
}

test('team rules: size, credits, 7-per-side, role limits, captain and vice-captain', () => {
  const players = squad();
  // A valid 11: 1 WK, 4 BAT, 2 AR, 4 BOWL, split 6/5, 99 credits.
  const ids = ['A0', 'A2', 'A3', 'B2', 'B3', 'A6', 'B6', 'A8', 'A9', 'B8', 'B9'];
  assert.deepEqual(F.validateTeam(players, { playerIds: ids, captainId: 'A2', viceCaptainId: 'B8' }).ok, true);
  assert.match(F.validateTeam(players, { playerIds: ids.slice(0, 10), captainId: 'A2', viceCaptainId: 'B8' }).reason, /exactly 11/);
  assert.match(F.validateTeam(players, { playerIds: [...ids.slice(0, 10), 'A2'], captainId: 'A2', viceCaptainId: 'B8' }).reason, /only once/);
  assert.match(F.validateTeam(players, { playerIds: ids, captainId: 'A2', viceCaptainId: 'A2' }).reason, /different/);
  assert.match(F.validateTeam(players, { playerIds: ids, captainId: 'X', viceCaptainId: 'B8' }).reason, /captain/);

  const pricey = players.map((p) => (p.id === 'A2' ? { ...p, credits: 11 } : p));
  assert.match(F.validateTeam(pricey, { playerIds: ids, captainId: 'A2', viceCaptainId: 'B8' }).reason, /101 credits/);

  const eightA = ['A0', 'A2', 'A3', 'A4', 'A6', 'A8', 'A9', 'A10', 'B2', 'B6', 'B8'];
  assert.match(F.validateTeam(players, { playerIds: eightA, captainId: 'A2', viceCaptainId: 'B8' }).reason, /At most 7/);

  const noKeeper = ['A2', 'A3', 'B2', 'B3', 'A4', 'A6', 'B6', 'A8', 'A9', 'B8', 'B9'];
  assert.match(F.validateTeam(players, { playerIds: noKeeper, captainId: 'A2', viceCaptainId: 'B8' }).reason, /1-4 wicket-keepers/);
});

test('batting points: runs, boundaries, cumulative milestones, strike rate and ducks', () => {
  // 104 off 60 with 8 fours and 6 sixes: 104 + 32 + 36 + 4 + 8 + 12 + 16 + SR 173 (+6) + lineup 4
  const century = F.playerPoints('BAT', { inLineup: true, runs: 104, balls: 60, fours: 8, sixes: 6 });
  assert.equal(century.total, 104 + 32 + 36 + 4 + 8 + 12 + 16 + 6 + 4);
  assert.equal(F.playerPoints('BAT', { runs: 0, balls: 3, dismissed: true }).total, -2);
  assert.equal(F.playerPoints('BOWL', { runs: 0, balls: 3, dismissed: true }).total, 0, 'no duck penalty for bowlers');
  assert.equal(F.playerPoints('BAT', { runs: 12, balls: 25 }).total, 12 - 6, 'strike rate 48 costs 6');
  assert.equal(F.playerPoints('BAT', { runs: 8, balls: 9 }).total, 8, 'fewer than 10 balls: no strike-rate points');
});

test('bowling and fielding points, economy bands and overs notation', () => {
  assert.equal(F.oversToBalls(3.4), 22);
  // 4-0-18-3 with two bowled/LBW and a maiden: 90 + 16 + 4 + 12 + economy 4.5 (+6)
  assert.equal(F.playerPoints('BOWL', { wickets: 3, bowledLbw: 2, overs: 4, runsConceded: 18, maidens: 1 }).total, 90 + 16 + 4 + 12 + 6);
  // Five wickets earn only the 5-wicket bonus, not 3 and 4 as well.
  assert.equal(F.playerPoints('BOWL', { wickets: 5, overs: 4, runsConceded: 30 }).total, 150 + 12 + 0);
  assert.equal(F.playerPoints('BOWL', { overs: 2, runsConceded: 26 }).total, -6, 'economy 13');
  assert.equal(F.playerPoints('BOWL', { overs: 1.5, runsConceded: 30 }).total, 0, 'under 2 overs: no economy points');
  assert.equal(F.playerPoints('WK', { catches: 3, stumpings: 1, runOutDirect: 1, runOutIndirect: 1 }).total, 24 + 4 + 12 + 12 + 6);
});

test('team totals apply captain 2x and vice-captain 1.5x; ties share a rank', () => {
  const pts = new Map([['a', 100], ['b', 40], ['c', 10]]);
  assert.equal(F.teamPoints({ playerIds: ['a', 'b', 'c'], captainId: 'a', viceCaptainId: 'b' }, pts), 200 + 60 + 10);
  const ranks = F.rankEntries([{ id: 'x', points: 50 }, { id: 'y', points: 80 }, { id: 'z', points: 50 }, { id: 'w', points: 10 }]);
  assert.deepEqual(['y', 'x', 'z', 'w'].map((k) => ranks.get(k)), [1, 2, 2, 4]);
});
