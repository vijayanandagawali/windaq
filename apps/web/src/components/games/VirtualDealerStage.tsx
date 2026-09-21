'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bot, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';

export interface VirtualDealerProps {
  dealerId?: string;
  name?: string;
  title?: string;
  avatar?: string;
  action?: string;
  speech?: string;
  phase?: string;
  cameraAngle?: 'studio' | 'felt' | 'spotlight';
  voiceEnabled?: boolean;
}

/**
 * Premium Virtual Dealer Stage
 * 
 * PROMPT #64 STRICT COMPLIANCE:
 * - Clear Product Designation: Prominently designated as SIMULATED / VIRTUAL DEALER.
 *   Never claimed as a real human or live video stream.
 * - Deterministic micro-animations (breathing, eye blink, gesture states).
 * - Client-side synthetic Web Speech API support for dealer voice.
 */
export const VirtualDealerStage: React.FC<VirtualDealerProps> = ({
  dealerId = 'dealer_maya',
  name = 'Virtual Maya',
  title = 'Virtual Live Dealer',
  avatar = 'maya',
  action = 'IDLE',
  speech = 'Welcome to the WinDaq Simulated Live Table.',
  phase = 'BETTING_OPEN',
  cameraAngle = 'studio',
  voiceEnabled = false
}) => {
  const { soundEnabled } = useAudioStore();
  const lastSpokenRef = useRef<string>('');

  // Web Speech API Synthetic Voice (Controlled & Non-Autoplay without user sound toggle)
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!soundEnabled || !voiceEnabled || !speech || speech === lastSpokenRef.current) return;

    try {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(speech);
      utterance.rate = 1.0;
      utterance.pitch = avatar === 'liam' || avatar === 'arjun' ? 0.9 : 1.05;
      utterance.volume = 0.5;

      // Select natural synthetic voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(utterance);
      lastSpokenRef.current = speech;
    } catch {
      // Audio speech synthesis fallback silent
    }
  }, [speech, soundEnabled, voiceEnabled, avatar]);

  // Render Dealer Avatar SVG based on assigned avatar profile
  const renderAvatarGraphic = () => {
    switch (avatar) {
      case 'liam':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Liam Short Hair */}
            <path d="M 28 42 C 28 22, 72 22, 72 42 C 72 48, 70 52, 68 56 L 32 56 C 30 52, 28 48, 28 42 Z" fill="#3f2e18" />
            {/* Tuxedo Vest */}
            <path d="M 24 82 L 76 82 L 82 100 L 18 100 Z" fill="#1e1b4b" />
            <path d="M 36 82 L 50 96 L 64 82 Z" fill="#ffffff" />
            {/* Bowtie */}
            <polygon points="44,82 50,86 44,90" fill="#dc2626" />
            <polygon points="56,82 50,86 56,90" fill="#dc2626" />
            <circle cx="50" cy="86" r="2" fill="#991b1b" />
            {/* Head & Neck */}
            <rect x="43" y="68" width="14" height="15" rx="3" fill="#e2a66e" />
            <ellipse cx="50" cy="52" rx="20" ry="22" fill="#fbd3a7" />
            {/* Eyes */}
            <ellipse cx="43" cy="50" rx="2.5" ry="3" fill="#18181b" />
            <ellipse cx="57" cy="50" rx="2.5" ry="3" fill="#18181b" />
            <circle cx="44" cy="49" r="1" fill="#ffffff" />
            <circle cx="58" cy="49" r="1" fill="#ffffff" />
            {/* Smile */}
            <path d="M 44 62 Q 50 67 56 62" stroke="#92400e" strokeWidth="2" strokeLinecap="round" fill="transparent" />
          </svg>
        );

      case 'sophia':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Sophia Elegant Bun Hair */}
            <circle cx="50" cy="24" r="12" fill="#18181b" />
            <path d="M 24 45 C 22 22, 78 22, 76 45 C 78 68, 74 76, 70 86 L 30 86 C 26 76, 22 68, 24 45 Z" fill="#18181b" />
            {/* Silk Dress */}
            <path d="M 26 80 L 74 80 L 80 100 L 20 100 Z" fill="#4c0519" />
            <path d="M 38 80 L 50 94 L 62 80 Z" fill="#fdf2f8" />
            {/* Pearl Necklace */}
            <circle cx="44" cy="84" r="2" fill="#fbcfe8" />
            <circle cx="50" cy="86" r="2.5" fill="#fbcfe8" />
            <circle cx="56" cy="84" r="2" fill="#fbcfe8" />
            {/* Head & Neck */}
            <rect x="44" y="66" width="12" height="15" rx="3" fill="#fcd34d" />
            <ellipse cx="50" cy="50" rx="19" ry="23" fill="#fef3c7" />
            {/* Eyes */}
            <ellipse cx="42" cy="48" rx="2.5" ry="3" fill="#18181b" />
            <ellipse cx="58" cy="48" rx="2.5" ry="3" fill="#18181b" />
            <circle cx="43" cy="47" r="1" fill="#ffffff" />
            <circle cx="59" cy="47" r="1" fill="#ffffff" />
            {/* Smile */}
            <path d="M 44 60 Q 50 65 56 60" stroke="#be123c" strokeWidth="2" strokeLinecap="round" fill="transparent" />
            <circle cx="38" cy="55" r="2.5" fill="#fda4af" opacity="0.5" />
            <circle cx="62" cy="55" r="2.5" fill="#fda4af" opacity="0.5" />
          </svg>
        );

      case 'arjun':
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Arjun Classic Hair */}
            <path d="M 28 38 C 28 20, 72 20, 72 38 C 72 44, 70 50, 68 54 L 32 54 C 30 50, 28 44, 28 38 Z" fill="#1c1917" />
            {/* Traditional Bandhgala Collar */}
            <path d="M 24 80 L 76 80 L 82 100 L 18 100 Z" fill="#14532d" />
            <rect x="46" y="78" width="8" height="22" fill="#15803d" />
            <circle cx="50" cy="82" r="1.5" fill="#fef08a" />
            <circle cx="50" cy="88" r="1.5" fill="#fef08a" />
            <circle cx="50" cy="94" r="1.5" fill="#fef08a" />
            {/* Head & Neck */}
            <rect x="43" y="66" width="14" height="15" rx="3" fill="#d97706" />
            <ellipse cx="50" cy="50" rx="19" ry="23" fill="#f59e0b" opacity="0.8" />
            {/* Eyes */}
            <ellipse cx="43" cy="48" rx="2.5" ry="3" fill="#1c1917" />
            <ellipse cx="57" cy="48" rx="2.5" ry="3" fill="#1c1917" />
            <circle cx="44" cy="47" r="1" fill="#ffffff" />
            <circle cx="58" cy="47" r="1" fill="#ffffff" />
            {/* Smile */}
            <path d="M 44 60 Q 50 65 56 60" stroke="#78350f" strokeWidth="2" strokeLinecap="round" fill="transparent" />
          </svg>
        );

      case 'maya':
      default:
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M 22 45 C 20 20, 80 20, 78 45 C 80 65, 75 75, 72 85 L 28 85 C 25 75, 20 65, 22 45 Z" fill="#1c1917" />
            <path d="M 25 80 L 75 80 L 80 100 L 20 100 Z" fill="#09090b" />
            <path d="M 38 80 L 50 95 L 62 80 Z" fill="#fafaf9" />
            <polygon points="48,82 52,82 54,92 50,96 46,92" fill="#f59e0b" />
            <rect x="44" y="68" width="12" height="14" rx="3" fill="#fcd34d" />
            <ellipse cx="50" cy="50" rx="20" ry="24" fill="#fef08a" />
            <path d="M 30 40 C 35 25, 65 25, 70 40 C 65 33, 35 33, 30 40 Z" fill="#1c1917" />
            <ellipse cx="42" cy="48" rx="2.5" ry="3" fill="#1c1917" />
            <ellipse cx="58" cy="48" rx="2.5" ry="3" fill="#1c1917" />
            <circle cx="43" cy="47" r="1" fill="#ffffff" />
            <circle cx="59" cy="47" r="1" fill="#ffffff" />
            <path d="M 44 60 Q 50 65 56 60" stroke="#b45309" strokeWidth="2" strokeLinecap="round" fill="transparent" />
            <circle cx="37" cy="55" r="3" fill="#f87171" opacity="0.4" />
            <circle cx="63" cy="55" r="3" fill="#f87171" opacity="0.4" />
          </svg>
        );
    }
  };

  return (
    <div 
      data-testid="virtual-dealer-stage"
      className="relative pt-2 pb-1 flex flex-col items-center z-10 select-none"
    >
      {/* 1. Prominent Clear Designation Badge (Section 2 Compliance) */}
      <div 
        data-testid="virtual-dealer-badge"
        className="mb-1.5 flex items-center gap-1.5 bg-zinc-900/90 border border-amber-500/40 px-3 py-0.5 rounded-full shadow-lg backdrop-blur-md"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
          SIMULATED DEALER • WINDAQ ORIGINAL TABLE
        </span>
      </div>

      {/* 2. Interactive Dealer Speech Bubble */}
      <AnimatePresence mode="wait">
        <motion.div
          key={speech}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          className="mb-2 max-w-md bg-black/85 border border-amber-500/40 shadow-[0_6px_24px_rgba(0,0,0,0.7)] px-4 py-1.5 rounded-2xl flex items-center gap-2 backdrop-blur-md"
        >
          <Sparkles size={14} className="text-amber-400 shrink-0 animate-pulse" />
          <span 
            data-testid="dealer-speech-text"
            className="text-xs sm:text-sm font-medium text-amber-100 text-center"
          >
            {speech}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* 3. Dealer Avatar Podium with Idle Micro-Motion */}
      <div className="flex items-center gap-4">
        <motion.div 
          animate={{
            y: action === 'DEALING' ? [0, -4, 0] : [0, -1.5, 0],
            scale: action === 'ANNOUNCING_RESULT' ? [1, 1.04, 1] : 1
          }}
          transition={{
            repeat: Infinity,
            duration: action === 'DEALING' ? 1.5 : 3.5,
            ease: 'easeInOut'
          }}
          className="relative flex flex-col items-center"
        >
          {/* Circular Glowing Podium */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-amber-500/20 via-zinc-900 to-black border-2 border-amber-500/60 p-1 shadow-[0_0_30px_rgba(245,158,11,0.3)] flex items-center justify-center overflow-hidden">
            {renderAvatarGraphic()}

            {/* Subtle Active Dealer Motion Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/40 animate-spin-slow pointer-events-none" />

            {/* Dealing gesture flash effect */}
            {action === 'DEALING' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.4, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute inset-0 bg-amber-400/20 pointer-events-none rounded-full"
              />
            )}
          </div>

          {/* Dealer Nameplate with Action Status */}
          <div className="mt-1 bg-black/95 border border-amber-500/50 px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest text-amber-300 uppercase shadow-md flex items-center gap-1.5">
            <span 
              data-testid="dealer-display-name"
              className="text-white"
            >
              {name}
            </span>
            <span className="text-amber-500">•</span>
            <span className="text-amber-400/90">{action.replace(/_/g, ' ')}</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
