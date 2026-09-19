// ===================================================
// Main App Engine & Router
// ===================================================

class App {
  constructor() {
    this.ws = null;
    this.currentUser = null;
    this.activeCategory = 'all';
    this.activeGameInstance = null;
    this.logoTapCount = 0;

    this.games = [
      { id: 'aviator', name: 'Aviator (Spribe)', category: 'crash', provider: 'Spribe', tag: 'HOT 40X', icon: '🚀', bg: 'linear-gradient(135deg, #FF3366, #9C27B0)', engine: () => window.aviatorGame },
      { id: 'wingo', name: 'Wingo Color Trading', category: 'trending', provider: 'FastLottery', tag: '1-MIN FAST', icon: '🎨', bg: 'linear-gradient(135deg, #00E676, #00B0FF)', engine: () => window.wingoGame },
      { id: 'roulette', name: 'European Roulette', category: 'casino', provider: 'Evolution', tag: '36X PAYOUT', icon: '🎡', bg: 'linear-gradient(135deg, #FFB800, #FF3366)', engine: () => window.rouletteGame },
      { id: 'dragontiger', name: 'Dragon vs Tiger', category: 'cards', provider: 'Ezugi', tag: 'SPEED DEAL', icon: '🐉', bg: 'linear-gradient(135deg, #7928CA, #FF0080)', engine: () => window.dvtGame },
      { id: 'teenpatti', name: '20-20 Teen Patti', category: 'cards', provider: 'Mac88', tag: 'CLASSIC', icon: '🃏', bg: 'linear-gradient(135deg, #0F3822, #00E676)', engine: () => window.teenPattiGame },
      { id: 'andarbahar', name: 'Andar Bahar', category: 'cards', provider: 'SuperSpade', tag: 'POPULAR', icon: '♠️', bg: 'linear-gradient(135deg, #FF3366, #FF9900)', engine: () => window.andarBaharGame },
      { id: 'mines', name: 'Mines Gem Hunter', category: 'crash', provider: 'TurboGames', tag: 'HIGH MULT', icon: '💎', bg: 'linear-gradient(135deg, #1A237E, #00E676)', engine: () => window.minesGame },
      { id: 'slots', name: 'Vegas 777 Jackpot', category: 'slots', provider: 'Pragmatic', tag: 'JACKPOT', icon: '🎰', bg: 'linear-gradient(135deg, #D500F9, #FFD600)', engine: () => window.slotsGame },
      { id: 'sports', name: 'Cricket Exchange', category: 'sports', provider: '7Exchange', tag: 'LIVE IN-PLAY', icon: '🏏', bg: 'linear-gradient(135deg, #0091EA, #00C853)', engine: () => window.sportsGame }
    ];
  }

  init() {
    this.initAuth();
    this.connectWebSocket();
    this.renderGamesGrid();
    this.bindEvents();
  }

