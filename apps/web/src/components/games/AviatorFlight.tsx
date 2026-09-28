'use client';

import React from 'react';

/**
 * Responsive Aviator flight scene (SVG). The view "zooms out" as the multiplier climbs so the
 * plane always stays on screen; on a crash the plane flies off and the trail turns red.
 * Purely a visual of the server's multiplier — it never decides anything.
 */
export default function AviatorFlight({ multiplier, phase }: { multiplier: number; phase: 'waiting' | 'flying' | 'crashed' }) {
  const m = Math.max(1, multiplier || 1);
  // Visible range grows with the flight, keeping the plane around 75-85% across.
  const span = Math.max(2, m * 1.25);
  const p = Math.min(0.92, Math.log(m) / Math.log(span));
  const W = 100; const H = 100;
  const x = 6 + (W - 14) * p;
  const y = (H - 8) - (H - 22) * Math.pow(p, 1.7);
  const curve = `M 6 ${H - 8} C ${6 + (x - 6) * 0.55} ${H - 8}, ${6 + (x - 6) * 0.8} ${H - 8 - (H - 8 - y) * 0.35}, ${x} ${y}`;
  const crashed = phase === 'crashed';
  const flying = phase === 'flying';
  const angle = -12 - 26 * p;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Distant clouds drifting for a sense of speed */}
      <div className={`absolute inset-0 ${flying ? 'wd-clouds' : ''}`}
        style={{ backgroundImage: 'radial-gradient(60px 22px at 20% 30%, rgba(255,255,255,0.9), transparent 70%), radial-gradient(80px 26px at 70% 18%, rgba(255,255,255,0.8), transparent 70%), radial-gradient(70px 24px at 45% 55%, rgba(255,255,255,0.7), transparent 70%)', backgroundSize: '100% 100%' }} />
      {phase !== 'waiting' && (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="avf-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={crashed ? '#E11D48' : '#0284C7'} stopOpacity="0.32" />
              <stop offset="1" stopColor={crashed ? '#E11D48' : '#0284C7'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${curve} L ${x} ${H - 8} Z`} fill="url(#avf-fill)" />
          <path d={curve} fill="none" stroke={crashed ? '#E11D48' : '#0284C7'} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {phase !== 'waiting' && (
        <div className={`absolute transition-[left,top] duration-100 ease-linear ${crashed ? 'wd-plane-exit' : ''}`}
          style={{ left: `${x}%`, top: `${y}%` }}>
          <svg viewBox="0 0 64 32" className="h-10 w-20 -translate-x-[72%] -translate-y-[62%] drop-shadow-[0_8px_10px_rgba(15,23,42,0.28)]" style={{ transform: `rotate(${angle}deg)` }}>
            <path d="M2 18 L46 14 Q60 13 62 16 Q60 19 46 18 L2 20 Z" fill="#E11D48" />
            <path d="M24 16 L36 2 L42 2 L34 16 Z" fill="#BE123C" />
            <path d="M26 18 L38 30 L43 30 L35 18 Z" fill="#9F1239" />
            <path d="M4 17 L8 8 L12 8 L10 17 Z" fill="#BE123C" />
            <circle cx="54" cy="15.5" r="2" fill="#BAE6FD" />
            {flying && <path className="wd-flame" d="M2 19 L-8 17 L-4 19 L-8 21 Z" fill="#F59E0B" />}
          </svg>
        </div>
      )}
    </div>
  );
}
