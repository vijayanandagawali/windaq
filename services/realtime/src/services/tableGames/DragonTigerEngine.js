const crypto = require('crypto');
const { BaseTableEngine } = require('./BaseTableEngine');
const provablyFair = require('../ProvablyFairService');

// Standard 52 Card Deck setup
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // A = 14, K=13, Q=12, J=11

class DragonTigerEngine extends BaseTableEngine {
  constructor(room = 'Standard', io) {
    super('dragon-tiger', room, io);
  }

  dealAndResolve(serverSeed, clientSeed) {
    const result = provablyFair.deriveDragonTigerResult(serverSeed, clientSeed, 0);
    return result.outcome;
  }

  calculatePayouts(market, result) {
    const w = result.winner;

    if (market === 'DRAGON') {
      if (w === 'DRAGON') return 2.0; // 1:1 payout + original stake
      if (w === 'TIE') return 0.5;    // Returns half stake on tie
      return 0.0;
    }

    if (market === 'TIGER') {
      if (w === 'TIGER') return 2.0;
      if (w === 'TIE') return 0.5;
      return 0.0;
    }

    if (market === 'TIE') {
      if (w === 'TIE') return 9.0; // 8:1 payout + original stake
      return 0.0;
    }

    return 0.0;
  }
}

module.exports = { DragonTigerEngine };
