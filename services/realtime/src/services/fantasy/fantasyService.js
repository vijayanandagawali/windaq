/**
 * Fantasy cricket service: fixtures, teams, free contests and scoring.
 * Deadlines are enforced on the server (a team can be created or edited only before the match
 * starts and while it is UPCOMING). Points are recomputed from the admin-entered scorecard.
 */
const { PrismaClient } = require('@prisma/client');
const F = require('./fantasyRules');

const prisma = new PrismaClient();
const MAX_TEAMS_PER_MATCH = 20;
const ROLES = ['WK', 'BAT', 'AR', 'BOWL'];

class FantasyError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const isOpen = (match) => match.status === 'UPCOMING' && new Date(match.startsAt).getTime() > Date.now();

function publicMatch(m, { withPlayers = false } = {}) {
  return {
    id: m.id,
    title: m.title,
    teamA: m.teamA,
    teamB: m.teamB,
    teamAShort: m.teamAShort,
    teamBShort: m.teamBShort,
    format: m.format,
    venue: m.venue,
    startsAt: m.startsAt,
    status: m.status,
    open: isOpen(m),
    ...(withPlayers ? {
      players: (m.players || []).map((p) => ({
        id: p.id, name: p.name, team: p.team, role: p.role, credits: p.credits, inLineup: p.inLineup,
        points: m.status === 'UPCOMING' ? null : p.points
      }))
    } : {})
  };
}

async function listMatches() {
  const matches = await prisma.fantasyMatch.findMany({
    where: { status: { in: ['UPCOMING', 'LIVE', 'COMPLETED'] } },
    orderBy: { startsAt: 'asc' },
    take: 100
  });
  return matches.map((m) => publicMatch(m));
}

async function getMatch(id) {
  const m = await prisma.fantasyMatch.findUnique({
    where: { id: String(id || '') },
    include: { players: { orderBy: [{ team: 'asc' }, { credits: 'desc' }] }, contests: { include: { _count: { select: { entries: true } } } } }
  });
  if (!m) throw new FantasyError('NOT_FOUND', 'Match not found.', 404);
  return {
    ...publicMatch(m, { withPlayers: true }),
    contests: m.contests.map((c) => ({
      id: c.id, name: c.name, entryFee: Number(c.entryFee) / 100, maxEntries: c.maxEntries,
      maxTeamsPerUser: c.maxTeamsPerUser, prizeText: c.prizeText, joined: c._count.entries
    }))
  };
}

async function loadOpenMatch(matchId) {
  const m = await prisma.fantasyMatch.findUnique({ where: { id: String(matchId || '') }, include: { players: true } });
  if (!m) throw new FantasyError('NOT_FOUND', 'Match not found.', 404);
  if (!isOpen(m)) throw new FantasyError('DEADLINE_PASSED', 'Teams are locked: this match has started.', 409);
  return m;
}

async function createTeam(userId, matchId, body) {
  const m = await loadOpenMatch(matchId);
  const verdict = F.validateTeam(m.players, body);
  if (!verdict.ok) throw new FantasyError('INVALID_TEAM', verdict.reason);
  const count = await prisma.fantasyTeam.count({ where: { matchId: m.id, userId } });
  if (count >= MAX_TEAMS_PER_MATCH) throw new FantasyError('TEAM_LIMIT', `You can create up to ${MAX_TEAMS_PER_MATCH} teams for a match.`);
  return prisma.fantasyTeam.create({
    data: { matchId: m.id, userId, name: `Team ${count + 1}`, playerIds: body.playerIds, captainId: body.captainId, viceCaptainId: body.viceCaptainId }
  });
}

async function updateTeam(userId, teamId, body) {
  const team = await prisma.fantasyTeam.findUnique({ where: { id: String(teamId || '') } });
  if (!team || team.userId !== userId) throw new FantasyError('NOT_FOUND', 'Team not found.', 404);
  const m = await loadOpenMatch(team.matchId);
  const verdict = F.validateTeam(m.players, body);
  if (!verdict.ok) throw new FantasyError('INVALID_TEAM', verdict.reason);
  return prisma.fantasyTeam.update({ where: { id: team.id }, data: { playerIds: body.playerIds, captainId: body.captainId, viceCaptainId: body.viceCaptainId } });
}

