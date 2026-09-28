"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Clock, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { useBetSettlements } from '@/hooks/useBetSettlements';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import ColourResultReel from '@/components/games/ColourResultReel';
import { audioEngine } from '@/lib/audioEngine';
import AnimatedChipFlight from '@/components/games/animation/AnimatedChipFlight';

const COLORS = [
  { id: 'green', label: 'Join Green', multiplier: 2, bg: 'bg-green-500', shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.5)]' },
  { id: 'violet', label: 'Join Violet', multiplier: 4.5, bg: 'bg-purple-500', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.5)]' },
  { id: 'red', label: 'Join Red', multiplier: 2, bg: 'bg-red-500', shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]' },
];

const NUMBERS = Array.from({length: 10}, (_, i) => i);

/** Maps the engine's universal phases onto the three states this page shows. */
function normalisePhase(state: string): 'OPEN' | 'LOCKED' | 'RESULT' | 'UPCOMING' {
  if (state === 'BETTING_OPEN' || state === 'BETTING_CLOSING' || state === 'OPEN') return 'OPEN';
  if (state === 'BETTING_LOCKED' || state === 'PLAYING' || state === 'LOCKED') return 'LOCKED';
  if (state === 'RESULT_REVEAL' || state === 'SETTLEMENT' || state === 'COMPLETED' || state === 'NEXT_ROUND' || state === 'RESULT') return 'RESULT';
  return 'UPCOMING';
}

