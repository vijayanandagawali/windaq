"use client";

import { FlaskConical } from 'lucide-react';
import { useDemoModeStore } from '@/store/demoModeStore';

/**
 * Persistent, non-dismissible notice shown whenever games are running on the in-browser
 * simulator rather than the authoritative game server.
 */
export default function DemoModeBanner() {
  const isSimulated = useDemoModeStore((s) => s.isSimulated);
  if (!isSimulated) return null;

  return (
    <div
      role="status"
      data-testid="demo-mode-banner"
      className="w-full bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-[11px] sm:text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 text-center"
    >
      <FlaskConical size={14} className="shrink-0" aria-hidden="true" />
      <span>DEMO MODE — the game server is offline. Games are simulated in your browser, no real money is involved and betting is disabled.</span>
    </div>
  );
}
