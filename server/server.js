if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch (e) {}
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const wallet = require('./walletManager');
const gameEngine = require('./gameEngine');
const paymentService = require('./services/paymentService');
const cricketService = require('./services/cricketService');
const provablyFair = require('./services/provablyFair');
const smsService = require('./services/smsService');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Active WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  // Send initial snapshot
  ws.send(JSON.stringify({
    type: 'INIT_SNAPSHOT',
    aviator: {
      status: gameEngine.aviatorState.status,
      multiplier: gameEngine.aviatorState.multiplier,
      history: gameEngine.aviatorState.history,
      roundId: gameEngine.aviatorState.roundId
    },
    wingo: {
      periodId: gameEngine.wingoState.periodId,
      timeLeft: gameEngine.wingoState.timeLeft,
      history: gameEngine.wingoState.history
    },
    dvt: {
      roundId: gameEngine.dvtState.roundId,
      timeLeft: gameEngine.dvtState.timeLeft,
      history: gameEngine.dvtState.history,
      cards: gameEngine.dvtState.cards,
      lastWinner: gameEngine.dvtState.lastWinner
    },
    cricket: gameEngine.cricketMatches
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWsMessage(ws, data);
    } catch (e) {
      console.error('WS parse error:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// 100ms broadcast loop for high-speed games (Aviator, Wingo, Dragon Tiger)
setInterval(() => {
  broadcast({
    type: 'TICK',
    aviator: {
      status: gameEngine.aviatorState.status,
      multiplier: gameEngine.aviatorState.multiplier,
      roundId: gameEngine.aviatorState.roundId,
      countdown: gameEngine.aviatorState.waitCountdown || 0
    },
    wingo: {
      periodId: gameEngine.wingoState.periodId,
      timeLeft: gameEngine.wingoState.timeLeft
    },
    dvt: {
      roundId: gameEngine.dvtState.roundId,
      timeLeft: gameEngine.dvtState.timeLeft,
      cards: gameEngine.dvtState.cards,
      lastWinner: gameEngine.dvtState.lastWinner
    }
  });
}, 100);

function handleWsMessage(ws, data) {
  const { type, phone, amount, payload } = data;

  if (type === 'AVIATOR_BET') {
    try {
      if (gameEngine.aviatorState.status !== 'WAITING') {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Bets closed for current round!' }));
      }
      const deduct = wallet.deductBet(phone, amount, 'Aviator');
      gameEngine.aviatorState.bets.set(phone, { amount, cashedOut: false });
      ws.send(JSON.stringify({
        type: 'BET_PLACED',
        game: 'aviator',
        amount,
        balance: deduct.newBalance
      }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  } else if (type === 'AVIATOR_CASHOUT') {
    try {
      if (gameEngine.aviatorState.status !== 'FLYING') {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Cannot cashout now!' }));
      }
      const bet = gameEngine.aviatorState.bets.get(phone);
      if (!bet || bet.cashedOut) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'No active bet or already cashed out' }));
      }
      bet.cashedOut = true;
      const mult = gameEngine.aviatorState.multiplier;
      const winAmount = parseFloat((bet.amount * mult).toFixed(2));
      const credit = wallet.creditWin(phone, winAmount, 'Aviator', mult);

      ws.send(JSON.stringify({
        type: 'CASHOUT_SUCCESS',
        game: 'aviator',
        winAmount,
        multiplier: mult,
        balance: credit.newBalance
      }));

      // Broadcast live winner to ticker
      broadcast({
        type: 'LIVE_WINNER',
        phone: phone.substring(0, 4) + '***' + phone.slice(-2),
        game: 'Aviator',
        amount: winAmount,
        multiplier: mult
      });
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  }
}

/* ================== REST APIs ================== */

// --- AUTH APIS ---
app.post('/api/v1/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, error: 'Valid 10-digit mobile number required' });
    }
    const result = await smsService.sendOTP(phone);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/auth/verify-otp', (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP required' });
    }
    const verify = smsService.verifyOTP(phone, otp);
    if (!verify.success) {
      return res.status(400).json({ success: false, error: verify.error });
    }
    const user = wallet.getOrCreateUser(phone, name);
    return res.json({
      success: true,
      user,
      totalBalance: wallet.getTotalBalance(phone)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/auth/me', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  const user = wallet.getUser(phone);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  return res.json({
    success: true,
    user,
    totalBalance: wallet.getTotalBalance(phone)
  });
});

