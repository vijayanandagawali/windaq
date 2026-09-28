const { BaseTableEngine } = require('./BaseTableEngine');
const provablyFair = require('../ProvablyFairService');
const { evaluate, CATEGORY } = require('../cards/teenPattiHands');

/**
 * Teen Patti 20-20: a house-banked round. Two hands (Player A, Player B) are dealt from one
 * provably fair shuffle; everyone bets on which hand wins, plus an optional Pair Plus side bet.
 *
 * Returns (stake included):
 *   PLAYER_A / PLAYER_B: 1.98x on a win; stake returned if both hands are exactly equal.
 *   PAIR_PLUS_A / PAIR_PLUS_B on that hand: Pair 2x, Color 5x, Sequence 7x, Trail 31x, Pure Sequence 41x.
 * Payouts are fixed here on purpose so they can never change mid-round.
 */
const MAIN_WIN = 1.98;
const PAIR_PLUS = {
  [CATEGORY.PAIR]: 2,
  [CATEGORY.COLOR]: 5,
  [CATEGORY.SEQUENCE]: 7,
  [CATEGORY.TRAIL]: 31,
  [CATEGORY.PURE_SEQUENCE]: 41
};
const MARKETS = ['PLAYER_A', 'PLAYER_B', 'PAIR_PLUS_A', 'PAIR_PLUS_B'];

class TeenPatti2020Engine extends BaseTableEngine {
  constructor(room = 'Auto', coreManager) {
    // Six cards are revealed one by one, so the reveal phase is longer than a two-card game.
    super('teen-patti-2020', room, coreManager, { RESULT_REVEAL: 7 });
    this.dealer = { ...this.dealer, dealerId: 'dealer_virtual', name: 'Virtual Dealer', title: 'Simulated dealer' };
  }

  dealAndResolve(serverSeed, clientSeed) {
    return provablyFair.deriveTeenPattiResult(serverSeed, clientSeed, 0).outcome;
  }

  getDealingSteps(result) {
    if (!result) return [];
    return [0, 1, 2].flatMap((i) => [
      { step: i * 2 + 1, target: 'A', card: result.playerA[i] },
      { step: i * 2 + 2, target: 'B', card: result.playerB[i] }
    ]);
  }

  getDealerSpeech(phase, result) {
    if (result && result.winner) {
      if (result.winner === 'TIE') return `Both hands tie with ${result.handA.label}. Main bets are returned.`;
      const hand = result.winner === 'A' ? result.handA : result.handB;
      return `Player ${result.winner} wins with ${hand.label}.`;
    }
    return 'Bets on Player A or Player B. Pair Plus pays on a pair or better.';
  }

  calculatePayouts(market, result) {
    if (!result || !MARKETS.includes(market)) return 0;
    if (market === 'PLAYER_A' || market === 'PLAYER_B') {
      if (result.winner === 'TIE') return 1;
      return result.winner === market.slice(-1) ? MAIN_WIN : 0;
    }
    const cards = market === 'PAIR_PLUS_A' ? result.playerA : result.playerB;
    return PAIR_PLUS[evaluate(cards).category] || 0;
  }
}

module.exports = { TeenPatti2020Engine, TEEN_PATTI_MARKETS: MARKETS, MAIN_WIN, PAIR_PLUS };
