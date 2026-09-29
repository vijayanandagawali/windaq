const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const cd = require('../src/services/fantasy/cricketData');

process.env.CRICKETDATA_API_KEY = 'test-key-not-real';

const squadJson = [
  { teamName: 'Mumbai', shortname: 'MUM', players: [
    { id: 'p1', name: 'Keeper One', role: 'WK-Batsman' }, { id: 'p2', name: 'Bat One', role: 'Batsman' },
    { id: 'p3', name: 'Allround One', role: 'Batting Allrounder' }, { id: 'p4', name: 'Bowl One', role: 'Bowler' },
    { id: 'p5', name: 'No Role', role: '' }
  ] },
  { teamName: 'Chennai', shortname: 'CHE', players: [{ id: 'q1', name: 'Bowl Two', role: 'Bowling Allrounder' }, { id: 'q2', name: 'Bat Two', role: 'Batter' }] }
];

const scorecardJson = {
  matchEnded: true,
  scorecard: [
    {
      inning: 'Mumbai Inning 1',
      batting: [
        { batsman: { id: 'p2', name: 'Bat One' }, r: 52, b: 30, '4s': 4, '6s': 3, dismissal: 'catch', 'dismissal-text': 'c Bat Two b Bowl Two', bowler: { id: 'q1' }, catcher: { id: 'q2' } },
        { batsman: { id: 'p1', name: 'Keeper One' }, r: 0, b: 2, '4s': 0, '6s': 0, dismissal: 'bowled', 'dismissal-text': 'b Bowl Two', bowler: { id: 'q1' } },
        { batsman: { id: 'p3', name: 'Allround One' }, r: 12, b: 8, dismissal: '', 'dismissal-text': 'not out' }
      ],
      bowling: [{ bowler: { id: 'q1', name: 'Bowl Two' }, o: 3.4, m: 1, r: 20, w: 2 }],
      catching: [{ catcher: { id: 'q2', name: 'Bat Two' }, catch: 1, stumped: 0, runout: 1 }]
    },
    { inning: 'Chennai Inning 1', batting: [], bowling: [{ bowler: { id: 'q1' }, o: 0.2, m: 0, r: 5, w: 0 }], catching: [] }
  ]
};

test('provider roles and squads map to our roles, sides and default credits', () => {
  assert.deepEqual(['WK-Batsman', 'Batsman', 'Batter', 'Bowling Allrounder', 'Bowler', 'Coach'].map(cd.mapRole), ['WK', 'BAT', 'BAT', 'AR', 'BOWL', null]);
  const squad = cd.mapSquad(squadJson, 'Mumbai');
  assert.equal(squad.length, 6, 'players without a role are skipped');
  assert.deepEqual(squad.find((p) => p.externalId === 'q1'), { externalId: 'q1', name: 'Bowl Two', team: 'B', role: 'AR', credits: 8.5 });
  assert.equal(squad.find((p) => p.externalId === 'p4').credits, 8);
});

test('scorecard maps batting, bowling across innings, bowled/LBW credit and fielding', () => {
  const s = cd.mapScorecard(scorecardJson);
  assert.deepEqual(
    { runs: s.get('p2').runs, balls: s.get('p2').balls, fours: s.get('p2').fours, sixes: s.get('p2').sixes, dismissed: s.get('p2').dismissed },
    { runs: 52, balls: 30, fours: 4, sixes: 3, dismissed: true }
  );
  assert.equal(s.get('p1').dismissed, true);
  assert.equal(s.get('p3').dismissed, undefined, 'not out');
  assert.equal(s.get('q1').overs, 4, '3.4 + 0.2 overs = 4.0');
  assert.equal(s.get('q1').wickets, 2);
  assert.equal(s.get('q1').bowledLbw, 1, 'only the bowled dismissal earns the bonus');
  assert.equal(s.get('q1').runsConceded, 25);
  assert.equal(s.get('q2').catches, 1);
  assert.equal(s.get('q2').runOutIndirect, 1);
  assert.equal(cd.addOvers(1.5, 1.5), 3.4);
  assert.equal(cd.mapScorecard(null).size, 0, 'missing data maps to nothing');
});

test('import, squad and scorecard sync drive points; the budget guard stops calls near the limit', async () => {
  await h.resetDb();
  const calls = [];
  let hits = 20;
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u.pathname);
    assert.equal(u.searchParams.get('apikey'), 'test-key-not-real');
    hits += u.pathname.endsWith('series') || u.pathname.endsWith('series_info') ? 1 : 10;
    const body = u.pathname.endsWith('match_squad') ? squadJson : u.pathname.endsWith('match_scorecard') ? scorecardJson : [];
    return { json: async () => ({ status: 'success', data: body, info: { hitsToday: hits, hitsLimit: 100 } }) };
  };
  try {
    const fantasy = require('../src/services/fantasy/fantasyService');
    const startsAt = new Date(Date.now() + 3600e3).toISOString();
    const imp = await fantasy.importFixture({ externalId: 'ext-1', teamInfo: [{ name: 'Mumbai', shortname: 'MUM' }, { name: 'Chennai', shortname: 'CHE' }], startsAt, hasSquad: true });
    assert.equal(imp.squad.added, 6);
    await assert.rejects(fantasy.importFixture({ externalId: 'ext-1', teamInfo: [{ name: 'A' }, { name: 'B' }], startsAt }), { code: 'ALREADY_IMPORTED' });
    const again = await fantasy.fetchSquadFor(imp.matchId);
    assert.equal(again.added, 0, 'fetching the squad twice adds no duplicates');

    await h.prisma.fantasyMatch.update({ where: { id: imp.matchId }, data: { status: 'LIVE' } });
    const sync = await fantasy.syncScorecard(imp.matchId);
    assert.equal(sync.ended, true);
    const bat = await h.prisma.fantasyPlayer.findFirst({ where: { matchId: imp.matchId, externalId: 'p2' } });
    // 52 runs + 16 boundaries + 18 sixes + 25/50 bonuses (4+8) + SR 173 (+6) + played (+4)
    assert.equal(bat.points, 52 + 16 + 18 + 4 + 8 + 6 + 4);
    const match = await h.prisma.fantasyMatch.findUnique({ where: { id: imp.matchId } });
    assert.equal(match.status, 'COMPLETED', 'a finished match is completed by the sync');

    // Near the daily limit the guard refuses fantasy calls instead of spending the reserve.
    hits = 85;
    cd.usage.hitsToday = 85;
    await assert.rejects(fantasy.fetchSquadFor(imp.matchId), { code: 'PROVIDER_BUDGET' });
    assert.equal(calls.filter((c) => c.endsWith('match_squad')).length, 2, 'the refused call never reached the provider');
  } finally {
    global.fetch = realFetch;
    cd.usage.hitsToday = null;
    await h.prisma.$disconnect();
  }
});
