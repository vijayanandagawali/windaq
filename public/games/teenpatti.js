// ===================================================
// 20-20 Teen Patti Game Engine
// ===================================================

class TeenPattiGame {
  constructor() {
    this.container = null;
    this.selectedPlayer = 'A';
    this.stake = 100;
    this.hands = {
      playerA: [
        { rank: 'A', suit: '♠', color: 'black' },
        { rank: 'K', suit: '♠', color: 'black' },
        { rank: 'Q', suit: '♠', color: 'black' }
      ],
      playerB: [
        { rank: 'J', suit: '♥', color: 'red' },
        { rank: 'J', suit: '♦', color: 'red' },
        { rank: '9', suit: '♣', color: 'black' }
      ]
    };
  }

  mount(containerEl) {
    this.container = containerEl;
    this.renderLayout();
  }

  unmount() {
    this.container = null;
  }

  renderLayout() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; background: #07090F; overflow-y: auto; padding: 12px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 12px;">
          <span style="font-weight: 900; font-size: 15px; color: var(--gold);">20-20 TEEN PATTI</span>
          <span style="font-size: 11px; color: var(--green); font-weight: 800;">LIVE DEALER</span>
        </div>

        <!-- Felt Card Arena -->
        <div style="background: radial-gradient(circle, #0F3822 0%, #06180E 90%); border: 2px solid #1B5E39; border-radius: var(--radius-lg); padding: 16px; margin-bottom: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 16px;">
          <!-- Player A Hand -->
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 900; color: #FFF;">PLAYER A (2X)</span>
              <span style="font-size: 11px; font-weight: 800; color: var(--gold);">PURE SEQUENCE (A-K-Q)</span>
            </div>
            <div style="display: flex; gap: 8px;">
              ${this.hands.playerA.map(c => `
                <div style="width: 55px; height: 80px; background: #FFF; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: ${c.color === 'red' ? '#FF3366' : '#000'}; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                  ${c.rank}${c.suit}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Divider -->
          <div style="height: 1px; background: rgba(255,255,255,0.1);"></div>

          <!-- Player B Hand -->
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 900; color: #FFF;">PLAYER B (2X)</span>
              <span style="font-size: 11px; font-weight: 800; color: var(--text-muted);">PAIR (J-J)</span>
            </div>
            <div style="display: flex; gap: 8px;">
              ${this.hands.playerB.map(c => `
                <div style="width: 55px; height: 80px; background: #FFF; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: ${c.color === 'red' ? '#FF3366' : '#000'}; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                  ${c.rank}${c.suit}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Betting Selection Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <button onclick="window.teenPattiGame.selectPlayer('A')" style="background: ${this.selectedPlayer === 'A' ? 'var(--gold-btn)' : 'var(--bg-card)'}; color: ${this.selectedPlayer === 'A' ? '#000' : '#FFF'}; border: 1px solid var(--gold); padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 14px; cursor: pointer;">
            BET ON PLAYER A (2X)
          </button>
          <button onclick="window.teenPattiGame.selectPlayer('B')" style="background: ${this.selectedPlayer === 'B' ? 'var(--gold-btn)' : 'var(--bg-card)'}; color: ${this.selectedPlayer === 'B' ? '#000' : '#FFF'}; border: 1px solid var(--gold); padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 14px; cursor: pointer;">
            BET ON PLAYER B (2X)
          </button>
        </div>

        <!-- Chip Row & Action CTA -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">STAKE:</span>
            <div style="display: flex; gap: 6px;">
              ${[50, 100, 500, 1000].map(amt => `
                <div class="amount-chip ${this.stake === amt ? 'active' : ''}" onclick="window.teenPattiGame.setStake(${amt})">
                  ₹${amt}
                </div>
              `).join('')}
            </div>
          </div>
          <button class="btn-primary" onclick="window.teenPattiGame.deal()">
            DEAL & BET ₹${this.stake} ON PLAYER ${this.selectedPlayer}
          </button>
        </div>
      </div>
    `;
  }

  selectPlayer(p) {
    this.selectedPlayer = p;
    this.renderLayout();
  }

  setStake(val) {
    this.stake = val;
    this.renderLayout();
  }

  deal() {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    try {
      window.app.walletDeduct(this.stake, `Teen Patti (Player ${this.selectedPlayer})`);
      window.soundEngine.playCard();

      // Shuffle and deal random hands
      const suits = ['♠', '♥', '♦', '♣'];
      const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
      const getRandomCard = () => {
        const s = suits[Math.floor(Math.random() * suits.length)];
        return {
          rank: ranks[Math.floor(Math.random() * ranks.length)],
          suit: s,
          color: (s === '♥' || s === '♦') ? 'red' : 'black'
        };
      };

      this.hands.playerA = [getRandomCard(), getRandomCard(), getRandomCard()];
      this.hands.playerB = [getRandomCard(), getRandomCard(), getRandomCard()];

      // Winner determination
      const isPlayerAWin = Math.random() > 0.48;
      const winner = isPlayerAWin ? 'A' : 'B';

      this.renderLayout();

      if (this.selectedPlayer === winner) {
        const winAmt = this.stake * 2;
        window.app.walletCredit(winAmt, 'Teen Patti', 2.0);
        window.soundEngine.playWin();
        alert(`🏆 WINNER! Player ${winner} won the showdown. You won ₹${winAmt}!`);
      } else {
        alert(`Player ${winner} won the round. Better luck next hand!`);
      }
    } catch (e) {
      alert(e.message);
    }
  }
}

window.teenPattiGame = new TeenPattiGame();
