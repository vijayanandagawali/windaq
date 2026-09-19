// ===================================================
// Andar Bahar Game Engine
// ===================================================

class AndarBaharGame {
  constructor() {
    this.container = null;
    this.jokerCard = { rank: '8', suit: '♠', color: 'black' };
    this.andarCards = [];
    this.baharCards = [];
    this.selectedSide = 'ANDAR';
    this.stake = 100;
    this.isDealing = false;
  }

  mount(containerEl) {
    this.container = containerEl;
    this.andarCards = [];
    this.baharCards = [];
    this.renderLayout();
  }

  unmount() {
    this.container = null;
  }

  renderLayout() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; background: #080A12; overflow-y: auto; padding: 12px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 12px;">
          <span style="font-weight: 900; font-size: 15px; color: var(--gold);">ANDAR BAHAR FAST</span>
          <span style="font-size: 11px; color: var(--green); font-weight: 800;">LIVE DEAL</span>
        </div>

        <!-- Center Main Joker Card -->
        <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 14px;">
          <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); margin-bottom: 4px;">TARGET JOKER CARD</div>
          <div style="width: 65px; height: 95px; background: #FFF; border-radius: 8px; border: 3px solid var(--gold); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: ${this.jokerCard.color === 'red' ? '#FF3366' : '#000'}; box-shadow: 0 0 20px rgba(255,184,0,0.4);">
            ${this.jokerCard.rank}${this.jokerCard.suit}
          </div>
        </div>

        <!-- Andar vs Bahar Dealt Tracks -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <!-- ANDAR PILE -->
          <div style="background: rgba(255,51,102,0.1); border: 1px solid #FF3366; border-radius: var(--radius-md); padding: 10px; min-height: 120px; display: flex; flex-direction: column;">
            <div style="font-size: 12px; font-weight: 900; color: #FF3366; margin-bottom: 6px;">ANDAR (1.9X)</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="andar-cards-box">
              ${this.renderCardList(this.andarCards)}
            </div>
          </div>

          <!-- BAHAR PILE -->
          <div style="background: rgba(0,230,118,0.1); border: 1px solid #00E676; border-radius: var(--radius-md); padding: 10px; min-height: 120px; display: flex; flex-direction: column;">
            <div style="font-size: 12px; font-weight: 900; color: #00E676; margin-bottom: 6px;">BAHAR (2.0X)</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="bahar-cards-box">
              ${this.renderCardList(this.baharCards)}
            </div>
          </div>
        </div>

        <!-- Side Bet Selection -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <button onclick="window.andarBaharGame.selectSide('ANDAR')" style="background: ${this.selectedSide === 'ANDAR' ? '#FF3366' : 'var(--bg-card)'}; color: #FFF; border: 1px solid #FF3366; padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 14px; cursor: pointer;">
            BET ANDAR (1.9X)
          </button>
          <button onclick="window.andarBaharGame.selectSide('BAHAR')" style="background: ${this.selectedSide === 'BAHAR' ? '#00E676' : 'var(--bg-card)'}; color: ${this.selectedSide === 'BAHAR' ? '#000' : '#FFF'}; border: 1px solid #00E676; padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 14px; cursor: pointer;">
            BET BAHAR (2.0X)
          </button>
        </div>

        <!-- Stake Chips & Deal Button -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">CHIP AMOUNT</span>
            <div style="display: flex; gap: 6px;">
              ${[50, 100, 500, 1000].map(amt => `
                <div class="amount-chip ${this.stake === amt ? 'active' : ''}" onclick="window.andarBaharGame.setStake(${amt})">
                  ₹${amt}
                </div>
              `).join('')}
            </div>
          </div>
          <button class="btn-primary" onclick="window.andarBaharGame.deal()">
            DEAL CARDS (BET ₹${this.stake} ON ${this.selectedSide})
          </button>
        </div>
      </div>
    `;
  }

  renderCardList(cards) {
    if (!cards.length) return `<span style="font-size: 10px; color: var(--text-dim);">Waiting for deal...</span>`;
    return cards.map(c => `
      <div style="width: 32px; height: 46px; background: #FFF; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: ${c.color === 'red' ? '#FF3366' : '#000'};">
        ${c.rank}${c.suit}
      </div>
    `).join('');
  }

  selectSide(side) {
    this.selectedSide = side;
    this.renderLayout();
  }

  setStake(val) {
    this.stake = val;
    this.renderLayout();
  }

  deal() {
    if (this.isDealing) return;
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    try {
      window.app.walletDeduct(this.stake, `Andar Bahar (${this.selectedSide})`);
      this.isDealing = true;
      this.andarCards = [];
      this.baharCards = [];

      // Pick a random target joker
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const suits = ['♠', '♥', '♦', '♣'];
      const jokerRank = ranks[Math.floor(Math.random() * ranks.length)];
      const jokerSuit = suits[Math.floor(Math.random() * suits.length)];
      this.jokerCard = {
        rank: jokerRank,
        suit: jokerSuit,
        color: (jokerSuit === '♥' || jokerSuit === '♦') ? 'red' : 'black'
      };

      this.renderLayout();

      // Deal sequence until match
      let turn = 'ANDAR';
      const dealStep = () => {
        window.soundEngine.playCard();
        const randSuit = suits[Math.floor(Math.random() * suits.length)];
        const isMatch = Math.random() < 0.25; // 25% chance per card
        const cardRank = isMatch ? jokerRank : ranks[Math.floor(Math.random() * ranks.length)];
        const newCard = {
          rank: cardRank,
          suit: randSuit,
          color: (randSuit === '♥' || randSuit === '♦') ? 'red' : 'black'
        };

        if (turn === 'ANDAR') {
          this.andarCards.push(newCard);
          turn = 'BAHAR';
        } else {
          this.baharCards.push(newCard);
          turn = 'ANDAR';
        }

        this.renderLayout();

        if (newCard.rank === jokerRank) {
          // Winner found!
          const winningSide = (turn === 'BAHAR') ? 'ANDAR' : 'BAHAR';
          this.isDealing = false;

          if (this.selectedSide === winningSide) {
            const mult = (winningSide === 'ANDAR') ? 1.9 : 2.0;
            const winAmt = parseFloat((this.stake * mult).toFixed(2));
            window.app.walletCredit(winAmt, 'Andar Bahar', mult);
            window.soundEngine.playWin();
            alert(`🎉 JOKER MATCHED ON ${winningSide}! You won ₹${winAmt}!`);
          } else {
            alert(`Joker matched on ${winningSide}. Better luck next round!`);
          }
        } else {
          setTimeout(dealStep, 350);
        }
      };

      setTimeout(dealStep, 400);

    } catch (e) {
      alert(e.message);
      this.isDealing = false;
    }
  }
}

window.andarBaharGame = new AndarBaharGame();
