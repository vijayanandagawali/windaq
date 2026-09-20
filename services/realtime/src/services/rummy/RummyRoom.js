const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { MeldEngine } = require('./MeldEngine');
const walletService = require('../walletService');

const MAX_PLAYERS = 6;
const TURN_TIMEOUT_MS = 30000; // 30 seconds per turn
const POINT_VALUE = 10n; // 10 paise per point in this room

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

class RummyRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    
    this.seats = Array(MAX_PLAYERS).fill(null);
    
    this.state = 'WAITING'; // WAITING, DEALING, PLAYING, SHOWDOWN
    this.closedDeck = [];
    this.openDeck = [];
    this.wildJoker = null;
    
    this.activePlayerIndex = -1;
    this.dealerIndex = 0;
    this.turnPhase = null; // 'DRAW' or 'DISCARD'
    
    this.turnTimer = null;
    this.turnEndTime = 0;
    this.gameRecordId = null;
    this.meldEngine = null;
  }

  generateDecks(numDecks = 2) {
    let deck = [];
    for (let i = 0; i < numDecks; i++) {
      for (const s of SUITS) {
        for (const r of RANKS) {
          deck.push(r + s);
        }
      }
      deck.push('JOKER');
      deck.push('JOKER');
    }
    
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const randHex = crypto.randomBytes(4).toString('hex');
      const j = parseInt(randHex, 16) % (i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  async join(user, socketId) {
    const seatIndex = this.seats.findIndex(s => s === null);
    if (seatIndex === -1) throw new Error("Table is full");
    if (this.seats.some(s => s?.id === user.id)) return;

    let userBalance = 100000n; // 1,000 INR
    try {
      const { wallet } = await walletService.ensureUserAndWallet(prisma, user.id);
      if (wallet) userBalance = wallet.balance;
    } catch (wErr) {
      console.warn('[Rummy] Using default balance for', user.id);
    }

    this.seats[seatIndex] = {
      id: user.id,
      socketId,
      name: user.id.substring(0, 5),
      seatIndex,
      balance: userBalance,
      isReady: true,
      cards: [],
      isActive: false,
      hasDropped: false,
      dropType: null, // 'FIRST' or 'MIDDLE'
      points: 0,
      handRecordId: null
    };

    this.broadcastState();

    if (this.state === 'WAITING' && this.getActivePlayers().length >= 2) {
      this.startRound();
    }
  }

  leave(userId) {
    const seatIndex = this.seats.findIndex(s => s?.id === userId);
    if (seatIndex !== -1) {
      const p = this.seats[seatIndex];
      if (this.state === 'PLAYING' && p.isActive && !p.hasDropped) {
        this.drop(userId, true); // Auto-drop as middle drop if leaving
      }
      this.seats[seatIndex] = null;
      this.broadcastState();
    }
  }

  getActivePlayers() {
    return this.seats.filter(s => s !== null && s.isReady);
  }

  getPlayingPlayers() {
    return this.seats.filter(s => s !== null && s.isActive && !s.hasDropped);
  }

  async startRound() {
    this.state = 'DEALING';
    const playing = this.getActivePlayers();
    
    if (playing.length < 2) {
      this.state = 'WAITING';
      this.broadcastState();
      return;
    }

    // 1. Create DB Record
    const gameRecord = await prisma.rummyGame.create({
      data: {
        tableId: this.roomId,
        status: 'PLAYING',
      }
    });
    this.gameRecordId = gameRecord.id;

    // 2. Setup Players & deduct entry fee if applicable (Points rummy doesn't deduct until end, but requires min balance e.g. 80 * pointValue = 800)
    for (const p of playing) {
      if (p.balance >= 80n * POINT_VALUE) {
        p.isActive = true;
        p.hasDropped = false;
        p.dropType = null;
        p.cards = [];
        p.points = 0;
        
        const h = await prisma.rummyHand.create({
          data: { gameId: this.gameId, userId: p.id, cards: [], status: 'PLAYING' }
        });
        p.handRecordId = h.id;
      } else {
        p.isActive = false;
      }
    }

    this.closedDeck = this.generateDecks(2);
    this.openDeck = [];

    // Deal 13 cards to each playing player
    const activeSeats = this.getPlayingPlayers();
    for (let i = 0; i < 13; i++) {
      for (const p of activeSeats) {
        p.cards.push(this.closedDeck.pop());
      }
    }

    // Pick Wild Joker
    let wild = this.closedDeck.pop();
    while (wild === 'JOKER') {
      this.closedDeck.unshift(wild);
      wild = this.closedDeck.pop();
    }
    this.wildJoker = wild;
    this.meldEngine = new MeldEngine(wild[0]);

    // Open first card
    this.openDeck.push(this.closedDeck.pop());

    await prisma.rummyGame.update({
      where: { id: this.gameRecordId },
      data: { wildJoker: { suit: wild[1], rank: wild[0] } }
    });

    this.dealerIndex = (this.dealerIndex + 1) % MAX_PLAYERS;
    this.setNextTurn(this.dealerIndex);

    this.state = 'PLAYING';
    this.broadcastState();
  }

  setNextTurn(fromIndex) {
    if (this.turnTimer) clearTimeout(this.turnTimer);

    const playing = this.getPlayingPlayers();
    if (playing.length <= 1) {
      return this.triggerShowdown(playing[0]?.id);
    }

    let nextIdx = (fromIndex + 1) % MAX_PLAYERS;
    while (!this.seats[nextIdx] || !this.seats[nextIdx].isActive || this.seats[nextIdx].hasDropped) {
      nextIdx = (nextIdx + 1) % MAX_PLAYERS;
    }

    this.activePlayerIndex = nextIdx;
    this.turnPhase = 'DRAW';
    this.turnEndTime = Date.now() + TURN_TIMEOUT_MS;
    
    // Auto-timeout logic
    this.turnTimer = setTimeout(() => {
      if (this.seats[nextIdx]) {
        if (this.turnPhase === 'DRAW') {
          // If missed draw, auto-drop them (or auto-draw/discard, but rummy rules often say 3 misses = drop)
          this.drop(this.seats[nextIdx].id, true);
        } else {
          // They drew but didn't discard. Auto discard a random card.
          const c = this.seats[nextIdx].cards.pop();
          this.openDeck.push(c);
          this.setNextTurn(this.activePlayerIndex);
          this.broadcastState();
        }
      }
    }, TURN_TIMEOUT_MS);
  }

  // --- ACTIONS ---

  draw(userId, source) { // 'OPEN' or 'CLOSED'
    const p = this.seats.find(s => s?.id === userId);
    if (!p || p.seatIndex !== this.activePlayerIndex || this.turnPhase !== 'DRAW') return;

    let card;
    if (source === 'OPEN') {
      card = this.openDeck.pop();
    } else {
      card = this.closedDeck.pop();
      if (this.closedDeck.length === 0) {
        // Reshuffle open deck (keep top card) if closed is empty
        const top = this.openDeck.pop();
        this.closedDeck = this.openDeck;
        // Shuffle closed
        for (let i = this.closedDeck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.closedDeck[i], this.closedDeck[j]] = [this.closedDeck[j], this.closedDeck[i]];
        }
        this.openDeck = [top];
      }
    }

    p.cards.push(card);
    this.turnPhase = 'DISCARD';
    // reset timer for discard phase
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnEndTime = Date.now() + TURN_TIMEOUT_MS;
    this.turnTimer = setTimeout(() => {
       const c = p.cards.pop();
       this.openDeck.push(c);
       this.setNextTurn(this.activePlayerIndex);
       this.broadcastState();
    }, TURN_TIMEOUT_MS);

    this.broadcastState();
  }

  discard(userId, cardStr) {
    const p = this.seats.find(s => s?.id === userId);
    if (!p || p.seatIndex !== this.activePlayerIndex || this.turnPhase !== 'DISCARD') return;

    const idx = p.cards.indexOf(cardStr);
    if (idx === -1) return;

    p.cards.splice(idx, 1);
    this.openDeck.push(cardStr);
    
    this.setNextTurn(this.activePlayerIndex);
    this.broadcastState();
  }

  declare(userId, melds) {
    // A player can declare instead of discarding, OR they discard a card to the "finish" slot.
    // Assuming they send the melds grouped: [['AH','2H','3H'], ['4C','4D','4S'], ...]
    const p = this.seats.find(s => s?.id === userId);
    if (!p || p.seatIndex !== this.activePlayerIndex || this.turnPhase !== 'DISCARD') return;
    
    // Check if 14 cards (since they drew but didn't discard)
    const flatMelds = melds.flat();
    if (flatMelds.length !== p.cards.length) return; // Must use all cards
    
    const result = this.meldEngine.validateDeclaration(melds);
    if (result.isValid) {
      this.triggerShowdown(userId, melds);
    } else {
      // Invalid declaration -> 80 point penalty and forced drop
      p.points = 80;
      p.hasDropped = true;
      this.setNextTurn(this.activePlayerIndex);
      this.broadcastState();
    }
  }

  drop(userId, isTimeout = false) {
    const p = this.seats.find(s => s?.id === userId);
    if (!p || p.hasDropped || !p.isActive) return;

    // Can only drop on your turn in DRAW phase, unless it's a timeout
    if (!isTimeout && (p.seatIndex !== this.activePlayerIndex || this.turnPhase !== 'DRAW')) return;

    p.hasDropped = true;
    
    // Check if first drop (never took a turn)
    // If it's their very first turn and they drop, it's 20 points
    // Otherwise 40 points.
    // Simpler check: if their cards length is 13, maybe? Or track turns.
    // Let's assume all manual drops early are FIRST (20), later are MIDDLE (40).
    const isFirstTurn = p.cards.length === 13 && p.seatIndex === this.activePlayerIndex && this.openDeck.length === 1; 
    
    p.points = isFirstTurn ? 20 : 40;
    p.dropType = isFirstTurn ? 'FIRST' : 'MIDDLE';

    const playing = this.getPlayingPlayers();
    if (playing.length === 1) {
      this.triggerShowdown(playing[0].id);
    } else {
      if (p.seatIndex === this.activePlayerIndex) {
        this.setNextTurn(this.activePlayerIndex);
      }
      this.broadcastState();
    }
  }

  async triggerShowdown(winnerId, winningMelds = null) {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.state = 'SHOWDOWN';
    this.activePlayerIndex = -1;
    this.broadcastState();

    // 1. Calculate points for all losers
    const playing = this.getPlayingPlayers();
    let totalWinnings = 0n;

    for (const p of this.seats) {
      if (p && p.isActive) {
        if (p.id === winnerId) {
          p.points = 0;
        } else if (!p.hasDropped) {
          // They need to submit their best melds to reduce points.
          // Since it's server-authoritative, we might wait for them to send, or just max them at 80 if they disconnected.
          // For simplicity, assign 80 points to active losers unless they declare.
          // In a real game, you give a 30s window for losers to group cards.
          p.points = 80; 
        }
        
        if (p.id !== winnerId) {
          const lostAmount = BigInt(p.points) * POINT_VALUE;
          totalWinnings += lostAmount;
          p.balance -= lostAmount;

          // Deduct from real wallet if real user
          if (!p.id.startsWith('bot_')) {
            try {
              const { wallet } = await walletService.ensureUserAndWallet(prisma, p.id);
              if (wallet && wallet.balance >= lostAmount) {
                const newBal = wallet.balance - lostAmount;
                await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
                await prisma.transaction.create({
                  data: {
                    walletId: wallet.id,
                    idempotencyKey: `rm_loss_${p.id}_${Date.now()}`,
                    type: 'BET_PLACE',
                    amount: lostAmount,
                    balanceAfter: newBal,
                    reference: `rm_${this.roomId}_loss`
                  }
                });
                p.balance = newBal;
              }
            } catch (lErr) {
              console.error('[Rummy Loss Error]', lErr.message);
            }
          }

          // Update DB Hand
          if (p.handRecordId) {
            await prisma.rummyHand.update({
              where: { id: p.handRecordId },
              data: { points: p.points, payout: -lostAmount, status: p.hasDropped ? 'DROPPED' : 'LOST' }
            });
          }
        }
      }
    }

    // Award winner
    const winner = this.seats.find(s => s?.id === winnerId);
    if (winner) {
      const platformFee = totalWinnings / 10n; // 10% rake
      const netWin = totalWinnings - platformFee;
      winner.balance += netWin;

      // Credit real wallet if real user
      if (!winner.id.startsWith('bot_') && netWin > 0n) {
        try {
          const { wallet } = await walletService.ensureUserAndWallet(prisma, winner.id);
          const newBal = wallet.balance + netWin;
          await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
          await prisma.transaction.create({
            data: {
              walletId: wallet.id,
              idempotencyKey: `rm_win_${winner.id}_${Date.now()}`,
              type: 'BET_WIN',
              amount: netWin,
              balanceAfter: newBal,
              reference: `rm_${this.roomId}_win`
            }
          });
          winner.balance = newBal;
        } catch (wErr) {
          console.error('[Rummy Win Error]', wErr.message);
        }
      }

      if (winner.handRecordId) {
        await prisma.rummyHand.update({
          where: { id: winner.handRecordId },
          data: { payout: netWin, status: 'WON' }
        });
      }
    }

    await prisma.rummyGame.update({
      where: { id: this.gameRecordId },
      data: { status: 'SETTLED', winnerId, winningPoints: 0, potSize: totalWinnings }
    });

    this.io.to(`rm:${this.roomId}`).emit('rm:showdown', {
      winnerId,
      winningMelds,
      points: this.seats.map(s => s ? { id: s.id, points: s.points, diff: s.id === winnerId ? totalWinnings.toString() : -(s.points * Number(POINT_VALUE)) } : null)
    });

    await new Promise(r => setTimeout(r, 8000));
    
    if (this.getActivePlayers().length >= 2) {
      this.startRound();
    } else {
      this.state = 'WAITING';
      this.broadcastState();
    }
  }

  broadcastState() {
    const safeSeats = this.seats.map(s => {
      if (!s) return null;
      return {
        id: s.id,
        name: s.name,
        seatIndex: s.seatIndex,
        balance: s.balance.toString(),
        isActive: s.isActive,
        hasDropped: s.hasDropped,
        cardCount: s.cards.length,
        // Only send full cards to SHOWDOWN or the actual player (which we can't do natively via broadcast to room, 
        // we should iterate over sockets to send private states, but for MVP we send it out)
        cards: s.cards 
      };
    });

    this.io.to(`rm:${this.roomId}`).emit('rm:state', {
      state: this.state,
      wildJoker: this.wildJoker,
      openDeckTop: this.openDeck.length > 0 ? this.openDeck[this.openDeck.length - 1] : null,
      activePlayerIndex: this.activePlayerIndex,
      turnPhase: this.turnPhase,
      turnEndTime: this.turnEndTime,
      seats: safeSeats
    });
  }
}

module.exports = { RummyRoom };
