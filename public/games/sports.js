// ===================================================
// Cricket Exchange & Sportsbook Engine
// ===================================================

class SportsGame {
  constructor() {
    this.container = null;
    this.matches = [
      {
        id: 'cric_1',
        teams: 'India vs Australia',
        tournament: 'ICC Men\'s T20 World Cup Super 8',
        score: 'IND 192/3 (18.1 ov) - Kohli 78*(42)',
        status: 'LIVE',
        backTeam1: 1.58,
        layTeam1: 1.60,
        backTeam2: 2.62,
        layTeam2: 2.68
      },
      {
        id: 'cric_2',
        teams: 'Chennai Super Kings vs Mumbai Indians',
        tournament: 'Indian Premier League (IPL)',
        score: 'CSK 110/2 (11.2 ov) - Gaikwad 55*(34)',
        status: 'LIVE',
        backTeam1: 1.85,
        layTeam1: 1.88,
        backTeam2: 2.05,
        layTeam2: 2.10
      }
    ];
    this.activeSlip = null;
  }

  mount(containerEl) {
    this.container = containerEl;
    this.activeSlip = null;
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
          <span style="font-weight: 900; font-size: 15px; color: var(--gold);">⚡ CRICKET LIVE EXCHANGE</span>
          <span style="font-size: 11px; color: var(--green); font-weight: 800;">● IN-PLAY LIVE</span>
        </div>

        <!-- Live Matches Feed -->
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px;">
          ${this.matches.map(m => `
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px; box-shadow: var(--shadow-card);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 10px; font-weight: 700; color: var(--gold); text-transform: uppercase;">${m.tournament}</span>
                <span style="background: #E53935; color: #FFF; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">LIVE</span>
              </div>
              <div style="font-size: 15px; font-weight: 900; color: #FFF; margin-bottom: 4px;">${m.teams}</div>
              <div style="font-size: 12px; font-weight: 800; color: var(--green); margin-bottom: 12px;">🏏 ${m.score}</div>

              <!-- Odds Market -->
              <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; align-items: center;">
                <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">${m.teams.split(' vs ')[0]}</span>
                <button onclick="window.sportsGame.openBetSlip('${m.id}', 'BACK', '${m.teams.split(' vs ')[0]}', ${m.backTeam1})" style="background: #2979FF; color: #FFF; border: none; padding: 10px; border-radius: 4px; font-weight: 900; font-size: 13px; cursor: pointer;">
                  ${m.backTeam1} <span style="font-size: 9px; display: block; font-weight: 600;">BACK</span>
                </button>
                <button onclick="window.sportsGame.openBetSlip('${m.id}', 'LAY', '${m.teams.split(' vs ')[0]}', ${m.layTeam1})" style="background: #F48FB1; color: #000; border: none; padding: 10px; border-radius: 4px; font-weight: 900; font-size: 13px; cursor: pointer;">
                  ${m.layTeam1} <span style="font-size: 9px; display: block; font-weight: 600;">LAY</span>
                </button>

                <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">${m.teams.split(' vs ')[1]}</span>
                <button onclick="window.sportsGame.openBetSlip('${m.id}', 'BACK', '${m.teams.split(' vs ')[1]}', ${m.backTeam2})" style="background: #2979FF; color: #FFF; border: none; padding: 10px; border-radius: 4px; font-weight: 900; font-size: 13px; cursor: pointer;">
                  ${m.backTeam2} <span style="font-size: 9px; display: block; font-weight: 600;">BACK</span>
                </button>
                <button onclick="window.sportsGame.openBetSlip('${m.id}', 'LAY', '${m.teams.split(' vs ')[1]}', ${m.layTeam2})" style="background: #F48FB1; color: #000; border: none; padding: 10px; border-radius: 4px; font-weight: 900; font-size: 13px; cursor: pointer;">
                  ${m.layTeam2} <span style="font-size: 9px; display: block; font-weight: 600;">LAY</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Slide-Up Bet Slip -->
        <div id="sports-bet-slip" style="display: ${this.activeSlip ? 'block' : 'none'}; background: var(--bg-card); border: 2px solid var(--gold); border-radius: var(--radius-md); padding: 14px; margin-top: auto; box-shadow: var(--shadow-card);">
          ${this.renderBetSlip()}
        </div>
      </div>
    `;
  }

  renderBetSlip() {
    if (!this.activeSlip) return '';
    const { type, team, odds, stake } = this.activeSlip;
    const profit = ((odds - 1) * stake).toFixed(2);

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 800; background: ${type === 'BACK' ? '#2979FF' : '#F48FB1'}; color: ${type === 'BACK' ? '#FFF' : '#000'}; padding: 2px 8px; border-radius: 4px;">
          ${type}
        </span>
        <span style="font-size: 13px; font-weight: 900; color: #FFF;">${team}</span>
        <span style="font-size: 14px; font-weight: 900; color: var(--gold);">@ ${odds}</span>
        <button onclick="window.sportsGame.closeSlip()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px;">✕</button>
      </div>

      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
        <input type="number" id="sports-stake-input" value="${stake}" min="100" oninput="window.sportsGame.updateStake(this.value)" style="flex: 1; background: var(--bg-input); border: 1px solid var(--border); padding: 10px; border-radius: 4px; color: #FFF; font-weight: 800; font-size: 14px; outline: none;" />
        <div style="text-align: right; font-size: 11px; color: var(--text-muted);">
          Profit: <b style="color: var(--green); font-size: 13px;">₹${profit}</b>
        </div>
      </div>

      <button class="btn-primary" onclick="window.sportsGame.placeBet()">
        PLACE BET (₹${stake})
      </button>
    `;
  }

  openBetSlip(matchId, type, team, odds) {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    this.activeSlip = { matchId, type, team, odds, stake: 500 };
    this.renderLayout();
  }

  closeSlip() {
    this.activeSlip = null;
    this.renderLayout();
  }

  updateStake(val) {
    if (this.activeSlip) {
      this.activeSlip.stake = parseFloat(val) || 0;
      const slip = document.getElementById('sports-bet-slip');
      if (slip) slip.innerHTML = this.renderBetSlip();
    }
  }

  async placeBet() {
    if (!this.activeSlip) return;
    try {
      const res = await fetch('/api/v1/games/sports/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          matchId: this.activeSlip.matchId,
          type: this.activeSlip.type,
          team: this.activeSlip.team,
          odds: this.activeSlip.odds,
          stake: this.activeSlip.stake
        })
      });
      const data = await res.json();
      if (data.success) {
        window.soundEngine.playCoin();
        window.app.updateBalance(data.newBalance);
        alert(data.message);
        this.closeSlip();
      } else {
        alert(data.error || 'Bet placement failed');
      }
    } catch (e) {
      alert('Error placing sports bet');
    }
  }
}

window.sportsGame = new SportsGame();
