const crypto = require('crypto');

const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

class Deck {
  constructor() {
    this.cards = [];
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.initialize();
  }

  initialize() {
    this.cards = [];
    for (let suit of SUITS) {
      for (let rank of RANKS) {
        this.cards.push(rank + suit); // e.g., 'As', 'Th', '2c'
      }
    }
  }

  /**
   * Provably fair shuffle using Fisher-Yates and cryptographic hash
   */
  shuffle(clientSeed = "0000000000000000000") {
    const hash = crypto.createHmac('sha256', this.serverSeed).update(clientSeed).digest('hex');
    
    // Seeded random generator based on the hash
    let seed = parseInt(hash.slice(0, 13), 16);
    
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    return this.cards.pop();
  }

  drawMultiple(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      drawn.push(this.draw());
    }
    return drawn;
  }
}

module.exports = Deck;
