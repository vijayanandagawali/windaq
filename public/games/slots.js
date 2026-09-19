// ===================================================
// Classic 777 Vegas Slots Game Engine
// ===================================================

class SlotsGame {
  constructor() {
    this.container = null;
    this.bet = 50;
    this.reels = ['7️⃣', '💎', '7️⃣'];
    this.isSpinning = false;
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
      <div style="display: flex; flex-direction: column; height: 100%; background: #080A12; overflow-y: auto; padding: 12px;">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 12px;">
          <span style="font-weight: 900; font-size: 15px; color: var(--gold);">VEGAS 777 JACKPOT SLOTS</span>
          <span style="font-size: 11px; color: var(--gold); font-weight: 800;">50X MAX WIN</span>
        </div>

        <!-- Slot Machine Cabinet -->
        <div style="background: linear-gradient(180deg, #2A173B 0%, #120A1D 100%); border: 3px solid var(--gold); border-radius: var(--radius-lg); padding: 24px 16px; margin-bottom: 14px; box-shadow: 0 0 35px rgba(255,184,0,0.3); display: flex; flex-direction: column; align-items: center;">
          <!-- Reels Window -->
          <div style="display: flex; gap: 10px; background: #000; border: 2px solid var(--border); border-radius: var(--radius-md); padding: 14px 20px; box-shadow: inset 0 0 20px rgba(0,0,0,0.9); width: 100%; justify-content: center;">
            ${this.reels.map((s, idx) => `
              <div id="slot-reel-${idx}" style="width: 70px; height: 85px; background: #FFF; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 42px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                ${s}
              </div>
            `).join('')}
          </div>

          <!-- Payline Indicator -->
          <div style="margin-top: 14px; font-size: 11px; font-weight: 800; color: var(--gold); letter-spacing: 1px;">
            ✦ 7️⃣-7️⃣-7️⃣ = 50X | 💎-💎-💎 = 25X | ANY PAIR = 1.5X ✦
          </div>
        </div>

        <!-- Stake Selector & Spin Button -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">BET AMOUNT:</span>
            <div style="display: flex; gap: 6px;">
              ${[20, 50, 100, 250, 500].map(amt => `
                <div class="amount-chip ${this.bet === amt ? 'active' : ''}" onclick="window.slotsGame.setBet(${amt})">
                  ₹${amt}
                </div>
              `).join('')}
            </div>
          </div>
          <button id="slot-spin-btn" class="btn-primary" onclick="window.slotsGame.spin()" style="padding: 16px; font-size: 16px;">
            SPIN & WIN (₹${this.bet})
          </button>
        </div>
      </div>
    `;
  }

  setBet(val) {
    if (this.isSpinning) return;
    this.bet = val;
    this.renderLayout();
  }

  async spin() {
    if (this.isSpinning) return;
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }

    const spinBtn = document.getElementById('slot-spin-btn');
    spinBtn.disabled = true;
    spinBtn.innerText = 'SPINNING...';
    this.isSpinning = true;

    // Fast reel flicker animation
    const symbols = ['🍒', '🍋', '🍇', '🔔', '⭐', '💎', '7️⃣'];
    const flickerInterval = setInterval(() => {
      [0, 1, 2].forEach(i => {
        const el = document.getElementById(`slot-reel-${i}`);
        if (el) el.innerText = symbols[Math.floor(Math.random() * symbols.length)];
      });
      window.soundEngine.playSpinTick();
    }, 60);

    try {
      const res = await fetch('/api/v1/games/slots/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          betAmount: this.bet
        })
      });
      const data = await res.json();

      setTimeout(() => {
        clearInterval(flickerInterval);
        this.isSpinning = false;
        spinBtn.disabled = false;
        spinBtn.innerText = `SPIN & WIN (₹${this.bet})`;

        if (data.success) {
          this.reels = data.reels;
          [0, 1, 2].forEach(i => {
            const el = document.getElementById(`slot-reel-${i}`);
            if (el) el.innerText = data.reels[i];
          });

          window.app.updateBalance(data.newBalance);

          if (data.isWin) {
            window.soundEngine.playWin();
            alert(`🎰 JACKPOT WIN! Multiplier ${data.multiplier}x! You won ₹${data.winAmount}!`);
          }
        } else {
          alert(data.error || 'Spin failed');
        }
      }, 900);

    } catch (e) {
      clearInterval(flickerInterval);
      this.isSpinning = false;
      spinBtn.disabled = false;
      spinBtn.innerText = `SPIN & WIN (₹${this.bet})`;
      alert('Error during slot spin');
    }
  }
}

window.slotsGame = new SlotsGame();
