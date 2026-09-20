const crypto = require('crypto');

const TIERS = {
  Silver: {
    price: 50,
    // Weights out of 10,000
    outcomes: [
      { prize: 0, weight: 6000, symbol: null },
      { prize: 50, weight: 2500, symbol: '50' },
      { prize: 100, weight: 1000, symbol: '100' },
      { prize: 250, weight: 300, symbol: '250' },
      { prize: 500, weight: 180, symbol: '500' },
      { prize: 5000, weight: 20, symbol: '5000' },
    ]
  },
  Gold: {
    price: 200,
    outcomes: [
      { prize: 0, weight: 6500, symbol: null },
      { prize: 200, weight: 2000, symbol: '200' },
      { prize: 500, weight: 1000, symbol: '500' },
      { prize: 1000, weight: 300, symbol: '1k' },
      { prize: 2000, weight: 180, symbol: '2k' },
      { prize: 20000, weight: 20, symbol: '20k' },
    ]
  },
  Diamond: {
    price: 1000,
    outcomes: [
      { prize: 0, weight: 7000, symbol: null },
      { prize: 1000, weight: 1500, symbol: '1k' },
      { prize: 2500, weight: 1000, symbol: '2.5k' },
      { prize: 5000, weight: 300, symbol: '5k' },
      { prize: 10000, weight: 180, symbol: '10k' },
      { prize: 100000, weight: 20, symbol: '100k' },
    ]
  }
};

class ScratchEngine {
  constructor() {}

  /**
   * Generates a secure scratch ticket
   * @param {string} tier 'Silver', 'Gold', 'Diamond'
   * @returns {Object} { payout, grid, serverSeed, clientSeed, nonce }
   */
  generateTicket(tierId) {
    const tier = TIERS[tierId];
    if (!tier) throw new Error("Invalid tier");

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = 1;

    // Use hash to pick outcome
    const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
    const rngValue = parseInt(hash.substring(0, 8), 16) % 10000; // 0 to 9999

    let currentWeight = 0;
    let selectedOutcome = tier.outcomes[0]; // default lose
    for (const outcome of tier.outcomes) {
      currentWeight += outcome.weight;
      if (rngValue < currentWeight) {
        selectedOutcome = outcome;
        break;
      }
    }

    const grid = this.generateGrid(tier, selectedOutcome);

    return {
      payout: selectedOutcome.prize,
      grid: grid,
      serverSeed,
      clientSeed,
      nonce
    };
  }

  generateGrid(tier, outcome) {
    const allSymbols = tier.outcomes.filter(o => o.symbol !== null).map(o => o.symbol);
    const grid = Array(9).fill(null);
    let availableIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // Shuffle helper
    const shuffle = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    };

    if (outcome.prize > 0) {
      // It's a winner. Place exactly 3 of the winning symbol.
      shuffle(availableIndices);
      const winIndices = availableIndices.slice(0, 3);
      const remainingIndices = availableIndices.slice(3);

      winIndices.forEach(i => {
        grid[i] = outcome.symbol;
      });

      // Fill remaining 6 slots with random symbols, ensuring NO symbol appears 3 times total
      const symbolCounts = {};
      symbolCounts[outcome.symbol] = 3;

      remainingIndices.forEach(i => {
        let randomSymbol;
        do {
           randomSymbol = allSymbols[Math.floor(Math.random() * allSymbols.length)];
        } while (randomSymbol === outcome.symbol || (symbolCounts[randomSymbol] || 0) >= 2);
        
        symbolCounts[randomSymbol] = (symbolCounts[randomSymbol] || 0) + 1;
        grid[i] = randomSymbol;
      });

    } else {
      // It's a loser. Fill 9 slots, ensuring NO symbol appears 3 times. No fake near-misses (so we don't force 2 of a kind, just random < 3).
      const symbolCounts = {};
      
      availableIndices.forEach(i => {
        let randomSymbol;
        do {
           randomSymbol = allSymbols[Math.floor(Math.random() * allSymbols.length)];
        } while ((symbolCounts[randomSymbol] || 0) >= 2);
        
        symbolCounts[randomSymbol] = (symbolCounts[randomSymbol] || 0) + 1;
        grid[i] = randomSymbol;
      });
    }

    return grid;
  }
}

module.exports = { ScratchEngine, TIERS };
