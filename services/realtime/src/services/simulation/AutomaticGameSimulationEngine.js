const crypto = require('crypto');
const provablyFair = require('../ProvablyFairService');

/**
 * Standard 52 Card Deck
 */
const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 14 = Ace
const SUIT_SYMBOLS = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
const RANK_NAMES = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };

/**
 * Helper to generate pseudo-random from hash or fallback
 */
function createRNG(serverSeed, clientSeed, nonce) {
  const hash = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  let offset = 0;

  return {
    hash,
    nextUint: (max = 100) => {
      if (offset + 8 > hash.length) {
        offset = 0;
      }
      const segment = hash.substring(offset, offset + 8);
      offset += 8;
      return parseInt(segment, 16) % max;
    },
    nextFloat: () => {
      if (offset + 8 > hash.length) {
        offset = 0;
      }
      const segment = hash.substring(offset, offset + 8);
      offset += 8;
      return (parseInt(segment, 16) % 1000000) / 1000000;
    }
  };
}

class AutomaticGameSimulationEngine {
  constructor() {
    this.name = 'AutomaticGameSimulationEngine';
    this.version = 'v1.0.0';
  }

  /**
   * Main entry point to simulate any game
   */
  async simulate(gameType, options = {}) {
    const startTime = Date.now();
    const deterministic = options.deterministic ?? false;
    const serverSeed = options.serverSeed || (deterministic ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' : crypto.randomBytes(32).toString('hex'));
    const clientSeed = options.clientSeed || (deterministic ? 'deterministic-client-seed' : crypto.randomBytes(16).toString('hex'));
    const nonce = options.nonce ?? 1;

    const rng = createRNG(serverSeed, clientSeed, nonce);
    const roundId = `sim-${gameType}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    let result;
    switch (gameType.toLowerCase()) {
      case 'roulette':
        result = this.simulateRoulette(rng, options);
        break;
      case 'dragon-tiger':
      case 'dragontiger':
        result = this.simulateDragonTiger(rng, options);
        break;
      case 'andar-bahar':
      case 'andarbahar':
        result = this.simulateAndarBahar(rng, options);
        break;
      case 'blackjack':
        result = this.simulateBlackjack(rng, options);
        break;
      case 'teen-patti':
      case 'teenpatti':
        result = this.simulateTeenPatti(rng, options);
        break;
      case 'lotto':
        result = this.simulateLotto(rng, options);
        break;
      case 'scratch':
        result = this.simulateScratch(rng, options);
        break;
      case 'slots':
        result = this.simulateSlots(rng, options);
        break;
      case 'crash':
      case 'aviator':
        result = this.simulateCrash(rng, options);
        break;
      default:
        throw new Error(`Unsupported game type for simulation: ${gameType}`);
    }

    return {
      gameType,
      roundId,
      deterministic,
      seed: {
        serverSeed,
        serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
        clientSeed,
        nonce,
        hash: rng.hash
      },
      steps: result.steps,
      outcome: result.outcome,
      payout: result.payout,
      durationMs: Date.now() - startTime
    };
  }

  // -------------------------------------------------------------
  // 1. ROULETTE: wheel → ball → result → payout → next round
  // -------------------------------------------------------------
  simulateRoulette(rng, options = {}) {
    const steps = [];
    const betMarket = options.betMarket || 'RED';
    const betAmount = options.betAmount || 100;

    // Step 1: Wheel
    const wheelSpeedRpm = 60 + rng.nextUint(30);
    steps.push({
      step: 'wheel',
      payload: { status: 'WHEEL_SPINNING', wheelSpeedRpm, direction: 'CLOCKWISE' },
      timestamp: Date.now()
    });

    // Step 2: Ball
    const ballDecayTimeMs = 3500 + rng.nextUint(1500);
    steps.push({
      step: 'ball',
      payload: { status: 'BALL_LAUNCHED', initialSpeedRps: 12, decayTimeMs: ballDecayTimeMs },
      timestamp: Date.now() + 500
    });

    // Step 3: Result
    const winningNumber = rng.nextUint(37); // 0-36
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    let color = 'GREEN';
    if (winningNumber > 0) {
      color = redNumbers.includes(winningNumber) ? 'RED' : 'BLACK';
    }
    const isEven = winningNumber > 0 && winningNumber % 2 === 0;
    const isOdd = winningNumber > 0 && winningNumber % 2 !== 0;

    steps.push({
      step: 'result',
      payload: { winningNumber, color, isEven, isOdd, pocketLanded: true },
      timestamp: Date.now() + 1000
    });

    // Step 4: Payout
    let won = false;
    let multiplier = 0;
    if (betMarket === 'RED' && color === 'RED') { won = true; multiplier = 2; }
    else if (betMarket === 'BLACK' && color === 'BLACK') { won = true; multiplier = 2; }
    else if (betMarket === 'EVEN' && isEven) { won = true; multiplier = 2; }
    else if (betMarket === 'ODD' && isOdd) { won = true; multiplier = 2; }
    else if (typeof betMarket === 'number' && betMarket === winningNumber) { won = true; multiplier = 36; }

    const payout = won ? betAmount * multiplier : 0;
    steps.push({
      step: 'payout',
      payload: { betMarket, betAmount, won, multiplier, payout },
      timestamp: Date.now() + 1500
    });

    // Step 5: Next Round
    steps.push({
      step: 'next_round',
      payload: { status: 'READY_FOR_NEXT_ROUND' },
      timestamp: Date.now() + 2000
    });

    return {
      steps,
      outcome: { winningNumber, color },
      payout
    };
  }

  // -------------------------------------------------------------
  // 2. DRAGON TIGER: shuffle → cards → reveal → result → settlement
  // -------------------------------------------------------------
  simulateDragonTiger(rng, options = {}) {
    const steps = [];
    const betMarket = options.betMarket || 'DRAGON';
    const betAmount = options.betAmount || 100;

    // Step 1: Shuffle
    steps.push({
      step: 'shuffle',
      payload: { shoeDecks: 8, status: 'SHOE_READY' },
      timestamp: Date.now()
    });

    // Step 2: Cards
    const dSuit = SUITS[rng.nextUint(4)];
    const dRank = RANKS[rng.nextUint(RANKS.length)];
    const tSuit = SUITS[rng.nextUint(4)];
    const tRank = RANKS[rng.nextUint(RANKS.length)];

    steps.push({
      step: 'cards',
      payload: {
        dragon: { suit: dSuit, rank: dRank, faceUp: false },
        tiger: { suit: tSuit, rank: tRank, faceUp: false }
      },
      timestamp: Date.now() + 500
    });

    // Step 3: Reveal
    const dName = `${RANK_NAMES[dRank] || dRank}${SUIT_SYMBOLS[dSuit]}`;
    const tName = `${RANK_NAMES[tRank] || tRank}${SUIT_SYMBOLS[tSuit]}`;
    steps.push({
      step: 'reveal',
      payload: { dragonCard: dName, tigerCard: tName, faceUp: true },
      timestamp: Date.now() + 1000
    });

    // Step 4: Result
    let winner = 'TIE';
    if (dRank > tRank) winner = 'DRAGON';
    else if (tRank > dRank) winner = 'TIGER';

    steps.push({
      step: 'result',
      payload: { winner, dragonRank: dRank, tigerRank: tRank },
      timestamp: Date.now() + 1500
    });

    // Step 5: Settlement
    let won = false;
    let multiplier = 0;
    if (betMarket === 'DRAGON') {
      if (winner === 'DRAGON') { won = true; multiplier = 2.0; }
      else if (winner === 'TIE') { won = true; multiplier = 0.5; }
    } else if (betMarket === 'TIGER') {
      if (winner === 'TIGER') { won = true; multiplier = 2.0; }
      else if (winner === 'TIE') { won = true; multiplier = 0.5; }
    } else if (betMarket === 'TIE') {
      if (winner === 'TIE') { won = true; multiplier = 9.0; }
    }

    const payout = won ? Math.floor(betAmount * multiplier) : 0;
    steps.push({
      step: 'settlement',
      payload: { betMarket, betAmount, winner, won, payout },
      timestamp: Date.now() + 2000
    });

    return {
      steps,
      outcome: { winner, dragon: dName, tiger: tName },
      payout
    };
  }

  // -------------------------------------------------------------
  // 3. ANDAR BAHAR: joker → cards → match → result → settlement
  // -------------------------------------------------------------
  simulateAndarBahar(rng, options = {}) {
    const steps = [];
    const betMarket = options.betMarket || 'ANDAR';
    const betAmount = options.betAmount || 100;

    // Step 1: Joker
    const jSuit = SUITS[rng.nextUint(4)];
    const jRank = RANKS[rng.nextUint(RANKS.length)];
    const jokerCard = `${RANK_NAMES[jRank] || jRank}${SUIT_SYMBOLS[jSuit]}`;
    steps.push({
      step: 'joker',
      payload: { joker: jokerCard, rank: jRank, suit: jSuit },
      timestamp: Date.now()
    });

    // Step 2: Cards
    // Simulate cards dealt alternately until rank matches joker rank
    const dealtCards = [];
    const matchIndex = rng.nextUint(16); // match occurs between 0 and 15
    for (let i = 0; i <= matchIndex; i++) {
      const side = i % 2 === 0 ? 'ANDAR' : 'BAHAR';
      const cRank = (i === matchIndex) ? jRank : RANKS[rng.nextUint(RANKS.length)];
      const cSuit = SUITS[rng.nextUint(4)];
      dealtCards.push({
        index: i + 1,
        side,
        card: `${RANK_NAMES[cRank] || cRank}${SUIT_SYMBOLS[cSuit]}`,
        isMatch: i === matchIndex
      });
    }

    steps.push({
      step: 'cards',
      payload: { totalDealt: dealtCards.length, sequence: dealtCards },
      timestamp: Date.now() + 500
    });

    // Step 3: Match
    const winningCard = dealtCards[dealtCards.length - 1];
    steps.push({
      step: 'match',
      payload: { matchedCard: winningCard.card, matchedAtCardNumber: winningCard.index, side: winningCard.side },
      timestamp: Date.now() + 1000
    });

    // Step 4: Result
    const winner = winningCard.side; // 'ANDAR' or 'BAHAR'
    steps.push({
      step: 'result',
      payload: { winner, totalCards: dealtCards.length },
      timestamp: Date.now() + 1500
    });

    // Step 5: Settlement
    let won = false;
    let multiplier = 0;
    if (betMarket === 'ANDAR' && winner === 'ANDAR') { won = true; multiplier = 1.9; }
    else if (betMarket === 'BAHAR' && winner === 'BAHAR') { won = true; multiplier = 2.0; }

    const payout = won ? Math.floor(betAmount * multiplier) : 0;
    steps.push({
      step: 'settlement',
      payload: { betMarket, betAmount, winner, won, payout },
      timestamp: Date.now() + 2000
    });

    return {
      steps,
      outcome: { joker: jokerCard, winner, totalCards: dealtCards.length },
      payout
    };
  }

  // -------------------------------------------------------------
  // 4. BLACKJACK: deal → player/dealer logic → result → settlement
  // -------------------------------------------------------------
  simulateBlackjack(rng, options = {}) {
    const steps = [];
    const betAmount = options.betAmount || 100;

    const cardVal = (rank) => (rank > 10 ? 10 : rank === 14 ? 11 : rank);
    const handTotal = (cards) => {
      let sum = cards.reduce((acc, c) => acc + cardVal(c.rank), 0);
      let aces = cards.filter(c => c.rank === 14).length;
      while (sum > 21 && aces > 0) {
        sum -= 10;
        aces--;
      }
      return sum;
    };

    // Step 1: Deal
    const playerCards = [
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] },
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] }
    ];
    const dealerCards = [
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] },
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] }
    ];

    steps.push({
      step: 'deal',
      payload: {
        playerInitial: playerCards.map(c => `${RANK_NAMES[c.rank] || c.rank}${SUIT_SYMBOLS[c.suit]}`),
        dealerUpCard: `${RANK_NAMES[dealerCards[0].rank] || dealerCards[0].rank}${SUIT_SYMBOLS[dealerCards[0].suit]}`
      },
      timestamp: Date.now()
    });

    // Step 2: Player Logic (Basic Strategy: hit if total < 17)
    let pTotal = handTotal(playerCards);
    const playerDecisions = [];
    while (pTotal < 17) {
      const newCard = { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] };
      playerCards.push(newCard);
      pTotal = handTotal(playerCards);
      playerDecisions.push({ action: 'HIT', card: `${RANK_NAMES[newCard.rank] || newCard.rank}${SUIT_SYMBOLS[newCard.suit]}`, currentTotal: pTotal });
    }
    if (pTotal <= 21) playerDecisions.push({ action: 'STAND', finalTotal: pTotal });

    steps.push({
      step: 'player_logic',
      payload: { decisions: playerDecisions, finalPlayerTotal: pTotal, isBust: pTotal > 21 },
      timestamp: Date.now() + 500
    });

    // Step 3: Dealer Logic (Dealer hits on soft 17 or total < 17)
    let dTotal = handTotal(dealerCards);
    const dealerDecisions = [];
    if (pTotal <= 21) {
      while (dTotal < 17) {
        const newCard = { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] };
        dealerCards.push(newCard);
        dTotal = handTotal(dealerCards);
        dealerDecisions.push({ action: 'HIT', card: `${RANK_NAMES[newCard.rank] || newCard.rank}${SUIT_SYMBOLS[newCard.suit]}`, currentTotal: dTotal });
      }
    }
    dealerDecisions.push({ action: dTotal > 21 ? 'BUST' : 'STAND', finalDealerTotal: dTotal });

    steps.push({
      step: 'dealer_logic',
      payload: {
        holeCard: `${RANK_NAMES[dealerCards[1].rank] || dealerCards[1].rank}${SUIT_SYMBOLS[dealerCards[1].suit]}`,
        decisions: dealerDecisions,
        finalDealerTotal: dTotal,
        isBust: dTotal > 21
      },
      timestamp: Date.now() + 1000
    });

    // Step 4: Result
    let outcome = 'LOSS';
    const isPlayerBJ = playerCards.length === 2 && pTotal === 21;
    const isDealerBJ = dealerCards.length === 2 && dTotal === 21;

    if (pTotal > 21) outcome = 'BUST_LOSS';
    else if (isPlayerBJ && !isDealerBJ) outcome = 'BLACKJACK';
    else if (dTotal > 21) outcome = 'WIN';
    else if (pTotal > dTotal) outcome = 'WIN';
    else if (pTotal === dTotal) outcome = 'PUSH';
    else outcome = 'LOSS';

    steps.push({
      step: 'result',
      payload: { outcome, playerTotal: pTotal, dealerTotal: dTotal },
      timestamp: Date.now() + 1500
    });

    // Step 5: Settlement
    let payout = 0;
    if (outcome === 'BLACKJACK') payout = Math.floor(betAmount * 2.5); // 3:2
    else if (outcome === 'WIN') payout = betAmount * 2;
    else if (outcome === 'PUSH') payout = betAmount;

    steps.push({
      step: 'settlement',
      payload: { betAmount, outcome, payout },
      timestamp: Date.now() + 2000
    });

    return {
      steps,
      outcome: { outcome, playerTotal: pTotal, dealerTotal: dTotal },
      payout
    };
  }

  // -------------------------------------------------------------
  // 5. TEEN PATTI: deal → turns → showdown → result
  // -------------------------------------------------------------
  simulateTeenPatti(rng, options = {}) {
    const steps = [];
    const betAmount = options.betAmount || 100;

    // Step 1: Deal (3 cards to Player 1, 3 cards to Player 2)
    const p1 = [
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] },
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] },
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] }
    ];
    const p2 = [
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] },
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] },
      { rank: RANKS[rng.nextUint(RANKS.length)], suit: SUITS[rng.nextUint(4)] }
    ];

    const fmtHand = (h) => h.map(c => `${RANK_NAMES[c.rank] || c.rank}${SUIT_SYMBOLS[c.suit]}`).join(' ');

    steps.push({
      step: 'deal',
      payload: { player1: fmtHand(p1), player2: fmtHand(p2) },
      timestamp: Date.now()
    });

    // Step 2: Turns
    steps.push({
      step: 'turns',
      payload: {
        actions: [
          { player: 'Player 1', action: 'BLIND', amount: betAmount },
          { player: 'Player 2', action: 'CHAAL', amount: betAmount * 2 },
          { player: 'Player 1', action: 'SEEN', amount: betAmount * 2 },
          { player: 'Player 1', action: 'SHOW', amount: betAmount * 2 }
        ],
        potSize: betAmount * 7
      },
      timestamp: Date.now() + 500
    });

    // Step 3: Showdown (Evaluate hand rankings)
    const scoreHand = (cards) => {
      const r = cards.map(c => c.rank).sort((a, b) => b - a);
      const isFlush = cards.every(c => c.suit === cards[0].suit);
      const isTrio = (r[0] === r[1] && r[1] === r[2]);
      const isStraight = (r[0] - r[1] === 1 && r[1] - r[2] === 1) || (r[0] === 14 && r[1] === 3 && r[2] === 2);

      if (isTrio) return { rankType: 'TRAIL', score: 6000 + r[0] };
      if (isStraight && isFlush) return { rankType: 'PURE_SEQUENCE', score: 5000 + r[0] };
      if (isStraight) return { rankType: 'SEQUENCE', score: 4000 + r[0] };
      if (isFlush) return { rankType: 'COLOR', score: 3000 + r[0] };
      if (r[0] === r[1] || r[1] === r[2]) return { rankType: 'PAIR', score: 2000 + (r[1]) };
      return { rankType: 'HIGH_CARD', score: 1000 + r[0] };
    };

    const s1 = scoreHand(p1);
    const s2 = scoreHand(p2);

    steps.push({
      step: 'showdown',
      payload: {
        player1Hand: { cards: fmtHand(p1), rankType: s1.rankType },
        player2Hand: { cards: fmtHand(p2), rankType: s2.rankType }
      },
      timestamp: Date.now() + 1000
    });

    // Step 4: Result
    const winner = s1.score >= s2.score ? 'Player 1' : 'Player 2';
    const potWon = betAmount * 7;
    steps.push({
      step: 'result',
      payload: { winner, potWon, winningHand: winner === 'Player 1' ? s1.rankType : s2.rankType },
      timestamp: Date.now() + 1500
    });

    return {
      steps,
      outcome: { winner, player1: s1.rankType, player2: s2.rankType },
      payout: winner === 'Player 1' ? potWon : 0
    };
  }

  // -------------------------------------------------------------
  // 6. LOTTO: ticket close → draw → result → settlement
  // -------------------------------------------------------------
  simulateLotto(rng, options = {}) {
    const steps = [];
    const userNumbers = options.userNumbers || [7, 14, 21, 28, 35, 42];
    const ticketStake = options.stake || 100;

    // Step 1: Ticket Close
    steps.push({
      step: 'ticket_close',
      payload: { userNumbers, ticketStake, status: 'ENTRIES_LOCKED' },
      timestamp: Date.now()
    });

    // Step 2: Draw
    const drawnNumbers = [];
    while (drawnNumbers.length < 6) {
      const ball = (rng.nextUint(49)) + 1;
      if (!drawnNumbers.includes(ball)) {
        drawnNumbers.push(ball);
      }
    }
    drawnNumbers.sort((a, b) => a - b);

    steps.push({
      step: 'draw',
      payload: { drawnNumbers },
      timestamp: Date.now() + 500
    });

    // Step 3: Result
    const matches = userNumbers.filter(n => drawnNumbers.includes(n));
    const matchedCount = matches.length;

    steps.push({
      step: 'result',
      payload: { drawnNumbers, userNumbers, matches, matchedCount },
      timestamp: Date.now() + 1000
    });

    // Step 4: Settlement
    const payouts = { 3: 500, 4: 5000, 5: 50000, 6: 10000000 };
    const payout = payouts[matchedCount] || 0;

    steps.push({
      step: 'settlement',
      payload: { matchedCount, ticketStake, payout, isJackpot: matchedCount === 6 },
      timestamp: Date.now() + 1500
    });

    return {
      steps,
      outcome: { drawnNumbers, matchedCount },
      payout
    };
  }

  // -------------------------------------------------------------
  // 7. SCRATCH: ticket generation → reveal → result
  // -------------------------------------------------------------
  simulateScratch(rng, options = {}) {
    const steps = [];
    const tier = options.tier || 'Gold';
    const price = tier === 'Silver' ? 50 : tier === 'Diamond' ? 1000 : 200;

    // Step 1: Ticket Generation
    const symbols = ['100', '200', '500', '1k', '2k', '20k'];
    const willWin = rng.nextUint(100) < 35; // 35% win probability
    const winSymbol = symbols[rng.nextUint(symbols.length)];

    const grid = [];
    if (willWin) {
      // 3 matching symbols
      grid.push(winSymbol, winSymbol, winSymbol);
      while (grid.length < 9) {
        grid.push(symbols[rng.nextUint(symbols.length)]);
      }
    } else {
      // Max 2 of any symbol to ensure no win
      for (let i = 0; i < 9; i++) {
        grid.push(symbols[i % symbols.length]);
      }
    }

    steps.push({
      step: 'ticket_generation',
      payload: { tier, price, totalCells: 9 },
      timestamp: Date.now()
    });

    // Step 2: Reveal
    steps.push({
      step: 'reveal',
      payload: { grid, revealedCount: 9 },
      timestamp: Date.now() + 500
    });

    // Step 3: Result
    const prizeMap = { '100': 100, '200': 200, '500': 500, '1k': 1000, '2k': 2000, '20k': 20000 };
    const payout = willWin ? (prizeMap[winSymbol] || price * 2) : 0;

    steps.push({
      step: 'result',
      payload: { isWin: willWin, winSymbol: willWin ? winSymbol : null, payout },
      timestamp: Date.now() + 1000
    });

    return {
      steps,
      outcome: { isWin: willWin, grid, winSymbol: willWin ? winSymbol : null },
      payout
    };
  }

  // -------------------------------------------------------------
  // 8. SLOTS: spin → reel animation → outcome → payout
  // -------------------------------------------------------------
  simulateSlots(rng, options = {}) {
    const steps = [];
    const stake = options.stake || 100;
    const symbols = ['CHERRY', 'LEMON', 'ORANGE', 'PLUM', 'BELL', 'BAR', 'SEVEN'];

    // Step 1: Spin
    steps.push({
      step: 'spin',
      payload: { stake, lines: 20, status: 'REELS_SPINNING' },
      timestamp: Date.now()
    });

    // Step 2: Reel Animation (5 reels x 3 rows grid)
    const grid = [];
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 5; c++) {
        row.push(symbols[rng.nextUint(symbols.length)]);
      }
      grid.push(row);
    }

    steps.push({
      step: 'reel_animation',
      payload: { grid, reelsCount: 5, rowsCount: 3 },
      timestamp: Date.now() + 500
    });

    // Step 3: Outcome (Check middle row for matching symbols)
    const middleRow = grid[1];
    let matchCount = 1;
    for (let i = 1; i < 5; i++) {
      if (middleRow[i] === middleRow[0]) matchCount++;
      else break;
    }

    const payTable = {
      'SEVEN': { 3: 10, 4: 50, 5: 250 },
      'BAR': { 3: 5, 4: 25, 5: 100 },
      'BELL': { 3: 3, 4: 15, 5: 50 },
      'CHERRY': { 3: 2, 4: 8, 5: 20 },
      'LEMON': { 3: 2, 4: 8, 5: 20 },
      'ORANGE': { 3: 2, 4: 8, 5: 20 },
      'PLUM': { 3: 2, 4: 8, 5: 20 }
    };

    const multiplier = (payTable[middleRow[0]] && payTable[middleRow[0]][matchCount]) || 0;
    const payout = stake * multiplier;

    steps.push({
      step: 'outcome',
      payload: {
        winningLine: matchCount >= 3 ? middleRow[0] : null,
        matchCount,
        multiplier
      },
      timestamp: Date.now() + 1000
    });

    // Step 4: Payout
    steps.push({
      step: 'payout',
      payload: { stake, multiplier, payout, won: payout > 0 },
      timestamp: Date.now() + 1500
    });

    return {
      steps,
      outcome: { grid, winningSymbol: matchCount >= 3 ? middleRow[0] : null, matchCount },
      payout
    };
  }

  // -------------------------------------------------------------
  // 9. CRASH: round → multiplier → crash → settlement
  // -------------------------------------------------------------
  simulateCrash(rng, options = {}) {
    const steps = [];
    const betAmount = options.betAmount || 100;
    const autoCashout = options.autoCashout || 2.0;

    // Step 1: Round initialization & Crash point derivation
    // Provably fair crash point formula: 100 / (100 - e)
    const e = rng.nextFloat() * 100;
    const crashPoint = Math.max(1.00, parseFloat((100 / (100 - Math.min(e, 99.0))).toFixed(2)));

    steps.push({
      step: 'round',
      payload: { crashPoint, status: 'COUNTDOWN_ACTIVE' },
      timestamp: Date.now()
    });

    // Step 2: Multiplier trajectory
    const samplePoints = [1.00];
    let current = 1.00;
    while (current < crashPoint) {
      current = parseFloat((current * 1.15).toFixed(2));
      if (current < crashPoint) samplePoints.push(current);
      else break;
    }
    samplePoints.push(crashPoint);

    steps.push({
      step: 'multiplier',
      payload: { trajectory: samplePoints, maxSamplePoints: samplePoints.length },
      timestamp: Date.now() + 500
    });

    // Step 3: Crash
    steps.push({
      step: 'crash',
      payload: { crashPoint, status: 'CRASHED' },
      timestamp: Date.now() + 1000
    });

    // Step 4: Settlement
    const cashedOut = autoCashout <= crashPoint;
    const payout = cashedOut ? Math.floor(betAmount * autoCashout) : 0;

    steps.push({
      step: 'settlement',
      payload: { betAmount, autoCashout, crashPoint, cashedOut, payout },
      timestamp: Date.now() + 1500
    });

    return {
      steps,
      outcome: { crashPoint, cashedOut },
      payout
    };
  }
}

module.exports = new AutomaticGameSimulationEngine();
