const db = require('./database');

class WalletManager {
  constructor() {
    this.db = db;
  }

  getOrCreateUser(phone, name = null) {
    const user = this.db.getOrCreateUser(phone, name);
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      depositBalance: user.deposit_balance,
      winningBalance: user.winning_balance,
      bonusBalance: user.bonus_balance || 0,
      vipTier: user.vip_tier || 'Bronze',
      vipPoints: user.vip_points || 0,
      referralCode: user.referral_code,
      totalWon: user.total_won || 0,
      totalBet: user.total_wagered || 0,
      createdAt: user.created_at
    };
  }

  getUser(phone) {
    const user = this.db.getUser(phone);
    if (!user) return null;
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      depositBalance: user.deposit_balance,
      winningBalance: user.winning_balance,
      bonusBalance: user.bonus_balance || 0,
      vipTier: user.vip_tier || 'Bronze',
      vipPoints: user.vip_points || 0,
      referralCode: user.referral_code,
      totalWon: user.total_won || 0,
      totalBet: user.total_wagered || 0,
      createdAt: user.created_at
    };
  }

  getTotalBalance(phone) {
    return this.db.getTotalBalance(phone);
  }

  deductBet(phone, amount, gameName, roundId = null, selection = null) {
    return this.db.deductBet(phone, amount, gameName, roundId, selection);
  }

  creditWin(phone, amount, gameName, multiplier = 1.0, betId = null) {
    return this.db.creditWin(phone, amount, gameName, multiplier, betId);
  }

  requestDeposit(phone, amount, utr, upiApp = 'UPI') {
    return this.db.requestDeposit(phone, amount, utr, upiApp);
  }

  requestWithdraw(phone, amount, paymentMethod, details) {
    return this.db.requestWithdraw(phone, amount, paymentMethod, details);
  }

  getTransactions(phone, filter = 'ALL') {
    return this.db.getTransactions(phone, filter);
  }

  getAllUsers() {
    return this.db.getAllUsers();
  }

  getAllDeposits() {
    return this.db.getAllDeposits();
  }

  getAllWithdrawals() {
    return this.db.getAllWithdrawals();
  }
}

module.exports = new WalletManager();