async function myTeams(userId, matchId) {
  const teams = await prisma.fantasyTeam.findMany({ where: { matchId: String(matchId || ''), userId }, orderBy: { createdAt: 'asc' }, include: { entries: { select: { contestId: true, rank: true, points: true } } } });
  return teams.map((t) => ({ id: t.id, name: t.name, playerIds: t.playerIds, captainId: t.captainId, viceCaptainId: t.viceCaptainId, points: t.points, entries: t.entries }));
}

async function joinContest(userId, contestId, teamId) {
  const contest = await prisma.fantasyContest.findUnique({ where: { id: String(contestId || '') }, include: { match: true } });
  if (!contest) throw new FantasyError('NOT_FOUND', 'Contest not found.', 404);
  if (!isOpen(contest.match)) throw new FantasyError('DEADLINE_PASSED', 'Entries are closed: this match has started.', 409);
  if (contest.entryFee > 0n) throw new FantasyError('PAID_CONTESTS_CLOSED', 'Paid contests are not available.', 403);
  const team = await prisma.fantasyTeam.findUnique({ where: { id: String(teamId || '') } });
  if (!team || team.userId !== userId || team.matchId !== contest.matchId) throw new FantasyError('INVALID_TEAM', 'Choose one of your teams for this match.');

  return prisma.$transaction(async (tx) => {
    // Lock the contest row so the entry count cannot be exceeded by concurrent joins.
    await tx.$queryRaw`SELECT id FROM "FantasyContest" WHERE id = ${contest.id} FOR UPDATE`;
    const [total, mine] = await Promise.all([
      tx.fantasyEntry.count({ where: { contestId: contest.id } }),
      tx.fantasyEntry.count({ where: { contestId: contest.id, userId } })
    ]);
    if (total >= contest.maxEntries) throw new FantasyError('CONTEST_FULL', 'This contest is full.', 409);
    if (mine >= contest.maxTeamsPerUser) throw new FantasyError('ENTRY_LIMIT', `You can join this contest with ${contest.maxTeamsPerUser} team(s).`, 409);
    try {
      return await tx.fantasyEntry.create({ data: { contestId: contest.id, teamId: team.id, userId } });
    } catch (err) {
      if (err.code === 'P2002') throw new FantasyError('ALREADY_JOINED', 'This team is already in the contest.', 409);
      throw err;
    }
  });
}

const maskUser = (phone, userId) => (phone ? `Player •••${String(phone).slice(-4)}` : `Player ${String(userId).slice(-4)}`);

async function leaderboard(contestId, viewerId = null) {
  const contest = await prisma.fantasyContest.findUnique({ where: { id: String(contestId || '') }, include: { match: true } });
  if (!contest) throw new FantasyError('NOT_FOUND', 'Contest not found.', 404);
  const entries = await prisma.fantasyEntry.findMany({
    where: { contestId: contest.id },
    orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
    take: 500,
    include: { team: true }
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(entries.map((e) => e.userId))] } }, select: { id: true, phone: true } });
  const phones = new Map(users.map((u) => [u.id, u.phone]));
  const locked = !isOpen(contest.match);
  return {
    contest: { id: contest.id, name: contest.name, matchStatus: contest.match.status },
    entries: entries.map((e) => ({
      id: e.id,
      rank: e.rank,
      points: e.points,
      teamName: e.team.name,
      player: maskUser(phones.get(e.userId), e.userId),
      mine: viewerId === e.userId,
      // Other players' picks are shown only after the deadline, as on every fantasy platform.
      team: locked || viewerId === e.userId ? { playerIds: e.team.playerIds, captainId: e.team.captainId, viceCaptainId: e.team.viceCaptainId } : null
    }))
  };
}

// ------------------------------------------------------------------------- admin

async function adminCreateMatch(body) {
  const title = String(body.title || `${body.teamA} vs ${body.teamB}`).slice(0, 120);
  const startsAt = new Date(body.startsAt);
  if (!body.teamA || !body.teamB || Number.isNaN(startsAt.getTime())) throw new FantasyError('INVALID', 'Team names and a start time are required.');
  return prisma.fantasyMatch.create({
    data: {
      title,
      teamA: String(body.teamA).slice(0, 60),
      teamB: String(body.teamB).slice(0, 60),
      teamAShort: String(body.teamAShort || body.teamA).slice(0, 5).toUpperCase(),
      teamBShort: String(body.teamBShort || body.teamB).slice(0, 5).toUpperCase(),
      venue: body.venue ? String(body.venue).slice(0, 120) : null,
      startsAt
    }
  });
}

