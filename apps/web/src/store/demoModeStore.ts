import { create } from 'zustand';

/**
 * Tracks whether any game is running on the in-browser simulator (VirtualGameSocket)
 * instead of the authoritative game server. While active, the UI must say so plainly.
 */
interface DemoModeState {
  isSimulated: boolean;
  markSimulated: () => void;
}

export const useDemoModeStore = create<DemoModeState>((set) => ({
  isSimulated: false,
  markSimulated: () => set({ isSimulated: true })
}));
