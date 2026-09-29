const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let http;
let admin;
let adminToken;

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
  admin = await h.createUser({ role: 'SUPER_ADMIN' });
  adminToken = h.tokenFor(admin);
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

const ROLES = ['WK', 'WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL'];

async function setupMatch(startsInMs = 60 * 60 * 1000) {
  const m = await http.request('POST', '/api/fantasy/admin/matches', {
    token: adminToken,
    body: { teamA: 'Mumbai', teamB: 'Chennai', teamAShort: 'MUM', teamBShort: 'CHE', startsAt: new Date(Date.now() + startsInMs).toISOString() }
  });
  assert.equal(m.status, 200, m.text);
  const matchId = m.body.data.id;
  const players = [];
  for (const team of ['A', 'B']) ROLES.forEach((role, i) => players.push({ name: `${team}-${role}-${i}`, team, role, credits: 9 }));
  const added = await http.request('POST', `/api/fantasy/admin/matches/${matchId}/players`, { token: adminToken, body: { players } });
  assert.equal(added.body.data, 22);
  const c = await http.request('POST', `/api/fantasy/admin/matches/${matchId}/contests`, { token: adminToken, body: { name: 'Mega (free)', maxEntries: 3, maxTeamsPerUser: 2 } });
  const detail = await http.request('GET', `/api/fantasy/matches/${matchId}`);
  return { matchId, contestId: c.body.data.id, players: detail.body.data.players };
}

function pickTeam(players) {
  const by = (team, role) => players.filter((p) => p.team === team && p.role === role).map((p) => p.id);
  const ids = [by('A', 'WK')[0], ...by('A', 'BAT').slice(0, 2), ...by('B', 'BAT').slice(0, 2), by('A', 'AR')[0], by('B', 'AR')[0], ...by('A', 'BOWL').slice(0, 2), ...by('B', 'BOWL').slice(0, 2)];
  return { playerIds: ids, captainId: ids[1], viceCaptainId: ids[9] };
}

test('only admins manage fixtures; the public sees matches without signing in', async () => {
  const player = await h.createUser();
  const denied = await http.request('POST', '/api/fantasy/admin/matches', { token: h.tokenFor(player), body: { teamA: 'X', teamB: 'Y', startsAt: new Date().toISOString() } });
  assert.equal(denied.status, 403);
  const { matchId } = await setupMatch();
  const list = await http.request('GET', '/api/fantasy/matches');
  assert.ok(list.body.data.some((m) => m.id === matchId && m.open));
  const detail = await http.request('GET', `/api/fantasy/matches/${matchId}`);
  assert.equal(detail.body.data.players.length, 22);
  assert.equal(detail.body.data.players[0].points, null, 'no points before the match');
});

test('team rules are enforced by the server; free contest joins respect limits', async () => {
  const { matchId, contestId, players } = await setupMatch();
  const u1 = await h.createUser();
  const t1 = h.tokenFor(u1);

  const bad = await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: t1, body: { ...pickTeam(players), playerIds: pickTeam(players).playerIds.slice(0, 10) } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'INVALID_TEAM');

  const guest = await h.createUser({ isGuest: true });
  assert.equal((await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: h.tokenFor(guest), body: pickTeam(players) })).status, 401);

  const team = await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: t1, body: pickTeam(players) });
  assert.equal(team.status, 200, team.text);
  const teamId = team.body.data.id;

  assert.equal((await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: t1, body: { teamId } })).status, 200);
  assert.equal((await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: t1, body: { teamId } })).body.code, 'ALREADY_JOINED');

  const other = await h.createUser();
  const stolen = await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: h.tokenFor(other), body: { teamId } });
  assert.equal(stolen.body.code, 'INVALID_TEAM', 'another player cannot enter your team');

  // Paid contests are refused.
  const paid = await h.prisma.fantasyContest.create({ data: { matchId, name: 'Paid', entryFee: 4900n, maxEntries: 10 } });
  assert.equal((await http.request('POST', `/api/fantasy/contests/${paid.id}/join`, { token: t1, body: { teamId } })).status, 403);

  // The contest holds 3 entries.
  for (let i = 0; i < 2; i++) {
    const u = await h.createUser();
    const tm = await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: h.tokenFor(u), body: pickTeam(players) });
    assert.equal((await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: h.tokenFor(u), body: { teamId: tm.body.data.id } })).status, 200);
  }
  const u4 = await h.createUser();
  const tm4 = await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: h.tokenFor(u4), body: pickTeam(players) });
  assert.equal((await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: h.tokenFor(u4), body: { teamId: tm4.body.data.id } })).body.code, 'CONTEST_FULL');

  // Before the deadline other players' picks stay hidden.
  const lb = await http.request('GET', `/api/fantasy/contests/${contestId}/leaderboard`, { token: t1 });
  assert.equal(lb.body.data.entries.length, 3);
  assert.ok(lb.body.data.entries.filter((e) => !e.mine).every((e) => e.team === null));
  assert.ok(lb.body.data.entries.find((e) => e.mine).team);
});

test('the deadline locks teams, and the scorecard drives points and ranks', async () => {
  const { matchId, contestId, players } = await setupMatch();
  const a = await h.createUser();
  const b = await h.createUser();
  const pa = pickTeam(players);
  const pb = { ...pa, captainId: pa.playerIds[5], viceCaptainId: pa.playerIds[1] };
  const ta = await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: h.tokenFor(a), body: pa });
  const tb = await http.request('POST', `/api/fantasy/matches/${matchId}/teams`, { token: h.tokenFor(b), body: pb });
  await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: h.tokenFor(a), body: { teamId: ta.body.data.id } });
  await http.request('POST', `/api/fantasy/contests/${contestId}/join`, { token: h.tokenFor(b), body: { teamId: tb.body.data.id } });

  await http.request('PATCH', `/api/fantasy/admin/matches/${matchId}`, { token: adminToken, body: { status: 'LIVE' } });
  const late = await http.request('PUT', `/api/fantasy/teams/${ta.body.data.id}`, { token: h.tokenFor(a), body: pb });
  assert.equal(late.body.code, 'DEADLINE_PASSED');

  // Team A's captain (pa.playerIds[1]) scores 50 runs off 30 with 4 fours and 2 sixes.
  const star = pa.playerIds[1];
  const sc = await http.request('POST', `/api/fantasy/admin/matches/${matchId}/scorecard`, {
    token: adminToken, body: { lines: [{ playerId: star, stats: { runs: 50, balls: 30, fours: 4, sixes: 2 } }] }
  });
  assert.equal(sc.status, 200, sc.text);
  const starPoints = 50 + 16 + 12 + 4 + 8 + 4; // runs, boundaries, sixes, 25 and 50 bonuses, SR 166.7

  const lb = await http.request('GET', `/api/fantasy/contests/${contestId}/leaderboard`, { token: h.tokenFor(b) });
  const [first, second] = lb.body.data.entries;
  assert.equal(first.points, starPoints * 2, 'captain doubles');
  assert.equal(first.rank, 1);
  assert.equal(second.points, starPoints * 1.5, 'vice-captain 1.5x');
  assert.equal(second.rank, 2);
  assert.ok(first.team, 'after the deadline everyone can see the picks');
});
