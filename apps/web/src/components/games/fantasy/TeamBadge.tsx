import React from 'react';
import { teamColor } from '@/lib/fantasy';

/** Neutral team monogram (short code on a coloured shield) — never a club's real logo. */
export default function TeamBadge({ short, size = 44 }: { short: string; size?: number }) {
  const color = teamColor(short);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_6px_14px_rgba(15,23,42,0.18)]"
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 60%, #0F172A))` }}>
      <span className="font-black tracking-tight" style={{ fontSize: size * 0.3 }}>{short.slice(0, 4)}</span>
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 to-transparent" />
    </span>
  );
}
