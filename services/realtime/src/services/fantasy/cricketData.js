/**
 * CricketData.org (CricAPI v1) client and mappers for fantasy cricket.
 *
 * Cost awareness: on the free plan fixtures endpoints cost 1 hit and fantasy endpoints
 * (match_squad, match_scorecard) cost 10. Every response reports info.hitsToday / hitsLimit; we keep
 * the last numbers and refuse optional calls when fewer than RESERVE_HITS remain, so scheduled syncs
 * can never exhaust the key. The key comes from CRICKETDATA_API_KEY and is never logged.
 *
 * The mappers are defensive: unknown or missing fields map to nothing rather than throwing, and an
 * admin can always correct stats by hand afterwards.
 */
const BASE = 'https://api.cricapi.com/v1';
const RESERVE_HITS = 10;
const FANTASY_COST = 10;

const usage = { hitsToday: null, hitsLimit: null, at: null };

class ProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function apiKey() {
  const key = (process.env.CRICKETDATA_API_KEY || '').trim();
  if (!key) throw new ProviderError('NOT_CONFIGURED', 'The cricket data key is not configured.');
  return key;
}

function hitsLeft() {
  if (usage.hitsToday === null || usage.hitsLimit === null) return null;
  return usage.hitsLimit - usage.hitsToday;
}

function canAfford(cost) {
  const left = hitsLeft();
  return left === null || left - cost >= RESERVE_HITS;
}

async function call(path, params = {}, { cost = 1, fetchImpl = fetch } = {}) {
  if (!canAfford(cost)) throw new ProviderError('BUDGET', `Daily API limit nearly reached (${hitsLeft()} hits left). Try again tomorrow or upgrade the plan.`);
  const qs = new URLSearchParams({ ...params, apikey: apiKey() });
  const res = await fetchImpl(`${BASE}/${path}?${qs}`, { signal: AbortSignal.timeout(15000) });
  const json = await res.json().catch(() => ({}));
  if (json.info) {
    usage.hitsToday = Number(json.info.hitsToday ?? usage.hitsToday);
    usage.hitsLimit = Number(json.info.hitsLimit ?? usage.hitsLimit);
    usage.at = new Date().toISOString();
  }
  if (json.status !== 'success') throw new ProviderError('PROVIDER', String(json.reason || 'The cricket data provider returned an error.').slice(0, 200));
  return json.data;
}

// ------------------------------------------------------------------ mappers (pure)

/** Provider role text -> our role. */
function mapRole(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('wk') || r.includes('keeper')) return 'WK';
  if (r.includes('allrounder') || r.includes('all-rounder') || r.includes('all rounder')) return 'AR';
  if (r.includes('bowl')) return 'BOWL';
  if (r.includes('bat')) return 'BAT';
  return null;
}

/** Default credits by role; admins adjust before publishing (the provider does not supply credits). */
const DEFAULT_CREDITS = { WK: 8.5, BAT: 8.5, AR: 8.5, BOWL: 8 };

/** match_squad data -> [{ externalId, name, team: 'A'|'B', role, credits }] for the match's two teams. */
function mapSquad(squadData, teamAName) {
  const teams = Array.isArray(squadData) ? squadData : [];
  const out = [];
  teams.forEach((t, i) => {
    const side = teamAName ? (String(t.teamName || '').toLowerCase() === String(teamAName).toLowerCase() ? 'A' : 'B') : i === 0 ? 'A' : 'B';
    for (const p of Array.isArray(t.players) ? t.players : []) {
      const role = mapRole(p.role);
      if (!p.id || !p.name || !role) continue;
      out.push({ externalId: String(p.id), name: String(p.name).slice(0, 60), team: side, role, credits: DEFAULT_CREDITS[role] });
    }
  });
  return out;
}

const idOf = (x) => (x && typeof x === 'object' ? x.id : null);
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * match_scorecard data -> Map(externalPlayerId -> stats) in our stats shape.
 * Batting: r, b, 4s, 6s, dismissal. Bowling: o, m, r, w. Fielding from `catching` entries
 * (catch, stumped, runout) and bowled/LBW credits from batting dismissals.
 */
