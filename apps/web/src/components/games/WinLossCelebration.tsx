"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audioEngine } from '@/lib/audioEngine';

export interface CelebrationState {
  type: 'win' | 'loss';
  amount: number;
  multiplier?: string;
  message?: string;
  /** Payout minus total stake for the round, when known. */
  net?: number;
}

export interface WinLossCelebrationProps {
  status?: 'IDLE' | 'WON' | 'LOST';
  amount?: number;
  multiplier?: number;
  message?: string;
  /** Payout minus total stake for the round. A non-positive net is shown as a return, not a win. */
  net?: number;
  onDismiss?: () => void;
  autoDismissMs?: number;
  celebration?: CelebrationState | null;
  onComplete?: () => void;
}

/** Counts from 0 to `target` with an ease-out curve. */
function useCountUp(target: number, active: boolean, durationMs = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);
  return active ? value : 0;
}

const BRAND_CONFETTI = ['#0EA5E9', '#10B981', '#2DD4BF', '#FBBF24', '#FFFFFF'];

export default function WinLossCelebration({
  status,
  amount = 0,
  multiplier = 1,
  message,
  net,
  onDismiss,
  autoDismissMs = 3600,
  celebration,
  onComplete
}: WinLossCelebrationProps) {
  const effectiveStatus: 'IDLE' | 'WON' | 'LOST' = status
    ? status
    : (celebration ? (celebration.type === 'win' ? 'WON' : 'LOST') : 'IDLE');
  const effectiveAmount = amount || celebration?.amount || 0;
  const effectiveMultiplier = multiplier !== 1
    ? multiplier
    : (celebration?.multiplier ? parseFloat(celebration.multiplier) : 1);
  const effectiveMessage = message || celebration?.message;
  const effectiveNet = typeof net === 'number' ? net : celebration?.net;
  const realGain = effectiveNet === undefined || effectiveNet > 0.004;

  const won = effectiveStatus === 'WON';
  const shown = useCountUp(effectiveAmount, won);
  const tier = !realGain ? 'STAKE RETURNED' : effectiveMultiplier >= 10 ? 'MEGA WIN' : effectiveMultiplier >= 5 ? 'BIG WIN' : 'YOU WIN';

  const dismissRef = useRef<() => void>(() => {});
  useEffect(() => {
    dismissRef.current = () => {
      onDismiss?.();
      onComplete?.();
    };
  }, [onDismiss, onComplete]);

  useEffect(() => {
    if (effectiveStatus === 'IDLE') return;
    if (effectiveStatus === 'WON') {
      try { audioEngine.play('win'); } catch {}
      try {
        const big = effectiveMultiplier >= 5;
        if (!realGain) throw new Error('no confetti for a returned stake');
        confetti({ particleCount: big ? 140 : 80, spread: big ? 100 : 70, startVelocity: 42, origin: { y: 0.55 }, colors: BRAND_CONFETTI, scalar: 1.05 });
        setTimeout(() => {
          confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: BRAND_CONFETTI });
          confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: BRAND_CONFETTI });
        }, 280);
      } catch {}
    } else {
      try { audioEngine.play('loss'); } catch {}
    }
    if (autoDismissMs > 0) {
      const t = setTimeout(() => dismissRef.current(), effectiveStatus === 'WON' ? autoDismissMs : Math.min(autoDismissMs, 2200));
      return () => clearTimeout(t);
    }
  }, [effectiveStatus, effectiveAmount, effectiveMultiplier, autoDismissMs, realGain]);

  return (
    <AnimatePresence>
      {won && (
        <motion.div key="win" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => dismissRef.current()} role="status" aria-live="polite">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[3px]" />
          {/* Sweeping light rays behind the card */}
          <div aria-hidden="true" className="wd-rays absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-60"
            style={{ background: 'repeating-conic-gradient(from 0deg, rgba(14,165,233,0.16) 0deg 8deg, transparent 8deg 22deg)', maskImage: 'radial-gradient(circle, black 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)' }} />

          <motion.div initial={{ scale: 0.6, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 14, stiffness: 220 }}
            className="relative w-full max-w-xs overflow-hidden rounded-[28px] bg-white p-7 text-center shadow-[0_30px_80px_rgba(14,165,233,0.35)] ring-1 ring-sky-100">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-500" />
            <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 12 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_12px_30px_rgba(245,158,11,0.45)]">
              <Trophy className="h-9 w-9 text-white" />
            </motion.div>
            <p className="mt-4 text-xs font-black tracking-[0.3em] text-sky-600">{tier}</p>
            <p className="mt-1 bg-gradient-to-r from-sky-600 via-teal-500 to-emerald-600 bg-clip-text font-mono text-4xl font-black tabular-nums text-transparent">
              +₹{shown.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {effectiveNet !== undefined && (
              <p className={`mt-1 text-sm font-bold ${realGain ? 'text-emerald-600' : 'text-slate-500'}`}>
                Net {effectiveNet >= 0 ? '+' : '−'}₹{Math.abs(effectiveNet).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this round
              </p>
            )}
            {effectiveMultiplier > 1 && realGain && (
              <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                {effectiveMultiplier.toFixed(2)}x payout
              </span>
            )}
            {effectiveMessage && <p className="mt-3 text-sm font-semibold text-slate-600">{effectiveMessage}</p>}
            <p className="mt-4 text-[11px] text-slate-400">Added to your wallet · tap to continue</p>
          </motion.div>
        </motion.div>
      )}

      {effectiveStatus === 'LOST' && (
        <motion.div key="loss" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4 lg:bottom-8" role="status" aria-live="polite">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_14px_36px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 backdrop-blur" onClick={() => dismissRef.current()}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg">🎲</span>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">{effectiveMessage || 'No win this round'}</p>
              <p className="text-[11px] text-slate-500">Next round starts shortly{effectiveAmount ? ` · stake ₹${effectiveAmount.toLocaleString('en-IN')}` : ''}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
