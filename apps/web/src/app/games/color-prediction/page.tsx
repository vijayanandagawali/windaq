"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Clock, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { io, Socket } from '@/lib/gameSocket';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import { audioEngine } from '@/lib/audioEngine';
import AnimatedChipFlight from '@/components/games/animation/AnimatedChipFlight';

const COLORS = [
  { id: 'green', label: 'Join Green', multiplier: 2, bg: 'bg-green-500', shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.5)]' },
  { id: 'violet', label: 'Join Violet', multiplier: 4.5, bg: 'bg-purple-500', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.5)]' },
  { id: 'red', label: 'Join Red', multiplier: 2, bg: 'bg-red-500', shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]' },
];

const NUMBERS = Array.from({length: 10}, (_, i) => i);

export default function ColorPrediction() {
  const { balance, deductBalance, addWinnings } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [activeTab, setActiveTab] = useState<'1min' | '3min'>('1min');
  const [countdown, setCountdown] = useState(0);
  const [period, setPeriod] = useState("Loading...");
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
  const [celebration, setCelebration] = useState<{ type: 'win' | 'loss'; amount: number; multiplier?: string } | null>(null);

  // Initialize Socket
  useEffect(() => {
    const s = io('http://localhost:4000', {
      auth: { token: null } // Guest auth for now
    });
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Room management
  useEffect(() => {
    if (!socket) return;
    
    // Clear previous state when switching rooms
    setHistory([]);
    setCountdown(0);
    setGameState("UPCOMING");
    
    socket.emit('colour:join', { room: activeTab });
    
    const onTick = (data: any) => {
      setPeriod(data.period);
      setGameState(data.state);
      setCountdown(data.remainingSeconds);
      if (data.remainingSeconds <= 3 && data.remainingSeconds > 0) {
        audioEngine.play('countdown', { urgent: true });
      } else if (data.remainingSeconds <= 10 && data.remainingSeconds > 0) {
        audioEngine.play('countdown');
      }
      if (data.state === 'LOCKED') setBetModalOpen(false);
      if (data.state === 'OPEN' && lastResult) {
        // Reset chamber on new round
        setLastResult(null);
      }
    };
    
    const onState = (data: any) => {
      setGameState(data.state);
      if (data.state === 'LOCKED') setBetModalOpen(false);
    };
    
    const onHistory = (data: any[]) => {
      setHistory(data);
    };
    
    const onResult = (data: any) => {
      setLastResult(data);
      audioEngine.play('win');

      // Evaluate active user bets for win/loss celebration
      if (activeBets.length > 0) {
        let totalWin = 0;
        let totalStake = 0;
        activeBets.forEach(b => {
          totalStake += b.amount;
          if (b.type === 'color') {
            if (b.val === data.color) {
              totalWin += b.amount * (b.val === 'violet' ? 4.5 : 2);
            }
          } else if (b.type === 'number') {
            if (Number(b.val) === Number(data.number)) {
              totalWin += b.amount * 9;
            }
          }
        });

        if (totalWin > 0) {
          addWinnings(totalWin);
          setCelebration({
            type: 'win',
            amount: totalWin,
            multiplier: `${(totalWin / totalStake).toFixed(1)}x`
          });

          // Fly winning chips to user
          setChipFlights(prev => [
            ...prev,
            {
              id: `cp-win-${Date.now()}`,
              amount: totalWin,
              type: 'WIN',
              startX: typeof window !== 'undefined' ? window.innerWidth / 2 : 200,
              startY: 260,
              endX: 60,
              endY: typeof window !== 'undefined' ? window.innerHeight - 50 : 600,
              color: 'from-amber-400 to-yellow-600',
              borderColor: 'border-yellow-200'
            }
          ]);
        } else {
          setCelebration({
            type: 'loss',
            amount: totalStake
          });
        }
        setActiveBets([]);
      }

      // Trigger confetti on win color
      if (data.color === 'green' || data.color === 'violet' || data.color === 'red') {
        confetti({
          particleCount: 50,
          spread: 60,
          colors: [data.color === 'red' ? '#ef4444' : data.color === 'green' ? '#22c55e' : '#a855f7'],
          origin: { y: 0.8 }
        });
      }
      
      setHistory(prev => [{
        period: data.period,
        resultNum: data.number,
        resultColor: data.color
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
      userId: 'guest',
      room: activeTab,
      betType: selectedBet.type,
      betValue: selectedBet.val.toString(),
      amount: betAmount * 100 // paise
    }, (res: any) => {
      setPlacingBet(false);
      if (res.success) {
        if (navigator.vibrate) navigator.vibrate(50);
        deductBalance(betAmount);
        setActiveBets(prev => [...prev, { type: selectedBet.type, val: selectedBet.val, amount: betAmount }]);
        setBetModalOpen(false);
        toast.success(`₹${betAmount} placed successfully!`);
      } else {
        toast.error(res.message || "Failed to place bet.");
      }
    });
  };

  return (
    <div className="h-[calc(100dvh-58px)] bg-deep-ocean font-sans selection:bg-neon-mint relative flex flex-col pb-safe overflow-y-auto">


      {/* Tabs */}
      <div className="flex bg-ocean-card/50 p-1 m-4 rounded-xl border border-white/10">
        <button 
          onClick={() => setActiveTab('1min')} 
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === '1min' ? 'bg-neon-mint text-deep-ocean' : 'text-gray-400'}`}
        >
          1 Min Draw
        </button>
        <button 
          onClick={() => setActiveTab('3min')} 
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === '3min' ? 'bg-neon-mint text-deep-ocean' : 'text-gray-400'}`}
        >
          3 Min Draw
        </button>
      </div>

      {/* Timer Section */}
      <div className="mx-4 mb-4 glass-card p-4 rounded-2xl flex items-center justify-between">
         <div>
           <p className="text-gray-400 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Period</p>
           <h3 className="text-white font-black text-xl">{period}</h3>
         </div>
         <div className="text-right">
           <p className="text-gray-400 text-xs font-bold uppercase mb-1">Count Down</p>
           <div className="flex items-center gap-1">
             <span className={`text-3xl font-black tabular-nums ${gameState === 'LOCKED' ? 'text-red-500 animate-pulse' : 'text-neon-mint'}`}>
                {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
             </span>
           </div>
         </div>
      </div>

      {/* 3D Mystery Result Chamber / Oracle Orb */}
      <div className="mx-4 mb-6 relative flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-b from-ocean-card/90 to-black/80 border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Ambient glow behind orb */}
        <div className={`absolute w-44 h-44 rounded-full blur-3xl opacity-40 transition-colors duration-500 pointer-events-none ${
          lastResult?.color === 'red' ? 'bg-red-500' :
          lastResult?.color === 'green' ? 'bg-emerald-500' :
          lastResult?.color === 'violet' ? 'bg-purple-500' : 'bg-cyan-500'
        }`} />

        <div className="relative flex flex-col items-center">
          {/* Chamber Header Tag */}
          <div className="mb-3 px-3 py-0.5 rounded-full bg-black/60 border border-white/15 text-[11px] font-mono tracking-widest uppercase text-white/70 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              gameState === 'LOCKED' ? 'bg-red-500 animate-ping' :
              gameState === 'RESULT' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`} />
            {gameState === 'LOCKED' ? 'CHAMBER LOCKED • ANTICIPATION' :
             gameState === 'RESULT' ? 'OUTCOME REVEALED' : 'MYSTERY RESULT CHAMBER'}
          </div>

          {/* Glowing Multi-Ring Orb */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center">
            {/* Outer Orbiting Ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: gameState === 'LOCKED' ? 2 : 8, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/50"
            />
            {/* Inner Counter-Orbiting Ring */}
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: gameState === 'LOCKED' ? 3 : 12, ease: "linear" }}
              className="absolute inset-2 rounded-full border-2 border-dashed border-amber-400/40"
            />

            {/* Central Crystal Sphere */}
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-700 shadow-[0_0_30px_rgba(0,0,0,0.8)_inset] ${
              lastResult?.color === 'red' ? 'bg-gradient-to-br from-red-500 to-red-950 border-2 border-red-400 shadow-[0_0_35px_rgba(239,68,68,0.8)]' :
              lastResult?.color === 'green' ? 'bg-gradient-to-br from-emerald-500 to-emerald-950 border-2 border-emerald-400 shadow-[0_0_35px_rgba(34,197,94,0.8)]' :
              lastResult?.color === 'violet' ? 'bg-gradient-to-br from-purple-500 to-purple-950 border-2 border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.8)]' :
              'bg-gradient-to-br from-cyan-600/40 via-blue-950 to-black border-2 border-cyan-400/40'
            }`}>
              {lastResult ? (
                <motion.div
                  initial={{ scale: 0, rotate: 180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="flex flex-col items-center justify-center"
                >
                  <span className="text-3xl sm:text-4xl font-black text-white drop-shadow-md">
                    {lastResult.number}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/90">
                    {lastResult.color}
                  </span>
                </motion.div>
              ) : gameState === 'LOCKED' ? (
                <motion.div 
                  animate={{ scale: [0.9, 1.15, 0.9] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="text-amber-400 font-black text-xl tracking-tighter"
                >
                  ???
                </motion.div>
              ) : (
                <span className="text-white/40 font-mono font-bold text-lg">?</span>
              )}
            </div>
          </div>

          {/* Reveal Callout Banner */}
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 px-4 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-wider text-amber-300"
            >
              Winner: {lastResult.color} • Number {lastResult.number}
            </motion.div>
          )}
        </div>
      </div>

      {/* Reusable Chip Flights */}
      <AnimatedChipFlight 
        flights={chipFlights} 
        onFlightComplete={(id) => setChipFlights(prev => prev.filter(f => f.id !== id))} 
      />

      {/* Betting Area */}
      <div className="mx-4 mb-6 relative">
        {(gameState === 'LOCKED' || gameState === 'RESULT') && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 rounded-xl flex items-center justify-center border border-red-500/50">
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
              className={`flex-1 py-4 rounded-xl ${c.bg} ${c.shadow} flex flex-col items-center justify-center transform active:scale-95 transition-transform text-white border-2 border-white/20`}
            >
              <span className="font-black text-sm uppercase tracking-wide drop-shadow-md">{c.label}</span>
              <span className="text-[10px] font-bold mt-1 opacity-90">{c.multiplier}x</span>
            </button>
          ))}
        </div>

        {/* Numbers Grid */}
        <div className="bg-ocean-card/30 border border-white/5 rounded-2xl p-4">
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
                  className={`aspect-square rounded-full ${bg} flex items-center justify-center text-white font-black text-xl border-2 border-white/20 shadow-lg transform active:scale-90 transition-transform`}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p className="text-center text-gray-500 text-[10px] font-bold uppercase mt-4">Number Win: 9x Payout</p>
        </div>
      </div>

      {/* Roadmap / History */}
      <div className="flex-1 bg-ocean-card/80 rounded-t-3xl border-t border-white/10 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
         <h3 className="text-white font-bold mb-4 flex items-center gap-2"><History size={16} className="text-neon-mint"/> Trend History</h3>
         
         <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {history.map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-none">
                 <span className="text-[10px] text-gray-500 mb-1">{h.period.toString().slice(-3)}</span>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/20
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
            <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setBetModalOpen(false)} />
            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-ocean-card rounded-t-3xl border-t border-white/10 p-6"
            >
               <h3 className={`text-xl font-black text-white mb-4 ${selectedBet.color.replace('bg-', 'text-')}`}>
                 Bet on {selectedBet.type === 'color' ? selectedBet.val.toString().toUpperCase() : `Number ${selectedBet.val}`}
               </h3>
               
               <div className="flex gap-2 mb-6">
                 {[10, 50, 100, 500, 1000].map(amt => (
                   <button 
                     key={amt}
                     onClick={() => setBetAmount(amt)}
                     className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${betAmount === amt ? 'bg-white/20 border-white text-white' : 'bg-black/30 border-white/5 text-gray-400'}`}
                   >
                     ₹{amt}
                   </button>
                 ))}
               </div>
               
               <div className="flex gap-3">
                 <button disabled={placingBet} onClick={() => setBetModalOpen(false)} className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold">Cancel</button>
                 <button disabled={placingBet} onClick={handlePlaceBet} className={`flex-[2] py-4 rounded-xl font-black text-white ${selectedBet.color} shadow-lg disabled:opacity-50`}>
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
