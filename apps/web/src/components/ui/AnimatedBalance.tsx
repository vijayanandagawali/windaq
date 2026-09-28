'use client';

import React, { useEffect, useRef, useState } from 'react';

const format = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Wallet balance that counts to its new value and briefly tints up (green) or down (rose),
 * so a stake or a payout is felt without a popup. The final number is always the exact server value.
 */
export default function AnimatedBalance({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const up = value > from;
    let raf = 0;
    let clearTrend: ReturnType<typeof setTimeout> | undefined;
    // Defer state updates to the next frame so they happen outside the effect body.
    raf = requestAnimationFrame(() => {
      setTrend(up ? 'up' : 'down');
      clearTrend = setTimeout(() => setTrend(null), 900);
      if (reduce) {
        shownRef.current = value;
        setShown(value);
        return;
      }
      const duration = Math.min(900, 350 + Math.abs(value - from) * 2);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const next = t >= 1 ? value : from + (value - from) * eased;
        shownRef.current = next;
        setShown(next);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (clearTrend) clearTimeout(clearTrend);
    };
  }, [value]);

  return (
    <span className={`inline-block transition-[color,scale] duration-300 ${trend === 'up' ? 'scale-110 text-lime-100' : trend === 'down' ? 'text-rose-100' : ''} ${className}`}>
      ₹{format(shown)}
    </span>
  );
}
