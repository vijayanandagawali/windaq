const Hand = require('pokersolver').Hand;

class HandEvaluator {
  /**
   * Evaluate best 5-card hand for a given player
   * @param {string[]} holeCards - e.g. ['As', 'Kh']
   * @param {string[]} communityCards - e.g. ['Ts', 'Js', 'Qs', '3d', '2c']
   * @returns {Object} { handName: 'Royal Flush', rank: 1, cards: [...] }
   */
  static evaluate(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    // Pokersolver uses 'Ts' instead of '10s' etc., which matches our Deck logic
    const hand = Hand.solve(allCards);
    return {
      name: hand.name,
      description: hand.descr,
      rank: hand.rank,
      cards: hand.cards.map(c => c.value + c.suit)
    };
  }

  /**
   * Determine winners from a list of players
   * @param {Array<{id: string, holeCards: string[]}>} players
   * @param {string[]} communityCards
   * @returns {Array<string>} Array of winning player IDs (can be multiple for split pot)
   */
  static getWinners(players, communityCards) {
    const hands = players.map(p => {
      const allCards = [...p.holeCards, ...communityCards];
      const solved = Hand.solve(allCards);
      solved.playerId = p.id;
      return solved;
    });

    const winners = Hand.winners(hands);
    return winners.map(w => w.playerId);
  }
}

module.exports = HandEvaluator;
