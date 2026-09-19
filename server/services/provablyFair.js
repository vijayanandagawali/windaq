const crypto = require('crypto');

class ProvablyFair {
  // Generate high-entropy 64-char hex server seed
  generateServerSeed() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate SHA-256 hash of server seed (published BEFORE betting closes)
  hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  // Calculate Aviator crash multiplier using standard HMAC-SHA256
  generateCrashMultiplier(serverSeed, clientSeed = 'global_client_seed_2026', nonce = 1, rtpMode = 'BALANCED') {
    const message = `${clientSeed}:${nonce}`;
    const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');

    // Configurable house edge
    const houseEdgeMod = rtpMode === 'FAIR' ? 50 : (rtpMode === 'HOUSE_EDGE' ? 20 : 33);
    const intVal = parseInt(hmac.substring(0, 8), 16);
    if (intVal % houseEdgeMod === 0) {
      return 1.00;
    }

    // 100 / (100 - X) formula with 52-bit float division
    const h = parseInt(hmac.substring(0, 13), 16);
    const e = Math.pow(2, 52);
    const multiplier = Math.floor((100 * e - h) / (e - h)) / 100;

    return Math.max(1.01, parseFloat(multiplier.toFixed(2)));
  }

  // Deterministic Color Prediction Outcome (Number 0-9, Color Red/Green/Violet)
  generateColorOutcome(serverSeed, periodId) {
    const hmac = crypto.createHmac('sha256', serverSeed).update(`WINGO:${periodId}`).digest('hex');
    const num = parseInt(hmac.substring(0, 8), 16) % 10;

    let color = 'green';
    if ([1, 3, 7, 9].includes(num)) color = 'green';
    else if ([2, 4, 6, 8].includes(num)) color = 'red';
    else if (num === 0) color = 'violet-red';
    else if (num === 5) color = 'violet-green';

    return {
      number: num,
      color,
      size: num >= 5 ? 'Big' : 'Small',
      hmac
    };
  }

  // Deterministic Card Deck Shuffler using HMAC-SHA256 PRNG (for Andar Bahar & Teen Patti)
  generateShuffledDeck(serverSeed, roundId) {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit, value: ranks.indexOf(rank) + 2 });
      }
    }

    // Fisher-Yates with HMAC PRNG
    const hmac = crypto.createHmac('sha256', serverSeed).update(`DECK:${roundId}`).digest('hex');
    for (let i = deck.length - 1; i > 0; i--) {
      const offset = (deck.length - 1 - i) * 4;
      const sub = hmac.substring(offset % 60, (offset % 60) + 4);
      const j = parseInt(sub, 16) % (i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  // Standalone Verification Tool: Player inputs serverSeed, clientSeed, nonce to verify result
  verifyOutcome(serverSeed, clientSeed, nonce, expectedMultiplier) {
    const calc = this.generateCrashMultiplier(serverSeed, clientSeed, nonce);
    const hash = this.hashServerSeed(serverSeed);
    return {
      verified: Math.abs(calc - expectedMultiplier) < 0.01,
      calculatedMultiplier: calc,
      expectedMultiplier: expectedMultiplier,
      serverSeedHash: hash
    };
  }
}

module.exports = new ProvablyFair();
