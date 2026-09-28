/** Shared shapes for server-driven card tables (Dragon Tiger). */
export interface TableCard {
  suit: 'S' | 'H' | 'D' | 'C';
  rank: number; // 2-14 (14 = Ace)
}

export interface DragonTigerResult {
  dragon?: TableCard;
  tiger?: TableCard;
  winner: 'DRAGON' | 'TIGER' | 'TIE' | string;
  [key: string]: unknown;
}

export interface VirtualDealer {
  dealerId?: string;
  name: string;
  title?: string;
  tableId?: string;
  avatar?: string;
  speech?: string;
  action?: string;
}

export interface SimulatedLiveState {
  roundId: string;
  phase: string;
  phaseTimeLeft: number;
  totalPhaseDuration: number;
  phaseEndsAt: number;
  dealer: VirtualDealer;
  result: DragonTigerResult | null;
  dealingStep?: { step: number; totalSteps: number; name: string } | null;
  serverSeedHash?: string;
  serverSeed?: string | null;
  clientSeed?: string | null;
  history: Array<{ roundId: string; result: DragonTigerResult; resultTime: string | Date; [key: string]: unknown }>;
  myBets?: Record<string, number>;
  isMaintenance?: boolean;
  maintenanceMessage?: string;
  minBet?: number;
  maxBet?: number;
  payoutVersion?: number;
  isEnabled?: boolean;
  dealerSpeed?: number;
}
