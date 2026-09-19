// ===================================================
// Wallet Manager & Payment Gateway Engine
// ===================================================

class WalletUI {
  constructor() {
    this.depositAmount = 500;
    this.withdrawAmount = 500;
    this.activeMethod = 'UPI';
    this.adminUpiId = 'windaqpay@icici'; // WinDaq Official UPI
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    // Deposit Modal Triggers
    document.querySelectorAll('.open-deposit-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openDepositModal());
    });

    // Withdrawal Modal Triggers
    document.querySelectorAll('.open-withdraw-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openWithdrawModal());
    });
  }

  openDepositModal() {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    const modal = document.getElementById('deposit-modal');
    this.renderDepositUI();
    modal.classList.add('open');
  }

  closeDepositModal() {
    document.getElementById('deposit-modal').classList.remove('open');
  }

  renderDepositUI() {
    const container = document.getElementById('deposit-modal-body');
    const upiLink = `upi://pay?pa=${this.adminUpiId}&pn=ChaskaGaming&am=${this.depositAmount}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">CHOOSE DEPOSIT AMOUNT</div>
          <div style="font-size: 24px; font-weight: 900; color: var(--gold); margin: 4px 0;">₹${this.depositAmount}</div>
          <div class="chip-row">
            ${[100, 300, 500, 1000, 2000, 5000].map(amt => `
              <div class="amount-chip ${this.depositAmount === amt ? 'active' : ''}" onclick="window.walletUI.setDepositAmount(${amt})">
                +₹${amt}
              </div>
            `).join('')}
          </div>
        </div>

        <div style="text-align: center; background: #FFF; padding: 12px; border-radius: var(--radius-md); width: fit-content; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
          <img src="${qrUrl}" alt="UPI QR" style="width: 160px; height: 160px; display: block;" />
          <div style="color: #000; font-size: 11px; font-weight: 800; margin-top: 4px;">SCAN WITH ANY UPI APP</div>
        </div>

        <div style="display: flex; gap: 8px; justify-content: center;">
          <a href="${upiLink}" class="amount-chip" style="text-decoration: none; color: #FFF; background: #5f259f; font-weight: 800; font-size: 12px; padding: 10px;">
            PhonePe
          </a>
          <a href="${upiLink}" class="amount-chip" style="text-decoration: none; color: #FFF; background: #0082FB; font-weight: 800; font-size: 12px; padding: 10px;">
            Paytm
          </a>
          <a href="${upiLink}" class="amount-chip" style="text-decoration: none; color: #FFF; background: #EA4335; font-weight: 800; font-size: 12px; padding: 10px;">
            Google Pay
          </a>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-input); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-muted);">UPI ID: <b style="color: #FFF;">${this.adminUpiId}</b></div>
          <button onclick="navigator.clipboard.writeText('${this.adminUpiId}'); alert('UPI ID copied!');" style="background: var(--bg-card); border: 1px solid var(--border-highlight); color: var(--gold); padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 700;">Copy</button>
        </div>

        <div>
          <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">ENTER 12-DIGIT UPI / UTR REFERENCE NO.</label>
          <input type="text" id="deposit-utr-input" placeholder="e.g. 425619873412" maxlength="12" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); color: #FFF; font-size: 14px; outline: none;" />
        </div>

        <button class="btn-primary" onclick="window.walletUI.submitDeposit()">SUBMIT & CREDIT WALLET</button>
      </div>
    `;
  }

  setDepositAmount(amt) {
    this.depositAmount = amt;
    this.renderDepositUI();
  }

  async submitDeposit() {
    const utrInput = document.getElementById('deposit-utr-input');
    const utr = utrInput ? utrInput.value.trim() : '';

    try {
      const res = await fetch('/api/v1/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          amount: this.depositAmount,
          utr: utr || undefined,
          upiApp: 'FastUPI'
        })
      });
      const data = await res.json();
      if (data.success) {
        window.soundEngine.playCoin();
        window.app.updateBalance(data.newBalance);
        this.closeDepositModal();
        alert(`Deposit of ₹${this.depositAmount} successful! Added to your balance.`);
      } else {
        alert(data.error || 'Deposit failed');
      }
    } catch (e) {
      alert('Network error submitting deposit');
    }
  }

  /* --- WITHDRAWAL FLOW --- */
  openWithdrawModal() {
    if (!window.app.currentUser) {
      window.app.openAuthModal();
      return;
    }
    const modal = document.getElementById('withdraw-modal');
    this.renderWithdrawUI();
    modal.classList.add('open');
  }

  closeWithdrawModal() {
    document.getElementById('withdraw-modal').classList.remove('open');
  }

  renderWithdrawUI() {
    const user = window.app.currentUser;
    const container = document.getElementById('withdraw-modal-body');
    const winningBal = user.winningBalance || 0;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--bg-input); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border);">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">AVAILABLE TO WITHDRAW (WINNINGS)</div>
          <div style="font-size: 26px; font-weight: 900; color: var(--green); margin-top: 4px;">₹${winningBal.toFixed(2)}</div>
          <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Min. withdrawal: ₹200 | Instant 10-minute IMPS</div>
        </div>

        <div>
          <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">WITHDRAWAL AMOUNT (₹)</label>
          <input type="number" id="withdraw-amount-input" value="500" min="200" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); color: #FFF; font-size: 15px; font-weight: 800; outline: none;" />
        </div>

        <div>
          <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">PAYOUT METHOD</label>
          <div style="display: flex; gap: 8px;">
            <div class="amount-chip ${this.activeMethod === 'UPI' ? 'active' : ''}" onclick="window.walletUI.setWithdrawMethod('UPI')">UPI ID</div>
            <div class="amount-chip ${this.activeMethod === 'BANK' ? 'active' : ''}" onclick="window.walletUI.setWithdrawMethod('BANK')">Bank Account</div>
          </div>
        </div>

        ${this.activeMethod === 'UPI' ? `
          <div>
            <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">YOUR UPI ID</label>
            <input type="text" id="withdraw-details-input" placeholder="e.g. yourname@okaxis" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); color: #FFF; font-size: 14px; outline: none;" />
          </div>
        ` : `
          <div>
            <label style="font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;">BANK ACC NO. & IFSC CODE</label>
            <input type="text" id="withdraw-details-input" placeholder="e.g. 501002341234, HDFC0001234" style="width: 100%; background: var(--bg-input); border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-sm); color: #FFF; font-size: 14px; outline: none;" />
          </div>
        `}

        <button class="btn-primary" onclick="window.walletUI.submitWithdraw()">PROCEED WITHDRAWAL</button>
      </div>
    `;
  }

  setWithdrawMethod(method) {
    this.activeMethod = method;
    this.renderWithdrawUI();
  }

  async submitWithdraw() {
    const amtInput = document.getElementById('withdraw-amount-input');
    const detailsInput = document.getElementById('withdraw-details-input');
    const amount = parseFloat(amtInput ? amtInput.value : 0);
    const details = detailsInput ? detailsInput.value.trim() : '';

    if (!details) {
      alert('Please enter your UPI ID or Bank details');
      return;
    }

    try {
      const res = await fetch('/api/v1/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: window.app.currentUser.phone,
          amount,
          paymentMethod: this.activeMethod,
          details
        })
      });
      const data = await res.json();
      if (data.success) {
        window.soundEngine.playWin();
        window.app.updateBalance(data.newBalance);
        this.closeWithdrawModal();
        alert(`Withdrawal request for ₹${amount} submitted successfully! Transferred to your ${this.activeMethod}.`);
      } else {
        alert(data.error || 'Withdrawal failed');
      }
    } catch (e) {
      alert('Network error submitting withdrawal');
    }
  }
}

window.walletUI = new WalletUI();
