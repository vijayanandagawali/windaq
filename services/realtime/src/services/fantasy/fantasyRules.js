/**
 * Fantasy cricket rules (T20), pure functions: team validation and the points system.
 *
 * Team: exactly 11 players from the two sides of one match, total credits <= 100, at most 7 from
 * one side, role counts WK 1-4, BAT 3-6, AR 1-4, BOWL 3-6; one captain (2x) and one different
 * vice-captain (1.5x), both in the team.
 *
 * Points (per player, from their scorecard line):
 *   Batting   run +1; four +4 bonus; six +6 bonus; 25 runs +4; 50 runs +8; 75 runs +12; 100 runs +16
 *             (milestone bonuses are cumulative: a century also earns the 25/50/75 bonuses);
 *             duck -2 (dismissed for 0, batters, wicket-keepers and all-rounders only).
 *   Bowling   wicket (not run out) +30; bowled/LBW bonus +8 each; 3 wickets +4; 4 wickets +8;
 *             5 wickets +12 (the highest haul only); maiden +12.
 *   Fielding  catch +8; 3+ catches +4 once; stumping +12; run out (direct hit) +12; run out +6.
 *   Other     in the announced lineup +4; playing as a substitute +4.
 *   Economy (min 2 overs): <5 +6; 5-5.99 +4; 6-7 +2; 10-11 -2; 11.01-12 -4; >12 -6.
 *   Strike rate (min 10 balls, not for bowlers): >170 +6; 150.01-170 +4; 130-150 +2;
 *             60-70 -2; 50-59.99 -4; <50 -6.
 */

const ROLE_LIMITS = { WK: [1, 4], BAT: [3, 6], AR: [1, 4], BOWL: [3, 6] };
const MAX_CREDITS = 100;
const MAX_FROM_ONE_SIDE = 7;
const TEAM_SIZE = 11;

/**
 * Validates a team against the match's players. Returns { ok: true } or { ok: false, reason }.
 * `players` is the match squad: [{ id, team: 'A'|'B', role, credits }].
 */
function validateTeam(players, { playerIds, captainId, viceCaptainId }) {
  if (!Array.isArray(playerIds) || playerIds.length !== TEAM_SIZE) return { ok: false, reason: 'Pick exactly 11 players.' };
  if (new Set(playerIds).size !== TEAM_SIZE) return { ok: false, reason: 'A player can be picked only once.' };
  const byId = new Map(players.map((p) => [p.id, p]));
  const picked = playerIds.map((id) => byId.get(id));
  if (picked.some((p) => !p)) return { ok: false, reason: 'Every player must be from this match.' };

  const credits = picked.reduce((s, p) => s + Number(p.credits), 0);
  if (credits > MAX_CREDITS + 1e-9) return { ok: false, reason: `Team uses ${credits} credits; the limit is ${MAX_CREDITS}.` };

  for (const side of ['A', 'B']) {
    const n = picked.filter((p) => p.team === side).length;
    if (n > MAX_FROM_ONE_SIDE) return { ok: false, reason: `At most ${MAX_FROM_ONE_SIDE} players from one team.` };
  }
  for (const [role, [min, max]] of Object.entries(ROLE_LIMITS)) {
    const n = picked.filter((p) => p.role === role).length;
    if (n < min || n > max) return { ok: false, reason: `Pick ${min}-${max} ${roleName(role)} (you have ${n}).` };
  }
  if (!playerIds.includes(captainId)) return { ok: false, reason: 'Choose a captain from your team.' };
  if (!playerIds.includes(viceCaptainId)) return { ok: false, reason: 'Choose a vice-captain from your team.' };
  if (captainId === viceCaptainId) return { ok: false, reason: 'Captain and vice-captain must be different players.' };
  return { ok: true, credits };
}

function roleName(role) {
  return { WK: 'wicket-keepers', BAT: 'batters', AR: 'all-rounders', BOWL: 'bowlers' }[role] || role;
}

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/** Converts cricket overs notation (e.g. 3.4 = 3 overs 4 balls) into balls. */
function oversToBalls(overs) {
  const o = num(overs);
  const whole = Math.floor(o);
  const balls = Math.round((o - whole) * 10);
  return whole * 6 + Math.min(balls, 5);
}

