"use client";

import React from 'react';
import { Volume2, VolumeX, Smartphone, Sliders, X, Sparkles, Accessibility, Check } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';

export default function AudioControlsModal() {
  const {
    soundEnabled,
    hapticsEnabled,
    volume,
    reducedMotion,
    isControlsOpen,
    toggleSound,
    toggleHaptics,
    setVolume,
    setControlsOpen,
    play
  } = useAudioStore();

  if (!isControlsOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={() => setControlsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-settings-title"
    >
      <div 
        className="relative w-full max-w-sm bg-[#0c121e]/95 border border-white/15 rounded-3xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-neon-mint/15 border border-neon-mint/30 flex items-center justify-center text-neon-mint shadow-[0_0_12px_rgba(0,255,163,0.3)]">
              <Sliders size={16} />
            </div>
            <div>
              <h2 id="audio-settings-title" className="text-sm font-black text-white uppercase tracking-wider">
                Sound & Haptics
              </h2>
              <p className="text-[10px] text-gray-400 font-medium">Arcade Audio & Tactile Engine</p>
            </div>
          </div>

          <button
            onClick={() => setControlsOpen(false)}
            className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Audio Settings"
          >
            <X size={14} />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Sound Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                soundEnabled 
                  ? 'bg-neon-mint/20 text-neon-mint border border-neon-mint/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
              <div>
                <div className="text-xs font-bold text-white">Sound Effects</div>
                <div className="text-[10px] text-gray-400">
                  {soundEnabled ? 'Zero-latency procedural audio' : 'All game audio muted'}
                </div>
              </div>
            </div>

            <button
              onClick={toggleSound}
              data-testid="audio-toggle-sound-btn"
              role="switch"
              aria-checked={soundEnabled}
              aria-label="Toggle Sound Effects"
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                soundEnabled ? 'bg-neon-mint' : 'bg-gray-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-[#0c121e] absolute top-0.5 transition-transform ${
                soundEnabled ? 'translate-x-6.5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Volume Slider */}
          <div className={`p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2 transition-opacity ${
            soundEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-gray-300">Master Volume</span>
              <span className="text-neon-mint font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              data-testid="audio-volume-slider"
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-mint"
              aria-label="Master Volume Slider"
            />
          </div>

          {/* Mobile Haptic Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                hapticsEnabled 
                  ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' 
                  : 'bg-gray-700/50 text-gray-500 border border-white/5'
              }`}>
                <Smartphone size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Mobile Haptics</div>
                <div className="text-[10px] text-gray-400">Vibration pulses on bet & win</div>
              </div>
            </div>

            <button
              onClick={toggleHaptics}
              data-testid="audio-toggle-haptics-btn"
              role="switch"
              aria-checked={hapticsEnabled}
              aria-label="Toggle Mobile Haptic Feedback"
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                hapticsEnabled ? 'bg-amber-400' : 'bg-gray-700'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-[#0c121e] absolute top-0.5 transition-transform ${
                hapticsEnabled ? 'translate-x-6.5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Sound Preview Pad */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Test Sound Effects</div>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { label: 'Click', event: 'click' as const },
                { label: 'Bet', event: 'bet' as const },
                { label: 'Accept', event: 'accepted' as const },
                { label: 'Win', event: 'win' as const },
                { label: 'Jackpot', event: 'jackpot' as const },
              ].map(({ label, event }) => (
                <button
                  key={event}
                  onClick={() => play(event)}
                  className="py-1.5 px-1 rounded-xl bg-white/5 hover:bg-neon-mint/15 border border-white/10 hover:border-neon-mint/40 text-[10px] font-bold text-gray-200 hover:text-neon-mint transition-all cursor-pointer active:scale-95 text-center"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Accessibility & Reduced Motion Status */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-[10px] text-gray-400">
            <Accessibility size={14} className={reducedMotion ? 'text-neon-mint' : 'text-gray-500'} />
            <div className="flex-1">
              <span className="font-bold text-gray-300">Accessibility: </span>
              {reducedMotion 
                ? 'Reduced motion detected. Haptics & transients softened.' 
                : 'Standard dynamic motion active.'}
            </div>
            {reducedMotion && <Check size={12} className="text-neon-mint shrink-0" />}
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={() => setControlsOpen(false)}
          className="w-full py-2.5 rounded-xl bg-neon-mint text-deep-ocean font-black text-xs uppercase tracking-wider hover:bg-[#1ed49c] transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,163,0.3)] active:scale-95"
        >
          Done
        </button>
      </div>
    </div>
  );
}
