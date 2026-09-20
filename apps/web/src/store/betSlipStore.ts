import { create } from 'zustand';

export interface BetSlipSelection {
  gameType: string;
  referenceId: string;
  market: string;
  selection: string;
  type: 'BACK' | 'LAY';
  odds: number;
}

interface BetSlipState {
  selection: BetSlipSelection | null;
  stake: number;
  isOpen: boolean;
  status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR';
  errorMessage: string | null;

  setSelection: (selection: BetSlipSelection) => void;
  clearSelection: () => void;
  setStake: (amount: number) => void;
  open: () => void;
  close: () => void;
  
  setStatus: (status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR', msg?: string) => void;
}

export const useBetSlipStore = create<BetSlipState>((set) => ({
  selection: null,
  stake: 1000,
  isOpen: false,
  status: 'IDLE',
  errorMessage: null,

  setSelection: (selection) => set({ selection, isOpen: true, status: 'IDLE', errorMessage: null }),
  clearSelection: () => set({ selection: null, isOpen: false, status: 'IDLE', errorMessage: null }),
  setStake: (stake) => set({ stake, status: 'IDLE' }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setStatus: (status, msg = null) => set({ status, errorMessage: msg })
}));
