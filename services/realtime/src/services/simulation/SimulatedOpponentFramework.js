/**
 * SimulatedOpponentFramework.js
 * 
 * Internal TEST / SIMULATION Opponent Framework for WinDaq Automated Tables.
 * 
 * STRICT COMPLIANCE:
 * - These are simulated / AI bots strictly for sandbox testing, mechanics validation,
 *   and load simulation.
 * - NEVER presented as real human users. Distinctly badged as [SIMULATED / TEST BOT].
 * - NEVER used to fabricate fake social proof, fake deposits/withdrawals, or deceptive activity.
 * - Obey actual game rules and wager constraints in simulation mode.
 */

const crypto = require('crypto');

const SIMULATED_OPPONENTS = [
  {
    botId: 'BOT_01',
    displayName: 'SimBot-Alpha',
    avatar: 'bot_alpha',
    skillProfile: 'CONSERVATIVE',
    playStyle: 'low_risk',
    riskProfile: 'LOW',
    minBet: 10,
    maxBet: 50,
    reactionDelayRange: [800, 1500],
    preferredMarkets: {
      'dragon-tiger': ['DRAGON', 'TIGER'],
      'roulette': ['RED', 'BLACK', 'EVEN', 'ODD'],
      'andar-bahar': ['ANDAR', 'BAHAR']
    }
  },
  {
    botId: 'BOT_02',
    displayName: 'SimBot-Aggro',
    avatar: 'bot_aggro',
    skillProfile: 'AGGRESSIVE',
    playStyle: 'high_risk_seeker',
    riskProfile: 'HIGH',
    minBet: 50,
    maxBet: 250,
    reactionDelayRange: [600, 1200],
    preferredMarkets: {
      'dragon-tiger': ['TIE', 'SUITED_TIE'],
      'roulette': ['STRAIGHT', 'DOZEN'],
      'andar-bahar': ['JOKER_RED', 'JOKER_BLACK']
    }
  },
  {
    botId: 'BOT_03',
    displayName: 'SimBot-Balanced',
    avatar: 'bot_balanced',
    skillProfile: 'BALANCED',
    playStyle: 'moderate_hedger',
    riskProfile: 'MEDIUM',
    minBet: 25,
    maxBet: 100,
    reactionDelayRange: [1000, 1800],
    preferredMarkets: {
      'dragon-tiger': ['DRAGON', 'TIGER'],
      'roulette': ['COLUMN', 'DOZEN', 'RED'],
      'andar-bahar': ['ANDAR', 'BAHAR']
    }
  },
  {
    botId: 'BOT_04',
    displayName: 'SimBot-Chaos',
    avatar: 'bot_chaos',
    skillProfile: 'RANDOMIZED',
    playStyle: 'entropy_test',
    riskProfile: 'VARIABLE',
    minBet: 10,
    maxBet: 150,
    reactionDelayRange: [700, 1600],
    preferredMarkets: null // chooses dynamically
  },
  {
    botId: 'BOT_05',
    displayName: 'SimBot-Speedy',
    avatar: 'bot_speedy',
    skillProfile: 'FAST',
    playStyle: 'rapid_responder',
    riskProfile: 'MEDIUM',
    minBet: 20,
    maxBet: 80,
    reactionDelayRange: [500, 1100],
    preferredMarkets: {
      'dragon-tiger': ['DRAGON', 'TIGER'],
      'roulette': ['HIGH', 'LOW'],
      'andar-bahar': ['BAHAR']
    }
  },
  {
    botId: 'BOT_06',
    displayName: 'SimBot-Calculated',
    avatar: 'bot_calculated',
    skillProfile: 'SLOW',
    playStyle: 'deliberate_tactician',
    riskProfile: 'LOW',
    minBet: 10,
    maxBet: 60,
    reactionDelayRange: [1500, 2200],
    preferredMarkets: {
      'dragon-tiger': ['DRAGON'],
      'roulette': ['RED'],
      'andar-bahar': ['ANDAR']
    }
  },
  {
    botId: 'BOT_07',
    displayName: 'SimBot-Tactical',
    avatar: 'bot_tactical',
    skillProfile: 'TACTICAL',
    playStyle: 'trend_chaser',
    riskProfile: 'MEDIUM',
    minBet: 30,
    maxBet: 120,
    reactionDelayRange: [900, 1700],
    preferredMarkets: null
  },
  {
    botId: 'BOT_08',
    displayName: 'SimBot-Novice',
    avatar: 'bot_novice',
    skillProfile: 'BEGINNER',
    playStyle: 'simple_flat',
    riskProfile: 'LOW',
    minBet: 10,
    maxBet: 20,
    reactionDelayRange: [1200, 2000],
    preferredMarkets: {
      'dragon-tiger': ['DRAGON'],
      'roulette': ['RED'],
      'andar-bahar': ['ANDAR']
    }
  },
  {
    botId: 'BOT_09',
    displayName: 'SimBot-Pro',
    avatar: 'bot_pro',
    skillProfile: 'ADVANCED',
    playStyle: 'spread_coverage',
    riskProfile: 'MEDIUM_HIGH',
    minBet: 50,
    maxBet: 200,
    reactionDelayRange: [800, 1400],
    preferredMarkets: null
  },
  {
    botId: 'BOT_10',
    displayName: 'SimBot-QA_Asserter',
    avatar: 'bot_qa',
    skillProfile: 'TESTPLAYER',
    playStyle: 'deterministic_verifier',
    riskProfile: 'DETERMINISTIC',
    minBet: 50,
    maxBet: 50,
    reactionDelayRange: [600, 800],
    preferredMarkets: {
      'dragon-tiger': ['DRAGON'],
      'roulette': ['RED'],
      'andar-bahar': ['ANDAR']
    }
  }
];

