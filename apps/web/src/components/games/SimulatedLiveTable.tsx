"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, VolumeX, Camera, Info, ShieldCheck, 
  RotateCcw, Sparkles, AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { audioEngine } from '@/lib/audioEngine';
import { useAudioStore } from '@/store/audioStore';
import WinLossCelebration from './WinLossCelebration';

// Types
export interface TableCard {
  suit: 'S' | 'H' | 'D' | 'C';
  rank: number; // 2-14 (14 = Ace)
}

export interface DragonTigerResult {
  dragon: TableCard;
  tiger: TableCard;
  winner: 'DRAGON' | 'TIGER' | 'TIE';
}

export interface VirtualDealer {
  name: string;
  title: string;
  tableId: string;
  avatar: string;
  speech: string;
  action: 'INVITING_BETS' | 'CLOSING_BETS' | 'DEALING' | 'ANNOUNCING_RESULT' | 'SETTLING' | 'PREPARING_NEXT';
}

export interface SimulatedLiveState {
  roundId?: string;
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
  history: Array<{ roundId: string; result: DragonTigerResult; resultTime: string | Date }>;
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
  roomName = 'Standard Table 1'
}: Props) {
  // Camera angles: 'studio' (wide), 'felt' (close-up on betting), 'spotlight' (dramatic card view)
  const [cameraAngle, setCameraAngle] = useState<'studio' | 'felt' | 'spotlight'>('studio');
  const { soundEnabled, toggleSound } = useAudioStore();
  const [selectedChip, setSelectedChip] = useState<number>(100);
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  const [previousBets, setPreviousBets] = useState<Record<string, number>>({});
  const [showProvablyFair, setShowProvablyFair] = useState<boolean>(false);
  const [showRoadmap, setShowRoadmap] = useState<boolean>(true);
  const [celebration, setCelebration] = useState<{
    status: 'IDLE' | 'WON' | 'LOST';
    amount: number;
    multiplier?: number;
    message?: string;
  }>({ status: 'IDLE', amount: 0 });

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
    if (state.phase === 'BETTING_CLOSED') {
      audioEngine.play('roundStart');
    } else if (state.phase === 'DEALING') {
      audioEngine.play('card');
    } else if (state.phase === 'RESULT' || state.phase === 'SETTLEMENT') {
      audioEngine.play('win');
      // Trigger winning / losing animation based on user's active bets
      const winner = state.result?.winner;
      if (winner) {
        const totalBet = Object.values(myBets).reduce((a, b) => a + b, 0);
        const wonBet = myBets[winner] || 0;
        if (wonBet > 0) {
          const mult = winner === 'TIE' ? 8 : 2;
          const payout = wonBet * mult;
          setCelebration({
            status: 'WON',
            amount: payout,
            multiplier: mult,
            message: `${winner} WINS!`
          });
        } else if (totalBet > 0) {
          setCelebration({
            status: 'LOST',
            amount: totalBet,
            message: `${winner} Won • Bet Lost`
          });
        }
      }
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
        <div className="w-16 h-24 sm:w-24 sm:h-36 rounded-xl bg-gradient-to-br from-red-950 via-red-900 to-black border-2 border-red-500/40 shadow-2xl flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-black/60" />
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
        className="w-16 h-24 sm:w-24 sm:h-36 rounded-xl bg-gradient-to-b from-white via-zinc-100 to-zinc-200 border-2 border-zinc-300 shadow-[0_15px_35px_rgba(0,0,0,0.8)] p-1.5 sm:p-2 flex flex-col justify-between select-none relative overflow-hidden"
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
    <div className="flex flex-col h-full w-full bg-[#070b12] text-white font-sans overflow-hidden select-none relative">
      
      {/* Top HUD: Transparent Simulation Header + Camera & Sound Controls */}
      <div className="bg-black/60 border-b border-white/10 px-4 py-2 flex items-center justify-between z-30 backdrop-blur-md">
        
        {/* Left: Simulated Live Transparency Label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
              SIMULATED LIVE TABLE
            </span>
          </div>
          <span className="hidden md:inline-block text-xs text-white/50 border-l border-white/10 pl-3">
            {roomName} • Provably Fair Virtual Live Dealer
          </span>
        </div>

        {/* Right: Camera Switcher + Mute + Provably Fair */}
        <div className="flex items-center gap-2">
          
          {/* Camera Perspective Angle Selector */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setCameraAngle('studio')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                cameraAngle === 'studio' ? 'bg-amber-500 text-black shadow-md' : 'text-white/70 hover:text-white'
              }`}
              title="Studio Angle (Wide with Dealer)"
            >
              <Camera size={13} />
              <span className="hidden sm:inline">Studio</span>
            </button>
            <button
              onClick={() => setCameraAngle('felt')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                cameraAngle === 'felt' ? 'bg-amber-500 text-black shadow-md' : 'text-white/70 hover:text-white'
              }`}
              title="Felt Angle (Close-up Betting)"
            >
              Felt
            </button>
            <button
              onClick={() => setCameraAngle('spotlight')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                cameraAngle === 'spotlight' ? 'bg-amber-500 text-black shadow-md' : 'text-white/70 hover:text-white'
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
                ? 'bg-red-500/20 border-red-500/40 text-red-400' 
                : 'bg-white/5 border-white/10 text-white/80 hover:text-white'
            }`}
            title={soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
            aria-label={soundEnabled ? 'Mute Sound' : 'Unmute Sound'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Provably Fair Info */}
          <button
            onClick={() => setShowProvablyFair(!showProvablyFair)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white transition-colors"
            title="Provably Fair Verification"
          >
            <ShieldCheck size={16} className="text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Phase Breadcrumbs Tracker */}
      <div className="bg-black/40 border-b border-white/5 px-4 py-1.5 flex items-center justify-between text-[11px] overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 md:gap-3 mx-auto">
          {phasesOrder.map((p, idx) => {
            const isActive = state.phase === p.key;
            return (
              <React.Fragment key={p.key}>
                <div className={`px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1 ${
                  isActive 
                    ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105' 
                    : 'text-white/40 bg-white/5'
                }`}>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />}
                  {p.label}
                </div>
                {idx < phasesOrder.length - 1 && (
                  <span className="text-white/20">→</span>
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#120810] via-[#0b1320] to-[#060a10] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,_rgba(217,119,6,0.15),_transparent_70%)] pointer-events-none" />

        {/* Dealer Stage & Avatar Area */}
        <div className="relative pt-2 pb-1 flex flex-col items-center z-10">
          
          {/* Dealer Speech Bubble */}
          <motion.div 
            key={state.dealer?.speech}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mb-2 max-w-md bg-black/80 border border-amber-500/40 shadow-[0_4px_20px_rgba(0,0,0,0.6)] px-4 py-1.5 rounded-2xl flex items-center gap-2 backdrop-blur-md"
          >
            <Sparkles size={14} className="text-amber-400 shrink-0 animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-amber-100 text-center">
              {state.dealer?.speech || "Welcome to Simulated Live Dragon Tiger."}
            </span>
          </motion.div>

          {/* Virtual Dealer Podium */}
          <div className="flex items-center gap-4">
            
            {/* Animated Virtual Dealer Avatar */}
            <div className="relative flex flex-col items-center">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-amber-500/20 to-black/60 border-2 border-amber-500/50 p-1 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-center overflow-hidden">
                {/* SVG Dealer Maya Illustration */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* Dealer Hair Back */}
                  <path d="M 22 45 C 20 20, 80 20, 78 45 C 80 65, 75 75, 72 85 L 28 85 C 25 75, 20 65, 22 45 Z" fill="#1c1917" />
                  
                  {/* Torso / Tuxedo Vest */}
                  <path d="M 25 80 L 75 80 L 80 100 L 20 100 Z" fill="#09090b" />
                  <path d="M 38 80 L 50 95 L 62 80 Z" fill="#fafaf9" />
                  {/* Golden Tie */}
                  <polygon points="48,82 52,82 54,92 50,96 46,92" fill="#f59e0b" />
                  
                  {/* Face & Neck */}
                  <rect x="44" y="68" width="12" height="14" rx="3" fill="#fcd34d" />
                  <ellipse cx="50" cy="50" rx="20" ry="24" fill="#fef08a" />
                  
                  {/* Front Hair Bangs */}
                  <path d="M 30 40 C 35 25, 65 25, 70 40 C 65 33, 35 33, 30 40 Z" fill="#1c1917" />
                  
                  {/* Eyes (blinking via motion/css) */}
                  <ellipse cx="42" cy="48" rx="2.5" ry="3" fill="#1c1917" />
                  <ellipse cx="58" cy="48" rx="2.5" ry="3" fill="#1c1917" />
                  <circle cx="43" cy="47" r="1" fill="#ffffff" />
                  <circle cx="59" cy="47" r="1" fill="#ffffff" />
                  
                  {/* Smile */}
                  <path d="M 44 60 Q 50 65 56 60" stroke="#b45309" strokeWidth="2" strokeLinecap="round" fill="transparent" />
                  {/* Blush */}
                  <circle cx="37" cy="55" r="3" fill="#f87171" opacity="0.4" />
                  <circle cx="63" cy="55" r="3" fill="#f87171" opacity="0.4" />
                </svg>

                {/* Live Status Ring */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/40 animate-spin-slow pointer-events-none" />
              </div>

              {/* Dealer Nameplate */}
              <div className="mt-1 bg-black/90 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest text-amber-300 uppercase shadow-md">
                {state.dealer?.name || 'MAYA'} • VIRTUAL DEALER
              </div>
            </div>

            {/* Virtual Card Shoe (Top Right of Felt) */}
            <div className="hidden sm:flex flex-col items-center bg-black/70 border border-white/10 px-3 py-2 rounded-xl shadow-lg">
              <div className="text-[10px] font-mono text-white/50 tracking-wider uppercase mb-1">8-Deck Shoe</div>
              <div className="w-14 h-10 bg-gradient-to-br from-red-950 to-zinc-900 border border-red-500/40 rounded-lg flex items-center justify-center relative shadow-inner">
                <span className="text-[10px] font-bold text-red-400">SHOE</span>
                {state.phase === 'DEALING' && (
                  <motion.div 
                    initial={{ x: 0, opacity: 1 }}
                    animate={{ x: -20, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="absolute -left-2 w-4 h-6 bg-white rounded-sm border border-black shadow-md"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Central Card Battle Zone (Dragon vs Tiger) */}
        <div className="relative z-10 flex flex-col items-center my-auto px-4">
          
          {/* Phase Countdown Ring & Status */}
          <div className="mb-3 flex items-center gap-3">
            <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border backdrop-blur-md shadow-xl ${
              state.phase === 'BETTING_OPEN' 
                ? 'bg-black/70 border-emerald-500/50 text-emerald-300'
                : state.phase === 'BETTING_CLOSED'
                ? 'bg-black/70 border-red-500/50 text-red-400'
                : state.phase === 'DEALING'
                ? 'bg-black/70 border-amber-500/50 text-amber-300'
                : 'bg-black/70 border-blue-500/50 text-blue-300'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                state.phase === 'BETTING_OPEN' ? 'bg-emerald-400 animate-pulse' :
                state.phase === 'BETTING_CLOSED' ? 'bg-red-500' :
                state.phase === 'DEALING' ? 'bg-amber-400 animate-spin' : 'bg-blue-400'
              }`} />
              <span className="font-black text-xs uppercase tracking-widest">
                {state.phase === 'CREATED' ? 'ROUND CREATED' :
                 state.phase === 'BETTING_OPEN' ? 'PLACE YOUR BETS' :
                 state.phase === 'BETTING_CLOSED' ? 'BETS CLOSED' :
                 (state.phase === 'PLAYING' || state.phase === 'DEALING') ? 'DEALING CARDS' :
                 state.phase === 'RESULT' ? 'WINNER ANNOUNCED' :
                 state.phase === 'SETTLEMENT' ? 'SETTLING WINNERS' :
                 state.phase === 'COMPLETED' ? 'ROUND COMPLETED' : 'NEXT ROUND'}
              </span>
              
              {/* Countdown Number */}
              <span className={`font-mono font-black text-base px-2 py-0.5 rounded-md ${
                state.phase === 'BETTING_OPEN'
                  ? state.phaseTimeLeft <= 3 
                    ? 'bg-red-600 text-white animate-pulse' 
                    : 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/10 text-white/80'
              }`}>
                {state.phaseTimeLeft}s
              </span>
            </div>
          </div>

          {/* Maintenance Mode Visual Alert */}
          {state.isMaintenance && (
            <div className="w-full max-w-2xl bg-amber-950/80 border border-amber-500/60 rounded-xl p-3 mb-2 text-amber-200 flex items-center justify-between shadow-lg animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
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
                <span className="text-red-400 font-black text-xs sm:text-base tracking-wider sm:tracking-widest uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                  DRAGON
                </span>
                <span className="text-[9px] sm:text-[10px] text-red-300/70 font-semibold bg-red-900/40 px-1 sm:px-1.5 py-0.5 rounded">1:1</span>
              </div>
              
              {/* Dragon Card Slot */}
              <div className="relative">
                {renderCard(state.result?.dragon, state.phase === 'PLAYING' || state.phase === 'DEALING' || state.phase === 'RESULT' || state.phase === 'SETTLEMENT' || state.phase === 'COMPLETED')}
              </div>
            </div>

            {/* VS Emblem & Result Announcement */}
            <div className="flex flex-col items-center z-20 shrink-0">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-amber-400 to-amber-700 border-2 border-amber-200 shadow-xl flex items-center justify-center text-black font-black text-xs sm:text-base tracking-tighter">
                VS
              </div>

              {/* TIE Market Banner */}
              <div className={`mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-xl text-center border transition-all ${
                state.result?.winner === 'TIE' && state.phase !== 'BETTING_OPEN'
                  ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-110 text-white font-black'
                  : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
              }`}>
                <div className="text-[10px] sm:text-xs font-black tracking-widest">TIE</div>
                <div className="text-[8px] sm:text-[10px] font-bold text-emerald-300/70">8:1</div>
              </div>
            </div>

            {/* TIGER BOX */}
            <div className={`relative flex flex-col items-center p-2 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-500 ${
              state.result?.winner === 'TIGER' && state.phase !== 'BETTING_OPEN'
                ? 'bg-yellow-500/30 border-2 border-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.7)] scale-105'
                : 'bg-yellow-950/20 border border-yellow-500/30'
            }`}>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                <span className="text-yellow-400 font-black text-xs sm:text-base tracking-wider sm:tracking-widest uppercase drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                  TIGER
                </span>
                <span className="text-[9px] sm:text-[10px] text-yellow-300/70 font-semibold bg-yellow-900/40 px-1 sm:px-1.5 py-0.5 rounded">1:1</span>
              </div>
              
              {/* Tiger Card Slot */}
              <div className="relative">
                {renderCard(state.result?.tiger, ((state.phase === 'PLAYING' || state.phase === 'DEALING') && state.dealingStep?.step === 2) || state.phase === 'RESULT' || state.phase === 'SETTLEMENT' || state.phase === 'COMPLETED')}
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
        <div className="relative z-10 bg-black/70 border-t border-b border-white/10 px-4 py-2 flex items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-white/50">Roadmap:</span>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-red-400 font-bold">D: {roadmapStats.dragon}%</span>
              <span className="text-white/30">•</span>
              <span className="text-yellow-400 font-bold">T: {roadmapStats.tiger}%</span>
              <span className="text-white/30">•</span>
              <span className="text-emerald-400 font-bold">Tie: {roadmapStats.tie}%</span>
            </div>
          </div>

          {/* Bead History Bubbles */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            {state.history.length === 0 ? (
              <span className="text-xs text-white/40 italic">New shoe in progress...</span>
            ) : (
              state.history.slice(0, 18).map((h, i) => {
                const w = h.result?.winner;
                return (
                  <div 
                    key={h.roundId || i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-sm shrink-0 border ${
                      w === 'DRAGON' ? 'bg-red-600 border-red-400 text-white' :
                      w === 'TIGER' ? 'bg-yellow-500 border-yellow-300 text-black' :
                      'bg-emerald-600 border-emerald-400 text-white'
                    }`}
                    title={`${w} (${new Date(h.resultTime).toLocaleTimeString()})`}
                  >
                    {w ? w[0] : '-'}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Interactive Betting Layout Grid */}
        <div className="relative z-10 p-3 sm:p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-1.5 sm:gap-3">
            
            {/* Dragon Betting Spot */}
            <button
              data-testid="bet-spot-dragon"
              onClick={() => handleBetClick('DRAGON')}
              disabled={state.phase !== 'BETTING_OPEN'}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center border-2 transition-all ${
                state.phase === 'BETTING_OPEN'
                  ? 'bg-gradient-to-b from-red-950/60 to-red-900/30 border-red-500/50 hover:border-red-400 active:scale-98 cursor-pointer'
                  : 'bg-red-950/20 border-red-500/20 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-red-400">DRAGON</span>
              <span className="text-[10px] sm:text-xs font-bold text-red-300/60">Pays 1:1</span>
              
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
              disabled={state.phase !== 'BETTING_OPEN'}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center border-2 transition-all ${
                state.phase === 'BETTING_OPEN'
                  ? 'bg-gradient-to-b from-emerald-950/60 to-emerald-900/30 border-emerald-500/50 hover:border-emerald-400 active:scale-98 cursor-pointer'
                  : 'bg-emerald-950/20 border-emerald-500/20 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-emerald-400">TIE</span>
              <span className="text-[10px] sm:text-xs font-bold text-emerald-300/60">Pays 8:1</span>
              
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
              disabled={state.phase !== 'BETTING_OPEN'}
              className={`relative rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center border-2 transition-all ${
                state.phase === 'BETTING_OPEN'
                  ? 'bg-gradient-to-b from-yellow-950/60 to-yellow-900/30 border-yellow-500/50 hover:border-yellow-400 active:scale-98 cursor-pointer'
                  : 'bg-yellow-950/20 border-yellow-500/20 opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-wider sm:tracking-widest text-yellow-400">TIGER</span>
              <span className="text-[10px] sm:text-xs font-bold text-yellow-300/60">Pays 1:1</span>
              
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
      <div className="bg-black/90 border-t border-white/10 px-3 sm:px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] z-30 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          
          {/* Quick Bet Modifiers: Repeat, 2x, Clear */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleRepeatBet}
              disabled={state.phase !== 'BETTING_OPEN'}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-[11px] sm:text-xs font-bold transition-colors flex items-center gap-1 text-white/90 cursor-pointer min-h-[36px]"
              title="Repeat Previous Bets"
            >
              <RotateCcw size={13} />
              Repeat
            </button>
            <button
              onClick={handleDoubleBets}
              disabled={state.phase !== 'BETTING_OPEN'}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-[11px] sm:text-xs font-bold transition-colors text-white/90 cursor-pointer min-h-[36px]"
              title="Double Current Bets (2x)"
            >
              2x Double
            </button>
            <button
              onClick={handleClearBets}
              disabled={state.phase !== 'BETTING_OPEN'}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 text-[11px] sm:text-xs font-bold transition-colors text-red-300 cursor-pointer min-h-[36px]"
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
                      ? 'scale-110 -translate-y-1 ring-2 sm:ring-4 ring-white/50 shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <div className="absolute inset-0.5 sm:inset-1 rounded-full border border-white/30 border-dashed pointer-events-none" />
                  <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {chip.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Wallet Balance Display */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-white/60 font-semibold">Balance:</span>
            <span className="text-sm font-black text-emerald-400 font-mono">₹{balance.toFixed(2)}</span>
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0f172a] border border-emerald-500/40 rounded-2xl max-w-lg w-full max-h-[88dvh] overflow-y-auto overscroll-contain pb-safe p-5 sm:p-6 shadow-2xl relative text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 sticky -top-5 bg-[#0f172a]/95 backdrop-blur-md pt-1 pb-2 z-10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-400" size={22} />
                  <h3 className="font-black text-base sm:text-lg text-white">Provably Fair Verification</h3>
                </div>
                <button 
                  onClick={() => setShowProvablyFair(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white cursor-pointer"
                  aria-label="Close Verification"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs mt-4">
                <div>
                  <label className="text-white/50 font-bold block mb-1">Server Seed Hash (Pre-committed SHA-256)</label>
                  <div className="bg-black/60 p-2.5 rounded-lg font-mono text-emerald-300 break-all border border-white/5 select-all">
                    {state.serverSeedHash || 'Generated upon round creation'}
                  </div>
                </div>

                {state.serverSeed && (
                  <div>
                    <label className="text-white/50 font-bold block mb-1">Revealed Server Seed</label>
                    <div className="bg-black/60 p-2.5 rounded-lg font-mono text-amber-300 break-all border border-white/5 select-all">
                      {state.serverSeed}
                    </div>
                  </div>
                )}

                {state.clientSeed && (
                  <div>
                    <label className="text-white/50 font-bold block mb-1">Client Seed</label>
                    <div className="bg-black/60 p-2.5 rounded-lg font-mono text-blue-300 break-all border border-white/5 select-all">
                      {state.clientSeed}
                    </div>
                  </div>
                )}

                <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-white/70 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
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

      {/* Universal Win & Loss Animation Overlay */}
      <WinLossCelebration
        status={celebration.status}
        amount={celebration.amount}
        multiplier={celebration.multiplier}
        message={celebration.message}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })}
      />

    </div>
  );
}
