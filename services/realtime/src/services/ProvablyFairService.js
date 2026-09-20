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
   * Derives Andar Bahar Result
   * A simplified approximation for the sake of the engine: picks Joker, then determines which side hits first.
   */
  deriveAndarBaharResult(serverSeed, clientSeed, nonce = 0) {
    const hash = this._generateHash(serverSeed, clientSeed, nonce);
    
    const SUITS = ['S', 'H', 'D', 'C'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    // Pick Joker
    const jHex = hash.substring(0, 4);
    const jRankIdx = parseInt(jHex, 16) % RANKS.length;
    const jokerCard = { suit: SUITS[parseInt(jHex, 16) % 4], rank: RANKS[jRankIdx] };

    // We'll use the next hex segments to simulate dealing until the rank matches.
    // For provable fairness without simulating a 52 card deck pop sequence entirely, 
    // we determine the winner by whether the first match index in a generated sequence is even (Andar) or odd (Bahar).
    const sequenceHex = hash.substring(4, 20); // 16 chars
    const matchIdx = parseInt(sequenceHex, 16) % 20; // simulate match happening between 1st and 20th card
    
    const winner = matchIdx % 2 === 0 ? 'ANDAR' : 'BAHAR';
    const totalCards = matchIdx + 1;

    return { outcome: { jokerCard, winner, totalCards }, hash, version: this.version };
  }
}

module.exports = new ProvablyFairService();
