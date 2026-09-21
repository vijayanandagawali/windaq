import { create } from 'zustand';
import { getApiUrl, createGameSocket } from '@/lib/config';
import toast from 'react-hot-toast';

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'WITHDRAWAL' | 'BET' | 'BET_PLACE' | 'WIN' | 'BET_WIN' | 'BONUS' | 'REFUND' | 'SPIN' | string;
  amount: number;
  amountPaise?: string;
  balanceAfter?: number;
  description: string;
  status: 'SUCCESS' | 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED' | string;
  date: string;
  reference?: string;
  utr?: string;
  idempotencyKey?: string;
  ledger?: any;
}

interface WalletState {
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  pendingDeposit: number;
  pendingWithdrawal: number;
  bonusBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWon: number;
  totalLost: number;

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
  isLoading: boolean;

  // Actions
  setBalance: (amount: number) => void;
  deductBalance: (amount: number, gameName?: string) => boolean;
  addWinnings: (amount: number, gameName?: string, multiplier?: number) => void;
  deposit: (amount: number, utr?: string, method?: string) => Promise<boolean>;
  withdraw: (amount: number, upiId?: string) => Promise<boolean>;
  submitDeposit: (amount: number, utr?: string, method?: string, idempotencyKey?: string) => Promise<{ success: boolean; data?: any; message?: string }>;
  submitWithdraw: (amount: number, upiId: string, method?: string, idempotencyKey?: string) => Promise<{ success: boolean; data?: any; message?: string }>;
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
  fetchBalance: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  initRealtimeSync: () => void;
}

