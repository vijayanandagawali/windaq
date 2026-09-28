'use client';

import React, { useId } from 'react';
import { LogoMark } from './Logo';

/**
 * Branded back for every WinDaq playing card: deep teal with a fine lattice, a gold hairline frame
 * and the logo in a medallion. Fills its (relatively positioned) parent.
 */
export default function CardBack({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <div className={`absolute inset-0 overflow-hidden rounded-[9%] bg-gradient-to-br from-[#0B4A5C] via-[#0E6E7E] to-[#0A5A4C] shadow-[0_6px_14px_rgba(15,23,42,0.28)] ${className}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 50 70" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={`${id}-lat`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0H5M0 0V5" stroke="#FFFFFF" strokeOpacity="0.10" strokeWidth="0.6" />
          </pattern>
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor="#5EEAD4" stopOpacity="0.28" />
            <stop offset="1" stopColor="#5EEAD4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="3" y="3" width="44" height="64" rx="4" fill={`url(#${id}-lat)`} />
        <rect x="0" y="0" width="50" height="70" fill={`url(#${id}-glow)`} />
        <rect x="3" y="3" width="44" height="64" rx="4" fill="none" stroke="#FDE68A" strokeOpacity="0.75" strokeWidth="0.7" />
        <rect x="5" y="5" width="40" height="60" rx="3" fill="none" stroke="#FDE68A" strokeOpacity="0.3" strokeWidth="0.4" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex aspect-square w-[52%] items-center justify-center rounded-full bg-white/10 ring-1 ring-[#FDE68A]/60 shadow-[0_0_12px_rgba(94,234,212,0.35)]">
          <LogoMark size={64} className="h-[70%] w-[70%]" title="" />
        </div>
      </div>
    </div>
  );
}