async function adminAddPlayers(matchId, players) {
  const m = await prisma.fantasyMatch.findUnique({ where: { id: String(matchId || '') } });
  if (!m) throw new FantasyError('NOT_FOUND', 'Match not found.', 404);
  const rows = (Array.isArray(players) ? players : []).map((p) => ({
    matchId: m.id,
    name: String(p.name || '').trim().slice(0, 60),
    team: p.team === 'B' ? 'B' : 'A',
    role: ROLES.includes(p.role) ? p.role : null,
    credits: Math.round(Number(p.credits) * 2) / 2
  }));
  if (!rows.length || rows.some((r) => !r.name || !r.role || !(r.credits >= 5 && r.credits <= 12))) {
    throw new FantasyError('INVALID', 'Each player needs a name, team A/B, role (WK/BAT/AR/BOWL) and credits between 5 and 12.');
  }
  await prisma.fantasyPlayer.createMany({ data: rows });
  return prisma.fantasyPlayer.count({ where: { matchId: m.id } });
}

async function adminSetStatus(matchId, status) {
  if (!['UPCOMING', 'LIVE', 'COMPLETED', 'ABANDONED'].includes(status)) throw new FantasyError('INVALID', 'Unknown status.');
  return prisma.fantasyMatch.update({ where: { id: String(matchId) }, data: { status } });
}

async function adminSetLineup(matchId, playerIds) {
  const ids = Array.isArray(playerIds) ? playerIds.map(String) : [];
  await prisma.$transaction([
    prisma.fantasyPlayer.updateMany({ where: { matchId: String(matchId) }, data: { inLineup: false } }),
    prisma.fantasyPlayer.updateMany({ where: { matchId: String(matchId), id: { in: ids } }, data: { inLineup: true } })
  ]);
  return recompute(matchId);
}

async function adminCreateContest(matchId, body) {
  const maxEntries = Math.max(2, Math.min(100000, parseInt(body.maxEntries, 10) || 100));
  return prisma.fantasyContest.create({
    data: {
      matchId: String(matchId),
      name: String(body.name || 'Free Contest').slice(0, 80),
      maxEntries,
      maxTeamsPerUser: Math.max(1, Math.min(20, parseInt(body.maxTeamsPerUser, 10) || 1)),
      prizeText: body.prizeText ? String(body.prizeText).slice(0, 120) : null
    }
  });
}

/** Stores scorecard lines and recomputes every player, team and contest entry for the match. */
async function adminScorecard(matchId, lines) {
  const players = await prisma.fantasyPlayer.findMany({ where: { matchId: String(matchId) } });
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const line of Array.isArray(lines) ? lines : []) {
    const p = byId.get(String(line.playerId));
    if (!p) continue;
    const stats = { ...(p.stats || {}), ...(line.stats || {}) };
    await prisma.fantasyPlayer.update({ where: { id: p.id }, data: { stats } });
  }
  return recompute(matchId);
}

async function recompute(matchId) {
  const players = await prisma.fantasyPlayer.findMany({ where: { matchId: String(matchId) } });
  const pointsById = new Map();
  for (const p of players) {
    const { total } = F.playerPoints(p.role, { ...(p.stats || {}), inLineup: p.inLineup });
    pointsById.set(p.id, total);
    if (total !== p.points) await prisma.fantasyPlayer.update({ where: { id: p.id }, data: { points: total } });
  }
  const teams = await prisma.fantasyTeam.findMany({ where: { matchId: String(matchId) } });
  for (const t of teams) {
    const pts = F.teamPoints(t, pointsById);
    await prisma.fantasyTeam.update({ where: { id: t.id }, data: { points: pts } });
    await prisma.fantasyEntry.updateMany({ where: { teamId: t.id }, data: { points: pts } });
  }
  const contests = await prisma.fantasyContest.findMany({ where: { matchId: String(matchId) }, select: { id: true } });
  for (const c of contests) {
    const entries = await prisma.fantasyEntry.findMany({ where: { contestId: c.id }, select: { id: true, points: true } });
    const ranks = F.rankEntries(entries);
    for (const e of entries) await prisma.fantasyEntry.update({ where: { id: e.id }, data: { rank: ranks.get(e.id) } });
  }
  return { players: players.length, teams: teams.length };
}