let socketInitialized = false;

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  availableBalance: 0,
  lockedBalance: 0,
  pendingDeposit: 0,
  pendingWithdrawal: 0,
  bonusBalance: 0,
  totalDeposited: 0,
  totalWithdrawn: 0,
  totalWon: 0,
  totalLost: 0,

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
  transactions: [],
  isLoading: false,

  setBalance: (amount) => set({ balance: amount, availableBalance: amount - get().lockedBalance }),

  deductBalance: (amount, gameName = 'Game') => {
    const currentAvailable = get().availableBalance || get().balance;
    if (currentAvailable < amount) return false;

    // Trigger asynchronous authoritative refresh
    setTimeout(() => get().fetchBalance(), 300);
    return true;
  },

  addWinnings: (amount, gameName = 'Game', multiplier = 1.0) => {
    // Trigger asynchronous authoritative refresh
    setTimeout(() => get().fetchBalance(), 300);
  },

  submitDeposit: async (amount, utr = '', method = 'UPI', idempotencyKey) => {
    const uid = get().userId || (typeof window !== 'undefined' ? localStorage.getItem('windaq_user_id') : null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('windaq_auth_token') : null;

    try {
      const res = await fetch(getApiUrl('/api/ledger/deposit/instant'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(uid ? { 'x-user-id': uid } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ amount, utr, method, idempotencyKey })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await get().fetchBalance();
        await get().fetchTransactions();
        return { success: true, data: data.data, message: data.message };
      }
      return { success: false, message: data.message || 'Deposit submission failed' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error during deposit' };
    }
  },

  deposit: async (amount, utr = '', method = 'UPI') => {
    const res = await get().submitDeposit(amount, utr, method);
    if (res.success) {
      set({ isDepositing: false });
      return true;
    }
    return false;
  },

  submitWithdraw: async (amount, upiId, method = 'UPI', idempotencyKey) => {
    const uid = get().userId || (typeof window !== 'undefined' ? localStorage.getItem('windaq_user_id') : null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('windaq_auth_token') : null;

    try {
      const res = await fetch(getApiUrl('/api/ledger/withdraw/instant'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(uid ? { 'x-user-id': uid } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ amount, upiId, method, idempotencyKey })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await get().fetchBalance();
        await get().fetchTransactions();
        return { success: true, data: data.data, message: data.message };
      }
      return { success: false, message: data.message || 'Withdrawal request failed' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error during withdrawal' };
    }
  },

  withdraw: async (amount, upiId = 'user@upi') => {
    const res = await get().submitWithdraw(amount, upiId);
    if (res.success) {
      set({ isWithdrawing: false });
      return true;
    }
    return false;
  },

  claimSpin: (amount, prizeLabel) => {
    setTimeout(() => get().fetchBalance(), 300);
  },

  claimCashback: (amount) => {
    setTimeout(() => get().fetchBalance(), 300);
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
      ...(typeof initialBalance === 'number' ? { balance: initialBalance, availableBalance: initialBalance } : {})
    });
    get().fetchBalance();
    get().fetchTransactions();
    get().initRealtimeSync();
  },

  resetWallet: () => {
    set({
      balance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      pendingDeposit: 0,
      pendingWithdrawal: 0,
      bonusBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalWon: 0,
      totalLost: 0,
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
        set({ balance: 0, availableBalance: 0 });
        return;
      }

      const headers: Record<string, string> = {};
      if (uid) headers['x-user-id'] = uid;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(getApiUrl('/api/ledger/balance'), { headers });
      const data = await res.json();
      if (data.success && typeof data.balance === 'number') {
        set({ 
          balance: data.balance,
          availableBalance: typeof data.availableBalance === 'number' ? data.availableBalance : data.balance,
          lockedBalance: typeof data.lockedBalance === 'number' ? data.lockedBalance : 0,
          pendingDeposit: typeof data.pendingDeposit === 'number' ? data.pendingDeposit : 0,
          pendingWithdrawal: typeof data.pendingWithdrawal === 'number' ? data.pendingWithdrawal : 0,
          bonusBalance: typeof data.bonusBalance === 'number' ? data.bonusBalance : 0,
          totalDeposited: typeof data.totalDeposited === 'number' ? data.totalDeposited : 0,
          totalWithdrawn: typeof data.totalWithdrawn === 'number' ? data.totalWithdrawn : 0,
          totalWon: typeof data.totalWon === 'number' ? data.totalWon : 0,
          totalLost: typeof data.totalLost === 'number' ? data.totalLost : 0
        });
      }
    } catch {
      // Retain previous authoritative balance
    }
  },

  fetchTransactions: async () => {
    try {
      let uid = get().userId;
      let token: string | null = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('windaq_auth_token');
        if (!uid) {
          uid = localStorage.getItem('windaq_user_id') || (localStorage.getItem('windaq_user_data') ? JSON.parse(localStorage.getItem('windaq_user_data') || '{}').id : null);
        }
      }
      if (!uid && !token) return;

      const headers: Record<string, string> = {};
      if (uid) headers['x-user-id'] = uid;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(getApiUrl('/api/ledger/transactions?limit=30'), { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        set({ transactions: data.data });
      }
    } catch {
      // ignore
    }
  },

  initRealtimeSync: () => {
    if (socketInitialized || typeof window === 'undefined') return;
    try {
      const s = createGameSocket();
      s.on('WALLET_UPDATED', (payload: any) => {
        get().fetchBalance();
        get().fetchTransactions();
      });
      s.on('DEPOSIT_COMPLETED', (payload: any) => {
        toast.success(`₹${payload.amount} deposited successfully!`, { icon: '💰' });
        get().fetchBalance();
        get().fetchTransactions();
      });
      s.on('WITHDRAWAL_CREATED', (payload: any) => {
        get().fetchBalance();
        get().fetchTransactions();
      });
      s.on('WITHDRAWAL_COMPLETED', (payload: any) => {
        toast.success(`Withdrawal of ₹${payload.amount} completed!`, { icon: '✅' });
        get().fetchBalance();
        get().fetchTransactions();
      });
      s.on('WITHDRAWAL_REVERSED', (payload: any) => {
        toast.error(`Withdrawal of ₹${payload.amount} reversed: ${payload.reason || 'Restored'}`, { icon: '↩️' });
        get().fetchBalance();
        get().fetchTransactions();
      });
      socketInitialized = true;
    } catch {
      // ignore
    }
  }
}));
