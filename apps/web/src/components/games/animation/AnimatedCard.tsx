"use client";

import React from 'react';
import { motion } from 'framer-motion';

export interface CardData {
  suit: 'S' | 'H' | 'D' | 'C' | string;
  rank: number | string; // 2-14 or 'A', 'K', 'Q', 'J', '10'
}

interface AnimatedCardProps {
  card?: CardData | null;
  isRevealed?: boolean;
  isWinner?: boolean;
  isLoser?: boolean;
  dealDelay?: number;
  dealFrom?: { x: number; y: number };
  size?: 'sm' | 'md' | 'lg';
  isReducedMotion?: boolean;
  className?: string;
}

export default function AnimatedCard({
  card,
  isRevealed = false,
  isWinner = false,
  isLoser = false,
  dealDelay = 0,
  dealFrom = { x: 80, y: -120 },
  size = 'md',
  isReducedMotion = false,
  className = ''
}: AnimatedCardProps) {
  // Dimension tokens
  const sizeClasses = {
    sm: 'w-12 h-16 sm:w-14 sm:h-20 text-xs',
    md: 'w-16 h-24 sm:w-20 sm:h-30 text-sm',
    lg: 'w-20 h-28 sm:w-24 sm:h-36 text-base'
  };

  const suitIcons: Record<string, { icon: string; color: string }> = {
    'S': { icon: '♠', color: 'text-zinc-900' },
    'H': { icon: '♥', color: 'text-red-600' },
    'D': { icon: '♦', color: 'text-red-600' },
    'C': { icon: '♣', color: 'text-zinc-900' },
    's': { icon: '♠', color: 'text-zinc-900' },
    'h': { icon: '♥', color: 'text-red-600' },
    'd': { icon: '♦', color: 'text-red-600' },
    'c': { icon: '♣', color: 'text-zinc-900' }
  };

  const rankLabels: Record<string, string> = {
    '14': 'A', '13': 'K', '12': 'Q', '11': 'J', '10': '10',
    'A': 'A', 'K': 'K', 'Q': 'Q', 'J': 'J', 'T': '10'
  };

  const suitKey = card?.suit || 'S';
  const suitInfo = suitIcons[suitKey] || { icon: '♠', color: 'text-zinc-900' };
  const rawRank = String(card?.rank || 'A');
  const label = rankLabels[rawRank] || rawRank;

  // Reduced motion configuration: skip 3D spin and slide, transition immediately
  const initialMotion = isReducedMotion
    ? { opacity: 0 }
    : { x: dealFrom.x, y: dealFrom.y, scale: 0.7, opacity: 0, rotateY: isRevealed ? 0 : 180 };

  const animateMotion = isReducedMotion
    ? { opacity: 1 }
    : {
        x: 0,
        y: 0,
        scale: isWinner ? 1.06 : 1,
        opacity: isLoser ? 0.45 : 1,
        rotateY: isRevealed ? 0 : 180
      };

  return (
    <div className={`relative perspective-1000 ${sizeClasses[size]} ${className}`}>
      <motion.div
        initial={initialMotion}
        animate={animateMotion}
        transition={{
          type: "spring",
          stiffness: isReducedMotion ? 400 : 190,
          damping: isReducedMotion ? 30 : 20,
          delay: isReducedMotion ? 0 : dealDelay
        }}
        style={{ transformStyle: 'preserve-3d' }}
        className={`w-full h-full rounded-xl select-none transition-shadow duration-300 relative ${
          isWinner 
            ? 'ring-4 ring-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.8)] z-20' 
            : isLoser 
            ? 'grayscale-[30%] opacity-50 shadow-none' 
            : 'shadow-[0_12px_28px_rgba(0,0,0,0.7)]'
        }`}
      >
        {/* FRONT FACE (Revealed Card) */}
        <div
          style={{ backfaceVisibility: 'hidden' }}
          className="absolute inset-0 w-full h-full rounded-xl bg-gradient-to-b from-white via-zinc-50 to-zinc-200 border-2 border-zinc-300 p-1.5 sm:p-2 flex flex-col justify-between overflow-hidden shadow-inner"
        >
          {/* Top Left pip */}
          <div className="flex items-center justify-between leading-none">
            <span className={`font-black ${suitInfo.color}`}>{label}</span>
            <span className={`text-xs sm:text-sm ${suitInfo.color}`}>{suitInfo.icon}</span>
          </div>

          {/* Center Suit Watermark */}
          <div className={`text-2xl sm:text-4xl self-center ${suitInfo.color} drop-shadow-sm pointer-events-none`}>
            {suitInfo.icon}
          </div>

          {/* Bottom Right pip (rotated 180) */}
          <div className="flex items-center justify-between leading-none rotate-180">
            <span className={`font-black ${suitInfo.color}`}>{label}</span>
            <span className={`text-xs sm:text-sm ${suitInfo.color}`}>{suitInfo.icon}</span>
          </div>

          {/* Subtle metallic gloss shimmer */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />
        </div>

        {/* BACK FACE (Face Down / In Shoe) */}
        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className="absolute inset-0 w-full h-full rounded-xl bg-gradient-to-br from-red-950 via-red-900 to-black border-2 border-red-500/50 flex items-center justify-center overflow-hidden shadow-inner"
        >
          {/* Pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-black/70" />
          
          {/* WinDaq Emblem frame */}
          <div className="w-8 h-12 sm:w-11 sm:h-16 border border-amber-500/40 rounded-lg flex flex-col items-center justify-center p-1 bg-black/40">
            <span className="text-amber-400 font-serif font-black text-sm sm:text-lg">W</span>
            <div className="w-4 sm:w-6 h-0.5 bg-amber-500/50 mt-0.5" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
