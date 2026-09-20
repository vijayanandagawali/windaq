const { BaseTableEngine, UNIVERSAL_PHASES } = require('./BaseTableEngine');
const provablyFair = require('../ProvablyFairService');

class DragonTigerEngine extends BaseTableEngine {
  constructor(room = 'Standard', coreManager) {
    super('dragon-tiger', room, coreManager);
    
    // Virtual Dealer profile
    this.dealer = {
      name: 'Maya',
      title: 'Virtual Live Dealer',
      tableId: 'DT-LIVETABLE-01',
      avatar: 'maya',
      speech: 'Welcome! Place your bets on Dragon, Tiger, or Tie.',
      action: 'INVITING_BETS'
    };
  }

  dealAndResolve(serverSeed, clientSeed) {
    const result = provablyFair.deriveDragonTigerResult(serverSeed, clientSeed, 0);
    return result.outcome;
  }

  getDealingSteps(result) {
    return [
      { step: 1, target: 'DRAGON', card: result?.dragon, faceUp: true },
      { step: 2, target: 'TIGER', card: result?.tiger, faceUp: true }
    ];
  }

  getDealerSpeech(phase, result) {
    const ranks = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack' };
    const formatRank = (r) => ranks[r] || r;

    switch (phase) {
      case UNIVERSAL_PHASES.BETTING_OPEN:
        return 'Bets are OPEN! 15 seconds to place your chips on Dragon, Tiger, or Tie.';
      case UNIVERSAL_PHASES.BETTING_CLOSED:
        return 'Bets are CLOSED! No more bets. Dealing begins now.';
      case UNIVERSAL_PHASES.PLAYING:
        return 'Dealing cards from the shoe... Dragon card first, then Tiger.';
      case UNIVERSAL_PHASES.RESULT:
        if (!result) return 'Round complete.';
        if (result.winner === 'TIE') {
          return `It's a TIE with rank ${formatRank(result.dragon?.rank)}! 8 to 1 payout for Tie bets!`;
        }
        const winningRank = result.winner === 'DRAGON' ? formatRank(result.dragon?.rank) : formatRank(result.tiger?.rank);
        return `${result.winner} WINS with ${winningRank}! Congratulations!`;
      case UNIVERSAL_PHASES.SETTLEMENT:
        return 'Settling winning bets into player wallets now.';
      case UNIVERSAL_PHASES.COMPLETED:
        return 'Round complete. Results logged.';
      case UNIVERSAL_PHASES.NEXT_ROUND:
        return 'Cards cleared into discard tray. Preparing next round...';
      default:
        return 'Welcome to Universal Simulated Live Dragon Tiger.';
    }
  }

  calculatePayouts(market, result) {
    const w = result?.winner;

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
