"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { SettlementSummary } from '@/hooks/useBetSettlements';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, VolumeX, Camera, Info, ShieldCheck, 
  RotateCcw, Sparkles, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History
} from 'lucide-react';
import toast from 'react-hot-toast';
import { audioEngine } from '@/lib/audioEngine';
import { useAudioStore } from '@/store/audioStore';
import WinLossCelebration from './WinLossCelebration';
import ResultHistoryDrawer from './ResultHistoryDrawer';
import RoundDetailModal from './history/RoundDetailModal';
import type { HistoryItem } from './history/GameRoadmapStrip';
import AnimatedCard from './animation/AnimatedCard';
import AnimatedChipFlight from './animation/AnimatedChipFlight';
import { VirtualDealerStage } from './VirtualDealerStage';
import { SimulatedOpponentBadge } from './SimulatedOpponentBadge';

// Types
export interface TableCard {
  suit: 'S' | 'H' | 'D' | 'C';
  rank: number; // 2-14 (14 = Ace)
}

export interface DragonTigerResult {
  dragon?: TableCard | any;
  tiger?: TableCard | any;
  winner: 'DRAGON' | 'TIGER' | 'TIE' | string;
  [key: string]: any;
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
  phase: 'CREATED' | 'BETTING_OPEN' | 'BETTING_CLOSED' | 'PLAYING' | 'DEALING' | 'RESULT' | 'SETTLEMENT' | 'COMPLETED' | 'NEXT_ROUND' | string;
  phaseTimeLeft: number;
  totalPhaseDuration: number;
  phaseEndsAt: number;
  dealer: VirtualDealer;
  result: DragonTigerResult | null;
  dealingStep?: { step: number; totalSteps: number; name: string } | null;
  serverSeedHash?: string;
  serverSeed?: string | null;
  clientSeed?: string | null;
  history: Array<{ roundId: string; result: DragonTigerResult; resultTime: string | Date; [key: string]: any }>;
  myBets?: Record<string, number>;
  isMaintenance?: boolean;
  maintenanceMessage?: string;
  minBet?: number;
  maxBet?: number;
  payoutVersion?: number;
  isEnabled?: boolean;
  dealerSpeed?: number;
}

interface Props {
  state: SimulatedLiveState;
  balance: number;
  onPlaceBet: (market: 'DRAGON' | 'TIGER' | 'TIE', amount: number) => Promise<boolean>;
  gameTitle?: string;
  roomName?: string;
  /** Server-authoritative result of the player's bets this round (from `bet:settled`). */
  settlement?: (SettlementSummary & { id: number }) | null;
}

const CHIP_DENOMINATIONS = [
  { value: 10, label: '10', color: 'from-blue-600 to-blue-800', border: 'border-blue-400', ring: 'ring-blue-500' },
  { value: 50, label: '50', color: 'from-amber-600 to-amber-800', border: 'border-amber-400', ring: 'ring-amber-500' },
  { value: 100, label: '100', color: 'from-red-600 to-red-800', border: 'border-red-400', ring: 'ring-red-500' },
  { value: 500, label: '500', color: 'from-purple-600 to-purple-800', border: 'border-purple-400', ring: 'ring-purple-500' },
  { value: 1000, label: '1K', color: 'from-emerald-600 to-emerald-800', border: 'border-emerald-400', ring: 'ring-emerald-500' },
  { value: 5000, label: '5K', color: 'from-yellow-500 to-amber-600', border: 'border-yellow-300', ring: 'ring-yellow-400' }
];

