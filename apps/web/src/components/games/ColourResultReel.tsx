'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';

/**
 * Colour Prediction result reel: a strip of glossy numbered balls that spins while betting is
 * locked and decelerates onto the server's result number under the centre marker. The number
 * shown is always the server's result; the motion only builds anticipation.
 */
const BALL = 64;          // px per ball including gap
const LOOPS = 6;          // strip repetitions so the reel can spin a long way

const BALL_STYLE: Record<number, string> = {
  0: 'linear-gradient(135deg, #F43F5E 0 50%, #8B5CF6 50% 100%)',
  5: 'linear-gradient(135deg, #10B981 0 50%, #8B5CF6 50% 100%)',
};
const colourOf = (n: number) => (n === 0 || n === 5 ? null : n % 2 === 0 ? '#F43F5E' : '#10B981');

function Ball({ n, hot }: { n: number; hot: boolean }) {
  const bg = BALL_STYLE[n] || colourOf(n)!;
  return (
    <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black text-white transition-transform duration-300 ${hot ? 'scale-125' : ''}`}
      style={{ background: bg, boxShadow: 'inset -4px -6px 10px rgba(0,0,0,0.25), inset 4px 4px 8px rgba(255,255,255,0.35), 0 6px 12px rgba(15,23,42,0.25)', marginRight: BALL - 48 }}>
      <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">{n}</span>
      <span aria-hidden="true" className="absolute left-2 top-1.5 h-3 w-4 rounded-full bg-white/50 blur-[1px]" />
    </div>
  );
}

export default function ColourResultReel({ spinning, result }: { spinning: boolean; result: { number: number; color: string; period?: string } | null }) {
  const viewRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  // Which draw the reel last finished landing on; `landed` is derived so nothing resets state in effects.
  const [landedDraw, setLandedDraw] = useState<string | null>(null);
  const drawKey = result ? `${result.period ?? ''}:${result.number}` : null;
  const landed = result && landedDraw === drawKey ? result.number : null;
  const loopRef = useRef<ReturnType<typeof animate> | null>(null);

  // Centre offset so index i sits under the marker.
  const centreFor = (index: number) => {
    const w = viewRef.current?.clientWidth || 320;
    return w / 2 - (index * BALL + 24);
  };

  useEffect(() => {
    loopRef.current?.stop();
    if (result) {
      // Land on the result from a few loops away, easing out like a slowing wheel.
      const target = (LOOPS - 2) * 10 + result.number;
      loopRef.current = animate(x, centreFor(target), {
        duration: 2.6,
        ease: [0.12, 0.8, 0.2, 1],
        onComplete: () => setLandedDraw(drawKey)
      });
    } else if (spinning) {
      const from = centreFor(10);
      x.set(from);
      loopRef.current = animate(x, [from, from - 10 * BALL], { duration: 0.55, ease: 'linear', repeat: Infinity });
    } else {
      animate(x, centreFor(12), { duration: 0.6, ease: 'easeOut' });
    }
    return () => loopRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, result?.number]);

  // Still turning: spinning while locked, or decelerating onto a result that has not landed yet.
  const drawing = (spinning && !result) || (result !== null && landed === null);
  const balls = Array.from({ length: LOOPS * 10 }, (_, i) => i % 10);
  const label = result ? (result.number === 0 ? 'Red + Violet' : result.number === 5 ? 'Green + Violet' : result.color) : null;

  return (
    <div className="relative mx-4 mb-6 overflow-hidden rounded-3xl bg-gradient-to-b from-white to-sky-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
        <span className={`h-2 w-2 rounded-full ${drawing ? 'animate-ping bg-rose-500' : landed !== null ? 'bg-amber-400' : 'bg-emerald-500'}`} />
        {drawing ? 'Drawing…' : landed !== null ? 'Result' : 'Next draw'}
      </div>
      <div ref={viewRef} className="relative h-16 overflow-hidden">
        <motion.div className="absolute left-0 top-2 flex" style={{ x }}>
          {balls.map((n, i) => <Ball key={i} n={n} hot={landed !== null && result !== null && i === (LOOPS - 2) * 10 + result.number} />)}
        </motion.div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-sky-50 to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-full w-14 -translate-x-1/2 rounded-2xl ring-2 ring-amber-400/80" />
      </div>
      <div className="mt-2 h-6 text-center">
        {landed !== null && label && (
          <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="inline-block rounded-full bg-amber-50 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
            {landed} · {label}
          </motion.span>
        )}
      </div>
    </div>
  );
}
