// ===================================================
// Wingo Color Prediction (1-Min Fast Rounds)
// ===================================================

class WingoGame {
  constructor() {
    this.container = null;
    this.periodId = 20260919001;
    this.timeLeft = 60;
    this.selectedBet = null;
    this.betAmount = 100;
    this.history = [];
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
      <div style="display: flex; flex-direction: column; height: 100%; background: #0E121B; overflow-y: auto; padding: 12px;">
        <!-- Period & Timer Header -->
        <div style="background: linear-gradient(135deg, #1C2333 0%, #101520 100%); border: 1px solid var(--border-highlight); border-radius: var(--radius-md); padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; box-shadow: var(--shadow-card);">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">PERIOD NO.</div>
            <div id="wingo-period-id" style="font-size: 18px; font-weight: 900; color: var(--gold);">${this.periodId}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">TIME REMAINING</div>
            <div id="wingo-timer" style="font-size: 26px; font-weight: 900; color: var(--green); font-family: 'Courier New', monospace;">
              00:${this.timeLeft.toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        <!-- Color Prediction Buttons -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
          <button onclick="window.wingoGame.openBetModal('green', 'Green (2x)')" style="background: #00E676; color: #000; font-weight: 900; font-size: 15px; padding: 16px; border: none; border-radius: var(--radius-md); cursor: pointer; box-shadow: 0 4px 15px rgba(0,230,118,0.3);">
            GREEN <span style="font-size: 11px; display: block; font-weight: 700;">2X Payout</span>
          </button>
          <button onclick="window.wingoGame.openBetModal('violet', 'Violet (4.5x)')" style="background: #9C27B0; color: #FFF; font-weight: 900; font-size: 15px; padding: 16px; border: none; border-radius: var(--radius-md); cursor: pointer; box-shadow: 0 4px 15px rgba(156,39,176,0.3);">
            VIOLET <span style="font-size: 11px; display: block; font-weight: 700;">4.5X Payout</span>
          </button>
          <button onclick="window.wingoGame.openBetModal('red', 'Red (2x)')" style="background: #FF3366; color: #FFF; font-weight: 900; font-size: 15px; padding: 16px; border: none; border-radius: var(--radius-md); cursor: pointer; box-shadow: 0 4px 15px rgba(255,51,102,0.3);">
            RED <span style="font-size: 11px; display: block; font-weight: 700;">2X Payout</span>
          </button>
        </div>

        <!-- Number Buttons (0 - 9) (9x Payout) -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 800; margin-bottom: 8px;">PICK NUMBER (9X PAYOUT)</div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
              let bg = '#00E676'; // green
              if (n === 0) bg = 'linear-gradient(135deg, #FF3366 50%, #9C27B0 50%)';
              else if (n === 5) bg = 'linear-gradient(135deg, #00E676 50%, #9C27B0 50%)';
              else if ([2, 4, 6, 8].includes(n)) bg = '#FF3366';
              return `
                <button onclick="window.wingoGame.openBetModal('${n}', 'Number ${n} (9x)')" style="background: ${bg}; color: #FFF; border: none; width: 100%; aspect-ratio: 1/1; border-radius: 50%; font-size: 18px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
                  ${n}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Big / Small Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
          <button onclick="window.wingoGame.openBetModal('Big', 'Big 5-9 (2x)')" style="background: #FFB800; color: #000; font-weight: 900; font-size: 15px; padding: 14px; border: none; border-radius: var(--radius-md); cursor: pointer;">
            BIG (5-9) <span style="font-size: 11px; font-weight: 700; display: block;">2X</span>
          </button>
          <button onclick="window.wingoGame.openBetModal('Small', 'Small 0-4 (2x)')" style="background: #2979FF; color: #FFF; font-weight: 900; font-size: 15px; padding: 14px; border: none; border-radius: var(--radius-md); cursor: pointer;">
            SMALL (0-4) <span style="font-size: 11px; font-weight: 700; display: block;">2X</span>
          </button>
        </div>

        <!-- History Records Table -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; flex: 1;">
          <div style="font-size: 12px; font-weight: 800; color: #FFF; margin-bottom: 8px;">GAME HISTORY (RECENT ROUNDS)</div>
          <div id="wingo-history-list" style="display: flex; flex-direction: column; gap: 6px;">
            ${this.renderHistoryList()}
          </div>
        </div>
      </div>

      <!-- Quick Stake Modal -->
      <div id="wingo-bet-modal" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <div id="wingo-modal-title" class="modal-title">PLACE BET</div>
            <button class="modal-close" onclick="window.wingoGame.closeBetModal()">✕</button>
          </div>
          <div class="modal-body">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">SELECT STAKE AMOUNT</div>
            <div class="chip-row">
              ${[10, 50, 100, 500, 1000].map(amt => `
                <div class="amount-chip ${this.betAmount === amt ? 'active' : ''}" onclick="window.wingoGame.setBetAmount(${amt})">
                  ₹${amt}
                </div>
              `).join('')}
            </div>
            <button class="btn-primary" onclick="window.wingoGame.submitBet()" style="margin-top: 14px;">
              CONFIRM BET (₹<span id="wingo-modal-amt">${this.betAmount}</span>)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderHistoryList() {
    return (this.history || []).slice(0, 8).map(h => {
      let colorBadge = '#00E676';
      if (h.color.includes('red')) colorBadge = '#FF3366';
      if (h.color.includes('violet')) colorBadge = '#9C27B0';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-input); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px;">
          <span style="color: var(--text-muted); font-weight: 700;">#${h.period}</span>
          <span style="background: ${colorBadge}; color: #FFF; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900;">
            ${h.number}
          </span>
          <span style="font-weight: 800; color: ${h.size === 'Big' ? 'var(--gold)' : 'var(--blue)'};">
            ${h.size}
          </span>
          <span style="color: var(--green); font-weight: 700; text-transform: uppercase;">
            ${h.color}
          </span>
        </div>
      `;
    }).join('');
  }

  onServerTick(data) {
    const { periodId, timeLeft } = data;
    this.periodId = periodId;
    this.timeLeft = timeLeft;

    const periodEl = document.getElementById('wingo-period-id');
    const timerEl = document.getElementById('wingo-timer');

    if (periodEl) periodEl.innerText = periodId;
    if (timerEl) {
      timerEl.innerText = `00:${timeLeft.toString().padStart(2, '0')}`;
      if (timeLeft <= 5) {
        timerEl.style.color = 'var(--red)';
        window.soundEngine.playBeep();
      } else {
        timerEl.style.color = 'var(--green)';
      }
    }
  }

  openBetModal(selection, title) {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    if (this.timeLeft <= 5) {
      alert('Betting is closed for this round! Wait for the next round.');
      return;
    }
    this.selectedBet = selection;
    document.getElementById('wingo-modal-title').innerText = `BET ON ${title.toUpperCase()}`;
    document.getElementById('wingo-bet-modal').classList.add('open');
  }

  closeBetModal() {
    document.getElementById('wingo-bet-modal').classList.remove('open');
  }

  setBetAmount(amt) {
    this.betAmount = amt;
    document.getElementById('wingo-modal-amt').innerText = amt;
    document.querySelectorAll('#wingo-bet-modal .amount-chip').forEach(c => {
      c.classList.toggle('active', c.innerText.includes(amt.toString()));
    });
  }

  async submitBet() {
    if (!this.selectedBet) return;
    try {
      const res = await fetch('/api/v1/games/wingo/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          amount: this.betAmount,
          selection: this.selectedBet,
          periodId: this.periodId
        })
      });
      const data = await res.json();
      if (data.success) {
        window.soundEngine.playCoin();
        window.app.updateBalance(data.balance);
        this.closeBetModal();
        alert(data.message);
      } else {
        alert(data.error || 'Bet placement failed');
      }
    } catch (e) {
      alert('Network error submitting bet');
    }
  }
}

window.wingoGame = new WingoGame();