export default function SimulatedLiveTable({
  state,
  balance,
  onPlaceBet,
  gameTitle = 'Dragon Tiger',
  roomName = 'Standard Table 1',
  settlement = null
}: Props) {
  // Camera angles: 'studio' (wide), 'felt' (close-up on betting), 'spotlight' (dramatic card view)
  const [cameraAngle, setCameraAngle] = useState<'studio' | 'felt' | 'spotlight'>('studio');
  const { soundEnabled, toggleSound } = useAudioStore();
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  const [previousBets, setPreviousBets] = useState<Record<string, number>>({});
  const [showProvablyFair, setShowProvablyFair] = useState<boolean>(false);
  const [showRoadmap, setShowRoadmap] = useState<boolean>(true);
  const [showResultHistory, setShowResultHistory] = useState<boolean>(false);
  const [selectedRoundDetail, setSelectedRoundDetail] = useState<HistoryItem | null>(null);
  const [celebration, setCelebration] = useState<{
    status: 'IDLE' | 'WON' | 'LOST';
    amount: number;
    multiplier?: number;
    message?: string;
    net?: number;
  }>({ status: 'IDLE', amount: 0 });
  const [chipFlights, setChipFlights] = useState<any[]>([]);

  // Sync active bets from server snapshot (for refresh state recovery)
  useEffect(() => {
    if (state.myBets && Object.keys(state.myBets).length > 0) {
      setMyBets(state.myBets);
    }
  }, [state.myBets]);

  // Sound triggers on state changes
  useEffect(() => {
    if (state.phase === 'BETTING_OPEN' && state.phaseTimeLeft <= 3 && state.phaseTimeLeft > 0) {
      audioEngine.play('countdown', { urgent: true });
    } else if (state.phase === 'BETTING_OPEN' && state.phaseTimeLeft <= 10 && state.phaseTimeLeft > 0) {
      audioEngine.play('countdown');
    }
  }, [state.phaseTimeLeft, state.phase]);

  useEffect(() => {
    if (state.phase === 'BETTING_CLOSED' || state.phase === 'BETTING_LOCKED') {
      audioEngine.play('roundStart');
    } else if (state.phase === 'DEALING' || state.phase === 'PLAYING') {
      audioEngine.play('cardSlide');
    } else if (state.phase === 'RESULT' || state.phase === 'SETTLEMENT' || state.phase === 'RESULT_REVEAL') {
      audioEngine.play('cardFlip');
      setTimeout(() => audioEngine.play('win'), 400);

    } else if (state.phase === 'NEXT_ROUND') {
      audioEngine.play('roundEnd');
      // Archive current bets for repeat
      if (Object.keys(myBets).length > 0) {
        setPreviousBets(myBets);
      }
      setMyBets({});
      setCelebration({ status: 'IDLE', amount: 0 });
    }
  }, [state.phase, state.result?.winner]);

  // Win/loss banner uses the server's settled amounts only.
  useEffect(() => {
    if (!settlement) return;
    const winner = state.result?.winner;
    if (settlement.paid > 0) {
      setCelebration({
        status: 'WON',
        amount: settlement.paid,
        multiplier: settlement.bestMultiplier,
        net: settlement.paid - settlement.staked,
        message: winner ? `${winner} WINS!` : 'YOU WON!'
      });
      setChipFlights(prev => [
        ...prev,
        {
          id: `dt-win-${settlement.id}`,
          amount: settlement.paid,
          type: 'WIN',
          startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
          startY: 320,
          endX: 80,
          endY: typeof window !== 'undefined' ? window.innerHeight - 60 : 600,
          color: 'from-amber-400 to-yellow-600',
          borderColor: 'border-yellow-200'
        }
      ]);
    } else if (settlement.staked > 0) {
      setCelebration({
        status: 'LOST',
        amount: settlement.staked,
        message: winner ? `${winner} Won • Bet Lost` : 'Bet Lost'
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlement?.id]);

  // Handle betting
  const handleBetClick = async (market: 'DRAGON' | 'TIGER' | 'TIE') => {
    if (state.isMaintenance) {
      toast.error(`Maintenance: ${state.maintenanceMessage || 'Game is currently under maintenance. Betting is paused.'}`, { id: 'maint' });
      return;
    }

    if (state.isEnabled === false) {
      toast.error('This game is currently deactivated by administrator.', { id: 'disabled' });
      return;
    }

    if (state.phase !== 'BETTING_OPEN') {
      toast.error('Bets are locked for this round!', { id: 'bet-locked' });
      return;
    }

    if (state.minBet && selectedChip < state.minBet) {
      toast.error(`Minimum bet limit is ₹${state.minBet}`, { id: 'min-bet' });
      return;
    }

    if (state.maxBet && selectedChip > state.maxBet) {
      toast.error(`Maximum bet limit is ₹${state.maxBet}`, { id: 'max-bet' });
      return;
    }

    if (balance < selectedChip) {
      toast.error('Insufficient wallet balance!', { id: 'no-bal' });
      return;
    }

    audioEngine.play('bet');
    const success = await onPlaceBet(market, selectedChip);
    if (success) {
      setMyBets(prev => ({
        ...prev,
        [market]: (prev[market] || 0) + selectedChip
      }));

      // Fly chip from bottom tray to market box
      setChipFlights(prev => [
        ...prev,
        {
          id: `dt-bet-${Date.now()}-${Math.random()}`,
          amount: selectedChip,
          type: 'BET',
          startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
          startY: typeof window !== 'undefined' ? window.innerHeight - 80 : 600,
          endX: market === 'DRAGON' ? (typeof window !== 'undefined' ? window.innerWidth * 0.35 : 150) : market === 'TIGER' ? (typeof window !== 'undefined' ? window.innerWidth * 0.65 : 250) : (typeof window !== 'undefined' ? window.innerWidth * 0.5 : 200),
          endY: 420,
          color: selectedChip >= 500 ? 'from-purple-600 to-indigo-800' : 'from-amber-500 to-amber-700',
          borderColor: 'border-yellow-200'
        }
      ]);
    }
  };

  const handleRepeatBet = async () => {
    if (state.phase !== 'BETTING_OPEN') return;
    const totalNeeded = Object.values(previousBets).reduce((a, b) => a + b, 0);
    if (totalNeeded <= 0) {
      toast('No previous bets to repeat', { icon: 'ℹ️' });
      return;
    }
    if (balance < totalNeeded) {
      toast.error('Insufficient balance to repeat previous bets');
      return;
    }

    for (const [mkt, amt] of Object.entries(previousBets)) {
      await onPlaceBet(mkt as any, amt);
    }
    setMyBets(previousBets);
    audioEngine.play('bet');
    toast.success('Previous bets repeated');
  };

  const handleDoubleBets = async () => {
    if (state.phase !== 'BETTING_OPEN') return;
    const currentTotal = Object.values(myBets).reduce((a, b) => a + b, 0);
    if (currentTotal <= 0) return;
    if (balance < currentTotal) {
      toast.error('Insufficient balance to double bets');
      return;
    }

    for (const [mkt, amt] of Object.entries(myBets)) {
      await onPlaceBet(mkt as any, amt);
    }
    setMyBets(prev => {
      const doubled: Record<string, number> = {};
      for (const [mkt, amt] of Object.entries(prev)) {
        doubled[mkt] = amt * 2;
      }
      return doubled;
    });
    audioEngine.play('bet');
    toast.success('Bets doubled!');
  };

  const handleClearBets = () => {
    if (state.phase !== 'BETTING_OPEN') return;
    audioEngine.play('click');
    setMyBets({});
    toast('Bets cleared', { icon: '🧹' });
  };

  // Format Card helper
  const renderCard = (card?: TableCard | null, isRevealed = false) => {
    if (!card || !isRevealed) {
      return (
        <div className="w-16 h-24 sm:w-24 sm:h-36 rounded-xl bg-gradient-to-br from-red-950 via-red-900 to-slate-100 border-2 border-red-500/40 shadow-2xl flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-slate-100" />
          <div className="w-10 h-14 sm:w-12 sm:h-16 border border-yellow-500/30 rounded-lg flex items-center justify-center">
            <span className="text-yellow-500/50 font-serif font-black text-lg sm:text-xl">W</span>
          </div>
        </div>
      );
    }

    const suitIcons: Record<string, { icon: string; color: string }> = {
      'S': { icon: '♠', color: 'text-zinc-900' },
      'H': { icon: '♥', color: 'text-red-600' },
      'D': { icon: '♦', color: 'text-red-600' },
      'C': { icon: '♣', color: 'text-zinc-900' }
    };

    const rankLabels: Record<number, string> = {
      14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10',
      9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2'
    };

    const suitInfo = suitIcons[card.suit] || { icon: '♠', color: 'text-black' };
    const label = rankLabels[card.rank] || `${card.rank}`;

    return (
      <motion.div 
        initial={{ rotateY: 180, scale: 0.8, y: -40, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        className="w-16 h-24 sm:w-24 sm:h-36 rounded-xl bg-gradient-to-b from-white via-zinc-100 to-zinc-200 border-2 border-zinc-300 shadow-[0_15px_35px_rgba(15,23,42,0.18)] p-1.5 sm:p-2 flex flex-col justify-between select-none relative overflow-hidden"
      >
        <div className="flex items-center justify-between leading-none">
          <span className={`text-base sm:text-2xl font-black ${suitInfo.color}`}>{label}</span>
          <span className={`text-sm sm:text-lg ${suitInfo.color}`}>{suitInfo.icon}</span>
        </div>
        <div className={`text-3xl sm:text-5xl self-center ${suitInfo.color} drop-shadow-sm`}>
          {suitInfo.icon}
        </div>
        <div className="flex items-center justify-between leading-none rotate-180">
          <span className={`text-xl sm:text-2xl font-black ${suitInfo.color}`}>{label}</span>
          <span className={`text-base sm:text-lg ${suitInfo.color}`}>{suitInfo.icon}</span>
        </div>
      </motion.div>
    );
  };

  // Universal Phase tracker badge
  const phasesOrder = [
    { key: 'CREATED', label: '1. Created' },
    { key: 'BETTING_OPEN', label: '2. Betting Open' },
    { key: 'BETTING_CLOSED', label: '3. Closed' },
    { key: 'PLAYING', label: '4. Playing' },
    { key: 'RESULT', label: '5. Result' },
    { key: 'SETTLEMENT', label: '6. Settlement' },
    { key: 'COMPLETED', label: '7. Completed' },
    { key: 'NEXT_ROUND', label: '8. Next Round' }
  ];

  // Roadmap calculations
  const roadmapStats = useMemo(() => {
    if (!state.history || state.history.length === 0) {
      return { dragon: 48, tiger: 48, tie: 4, total: 0 };
    }
    const total = state.history.length;
    const dragonCount = state.history.filter(h => h.result?.winner === 'DRAGON').length;
    const tigerCount = state.history.filter(h => h.result?.winner === 'TIGER').length;
    const tieCount = state.history.filter(h => h.result?.winner === 'TIE').length;

    return {
      dragon: Math.round((dragonCount / total) * 100),
      tiger: Math.round((tigerCount / total) * 100),
      tie: Math.round((tieCount / total) * 100),
      total
    };
  }, [state.history]);

  return (
    <div className="flex flex-col h-full w-full max-w-[100vw] bg-white text-slate-900 font-sans overflow-hidden select-none relative">
      
      {/* Top HUD: Transparent Simulation Header + Camera & Sound Controls */}
      <div className="bg-white/80 border-b border-slate-200 px-2 sm:px-4 py-2 flex items-center justify-between z-30 backdrop-blur-md max-w-[100vw] overflow-x-hidden">
        
        {/* Left: Simulated Live Transparency Label */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 sm:px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-600">
              SIMULATED LIVE TABLE
            </span>
          </div>
          {state.roundId && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-mono text-amber-700">
              <span className="text-slate-500">ROUND:</span>
              <span className="font-bold">{state.roundId}</span>
            </div>
          )}
          <span className="hidden md:inline-block text-xs text-slate-500 border-l border-slate-200 pl-3">
            {roomName} • Provably Fair Virtual Live Dealer
          </span>
        </div>

        {/* Right: Camera Switcher + Mute + Provably Fair */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Camera Perspective Angle Selector (Visible on tablet/desktop) */}
          <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setCameraAngle('studio')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                cameraAngle === 'studio' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-700 hover:text-slate-900'
              }`}
              title="Studio Angle (Wide with Dealer)"
            >
              <Camera size={13} />
              <span className="hidden sm:inline">Studio</span>
            </button>
            <button
              onClick={() => setCameraAngle('felt')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                cameraAngle === 'felt' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-700 hover:text-slate-900'
              }`}
              title="Felt Angle (Close-up Betting)"
            >
              Felt
            </button>
            <button
              onClick={() => setCameraAngle('spotlight')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                cameraAngle === 'spotlight' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-700 hover:text-slate-900'
              }`}
              title="Spotlight Angle (Cards Reveal)"
            >
              Spotlight
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            data-testid="table-sound-toggle-btn"
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              !soundEnabled 
                ? 'bg-red-500/20 border-red-500/40 text-red-600' 
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
            title={soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
            aria-label={soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Official Result History Drawer Trigger */}
          <button
            onClick={() => setShowResultHistory(true)}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1 text-xs"
            title="Official Result History"
          >
            <History size={16} className="text-amber-600" />
            <span className="hidden sm:inline font-semibold">History</span>
          </button>

          {/* Provably Fair Info */}
          <button
            onClick={() => setShowProvablyFair(!showProvablyFair)}
            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
            title="Provably Fair Verification"
          >
            <ShieldCheck size={16} className="text-emerald-600" />
          </button>
        </div>
      </div>

      {/* Phase Breadcrumbs Tracker */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-[11px] overflow-x-auto scrollbar-hide">
        {/* w-max + mx-auto: centred when it fits, scrollable from the first step when it does not. */}
        <div className="flex w-max items-center gap-1.5 md:gap-3 mx-auto">
          {phasesOrder.map((p, idx) => {
            const isActive = state.phase === p.key || 
              (p.key === 'BETTING_CLOSED' && (state.phase === 'BETTING_CLOSING' || state.phase === 'BETTING_LOCKED')) ||
              (p.key === 'RESULT' && state.phase === 'RESULT_REVEAL');
            return (
              <React.Fragment key={p.key}>
                <div className={`px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1 ${
                  isActive 
                    ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105' 
                    : 'text-slate-500 bg-slate-50'
                }`}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  {p.label}
                </div>
                {idx < phasesOrder.length - 1 && (
                  <span className="text-slate-400">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Studio Viewport (Camera dependent styling) */}
      <div className={`relative flex-1 flex flex-col justify-between transition-all duration-500 overflow-hidden ${
        cameraAngle === 'felt' ? 'scale-[1.06] origin-bottom' :
        cameraAngle === 'spotlight' ? 'scale-[1.12] origin-center' : 'scale-100'
      }`}>
        
        {/* Ambient Studio Lighting Backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-slate-50 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,_rgba(217,119,6,0.15),_transparent_70%)] pointer-events-none" />

        {/* Virtual Dealer Stage */}
        <div className="relative pt-2 pb-1 flex flex-col items-center z-10">
          <VirtualDealerStage
            dealerId={state.dealer?.dealerId || 'dealer_maya'}
            name={state.dealer?.name || 'Virtual Maya'}
            title={state.dealer?.title || 'Virtual Live Dealer'}
            avatar={state.dealer?.avatar || 'maya'}
            action={state.dealer?.action || 'IDLE'}
            speech={state.dealer?.speech || 'Welcome to Simulated Live Dragon Tiger.'}
            phase={state.phase}
            cameraAngle={cameraAngle}
            voiceEnabled={soundEnabled}
          />
        </div>

        {/* Simulated Opponent Seats Row (AI test players in sandbox) */}
        <div className="relative z-10 px-4 py-1 flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide">
          <SimulatedOpponentBadge
            botId="BOT_01"
            displayName="SimBot-Alpha"
            seatIndex={1}
            activeBet={state.phase === 'BETTING_OPEN' || state.phase === 'PLAYING' ? { market: 'DRAGON', amount: 50 } : null}
          />
          <SimulatedOpponentBadge
            botId="BOT_02"
            displayName="SimBot-Aggro"
            seatIndex={2}
            activeBet={state.phase === 'BETTING_OPEN' || state.phase === 'PLAYING' ? { market: 'TIE', amount: 25 } : null}
          />
          <SimulatedOpponentBadge
            botId="BOT_03"
            displayName="SimBot-Balanced"
            seatIndex={3}
            activeBet={state.phase === 'BETTING_OPEN' || state.phase === 'PLAYING' ? { market: 'TIGER', amount: 100 } : null}
          />
        </div>

        {/* Central Card Battle Zone (Dragon vs Tiger) */}
        <div className="relative z-10 flex flex-col items-center my-auto px-4">
          
          {/* Phase Countdown Ring & Status */}
          <div className="mb-3 flex items-center gap-3">
            <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border backdrop-blur-md shadow-xl ${
              (state.phase === 'BETTING_OPEN' || state.phase === 'BETTING_CLOSING')
                ? 'bg-white/80 border-emerald-500/50 text-emerald-700'
                : (state.phase === 'BETTING_CLOSED' || state.phase === 'BETTING_LOCKED')
                ? 'bg-white/80 border-red-500/50 text-red-600'
                : (state.phase === 'PLAYING' || state.phase === 'DEALING')
                ? 'bg-white/80 border-amber-500/50 text-amber-700'
                : (state.phase === 'RESULT_REVEAL' || state.phase === 'RESULT')
                ? 'bg-white/80 border-purple-500/50 text-purple-700'
                : 'bg-white/80 border-blue-500/50 text-blue-700'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                (state.phase === 'BETTING_OPEN' || state.phase === 'BETTING_CLOSING') ? 'bg-emerald-400 animate-pulse' :
                (state.phase === 'BETTING_CLOSED' || state.phase === 'BETTING_LOCKED') ? 'bg-red-500' :
                (state.phase === 'PLAYING' || state.phase === 'DEALING') ? 'bg-amber-400 animate-spin' : 'bg-blue-400'
              }`} />
              <span className="font-black text-xs uppercase tracking-widest">
                {state.phase === 'CREATED' ? 'ROUND CREATED' :
                 state.phase === 'BETTING_OPEN' ? 'PLACE YOUR BETS' :
                 state.phase === 'BETTING_CLOSING' ? 'BETS CLOSING' :
                 (state.phase === 'BETTING_CLOSED' || state.phase === 'BETTING_LOCKED') ? 'BETS CLOSED' :
                 (state.phase === 'PLAYING' || state.phase === 'DEALING') ? 'DEALING CARDS' :
                 (state.phase === 'RESULT_REVEAL' || state.phase === 'RESULT') ? 'WINNER ANNOUNCED' :
                 state.phase === 'SETTLEMENT' ? 'SETTLING WINNERS' :
                 state.phase === 'COMPLETED' ? 'ROUND COMPLETED' : 'NEXT ROUND'}
              </span>
              
              {/* Countdown Number */}
              <span className={`font-mono font-black text-base px-2 py-0.5 rounded-md ${
                state.phase === 'BETTING_OPEN'
                  ? state.phaseTimeLeft <= 3 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-emerald-500/20 text-emerald-600'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {state.phaseTimeLeft}s
              </span>
            </div>
          </div>

          {/* Maintenance Mode Visual Alert */}
          {state.isMaintenance && (
            <div className="w-full max-w-2xl bg-amber-950/80 border border-amber-500/60 rounded-xl p-3 mb-2 text-amber-700 flex items-center justify-between shadow-lg animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="font-semibold text-xs">
                  {state.maintenanceMessage || 'Scheduled game maintenance in progress. Gameplay is temporarily paused.'}
                </span>
              </div>
              <span className="text-[10px] bg-amber-500 text-slate-950 font-mono px-2 py-0.5 rounded font-black uppercase tracking-wider">
                Maintenance
              </span>
            </div>
          )}

          {/* The Battle Felt: Dragon vs Tiger Cards */}
          <div className="w-full max-w-2xl flex items-center justify-center gap-2 sm:gap-8 md:gap-16 relative scale-95 sm:scale-100 origin-center">
            
            {/* DRAGON BOX */}
            <div className={`relative flex flex-col items-center p-2 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-500 ${
              state.result?.winner === 'DRAGON' && state.phase !== 'BETTING_OPEN'
                ? 'bg-red-600/30 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.7)] scale-105'
                : 'bg-red-950/20 border border-red-500/30'
            }`}>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <span className="text-red-600 font-black text-xs sm:text-base tracking-wider sm:tracking-widest uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                  DRAGON
                </span>
                <span className="text-[9px] sm:text-[10px] text-red-700 font-semibold bg-red-900/40 px-1 sm:px-1.5 py-0.5 rounded">1:1</span>
              </div>
              
              {/* Dragon Card Slot with 3D Reveal */}
              <div className="relative">
                <AnimatedCard 
                  card={state.result?.dragon}
                  isRevealed={state.phase === 'RESULT' || state.phase === 'SETTLEMENT' || state.phase === 'COMPLETED' || state.phase === 'RESULT_REVEAL'}
                  isWinner={state.result?.winner === 'DRAGON' && state.phase !== 'BETTING_OPEN'}
                  isLoser={state.result?.winner === 'TIGER' && state.phase !== 'BETTING_OPEN'}
                  dealFrom={{ x: 120, y: -160 }}
                  dealDelay={0.1}
                  size="lg"
                />
              </div>
            </div>

            {/* VS Emblem & Result Announcement */}
            <div className="flex flex-col items-center z-20 shrink-0">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-amber-400 to-amber-700 border-2 border-amber-200 shadow-xl flex items-center justify-center text-black font-black text-xs sm:text-base tracking-tighter">
                VS
              </div>

              {/* Rank comparison pill on reveal */}
              {state.result && (state.phase === 'RESULT' || state.phase === 'SETTLEMENT' || state.phase === 'COMPLETED' || state.phase === 'RESULT_REVEAL') && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-1 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-mono text-amber-700 font-bold whitespace-nowrap shadow"
                >
                  {state.result.dragon?.rank} vs {state.result.tiger?.rank}
                </motion.div>
              )}

              {/* TIE Market Banner */}
              <div className={`mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-xl text-center border transition-all ${
                state.result?.winner === 'TIE' && state.phase !== 'BETTING_OPEN'
                  ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-110 text-white font-black'
                  : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-600'
              }`}>
                <div className="text-[10px] sm:text-xs font-black tracking-widest">TIE</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-emerald-700">11:1</div>
              </div>
            </div>

            {/* TIGER BOX */}
            <div className={`relative flex flex-col items-center p-2 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-500 ${
              state.result?.winner === 'TIGER' && state.phase !== 'BETTING_OPEN'
                ? 'bg-yellow-500/30 border-2 border-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.7)] scale-105'
                : 'bg-yellow-950/20 border border-yellow-500/30'
            }`}>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <span className="text-yellow-600 font-black text-xs sm:text-base tracking-wider sm:tracking-widest uppercase drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                  TIGER
                </span>
                <span className="text-[9px] sm:text-[10px] text-yellow-700 font-semibold bg-yellow-900/40 px-1 sm:px-1.5 py-0.5 rounded">1:1</span>
              </div>
              
              {/* Tiger Card Slot with 3D Reveal */}
              <div className="relative">
                <AnimatedCard 
                  card={state.result?.tiger}
                  isRevealed={state.phase === 'RESULT' || state.phase === 'SETTLEMENT' || state.phase === 'COMPLETED' || state.phase === 'RESULT_REVEAL'}
                  isWinner={state.result?.winner === 'TIGER' && state.phase !== 'BETTING_OPEN'}
                  isLoser={state.result?.winner === 'DRAGON' && state.phase !== 'BETTING_OPEN'}
                  dealFrom={{ x: 0, y: -160 }}
                  dealDelay={0.4}
                  size="lg"
                />
              </div>
            </div>

          </div>

          {/* Winner Flash Banner */}
          <AnimatePresence>
            {(state.phase === 'RESULT' || state.phase === 'SETTLEMENT') && state.result?.winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`mt-4 px-6 py-2 rounded-2xl border-2 font-black text-lg sm:text-xl tracking-widest uppercase shadow-2xl flex items-center gap-2 ${
                  state.result.winner === 'DRAGON'
                    ? 'bg-red-600 border-red-300 text-white shadow-[0_0_35px_rgba(220,38,38,0.7)]'
                    : state.result.winner === 'TIGER'
                    ? 'bg-yellow-500 border-yellow-200 text-black shadow-[0_0_35px_rgba(234,179,8,0.7)]'
                    : 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_35px_rgba(16,185,129,0.7)]'
                }`}
              >
                <Sparkles size={18} />
                {state.result.winner} WINS!
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Roadmap / Bead Plate Strip */}
        <div className="relative z-10 bg-white/80 border-t border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Roadmap:</span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-red-600 font-bold">D: {roadmapStats.dragon}%</span>
              <span className="text-slate-400">•</span>
              <span className="text-yellow-600 font-bold">T: {roadmapStats.tiger}%</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-600 font-bold">Tie: {roadmapStats.tie}%</span>
            </div>
          </div>

          {/* Bead History Bubbles */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            {state.history.length === 0 ? (
              <span className="text-xs text-slate-500 italic">New shoe in progress...</span>
            ) : (
              state.history.slice(0, 18).map((h, i) => {
                const w = h.result?.winner;
                return (
                  <button 
                    key={h.roundId || i}
                    data-testid="roadmap-bead-bubble"
                    onClick={() => {
                      setSelectedRoundDetail({
                        resultId: (h as any).resultId || `RES-${h.roundId}`,
                        roundId: h.roundId,
                        gameId: 'dragon-tiger',
                        variantId: 'Standard',
                        tableId: 'DT-01',
                        resultType: 'CARD',
                        resultValue: w || 'DRAGON',
                        resultSummary: w,
                        resultTimestamp: h.resultTime,
                        commitmentHash: (h as any).serverSeedHash || state.serverSeedHash,
                        serverSeed: (h as any).serverSeed || state.serverSeed,
                        clientSeed: (h as any).clientSeed || state.clientSeed,
                        settlementStatus: 'SETTLED'
                      });
                    }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm shrink-0 border transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer ${
                      w === 'DRAGON' ? 'bg-red-600 border-red-400 text-white hover:bg-red-500' :
                      w === 'TIGER' ? 'bg-yellow-500 border-yellow-300 text-black hover:bg-yellow-400' :
                      'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500'
                    }`}
                    title={`Round ${h.roundId}: ${w} — Click for Provably Fair Verification`}
                  >
                    {w ? w[0] : '-'}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Regulatory & Non-Predictive Disclaimer (Prompt #65 Section 9) */}
        <div className="relative z-10 px-4 py-1.5 bg-white/80 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <span>Historical outcomes only • Independent random trials • Not a predictive system</span>
          <span className="hidden sm:inline font-mono text-[10px] text-amber-600">Click any bead to verify cryptographic proof</span>
        </div>

        {/* Interactive Betting Layout Grid */}
        <div className="relative z-10 p-3 sm:p-4 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-1.5 sm:gap-3">
            
            {/* Dragon Betting Spot */}
            <button
              data-testid="bet-spot-dragon"
              onClick={() => handleBetClick('DRAGON')}
              disabled={state.phase !== 'BETTING_OPEN' && state.phase !== 'BETTING_CLOSING'}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center border-2 transition-all ${
                (state.phase === 'BETTING_OPEN' || state.phase === 'BETTING_CLOSING')
                  ? 'bg-gradient-to-b from-red-950/60 to-red-900/30 border-red-500/50 hover:border-red-400 active:scale-98 cursor-pointer'
                  : 'bg-red-950/20 border-red-500/20 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-red-600">DRAGON</span>
              <span className="text-[10px] sm:text-xs font-bold text-red-700">Pays 1:1</span>
              
              {/* Stacked Chip Visualizer */}
              {myBets['DRAGON'] && (
                <div className="absolute -top-1.5 sm:top-2 -right-1 sm:right-2 bg-red-600 text-white text-[10px] sm:text-xs font-black px-1.5 sm:px-2.5 py-0.5 rounded-full border border-red-300 shadow-lg animate-bounce">
                  ₹{myBets['DRAGON']}
                </div>
              )}
            </button>

            {/* Tie Betting Spot */}
            <button
              data-testid="bet-spot-tie"
              onClick={() => handleBetClick('TIE')}
              disabled={state.phase !== 'BETTING_OPEN' && state.phase !== 'BETTING_CLOSING'}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center border-2 transition-all ${
                (state.phase === 'BETTING_OPEN' || state.phase === 'BETTING_CLOSING')
                  ? 'bg-gradient-to-b from-emerald-950/60 to-emerald-900/30 border-emerald-500/50 hover:border-emerald-400 active:scale-98 cursor-pointer'
                  : 'bg-emerald-950/20 border-emerald-500/20 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-emerald-600">TIE</span>
              <span className="text-[10px] sm:text-xs font-bold text-emerald-700">Pays 11:1</span>
              
              {myBets['TIE'] && (
                <div className="absolute -top-1.5 sm:top-2 -right-1 sm:right-2 bg-emerald-600 text-white text-[10px] sm:text-xs font-black px-1.5 sm:px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-lg animate-bounce">
                  ₹{myBets['TIE']}
                </div>
              )}
            </button>

            {/* Tiger Betting Spot */}
            <button
              data-testid="bet-spot-tiger"
              onClick={() => handleBetClick('TIGER')}
              disabled={state.phase !== 'BETTING_OPEN' && state.phase !== 'BETTING_CLOSING'}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center border-2 transition-all ${
                (state.phase === 'BETTING_OPEN' || state.phase === 'BETTING_CLOSING')
                  ? 'bg-gradient-to-b from-yellow-950/60 to-yellow-900/30 border-yellow-500/50 hover:border-yellow-400 active:scale-98 cursor-pointer'
                  : 'bg-yellow-950/20 border-yellow-500/20 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-yellow-600">TIGER</span>
              <span className="text-[10px] sm:text-xs font-bold text-yellow-700">Pays 1:1</span>
              
              {myBets['TIGER'] && (
                <div className="absolute -top-1.5 sm:top-2 -right-1 sm:right-2 bg-yellow-500 text-black text-[10px] sm:text-xs font-black px-1.5 sm:px-2.5 py-0.5 rounded-full border border-yellow-300 shadow-lg animate-bounce">
                  ₹{myBets['TIGER']}
                </div>
              )}
            </button>

          </div>
        </div>

      </div>

      {/* Bottom Controls Bar: Chips & Action Buttons */}
      <div className="bg-white/80 border-t border-slate-200 px-3 sm:px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Quick Bet Modifiers: Repeat, 2x, Clear */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleRepeatBet}
              disabled={state.phase !== 'BETTING_OPEN'}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1 text-slate-800 cursor-pointer min-h-[36px]"
              title="Repeat Previous Bets"
            >
              <RotateCcw size={13} />
              Repeat
            </button>
            <button
              onClick={handleDoubleBets}
              disabled={state.phase !== 'BETTING_OPEN'}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-[11px] sm:text-xs font-bold transition-colors text-slate-800 cursor-pointer min-h-[36px]"
              title="Double Current Bets (2x)"
            >
              2x Double
            </button>
            <button
              onClick={handleClearBets}
              disabled={state.phase !== 'BETTING_OPEN'}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 text-[11px] sm:text-xs font-bold transition-colors text-red-700 cursor-pointer min-h-[36px]"
              title="Clear Active Bets"
            >
              Clear
            </button>
          </div>

          {/* 3D Casino Chips Selector */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-1">
            {CHIP_DENOMINATIONS.map(chip => {
              const isSelected = selectedChip === chip.value;
              return (
                <button
                  key={chip.value}
                  data-testid={`chip-${chip.value}`}
                  onClick={() => {
                    setSelectedChip(chip.value);
                    audioEngine.play('click');
                  }}
                  className={`relative w-9 h-9 sm:w-12 sm:h-12 rounded-full flex-shrink-0 flex items-center justify-center font-black text-[10px] sm:text-xs transition-all duration-200 border-2 shadow-lg cursor-pointer ${
                    chip.border
                  } bg-gradient-to-br ${chip.color} ${
                    isSelected 
                      ? 'scale-110 -translate-y-1 ring-2 sm:ring-4 ring-slate-200 shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <div className="absolute inset-0.5 sm:inset-1 rounded-full border border-slate-200 border-dashed pointer-events-none" />
                  <span className="text-slate-900 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {chip.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Wallet Balance Display */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-slate-600 font-semibold">Balance:</span>
            <span className="text-sm font-black text-emerald-600 font-mono">₹{balance.toFixed(2)}</span>
          </div>

        </div>
      </div>

      {/* Provably Fair Modal Drawer */}
      <AnimatePresence>
        {showProvablyFair && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border border-emerald-500/40 rounded-2xl max-w-lg w-full max-h-[88dvh] overflow-y-auto overscroll-contain pb-safe p-5 sm:p-6 shadow-2xl relative text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 sticky -top-5 bg-white/90 backdrop-blur-md pt-1 pb-2 z-10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={22} />
                  <h3 className="font-black text-base sm:text-lg text-slate-900">Provably Fair Verification</h3>
                </div>
                <button 
                  onClick={() => setShowProvablyFair(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                  aria-label="Close Verification"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs mt-4">
                <div>
                  <label className="text-slate-500 font-bold block mb-1">Server Seed Hash (Pre-committed SHA-256)</label>
                  <div className="bg-white/80 p-2.5 rounded-lg font-mono text-emerald-700 break-all border border-slate-200 select-all">
                    {state.serverSeedHash || 'Generated upon round creation'}
                  </div>
                </div>

                {state.serverSeed && (
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">Revealed Server Seed</label>
                    <div className="bg-white/80 p-2.5 rounded-lg font-mono text-amber-700 break-all border border-slate-200 select-all">
                      {state.serverSeed}
                    </div>
                  </div>
                )}

                {state.clientSeed && (
                  <div>
                    <label className="text-slate-500 font-bold block mb-1">Client Seed</label>
                    <div className="bg-white/80 p-2.5 rounded-lg font-mono text-blue-700 break-all border border-slate-200 select-all">
                      {state.clientSeed}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    How It Works
                  </div>
                  <p>
                    The server generates a secret seed and commits its SHA-256 hash before any bets are placed. 
                    Once bets close, client seed entropy resolves the cards deterministically.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowProvablyFair(false)}
                className="mt-6 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-black transition-colors"
              >
                Close Verification
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reusable Chip Flights */}
      <AnimatedChipFlight 
        flights={chipFlights} 
        onFlightComplete={(id) => setChipFlights(prev => prev.filter(f => f.id !== id))} 
      />

      {/* Universal Win & Loss Animation Overlay */}
      <WinLossCelebration
        status={celebration.status}
        net={celebration.net}
        amount={celebration.amount}
        multiplier={celebration.multiplier}
        message={celebration.message}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })}
      />

      {/* Official Result History Drawer */}
      <ResultHistoryDrawer
        gameId="dragon-tiger"
        variantId="Standard"
        isOpen={showResultHistory}
        onClose={() => setShowResultHistory(false)}
      />

      {/* Provably Fair Round Verification Modal (Prompt #65) */}
      <RoundDetailModal
        round={selectedRoundDetail}
        isOpen={!!selectedRoundDetail}
        onClose={() => setSelectedRoundDetail(null)}
      />
    </div>
  );
}
