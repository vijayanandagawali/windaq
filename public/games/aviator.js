// ===================================================
// Aviator Game Engine (Canvas + Dual Bet Panels + Multiplier)
// ===================================================

class AviatorGame {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.animationFrame = null;

    this.status = 'WAITING';
    this.multiplier = 1.00;
    this.history = [1.25, 2.45, 1.08, 5.12, 18.20, 3.40, 1.15];

    this.bet1 = { amount: 100, placed: false, cashedOut: false, autoCashout: 2.0 };
    this.bet2 = { amount: 50, placed: false, cashedOut: false, autoCashout: 5.0 };

    this.planePos = { x: 50, y: 220 };
  }

  mount(containerEl) {
    this.container = containerEl;
    this.renderLayout();
    this.initCanvas();
    this.startRenderLoop();
  }

  unmount() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.container = null;
  }

  renderLayout() {
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; background: #0E121B; overflow-y: auto;">
        <!-- Top History Bar -->
        <div style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #090C14; overflow-x: auto; border-bottom: 1px solid var(--border); scrollbar-width: none;">
          <div style="font-size: 10px; font-weight: 800; color: var(--text-dim); text-transform: uppercase;">History:</div>
          <div id="aviator-history-pills" style="display: flex; gap: 6px;">
            ${this.renderHistoryPills()}
          </div>
        </div>

        <!-- Canvas Flight Arena -->
        <div style="position: relative; width: 100%; height: 230px; background: radial-gradient(circle at bottom left, #1E122B 0%, #0B0E17 70%); overflow: hidden; border-bottom: 1px solid var(--border);">
          <canvas id="aviator-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          
          <!-- Center Multiplier Display -->
          <div id="aviator-mult-display" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none;">
            <div id="aviator-big-mult" style="font-size: 46px; font-weight: 900; color: #FFF; text-shadow: 0 0 25px rgba(255,255,255,0.4); font-family: 'Outfit', sans-serif;">
              1.00x
            </div>
            <div id="aviator-status-text" style="font-size: 12px; font-weight: 800; color: var(--gold); letter-spacing: 1px; text-transform: uppercase;">
              WAITING FOR NEXT ROUND
            </div>
          </div>
        </div>

        <!-- Dual Bet Panels -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px 12px; background: #0B0E17;">
          <!-- Panel 1 -->
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">BET 1</span>
              <div style="font-size: 11px; color: var(--gold); font-weight: 800;">₹<span id="bet1-amt-val">${this.bet1.amount}</span></div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button onclick="window.aviatorGame.adjustBet(1, -50)" style="background: var(--bg-input); border: 1px solid var(--border); color: #FFF; padding: 6px 10px; border-radius: 4px; font-weight: 800;">-</button>
              <button onclick="window.aviatorGame.adjustBet(1, 50)" style="background: var(--bg-input); border: 1px solid var(--border); color: #FFF; padding: 6px 10px; border-radius: 4px; font-weight: 800;">+</button>
              <button onclick="window.aviatorGame.setBet(1, 100)" style="background: var(--bg-input); border: 1px solid var(--border); color: var(--text-muted); font-size: 10px; padding: 6px; border-radius: 4px; font-weight: 700; flex: 1;">100</button>
              <button onclick="window.aviatorGame.setBet(1, 500)" style="background: var(--bg-input); border: 1px solid var(--border); color: var(--text-muted); font-size: 10px; padding: 6px; border-radius: 4px; font-weight: 700; flex: 1;">500</button>
            </div>
            <button id="bet1-action-btn" onclick="window.aviatorGame.handleBetAction(1)" style="background: var(--green); color: #000; border: none; padding: 12px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 15px rgba(0,230,118,0.3); transition: transform 0.1s;">
              BET ₹${this.bet1.amount}
            </button>
          </div>

          <!-- Panel 2 -->
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">BET 2</span>
              <div style="font-size: 11px; color: var(--gold); font-weight: 800;">₹<span id="bet2-amt-val">${this.bet2.amount}</span></div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button onclick="window.aviatorGame.adjustBet(2, -50)" style="background: var(--bg-input); border: 1px solid var(--border); color: #FFF; padding: 6px 10px; border-radius: 4px; font-weight: 800;">-</button>
              <button onclick="window.aviatorGame.adjustBet(2, 50)" style="background: var(--bg-input); border: 1px solid var(--border); color: #FFF; padding: 6px 10px; border-radius: 4px; font-weight: 800;">+</button>
              <button onclick="window.aviatorGame.setBet(2, 50)" style="background: var(--bg-input); border: 1px solid var(--border); color: var(--text-muted); font-size: 10px; padding: 6px; border-radius: 4px; font-weight: 700; flex: 1;">50</button>
              <button onclick="window.aviatorGame.setBet(2, 200)" style="background: var(--bg-input); border: 1px solid var(--border); color: var(--text-muted); font-size: 10px; padding: 6px; border-radius: 4px; font-weight: 700; flex: 1;">200</button>
            </div>
            <button id="bet2-action-btn" onclick="window.aviatorGame.handleBetAction(2)" style="background: var(--green); color: #000; border: none; padding: 12px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 15px rgba(0,230,118,0.3); transition: transform 0.1s;">
              BET ₹${this.bet2.amount}
            </button>
          </div>
        </div>

        <!-- Live Bets Leaderboard -->
        <div style="padding: 10px 12px; flex: 1;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 12px; font-weight: 800; color: #FFF;">ALL BETS (LIVE)</span>
            <span style="font-size: 10px; color: var(--green); font-weight: 700;">● 1,482 PLAYERS ONLINE</span>
          </div>
          <div id="aviator-live-players" style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between; background: var(--bg-card); padding: 6px 10px; border-radius: 4px; color: var(--text-muted);">
              <span>9872***91</span>
              <span>₹500</span>
              <span style="color: var(--green); font-weight: 800;">2.40x (+₹1,200)</span>
            </div>
            <div style="display: flex; justify-content: space-between; background: var(--bg-card); padding: 6px 10px; border-radius: 4px; color: var(--text-muted);">
              <span>8821***14</span>
              <span>₹1,000</span>
              <span style="color: var(--gold); font-weight: 800;">WAITING...</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderHistoryPills() {
    return this.history.map(m => {
      let color = '#2979FF';
      if (m >= 10.0) color = '#9C27B0';
      else if (m >= 2.0) color = '#00E676';
      return `
        <span style="background: rgba(0,0,0,0.5); border: 1px solid ${color}; color: ${color}; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 999px;">
          ${m.toFixed(2)}x
        </span>
      `;
    }).join('');
  }

  initCanvas() {
    this.canvas = document.getElementById('aviator-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth * 2;
    this.canvas.height = this.canvas.parentElement.clientHeight * 2;
  }

  startRenderLoop() {
    const draw = () => {
      if (!this.container) return;
      this.drawScene();
      this.animationFrame = requestAnimationFrame(draw);
    };
    this.animationFrame = requestAnimationFrame(draw);
  }

  drawScene() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    if (this.status === 'FLYING') {
      // Calculate plane curve based on multiplier
      const progress = Math.min((this.multiplier - 1.0) / 4.0, 1.0);
      const startX = 40;
      const startY = h - 40;
      const endX = startX + (w - 120) * Math.min(progress, 0.85);
      const endY = startY - (h - 90) * Math.min(progress, 0.85);

      // Draw Multiplier Fill Curve
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(startX + (endX - startX) * 0.4, startY, endX, endY);
      ctx.lineTo(endX, startY);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, endY, 0, startY);
      grad.addColorStop(0, 'rgba(255, 51, 102, 0.35)');
      grad.addColorStop(1, 'rgba(255, 51, 102, 0.02)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw Red Trajectory Line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(startX + (endX - startX) * 0.4, startY, endX, endY);
      ctx.strokeStyle = '#FF3366';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Draw Red Airplane Jet
      this.drawAirplane(ctx, endX, endY);
    }
  }

  drawAirplane(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.25);

    // Jet Body
    ctx.fillStyle = '#FF3366';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#D81B60';
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -18);
    ctx.lineTo(12, -4);
    ctx.closePath();
    ctx.fill();

    // Jet Tail
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(-28, -12);
    ctx.lineTo(-18, -2);
    ctx.closePath();
    ctx.fill();

    // Propeller / Cockpit
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(14, -2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  onServerTick(data) {
    const { status, multiplier, countdown } = data;
    this.status = status;
    this.multiplier = multiplier;

    const multEl = document.getElementById('aviator-big-mult');
    const statusEl = document.getElementById('aviator-status-text');

    if (multEl && statusEl) {
      if (status === 'WAITING') {
        multEl.style.color = '#FFF';
        multEl.innerText = `${countdown.toFixed(1)}s`;
        statusEl.innerText = 'WAITING FOR NEXT ROUND...';
        statusEl.style.color = 'var(--gold)';
        this.updateActionButtons(false);
      } else if (status === 'FLYING') {
        multEl.style.color = '#FFF';
        multEl.innerText = `${multiplier.toFixed(2)}x`;
        statusEl.innerText = 'PLANE IS FLYING!';
        statusEl.style.color = 'var(--green)';
        window.soundEngine.playFlyTick(multiplier);
        this.updateActionButtons(true);
      } else if (status === 'CRASHED') {
        multEl.style.color = 'var(--red)';
        multEl.innerText = `FLEW AWAY!`;
        statusEl.innerText = `@ ${multiplier.toFixed(2)}x`;
        statusEl.style.color = 'var(--red)';
        if (this.prevStatus === 'FLYING') {
          window.soundEngine.playCrash();
        }
        this.resetBetsOnCrash();
      }
    }
    this.prevStatus = status;
  }

  updateActionButtons(isFlying) {
    [1, 2].forEach(panel => {
      const bet = this[`bet${panel}`];
      const btn = document.getElementById(`bet${panel}-action-btn`);
      if (!btn) return;

      if (bet.placed && !bet.cashedOut) {
        if (isFlying) {
          const liveProfit = (bet.amount * this.multiplier).toFixed(2);
          btn.style.background = 'var(--gold)';
          btn.innerText = `CASHOUT ₹${liveProfit}`;
        } else {
          btn.style.background = 'var(--red)';
          btn.innerText = `CANCEL (₹${bet.amount})`;
        }
      } else if (bet.cashedOut) {
        btn.style.background = 'var(--bg-input)';
        btn.style.color = 'var(--green)';
        btn.innerText = `CASHED OUT!`;
      } else {
        btn.style.background = 'var(--green)';
        btn.style.color = '#000';
        btn.innerText = `BET ₹${bet.amount}`;
      }
    });
  }

  handleBetAction(panel) {
    const bet = this[`bet${panel}`];
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }

    if (this.status === 'WAITING' && !bet.placed) {
      // Place bet
      window.app.sendWs({
        type: 'AVIATOR_BET',
        phone: window.app.currentUser.phone,
        amount: bet.amount
      });
      bet.placed = true;
      bet.cashedOut = false;
      window.soundEngine.playCoin();
    } else if (this.status === 'FLYING' && bet.placed && !bet.cashedOut) {
      // Cashout
      window.app.sendWs({
        type: 'AVIATOR_CASHOUT',
        phone: window.app.currentUser.phone
      });
      bet.cashedOut = true;
      window.soundEngine.playWin();
    }
  }

  resetBetsOnCrash() {
    [1, 2].forEach(p => {
      const bet = this[`bet${p}`];
      bet.placed = false;
      bet.cashedOut = false;
    });
  }

  adjustBet(panel, delta) {
    const bet = this[`bet${panel}`];
    bet.amount = Math.max(10, bet.amount + delta);
    const amtEl = document.getElementById(`bet${panel}-amt-val`);
    if (amtEl) amtEl.innerText = bet.amount;
    const btn = document.getElementById(`bet${panel}-action-btn`);
    if (btn && !bet.placed) btn.innerText = `BET ₹${bet.amount}`;
  }

  setBet(panel, val) {
    const bet = this[`bet${panel}`];
    bet.amount = val;
    const amtEl = document.getElementById(`bet${panel}-amt-val`);
    if (amtEl) amtEl.innerText = val;
    const btn = document.getElementById(`bet${panel}-action-btn`);
    if (btn && !bet.placed) btn.innerText = `BET ₹${val}`;
  }
}

window.aviatorGame = new AviatorGame();