/**
 * Points for one player's scorecard line. Returns { total, breakdown: [{ label, points }] }.
 * stats: { inLineup, substitute, runs, balls, fours, sixes, dismissed, wickets, bowledLbw, overs,
 *          runsConceded, maidens, catches, stumpings, runOutDirect, runOutIndirect }
 */
function playerPoints(role, stats = {}) {
  const b = [];
  const add = (label, points) => { if (points) b.push({ label, points }); };

  if (stats.inLineup) add('In announced lineup', 4);
  if (stats.substitute) add('Played as substitute', 4);

  const runs = num(stats.runs);
  const balls = num(stats.balls);
  add('Runs', runs);
  add('Boundary bonus', num(stats.fours) * 4);
  add('Six bonus', num(stats.sixes) * 6);
  if (runs >= 25) add('25-run bonus', 4);
  if (runs >= 50) add('Half-century bonus', 8);
  if (runs >= 75) add('75-run bonus', 12);
  if (runs >= 100) add('Century bonus', 16);
  if (stats.dismissed && runs === 0 && role !== 'BOWL') add('Duck', -2);
  if (role !== 'BOWL' && balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr > 170) add('Strike rate > 170', 6);
    else if (sr > 150) add('Strike rate 150-170', 4);
    else if (sr >= 130) add('Strike rate 130-150', 2);
    else if (sr >= 60 && sr <= 70) add('Strike rate 60-70', -2);
    else if (sr >= 50 && sr < 60) add('Strike rate 50-60', -4);
    else if (sr < 50) add('Strike rate < 50', -6);
  }

  const wickets = num(stats.wickets);
  add('Wickets', wickets * 30);
  add('Bowled/LBW bonus', Math.min(num(stats.bowledLbw), wickets) * 8);
  if (wickets >= 5) add('5-wicket bonus', 12);
  else if (wickets === 4) add('4-wicket bonus', 8);
  else if (wickets === 3) add('3-wicket bonus', 4);
  add('Maidens', num(stats.maidens) * 12);
  const bowled = oversToBalls(stats.overs);
  if (bowled >= 12) {
    const eco = num(stats.runsConceded) / (bowled / 6);
    if (eco < 5) add('Economy < 5', 6);
    else if (eco < 6) add('Economy 5-6', 4);
    else if (eco <= 7) add('Economy 6-7', 2);
    else if (eco >= 10 && eco <= 11) add('Economy 10-11', -2);
    else if (eco > 11 && eco <= 12) add('Economy 11-12', -4);
    else if (eco > 12) add('Economy > 12', -6);
  }

  const catches = num(stats.catches);
  add('Catches', catches * 8);
  if (catches >= 3) add('3-catch bonus', 4);
  add('Stumpings', num(stats.stumpings) * 12);
  add('Run out (direct)', num(stats.runOutDirect) * 12);
  add('Run out', num(stats.runOutIndirect) * 6);

  return { total: b.reduce((s, x) => s + x.points, 0), breakdown: b };
}

/** Team total from each player's points, with captain 2x and vice-captain 1.5x. */
function teamPoints(team, pointsById) {
  let total = 0;
  for (const id of team.playerIds) {
    const p = Number(pointsById.get(id) || 0);
    total += id === team.captainId ? p * 2 : id === team.viceCaptainId ? p * 1.5 : p;
  }
  return Math.round(total * 10) / 10;
}

/** Dense-by-points ranking with ties sharing a rank: [{ id, points }] -> Map(id -> rank). */
function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const ranks = new Map();
  let rank = 0;
  let prev = null;
  sorted.forEach((e, i) => {
    if (prev === null || e.points !== prev) rank = i + 1;
    ranks.set(e.id, rank);
    prev = e.points;
  });
  return ranks;
}

module.exports = { ROLE_LIMITS, MAX_CREDITS, MAX_FROM_ONE_SIDE, TEAM_SIZE, validateTeam, playerPoints, teamPoints, rankEntries, oversToBalls };
