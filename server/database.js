const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'gambling_platform.db');

class DatabaseService {
  constructor() {
    this.db = new DatabaseSync(DB_FILE);
    this.initSchema();
    this.seedDefaultData();
  }

  initSchema() {
    // Enable WAL mode for high concurrency
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    // 1. Users Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        avatar TEXT,
        vip_tier TEXT DEFAULT 'Bronze',
        vip_points INTEGER DEFAULT 0,
        total_deposit REAL DEFAULT 0,
        total_withdraw REAL DEFAULT 0,
        total_wagered REAL DEFAULT 0,
        total_won REAL DEFAULT 0,
        referral_code TEXT UNIQUE,
        referred_by TEXT,
        is_banned INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Wallets Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id TEXT PRIMARY KEY,
        deposit_balance REAL DEFAULT 0,
        winning_balance REAL DEFAULT 0,
        bonus_balance REAL DEFAULT 0,
        locked_balance REAL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 3. Transactions Table (Passbook)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        type TEXT NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL', 'BET', 'WIN', 'BONUS', 'SPIN_REWARD', 'REFERRAL'
        amount REAL NOT NULL,
        fee REAL DEFAULT 0,
        balance_after REAL NOT NULL,
        method TEXT, -- 'UPI', 'PAYTM', 'GPAY', 'PHONEPE', 'BANK_TRANSFER', 'SYSTEM'
        utr TEXT,
        status TEXT NOT NULL, -- 'SUCCESS', 'PENDING', 'FAILED', 'CANCELLED'
        description TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);

