// ===================================================
// European Roulette Game (Canvas Wheel Physics + Betting Board)
// ===================================================

class RouletteGame {
  constructor() {
    this.container = null;
    this.selectedChip = 50;
    this.currentBets = [];
    this.isSpinning = false;
    this.wheelAngle = 0;
    this.ballAngle = 0;
    this.numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  }

  mount(containerEl) {
    this.container = containerEl;
    this.currentBets = [];
    this.renderLayout();
    this.initWheel();
  }

  unmount() {
    this.container = null;
  }

  renderLayout() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; background: #0A0D15; overflow-y: auto; padding: 12px;">
        <!-- Canvas Wheel Area -->
        <div style="position: relative; width: 100%; height: 210px; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, #1F263B 0%, #0A0D15 70%); border-radius: var(--radius-md); border: 1px solid var(--border); overflow: hidden; margin-bottom: 12px;">
          <canvas id="roulette-wheel-canvas" width="380" height="380" style="width: 190px; height: 190px;"></canvas>
          <div id="roulette-center-res" style="position: absolute; width: 52px; height: 52px; border-radius: 50%; background: var(--bg-card); border: 2px solid var(--gold); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: var(--gold); box-shadow: 0 0 15px rgba(255,184,0,0.4);">
            -
          </div>
        </div>

