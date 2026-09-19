require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { connectRedis } = require('./src/config/redisClient');
const { initSockets } = require('./src/sockets/index');
const AviatorEngine = require('./src/services/aviatorEngine');
const walletService = require('./src/services/walletService');

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

// Middleware
app.use(cors());
app.use(express.json());

// Initialize WebSocket Engine
initSockets(io);

// Initialize Game Engines
const aviatorEngine = new AviatorEngine(io);

// Basic REST API for Wallet Actions
app.post('/api/wallet/deduct', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    const newBalance = await walletService.deductBalance(userId, amount);
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // 1. Connect to Redis (High-speed cache)
    await connectRedis();
    
    // 2. Start Express / Socket server
    server.listen(PORT, () => {
      console.log(`🚀 WinDaq Engine running on port ${PORT}`);
      
      // 3. Kick off continuous background game loops
      console.log(`✈️ Starting Aviator Engine loop...`);
      aviatorEngine.startLoop();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
