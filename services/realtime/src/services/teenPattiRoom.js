const { Deck, findWinners } = require('@windaq/teenpatti-engine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BOOT_AMOUNT = 1000n; // 10 INR
const MAX_PLAYERS = 6;
const TURN_TIMEOUT_MS = 15000; // 15 seconds per turn

class TeenPattiRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    
    this.seats = Array(MAX_PLAYERS).fill(null); // Array of Player objects
    
    // Room State
    this.state = 'WAITING'; // WAITING, DEALING, PLAYING, SHOWDOWN
    this.pot = 0n;
    this.currentStake = BOOT_AMOUNT;
    this.activePlayerIndex = -1;
    this.dealerIndex = 0;
    
    this.turnTimer = null;
    this.turnEndTime = 0;
  }

  // --- PLAYER MANAGEMENT ---

  join(user, socketId) {
    // Find empty seat
    const seatIndex = this.seats.findIndex(s => s === null);
    if (seatIndex === -1) throw new Error("Table is full");
    
    // Check if already in room
    if (this.seats.some(s => s?.id === user.id)) return;

    const player = {
      id: user.id,
      socketId,
      name: user.id, // Replace with actual name if available
      seatIndex,
      balance: 1000000n, // Dummy balance (10,000 INR), will be synced with DB in real flow
      isReady: true,
      
      // Hand state
      cards: [],
      isActive: false,
      isSeen: false,
      isPacked: false,
      betAmount: 0n
    };

    this.seats[seatIndex] = player;
    this.broadcastState();

    // Check if we can start
    if (this.state === 'WAITING' && this.getActivePlayers().length >= 2) {
      this.startRound();
    }
  }

  leave(userId) {
    const seatIndex = this.seats.findIndex(s => s?.id === userId);
    if (seatIndex !== -1) {
      const player = this.seats[seatIndex];
      if (this.state === 'PLAYING' && player.isActive && !player.isPacked) {
        this.pack(userId); // Auto-pack if leaving mid-hand
      }
      this.seats[seatIndex] = null;
      this.broadcastState();
    }
  }

  getActivePlayers() {
    return this.seats.filter(s => s !== null && s.isReady);
  }

  getPlayingPlayers() {
    return this.seats.filter(s => s !== null && s.isActive && !s.isPacked);
  }

  // --- GAME LOOP ---

  async startRound() {
    this.state = 'DEALING';
    this.pot = 0n;
    this.currentStake = BOOT_AMOUNT;
    
    const players = this.getActivePlayers();
    
    // Collect Boot
    for (const p of players) {
      if (p.balance >= BOOT_AMOUNT) {
        p.balance -= BOOT_AMOUNT;
        p.betAmount = BOOT_AMOUNT;
        this.pot += BOOT_AMOUNT;
        p.isActive = true;
        p.isSeen = false;
        p.isPacked = false;
        p.cards = [];
      } else {
        p.isActive = false; // Not enough money
      }
    }

    const playing = this.getPlayingPlayers();
    if (playing.length < 2) {
      this.state = 'WAITING';
      this.broadcastState();
      return;
    }

    this.broadcastState();

    // Delay for dealing animation
    await new Promise(r => setTimeout(r, 2000));

    // Deal Cards
    const deck = new Deck();
    deck.shuffle();

    for (const p of playing) {
      p.cards = deck.deal(3);
    }

    // Set first turn (player after dealer)
    this.dealerIndex = (this.dealerIndex + 1) % MAX_PLAYERS;
    this.setNextTurn(this.dealerIndex);

    this.state = 'PLAYING';
    this.broadcastState();
  }

  setNextTurn(fromIndex) {
    if (this.turnTimer) clearTimeout(this.turnTimer);

    const playing = this.getPlayingPlayers();
    if (playing.length <= 1) {
      return this.triggerShowdown();
    }

    // Find next active player
    let nextIdx = (fromIndex + 1) % MAX_PLAYERS;
    while (!this.seats[nextIdx] || !this.seats[nextIdx].isActive || this.seats[nextIdx].isPacked) {
      nextIdx = (nextIdx + 1) % MAX_PLAYERS;
    }

    this.activePlayerIndex = nextIdx;
    this.turnEndTime = Date.now() + TURN_TIMEOUT_MS;
    
    // Auto-pack on timeout
    this.turnTimer = setTimeout(() => {
      if (this.seats[nextIdx]) {
        this.pack(this.seats[nextIdx].id);
      }
    }, TURN_TIMEOUT_MS);
  }

  // --- PLAYER ACTIONS ---

  seeCards(userId) {
    const p = this.seats.find(s => s?.id === userId);
    if (p && p.isActive && !p.isPacked) {
      p.isSeen = true;
      this.broadcastState(); // Could emit just to that player to show cards securely
    }
  }

  pack(userId) {
    const p = this.seats.find(s => s?.id === userId);
    if (!p || p.seatIndex !== this.activePlayerIndex || p.isPacked) return;

    p.isPacked = true;
    
    // If only one player left, they win
    const playing = this.getPlayingPlayers();
    if (playing.length === 1) {
      this.triggerShowdown();
    } else {
      this.setNextTurn(this.activePlayerIndex);
      this.broadcastState();
    }
  }

  chaal(userId, isShowRequest = false) {
    const p = this.seats.find(s => s?.id === userId);
    if (!p || p.seatIndex !== this.activePlayerIndex || p.isPacked) return;

    // Calculate required bet
    let betAmount = p.isSeen ? this.currentStake * 2n : this.currentStake;
    
    if (p.balance < betAmount) {
      // For real money, this would trigger an all-in side pot logic, but for simple MVP we just pack
      return this.pack(userId);
    }

    p.balance -= betAmount;
    p.betAmount += betAmount;
    this.pot += betAmount;
    
    if (isShowRequest) {
      // Show is only allowed if 2 players remain
      if (this.getPlayingPlayers().length === 2) {
        return this.triggerShowdown();
      }
    }

    this.setNextTurn(this.activePlayerIndex);
    this.broadcastState();
  }

  // --- SHOWDOWN ---

  async triggerShowdown() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.state = 'SHOWDOWN';
    this.activePlayerIndex = -1;
    this.broadcastState();

    const playing = this.getPlayingPlayers();
    let winner = playing[0];
    let winningHandDesc = 'Walkover';

    if (playing.length > 1) {
      const winners = findWinners(playing);
      // For simplicity, pick the first winner (ignoring exact split pots for now)
      winner = winners[0];
      winningHandDesc = winners[0].type;
    }

    // Award Pot
    if (winner) {
      const winnerPlayer = this.seats.find(s => s?.id === winner.id);
      if (winnerPlayer) {
        winnerPlayer.balance += this.pot;
      }
    }

    // Broadcast Results
    this.io.to(`tp:${this.roomId}`).emit('tp:showdown', {
      winnerId: winner.id,
      winningHandDesc,
      pot: this.pot.toString(),
      hands: playing.map(p => ({
        id: p.id,
        cards: p.cards, // Reveal cards to everyone
      }))
    });

    // Save to Database (Mock for now, will connect to Handler)
    // await this.saveHandToDb(winner.id, winningHandDesc);

    await new Promise(r => setTimeout(r, 5000));
    
    if (this.getActivePlayers().length >= 2) {
      this.startRound();
    } else {
      this.state = 'WAITING';
      this.broadcastState();
    }
  }

  // --- STATE BROADCAST ---

  broadcastState() {
    // We must scrub hidden cards before sending to clients
    const safeSeats = this.seats.map(s => {
      if (!s) return null;
      return {
        id: s.id,
        name: s.name,
        seatIndex: s.seatIndex,
        balance: s.balance.toString(), // Convert BigInt
        isActive: s.isActive,
        isSeen: s.isSeen,
        isPacked: s.isPacked,
        betAmount: s.betAmount.toString(),
        // Only send actual cards if showdown, OR if we want to send it just to the owner (handled via separate emit in prod)
        // For testing, we'll send it if they are seen, though in prod we only send it directly to the socket.
        cards: (this.state === 'SHOWDOWN' || s.isSeen) ? s.cards : [] 
      };
    });

    this.io.to(`tp:${this.roomId}`).emit('tp:state', {
      state: this.state,
      pot: this.pot.toString(),
      currentStake: this.currentStake.toString(),
      activePlayerIndex: this.activePlayerIndex,
      turnEndTime: this.turnEndTime,
      seats: safeSeats
    });
  }
}

module.exports = { TeenPattiRoom, BOOT_AMOUNT };