function mapScorecard(scorecardData) {
  const innings = Array.isArray(scorecardData?.scorecard) ? scorecardData.scorecard : [];
  const stats = new Map();
  const get = (id) => {
    if (!stats.has(id)) stats.set(id, { played: true });
    return stats.get(id);
  };
  for (const inn of innings) {
    for (const bat of Array.isArray(inn.batting) ? inn.batting : []) {
      const id = idOf(bat.batsman);
      if (!id) continue;
      const s = get(id);
      s.runs = n(s.runs) + n(bat.r);
      s.balls = n(s.balls) + n(bat.b);
      s.fours = n(s.fours) + n(bat['4s']);
      s.sixes = n(s.sixes) + n(bat['6s']);
      const text = String(bat['dismissal-text'] || bat.dismissal || '').toLowerCase();
      if (text && !text.includes('not out') && !text.includes('batting') && !text.includes('retired hurt')) s.dismissed = true;
      const how = String(bat.dismissal || '').toLowerCase();
      const bowlerId = idOf(bat.bowler);
      if (bowlerId && (how === 'bowled' || how === 'lbw' || text.startsWith('b ') || text.startsWith('lbw'))) {
        const b = get(bowlerId);
        b.bowledLbw = n(b.bowledLbw) + 1;
      }
    }
    for (const bowl of Array.isArray(inn.bowling) ? inn.bowling : []) {
      const id = idOf(bowl.bowler);
      if (!id) continue;
      const s = get(id);
      s.overs = addOvers(s.overs, bowl.o);
      s.maidens = n(s.maidens) + n(bowl.m);
      s.runsConceded = n(s.runsConceded) + n(bowl.r);
      s.wickets = n(s.wickets) + n(bowl.w);
    }
    for (const f of Array.isArray(inn.catching) ? inn.catching : []) {
      const id = idOf(f.catcher);
      if (!id) continue;
      const s = get(id);
      s.catches = n(s.catches) + n(f.catch);
      s.stumpings = n(s.stumpings) + n(f.stumped);
      // The feed does not say whether a run-out was a direct hit; count it at the lower value.
      s.runOutIndirect = n(s.runOutIndirect) + n(f.runout);
    }
  }
  return stats;
}

/** Adds two overs values in cricket notation (3.4 + 1.2 = 5.0). */
function addOvers(a, b) {
  const balls = (o) => { const x = n(o); const w = Math.floor(x); return w * 6 + Math.min(5, Math.round((x - w) * 10)); };
  const total = balls(a) + balls(b);
  return Math.floor(total / 6) + (total % 6) / 10;
}

/** Upcoming T20 fixtures from the next series (1 hit for the series list + 1 per series inspected). */
async function upcomingT20Fixtures({ maxSeries = 4, fetchImpl } = {}) {
  const series = await call('series', { offset: 0 }, { cost: 1, fetchImpl });
  const today = new Date().toISOString().slice(0, 10);
  const candidates = (series || []).filter((s) => Number(s.t20) > 0 && String(s.startDate || '') >= today.slice(0, 4)).slice(0, maxSeries);
  const fixtures = [];
  for (const s of candidates) {
    if (!canAfford(1)) break;
    const info = await call('series_info', { id: s.id }, { cost: 1, fetchImpl });
    for (const m of info?.matchList || []) {
      if (String(m.matchType).toLowerCase() !== 't20' || m.matchStarted) continue;
      if (new Date(m.dateTimeGMT + 'Z').getTime() <= Date.now()) continue;
      fixtures.push({
        externalId: m.id,
        name: m.name,
        series: s.name,
        startsAt: new Date(m.dateTimeGMT + 'Z').toISOString(),
        venue: m.venue || null,
        teams: m.teams || [],
        teamInfo: (m.teamInfo || []).map((t) => ({ name: t.name, shortname: t.shortname })),
        hasSquad: !!m.hasSquad,
        fantasyEnabled: !!m.fantasyEnabled
      });
    }
  }
  return fixtures.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

const fetchSquad = (id, opts) => call('match_squad', { id }, { cost: FANTASY_COST, ...opts });
const fetchScorecard = (id, opts) => call('match_scorecard', { id }, { cost: FANTASY_COST, ...opts });

module.exports = {
  ProviderError,
  RESERVE_HITS,
  FANTASY_COST,
  usage,
  hitsLeft,
  canAfford,
  mapRole,
  mapSquad,
  mapScorecard,
  addOvers,
  upcomingT20Fixtures,
  fetchSquad,
  fetchScorecard,
  DEFAULT_CREDITS
};
