const crypto = require('crypto');

class GameEngine {
  constructor() {
    this.rtpMode = 'fair'; // 'fair' (97%), 'admin_profit' (75%), 'player_win' (115%)
    this.houseMargin = 0.04;

    // Aviator State
    this.aviatorState = {
      roundId: 1001,
      status: 'WAITING', // WAITING, FLYING, CRASHED
      multiplier: 1.00,
      crashPoint: 2.15,
      startTime: 0,
      history: [1.45, 2.80, 1.12, 14.50, 3.25, 1.05, 5.60, 2.10],
      bets: new Map() // phone -> { amount, cashoutMult, cashedOut: bool }
    };

    // Wingo / Color Prediction State (60s round)
    this.wingoState = {
      periodId: 20260919001,
      timeLeft: 60,
      status: 'BETTING', // BETTING, LOCKED, RESULT
      history: [
        { period: 20260919000, number: 7, color: 'green', size: 'Big' },
        { period: 20260918999, number: 2, color: 'red', size: 'Small' },
        { period: 20260918998, number: 0, color: 'violet-red', size: 'Small' },
        { period: 20260918997, number: 5, color: 'violet-green', size: 'Big' },
        { period: 20260918996, number: 9, color: 'green', size: 'Big' }
      ],
      bets: [] // { phone, type: 'green'|'red'|'violet'|'0'-'9'|'big'|'small', amount }
    };

    // Dragon vs Tiger State
    this.dvtState = {
      roundId: 501,
      timeLeft: 15,
      status: 'BETTING',
      lastWinner: 'DRAGON',
      history: ['D', 'T', 'D', 'D', 'T', 'TIE', 'D', 'T', 'D'],
      cards: { dragon: null, tiger: null },
      bets: []
    };

    // Teen Patti State
    this.teenPattiState = {
      roundId: 701,
      timeLeft: 20,
      status: 'BETTING',
      history: ['PLAYER A', 'PLAYER B', 'PLAYER A', 'PLAYER A'],
      hands: { playerA: [], playerB: [] },
      winner: null,
      bets: []
    };

    // Sports / Cricket Live Match Simulator
    this.cricketMatches = [
      {
        id: 'cric_1',
        teams: 'India vs Australia',
        tournament: 'ICC World T20 Super 8',
        score: 'IND 184/3 (17.2 ov)',
        status: 'LIVE',
        target: 'Target: 215',
        backIndia: 1.62,
        layIndia: 1.64,
        backAus: 2.50,
        layAus: 2.56
      },
      {
        id: 'cric_2',
        teams: 'Chennai Super Kings vs Mumbai Indians',
        tournament: 'Indian Premier League (IPL)',
        score: 'CSK 92/2 (9.4 ov)',
        status: 'LIVE',
        target: '1st Innings',
        backIndia: 1.88,
        layIndia: 1.90,
        backAus: 2.05,
        layAus: 2.08
      }
    ];

    this.initProvablyFairSeeds();
    this.startRoundLoops();
  }

  setRtpMode(mode) {
    if (['fair', 'admin_profit', 'player_win'].includes(mode)) {
      this.rtpMode = mode;
      console.log(`[RTP System] RTP Mode set to: ${mode}`);
    }
  }

  initProvablyFairSeeds() {
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.clientSeed = 'global_client_seed_2026';
    this.nonce = 1;
  }

  generateProvablyFairFloat() {
    const hmac = crypto.createHmac('sha256', this.serverSeed);
    hmac.update(`${this.clientSeed}:${this.nonce++}`);
    const hash = hmac.digest('hex');
    const sub = hash.substring(0, 8);
    const intVal = parseInt(sub, 16);
    return intVal / 0xffffffff;
  }

  /* --- AVIATOR CRASH LOGIC --- */
  generateNextCrashMultiplier() {
    const raw = this.generateProvablyFairFloat();
    let mult = 1.00;

    if (this.rtpMode === 'admin_profit') {
      // 30% chance of instant crash < 1.20x
      if (Math.random() < 0.35) {
        return parseFloat((1.01 + Math.random() * 0.20).toFixed(2));
      }
      mult = 0.90 / (1 - raw);
    } else if (this.rtpMode === 'player_win') {
      // higher multipliers
      mult = 1.20 / (1 - raw * 0.92);
    } else {
      // Standard fair formula: 97% RTP
      if (Math.random() < 0.03) return 1.00; // 3% instant crash
      mult = 0.97 / (1 - raw);
    }

    mult = Math.max(1.01, Math.min(mult, 800.00));
    return parseFloat(mult.toFixed(2));
  }

  /* --- WINGO / COLOR PREDICTION LOGIC --- */
  determineWingoResult() {
    const num = Math.floor(Math.random() * 10); // 0 to 9
    let color = '';
    if (num === 0) color = 'violet-red';
    else if (num === 5) color = 'violet-green';
    else if ([1, 3, 7, 9].includes(num)) color = 'green';
    else color = 'red';

    const size = num >= 5 ? 'Big' : 'Small';
    return { number: num, color, size };
  }