        <!-- Chip Value Selector -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--border); margin-bottom: 10px;">
          <span style="font-size: 11px; font-weight: 800; color: var(--text-muted);">CHIP SIZE:</span>
          <div style="display: flex; gap: 8px;">
            ${[10, 50, 100, 500, 1000].map(c => `
              <div class="amount-chip ${this.selectedChip === c ? 'active' : ''}" onclick="window.rouletteGame.setChip(${c})" style="border-radius: 50%; width: 34px; height: 34px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; border: 2px solid ${this.selectedChip === c ? 'var(--gold)' : 'var(--border)'};">
                ${c}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Outside Bets (Red, Black, Even, Odd) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px;">
          <button onclick="window.rouletteGame.placeBet('color', 'red')" style="background: #FF3366; color: #FFF; border: none; padding: 12px 6px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 900; cursor: pointer;">
            RED (2X)
          </button>
          <button onclick="window.rouletteGame.placeBet('color', 'black')" style="background: #111; color: #FFF; border: 1px solid var(--border); padding: 12px 6px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 900; cursor: pointer;">
            BLACK (2X)
          </button>
          <button onclick="window.rouletteGame.placeBet('even', 'even')" style="background: var(--bg-input); color: #FFF; border: 1px solid var(--border); padding: 12px 6px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 900; cursor: pointer;">
            EVEN (2X)
          </button>
          <button onclick="window.rouletteGame.placeBet('odd', 'odd')" style="background: var(--bg-input); color: #FFF; border: 1px solid var(--border); padding: 12px 6px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 900; cursor: pointer;">
            ODD (2X)
          </button>
        </div>

        <!-- Numbers Grid (0 to 36) -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px; margin-bottom: 12px;">
          <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); margin-bottom: 6px;">STRAIGHT UP (36X PAYOUT)</div>
          <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;">
            <button onclick="window.rouletteGame.placeBet('number', 0)" style="grid-column: span 6; background: #00E676; color: #000; font-weight: 900; font-size: 13px; padding: 8px; border: none; border-radius: 4px; cursor: pointer;">0 (ZERO - 36X)</button>
            ${Array.from({ length: 36 }, (_, i) => i + 1).map(num => {
              const isRed = this.redNumbers.includes(num);
              return `
                <button onclick="window.rouletteGame.placeBet('number', ${num})" style="background: ${isRed ? '#FF3366' : '#181C26'}; color: #FFF; border: 1px solid rgba(255,255,255,0.1); padding: 8px 0; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer;">
                  ${num}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Active Bets Summary & Spin Button -->
        <div style="background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px;">
            <span style="color: var(--text-muted);">Total Bet:</span>
            <span id="roulette-total-bet" style="color: var(--gold); font-weight: 800;">₹0</span>
          </div>
          <div id="roulette-active-bets" style="font-size: 11px; color: var(--text-dim); max-height: 45px; overflow-y: auto;">
            No bets placed yet. Tap any outcome to place chips!
          </div>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button onclick="window.rouletteGame.clearBets()" style="background: var(--bg-card); border: 1px solid var(--border); color: var(--text-muted); padding: 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 800; cursor: pointer;">
              CLEAR
            </button>
            <button id="roulette-spin-btn" onclick="window.rouletteGame.spin()" class="btn-primary" style="flex: 1;">
              SPIN WHEEL
            </button>
          </div>
        </div>
      </div>
    `;
  }

  setChip(val) {
    this.selectedChip = val;
    this.renderLayout();
    this.initWheel();
  }

  placeBet(type, value) {
    if (this.isSpinning) return;
    this.currentBets.push({ type, value, amount: this.selectedChip });
    window.soundEngine.playCoin();
    this.updateBetsUI();
  }

  clearBets() {
    if (this.isSpinning) return;
    this.currentBets = [];
    this.updateBetsUI();
  }

  updateBetsUI() {
    const totalEl = document.getElementById('roulette-total-bet');
    const listEl = document.getElementById('roulette-active-bets');
    if (!totalEl || !listEl) return;

    let sum = 0;
    const summaries = this.currentBets.map(b => {
      sum += b.amount;
      return `${b.type.toUpperCase()}:${b.value} (₹${b.amount})`;
    });

    totalEl.innerText = `₹${sum}`;
    listEl.innerText = summaries.length ? summaries.join(', ') : 'No bets placed yet.';
  }

  initWheel() {
    const canvas = document.getElementById('roulette-wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    this.drawWheel(ctx, 0);
  }

  drawWheel(ctx, angle) {
    const w = 380;
    const h = 380;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 180;
    const slice = (Math.PI * 2) / this.numbers.length;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    for (let i = 0; i < this.numbers.length; i++) {
      const num = this.numbers[i];
      let color = '#111';
      if (num === 0) color = '#00E676';
      else if (this.redNumbers.includes(num)) color = '#FF3366';

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, i * slice, (i + 1) * slice);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Number text
      ctx.save();
      ctx.rotate((i + 0.5) * slice);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 12px Outfit';
      ctx.textAlign = 'right';
      ctx.fillText(num.toString(), radius - 12, 4);
      ctx.restore();
    }

    ctx.restore();
  }

  async spin() {
    if (this.isSpinning) return;
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    if (!this.currentBets.length) {
      alert('Please place at least one bet chip before spinning!');
      return;
    }

    const spinBtn = document.getElementById('roulette-spin-btn');
    spinBtn.disabled = true;
    spinBtn.innerText = 'SPINNING...';
    this.isSpinning = true;

    try {
      const res = await fetch('/api/v1/games/roulette/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          bets: this.currentBets
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Spin failed');
        this.isSpinning = false;
        spinBtn.disabled = false;
        spinBtn.innerText = 'SPIN WHEEL';
        return;
      }

      // Animate Wheel
      const canvas = document.getElementById('roulette-wheel-canvas');
      const ctx = canvas.getContext('2d');
      let currentAngle = 0;
      let speed = 0.35;
      const targetNumber = data.outcome.number;

      const spinInterval = setInterval(() => {
        currentAngle += speed;
        speed *= 0.985;
        this.drawWheel(ctx, currentAngle);
        window.soundEngine.playSpinTick();

        if (speed < 0.005) {
          clearInterval(spinInterval);
          this.isSpinning = false;
          spinBtn.disabled = false;
          spinBtn.innerText = 'SPIN WHEEL';

          const centerRes = document.getElementById('roulette-center-res');
          centerRes.innerText = targetNumber;
          centerRes.style.background = data.outcome.color === 'red' ? '#FF3366' : (data.outcome.color === 'green' ? '#00E676' : '#111');
          centerRes.style.color = '#FFF';

          window.app.updateBalance(data.newBalance);

          if (data.totalWin > 0) {
            window.soundEngine.playWin();
            alert(`🎉 WINNER! Result was ${targetNumber} (${data.outcome.color}). You won ₹${data.totalWin}!`);
          } else {
            alert(`Result: ${targetNumber} (${data.outcome.color}). Better luck next spin!`);
          }
          this.clearBets();
        }
      }, 30);

    } catch (e) {
      alert('Error during roulette spin');
      this.isSpinning = false;
      spinBtn.disabled = false;
      spinBtn.innerText = 'SPIN WHEEL';
    }
  }
}

window.rouletteGame = new RouletteGame();
