import { create } from 'zustand';
import { getApiUrl } from '@/lib/config';

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'BET' | 'WIN' | 'BONUS' | 'SPIN';
  amount: number;
  description: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  date: string;
  utr?: string;
}

interface WalletState {
  balance: number;
  bonusBalance: number;
  isLoggedIn: boolean;
  userId: string;
  user: { id: string; name: string; phone: string } | null;
  userName: string;
  userPhone: string;
  vipTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  vipPoints: number;
  referralCode: string;
  isDepositing: boolean;
  isWithdrawing: boolean;
  isSpinOpen: boolean;
  isVipOpen: boolean;
  isReferralOpen: boolean;
  isPassbookOpen: boolean;
  isNotifOpen: boolean;
  transactions: Transaction[];
  
  // Actions
  setBalance: (amount: number) => void;
  deductBalance: (amount: number, gameName?: string) => boolean;
  addWinnings: (amount: number, gameName?: string, multiplier?: number) => void;
  deposit: (amount: number, utr?: string, method?: string) => void;
  withdraw: (amount: number, upiId?: string) => boolean;
  claimSpin: (amount: number, prizeLabel: string) => void;
  claimCashback: (amount: number) => void;
  setIsLoggedIn: (status: boolean) => void;
  setDepositing: (status: boolean) => void;
  setWithdrawing: (status: boolean) => void;
  setSpinOpen: (status: boolean) => void;
  setVipOpen: (status: boolean) => void;
  setReferralOpen: (status: boolean) => void;
  setPassbookOpen: (status: boolean) => void;
  setNotifOpen: (status: boolean) => void;
  setAuthenticatedUser: (user: { id: string; phone: string; role?: string; isGuest?: boolean }, initialBalance?: number) => void;
  resetWallet: () => void;
  fetchBalance: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  bonusBalance: 0,
  isLoggedIn: false,
  userId: "",
  user: null,
  userName: "Guest",
  userPhone: "",
  vipTier: "Gold",
  vipPoints: 2450,
  referralCode: "WIN9420",
  isDepositing: false,
  isWithdrawing: false,
  isSpinOpen: false,
  isVipOpen: false,
  isReferralOpen: false,
  isPassbookOpen: false,
  isNotifOpen: false,
  transactions: [
    {
      id: 'tx_1001',
      type: 'DEPOSIT',
      amount: 10000.00,
      description: 'UPI Deposit via PhonePe',
      status: 'SUCCESS',
      date: 'Today, 02:15 PM',
      utr: 'UTR849201948201'
    },
    {
      id: 'tx_1002',
      type: 'BET',
      amount: -300.00,
      description: 'Bet on WinDaq Aviator Crash',
      status: 'SUCCESS',
      date: 'Today, 02:30 PM'
    },
    {
      id: 'tx_1003',
      type: 'BET',
      amount: -280.00,
      description: 'Bet on Color Prediction (Green)',
      status: 'SUCCESS',
      date: 'Today, 02:45 PM'
    }
  ],

  setBalance: (amount) => set({ balance: amount }),

  deductBalance: (amount, gameName = 'Game') => {
    const current = get().balance;
    if (current < amount) return false;

    const newBal = parseFloat((current - amount).toFixed(2));
    const newTx: Transaction = {
      id: 'tx_' + Date.now().toString(36),
      type: 'BET',
      amount: -amount,
      description: `Bet on ${gameName}`,
      status: 'SUCCESS',
      date: 'Just now'
    };

    set((state) => ({
      balance: newBal,
      vipPoints: state.vipPoints + Math.floor(amount / 10),
      transactions: [newTx, ...state.transactions]
    }));
    return true;
  },

  addWinnings: (amount, gameName = 'Game', multiplier = 1.0) => {
    const multText = multiplier > 1 ? ` (${multiplier.toFixed(2)}x)` : '';
    const newTx: Transaction = {
      id: 'tx_' + Date.now().toString(36),
      type: 'WIN',
      amount: amount,
      description: `Win in ${gameName}${multText}`,
      status: 'SUCCESS',
      date: 'Just now'
    };

    set((state) => ({
      balance: parseFloat((state.balance + amount).toFixed(2)),
      transactions: [newTx, ...state.transactions]
    }));
  },

