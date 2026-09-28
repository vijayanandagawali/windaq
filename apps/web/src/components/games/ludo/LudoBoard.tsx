'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LogoMark } from '@/components/brand/Logo';
import { BASE_ORIGINS, HOME_COLUMN_CELLS, SAFE, SEAT_COLOR, SEAT_SOFT, START_OFFSET, TRACK, tokenPoint } from './geometry';

export interface BoardToken { seat: number; index: number; pos: number; movable: boolean; }

const pct = (v: number) => `${(v / 15) * 100}%`;

/** A glossy pawn: a coloured disc with a light rim and inner highlight (no cartoon faces). */
function Pawn({ color, movable, onClick }: { color: string; movable: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!movable} aria-label="Token"
      className={`relative block h-full w-full rounded-full ${movable ? 'cursor-pointer' : 'cursor-default'}`}>
      {movable && <span className="absolute -inset-[18%] animate-ping rounded-full opacity-50" style={{ background: color }} />}
      <span className="absolute inset-0 rounded-full shadow-[0_3px_6px_rgba(15,23,42,0.45)]" style={{ background: `radial-gradient(circle at 35% 30%, #ffffff 0 8%, ${color} 38%, color-mix(in srgb, ${color} 70%, #000) 100%)` }} />
      <span className="absolute inset-[22%] rounded-full border-2 border-white/80" />
      {movable && <span className="absolute -inset-[10%] rounded-full ring-2 ring-white" />}
    </button>
  );
}

export default function LudoBoard({ tokens, onTokenClick, highlightSeat }: {
  tokens: BoardToken[];
  onTokenClick: (t: BoardToken) => void;
  highlightSeat: number | null;
}) {
  // Several tokens on one cell are nudged apart so each stays tappable.
  const stacks = new Map<string, number>();
  const placed = tokens.map((t) => {
    const [r, c] = tokenPoint(t.seat, t.index, t.pos);
    const key = t.pos === -1 || t.pos === 56 ? `${t.seat}-${t.index}-solo` : `${r.toFixed(2)}:${c.toFixed(2)}`;
    const n = stacks.get(key) || 0;
    stacks.set(key, n + 1);
    return { t, r: r + (n ? (n % 2 ? -0.18 : 0.18) : 0), c: c + (n ? (n > 1 ? 0.18 : -0.18) : 0) };
  });

  const trackIndex = new Map(TRACK.map(([r, c], i) => [`${r},${c}`, i]));
  const homeCell = new Map<string, number>();
  HOME_COLUMN_CELLS.forEach((cells, seat) => cells.forEach(([r, c]) => homeCell.set(`${r},${c}`, seat)));

  return (
    <div className="relative aspect-square w-full select-none overflow-hidden rounded-[22px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] ring-1 ring-slate-200">
      {/* Track and home columns */}
      <div className="absolute inset-0 grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(15,1fr)]">
        {Array.from({ length: 225 }).map((_, i) => {
          const r = Math.floor(i / 15);
          const c = i % 15;
          const key = `${r},${c}`;
          const ti = trackIndex.get(key);
          const hs = homeCell.get(key);
          if (ti === undefined && hs === undefined) return <div key={i} />;
          const startSeat = START_OFFSET.indexOf(ti ?? -99);
          const bg = hs !== undefined ? SEAT_COLOR[hs] : startSeat >= 0 ? SEAT_COLOR[startSeat] : '#FFFFFF';
          return (
            <div key={i} className="relative border-[0.5px] border-slate-300/80" style={{ background: bg }}>
              {ti !== undefined && SAFE.has(ti) && startSeat < 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-[clamp(8px,2.4vw,14px)] text-slate-400">★</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Bases */}
      {BASE_ORIGINS.map(([r0, c0], seat) => (
        <div key={seat} className="absolute p-[1.2%]" style={{ top: pct(r0), left: pct(c0), width: pct(6), height: pct(6) }}>
          <div className={`h-full w-full rounded-[14%] p-[12%] transition-shadow ${highlightSeat === seat ? 'shadow-[0_0_0_3px_rgba(255,255,255,0.9),0_0_22px_rgba(0,0,0,0.25)]' : ''}`} style={{ background: SEAT_COLOR[seat] }}>
            <div className="h-full w-full rounded-[18%] shadow-inner" style={{ background: SEAT_SOFT[seat] }} />
          </div>
        </div>
      ))}

      {/* Centre: four triangles pointing home, with the logo */}
      <svg className="absolute" style={{ top: pct(6), left: pct(6), width: pct(3), height: pct(3) }} viewBox="0 0 30 30" aria-hidden="true">
        <polygon points="0,0 15,15 0,30" fill={SEAT_COLOR[0]} />
        <polygon points="0,0 30,0 15,15" fill={SEAT_COLOR[1]} />
        <polygon points="30,0 30,30 15,15" fill={SEAT_COLOR[2]} />
        <polygon points="0,30 15,15 30,30" fill={SEAT_COLOR[3]} />
      </svg>
      <div className="pointer-events-none absolute flex items-center justify-center" style={{ top: pct(6.9), left: pct(6.9), width: pct(1.2), height: pct(1.2) }}>
        <LogoMark size={40} className="h-full w-full drop-shadow" title="" />
      </div>

      {/* Tokens */}
      {placed.map(({ t, r, c }) => (
        <motion.div key={`${t.seat}-${t.index}`} className="absolute z-10" initial={false}
          animate={{ top: pct(r - 0.36), left: pct(c - 0.36) }}
          transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
          style={{ width: pct(0.72), height: pct(0.72), zIndex: t.movable ? 20 : 10 }}>
          <Pawn color={SEAT_COLOR[t.seat]} movable={t.movable} onClick={() => onTokenClick(t)} />
        </motion.div>
      ))}
    </div>
  );
}