class SimulatedOpponentFramework {
  constructor() {
    this.bots = SIMULATED_OPPONENTS.map(b => ({
      ...b,
      isSimulated: true,
      badge: 'SIMULATED_TEST_BOT',
      status: 'IDLE',
      seatIndex: null,
      tableId: null,
      testBalance: 10000,
      activeBet: null,
      disconnected: false
    }));
    this.activeTimers = new Map();
  }

  getBots() {
    return this.bots;
  }

  getBot(botId) {
    return this.bots.find(b => b.botId === botId);
  }

  /**
   * Assign a subset of bots to a table for simulation testing
   */
  assignBotsToTable(tableId, count = 3, gameId = 'dragon-tiger') {
    const available = this.bots.filter(b => !b.tableId && !b.disconnected);
    const selected = available.slice(0, Math.min(count, available.length));
    
    selected.forEach((bot, index) => {
      bot.tableId = tableId;
      bot.seatIndex = index + 1;
      bot.status = 'SEATED';
    });

    return selected;
  }

  /**
   * Release all bots from a table
   */
  releaseBotsFromTable(tableId) {
    this.bots.filter(b => b.tableId === tableId).forEach(bot => {
      bot.tableId = null;
      bot.seatIndex = null;
      bot.status = 'IDLE';
      bot.activeBet = null;
    });
    this.clearTableTimers(tableId);
  }

  /**
   * Decide natural reaction delay for a bot
   */
  getReactionDelay(bot, seededRand = null) {
    const [min, max] = bot.reactionDelayRange;
    const rand = seededRand !== null ? seededRand : Math.random();
    return Math.floor(min + rand * (max - min));
  }

  /**
   * Generate an authoritative bet action adhering to game rules
   */
  generateBotBet(bot, gameId, allowedMarkets = [], currentRoundHistory = []) {
    if (bot.disconnected) return null;

    let targetMarket = null;
    if (bot.preferredMarkets && bot.preferredMarkets[gameId]) {
      const prefs = bot.preferredMarkets[gameId];
      targetMarket = prefs[Math.floor(Math.random() * prefs.length)];
    }

    if (!targetMarket || !allowedMarkets.includes(targetMarket)) {
      targetMarket = allowedMarkets.length > 0 ? allowedMarkets[0] : 'DRAGON';
    }

    // Determine stake within bot constraints
    const stakeSteps = [10, 25, 50, 100];
    const validSteps = stakeSteps.filter(s => s >= bot.minBet && s <= bot.maxBet);
    const amount = validSteps.length > 0 
      ? validSteps[Math.floor(Math.random() * validSteps.length)] 
      : bot.minBet;

    return {
      botId: bot.botId,
      displayName: bot.displayName,
      isSimulated: true,
      market: targetMarket,
      amount,
      seatIndex: bot.seatIndex
    };
  }

  /**
   * Simulates table events for seated bots during BETTING_OPEN phase
   */
  scheduleBotActionsForRound(tableId, gameId, allowedMarkets, onBetAction, seeded = false) {
    this.clearTableTimers(tableId);
    const seated = this.bots.filter(b => b.tableId === tableId && !b.disconnected);

    seated.forEach((bot, idx) => {
      const seedVal = seeded ? (idx * 0.25) % 1 : null;
      const delay = this.getReactionDelay(bot, seedVal);

      const timerId = setTimeout(() => {
        if (bot.tableId === tableId && !bot.disconnected) {
          const bet = this.generateBotBet(bot, gameId, allowedMarkets);
          if (bet) {
            bot.activeBet = bet;
            bot.status = 'BET_PLACED';
            if (typeof onBetAction === 'function') {
              onBetAction(bet);
            }
          }
        }
      }, delay);

      const tableTimers = this.activeTimers.get(tableId) || [];
      tableTimers.push(timerId);
      this.activeTimers.set(tableId, tableTimers);
    });
  }

  /**
   * Reconnect / Disconnect simulation test methods
   */
  simulateDisconnect(botId) {
    const bot = this.getBot(botId);
    if (!bot) return false;
    bot.disconnected = true;
    bot.status = 'DISCONNECTED';
    return true;
  }

  simulateReconnect(botId) {
    const bot = this.getBot(botId);
    if (!bot) return false;
    bot.disconnected = false;
    bot.status = bot.tableId ? 'SEATED' : 'IDLE';
    return true;
  }

  simulateTimeout(botId) {
    const bot = this.getBot(botId);
    if (!bot) return false;
    bot.status = 'TIMED_OUT';
    bot.activeBet = null;
    return true;
  }

  clearTableTimers(tableId) {
    const timers = this.activeTimers.get(tableId);
    if (timers) {
      timers.forEach(t => clearTimeout(t));
      this.activeTimers.delete(tableId);
    }
  }
}

const botFramework = new SimulatedOpponentFramework();
module.exports = {
  SimulatedOpponentFramework,
  botFramework,
  SIMULATED_OPPONENTS
};
