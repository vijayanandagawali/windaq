'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PlayingCard, type Suit } from '@/components/lobby/previews/primitives';

export interface TpCard { suit: Suit; rank: number }

const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const tpRank = (r: number) => RANK_LABEL[r] || String(r);

/**
 * One Teen Patti hand on the felt: up to three cards that land face down and are turned one by one.
 * `dealt` = how many cards are on the table, `shown` = how many of them are face up.
 */
export default function TeenPattiHand({ side, cards, dealt, shown, label, isWinner, isTie }: {
  side: 'A' | 'B';
  cards: TpCard[];
  dealt: number;
  shown: number;
  label: string | null;
  isWinner: boolean;
  isTie: boolean;
}) {
  const tone = side === 'A' ? 'from-sky-400/25 ring-sky-200/70' : 'from-rose-400/25 ring-rose-200/70';
  return (
    <div className={`relative flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-gradient-to-b ${tone} to-transparent p-2.5 ring-2 transition-all duration-500 sm:p-4 ${isWinner ? '!ring-amber-300 shadow-[0_0_40px_rgba(251,191,36,0.55)]' : ''}`}>
      <span className={`text-xs font-black uppercase tracking-[0.2em] ${side === 'A' ? 'text-sky-100' : 'text-rose-100'}`}>Player {side}</span>

      <div className="mt-2 flex h-[76px] items-center justify-center text-[17px] min-[400px]:h-[90px] min-[400px]:text-[20px] sm:h-[124px] sm:text-[28px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="-mx-1 w-[44px] min-[400px]:w-[52px] sm:-mx-1.5 sm:w-[76px]" style={{ zIndex: i }}>
            {i < dealt && cards[i] ? (
              <motion.div
                initial={{ y: -90, x: side === 'A' ? 50 : -50, opacity: 0, rotate: side === 'A' ? 14 : -14 }}
                animate={{ y: 0, x: 0, opacity: 1, rotate: (i - 1) * 6 }}
                transition={{ type: 'spring', damping: 17, stiffness: 220 }}
              >
                <PlayingCard rank={tpRank(cards[i].rank)} suit={cards[i].suit} faceDown={i >= shown} className="w-full" />
              </motion.div>
            ) : (
              <div className="aspect-[5/7] w-full rounded-[9%] border-2 border-dashed border-white/25" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 h-6">
        {label && (
          <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isWinner ? 'bg-amber-400 text-amber-950' : isTie ? 'bg-white/80 text-slate-700' : 'bg-black/25 text-white/90'}`}>
            {label}
          </motion.span>
        )}
      </div>
    </div>
  );
}
