'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard, type Suit } from '@/components/lobby/previews/primitives';

const RANK_LABEL: Record<string, string> = { '11': 'J', '12': 'Q', '13': 'K', '14': 'A', '1': 'A' };
export const abRank = (r: number | string) => RANK_LABEL[String(r)] || String(r);

export interface AbCard { suit: Suit; rank: number | string }

/**
 * One side of the Andar Bahar table: a fanned stack of dealt cards, a count, a marker when
 * this side receives the next card, and a gold glow on the card that matches the joker.
 */
export default function AndarBaharZone({ side, cards, jokerRank, isWinner, isNext }: {
  side: 'ANDAR' | 'BAHAR';
  cards: AbCard[];
  jokerRank: number | string | null;
  isWinner: boolean;
  isNext: boolean;
}) {
  const accent = side === 'ANDAR' ? 'border-sky-200/60' : 'border-rose-200/60';
  return (
    <div className={`relative flex min-h-[176px] flex-1 flex-col rounded-2xl border-2 bg-white/10 p-2.5 transition-all duration-500 sm:p-3 ${isWinner ? 'border-amber-300 bg-white/20 shadow-[0_0_40px_rgba(251,191,36,0.6)]' : accent}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-black uppercase tracking-widest text-white/80">{side === 'ANDAR' ? 'Andar' : 'Bahar'}</span>
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold text-white/90">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span>
      </div>

      <div className="relative mt-2 flex flex-1 flex-wrap content-start pl-3 text-[20px] sm:text-[24px]">
        <AnimatePresence initial={false}>
          {cards.map((c, i) => {
            const match = jokerRank !== null && String(c.rank) === String(jokerRank);
            return (
              <motion.div key={`${i}-${c.rank}${c.suit}`}
                initial={{ y: -70, x: side === 'ANDAR' ? 60 : -60, opacity: 0, rotate: side === 'ANDAR' ? 18 : -18 }}
                animate={{ y: 0, x: 0, opacity: 1, rotate: (i % 3) - 1 }}
                transition={{ type: 'spring', damping: 18, stiffness: 240 }}
                className={`-ml-3 mb-1 ${match ? 'z-10' : ''}`}>
                <PlayingCard rank={abRank(c.rank)} suit={c.suit}
                  className={`w-10 sm:w-12 ${match ? 'rounded-[9%] ring-4 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.9)]' : ''}`} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {isNext && (
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity }}
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-950 shadow">
          Next card
        </motion.span>
      )}
      {isWinner && (
        <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mt-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase text-amber-950 shadow-[0_0_20px_rgba(245,158,11,0.7)]">
          {side === 'ANDAR' ? 'Andar' : 'Bahar'} wins
        </motion.span>
      )}
    </div>
  );
}
