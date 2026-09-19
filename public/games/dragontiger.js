// ===================================================
// Dragon vs Tiger Game Engine
// ===================================================

class DragonTigerGame {
  constructor() {
    this.container = null;
    this.roundId = 501;
    this.timeLeft = 15;
    this.history = ['D', 'T', 'D', 'D', 'T', 'TIE', 'D'];
    this.cards = { dragon: null, tiger: null };
    this.selectedSide = 'DRAGON';
    this.stake = 100;
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
      <div style="display: flex; flex-direction: column; height: 100%; background: #0A0D14; overflow-y: auto; padding: 12px;">
        <!-- Round & Roadmap Bar -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div>
            <div style="font-size: 10px; color: var(--text-dim); font-weight: 800;">ROUND #</div>
            <div id="dvt-round-id" style="font-size: 16px; font-weight: 900; color: var(--gold);">${this.roundId}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;" id="dvt-roadmap">
            ${this.renderRoadmap()}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: var(--text-dim); font-weight: 800;">TIMER</div>
            <div id="dvt-timer" style="font-size: 20px; font-weight: 900; color: var(--green);">${this.timeLeft}s</div>
          </div>
        </div>

        <!-- Live Dealer Table Cards Arena -->
        <div style="position: relative; height: 200px; background: radial-gradient(circle, #1F112B 0%, #080A10 80%); border-radius: var(--radius-lg); border: 1px solid var(--border-highlight); display: flex; align-items: center; justify-content: space-around; padding: 16px; margin-bottom: 14px; box-shadow: var(--shadow-card);">
          <!-- Dragon Side Card -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="font-size: 14px; font-weight: 900; color: #FF3366; letter-spacing: 1px;">DRAGON</div>
            <div id="dragon-card-box" style="width: 75px; height: 110px; background: #FFF; border-radius: 8px; border: 2px solid #FF3366; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(255,51,102,0.4); font-size: 28px; font-weight: 900; color: #FF3366;">
              ${this.cards.dragon ? `${this.cards.dragon.rank}${this.cards.dragon.suit}` : '🐉'}
            </div>
          </div>

          <!-- VS Badge -->
          <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-card); border: 2px solid var(--gold); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: var(--gold); box-shadow: 0 0 15px rgba(255,184,0,0.5);">
            VS
          </div>

          <!-- Tiger Side Card -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="font-size: 14px; font-weight: 900; color: #FFB800; letter-spacing: 1px;">TIGER</div>
            <div id="tiger-card-box" style="width: 75px; height: 110px; background: #FFF; border-radius: 8px; border: 2px solid #FFB800; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(255,184,0,0.4); font-size: 28px; font-weight: 900; color: #FFB800;">
              ${this.cards.tiger ? `${this.cards.tiger.rank}${this.cards.tiger.suit}` : '🐯'}
            </div>
          </div>
        </div>

        <!-- Bet Selection Zones -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 8px; margin-bottom: 14px;">
          <button onclick="window.dvtGame.selectZone('DRAGON')" class="dvt-bet-btn ${this.selectedSide === 'DRAGON' ? 'active' : ''}" style="background: rgba(255,51,102,0.15); border: 2px solid #FF3366; color: #FF3366; padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 14px; cursor: pointer;">
            DRAGON (2X)
          </button>
          <button onclick="window.dvtGame.selectZone('TIE')" class="dvt-bet-btn ${this.selectedSide === 'TIE' ? 'active' : ''}" style="background: rgba(0,230,118,0.15); border: 2px solid #00E676; color: #00E676; padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 13px; cursor: pointer;">
            TIE (9X)
          </button>
          <button onclick="window.dvtGame.selectZone('TIGER')" class="dvt-bet-btn ${this.selectedSide === 'TIGER' ? 'active' : ''}" style="background: rgba(255,184,0,0.15); border: 2px solid #FFB800; color: #FFB800; padding: 14px; border-radius: var(--radius-md); font-weight: 900; font-size: 14px; cursor: pointer;">
            TIGER (2X)
          </button>
        </div>

        <!-- Stake Chips & Bet CTA -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; margin-top: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">CHIP AMOUNT</span>
            <div style="display: flex; gap: 6px;">
              ${[50, 100, 500, 1000].map(amt => `
                <div class="amount-chip ${this.stake === amt ? 'active' : ''}" onclick="window.dvtGame.setStake(${amt})">
                  ₹${amt}
                </div>
              `).join('')}
            </div>
          </div>
          <button class="btn-primary" onclick="window.dvtGame.placeBet()">
            PLACE ₹${this.stake} ON ${this.selectedSide}
          </button>
        </div>
      </div>
    `;
  }

  renderRoadmap() {
    return this.history.slice(-7).map(item => {
      let bg = '#FF3366'; // Dragon
      if (item === 'T') bg = '#FFB800'; // Tiger
      if (item === 'TIE') bg = '#00E676'; // Tie
      return `
        <span style="width: 22px; height: 22px; border-radius: 50%; background: ${bg}; color: #000; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">
          ${item}
        </span>
      `;
    }).join('');
  }

  selectZone(side) {
    this.selectedSide = side;
    this.renderLayout();
  }

  setStake(val) {
    this.stake = val;
    this.renderLayout();
  }

  onServerTick(data) {
    const { roundId, timeLeft, cards, lastWinner } = data;
    this.roundId = roundId;
    this.timeLeft = timeLeft;
    this.cards = cards || { dragon: null, tiger: null };

    const timerEl = document.getElementById('dvt-timer');
    const roundEl = document.getElementById('dvt-round-id');
    const dCard = document.getElementById('dragon-card-box');
    const tCard = document.getElementById('tiger-card-box');

    if (timerEl) timerEl.innerText = `${timeLeft}s`;
    if (roundEl) roundEl.innerText = roundId;

    if (cards && cards.dragon && cards.tiger && dCard && tCard) {
      dCard.innerHTML = `<span style="color: ${cards.dragon.color === 'red' ? '#FF3366' : '#000'}">${cards.dragon.rank}${cards.dragon.suit}</span>`;
      tCard.innerHTML = `<span style="color: ${cards.tiger.color === 'red' ? '#FF3366' : '#000'}">${cards.tiger.rank}${cards.tiger.suit}</span>`;
    }
  }

  placeBet() {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    if (this.timeLeft <= 3) {
      alert('Betting closed for this deal!');
      return;
    }
    try {
      window.app.walletDeduct(this.stake, `Dragon vs Tiger (${this.selectedSide})`);
      window.soundEngine.playCard();
      alert(`Bet of ₹${this.stake} confirmed on ${this.selectedSide}!`);
    } catch (e) {
      alert(e.message);
    }
  }
}

window.dvtGame = new DragonTigerGame();
