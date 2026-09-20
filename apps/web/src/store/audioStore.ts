import { create } from 'zustand';
import { audioEngine, SoundEvent } from '@/lib/audioEngine';

interface AudioState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  volume: number;
  reducedMotion: boolean;
  isControlsOpen: boolean;

  // Actions
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleHaptics: () => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setControlsOpen: (isOpen: boolean) => void;
  play: (event: SoundEvent, extraParams?: { urgent?: boolean }) => void;
}

// Read initial state safely from localStorage
const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val === 'true' : defaultValue;
  } catch {
    return defaultValue;
  }
};

const getStoredNumber = (key: string, defaultValue: number): number => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = localStorage.getItem(key);
    if (val !== null) {
      const num = parseFloat(val);
      return !isNaN(num) ? Math.max(0, Math.min(1, num)) : defaultValue;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
};

const initialSoundEnabled = getStoredBoolean('windaq_sound_enabled', true);
const initialHapticsEnabled = getStoredBoolean('windaq_haptics_enabled', true);
const initialVolume = getStoredNumber('windaq_volume', 0.7);

// Initialize audioEngine with saved values
if (typeof window !== 'undefined') {
  audioEngine.setSoundEnabled(initialSoundEnabled);
  audioEngine.setHapticsEnabled(initialHapticsEnabled);
  audioEngine.setVolume(initialVolume);
}

export const useAudioStore = create<AudioState>((set, get) => ({
  soundEnabled: initialSoundEnabled,
  hapticsEnabled: initialHapticsEnabled,
  volume: initialVolume,
  reducedMotion: audioEngine.isReducedMotion(),
  isControlsOpen: false,

  toggleSound: () => {
    const next = !get().soundEnabled;
    audioEngine.setSoundEnabled(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('windaq_sound_enabled', String(next));
      } catch {}
    }
    set({ soundEnabled: next });
    if (next) {
      audioEngine.play('click');
    }
  },

  setSoundEnabled: (enabled: boolean) => {
    audioEngine.setSoundEnabled(enabled);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('windaq_sound_enabled', String(enabled));
      } catch {}
    }
    set({ soundEnabled: enabled });
  },

  toggleHaptics: () => {
    const next = !get().hapticsEnabled;
    audioEngine.setHapticsEnabled(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('windaq_haptics_enabled', String(next));
      } catch {}
    }
    set({ hapticsEnabled: next });
    if (next) {
      audioEngine.vibrate(20);
    }
  },

  setHapticsEnabled: (enabled: boolean) => {
    audioEngine.setHapticsEnabled(enabled);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('windaq_haptics_enabled', String(enabled));
      } catch {}
    }
    set({ hapticsEnabled: enabled });
  },

  setVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    audioEngine.setVolume(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('windaq_volume', String(clamped));
      } catch {}
    }
    set({ volume: clamped });
  },

  setControlsOpen: (isOpen: boolean) => {
    set({ isControlsOpen: isOpen });
  },

  play: (event: SoundEvent, extraParams?: { urgent?: boolean }) => {
    audioEngine.play(event, extraParams);
  }
}));

if (typeof window !== 'undefined') {
  (window as any).useAudioStore = useAudioStore;
}
