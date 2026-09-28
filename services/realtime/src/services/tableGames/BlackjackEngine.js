const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const { settleBet } = require('../gameBets');

class BlackjackEngine {
  constructor() {
    this.deck = [
      '2H','3H','4H','5H','6H','7H','8H','9H','TH','JH','QH','KH','AH',
      '2D','3D','4D','5D','6D','7D','8D','9D','TD','JD','QD','KD','AD',
      '2C','3C','4C','5C','6C','7C','8C','9C','TC','JC','QC','KC','AC',
      '2S','3S','4S','5S','6S','7S','8S','9S','TS','JS','QS','KS','AS'
    ];
  }

  // Cryptographically secure shuffle of N decks
  generateShoe(numDecks = 6) {
    let shoe = [];
    for (let i = 0; i < numDecks; i++) {
      shoe = shoe.concat([...this.deck]);
    }
    
    // Fisher-Yates shuffle using crypto for secure randomness
    for (let i = shoe.length - 1; i > 0; i--) {
      const randHex = crypto.randomBytes(4).toString('hex');
      const randInt = parseInt(randHex, 16);
      const j = randInt % (i + 1);
      [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    return shoe;
  }

  getCardValue(card) {
    const rank = card[0];
    if (['T','J','Q','K'].includes(rank)) return 10;
    if (rank === 'A') return 11;
    return parseInt(rank);
  }

  calculateHandValue(cards) {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
      if (!card) continue;
      const val = this.getCardValue(card);
      if (val === 11) aces++;
      total += val;
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return { total, isSoft: aces > 0 };
  }

  isBlackjack(cards) {
    return cards.length === 2 && this.calculateHandValue(cards).total === 21;
  }

  async createGame(userId, shoe = null) {
    shoe = shoe && shoe.length >= 20 ? shoe : this.generateShoe(6);
    return await prisma.blackjackGame.create({
      data: {
        userId,
        status: 'BETTING',
        shoe,
        dealerCards: [],
      }
    });
  }

  async getGame(gameId) {
    return await prisma.blackjackGame.findUnique({
      where: { id: gameId },
      include: { hands: true }
    });
  }

  /**
   * Deals a new round. The stake (betPaise) must already be debited through the ledger with
   * handId as the bet reference.
   */
  async dealInitialCards(gameId, betPaise, handId) {
    const game = await this.getGame(gameId);
    let shoe = game.shoe;
    
    if (shoe.length < 20) {
      // Re-shuffle if shoe is running low
      shoe = this.generateShoe(6);
    }

    // Deal 2 cards to player, 2 cards to dealer (1 hidden)
    const p1 = shoe.pop();
    const d1 = shoe.pop();
    const p2 = shoe.pop();
    const d2 = shoe.pop(); // hidden for now

    const playerHand = [p1, p2];
    const dealerCards = [d1, d2];
    
    let status = 'PLAYING';
    const pBJ = this.isBlackjack(playerHand);
    
    // Check dealer blackjack if showing Ace or 10
    let dBJ = false;
    const dVal = this.getCardValue(d1);
    if (dVal === 10 || dVal === 11) {
       dBJ = this.isBlackjack(dealerCards);
    }

    let handStatus = pBJ ? 'BLACKJACK' : 'PLAYING';
    if (pBJ && !dBJ) {
      status = 'SETTLED'; // Instant win
    } else if (pBJ && dBJ) {
      status = 'SETTLED'; // Push
    } else if (dBJ) {
      status = 'SETTLED'; // Instant dealer win
      handStatus = 'LOST';
    }

    // Create hand in DB
    await prisma.blackjackHand.create({
      data: {
        id: handId,
        gameId,
        userId: game.userId,
        cards: playerHand,
        bet: betPaise,
        status: handStatus
      }
    });

    const updatedGame = await prisma.blackjackGame.update({
      where: { id: gameId },
      data: {
        status,
        shoe,
        dealerCards,
        activeHandIndex: 0
      },
      include: { hands: true }
    });

    // If settled immediately, process payout
    if (status === 'SETTLED') {
      await this.processSettlement(updatedGame);
    }

    return updatedGame;
  }

  async hit(gameId, handId) {
    const game = await this.getGame(gameId);
    if (game.status !== 'PLAYING') throw new Error("Game not in playing state");
    
    const hand = game.hands.find(h => h.id === handId);
    if (!hand || hand.status !== 'PLAYING') throw new Error("Invalid hand for hit");

    let shoe = game.shoe;
    const card = shoe.pop();
    
    const newCards = [...hand.cards, card];
    const { total } = this.calculateHandValue(newCards);
    
    let newStatus = 'PLAYING';
    if (total > 21) {
      newStatus = 'BUST';
    } else if (total === 21) {
      newStatus = 'STAND';
    }

    await prisma.blackjackHand.update({
      where: { id: handId },
      data: { cards: newCards, status: newStatus }
    });

    await prisma.blackjackGame.update({
      where: { id: gameId },
      data: { shoe }
    });

    return this.checkNextTurn(gameId);
  }

  async stand(gameId, handId) {
    await prisma.blackjackHand.update({
      where: { id: handId },
      data: { status: 'STAND' }
    });
    return this.checkNextTurn(gameId);
  }

  async checkNextTurn(gameId) {
    let game = await this.getGame(gameId);
    const activeHand = game.hands[game.activeHandIndex];

    if (!activeHand || activeHand.status !== 'PLAYING') {
      // Move to next hand
      if (game.activeHandIndex + 1 < game.hands.length) {
        await prisma.blackjackGame.update({
          where: { id: gameId },
          data: { activeHandIndex: game.activeHandIndex + 1 }
        });
        return await this.getGame(gameId);
      } else {
        // All hands played, move to dealer turn
        return await this.playDealerTurn(gameId);
      }
    }
    return game;
  }

  async playDealerTurn(gameId) {
    let game = await this.getGame(gameId);
    let shoe = game.shoe;
    let dealerCards = game.dealerCards;
    
    // Check if all hands busted (if so, dealer doesn't need to draw)
    const allBusted = game.hands.every(h => h.status === 'BUST');
    
    if (!allBusted) {
      let { total, isSoft } = this.calculateHandValue(dealerCards);
      
      // Dealer hits on soft 17 or less than 17
      while (total < 17 || (total === 17 && isSoft)) {
        dealerCards.push(shoe.pop());
        const val = this.calculateHandValue(dealerCards);
        total = val.total;
        isSoft = val.isSoft;
      }
    }

    const updatedGame = await prisma.blackjackGame.update({
      where: { id: gameId },
      data: { status: 'SETTLED', shoe, dealerCards },
      include: { hands: true }
    });

    return await this.processSettlement(updatedGame);
  }

  async processSettlement(game) {
    const dealerVal = this.calculateHandValue(game.dealerCards).total;
    const dBJ = this.isBlackjack(game.dealerCards);

    for (const hand of game.hands) {
      const bet = BigInt(hand.bet);
      let payout = 0n;
      let newStatus = hand.status; // keeps BUST or BLACKJACK

      if (hand.status === 'BUST') {
        payout = 0n;
      } else if (hand.status === 'BLACKJACK') {
        if (dBJ) {
          payout = bet; // Push
          newStatus = 'PUSH';
        } else {
          payout = (bet * 5n) / 2n; // 3:2 payout (stake included)
        }
      } else if (dBJ) {
        newStatus = 'LOST';
      } else {
        const pVal = this.calculateHandValue(hand.cards).total;
        if (dealerVal > 21 || pVal > dealerVal) {
          payout = bet * 2n;
          newStatus = 'WON';
        } else if (pVal === dealerVal) {
          payout = bet;
          newStatus = 'PUSH';
        } else {
          newStatus = 'LOST';
        }
      }

      try {
        // Ledger first, idempotent per hand id: a hand can never be paid twice.
        await settleBet(hand.userId, bet, payout, 'blackjack', hand.id);
        await prisma.blackjackHand.update({ where: { id: hand.id }, data: { payout, status: newStatus } });
      } catch (err) {
        console.error('[Blackjack] Settlement failed for hand', hand.id, err.message);
      }
    }

    return await this.getGame(game.id);
  }

  /**
   * Public view of a game: never includes the shoe, and hides the dealer's hole card until the
   * round is settled. Amounts are in rupees.
   */
  toPublicState(game) {
    if (!game) return null;
    const settled = game.status === 'SETTLED';
    const dealerCards = (game.dealerCards || []).map((card, i) => (!settled && i === 1 ? { hidden: true } : card));
    return {
      id: game.id,
      status: game.status,
      activeHandIndex: game.activeHandIndex,
      dealerCards,
      dealerTotal: settled ? this.calculateHandValue(game.dealerCards || []).total : null,
      hands: (game.hands || []).map((h) => ({
        id: h.id,
        cards: h.cards,
        status: h.status,
        bet: Number(h.bet) / 100,
        payout: Number(h.payout || 0) / 100
      }))
    };
  }
}

module.exports = new BlackjackEngine();
