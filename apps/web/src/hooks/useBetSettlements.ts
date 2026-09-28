import { useEffect, useRef } from 'react';
import type { Socket } from '@/lib/gameSocket';

export interface SettlementSummary {
  /** Total staked across the player's bets settled in this batch (rupees). */
  staked: number;
  /** Total returned to the player, stake included (rupees). */
  paid: number;
  /** Highest payout / stake ratio among winning bets. */
  bestMultiplier: number;
  count: number;
}

interface SettledEvent {
  game: string;
  betId: string;
  stake: number;
  payout: number;
}

/**
 * Listens for the server's private `bet:settled` events for one game and reports them as a single
 * summary per round. Win/loss banners must use this: the server is the only source of truth for payouts.
 */
export function useBetSettlements(
  socket: Socket | null,
  game: string,
  onSummary: (summary: SettlementSummary) => void,
  debounceMs = 600
) {
  const callbackRef = useRef(onSummary);
  useEffect(() => { callbackRef.current = onSummary; }, [onSummary]);

  useEffect(() => {
    if (!socket) return;
    let batch: SettledEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      if (batch.length === 0) return;
      const summary = batch.reduce<SettlementSummary>(
        (acc, bet) => ({
          staked: acc.staked + bet.stake,
          paid: acc.paid + bet.payout,
          bestMultiplier: bet.payout > 0 && bet.stake > 0 ? Math.max(acc.bestMultiplier, bet.payout / bet.stake) : acc.bestMultiplier,
          count: acc.count + 1
        }),
        { staked: 0, paid: 0, bestMultiplier: 0, count: 0 }
      );
      batch = [];
      callbackRef.current(summary);
    };

    const handler = (event: SettledEvent) => {
      if (!event || event.game !== game) return;
      batch.push(event);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    };

    socket.on('bet:settled', handler);
    return () => {
      socket.off('bet:settled', handler);
      if (timer) clearTimeout(timer);
    };
  }, [socket, game, debounceMs]);
}