// --- WALLET APIS ---
app.get('/api/v1/wallet/balance', (req, res) => {
  const phone = req.query.phone;
  const user = wallet.getUser(phone);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  return res.json({
    success: true,
    totalBalance: wallet.getTotalBalance(phone),
    depositBalance: user.depositBalance,
    winningBalance: user.winningBalance
  });
});

app.post('/api/v1/wallet/deposit', (req, res) => {
  try {
    const { phone, amount, utr, upiApp } = req.body;
    const result = paymentService.submitUTR(phone, amount, utr, upiApp);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/wallet/withdraw', (req, res) => {
  try {
    const { phone, amount, paymentMethod, details } = req.body;
    const result = paymentService.requestWithdrawal(phone, amount, paymentMethod, details);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- REAL-MONEY BANKING & UPI APIS ---
app.post('/api/v1/payments/deposit-intent', (req, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ success: false, error: 'Phone and amount required' });
    const intent = paymentService.createDepositIntent(phone, amount);
    return res.json(intent);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/payments/create-link', async (req, res) => {
  try {
    const { phone, amount, customerName } = req.body;
    if (!phone || !amount) return res.status(400).json({ success: false, error: 'Phone and amount required' });
    const linkResult = await paymentService.createPaymentGatewayLink(phone, amount, customerName);
    return res.json(linkResult);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/payments/submit-utr', (req, res) => {
  try {
    const { phone, amount, utr, upiApp, screenshot } = req.body;
    if (!phone || !amount || !utr) {
      return res.status(400).json({ success: false, error: 'Phone, amount, and 12-digit UTR required' });
    }
    const result = paymentService.submitUTR(phone, amount, utr, upiApp, screenshot);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/payments/webhook', (req, res) => {
  const result = paymentService.handleGatewayWebhook(req.headers['x-webhook-event'], req.body, req.headers['x-signature']);
  return res.json(result);
});

app.post('/api/v1/payments/withdraw-request', (req, res) => {
  try {
    const { phone, amount, paymentMethod, details } = req.body;
    if (!phone || !amount) return res.status(400).json({ success: false, error: 'Phone and amount required' });
    const result = paymentService.requestWithdrawal(phone, amount, paymentMethod || 'UPI', details);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Banking Management
app.get('/api/v1/admin/banking/deposits', (req, res) => {
  return res.json({
    success: true,
    pending: paymentService.getPendingDeposits(),
    all: wallet.db.getAllDeposits()
  });
});

app.post('/api/v1/admin/banking/approve-deposit', (req, res) => {
  try {
    const { requestId, adminNotes } = req.body;
    const result = paymentService.approveDeposit(requestId, adminNotes);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/admin/banking/reject-deposit', (req, res) => {
  try {
    const { requestId, reason } = req.body;
    const result = paymentService.rejectDeposit(requestId, reason);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/admin/banking/withdrawals', (req, res) => {
  return res.json({
    success: true,
    pending: paymentService.getPendingWithdrawals(),
    all: wallet.db.getAllWithdrawals()
  });
});

app.post('/api/v1/admin/banking/process-withdrawal', (req, res) => {
  try {
    const { requestId, adminNotes } = req.body;
    const result = paymentService.processWithdrawal(requestId, adminNotes);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/admin/banking/reject-withdrawal', (req, res) => {
  try {
    const { requestId, reason } = req.body;
    const result = paymentService.rejectWithdrawal(requestId, reason);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Real-Money Sportsbook APIs
app.get('/api/v1/sports/live-matches', async (req, res) => {
  const matches = await cricketService.getLiveMatches();
  return res.json({ success: true, matches });
});

app.post('/api/v1/sports/place-bet', (req, res) => {
  try {
    const { phone, matchId, market, selection, type, odds, stake } = req.body;
    const result = cricketService.placeBet(phone, matchId, market, selection, type, odds, stake);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Settings & Config
app.get('/api/v1/admin/settings', (req, res) => {
  return res.json({ success: true, settings: wallet.db.getSystemSettings() });
});

app.post('/api/v1/admin/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    wallet.db.updateSystemSetting(key, value);
    if (key === 'merchant_upi_id') paymentService.merchantUpiId = value;
    if (key === 'merchant_name') paymentService.merchantName = value;
    return res.json({ success: true, message: `Updated ${key}` });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Health & Readiness Endpoints (for Oracle Cloud / Docker / Vercel monitoring)
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'WinDaq Gaming Engine (विन डैक)',
    domain: 'daqwon.in',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/ready', (req, res) => {
  res.json({
    status: 'ready',
    database: 'connected',
    gameEngine: 'active',
    timestamp: new Date().toISOString()
  });
});

// KYC User Endpoints
app.get('/api/v1/user/kyc', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  const user = wallet.getUser(phone);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const kyc = wallet.db.getKyc(user.id);
  res.json({ success: true, kyc: kyc || { status: 'UNVERIFIED' } });
});

app.post('/api/v1/user/kyc', (req, res) => {
  try {
    const { phone, fullName, dob, panNumber, aadhaarLastFour, bankAccount, ifsc } = req.body;
    const user = wallet.getUser(phone);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const result = wallet.db.submitKyc(user.id, phone, fullName, dob, panNumber, aadhaarLastFour, bankAccount, ifsc);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Operations & Risk Endpoints
app.get('/api/v1/admin/kyc', (req, res) => {
  res.json({ success: true, cases: wallet.db.getAllKyc() });
});

app.post('/api/v1/admin/kyc/review', (req, res) => {
  try {
    const { userId, status, reason } = req.body;
    const result = wallet.db.reviewKyc(userId, status, reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/admin/reconciliation', (req, res) => {
  const report = wallet.db.generateReconciliationReport();
  res.json({ success: true, report });
});

app.post('/api/v1/admin/emergency-killswitch', (req, res) => {
  const { action } = req.body; // 'PAUSE_BETTING' or 'RESUME_BETTING'
  const isPaused = action === 'PAUSE_BETTING';
  wallet.db.updateSystemSetting('betting_paused', isPaused ? 'true' : 'false');
  wallet.db.recordAuditEvent('ADMIN', isPaused ? 'EMERGENCY_BETTING_PAUSED' : 'BETTING_RESUMED', 'SYSTEM', 'GLOBAL', null, action, req.ip);
  res.json({ success: true, bettingPaused: isPaused });
});

app.get('/api/v1/wallet/transactions', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  return res.json({
    success: true,
    transactions: wallet.getTransactions(phone)
  });
});

app.get('/api/v1/wallet/passbook', (req, res) => {
  const { phone, filter } = req.query;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  const transactions = wallet.db.getTransactions(phone, filter || 'ALL');
  return res.json({
    success: true,
    transactions
  });
});

// --- DAILY LUCKY SPIN WHEEL APIS ---
app.get('/api/v1/spin/status', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  const canSpin = wallet.db.canSpinToday(phone);
  return res.json({ success: true, canSpin });
});

app.post('/api/v1/spin/claim', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
    const result = wallet.db.executeDailySpin(phone);

    // Broadcast winner if prize is high
    if (result.prize && result.prize.amount >= 100) {
      broadcast({
        type: 'LIVE_WINNER',
        phone: phone.substring(0, 4) + '***' + phone.slice(-2),
        game: 'WinDaq Lucky Wheel',
        amount: result.prize.amount,
        multiplier: 1.0
      });
    }

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- VIP CLUB APIS ---
app.get('/api/v1/user/vip', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  const vipInfo = wallet.db.getVipInfo(phone);
  if (!vipInfo) return res.status(404).json({ success: false, error: 'User not found' });
  return res.json({ success: true, vip: vipInfo });
});

app.post('/api/v1/user/vip/claim-cashback', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
    const vipInfo = wallet.db.getVipInfo(phone);
    if (!vipInfo || vipInfo.claimableCashback <= 0) {
      return res.status(400).json({ success: false, error: 'No cashback available to claim yet! Bet more to unlock.' });
    }
    const amount = vipInfo.claimableCashback;
    const credit = wallet.creditWin(phone, amount, 'VIP Daily Loss Cashback');
    return res.json({
      success: true,
      amount,
      message: `₹${amount} VIP Cashback credited to your balance!`,
      newBalance: credit.newBalance
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- REFER & EARN (AFFILIATE) APIS ---
app.get('/api/v1/user/referrals', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
  const stats = wallet.db.getReferralStats(phone);
  if (!stats) return res.status(404).json({ success: false, error: 'User not found' });
  return res.json({ success: true, referral: stats });
});

// --- REAL-TIME LIVE WINNERS FEED ---
app.get('/api/v1/feed/live-winners', (req, res) => {
  const simulatedWinners = [
    { name: 'Vikram S.', phone: '9876***21', game: 'WinDaq Aviator', amount: 18450, multiplier: '18.45x', time: 'Just now' },
    { name: 'Pooja R.', phone: '9812***89', game: 'Dragon vs Tiger', amount: 25000, multiplier: '2.0x', time: '1m ago' },
    { name: 'Amit K.', phone: '9745***12', game: 'Vegas 777 Slots', amount: 88200, multiplier: '77.7x', time: '2m ago' },
    { name: 'Sanjay M.', phone: '9923***44', game: 'Wingo Color Trading', amount: 9800, multiplier: '9.8x', time: '3m ago' },
    { name: 'Rahul D.', phone: '9654***78', game: 'Mines Gem Hunter', amount: 14200, multiplier: '14.2x', time: '4m ago' }
  ];
  return res.json({ success: true, winners: simulatedWinners });
});

// --- GAMES BETTING APIS ---

// 1. Wingo Color Prediction Bet
app.post('/api/v1/games/wingo/bet', (req, res) => {
  try {
    const { phone, amount, selection, periodId } = req.body; // selection: 'green', 'red', 'violet', '0'-'9', 'Big', 'Small'
    if (gameEngine.wingoState.timeLeft < 5) {
      return res.status(400).json({ success: false, error: 'Betting locked for this round! Wait for next.' });
    }
    const deduct = wallet.deductBet(phone, amount, `Wingo (${selection})`);
    gameEngine.wingoState.bets.push({ phone, amount, selection, periodId });

    return res.json({
      success: true,
      balance: deduct.newBalance,
      message: `Bet of ₹${amount} placed on ${selection}`
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 2. European Roulette Bet & Spin
app.post('/api/v1/games/roulette/spin', (req, res) => {
  try {
    const { phone, bets } = req.body; // bets: [{ type: 'red'|'black'|'number'|'even'|'odd', value, amount }]
    if (!bets || !bets.length) return res.status(400).json({ success: false, error: 'No bets placed' });

    let totalBet = 0;
    for (const b of bets) totalBet += parseFloat(b.amount);

    wallet.deductBet(phone, totalBet, 'Roulette Spin');
    const outcome = gameEngine.spinRoulette();

    let totalWin = 0;
    for (const b of bets) {
      if (b.type === 'number' && parseInt(b.value) === outcome.number) {
        totalWin += b.amount * 36;
      } else if (b.type === 'color' && b.value === outcome.color) {
        totalWin += b.amount * 2;
      } else if (b.type === 'even' && outcome.isEven) {
        totalWin += b.amount * 2;
      } else if (b.type === 'odd' && outcome.isOdd) {
        totalWin += b.amount * 2;
      }
    }

    let finalBalance = wallet.getTotalBalance(phone);
    if (totalWin > 0) {
      const credit = wallet.creditWin(phone, totalWin, 'Roulette', (totalWin / totalBet));
      finalBalance = credit.newBalance;
    }

    return res.json({
      success: true,
      outcome,
      totalBet,
      totalWin,
      newBalance: finalBalance
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 3. 777 Slots Spin
app.post('/api/v1/games/slots/spin', (req, res) => {
  try {
    const { phone, betAmount } = req.body;
    wallet.deductBet(phone, betAmount, 'Classic 777 Slots');
    const outcome = gameEngine.spinSlot();
    let winAmount = 0;
    let finalBalance = wallet.getTotalBalance(phone);

    if (outcome.isWin) {
      winAmount = parseFloat((betAmount * outcome.multiplier).toFixed(2));
      const credit = wallet.creditWin(phone, winAmount, 'Classic 777 Slots', outcome.multiplier);
      finalBalance = credit.newBalance;
    }

    return res.json({
      success: true,
      reels: outcome.reels,
      isWin: outcome.isWin,
      multiplier: outcome.multiplier,
      winAmount,
      newBalance: finalBalance
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Mines Bet & Reveal
const activeMinesGames = new Map();

app.post('/api/v1/games/mines/start', (req, res) => {
  try {
    const { phone, betAmount, mineCount } = req.body;
    const mCount = parseInt(mineCount) || 3;
    wallet.deductBet(phone, betAmount, `Mines (${mCount} mines)`);

    const minePositions = gameEngine.generateMinesBoard(mCount);
    const gameSession = {
      phone,
      betAmount: parseFloat(betAmount),
      mineCount: mCount,
      mines: minePositions,
      revealed: [],
      currentMultiplier: 1.00,
      active: true
    };
    activeMinesGames.set(phone, gameSession);

    return res.json({
      success: true,
      message: 'Game started! Pick cells.',
      newBalance: wallet.getTotalBalance(phone)
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/games/mines/reveal', (req, res) => {
  try {
    const { phone, cellIndex } = req.body;
    const session = activeMinesGames.get(phone);
    if (!session || !session.active) return res.status(400).json({ success: false, error: 'No active Mines game' });

    if (session.mines.includes(cellIndex)) {
      // Hit a mine! Game Over
      session.active = false;
      const allMines = session.mines;
      activeMinesGames.delete(phone);
      return res.json({
        success: true,
        hitMine: true,
        allMines,
        message: 'BOOM! You hit a mine. Better luck next time!',
        newBalance: wallet.getTotalBalance(phone)
      });
    }

    // Safe cell!
    session.revealed.push(cellIndex);
    // Multiplier calculation: 25 / (25 - mines - revealed) * 0.96
    const safeRemaining = 25 - session.mineCount;
    const revealedCount = session.revealed.length;
    session.currentMultiplier = parseFloat((1 + (revealedCount * (session.mineCount * 0.18))).toFixed(2));

    return res.json({
      success: true,
      hitMine: false,
      multiplier: session.currentMultiplier,
      revealedCount,
      potentialWin: parseFloat((session.betAmount * session.currentMultiplier).toFixed(2))
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/games/mines/cashout', (req, res) => {
  try {
    const { phone } = req.body;
    const session = activeMinesGames.get(phone);
    if (!session || !session.active || session.revealed.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot cashout' });
    }

    session.active = false;
    const winAmount = parseFloat((session.betAmount * session.currentMultiplier).toFixed(2));
    const credit = wallet.creditWin(phone, winAmount, 'Mines', session.currentMultiplier);
    const allMines = session.mines;
    activeMinesGames.delete(phone);

    return res.json({
      success: true,
      winAmount,
      multiplier: session.currentMultiplier,
      allMines,
      newBalance: credit.newBalance
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Cricket / Sportsbook Bet
app.post('/api/v1/games/sports/bet', (req, res) => {
  try {
    const { phone, matchId, type, team, odds, stake } = req.body;
    const deduct = wallet.deductBet(phone, stake, `Cricket Bet: ${team} @ ${odds}`);
    const potentialWin = parseFloat((stake * odds).toFixed(2));

    return res.json({
      success: true,
      message: `Bet of ₹${stake} placed on ${team} at odds ${odds}!`,
      potentialWin,
      newBalance: deduct.newBalance
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// --- ADMIN APIS ---
app.get('/api/v1/admin/stats', (req, res) => {
  res.json({
    success: true,
    rtpMode: gameEngine.rtpMode,
    totalUsers: wallet.getAllUsers().length,
    users: wallet.getAllUsers(),
    deposits: wallet.getAllDeposits(),
    withdrawals: wallet.getAllWithdrawals()
  });
});

app.post('/api/v1/admin/rtp', (req, res) => {
  const { mode } = req.body;
  gameEngine.setRtpMode(mode);
  res.json({ success: true, rtpMode: gameEngine.rtpMode });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  WINDAQ GAMING PLATFORM (विन डैक) - LIGHTNING ENGINE ACTIVE`);
  console.log(`  HTTP URL: http://localhost:${PORT}`);
  console.log(`  WebSocket URL: ws://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