  initAuth() {
    const saved = localStorage.getItem('chaska_user');
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.refreshUserData();
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      // Auto login with demo account
      this.loginWithPhone('9876543210', '123456');
    }
  }

  async loginWithPhone(phone, otp) {
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('chaska_user', JSON.stringify(data.user));
        this.updateHeaderUI();
      }
    } catch (e) {
      console.warn('Auto-login error:', e.message);
    }
  }

  async refreshUserData() {
    if (!this.currentUser) return;
    try {
      const res = await fetch(`/api/v1/auth/me?phone=${this.currentUser.phone}`);
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('chaska_user', JSON.stringify(data.user));
        this.updateHeaderUI();
      }
    } catch (e) {
      console.warn('User refresh error:', e.message);
    }
  }

  updateHeaderUI() {
    const chip = document.getElementById('header-balance-chip');
    const authBtn = document.getElementById('header-auth-btn');
    const balVal = document.getElementById('header-bal-val');

    if (this.currentUser) {
      if (chip) chip.style.display = 'flex';
      if (authBtn) authBtn.style.display = 'none';
      const total = (this.currentUser.depositBalance + this.currentUser.winningBalance).toFixed(2);
      if (balVal) balVal.innerText = total;
    } else {
      if (chip) chip.style.display = 'none';
      if (authBtn) authBtn.style.display = 'block';
    }
  }

  updateBalance(newBal) {
    if (this.currentUser) {
      const balVal = document.getElementById('header-bal-val');
      if (balVal) balVal.innerText = parseFloat(newBal).toFixed(2);
      this.refreshUserData();
    }
  }

  walletDeduct(amount, reason) {
    if (!this.currentUser) throw new Error('Please login first!');
    const total = this.currentUser.depositBalance + this.currentUser.winningBalance;
    if (total < amount) throw new Error('Insufficient wallet balance! Please deposit to continue.');

    let rem = amount;
    if (this.currentUser.depositBalance >= rem) {
      this.currentUser.depositBalance -= rem;
    } else {
      rem -= this.currentUser.depositBalance;
      this.currentUser.depositBalance = 0;
      this.currentUser.winningBalance -= rem;
    }
    this.updateHeaderUI();
  }

  walletCredit(amount, game, multiplier) {
    if (!this.currentUser) return;
    this.currentUser.winningBalance += amount;
    this.updateHeaderUI();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);

    this.ws.onopen = () => {
      console.log('⚡ Connected to Chaska High-Speed WebSocket Engine');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWsTick(data);
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.warn('WS disconnected, reconnecting in 2s...');
      setTimeout(() => this.connectWebSocket(), 2000);
    };
  }

  sendWs(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleWsTick(data) {
    if (data.type === 'TICK') {
      if (window.aviatorGame && data.aviator) {
        window.aviatorGame.onServerTick(data.aviator);
      }
      if (window.wingoGame && data.wingo) {
        window.wingoGame.onServerTick(data.wingo);
      }
      if (window.dvtGame && data.dvt) {
        window.dvtGame.onServerTick(data.dvt);
      }
    } else if (data.type === 'BET_PLACED') {
      this.updateBalance(data.balance);
    } else if (data.type === 'CASHOUT_SUCCESS') {
      this.updateBalance(data.balance);
      alert(`🎉 CASHOUT SUCCESS! You won ₹${data.winAmount} (${data.multiplier}x)!`);
    } else if (data.type === 'LIVE_WINNER') {
      // Add winner to marquee
      const marquee = document.getElementById('live-winners-marquee');
      if (marquee) {
        marquee.innerHTML = `<span>🔥 ${data.phone} won ₹${data.amount} on ${data.game}!</span> ` + marquee.innerHTML;
      }
    } else if (data.type === 'ERROR') {
      alert(data.message);
    }
  }

  renderGamesGrid(filter = 'all') {
    const grid = document.getElementById('main-games-grid');
    if (!grid) return;

    const filtered = filter === 'all' 
      ? this.games 
      : this.games.filter(g => g.category === filter || g.id === filter);

    grid.innerHTML = filtered.map(g => `
      <div class="game-card" onclick="window.app.launchGame('${g.id}')">
        <div class="game-thumb-box" style="background: ${g.bg};">
          <div style="font-size: 46px;">${g.icon}</div>
          <span class="game-tag-badge">${g.tag}</span>
          <div class="game-overlay-hover">
            <span class="play-badge-btn">PLAY NOW</span>
          </div>
        </div>
        <div class="game-info">
          <div class="game-name">${g.name}</div>
          <div class="game-provider">${g.provider}</div>
        </div>
      </div>
    `).join('');
  }

  launchGame(gameId) {
    const game = this.games.find(g => g.id === gameId);
    if (!game) return;

    const viewport = document.getElementById('game-viewport-modal');
    const content = document.getElementById('game-viewport-content');
    const title = document.getElementById('game-viewport-title');

    title.innerText = game.name.toUpperCase();
    viewport.classList.add('open');

    // Mount game engine
    const engine = game.engine();
    this.activeGameInstance = engine;
    engine.mount(content);
    window.soundEngine.playCoin();
  }

  closeGameViewport() {
    const viewport = document.getElementById('game-viewport-modal');
    viewport.classList.remove('open');
    if (this.activeGameInstance && this.activeGameInstance.unmount) {
      this.activeGameInstance.unmount();
    }
    this.activeGameInstance = null;
    this.refreshUserData();
  }

  filterCategory(category, el) {
    this.activeCategory = category;
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    this.renderGamesGrid(category);
  }

  searchGames(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.renderGamesGrid(this.activeCategory);
      return;
    }
    const grid = document.getElementById('main-games-grid');
    const matched = this.games.filter(g => g.name.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q));
    grid.innerHTML = matched.map(g => `
      <div class="game-card" onclick="window.app.launchGame('${g.id}')">
        <div class="game-thumb-box" style="background: ${g.bg};">
          <div style="font-size: 46px;">${g.icon}</div>
          <span class="game-tag-badge">${g.tag}</span>
          <div class="game-overlay-hover">
            <span class="play-badge-btn">PLAY NOW</span>
          </div>
        </div>
        <div class="game-info">
          <div class="game-name">${g.name}</div>
          <div class="game-provider">${g.provider}</div>
        </div>
      </div>
    `).join('');
  }

  openAuthModal() {
    document.getElementById('auth-modal').classList.add('open');
  }

  closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
  }

  async sendOtp() {
    const phone = document.getElementById('auth-phone-input').value.trim();
    if (phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('otp-step-1').style.display = 'none';
        document.getElementById('otp-step-2').style.display = 'block';
        document.getElementById('auth-otp-input').value = data.demoOtp;
        alert(`OTP sent! For demo: ${data.demoOtp}`);
      }
    } catch (e) {
      alert('Error sending OTP');
    }
  }

  async verifyOtp() {
    const phone = document.getElementById('auth-phone-input').value.trim();
    const otp = document.getElementById('auth-otp-input').value.trim();
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('chaska_user', JSON.stringify(data.user));
        this.updateHeaderUI();
        this.closeAuthModal();
        window.soundEngine.playWin();
        alert('Welcome! ₹1,000 Signup Bonus credited to your wallet.');
      } else {
        alert(data.error || 'Invalid OTP');
      }
    } catch (e) {
      alert('Error verifying OTP');
    }
  }

  bindEvents() {
    // Secret Admin trigger: 5 quick taps on Brand logo
    const brandBox = document.querySelector('.brand-box');
    if (brandBox) {
      brandBox.addEventListener('click', () => {
        this.logoTapCount++;
        if (this.logoTapCount >= 5) {
          this.logoTapCount = 0;
          window.location.href = '/admin';
        }
      });
    }

    // Floating Support actions
    const waBtn = document.querySelector('.float-whatsapp');
    if (waBtn) {
      waBtn.addEventListener('click', () => {
        alert('Opening WhatsApp 24/7 VIP Support: +91 99999 99999 (You can configure your real WhatsApp number in config)');
      });
    }

    const tgBtn = document.querySelector('.float-telegram');
    if (tgBtn) {
      tgBtn.addEventListener('click', () => {
        alert('Opening Telegram VIP Channel: @ChaskaOfficial (You can configure your real Telegram link in config)');
      });
    }
  }
}

window.app = new App();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
  window.walletUI.init();
});