export default function ColorPrediction() {
  const { balance, setBalance, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [activeTab, setActiveTab] = useState<'1min' | '3min'>('1min');
  const [countdown, setCountdown] = useState(0);
  const [period, setPeriod] = useState("—");
  const [gameState, setGameState] = useState("UPCOMING");
  const [history, setHistory] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<{ color: string; number: number; period: string } | null>(null);
  const [chipFlights, setChipFlights] = useState<any[]>([]);
  
  // Betting state
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<{type: 'color'|'number', val: string|number, color: string} | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [placingBet, setPlacingBet] = useState(false);
  const [activeBets, setActiveBets] = useState<Array<{ type: string; val: string | number; amount: number }>>([]);
  const [celebration, setCelebration] = useState<{ type: 'win' | 'loss'; amount: number; multiplier?: string; net?: number } | null>(null);

  // Initialize Socket
  useEffect(() => {
    const s = createGameSocket();
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Win/loss banner from the server's settlement (`bet:settled`), never from client-side payout maths.
  const showColourOutcome = ({ staked, paid, bestMultiplier }: { staked: number; paid: number; bestMultiplier: number }) => {
    if (paid > 0) {
      setCelebration({ type: 'win', amount: paid, multiplier: `${bestMultiplier.toFixed(1)}x`, net: paid - staked });
      setChipFlights(prev => [
        ...prev,
        {
          id: `cp-win-${Date.now()}`,
          amount: paid,
          type: 'WIN',
          startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
          startY: 260,
          endX: 60,
          endY: typeof window !== 'undefined' ? window.innerHeight - 50 : 600,
          color: 'from-amber-400 to-yellow-600',
          borderColor: 'border-yellow-200'
        }
      ]);
    } else if (staked > 0) {
      setCelebration({ type: 'loss', amount: staked });
    }
    setActiveBets([]);
    fetchBalance();
  };

  // The celebration waits for the result reel to finish landing so it never spoils the draw.
  useBetSettlements(socket, 'colour', (summary) => {
    setTimeout(() => showColourOutcome(summary), 2700);
  });

  // Room management
  useEffect(() => {
    if (!socket) return;
    
    // Clear previous state when switching rooms
    setHistory([]);
    setCountdown(0);
    setGameState("UPCOMING");
    
    socket.emit('colour:join', { room: activeTab });
    
    const onTick = (data: any) => {
      const phase = normalisePhase(data.state);
      setPeriod(data.period);
      setGameState(phase);
      setCountdown(data.remainingSeconds);
      if (data.remainingSeconds <= 3 && data.remainingSeconds > 0) {
        audioEngine.play('countdown', { urgent: true });
      } else if (data.remainingSeconds <= 10 && data.remainingSeconds > 0) {
        audioEngine.play('countdown');
      }
      if (phase === 'LOCKED') setBetModalOpen(false);
      if (phase === 'OPEN') {
        // Reset chamber on new round (no-op when already clear)
        setLastResult(null);
      }
    };
    
    const onState = (data: any) => {
      const phase = normalisePhase(data.state);
      setGameState(phase);
      if (phase === 'LOCKED') setBetModalOpen(false);
    };
    
    const onHistory = (data: any[]) => {
      setHistory(data);
    };
    
    const onResult = (data: any) => {
      // The server sends resultNum/resultColor; older payloads used number/color.
      const number = Number(data.number ?? data.resultNum);
      const color = String(data.color ?? data.resultColor ?? "");
      setLastResult({ number, color, period: data.period });
      // No sound or confetti here: everyone sees the draw, only real wins are celebrated (bet:settled).

      setHistory(prev => [{
        period: data.period,
        resultNum: number,
        resultColor: color
      }, ...prev].slice(0, 10));
    };

    socket.on('colour:tick', onTick);
    socket.on('colour:state', onState);
    socket.on('colour:history', onHistory);
    socket.on('colour:result', onResult);

    return () => {
      socket.emit('colour:leave', { room: activeTab });
      socket.off('colour:tick', onTick);
      socket.off('colour:state', onState);
      socket.off('colour:history', onHistory);
      socket.off('colour:result', onResult);
    };
  }, [socket, activeTab]);

  const handleOpenBet = (type: 'color'|'number', val: string|number, colorStr: string) => {
    if (gameState === 'LOCKED' || gameState === 'RESULT') {
      toast.error("Betting is closed for this round.");
      return;
    }
    setSelectedBet({ type, val, color: colorStr });
    setBetModalOpen(true);
  };

  const handlePlaceBet = () => {
    if (balance < betAmount) {
      toast.error("Insufficient balance!");
      return;
    }
    if (!socket || !selectedBet) return;
    
    setPlacingBet(true);
    socket.emit('colour:bet', {
      room: activeTab,
      betType: selectedBet.type,
      betValue: selectedBet.val.toString(),
      amount: betAmount * 100 // paise
    }, (res: any) => {
      setPlacingBet(false);
      if (res.success) {
        if (navigator.vibrate) navigator.vibrate(50);
        if (typeof res.newBalance === 'number') setBalance(res.newBalance);
        setActiveBets(prev => [...prev, { type: selectedBet.type, val: selectedBet.val, amount: betAmount }]);
        setBetModalOpen(false);
        toast.success(`₹${betAmount} placed successfully!`);
      } else {
        // The round has moved on; keep the table visible instead of a stale bet sheet.
        if (res.code === 'BETTING_CLOSED') setBetModalOpen(false);
        toast.error(res.message || "Failed to place bet.");
      }
    });
  };

  return (
    <div className="min-h-[calc(100dvh-58px)] bg-gradient-to-b from-sky-50 via-white to-emerald-50 font-sans relative flex flex-col pb-safe">


      {/* Tabs */}
      <div className="flex bg-ocean-card/50 p-1 m-4 rounded-xl border border-slate-200">
        <button 
          onClick={() => setActiveTab('1min')} 
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === '1min' ? 'bg-neon-mint text-deep-ocean' : 'text-slate-500'}`}
        >
          1 Min Draw
        </button>
        <button 
          onClick={() => setActiveTab('3min')} 
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === '3min' ? 'bg-neon-mint text-deep-ocean' : 'text-slate-500'}`}
        >
          3 Min Draw
        </button>
      </div>

      {/* Timer Section */}
      <div className="mx-4 mb-4 glass-card p-4 rounded-2xl flex items-center justify-between">
         <div>
           <p className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Period</p>
           <h3 className="text-slate-900 font-black text-xl">{period}</h3>
         </div>
         <div className="text-right">
           <p className="text-slate-500 text-xs font-bold uppercase mb-1">Count Down</p>
           <div className="flex items-center gap-1">
             <span className={`text-3xl font-black tabular-nums ${gameState === 'LOCKED' ? 'text-red-500 animate-pulse' : 'text-neon-mint'}`}>
                {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
             </span>
           </div>
         </div>
      </div>

      {/* Result reel: spins while locked, lands on the server result */}
      <ColourResultReel spinning={gameState === 'LOCKED'} result={lastResult} />

      {/* Reusable Chip Flights */}
      <AnimatedChipFlight 
        flights={chipFlights} 
        onFlightComplete={(id) => setChipFlights(prev => prev.filter(f => f.id !== id))} 
      />

      {/* Betting Area */}
      <div className="mx-4 mb-6 relative">
        {(gameState === 'LOCKED' || gameState === 'RESULT') && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 rounded-xl flex items-center justify-center border border-red-500/50">
            <span className="text-red-500 font-black tracking-widest text-lg uppercase shadow-black drop-shadow-lg">
              {gameState === 'RESULT' ? 'Calculating...' : 'Locked'}
            </span>
          </div>
        )}
        
        {/* Colors */}
        <div className="flex gap-3 mb-6">
          {COLORS.map(c => (
            <button 
              key={c.id}
              onClick={() => handleOpenBet('color', c.id, c.bg)}
              className={`flex-1 py-4 rounded-xl ${c.bg} ${c.shadow} flex flex-col items-center justify-center transform active:scale-95 transition-transform text-slate-900 border-2 border-slate-200`}
            >
              <span className="font-black text-sm uppercase tracking-wide drop-shadow-md">{c.label}</span>
              <span className="text-[10px] font-bold mt-1 opacity-90">{c.multiplier}x</span>
            </button>
          ))}
        </div>

        {/* Numbers Grid */}
        <div className="bg-ocean-card/30 border border-slate-200 rounded-2xl p-4">
          <div className="grid grid-cols-5 gap-3">
            {NUMBERS.map(n => {
              let bg = 'bg-blue-500';
              if (n === 0 || n === 5) bg = 'bg-purple-500';
              else if (n % 2 === 0) bg = 'bg-red-500';
              else bg = 'bg-green-500';
              
              return (
                <button 
                  key={n}
                  onClick={() => handleOpenBet('number', n, bg)}
                  className={`aspect-square rounded-full ${bg} flex items-center justify-center text-slate-900 font-black text-xl border-2 border-slate-200 shadow-lg transform active:scale-90 transition-transform`}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p className="text-center text-slate-500 text-[10px] font-bold uppercase mt-4">Number Win: 9x Payout</p>
        </div>
      </div>

      {/* Roadmap / History */}
      <div className="flex-1 bg-ocean-card/80 rounded-t-3xl border-t border-slate-200 p-4 shadow-[0_-10px_30px_rgba(15,23,42,0.13)]">
         <h3 className="text-slate-900 font-bold mb-4 flex items-center gap-2"><History size={16} className="text-neon-mint"/> Trend History</h3>
         
         <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {history.map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-none">
                 <span className="text-[10px] text-slate-500 mb-1">{h.period.toString().slice(-3)}</span>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-slate-900 font-bold text-sm border-2 border-slate-200
                    ${h.resultColor === 'red' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 
                      h.resultColor === 'green' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 
                      'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]'}
                 `}>
                   {h.resultNum}
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* Betting Modal */}
      <AnimatePresence>
        {betModalOpen && selectedBet && (
          <>
            <div className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-sm" onClick={() => setBetModalOpen(false)} />
            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-ocean-card rounded-t-3xl border-t border-slate-200 p-6"
            >
               <h3 className={`text-xl font-black text-slate-900 mb-4 ${selectedBet.color.replace('bg-', 'text-')}`}>
                 Bet on {selectedBet.type === 'color' ? selectedBet.val.toString().toUpperCase() : `Number ${selectedBet.val}`}
               </h3>
               
               <div className="flex gap-2 mb-6">
                 {[10, 50, 100, 500, 1000].map(amt => (
                   <button 
                     key={amt}
                     onClick={() => setBetAmount(amt)}
                     className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${betAmount === amt ? 'bg-slate-200 border-white text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                   >
                     ₹{amt}
                   </button>
                 ))}
               </div>
               
               <div className="flex gap-3">
                 <button disabled={placingBet} onClick={() => setBetModalOpen(false)} className="flex-1 py-4 rounded-xl border border-slate-200 text-slate-900 font-bold">Cancel</button>
                 <button disabled={placingBet} onClick={handlePlaceBet} className={`flex-[2] py-4 rounded-xl font-black text-slate-900 ${selectedBet.color} shadow-lg disabled:opacity-50`}>
                   {placingBet ? 'Confirming...' : `Confirm ₹${betAmount}`}
                 </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <WinLossCelebration
        celebration={celebration}
        onComplete={() => setCelebration(null)}
      />
    </div>
  );
}
