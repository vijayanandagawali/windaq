"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioEngine } from '@/lib/audioEngine';

export interface ChipFlightData {
  id: string;
  amount: number;
  type: 'BET' | 'POT' | 'WIN' | 'REFUND';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  borderColor?: string;
}

interface AnimatedChipFlightProps {
  flights: ChipFlightData[];
  onFlightComplete?: (id: string) => void;
  isReducedMotion?: boolean;
}

export default function AnimatedChipFlight({
  flights,
  onFlightComplete,
  isReducedMotion = false
}: AnimatedChipFlightProps) {
  useEffect(() => {
    if (flights.length > 0) {
      const first = flights[0];
      if (first.type === 'BET') {
        audioEngine.play('bet');
      } else if (first.type === 'WIN') {
        audioEngine.play('chipDrop');
      }
    }
  }, [flights]);

  if (isReducedMotion || flights.length === 0) {
    return null; // Bypass visual flight on reduced motion
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      <AnimatePresence>
        {flights.map((chip) => (
          <motion.div
            key={chip.id}
            initial={{
              x: chip.startX,
              y: chip.startY,
              scale: 0.6,
              opacity: 1
            }}
            animate={{
              x: chip.endX,
              y: chip.endY,
              scale: [0.6, 1.1, 1],
              opacity: [1, 1, 0.9]
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 18,
              duration: 0.45
            }}
            onAnimationComplete={() => {
              if (onFlightComplete) {
                onFlightComplete(chip.id);
              }
            }}
            className={`absolute w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${
              chip.color || 'from-amber-500 to-amber-700'
            } border-2 ${
              chip.borderColor || 'border-amber-200'
            } shadow-[0_4px_15px_rgba(0,0,0,0.6),0_0_12px_rgba(245,158,11,0.5)] flex items-center justify-center select-none`}
          >
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full border border-dashed border-white/40 flex items-center justify-center">
              <span className="text-[9px] sm:text-[10px] font-black text-white font-mono drop-shadow">
                ₹{chip.amount >= 1000 ? `${(chip.amount / 1000).toFixed(0)}k` : chip.amount}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