// ------------------------------------------------------------------ CricketData provider

const cricketData = require('./cricketData');
const SYNC_EVERY_MS = 10 * 60 * 1000;
const PROVIDER_STAT_FIELDS = ['runs', 'balls', 'fours', 'sixes', 'dismissed', 'overs', 'maidens', 'runsConceded', 'wickets', 'bowledLbw', 'catches', 'stumpings', 'runOutIndirect'];

function providerError(err) {
  if (err instanceof cricketData.ProviderError) {
    return new FantasyError(err.code === 'BUDGET' ? 'PROVIDER_BUDGET' : err.code === 'NOT_CONFIGURED' ? 'PROVIDER_NOT_CONFIGURED' : 'PROVIDER_ERROR', err.message, err.code === 'NOT_CONFIGURED' ? 503 : 502);
  }
  return err;
}

async function providerFixtures() {
  try {
    const fixtures = await cricketData.upcomingT20Fixtures();
    const imported = await prisma.fantasyMatch.findMany({ where: { externalId: { in: fixtures.map((f) => f.externalId) } }, select: { externalId: true, id: true } });
    const byExt = new Map(imported.map((m) => [m.externalId, m.id]));
    return { fixtures: fixtures.map((f) => ({ ...f, importedMatchId: byExt.get(f.externalId) || null })), usage: providerUsage() };
  } catch (err) {
    throw providerError(err);
  }
}

function providerUsage() {
  return { ...cricketData.usage, hitsLeft: cricketData.hitsLeft(), reserve: cricketData.RESERVE_HITS, fantasyCallCost: cricketData.FANTASY_COST };
}

/** Creates a match from a provider fixture (details supplied by the admin's fixture list) and tries to load its squad. */
async function importFixture(f) {
  const externalId = String(f?.externalId || '');
  if (!externalId) throw new FantasyError('INVALID', 'Missing fixture id.');
  const existing = await prisma.fantasyMatch.findFirst({ where: { externalId } });
  if (existing) throw new FantasyError('ALREADY_IMPORTED', 'This fixture is already imported.', 409);
  const [a, b] = Array.isArray(f.teamInfo) && f.teamInfo.length === 2 ? f.teamInfo : (f.teams || []).map((name) => ({ name, shortname: name }));
  if (!a || !b) throw new FantasyError('INVALID', 'The fixture has no teams yet.');
  const match = await adminCreateMatch({
    title: `${a.name} vs ${b.name}`,
    teamA: a.name, teamB: b.name, teamAShort: a.shortname || a.name, teamBShort: b.shortname || b.name,
    venue: f.venue, startsAt: f.startsAt
  });
  await prisma.fantasyMatch.update({ where: { id: match.id }, data: { externalId } });
  let squad = { added: 0, note: 'Squad not published yet; use "Fetch squad" later.' };
  if (f.hasSquad) {
    try { squad = await fetchSquadFor(match.id); } catch (err) { squad = { added: 0, note: providerError(err).message }; }
  }
  return { matchId: match.id, squad };
}

/** Loads the squad from the provider. Existing players (by provider id) are kept, new ones added. */
async function fetchSquadFor(matchId) {
  const m = await prisma.fantasyMatch.findUnique({ where: { id: String(matchId) }, include: { players: true } });
  if (!m || !m.externalId) throw new FantasyError('NOT_FOUND', 'This match was not imported from the provider.', 404);
  let data;
  try { data = await cricketData.fetchSquad(m.externalId); } catch (err) { throw providerError(err); }
  const mapped = cricketData.mapSquad(data, m.teamA);
  const have = new Set(m.players.map((p) => p.externalId).filter(Boolean));
  const fresh = mapped.filter((p) => !have.has(p.externalId));
  if (fresh.length) await prisma.fantasyPlayer.createMany({ data: fresh.map((p) => ({ ...p, matchId: m.id })) });
  return { added: fresh.length, total: m.players.length + fresh.length, note: mapped.length ? 'Default credits set by role; adjust before the deadline.' : 'The provider returned no players yet.' };
}

