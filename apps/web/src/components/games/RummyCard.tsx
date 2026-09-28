'use client';

import React from 'react';
import { PlayingCard, type Suit } from '@/components/lobby/previews/primitives';
import CardBack from '@/components/brand/CardBack';

export interface RCard { id: string; suit?: Suit; rank?: number; joker?: true }

const LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const rummyRank = (r?: number) => (r ? LABEL[r] || String(r) : '');
export const isWildCard = (c: RCard | null | undefined, wildRank: number) => !!c && (c.joker === true || c.rank === wildRank);

/** A rummy card: normal faces, a printed-joker face, a gold "wild" tag, or the branded back. */
export default function RummyCard({ card, wildRank, faceDown = false, selected = false, fresh = false, className = '' }: {
  card?: RCard | null;
  wildRank?: number;
  faceDown?: boolean;
  selected?: boolean;
  fresh?: boolean;
  className?: string;
}) {
  if (faceDown || !card) {
    return <div className={`relative aspect-[5/7] ${className}`}><CardBack /></div>;
  }
  const wild = wildRank !== undefined && isWildCard(card, wildRank);
  return (
    <div className={`relative transition-transform duration-150 ${selected ? '-translate-y-3' : ''} ${className}`}>
      {card.joker ? (
        <div className="relative flex aspect-[5/7] w-full flex-col items-center justify-center rounded-[9%] bg-gradient-to-br from-white to-[#F4F1EA] shadow-[0_6px_14px_rgba(15,23,42,0.28),inset_0_0_0_1px_rgba(15,23,42,0.08)]">
          <span className="font-serif text-[0.55em] font-black tracking-widest text-violet-700">JOKER</span>
          <span className="text-[1.1em] leading-none">★</span>
        </div>
      ) : (
        <PlayingCard rank={rummyRank(card.rank)} suit={card.suit as Suit} className="w-full" />
      )}
      {wild && (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[9px] font-black leading-4 text-amber-950 shadow">W</span>
      )}
      {selected && <span className="pointer-events-none absolute inset-0 rounded-[9%] ring-2 ring-sky-400" />}
      {fresh && !selected && <span className="pointer-events-none absolute inset-0 rounded-[9%] ring-2 ring-emerald-400" />}
    </div>
  );
}