    // 4. Real-Money Deposit Requests (with Anti-Fraud UTR Check)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        amount REAL NOT NULL,
        utr TEXT UNIQUE NOT NULL,
        upi_app TEXT,
        screenshot TEXT,
        status TEXT NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED'
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_deposit_utr ON deposit_requests(utr);
      CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_requests(status);
    `);

    // 5. Real-Money Withdrawal Requests (with Balance Locking)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL, -- 'UPI', 'BANK_TRANSFER'
        upi_id TEXT,
        bank_account TEXT,
        ifsc TEXT,
        status TEXT NOT NULL, -- 'PENDING', 'PROCESSED', 'REJECTED'
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_withdraw_status ON withdrawal_requests(status);
    `);

    // 6. Bets Table (Casino, Aviator, etc.)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        game_id TEXT NOT NULL,
        round_id TEXT,
        selection TEXT,
        stake REAL NOT NULL,
        multiplier REAL DEFAULT 1.0,
        payout REAL DEFAULT 0,
        status TEXT NOT NULL, -- 'PENDING', 'WON', 'LOST', 'CASHED_OUT'
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_bets_game ON bets(game_id);
    `);

    // 7. Sportsbook / Cricket Bets
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sports_bets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        match_id TEXT NOT NULL,
        match_title TEXT NOT NULL,
        market TEXT NOT NULL,
        selection TEXT NOT NULL,
        type TEXT NOT NULL, -- 'BACK', 'LAY'
        odds REAL NOT NULL,
        stake REAL NOT NULL,
        potential_payout REAL NOT NULL,
        status TEXT NOT NULL, -- 'OPEN', 'WON', 'LOST', 'VOID'
        created_at TEXT NOT NULL,
        settled_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sports_match ON sports_bets(match_id);
    `);

    // 8. Game Rounds Table (Provably Fair)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        round_number INTEGER,
        server_seed TEXT,
        client_seed TEXT,
        hash TEXT,
        outcome_data TEXT,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT
      );
    `);

    // 9. Daily Lucky Spins Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_spins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        reward_type TEXT NOT NULL,
        reward_amount REAL NOT NULL,
        spun_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_daily_spins_phone ON daily_spins(phone);
    `);

    // 10. Referrals Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referrer_phone TEXT NOT NULL,
        referee_phone TEXT NOT NULL,
        bonus_amount REAL DEFAULT 200.0,
        commission_rate REAL DEFAULT 0.30,
        total_commission REAL DEFAULT 0.0,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_phone);
    `);

    // 11. System Settings Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  seedDefaultData() {
    const insertSetting = this.db.prepare(`
      INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();
    insertSetting.run('rtp_mode', 'BALANCED', now);
    insertSetting.run('merchant_upi_id', 'windaq@okhdfcbank', now);
    insertSetting.run('merchant_name', 'WinDaq Gaming', now);
    insertSetting.run('min_deposit', '100', now);
    insertSetting.run('min_withdraw', '200', now);
    insertSetting.run('signup_bonus', '1000', now);
    insertSetting.run('app_version', '2.5.0', now);

    // Check if demo user exists
    const getUserStmt = this.db.prepare('SELECT * FROM users WHERE phone = ?');
    const existing = getUserStmt.get('9876543210');
    if (!existing) {
      this.createUser('9876543210', 'Demo Player', null, 9420.0);
    }
  }

  genId(prefix) {
    return prefix + '_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
  }

  createUser(phone, name, referredBy = null, initialDeposit = 9420.0) {
    const userId = this.genId('usr');
    const now = new Date().toISOString();
    const refCode = 'WIN' + phone.slice(-4) + Math.floor(100 + Math.random() * 900);

    const insertUser = this.db.prepare(`
      INSERT INTO users (id, phone, name, referral_code, referred_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(userId, phone, name || `Player_${phone.slice(-4)}`, refCode, referredBy, now);

    const insertWallet = this.db.prepare(`
      INSERT INTO wallets (user_id, deposit_balance, winning_balance, bonus_balance, locked_balance, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertWallet.run(userId, initialDeposit, 0.0, 500.0, 0.0, now);

    if (initialDeposit > 0) {
      this.recordTransaction(userId, phone, 'DEPOSIT', initialDeposit, initialDeposit, 'UPI', 'UTR100000000001', 'SUCCESS', 'Initial Wallet Balance');
    }

    if (referredBy) {
      const refStmt = this.db.prepare(`
        INSERT INTO referrals (id, referrer_phone, referee_phone, bonus_amount, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      refStmt.run(this.genId('ref'), referredBy, phone, 200.0, now);
    }

    return this.getUser(phone);
  }

  getUser(phone) {
    const stmt = this.db.prepare(`
      SELECT u.*, w.deposit_balance, w.winning_balance, w.bonus_balance, w.locked_balance,
             (w.deposit_balance + w.winning_balance + w.bonus_balance) as total_balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.phone = ?
    `);
    return stmt.get(phone) || null;
  }

  getOrCreateUser(phone, name = null, referredBy = null) {
    const existing = this.getUser(phone);
    if (existing) return existing;
    return this.createUser(phone, name, referredBy, 1000.0);
  }

  getTotalBalance(phone) {
    const user = this.getUser(phone);
    if (!user) return 0.0;
    return parseFloat((user.deposit_balance + user.winning_balance + user.bonus_balance).toFixed(2));
  }

  recordTransaction(userId, phone, type, amount, balanceAfter, method, utr, status, description) {
    const txId = this.genId('tx');
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO transactions (id, user_id, phone, type, amount, balance_after, method, utr, status, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(txId, userId, phone, type, amount, balanceAfter, method || 'SYSTEM', utr || null, status, description, now);
    return txId;
  }

  updateVipPoints(userId, wagerAmount) {
    const pts = Math.floor(wagerAmount / 10);
    if (pts <= 0) return;

    const user = this.db.prepare('SELECT vip_points, vip_tier FROM users WHERE id = ?').get(userId);
    if (!user) return;

    const newPts = (user.vip_points || 0) + pts;
    let newTier = 'Bronze';
    if (newPts >= 10000) newTier = 'Diamond';
    else if (newPts >= 5000) newTier = 'Platinum';
    else if (newPts >= 2000) newTier = 'Gold';
    else if (newPts >= 500) newTier = 'Silver';

    this.db.prepare('UPDATE users SET vip_points = ?, vip_tier = ? WHERE id = ?').run(newPts, newTier, userId);
  }

  deductBet(phone, amount, gameName, roundId = null, selection = null) {
    const user = this.getUser(phone);
    if (!user) throw new Error('User not found');
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid bet amount');

    const total = this.getTotalBalance(phone);
    if (total < amount) {
      throw new Error('Insufficient wallet balance. Please deposit to continue!');
    }

    let remaining = amount;
    let depBal = user.deposit_balance;
    let winBal = user.winning_balance;
    let bonBal = user.bonus_balance;

    if (depBal >= remaining) {
      depBal -= remaining;
      remaining = 0;
    } else {
      remaining -= depBal;
      depBal = 0;
      if (winBal >= remaining) {
        winBal -= remaining;
        remaining = 0;
      } else {
        remaining -= winBal;
        winBal = 0;
        bonBal -= remaining;
      }
    }

    depBal = parseFloat(depBal.toFixed(2));
    winBal = parseFloat(winBal.toFixed(2));
    bonBal = parseFloat(bonBal.toFixed(2));
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE wallets
      SET deposit_balance = ?, winning_balance = ?, bonus_balance = ?, updated_at = ?
      WHERE user_id = ?
    `).run(depBal, winBal, bonBal, now, user.id);

    const newWagered = parseFloat(((user.total_wagered || 0) + amount).toFixed(2));
    this.db.prepare(`UPDATE users SET total_wagered = ? WHERE id = ?`).run(newWagered, user.id);
    this.updateVipPoints(user.id, amount);

    const newTotal = parseFloat((depBal + winBal + bonBal).toFixed(2));
    this.recordTransaction(user.id, phone, 'BET', -amount, newTotal, 'WALLET', null, 'SUCCESS', `Bet on ${gameName}`);

    const betId = this.genId('bet');
    this.db.prepare(`
      INSERT INTO bets (id, user_id, phone, game_id, round_id, selection, stake, multiplier, payout, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(betId, user.id, phone, gameName.toLowerCase().replace(/\s+/g, '_'), roundId, selection || gameName, amount, 0, 0, 'PENDING', now);

    return {
      success: true,
      betId,
      newBalance: newTotal,
      depositBalance: depBal,
      winningBalance: winBal,
      bonusBalance: bonBal
    };
  }

  creditWin(phone, amount, gameName, multiplier = 1.0, betId = null) {
    const user = this.getUser(phone);
    if (!user) throw new Error('User not found');
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) return { success: false, newBalance: this.getTotalBalance(phone) };

    const winBal = parseFloat((user.winning_balance + amount).toFixed(2));
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE wallets
      SET winning_balance = ?, updated_at = ?
      WHERE user_id = ?
    `).run(winBal, now, user.id);

    const newTotalWon = parseFloat(((user.total_won || 0) + amount).toFixed(2));
    this.db.prepare(`UPDATE users SET total_won = ? WHERE id = ?`).run(newTotalWon, user.id);

    const newTotal = parseFloat((user.deposit_balance + winBal + user.bonus_balance).toFixed(2));
    const multStr = multiplier > 1 ? ` (${multiplier.toFixed(2)}x)` : '';
    this.recordTransaction(user.id, phone, 'WIN', amount, newTotal, 'WALLET', null, 'SUCCESS', `Win in ${gameName}${multStr}`);

    if (betId) {
      this.db.prepare(`UPDATE bets SET multiplier = ?, payout = ?, status = 'WON' WHERE id = ?`).run(multiplier, amount, betId);
    }

    return {
      success: true,
      newBalance: newTotal,
      depositBalance: user.deposit_balance,
      winningBalance: winBal
    };
  }

  /* ================== REAL MONEY BANKING PIPELINE ================== */

  // 1. Submit Deposit with Anti-Fraud Duplicate UTR Protection
  submitDepositRequest(phone, amount, utr, upiApp = 'UPI', screenshot = null) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 100) throw new Error('Minimum deposit amount is ₹100');

    const cleanUtr = (utr || '').trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 8) {
      throw new Error('Please enter a valid 12-digit UPI UTR / Reference Number');
    }

    // Check duplicate UTR across all deposits!
    const existing = this.db.prepare('SELECT * FROM deposit_requests WHERE utr = ?').get(cleanUtr);
    if (existing) {
      throw new Error(`This UTR (${cleanUtr}) has already been submitted on ${new Date(existing.created_at).toLocaleDateString()}! Double-submission is prohibited.`);
    }

    const user = this.getOrCreateUser(phone);
    const reqId = this.genId('dep');
    const now = new Date().toISOString();

    // Auto-approve in dev mode, or queue for review
    const autoApprove = process.env.AUTO_APPROVE_DEPOSITS === 'true' || true;
    const status = autoApprove ? 'APPROVED' : 'PENDING';

    this.db.prepare(`
      INSERT INTO deposit_requests (id, user_id, phone, amount, utr, upi_app, screenshot, status, created_at, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(reqId, user.id, phone, amount, cleanUtr, upiApp, screenshot, status, now, autoApprove ? now : null);

    if (autoApprove) {
      const depBal = parseFloat((user.deposit_balance + amount).toFixed(2));
      this.db.prepare(`UPDATE wallets SET deposit_balance = ?, updated_at = ? WHERE user_id = ?`).run(depBal, now, user.id);
      this.db.prepare(`UPDATE users SET total_deposit = total_deposit + ? WHERE id = ?`).run(amount, user.id);
      const newTotal = parseFloat((depBal + user.winning_balance + user.bonus_balance).toFixed(2));
      this.recordTransaction(user.id, phone, 'DEPOSIT', amount, newTotal, upiApp, cleanUtr, 'SUCCESS', `Instant UPI Deposit via ${upiApp} (UTR: ${cleanUtr})`);
    }

    return {
      success: true,
      requestId: reqId,
      status,
      utr: cleanUtr,
      amount,
      newBalance: this.getTotalBalance(phone)
    };
  }

  // 2. Admin Approve Deposit
  approveDepositRequest(requestId, adminNotes = 'Verified by Admin') {
    const req = this.db.prepare('SELECT * FROM deposit_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Deposit request not found');
    if (req.status === 'APPROVED') throw new Error('Deposit request already approved');

    const now = new Date().toISOString();
    this.db.prepare(`UPDATE deposit_requests SET status = 'APPROVED', admin_notes = ?, processed_at = ? WHERE id = ?`)
      .run(adminNotes, now, requestId);

    const user = this.getUser(req.phone);
    const depBal = parseFloat((user.deposit_balance + req.amount).toFixed(2));
    this.db.prepare(`UPDATE wallets SET deposit_balance = ?, updated_at = ? WHERE user_id = ?`).run(depBal, now, user.id);
    this.db.prepare(`UPDATE users SET total_deposit = total_deposit + ? WHERE id = ?`).run(req.amount, user.id);

    const newTotal = parseFloat((depBal + user.winning_balance + user.bonus_balance).toFixed(2));
    this.recordTransaction(user.id, req.phone, 'DEPOSIT', req.amount, newTotal, req.upi_app, req.utr, 'SUCCESS', `Deposit Approved by Admin (UTR: ${req.utr})`);

    return { success: true, newBalance: newTotal };
  }

  // 3. Admin Reject Deposit
  rejectDepositRequest(requestId, reason = 'Invalid UTR') {
    const req = this.db.prepare('SELECT * FROM deposit_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Deposit request not found');
    if (req.status === 'APPROVED') throw new Error('Cannot reject an already approved deposit');

    const now = new Date().toISOString();
    this.db.prepare(`UPDATE deposit_requests SET status = 'REJECTED', admin_notes = ?, processed_at = ? WHERE id = ?`)
      .run(reason, now, requestId);

    return { success: true, message: `Deposit rejected: ${reason}` };
  }

  // 4. Submit Withdrawal with Balance Locking (prevents spending while pending)
  submitWithdrawalRequest(phone, amount, paymentMethod = 'UPI', details = {}) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 200) throw new Error('Minimum withdrawal amount is ₹200');

    const user = this.getUser(phone);
    if (!user) throw new Error('User not found');

    if (user.winning_balance < amount) {
      throw new Error(`Insufficient winning balance! Available to withdraw: ₹${user.winning_balance.toFixed(2)}`);
    }

    const upiId = typeof details === 'string' ? details : (details.upiId || '');
    const bankAcc = details.accountNumber || '';
    const ifsc = details.ifsc || '';

    if (paymentMethod === 'UPI' && (!upiId || !upiId.includes('@'))) {
      throw new Error('Please enter a valid UPI ID (e.g. name@okhdfcbank)');
    }

    // Immediately lock / deduct winning balance
    const winBal = parseFloat((user.winning_balance - amount).toFixed(2));
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE wallets SET winning_balance = ?, updated_at = ? WHERE user_id = ?`).run(winBal, now, user.id);

    const reqId = this.genId('wth');
    this.db.prepare(`
      INSERT INTO withdrawal_requests (id, user_id, phone, amount, payment_method, upi_id, bank_account, ifsc, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(reqId, user.id, phone, amount, paymentMethod, upiId, bankAcc, ifsc, now);

    const newTotal = parseFloat((user.deposit_balance + winBal + user.bonus_balance).toFixed(2));
    this.recordTransaction(user.id, phone, 'WITHDRAWAL', -amount, newTotal, paymentMethod, reqId, 'PENDING', `Withdrawal Request submitted to ${paymentMethod} (${upiId || bankAcc})`);

    return {
      success: true,
      requestId: reqId,
      amount,
      paymentMethod,
      destination: upiId || bankAcc,
      status: 'PENDING',
      newBalance: newTotal,
      winningBalance: winBal
    };
  }

  // 5. Admin Process Withdrawal (Mark Paid)
  processWithdrawalRequest(requestId, adminNotes = 'Paid via Bank/UPI') {
    const req = this.db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Withdrawal request not found');
    if (req.status === 'PROCESSED') throw new Error('Withdrawal already processed');

    const now = new Date().toISOString();
    this.db.prepare(`UPDATE withdrawal_requests SET status = 'PROCESSED', admin_notes = ?, processed_at = ? WHERE id = ?`)
      .run(adminNotes, now, requestId);

    this.db.prepare(`UPDATE users SET total_withdraw = total_withdraw + ? WHERE id = ?`).run(req.amount, req.user_id);
    this.db.prepare(`UPDATE transactions SET status = 'SUCCESS' WHERE utr = ?`).run(requestId);

    return { success: true, message: 'Withdrawal marked as PROCESSED' };
  }

  // 6. Admin Reject Withdrawal (Refunds winning balance back to player)
  rejectWithdrawalRequest(requestId, reason = 'Bank details invalid') {
    const req = this.db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Withdrawal request not found');
    if (req.status === 'PROCESSED') throw new Error('Cannot reject an already processed payout');

    const now = new Date().toISOString();
    this.db.prepare(`UPDATE withdrawal_requests SET status = 'REJECTED', admin_notes = ?, processed_at = ? WHERE id = ?`)
      .run(reason, now, requestId);

    // Refund winning balance
    const user = this.getUser(req.phone);
    const winBal = parseFloat((user.winning_balance + req.amount).toFixed(2));
    this.db.prepare(`UPDATE wallets SET winning_balance = ?, updated_at = ? WHERE user_id = ?`).run(winBal, now, user.id);

    const newTotal = parseFloat((user.deposit_balance + winBal + user.bonus_balance).toFixed(2));
    this.recordTransaction(user.id, req.phone, 'BONUS', req.amount, newTotal, 'REFUND', requestId, 'SUCCESS', `Withdrawal Refund (${reason})`);

    return { success: true, message: `Withdrawal rejected and ₹${req.amount} refunded to player`, newBalance: newTotal };
  }

  // Banking Queries
  getPendingDeposits() {
    return this.db.prepare("SELECT * FROM deposit_requests WHERE status = 'PENDING' ORDER BY created_at DESC").all();
  }

  getAllDeposits() {
    return this.db.prepare("SELECT * FROM deposit_requests ORDER BY created_at DESC LIMIT 100").all();
  }

  getPendingWithdrawals() {
    return this.db.prepare("SELECT * FROM withdrawal_requests WHERE status = 'PENDING' ORDER BY created_at DESC").all();
  }

  getAllWithdrawals() {
    return this.db.prepare("SELECT * FROM withdrawal_requests ORDER BY created_at DESC LIMIT 100").all();
  }

  /* ================== SPORTSBOOK & CRICKET BETTING ================== */
  placeSportsBet(phone, matchId, matchTitle, market, selection, type, odds, stake) {
    stake = parseFloat(stake);
    odds = parseFloat(odds);
    if (isNaN(stake) || stake <= 0) throw new Error('Invalid stake amount');
    if (isNaN(odds) || odds <= 1.0) throw new Error('Invalid odds');

    const deduct = this.deductBet(phone, stake, `Sports: ${matchTitle} (${selection})`);
    const potentialPayout = parseFloat((stake * odds).toFixed(2));
    const betId = this.genId('sp_bet');
    const now = new Date().toISOString();

    const user = this.getUser(phone);
    this.db.prepare(`
      INSERT INTO sports_bets (id, user_id, phone, match_id, match_title, market, selection, type, odds, stake, potential_payout, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
    `).run(betId, user.id, phone, matchId, matchTitle, market, selection, type.toUpperCase(), odds, stake, potentialPayout, now);

    return {
      success: true,
      betId,
      potentialPayout,
      newBalance: deduct.newBalance
    };
  }

  settleSportsBet(betId, outcome = 'WON') {
    const bet = this.db.prepare('SELECT * FROM sports_bets WHERE id = ?').get(betId);
    if (!bet || bet.status !== 'OPEN') return;

    const now = new Date().toISOString();
    if (outcome === 'WON') {
      this.db.prepare(`UPDATE sports_bets SET status = 'WON', settled_at = ? WHERE id = ?`).run(now, betId);
      this.creditWin(bet.phone, bet.potential_payout, `Sports: ${bet.match_title}`, bet.odds);
    } else if (outcome === 'VOID') {
      this.db.prepare(`UPDATE sports_bets SET status = 'VOID', settled_at = ? WHERE id = ?`).run(now, betId);
      this.creditWin(bet.phone, bet.stake, `Sports Refund: ${bet.match_title}`, 1.0);
    } else {
      this.db.prepare(`UPDATE sports_bets SET status = 'LOST', settled_at = ? WHERE id = ?`).run(now, betId);
    }
  }

  // Daily Lucky Spin Wheel
  canSpinToday(phone) {
    const user = this.getUser(phone);
    if (!user) return true;
    const stmt = this.db.prepare(`
      SELECT spun_at FROM daily_spins WHERE phone = ? ORDER BY spun_at DESC LIMIT 1
    `);
    const last = stmt.get(phone);
    if (!last) return true;

    const lastDate = new Date(last.spun_at);
    const now = new Date();
    const hoursDiff = (now - lastDate) / (1000 * 60 * 60);
    return hoursDiff >= 12;
  }

  executeDailySpin(phone) {
    const user = this.getOrCreateUser(phone);
    if (!this.canSpinToday(phone)) {
      throw new Error('Daily spin already claimed today! Come back tomorrow.');
    }

    const prizes = [
      { type: 'CASH', amount: 50, label: '₹50 CASH', weight: 35 },
      { type: 'CASH', amount: 100, label: '₹100 CASH', weight: 25 },
      { type: 'BONUS', amount: 200, label: '₹200 BONUS', weight: 15 },
      { type: 'CASH', amount: 20, label: '₹20 CASH', weight: 15 },
      { type: 'CASH', amount: 500, label: '₹500 BIG WIN', weight: 6 },
      { type: 'BONUS', amount: 1000, label: '₹1000 MEGA BONUS', weight: 2 },
      { type: 'CASH', amount: 2500, label: '₹2500 JACKPOT', weight: 1 },
      { type: 'CASH', amount: 250, label: '₹250 CASH', weight: 1 }
    ];

    let totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedPrize = prizes[0];
    let selectedIndex = 0;

    for (let i = 0; i < prizes.length; i++) {
      if (rand < prizes[i].weight) {
        selectedPrize = prizes[i];
        selectedIndex = i;
        break;
      }
      rand -= prizes[i].weight;
    }

    const now = new Date().toISOString();
    let newDeposit = user.deposit_balance;
    let newWinning = user.winning_balance;
    let newBonus = user.bonus_balance;

    if (selectedPrize.type === 'CASH') {
      newWinning = parseFloat((newWinning + selectedPrize.amount).toFixed(2));
    } else {
      newBonus = parseFloat((newBonus + selectedPrize.amount).toFixed(2));
    }

    this.db.prepare(`
      UPDATE wallets
      SET deposit_balance = ?, winning_balance = ?, bonus_balance = ?, updated_at = ?
      WHERE user_id = ?
    `).run(newDeposit, newWinning, newBonus, now, user.id);

    const spinId = this.genId('spn');
    this.db.prepare(`
      INSERT INTO daily_spins (id, user_id, phone, reward_type, reward_amount, spun_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(spinId, user.id, phone, selectedPrize.type, selectedPrize.amount, now);

    const newTotal = parseFloat((newDeposit + newWinning + newBonus).toFixed(2));
    this.recordTransaction(user.id, phone, 'SPIN_REWARD', selectedPrize.amount, newTotal, 'LUCKY_WHEEL', null, 'SUCCESS', `Won ${selectedPrize.label} on Daily Lucky Spin!`);

    return {
      success: true,
      selectedIndex,
      prize: selectedPrize,
      newBalance: newTotal
    };
  }

  getVipInfo(phone) {
    const user = this.getUser(phone);
    if (!user) return null;

    const tiers = [
      { name: 'Bronze', minPoints: 0, cashbackPercent: 3, perk: 'Standard Payouts' },
      { name: 'Silver', minPoints: 500, cashbackPercent: 5, perk: '5% Daily Cashback + Fast Payout' },
      { name: 'Gold', minPoints: 2000, cashbackPercent: 7, perk: '7% Daily Cashback + VIP Badge' },
      { name: 'Platinum', minPoints: 5000, cashbackPercent: 10, perk: '10% Cashback + Personal VIP Agent' },
      { name: 'Diamond', minPoints: 10000, cashbackPercent: 12, perk: '12% Instant Cashback + Unlimited Limits' }
    ];

    const currentTier = tiers.find(t => t.name === user.vip_tier) || tiers[0];
    const currentIndex = tiers.indexOf(currentTier);
    const nextTier = tiers[currentIndex + 1] || null;

    const claimableCashback = parseFloat(((user.total_wagered * (currentTier.cashbackPercent / 100)) * 0.1).toFixed(2));

    return {
      tier: currentTier.name,
      points: user.vip_points || 0,
      cashbackPercent: currentTier.cashbackPercent,
      perk: currentTier.perk,
      nextTier: nextTier ? { name: nextTier.name, pointsNeeded: nextTier.minPoints - user.vip_points } : null,
      claimableCashback: Math.min(claimableCashback, 1500)
    };
  }

  getReferralStats(phone) {
    const user = this.getUser(phone);
    if (!user) return null;

    const stmt = this.db.prepare('SELECT * FROM referrals WHERE referrer_phone = ?');
    const referrals = stmt.all(phone);
    const totalEarned = referrals.reduce((sum, r) => sum + (r.total_commission || 0) + (r.bonus_amount || 0), 0);

    return {
      referralCode: user.referral_code,
      totalFriends: referrals.length,
      totalEarned: parseFloat(totalEarned.toFixed(2)),
      friends: referrals.map(r => ({
        phone: r.referee_phone.substring(0, 4) + '***' + r.referee_phone.slice(-2),
        bonus: r.bonus_amount,
        joinedAt: r.created_at
      }))
    };
  }

  getTransactions(phone, filter = 'ALL') {
    let sql = 'SELECT * FROM transactions WHERE phone = ?';
    const params = [phone];

    if (filter === 'DEPOSIT') {
      sql += " AND type = 'DEPOSIT'";
    } else if (filter === 'WITHDRAWAL') {
      sql += " AND type = 'WITHDRAWAL'";
    } else if (filter === 'BET') {
      sql += " AND type = 'BET'";
    } else if (filter === 'WIN') {
      sql += " AND type = 'WIN'";
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';
    return this.db.prepare(sql).all(...params);
  }

  getAllUsers() {
    return this.db.prepare(`
      SELECT u.*, (w.deposit_balance + w.winning_balance + w.bonus_balance) as total_balance
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
    `).all();
  }

  getSystemSettings() {
    const rows = this.db.prepare("SELECT * FROM system_settings").all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return settings;
  }

  updateSystemSetting(key, value) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value.toString(), now);
  }
}

module.exports = new DatabaseService();
