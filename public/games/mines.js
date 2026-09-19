// ===================================================
// Mines 5x5 Interactive Game Engine
// ===================================================

class MinesGame {
  constructor() {
    this.container = null;
    this.stake = 100;
    this.mineCount = 3;
    this.isPlaying = false;
    this.grid = Array(25).fill(null); // 'gem', 'mine', or null
    this.currentMultiplier = 1.00;
  }

  mount(containerEl) {
    this.container = containerEl;
    this.isPlaying = false;
    this.grid = Array(25).fill(null);
    this.renderLayout();
  }

  unmount() {
    this.container = null;
  }

  renderLayout() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; background: #080B12; overflow-y: auto; padding: 12px;">
        <!-- Header Controls -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 12px;">
          <div>
            <div style="font-size: 10px; color: var(--text-dim); font-weight: 800;">MINES COUNT:</div>
            <select id="mines-count-sel" onchange="window.minesGame.setMineCount(this.value)" ${this.isPlaying ? 'disabled' : ''} style="background: var(--bg-input); color: var(--gold); border: 1px solid var(--border); padding: 4px 8px; border-radius: 4px; font-weight: 800; font-size: 13px;">
              ${[1, 2, 3, 5, 8, 10, 15, 20].map(m => `
                <option value="${m}" ${this.mineCount === m ? 'selected' : ''}>${m} MINES</option>
              `).join('')}
            </select>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: var(--text-dim); font-weight: 800;">CURRENT MULTIPLIER</div>
            <div id="mines-mult-display" style="font-size: 20px; font-weight: 900; color: var(--green);">${this.currentMultiplier.toFixed(2)}x</div>
          </div>
        </div>

        <!-- 5x5 Tiles Grid -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; margin-bottom: 14px; box-shadow: var(--shadow-card);">
          ${Array.from({ length: 25 }).map((_, i) => {
            const state = this.grid[i];
            let content = '';
            let bg = '#171D2B';
            if (state === 'gem') {
              content = '💎';
              bg = 'rgba(0, 230, 118, 0.25)';
            } else if (state === 'mine') {
              content = '💣';
              bg = 'rgba(255, 51, 102, 0.35)';
            }
            return `
              <button onclick="window.minesGame.reveal(${i})" class="mine-tile" style="width: 100%; aspect-ratio: 1/1; background: ${bg}; border: 1px solid var(--border-highlight); border-radius: 8px; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">
                ${content}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Stake Chips & Action Controls -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">STAKE:</span>
            <div style="display: flex; gap: 6px;">
              ${[50, 100, 200, 500].map(amt => `
                <div class="amount-chip ${this.stake === amt ? 'active' : ''}" onclick="window.minesGame.setStake(${amt})">
                  ₹${amt}
                </div>
              `).join('')}
            </div>
          </div>

          ${!this.isPlaying ? `
            <button class="btn-primary" onclick="window.minesGame.startGame()">
              START MINES (BET ₹${this.stake})
            </button>
          ` : `
            <button class="btn-primary" onclick="window.minesGame.cashout()" style="background: var(--green); color: #000; box-shadow: 0 4px 15px rgba(0,230,118,0.4);">
              CASHOUT ₹${(this.stake * this.currentMultiplier).toFixed(2)} (${this.currentMultiplier.toFixed(2)}x)
            </button>
          `}
        </div>
      </div>
    `;
  }

  setMineCount(val) {
    this.mineCount = parseInt(val);
  }

  setStake(val) {
    if (this.isPlaying) return;
    this.stake = val;
    this.renderLayout();
  }

  async startGame() {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    try {
      const res = await fetch('/api/v1/games/mines/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          betAmount: this.stake,
          mineCount: this.mineCount
        })
      });
      const data = await res.json();
      if (data.success) {
        window.app.updateBalance(data.newBalance);
        this.isPlaying = true;
        this.grid = Array(25).fill(null);
        this.currentMultiplier = 1.00;
        window.soundEngine.playCoin();
        this.renderLayout();
      } else {
        alert(data.error || 'Failed to start Mines');
      }
    } catch (e) {
      alert('Network error starting Mines');
    }
  }

  async reveal(index) {
    if (!this.isPlaying || this.grid[index] !== null) return;
    try {
      const res = await fetch('/api/v1/games/mines/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          cellIndex: index
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.hitMine) {
          // Exploded!
          window.soundEngine.playCrash();
          this.grid[index] = 'mine';
          (data.allMines || []).forEach(m => { this.grid[m] = 'mine'; });
          this.isPlaying = false;
          this.renderLayout();
          alert(data.message);
        } else {
          // Gem!
          window.soundEngine.playCoin();
          this.grid[index] = 'gem';
          this.currentMultiplier = data.multiplier;
          this.renderLayout();
        }
      } else {
        alert(data.error || 'Reveal failed');
      }
    } catch (e) {
      alert('Error revealing cell');
    }
  }

  async cashout() {
    if (!this.isPlaying) return;
    try {
      const res = await fetch('/api/v1/games/mines/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: window.app.currentUser.phone })
      });
      const data = await res.json();
      if (data.success) {
        window.soundEngine.playWin();
        window.app.updateBalance(data.newBalance);
        this.isPlaying = false;
        (data.allMines || []).forEach(m => { if (this.grid[m] === null) this.grid[m] = 'mine'; });
        this.renderLayout();
        alert(`🎉 CASHOUT SUCCESS! You won ₹${data.winAmount} (${data.multiplier}x)!`);
      }
    } catch (e) {
      alert('Error during cashout');
    }
  }
}

window.minesGame = new MinesGame();
