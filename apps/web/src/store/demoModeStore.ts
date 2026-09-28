import { create } from 'zustand';

/**
 * Tracks whether games can reach the authoritative game server.
 * While the connection is failing the UI must say so plainly.
 */
interface DemoModeState {
  isServerOffline: boolean;
  setServerOffline: (offline: boolean) => void;
}

export const useDemoModeStore = create<DemoModeState>((set) => ({
  isServerOffline: false,
  setServerOffline: (offline) => set({ isServerOffline: offline })
}));
