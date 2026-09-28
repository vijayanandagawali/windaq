const crypto = require('crypto');

/**
 * Provably Fair RNG Service
 * Centralized, deterministic outcome generation for all games.
 */
class ProvablyFairService {
  constructor() {
    this.version = 'v1.0.0'; // Version track algorithms
  }

  /**
   * Generates a provably fair HMAC hash.
   */
  _generateHash(serverSeed, clientSeed, nonce = 0) {
    const payload = `${clientSeed}:${nonce}`;
    return crypto.createHmac('sha256', serverSeed).update(payload).digest('hex');
  }

  /**
   * Derives a Dice result (3 dice, 1-6 each)
   */
  deriveDiceResult(serverSeed, clientSeed, nonce = 0) {
    const hash = this._generateHash(serverSeed, clientSeed, nonce);
    const dice = [];
    
    // Pick 3 hex segments (4 chars each = 16 bits), mod 6, add 1
    for (let i = 0; i < 3; i++) {
      const hex = hash.substring(i * 4, i * 4 + 4);
      const randInt = parseInt(hex, 16);
      dice.push((randInt % 6) + 1);
    }
    
    return { outcome: dice, hash, version: this.version };
  }

  /**
   * Derives a Roulette result (0-36)
   */
  deriveRouletteResult(serverSeed, clientSeed, nonce = 0) {
    const hash = this._generateHash(serverSeed, clientSeed, nonce);
    const num = parseInt(hash.substring(0, 8), 16);
    return { outcome: num % 37, hash, version: this.version };
  }

  /**
   * Derives Dragon Tiger Cards
   */
  deriveDragonTigerResult(serverSeed, clientSeed, nonce = 0) {
    const hash = this._generateHash(serverSeed, clientSeed, nonce);
    
    const SUITS = ['S', 'H', 'D', 'C'];
    const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    
    let deck = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ suit: s, rank: r });
      }
    }

    // Pick Dragon Card
    const dHex = hash.substring(0, 8);
    let dIdx = parseInt(dHex, 16) % deck.length;
    const dragon = deck.splice(dIdx, 1)[0];

    // Pick Tiger Card
    const tHex = hash.substring(8, 16);
    let tIdx = parseInt(tHex, 16) % deck.length;
    const tiger = deck.splice(tIdx, 1)[0];

    let winner = 'TIE';
    if (dragon.rank > tiger.rank) winner = 'DRAGON';
    else if (tiger.rank > dragon.rank) winner = 'TIGER';

    return { outcome: { dragon, tiger, winner }, hash, version: this.version };
  }

  /**
   * Unbiased integer in [0, max) drawn from an HMAC-SHA256 byte stream (rejection sampling, no modulo bias).
   */
  _makeIntStream(serverSeed, clientSeed, nonce) {
    let counter = 0;
    let buffer = Buffer.alloc(0);
    const nextUint32 = () => {
      if (buffer.length < 4) {
        const block = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${counter++}`).digest();
        buffer = Buffer.concat([buffer, block]);
      }
      const value = buffer.readUInt32BE(0);
      buffer = buffer.subarray(4);
      return value;
    };
    return (max) => {
      const limit = Math.floor(0x100000000 / max) * max;
      let value;
      do { value = nextUint32(); } while (value >= limit);
      return value % max;
    };
  }

  /**
   * Fisher-Yates shuffle of a 52-card deck from the seeds. Ranks are 2-14 (J=11, Q=12, K=13, A=14).
   */
  shuffleDeck(serverSeed, clientSeed, nonce = 0) {
    const nextInt = this._makeIntStream(serverSeed, clientSeed, nonce);
    const deck = [];
    for (const suit of ['S', 'H', 'D', 'C']) {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = nextInt(i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  /**
   * Derives an Andar Bahar deal from a real shuffled deck: the top card is the joker, then cards are dealt
   * alternately to Andar (first) and Bahar until one matches the joker's rank. That side wins.
   */
  deriveAndarBaharResult(serverSeed, clientSeed, nonce = 0) {
    const hash = this._generateHash(serverSeed, clientSeed, nonce);
    const deck = this.shuffleDeck(serverSeed, clientSeed, nonce);
    const joker = deck[0];
    const dealtCards = [];
    let winner = null;
    for (let i = 1; i < deck.length && !winner; i++) {
      const side = i % 2 === 1 ? 'ANDAR' : 'BAHAR';
      dealtCards.push({ side, card: deck[i] });
      if (deck[i].rank === joker.rank) winner = side;
    }
    return {
      outcome: { joker, jokerCard: joker, dealtCards, winner, totalCards: dealtCards.length, totalCardsDealt: dealtCards.length },
      hash,
      version: 'v2.0.0'
    };
  }
}

/**
 * Teen Patti 20-20: from a shuffled deck, cards are dealt alternately to Player A and Player B
 * (A gets cards 1, 3, 5; B gets 2, 4, 6), exactly as a dealer would.
 */
ProvablyFairService.prototype.deriveTeenPattiResult = function deriveTeenPattiResult(serverSeed, clientSeed, nonce = 0) {
  const { evaluate, compare } = require('./cards/teenPattiHands');
  const hash = this._generateHash(serverSeed, clientSeed, nonce);
  const deck = this.shuffleDeck(serverSeed, clientSeed, nonce);
  const playerA = [deck[0], deck[2], deck[4]];
  const playerB = [deck[1], deck[3], deck[5]];
  const cmp = compare(playerA, playerB);
  const handA = evaluate(playerA);
  const handB = evaluate(playerB);
  return {
    outcome: {
      playerA,
      playerB,
      handA: { category: handA.name, label: handA.label },
      handB: { category: handB.name, label: handB.label },
      winner: cmp > 0 ? 'A' : cmp < 0 ? 'B' : 'TIE'
    },
    hash,
    version: 'tp-2020-v1'
  };
};

module.exports = new ProvablyFairService();
