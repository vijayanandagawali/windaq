"use client";

import { FlaskConical, WifiOff } from 'lucide-react';
import { useDemoModeStore } from '@/store/demoModeStore';

/**
 * Persistent, non-dismissible notice shown whenever games cannot reach the authoritative
 * game server — either because they run on the in-browser simulator or because the
 * server connection is failing.
 */
export default function DemoModeBanner() {
  const isSimulated = useDemoModeStore((s) => s.isSimulated);
  const isServerOffline = useDemoModeStore((s) => s.isServerOffline);
  if (!isSimulated && !isServerOffline) return null;

  const Icon = isServerOffline ? WifiOff : FlaskConical;
  const message = isServerOffline
    ? 'GAME SERVER OFFLINE — games cannot be played right now and no bets are accepted. Please check back later.'
    : 'DEMO MODE — the game server is offline. Games are simulated in your browser, no real money is involved and betting is disabled.';

  return (
    <div
      role="status"
      data-testid="demo-mode-banner"
      className="w-full bg-amber-500/15 border-b border-amber-500/40 text-amber-200 text-[11px] sm:text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 text-center"
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