  /* --- CARD GENERATOR & DECK --- */
  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const s of suits) {
      for (const r of ranks) {
        deck.push({
          suit: s,
          rank: r,
          color: (s === '♥' || s === '♦') ? 'red' : 'black',
          value: ranks.indexOf(r) + 2
        });
      }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  /* --- ROULETTE LOGIC --- */
  spinRoulette() {
    const number = Math.floor(Math.random() * 37); // 0-36
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    let color = 'green';
    if (redNumbers.includes(number)) color = 'red';
    else if (number !== 0) color = 'black';

    return {
      number,
      color,
      isEven: number !== 0 && number % 2 === 0,
      isOdd: number !== 0 && number % 2 !== 0,
      dozen: number === 0 ? 0 : Math.ceil(number / 12)
    };
  }

  /* --- MINES GAME LOGIC --- */
  generateMinesBoard(mineCount = 3) {
    const totalCells = 25;
    const mineIndices = new Set();
    while (mineIndices.size < mineCount) {
      mineIndices.add(Math.floor(Math.random() * totalCells));
    }
    return Array.from(mineIndices);
  }

  /* --- 777 SLOTS LOGIC --- */
  spinSlot() {
    const symbols = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣'];
    const weights = [35, 25, 18, 12, 6, 3, 1]; // 7 is rarest
    const getSymbol = () => {
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < symbols.length; i++) {
        if (rand < weights[i]) return symbols[i];
        rand -= weights[i];
      }
      return symbols[0];
    };

    const reels = [getSymbol(), getSymbol(), getSymbol()];
    let multiplier = 0;
    let isWin = false;

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      isWin = true;
      if (reels[0] === '7️⃣') multiplier = 50.0;
      else if (reels[0] === '💎') multiplier = 25.0;
      else if (reels[0] === '⭐') multiplier = 15.0;
      else if (reels[0] === '🔔') multiplier = 10.0;
      else multiplier = 5.0;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      isWin = true;
      multiplier = 1.5;
    }

    return { reels, isWin, multiplier };
  }

  /* --- BACKGROUND GAME LOOPS --- */
  startRoundLoops() {
    // 1. Aviator state machine (runs continuously)
    this.aviatorState.crashPoint = this.generateNextCrashMultiplier();
    this.aviatorState.status = 'WAITING';
    this.aviatorState.waitCountdown = 5;

    setInterval(() => {
      if (this.aviatorState.status === 'WAITING') {
        this.aviatorState.waitCountdown -= 0.1;
        if (this.aviatorState.waitCountdown <= 0) {
          this.aviatorState.status = 'FLYING';
          this.aviatorState.multiplier = 1.00;
          this.aviatorState.startTime = Date.now();
        }
      } else if (this.aviatorState.status === 'FLYING') {
        const elapsed = (Date.now() - this.aviatorState.startTime) / 1000;
        // Curve formula: e^(0.07 * t)
        this.aviatorState.multiplier = parseFloat(Math.pow(Math.E, 0.08 * elapsed).toFixed(2));

        if (this.aviatorState.multiplier >= this.aviatorState.crashPoint) {
          this.aviatorState.status = 'CRASHED';
          this.aviatorState.multiplier = this.aviatorState.crashPoint;
          this.aviatorState.history.unshift(this.aviatorState.crashPoint);
          if (this.aviatorState.history.length > 20) this.aviatorState.history.pop();
          this.aviatorState.crashWait = 3.0; // 3 sec before next round
        }
      } else if (this.aviatorState.status === 'CRASHED') {
        this.aviatorState.crashWait -= 0.1;
        if (this.aviatorState.crashWait <= 0) {
          this.aviatorState.roundId++;
          this.aviatorState.crashPoint = this.generateNextCrashMultiplier();
          this.aviatorState.multiplier = 1.00;
          this.aviatorState.status = 'WAITING';
          this.aviatorState.waitCountdown = 5.0;
          this.aviatorState.bets.clear();
        }
      }
    }, 100);

    // 2. Wingo 60-Second Loop
    setInterval(() => {
      this.wingoState.timeLeft -= 1;
      if (this.wingoState.timeLeft <= 0) {
        // Evaluate round
        const res = this.determineWingoResult();
        const finishedPeriod = this.wingoState.periodId;
        this.wingoState.history.unshift({
          period: finishedPeriod,
          ...res
        });
        if (this.wingoState.history.length > 25) this.wingoState.history.pop();

        // Reset for next round
        this.wingoState.periodId++;
        this.wingoState.timeLeft = 60;
        this.wingoState.bets = [];
        this.wingoLastResult = { period: finishedPeriod, ...res };
      }
    }, 1000);

    // 3. Dragon vs Tiger Fast Loop (15s)
    setInterval(() => {
      this.dvtState.timeLeft -= 1;
      if (this.dvtState.timeLeft <= 0) {
        const deck = this.createDeck();
        const dCard = deck.pop();
        const tCard = deck.pop();
        let win = 'DRAGON';
        if (tCard.value > dCard.value) win = 'TIGER';
        else if (tCard.value === dCard.value) win = 'TIE';

        this.dvtState.cards = { dragon: dCard, tiger: tCard };
        this.dvtState.lastWinner = win;
        this.dvtState.history.unshift(win === 'DRAGON' ? 'D' : (win === 'TIGER' ? 'T' : 'TIE'));
        if (this.dvtState.history.length > 20) this.dvtState.history.pop();

        this.dvtState.roundId++;
        this.dvtState.timeLeft = 15;
      }
    }, 1000);
  }
}

module.exports = new GameEngine();