/** Pulls the scorecard and recomputes points. Only provider fields are replaced; admin corrections to other fields stay. */
async function syncScorecard(matchId) {
  const m = await prisma.fantasyMatch.findUnique({ where: { id: String(matchId) }, include: { players: true } });
  if (!m || !m.externalId) throw new FantasyError('NOT_FOUND', 'This match was not imported from the provider.', 404);
  let data;
  try { data = await cricketData.fetchScorecard(m.externalId); } catch (err) { throw providerError(err); }
  const stats = cricketData.mapScorecard(data);
  let updated = 0;
  for (const p of m.players) {
    const s = p.externalId ? stats.get(p.externalId) : null;
    if (!s) continue;
    const merged = { ...(p.stats || {}) };
    for (const k of PROVIDER_STAT_FIELDS) if (s[k] !== undefined) merged[k] = s[k];
    await prisma.fantasyPlayer.update({ where: { id: p.id }, data: { stats: merged, inLineup: p.inLineup || !!s.played } });
    updated += 1;
  }
  const ended = !!data?.matchEnded;
  await prisma.fantasyMatch.update({ where: { id: m.id }, data: { lastSyncAt: new Date(), ...(ended && m.status === 'LIVE' ? { status: 'COMPLETED' } : {}) } });
  const r = await recompute(m.id);
  return { updated, ended, ...r };
}

/**
 * Runs every minute: locks matches whose start time has passed (UPCOMING -> LIVE) and keeps live
 * imported matches in sync every SYNC_EVERY_MS, within the API budget.
 */
async function autoTick(now = new Date()) {
  const locked = await prisma.fantasyMatch.updateMany({ where: { status: 'UPCOMING', startsAt: { lte: now } }, data: { status: 'LIVE' } });
  const live = await prisma.fantasyMatch.findMany({
    where: { status: 'LIVE', externalId: { not: null }, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(now.getTime() - SYNC_EVERY_MS) } }] },
    orderBy: { lastSyncAt: 'asc' },
    take: 3
  });
  let synced = 0;
  for (const m of live) {
    if (!cricketData.canAfford(cricketData.FANTASY_COST) || !process.env.CRICKETDATA_API_KEY) break;
    try { await syncScorecard(m.id); synced += 1; } catch (err) { console.warn('[Fantasy] auto sync skipped:', err.message); }
  }
  return { locked: locked.count, synced };
}

/** Admin edit of a player's credits or role before the deadline (the provider does not supply credits). */
async function adminUpdatePlayer(playerId, body) {
  const p = await prisma.fantasyPlayer.findUnique({ where: { id: String(playerId) }, include: { match: true } });
  if (!p) throw new FantasyError('NOT_FOUND', 'Player not found.', 404);
  if (!isOpen(p.match)) throw new FantasyError('DEADLINE_PASSED', 'Credits cannot change after the deadline.', 409);
  const data = {};
  if (body.credits !== undefined) {
    const c = Math.round(Number(body.credits) * 2) / 2;
    if (!(c >= 5 && c <= 12)) throw new FantasyError('INVALID', 'Credits must be between 5 and 12.');
    data.credits = c;
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) throw new FantasyError('INVALID', 'Unknown role.');
    data.role = body.role;
  }
  return prisma.fantasyPlayer.update({ where: { id: p.id }, data });
}

async function adminPlayerBreakdown(matchId) {
  const players = await prisma.fantasyPlayer.findMany({ where: { matchId: String(matchId) }, orderBy: [{ team: 'asc' }, { name: 'asc' }] });
  return players.map((p) => ({ ...p, breakdown: F.playerPoints(p.role, { ...(p.stats || {}), inLineup: p.inLineup }).breakdown }));
}

module.exports = {
  FantasyError,
  listMatches,
  getMatch,
  createTeam,
  updateTeam,
  myTeams,
  joinContest,
  leaderboard,
  adminCreateMatch,
  adminAddPlayers,
  adminSetStatus,
  adminSetLineup,
  adminCreateContest,
  adminScorecard,
  adminPlayerBreakdown,
  adminUpdatePlayer,
  recompute,
  providerFixtures,
  providerUsage,
  importFixture,
  fetchSquadFor,
  syncScorecard,
  autoTick
};
