import { create } from 'zustand';

/**
 * Tracks whether games can actually reach the authoritative game server.
 * - isSimulated: a game is running on the in-browser simulator (VirtualGameSocket).
 * - isServerOffline: the real game server connection is failing.
 * While either is true, the UI must say so plainly.
 */
interface DemoModeState {
  isSimulated: boolean;
  isServerOffline: boolean;
  markSimulated: () => void;
  setServerOffline: (offline: boolean) => void;
}

export const useDemoModeStore = create<DemoModeState>((set) => ({
  isSimulated: false,
  isServerOffline: false,
  markSimulated: () => set({ isSimulated: true }),
  setServerOffline: (offline) => set({ isServerOffline: offline })
}));
