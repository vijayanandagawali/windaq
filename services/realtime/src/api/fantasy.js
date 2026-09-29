const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireRole, logAudit } = require('../middleware/AdminRBAC');
const fantasy = require('../services/fantasy/fantasyService');

const router = express.Router();
const ADMIN = ['SUPER_ADMIN', 'SUPPORT'];

const wrap = (fn) => async (req, res) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (err) {
    if (err instanceof fantasy.FantasyError) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    console.error('[Fantasy]', req.method, req.path, err.message);
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
  }
};
const player = (req) => {
  const id = req.user?.userId;
  if (!id || req.user?.isGuest || String(id).startsWith('sbx_guest_')) {
    throw new fantasy.FantasyError('SIGN_IN_REQUIRED', 'Sign in with your mobile number to create teams.', 401);
  }
  return id;
};

// Public
router.get('/matches', wrap(() => fantasy.listMatches()));
router.get('/matches/:id', wrap((req) => fantasy.getMatch(req.params.id)));

// Players
router.get('/matches/:id/my-teams', requireAuth, wrap((req) => fantasy.myTeams(player(req), req.params.id)));
router.post('/matches/:id/teams', requireAuth, wrap((req) => fantasy.createTeam(player(req), req.params.id, req.body || {})));
router.put('/teams/:id', requireAuth, wrap((req) => fantasy.updateTeam(player(req), req.params.id, req.body || {})));
router.post('/contests/:id/join', requireAuth, wrap((req) => fantasy.joinContest(player(req), req.params.id, req.body?.teamId)));
router.get('/contests/:id/leaderboard', requireAuth, wrap((req) => fantasy.leaderboard(req.params.id, req.user?.userId)));

// Admin: fixtures, squads, lineups, contests and scorecards (all audited)
const audited = (action, fn) => wrap(async (req) => {
  const out = await fn(req);
  await logAudit(req.admin.id, action, req.params.id || out?.id || null, { body: req.body }, req.ip).catch(() => {});
  return out;
});
router.post('/admin/matches', requireAuth, requireRole(ADMIN), audited('FANTASY_CREATE_MATCH', (req) => fantasy.adminCreateMatch(req.body || {})));
router.post('/admin/matches/:id/players', requireAuth, requireRole(ADMIN), audited('FANTASY_ADD_PLAYERS', (req) => fantasy.adminAddPlayers(req.params.id, req.body?.players)));
router.patch('/admin/matches/:id', requireAuth, requireRole(ADMIN), audited('FANTASY_SET_STATUS', (req) => fantasy.adminSetStatus(req.params.id, req.body?.status)));
router.post('/admin/matches/:id/lineup', requireAuth, requireRole(ADMIN), audited('FANTASY_SET_LINEUP', (req) => fantasy.adminSetLineup(req.params.id, req.body?.playerIds)));
router.post('/admin/matches/:id/contests', requireAuth, requireRole(ADMIN), audited('FANTASY_CREATE_CONTEST', (req) => fantasy.adminCreateContest(req.params.id, req.body || {})));
router.post('/admin/matches/:id/scorecard', requireAuth, requireRole(ADMIN), audited('FANTASY_SCORECARD', (req) => fantasy.adminScorecard(req.params.id, req.body?.lines)));
router.get('/admin/provider/fixtures', requireAuth, requireRole(ADMIN), wrap(() => fantasy.providerFixtures()));
router.get('/admin/provider/usage', requireAuth, requireRole(ADMIN), wrap(() => fantasy.providerUsage()));
router.post('/admin/provider/import', requireAuth, requireRole(ADMIN), audited('FANTASY_IMPORT_FIXTURE', (req) => fantasy.importFixture(req.body || {})));
router.post('/admin/matches/:id/fetch-squad', requireAuth, requireRole(ADMIN), audited('FANTASY_FETCH_SQUAD', (req) => fantasy.fetchSquadFor(req.params.id)));
router.post('/admin/matches/:id/sync-scorecard', requireAuth, requireRole(ADMIN), audited('FANTASY_SYNC_SCORECARD', (req) => fantasy.syncScorecard(req.params.id)));
router.patch('/admin/players/:id', requireAuth, requireRole(ADMIN), audited('FANTASY_UPDATE_PLAYER', (req) => fantasy.adminUpdatePlayer(req.params.id, req.body || {})));
router.get('/admin/matches/:id/points', requireAuth, requireRole(ADMIN), wrap((req) => fantasy.adminPlayerBreakdown(req.params.id)));

module.exports = router;
