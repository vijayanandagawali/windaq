"use client";

import { WifiOff } from 'lucide-react';
import { useDemoModeStore } from '@/store/demoModeStore';

/**
 * Persistent, non-dismissible notice shown whenever games cannot reach the authoritative game server.
 */
export default function DemoModeBanner() {
  const isServerOffline = useDemoModeStore((s) => s.isServerOffline);
  if (!isServerOffline) return null;

  const Icon = WifiOff;
  const message = 'GAME SERVER OFFLINE — games cannot be played right now and no bets are accepted. Please check back later.';

  return (
    <div
      role="status"
      data-testid="demo-mode-banner"
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] sm:text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 text-center"
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
