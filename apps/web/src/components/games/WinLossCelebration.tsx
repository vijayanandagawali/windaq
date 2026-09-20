"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, AlertCircle, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audioEngine } from '@/lib/audioEngine';

export interface CelebrationState {
  type: 'win' | 'loss';
  amount: number;
  multiplier?: string;
  message?: string;
}

export interface WinLossCelebrationProps {
  status?: 'IDLE' | 'WON' | 'LOST';
  amount?: number;
  multiplier?: number;
  message?: string;
  onDismiss?: () => void;
  autoDismissMs?: number;
  celebration?: CelebrationState | null;
  onComplete?: () => void;
}

export default function WinLossCelebration({
  status,
  amount = 0,
  multiplier = 1,
  message,
  onDismiss,
  autoDismissMs = 3500,
  celebration,
  onComplete
}: WinLossCelebrationProps) {
  // Normalize polymorphic props
  const effectiveStatus: 'IDLE' | 'WON' | 'LOST' = status 
    ? status 
    : (celebration ? (celebration.type === 'win' ? 'WON' : 'LOST') : 'IDLE');

  const effectiveAmount = amount || celebration?.amount || 0;
  
  const effectiveMultiplier = multiplier !== 1 
    ? multiplier 
    : (celebration?.multiplier ? parseFloat(celebration.multiplier) : 1);

  const effectiveMessage = message || celebration?.message;

  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    if (onComplete) onComplete();
  };

  useEffect(() => {
    if (effectiveStatus === 'WON') {
      // 1. Play high-fidelity victory sound
      try {
        audioEngine.play('win');
      } catch {}

      // 2. Multi-cannon golden + emerald confetti blast
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#26F0B2', '#F59E0B', '#10B981', '#FBBF24', '#FFFFFF']
        });

        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#F59E0B', '#26F0B2', '#E11D48']
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#F59E0B', '#26F0B2', '#E11D48']
          });
        }, 250);
      } catch {}

      // 3. Auto dismiss
      if (autoDismissMs > 0) {
        const timer = setTimeout(handleDismiss, autoDismissMs);
        return () => clearTimeout(timer);
      }
    } else if (effectiveStatus === 'LOST') {
      // 1. Play soft low-frequency loss audio
      try {
        audioEngine.play('loss');
      } catch {}

      // 2. Auto dismiss
      if (autoDismissMs > 0) {
        const timer = setTimeout(handleDismiss, Math.min(autoDismissMs, 2500));
        return () => clearTimeout(timer);
      }
    }
  }, [effectiveStatus, effectiveAmount, effectiveMultiplier, autoDismissMs]);

  return (
    <AnimatePresence>
      {effectiveStatus === 'WON' && (
        <motion.div
          key="win-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4"
        >
          {/* Subtle gold/emerald radial aura */}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-amber-950/20 pointer-events-none" />

          {/* Glowing Win Card */}
          <motion.div
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: [0.7, 1.06, 1], y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 15, stiffness: 250 }}
            className="relative pointer-events-auto bg-slate-950/95 border-2 border-emerald-400/80 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-[0_0_60px_rgba(16,185,129,0.45)] text-center backdrop-blur-xl overflow-hidden"
          >
            {/* Ambient Shimmer Beam */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Floating Crown/Trophy */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_25px_rgba(245,158,11,0.6)] mb-3 border border-amber-200">
              <Trophy className="w-9 h-9 text-slate-950 fill-slate-950" />
            </div>

            <div className="flex items-center justify-center gap-1.5 text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{effectiveMessage || 'BIG VICTORY!'}</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-100 to-emerald-400 tracking-tight mb-2 drop-shadow-[0_0_15px_rgba(38,240,178,0.5)]">
              +₹{effectiveAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>

            {effectiveMultiplier > 1 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono shadow-sm">
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{effectiveMultiplier.toFixed(2)}x PAYOUT</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-3">
              Funds credited to your WinDaq wallet ledger instantly.
            </p>
          </motion.div>
        </motion.div>
      )}

      {effectiveStatus === 'LOST' && (
        <motion.div
          key="loss-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4 shadow-[inset_0_0_80px_rgba(239,68,68,0.35)]"
        >
          {/* Subtle screen shake on loss */}
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: [-8, 8, -6, 6, -3, 3, 0] }}
            transition={{ duration: 0.4 }}
            className="relative pointer-events-auto bg-slate-950/90 border border-red-500/40 rounded-2xl py-3 px-6 shadow-[0_0_30px_rgba(239,68,68,0.3)] text-center backdrop-blur-md flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-red-400 font-bold text-xs uppercase tracking-wider">
                {effectiveMessage || 'Round Concluded'}
              </div>
              <div className="text-slate-400 text-[11px]">
                Better luck next round. Play responsibly!
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
