'use client';

import React, { useEffect, useRef, useState } from 'react';

/** True while the element is on screen; previews pause their timers and CSS animations otherwise. */
export function useInView<T extends Element>(margin = '120px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, inView };
}

export type Suit = 'S' | 'H' | 'D' | 'C';
const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED: Suit[] = ['H', 'D'];

/**
 * A realistic playing card: ivory face, corner indices, large centre pip, soft paper shadow.
 * `faceDown` shows a patterned back; `flip` animates between the two with a 3D turn.
 */
export function PlayingCard({ rank, suit, faceDown = false, className = '', style }: {
  rank: string; suit: Suit; faceDown?: boolean; className?: string; style?: React.CSSProperties;
}) {
  const colour = RED.includes(suit) ? 'text-[#C8102E]' : 'text-slate-900';
  return (
    <div className={`wd-card relative aspect-[5/7] [perspective:600px] ${className}`} style={style}>
      <div className={`wd-card-inner relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] ${faceDown ? '[transform:rotateY(180deg)]' : ''}`}>
        <div className="absolute inset-0 rounded-[9%] bg-gradient-to-br from-white to-[#F4F1EA] shadow-[0_6px_14px_rgba(15,23,42,0.28),inset_0_0_0_1px_rgba(15,23,42,0.08)] [backface-visibility:hidden]">
          <span className={`absolute left-[9%] top-[5%] flex flex-col items-center font-serif text-[0.62em] font-bold leading-none ${colour}`}>
            <span>{rank}</span><span className="text-[0.9em]">{SUIT_GLYPH[suit]}</span>
          </span>
          <span className={`absolute bottom-[5%] right-[9%] flex rotate-180 flex-col items-center font-serif text-[0.62em] font-bold leading-none ${colour}`}>
            <span>{rank}</span><span className="text-[0.9em]">{SUIT_GLYPH[suit]}</span>
          </span>
          <span className={`absolute inset-0 flex items-center justify-center font-serif text-[1.6em] ${colour}`}>{SUIT_GLYPH[suit]}</span>
        </div>
        <div className="absolute inset-0 rounded-[9%] bg-[#0E7490] shadow-[0_6px_14px_rgba(15,23,42,0.28)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="absolute inset-[7%] rounded-[7%] border border-white/60 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.16)_0_3px,transparent_3px_7px)]" />
        </div>
      </div>
    </div>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]]
};

function Face({ n, transform }: { n: number; transform: string }) {
  return (
    <div className="absolute inset-0 rounded-[18%] bg-gradient-to-br from-white via-[#FBFBF8] to-[#E7E4DC] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),inset_-3px_-3px_8px_rgba(15,23,42,0.10)]"
      style={{ transform }}>
      {PIPS[n].map(([x, y], i) => (
        <span key={i} className={`absolute h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full ${n === 1 ? 'bg-[#C8102E]' : 'bg-slate-900'} shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5)]`}
          style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  );
}

/** Orientation that turns face `n` towards the viewer (with a slight tilt so it reads as 3D). */
const FACE_POSE: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(-90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(90deg) rotateY(0deg)',
  6: 'rotateX(0deg) rotateY(180deg)'
};
export function dieFacePose(n: number, tilt = 'rotateX(-16deg) rotateY(18deg)') {
  return `${tilt} ${FACE_POSE[n] || FACE_POSE[1]}`;
}

/**
 * A shaded 3D die (CSS 3D). `size` in px.
 * - `rolling`: decorative looping roll (lobby previews)
 * - `tumble`: fast continuous tumble while a real result is awaited
 * - `value`: settles on that face with a physical-feeling ease
 */
export function Die3D({ size = 44, rolling = true, tumble = false, value, delay = 0, rest = 'rotateX(-24deg) rotateY(38deg)' }: {
  size?: number; rolling?: boolean; tumble?: boolean; value?: number | null; delay?: number; rest?: string;
}) {
  const half = size / 2;
  const settled = typeof value === 'number' && !tumble;
  return (
    <div className="[perspective:500px]" style={{ width: size, height: size }}>
      <div className={`relative h-full w-full [transform-style:preserve-3d] ${tumble ? 'wd-die-tumble' : rolling && !settled ? 'wd-die-roll' : ''}`}
        style={{
          transform: settled ? dieFacePose(value) : rest,
          transition: settled ? 'transform 1.1s cubic-bezier(.15,1.35,.35,1)' : undefined,
          animationDelay: `${delay}s`
        }}>
        <Face n={1} transform={`translateZ(${half}px)`} />
        <Face n={6} transform={`rotateY(180deg) translateZ(${half}px)`} />
        <Face n={3} transform={`rotateY(90deg) translateZ(${half}px)`} />
        <Face n={4} transform={`rotateY(-90deg) translateZ(${half}px)`} />
        <Face n={2} transform={`rotateX(90deg) translateZ(${half}px)`} />
        <Face n={5} transform={`rotateX(-90deg) translateZ(${half}px)`} />
      </div>
    </div>
  );
}
