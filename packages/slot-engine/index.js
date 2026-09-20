const crypto = require('crypto');

// --- Symbols ---
const SYMBOLS = {
  WILD: { id: 'WILD', type: 'wild', payout: [0, 0, 50, 200, 1000] },
  SCATTER: { id: 'SCATTER', type: 'scatter', payout: [0, 0, 2, 10, 100] }, // Payouts are multipliers of total stake
  H1: { id: 'H1', type: 'high', payout: [0, 0, 40, 150, 500] },
  H2: { id: 'H2', type: 'high', payout: [0, 0, 30, 100, 300] },
  H3: { id: 'H3', type: 'high', payout: [0, 0, 20, 50, 200] },
  L1: { id: 'L1', type: 'low', payout: [0, 0, 10, 25, 100] },
  L2: { id: 'L2', type: 'low', payout: [0, 0, 10, 25, 100] },
  L3: { id: 'L3', type: 'low', payout: [0, 0, 5, 15, 50] },
  L4: { id: 'L4', type: 'low', payout: [0, 0, 5, 15, 50] }
};

// --- Reels (Simplified Weights for RNG) ---
// In a real math model, these reels have hundreds of symbols arranged carefully to achieve target RTP.
const REELS = [
  ['H1', 'L1', 'L3', 'H2', 'WILD', 'L4', 'L2', 'H3', 'L1', 'SCATTER', 'L3', 'L4', 'L2'], // Reel 1
  ['L2', 'H3', 'L4', 'L1', 'H1', 'L3', 'WILD', 'H2', 'L4', 'L2', 'L1', 'SCATTER', 'H3'], // Reel 2
  ['H2', 'L1', 'L3', 'SCATTER', 'WILD', 'L4', 'H1', 'L2', 'H3', 'L3', 'L4', 'L1', 'L2'], // Reel 3
  ['L3', 'WILD', 'L2', 'H2', 'L4', 'L1', 'H3', 'L4', 'H1', 'L2', 'SCATTER', 'L3', 'L1'], // Reel 4
  ['H3', 'L4', 'L1', 'WILD', 'H1', 'L2', 'L3', 'H2', 'L1', 'L4', 'SCATTER', 'L2', 'L3']  // Reel 5
];

// --- 20 Paylines for 5x3 Grid ---
// [0,0,0,0,0] means top row across all reels.
// [1,1,1,1,1] means middle row.
const PAYLINES = [
  [1, 1, 1, 1, 1], // 1: Mid horizontal
  [0, 0, 0, 0, 0], // 2: Top horizontal
  [2, 2, 2, 2, 2], // 3: Bottom horizontal
  [0, 1, 2, 1, 0], // 4: V shape
  [2, 1, 0, 1, 2], // 5: Inverted V
  [0, 0, 1, 2, 2], // 6: Diagonal down
  [2, 2, 1, 0, 0], // 7: Diagonal up
  [1, 0, 1, 2, 1], // 8: Wavy 1
  [1, 2, 1, 0, 1], // 9: Wavy 2
  [0, 1, 1, 1, 0], // 10: Bowl
  [2, 1, 1, 1, 2], // 11: Arch
  [1, 1, 0, 1, 1], // 12: Peak
  [1, 1, 2, 1, 1], // 13: Valley
  [0, 2, 0, 2, 0], // 14: Zigzag 1
  [2, 0, 2, 0, 2], // 15: Zigzag 2
  [1, 0, 0, 0, 1], // 16: Top hat
  [1, 2, 2, 2, 1], // 17: Bottom hat
  [0, 1, 0, 1, 0], // 18: Small zigzag top
  [2, 1, 2, 1, 2], // 19: Small zigzag bottom
  [0, 2, 2, 2, 0]  // 20: Deep bowl
];

class SlotEngine {
  constructor(config = 'v1-OceanTreasures-96RTP') {
    this.configVersion = config;
    this.reels = REELS;
    this.paylines = PAYLINES;
    this.symbols = SYMBOLS;
  }

  /**
   * Generates a 5x3 grid based on Provably Fair RNG
   */
  generateGrid(serverSeed, clientSeed, nonce) {
    const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
    
    // We need 5 stop positions for 5 reels
    const grid = [[], [], [], [], []];
    
    for (let reelIndex = 0; reelIndex < 5; reelIndex++) {
      // Use 2 bytes from hash per reel to determine stop position
      const hexSegment = hash.substring(reelIndex * 4, reelIndex * 4 + 4);
      const randInt = parseInt(hexSegment, 16);
      
      const reel = this.reels[reelIndex];
      const stopPos = randInt % reel.length;
      
      // Get the 3 symbols for this column, wrapping around if needed
      for (let row = 0; row < 3; row++) {
        const symbolPos = (stopPos + row) % reel.length;
        grid[reelIndex][row] = reel[symbolPos];
      }
    }
    
    return grid;
  }

  /**
   * Evaluates the grid against paylines and returns payout information
   * Stake is total stake. E.g. stake = 100 means 5 coins per line (20 lines).
   */
  evaluate(grid, stakeAmount) {
    const betPerLine = stakeAmount / this.paylines.length;
    let totalWin = 0;
    const winningLines = [];
    let scatterCount = 0;

    // Check Scatter wins (pay independently of paylines)
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 3; y++) {
        if (grid[x][y] === 'SCATTER') scatterCount++;
      }
    }
    if (scatterCount >= 3) {
      const scatterMultiplier = this.symbols['SCATTER'].payout[scatterCount - 1];
      const scatterWin = stakeAmount * scatterMultiplier; // Scatters usually multiply total bet
      totalWin += scatterWin;
      winningLines.push({ line: -1, symbol: 'SCATTER', count: scatterCount, winAmount: scatterWin });
    }

    // Check Payline wins
    for (let i = 0; i < this.paylines.length; i++) {
      const line = this.paylines[i];
      // line is array of 5 Y-coordinates (rows)
      let matchCount = 0;
      let matchSymbol = null;
      let hasWilds = false;

      for (let x = 0; x < 5; x++) {
        const y = line[x];
        const symbol = grid[x][y];

        if (x === 0) {
          matchSymbol = symbol;
          matchCount = 1;
          if (symbol === 'WILD') hasWilds = true;
          continue;
        }

        if (symbol === matchSymbol || symbol === 'WILD' || (matchSymbol === 'WILD' && symbol !== 'SCATTER')) {
          if (matchSymbol === 'WILD' && symbol !== 'WILD' && symbol !== 'SCATTER') {
            matchSymbol = symbol; // The wild takes the form of the first non-wild symbol
          }
          if (symbol === 'WILD') hasWilds = true;
          matchCount++;
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        // If the entire line is wild, it pays as wild. Otherwise it pays as the matched symbol.
        const payoutSymbol = matchSymbol === 'SCATTER' ? null : this.symbols[matchSymbol];
        if (payoutSymbol) {
          const multiplier = payoutSymbol.payout[matchCount - 1];
          if (multiplier > 0) {
            const winAmount = betPerLine * multiplier;
            totalWin += winAmount;
            winningLines.push({ line: i, symbol: matchSymbol, count: matchCount, winAmount });
          }
        }
      }
    }

    return {
      grid,
      winningLines,
      totalWin,
      scatterCount,
      isFreeSpinsTriggered: scatterCount >= 3
    };
  }
}

module.exports = { SlotEngine, SYMBOLS, PAYLINES, REELS };
