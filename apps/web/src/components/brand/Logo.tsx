'use client';

import React, { useId } from 'react';

/**
 * WinDaq brand mark: a geometric W of two rising strokes with a diamond at the centre peak,
 * on a sky-to-emerald squircle. Pure SVG so it stays sharp from favicon to hero size.
 */
export function LogoMark({ size = 36, className = '', title = 'WinDaq' }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.52" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="24" y1="0" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.38" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="14" fill={`url(#${id}-bg)`} />
      <path d="M1 15C1 7.3 7.3 1 15 1h18c7.7 0 14 6.3 14 14v4C35 26 13 26 1 19z" fill={`url(#${id}-shine)`} />
      <path d="M10.5 16.5 17 33l7-13.5L31 33l6.5-16.5" fill="none" stroke="#FFFFFF" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 9.2 26.4 11.6 24 14 21.6 11.6z" fill="#FDE68A" />
    </svg>
  );
}

/** Mark plus wordmark, for headers and footers. */
export function Logo({ size = 36, className = '', showTagline = false }: { size?: number; className?: string; showTagline?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="block text-lg font-extrabold tracking-tight text-slate-900">Win<span className="bg-gradient-to-r from-sky-500 to-emerald-500 bg-clip-text text-transparent">Daq</span></span>
        {showTagline && <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">Provably fair</span>}
      </span>
    </span>
  );
}

export default Logo;
