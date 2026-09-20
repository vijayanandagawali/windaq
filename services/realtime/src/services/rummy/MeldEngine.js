/**
 * Rummy Meld Validation Engine
 */

const CardValues = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13
};

class MeldEngine {
  constructor(wildJokerRank) {
    this.wildJokerRank = wildJokerRank; // e.g. '7'
  }

  isJoker(cardStr) {
    if (cardStr === 'JOKER') return true; // Printed Joker
    const rank = cardStr[0];
    return rank === this.wildJokerRank; // Wild Joker
  }

  getPoints(cardStr) {
    if (this.isJoker(cardStr)) return 0;
    const rank = cardStr[0];
    if (['T', 'J', 'Q', 'K', 'A'].includes(rank)) return 10;
    return parseInt(rank);
  }

  sortCards(cards) {
    return [...cards].sort((a, b) => {
      if (a === 'JOKER') return 1;
      if (b === 'JOKER') return -1;
      return CardValues[a[0]] - CardValues[b[0]];
    });
  }

  // Check if a group of cards is a valid Pure Sequence
  isPureSequence(cards) {
    if (cards.length < 3) return false;
    
    // Pure sequence cannot contain printed jokers, or wild jokers UNLESS used in their natural position
    const suit = cards[0][1];
    
    // Sort naturally
    const sorted = this.sortCards(cards);
    
    for (let i = 0; i < sorted.length; i++) {
      const card = sorted[i];
      if (card === 'JOKER') return false; // printed joker
      if (card[1] !== suit) return false; // wrong suit
      
      if (i > 0) {
        const prevRankVal = CardValues[sorted[i-1][0]];
        const currRankVal = CardValues[card[0]];
        
        // Handle A-2-3 and J-Q-K-A
        if (currRankVal - prevRankVal !== 1) {
           // check if last card is Ace and previous is King
           if (i === sorted.length - 1 && sorted[i][0] === 'A' && sorted[i-1][0] === 'K') {
             continue; // valid K-A
           }
           return false;
        }
      }
    }
    
    return true;
  }

  // Check if a group of cards is a valid Impure Sequence (contains jokers)
  isImpureSequence(cards) {
    if (cards.length < 3) return false;
    
    // Extract non-jokers to find the suit and base values
    const naturalCards = cards.filter(c => !this.isJoker(c));
    if (naturalCards.length === 0) return true; // all jokers (rare but technically a sequence of jokers? No, invalid in rummy. But let's assume they have at least 1 real card)
    
    const suit = naturalCards[0][1];
    if (naturalCards.some(c => c[1] !== suit)) return false; // Mixed suits

    const numJokers = cards.length - naturalCards.length;
    
    // Need to check if natural cards + jokers can form a sequence
    const sortedNaturals = this.sortCards(naturalCards);
    
    let requiredJokers = 0;
    for (let i = 1; i < sortedNaturals.length; i++) {
      const diff = CardValues[sortedNaturals[i][0]] - CardValues[sortedNaturals[i-1][0]];
      if (diff > 1) {
        requiredJokers += (diff - 1);
      } else if (diff === 0) {
        return false; // Duplicates not allowed in sequence unless different decks? No duplicates in sequence.
      }
    }

    // Special case for Ace: A-2-3 (A=1) or Q-K-A (A=14)
    // If Ace is present and diff check fails, we might need to treat Ace as 14
    if (requiredJokers > numJokers && sortedNaturals[0][0] === 'A') {
      let reqWithHighAce = 0;
      let validWithHighAce = true;
      for (let i = 2; i < sortedNaturals.length; i++) {
         const diff = CardValues[sortedNaturals[i][0]] - CardValues[sortedNaturals[i-1][0]];
         if (diff > 1) reqWithHighAce += (diff - 1);
         else if (diff === 0) validWithHighAce = false;
      }
      // Add gap from last card to high Ace
      const lastCard = sortedNaturals[sortedNaturals.length - 1];
      const diffToAce = 14 - CardValues[lastCard[0]];
      if (diffToAce > 1) reqWithHighAce += (diffToAce - 1);
      
      if (validWithHighAce && reqWithHighAce <= numJokers) {
        return true;
      }
    }

    return requiredJokers <= numJokers;
  }

  isSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false; // sets are 3 or 4 cards
    
    const naturalCards = cards.filter(c => !this.isJoker(c));
    if (naturalCards.length === 0) return true;
    
    const rank = naturalCards[0][0];
    const suits = new Set();
    
    for (const card of naturalCards) {
      if (card[0] !== rank) return false; // Different ranks
      if (suits.has(card[1])) return false; // Duplicate suits not allowed in set
      suits.add(card[1]);
    }
    
    return true;
  }

  isValidMeld(cards) {
    return this.isPureSequence(cards) || this.isImpureSequence(cards) || this.isSet(cards);
  }

  // Validate an entire declaration
  // melds is an array of arrays of card strings: e.g. [['7H','8H','9H'], ['3C','3D','JOKER']]
  validateDeclaration(melds) {
    let hasPureSequence = false;
    let sequenceCount = 0;
    
    const invalidMelds = [];
    let unmeldedPoints = 0;
    
    for (const meld of melds) {
      if (this.isPureSequence(meld)) {
        hasPureSequence = true;
        sequenceCount++;
      } else if (this.isImpureSequence(meld)) {
        sequenceCount++;
      } else if (this.isSet(meld)) {
        // Valid set
      } else {
        // Invalid meld
        invalidMelds.push(meld);
        unmeldedPoints += meld.reduce((sum, c) => sum + this.getPoints(c), 0);
      }
    }
    
    const isValid = invalidMelds.length === 0 && hasPureSequence && sequenceCount >= 2;
    
    // Cap unmelded points at 80
    const points = isValid ? 0 : Math.min(80, unmeldedPoints);
    
    return {
      isValid,
      points,
      invalidMelds
    };
  }

  calculatePenalty(melds) {
    // If not declared successfully, calculate penalty based on what they have
    const res = this.validateDeclaration(melds);
    if (res.isValid) return 0;

    // If they have a pure sequence, the pure sequence doesn't count towards penalty.
    // Actually, in rummy, if you have NO pure sequence, ALL cards count towards penalty (max 80).
    // If you have a pure sequence, valid sets/sequences don't count towards penalty.
    
    let hasPure = false;
    let validMeldCards = new Set();
    
    for (const m of melds) {
      if (this.isPureSequence(m)) hasPure = true;
    }
    
    let totalPoints = 0;
    
    if (hasPure) {
       for (const m of melds) {
         if (this.isValidMeld(m)) {
           // cards are safe
         } else {
           for(const c of m) totalPoints += this.getPoints(c);
         }
       }
    } else {
       // All cards count
       for (const m of melds) {
         for(const c of m) totalPoints += this.getPoints(c);
       }
    }

    return Math.min(80, totalPoints);
  }
}

module.exports = { MeldEngine };