  deposit: (amount, utr = '', method = 'UPI') => {
    const genUtr = utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000));
    const newTx: Transaction = {
      id: 'tx_' + Date.now().toString(36),
      type: 'DEPOSIT',
      amount: amount,
      description: `Instant ${method} Deposit`,
      status: 'SUCCESS',
      date: 'Just now',
      utr: genUtr
    };

    set((state) => ({
      balance: parseFloat((state.balance + amount).toFixed(2)),
      transactions: [newTx, ...state.transactions],
      isDepositing: false
    }));
  },

  withdraw: (amount, upiId = 'user@upi') => {
    const current = get().balance;
    if (current < amount) return false;

    const newTx: Transaction = {
      id: 'tx_' + Date.now().toString(36),
      type: 'WITHDRAW',
      amount: -amount,
      description: `Withdrawal to UPI (${upiId})`,
      status: 'SUCCESS',
      date: 'Just now'
    };

    set((state) => ({
      balance: parseFloat((state.balance - amount).toFixed(2)),
      transactions: [newTx, ...state.transactions],
      isWithdrawing: false
    }));
    return true;
  },

  claimSpin: (amount, prizeLabel) => {
    const newTx: Transaction = {
      id: 'tx_' + Date.now().toString(36),
      type: 'SPIN',
      amount: amount,
      description: `Daily Lucky Spin Prize (${prizeLabel})`,
      status: 'SUCCESS',
      date: 'Just now'
    };

    set((state) => ({
      balance: parseFloat((state.balance + amount).toFixed(2)),
      transactions: [newTx, ...state.transactions]
    }));
  },

  claimCashback: (amount) => {
    const newTx: Transaction = {
      id: 'tx_' + Date.now().toString(36),
      type: 'BONUS',
      amount: amount,
      description: `VIP Daily Loss Cashback Credit`,
      status: 'SUCCESS',
      date: 'Just now'
    };

    set((state) => ({
      balance: parseFloat((state.balance + amount).toFixed(2)),
      transactions: [newTx, ...state.transactions]
    }));
  },

  setIsLoggedIn: (status) => set({ isLoggedIn: status }),
  setDepositing: (status) => set({ isDepositing: status }),
  setWithdrawing: (status) => set({ isWithdrawing: status }),
  setSpinOpen: (status) => set({ isSpinOpen: status }),
  setVipOpen: (status) => set({ isVipOpen: status }),
  setReferralOpen: (status) => set({ isReferralOpen: status }),
  setPassbookOpen: (status) => set({ isPassbookOpen: status }),
  setNotifOpen: (status) => set({ isNotifOpen: status }),

  setAuthenticatedUser: (user, initialBalance) => {
    set({
      isLoggedIn: true,
      userId: user.id,
      user: { id: user.id, name: user.isGuest ? 'Test Guest' : `Player_${user.id.slice(-4)}`, phone: user.phone },
      userName: user.isGuest ? 'Test Guest' : `Player_${user.id.slice(-4)}`,
      userPhone: user.phone,
      ...(typeof initialBalance === 'number' ? { balance: initialBalance } : {})
    });
  },

  resetWallet: () => {
    set({
      balance: 0,
      bonusBalance: 0,
      isLoggedIn: false,
      userId: '',
      user: null,
      userName: 'Guest',
      userPhone: '',
      transactions: []
    });
  },

  fetchBalance: async () => {
    try {
      let uid = get().userId;
      let token: string | null = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('windaq_auth_token') || localStorage.getItem('windaq_token');
        if (!uid) {
          uid = localStorage.getItem('windaq_user_id') || (localStorage.getItem('windaq_user_data') ? JSON.parse(localStorage.getItem('windaq_user_data') || '{}').id : null);
        }
      }
      if (!uid && !token) {
        set({ balance: 0 });
        return;
      }

      const headers: Record<string, string> = {};
      if (uid) headers['x-user-id'] = uid;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(getApiUrl('/api/ledger/balance'), { headers });
      const data = await res.json();
      if (data.success && typeof data.balance === 'number') {
        set({ balance: data.balance });
      }
    } catch {
      // Retain optimistic balance if server unreachable
    }
  },
}));
