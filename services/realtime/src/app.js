/**
 * Express application factory: middleware + REST routes, without starting listeners or game
 * engines. Used by server.js and by the integration tests so routes are tested exactly as mounted.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./middleware/auth');
const catalogRouter = require('./api/catalog');
const authRouter = require('./api/auth');
const ledgerRouter = require('./api/ledger');
const wagerRouter = require('./api/wager');
const sportsAdminRouter = require('./api/sportsAdmin');
const fairnessRouter = require('./api/fairness');
const adminRouter = require('./api/admin');
const adminGamesRouter = require('./api/adminGames');
const complianceRouter = require('./api/compliance');
const paymentsRouter = require('./api/payments');
const bonusRouter = require('./api/bonus');
const notificationsRouter = require('./api/notifications');
const historyRouter = require('./api/history');
const adminRealtimeRouter = require('./api/adminRealtime');
const adminTablesRouter = require('./api/adminTables');
const resultHistoryRouter = require('./api/resultHistoryApi');
const reconciliationRouter = require('./api/reconciliationApi');

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Rate limits apply everywhere except automated tests. The loopback exemption is for local
 * development only: in production a reverse proxy makes every request look like loopback unless
 * TRUST_PROXY is configured, so exempting it there would disable rate limiting entirely.
 */
function skipRateLimit(req) {
  if (process.env.NODE_ENV === 'test') return true;
  return process.env.NODE_ENV !== 'production' && LOOPBACK_IPS.has(req.ip);
}

function createApp() {
  const app = express();

  // Number of trusted reverse-proxy hops in front of this service (e.g. 1 behind a load balancer),
  // so req.ip is the real client address for rate limiting and audit logs.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
  }

  // Security Middlewares
  app.use(helmet()); // Sets HSTS, X-Frame-Options, X-Content-Type-Options, etc.
  app.use(cors({
    origin: require('./config/security').getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-admin-user-id', 'x-mfa-token']
  }));
  app.use(express.json({ limit: '10kb' })); // Output encoding / Body limit to prevent payload DoS

  // Rate Limiting
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Limit each IP to 1000 requests per `window`
    skip: skipRateLimit,
    message: { success: false, message: 'Too many requests from this IP, please try again after a minute' }
  });

  const strictLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 100, // sensitive actions
    skip: skipRateLimit,
    message: { success: false, message: 'Rate limit exceeded for sensitive action' }
  });

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500, // auth operations
    skip: skipRateLimit,
    message: { success: false, message: 'Too many auth requests, please try again in a moment' }
  });

  app.use('/api/', apiLimiter);

  // APIs
  // OTP delivery costs money and login attempts guess codes: tighter per-IP limits.
  const otpSendLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    skip: skipRateLimit,
    message: { success: false, code: 'RATE_LIMITED', message: 'Too many verification codes requested. Please try again later.' }
  });
  const otpVerifyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    skip: skipRateLimit,
    message: { success: false, code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' }
  });
  app.use('/api/auth/send-otp', otpSendLimiter);
  app.use(['/api/auth/login', '/api/auth/register'], otpVerifyLimiter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/ledger', requireAuth, ledgerRouter);
  app.use('/api/wager', requireAuth, wagerRouter);
  app.use('/api/sports/admin', requireAuth, sportsAdminRouter);
  app.use('/api/fairness', fairnessRouter);
  app.use('/api', resultHistoryRouter);
  app.use('/api/admin', requireAuth, reconciliationRouter);
  app.use('/api/admin/games', requireAuth, adminGamesRouter);
  app.use('/api/admin', requireAuth, adminRouter);
  app.use('/api/compliance', complianceRouter);
  app.use('/api/payments', strictLimiter, paymentsRouter); // Intentionally allowing public mock webhook for demo, but rate-limited
  app.use('/api/bonus', requireAuth, bonusRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/fantasy', require('./api/fantasy'));
  app.use('/api/admin/realtime', requireAuth, adminRealtimeRouter);
  app.use('/api/admin/tables', requireAuth, adminTablesRouter);

  return app;
}

module.exports = { createApp };
