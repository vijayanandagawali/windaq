require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config();
require('./src/utils/logger'); // Apply global log redaction
const http = require('http');
const { Server } = require('socket.io');
const { createApp } = require('./src/app');
const { assertSecurityConfig } = require('./src/config/security');

// A single failed async operation (e.g. a malformed client event) must not terminate the
// process and every in-flight game round with it. Log and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

// Fail fast on missing/weak secrets before anything else starts.
assertSecurityConfig();

// Outside production the game engines write rounds/bets continuously, so a dev server must not
// run against a shared or remote database unless that is explicitly confirmed.
if (process.env.NODE_ENV !== 'production') {
  require('./src/config/dbSafety').guardDatabaseOrExit('realtime server (non-production)');
}

const { connectRedis } = require('./src/config/redisClient');
const { initSockets } = require('./src/sockets/index');
const CoreSocketManager = require('./src/sockets/CoreSocketManager');
const AviatorEngine = require('./src/services/aviatorEngine');
const ColourEngine = require('./src/services/colourEngine');
const { LottoEngine } = require('./src/services/lottoEngine');
const { DiceEngine } = require('./src/services/diceEngine');
const { DragonTigerEngine } = require('./src/services/tableGames/DragonTigerEngine');
const { RouletteEngine } = require('./src/services/tableGames/RouletteEngine');
const { AndarBaharEngine } = require('./src/services/tableGames/AndarBaharEngine');
const walletService = require('./src/services/walletService');
const adminGameConfigService = require('./src/services/adminGameConfigService');
const { tableManager } = require('./src/services/tableGames/VirtualTableManager');
const RoundRegistry = require('./src/services/engine/RoundRegistry');

const app = createApp();
const server = http.createServer(app);

// High-speed WebSocket server setup with CORS
const io = new Server(server, {
  cors: {
    origin: require('./src/config/security').getAllowedOrigins(),
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Bind io to wallet service for authoritative realtime balance propagation
walletService.setIo(io);

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // 0. Initialize Admin Game Config Service
    await adminGameConfigService.initialize();

    // 1. Connect to Redis (High-speed cache)
    await connectRedis();

    // 1.5. Server restart recovery: safely resolve interrupted rounds
    await RoundRegistry.recoverInterruptedRounds();
    
    // 2. Start Express / Socket server
    server.listen(PORT, () => {
      console.log(`🚀 WinDaq Engine running on port ${PORT}`);
      // 3. Initialize Core Socket Manager
      const coreManager = new CoreSocketManager(io);

      // Unique-amount deposits nobody paid: free the amount and the pending balance.
      const { PrismaClient } = require('@prisma/client');
      const paymentsPrisma = new PrismaClient();
      const { expireStaleDeposits } = require('./src/services/manualPaymentService');
      setInterval(() => {
        expireStaleDeposits(paymentsPrisma).catch((err) => console.error('[Deposits] expiry sweep failed:', err.message));
      }, 5 * 60 * 1000).unref();

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

      // Register all engines with Central Round Registry
      RoundRegistry.register(aviatorEngine);
      RoundRegistry.register(colourEngine1m);
      RoundRegistry.register(colourEngine3m);
      RoundRegistry.register(lottoEngine);
      RoundRegistry.register(diceEngine);
      RoundRegistry.register(dragontigerEngine);
      RoundRegistry.register(rouletteEngine);
      RoundRegistry.register(andarBaharEngine);

      // Initialize Multi-Table Virtual Dealer Manager
      tableManager.setIO(io);
      tableManager.bindEngine('table-01', rouletteEngine);
      tableManager.bindEngine('table-02', dragontigerEngine);
      tableManager.bindEngine('table-03', andarBaharEngine);

      // Periodically broadcast authoritative aggregates to Admin Realtime Control Center
      setInterval(() => {
        if (io) {
          const overview = RoundRegistry.getRealtimeOverview();
          io.to('admin:realtime').emit('admin:realtime_update', overview);
          const tablesOverview = tableManager.getLiveAdminOverview();
          io.to('admin:realtime').emit('admin:tables_overview', tablesOverview);
        }
      }, 1000);

      // Init Sockets
      initSockets(coreManager, io, { aviatorEngine, colourEngine1m, colourEngines: { '1min': colourEngine1m, '3min': colourEngine3m }, lottoEngine, diceEngine, dragontigerEngine, rouletteEngine, andarbaharEngine: andarBaharEngine });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
