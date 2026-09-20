const crypto = require('crypto');
const { BaseTableEngine } = require('./BaseTableEngine');
const provablyFair = require('../ProvablyFairService');

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // A = 14, K=13, Q=12, J=11

class AndarBaharEngine extends BaseTableEngine {
  constructor(room = 'Auto', io) {
    super('andar-bahar', room, io);
  }

  dealAndResolve(serverSeed, clientSeed) {
    const result = provablyFair.deriveAndarBaharResult(serverSeed, clientSeed, 0);
    return result.outcome;
  }

  calculatePayouts(market, result) {
    const w = result.winner;

    if (market === 'ANDAR') {
      if (w === 'ANDAR') return 1.9; // 0.9:1 payout + original stake
      return 0.0;
    }

    if (market === 'BAHAR') {
      if (w === 'BAHAR') return 2.0; // 1:1 payout + original stake
      return 0.0;
    }

    // Side Bets could be added here (e.g. JOKER_RED, JOKER_BLACK)
    if (market === 'JOKER_RED') {
      if (result.joker.suit === 'H' || result.joker.suit === 'D') return 1.9;
      return 0.0;
    }

    if (market === 'JOKER_BLACK') {
      if (result.joker.suit === 'S' || result.joker.suit === 'C') return 1.9;
      return 0.0;
    }

    return 0.0;
  }
}

module.exports = { AndarBaharEngine };
