const Deck = require('./Deck');
const HandEvaluator = require('./HandEvaluator');

const TABLE_STATE = {
  WAITING: 'WAITING',
  PRE_FLOP: 'PRE_FLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN'
};

class PokerTable {
  constructor(id, maxPlayers = 6, smallBlind = 10, bigBlind = 20) {
    this.id = id;
    this.maxPlayers = maxPlayers;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    
    this.players = []; // { id, name, balance, bet, folded, holeCards, isAllIn }
    this.seats = new Array(maxPlayers).fill(null);
    
    this.state = TABLE_STATE.WAITING;
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    
    this.dealerIndex = 0;
    this.turnIndex = 0;
  }

  addPlayer(player, seatIndex) {
    if (this.seats[seatIndex] !== null) throw new Error("Seat taken");
    const newPlayer = { ...player, bet: 0, folded: false, holeCards: [], isAllIn: false };
    this.seats[seatIndex] = newPlayer;
    this.players.push(newPlayer);
    return true;
  }

  startHand() {
    if (this.players.length < 2) throw new Error("Not enough players");
    
    this.state = TABLE_STATE.PRE_FLOP;
    this.deck.initialize();
    this.deck.shuffle();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = this.bigBlind;
    
    // Reset player states
    this.seats.forEach(p => {
      if (p) {
        p.bet = 0;
        p.folded = false;
        p.isAllIn = false;
        p.holeCards = this.deck.drawMultiple(2);
      }
    });

    // Handle blinds (simplified)
    this.dealerIndex = (this.dealerIndex + 1) % this.maxPlayers;
    // ... Find active players and post blinds ...
  }

  dealFlop() {
    this.state = TABLE_STATE.FLOP;
    this.deck.draw(); // burn
    this.communityCards.push(...this.deck.drawMultiple(3));
  }

  dealTurn() {
    this.state = TABLE_STATE.TURN;
    this.deck.draw(); // burn
    this.communityCards.push(this.deck.draw());
  }

  dealRiver() {
    this.state = TABLE_STATE.RIVER;
    this.deck.draw(); // burn
    this.communityCards.push(this.deck.draw());
  }

  showdown() {
    this.state = TABLE_STATE.SHOWDOWN;
    const activePlayers = this.seats.filter(p => p && !p.folded);
    
    if (activePlayers.length === 1) {
      // Last man standing wins
      return { winners: [activePlayers[0].id], type: 'FOLD' };
    }

    const winners = HandEvaluator.getWinners(activePlayers, this.communityCards);
    return { winners, type: 'SHOWDOWN' };
  }
}

module.exports = { PokerTable, TABLE_STATE };
