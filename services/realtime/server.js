require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config();
require('./src/utils/logger'); // Apply global log redaction
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./src/middleware/auth');

const { connectRedis } = require('./src/config/redisClient');
const { initSockets } = require('./src/sockets/index');
const CoreSocketManager = require('./src/sockets/CoreSocketManager');
const AviatorEngine = require('./src/services/aviatorEngine');
const ColourEngine = require('./src/services/colourEngine');
const { LottoEngine } = require('./src/services/lottoEngine');
const { TeenPattiRoom } = require('./src/services/teenPattiRoom');
const { DiceEngine } = require('./src/services/diceEngine');
const { DragonTigerEngine } = require('./src/services/tableGames/DragonTigerEngine');
const { RouletteEngine } = require('./src/services/tableGames/RouletteEngine');
const { AndarBaharEngine } = require('./src/services/tableGames/AndarBaharEngine');
const { RummyRoom } = require('./src/services/rummy/RummyRoom');
const LiveRouletteEngine = require('./src/services/live/LiveRouletteEngine');
const walletService = require('./src/services/walletService');
const catalogRouter = require('./src/api/catalog');
const authRouter = require('./src/api/auth');
const ledgerRouter = require('./src/api/ledger');
const wagerRouter = require('./src/api/wager');
const sportsAdminRouter = require('./src/api/sportsAdmin');
const fairnessRouter = require('./src/api/fairness');
const adminRouter = require('./src/api/admin');
const adminGamesRouter = require('./src/api/adminGames');
const adminGameConfigService = require('./src/services/adminGameConfigService');
const complianceRouter = require('./src/api/compliance');
const paymentsRouter = require('./src/api/payments');
const bonusRouter = require('./src/api/bonus');
const notificationsRouter = require('./src/api/notifications');

const app = express();
const server = http.createServer(app);

// High-speed WebSocket server setup with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict to frontend PWA domain
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Security Middlewares
app.use(helmet()); // Sets HSTS, X-Frame-Options, X-Content-Type-Options, etc.
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Restrict in production
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-admin-user-id', 'x-mfa-token']
}));
app.use(express.json({ limit: '10kb' })); // Output encoding / Body limit to prevent payload DoS

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window`
  message: { success: false, message: 'Too many requests from this IP, please try again after a minute' }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10, // 10 req/min for sensitive actions (payments)
  message: { success: false, message: 'Rate limit exceeded for sensitive action' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // 100 req/min for auth operations
  message: { success: false, message: 'Too many auth requests, please try again in a moment' }
});

app.use('/api/', apiLimiter);

// Basic REST API for Wallet Actions (Deprecated/Internal)
app.post('/api/wallet/deduct', requireAuth, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    // IDOR protection: enforce that token user matches requested user
    if (req.user.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'IDOR attempt blocked: Cannot modify another user.' });
    }
    const newBalance = await walletService.deductBalance(userId, amount);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// APIs
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/ledger', requireAuth, ledgerRouter);
app.use('/api/wager', requireAuth, wagerRouter);
app.use('/api/sports/admin', requireAuth, sportsAdminRouter);
app.use('/api/fairness', fairnessRouter);
app.use('/api/admin/games', requireAuth, adminGamesRouter);
app.use('/api/admin', requireAuth, adminRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/payments', strictLimiter, paymentsRouter); // Intentionally allowing public mock webhook for demo, but rate-limited
app.use('/api/bonus', requireAuth, bonusRouter);
app.use('/api/notifications', notificationsRouter);

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // 0. Initialize Admin Game Config Service
    await adminGameConfigService.initialize();

    // 1. Connect to Redis (High-speed cache)
    await connectRedis();
    
    // 2. Start Express / Socket server
    server.listen(PORT, () => {
      console.log(`🚀 WinDaq Engine running on port ${PORT}`);
      // 3. Initialize Core Socket Manager
      const coreManager = new CoreSocketManager(io);

      // Start Game Engines
      console.log('✈️ Starting Aviator Engine loop...');
      const aviatorEngine = new AviatorEngine(io);
      aviatorEngine.startLoop();

      console.log('🎨 Starting Colour Engines...');
      const colourEngine1m = new ColourEngine(io, '1min', 60000);
      colourEngine1m.startLoop();
      const colourEngine3m = new ColourEngine(io, '3min', 180000);
      colourEngine3m.startLoop();

      console.log('🎱 Starting Lotto Engines...');
      const lottoEngine = new LottoEngine('5min', io);
      lottoEngine.start();

      console.log('🃏 Starting Teen Patti Room...');
      const tpRoom = new TeenPattiRoom('Classic-10', io);

      console.log('🎲 Starting Dice Engine...');
      const diceEngine = new DiceEngine('1min', io);
      diceEngine.start();

      console.log('🐉 Starting Dragon Tiger Engine...');
      const dragontigerEngine = new DragonTigerEngine('Standard', coreManager);
      dragontigerEngine.start();

      console.log('🎡 Starting Roulette Engine...');
      const rouletteEngine = new RouletteEngine('Auto', coreManager);
      rouletteEngine.start();

      console.log('🃏 Starting Andar Bahar Engine...');
      const andarBaharEngine = new AndarBaharEngine('Auto', coreManager);
      andarBaharEngine.start();

      console.log('🎴 Starting Rummy Room...');
      const rummyRoom = new RummyRoom('Points-10', io);

      console.log('🔴 Starting Live Roulette Engine...');
      const liveRouletteEngine = new LiveRouletteEngine(io);
      liveRouletteEngine.startAutomatedDealer('live-roulette-1');

      // Init Sockets
      initSockets(coreManager, io, { aviatorEngine, colourEngine1m, lottoEngine, tpRoom, diceEngine, dragontigerEngine, rouletteEngine, andarbaharEngine: andarBaharEngine, rummyRoom, liveRouletteEngine });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
