"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { useBetSettlements } from '@/hooks/useBetSettlements';

import UniversalBetPanel from '@/components/games/UniversalBetPanel';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import DiceTray from '@/components/games/DiceTray';
import { audioEngine, haptic } from '@/lib/audioEngine';
import AnimatedChipFlight, { ChipFlightData } from '@/components/games/animation/AnimatedChipFlight';

export default function DiceGame() {
  const { balance, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Game State
  const [gameState, setGameState] = useState<any>({
    status: 'WAITING',
    lockTime: 0,
    resultTime: 0,
    now: Date.now()
  });
  
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [diceResult, setDiceResult] = useState<number[] | null>(null);
  // Lets the once-registered socket handlers know a result is showing without reconnecting.
  const hasResultRef = useRef(false);
  const lastSumRef = useRef<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Selected Market & Betting State
  const [selectedMarket, setSelectedMarket] = useState<string>('BIG');
  const [selectedOdds, setSelectedOdds] = useState<number>(2.0);
  const [myBets, setMyBets] = useState<Record<string, number>>({});

  // Win / Loss Celebration
  const [celebration, setCelebration] = useState<{
    status: 'IDLE' | 'WON' | 'LOST';
    amount: number;
    multiplier?: number;
    message?: string;
    net?: number;
  }>({ status: 'IDLE', amount: 0 });

  const [flyingChips, setFlyingChips] = useState<ChipFlightData[]>([]);

  const addChipFlight = (start: { x: number; y: number }, end: { x: number; y: number }, value: number = 100, type: 'BET' | 'WIN' = 'BET') => {
    const id = `chip-${Date.now()}-${Math.random()}`;
    setFlyingChips(prev => [...prev, {
      id,
      amount: value,
      type,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      color: '#eab308'
    }]);
  };

  // Win/loss banner from the server's settlement, never from client-side payout maths.
  useBetSettlements(socket, 'dice', ({ staked, paid, bestMultiplier }) => {
    const sumLabel = lastSumRef.current !== null ? `Dice Total: ${lastSumRef.current} • ` : '';
    if (paid > 0) {
      audioEngine.play('win');
      haptic.win();
      if (typeof window !== 'undefined') {
        addChipFlight(
          { x: window.innerWidth / 2, y: window.innerHeight * 0.3 },
          { x: window.innerWidth - 60, y: 30 },
          paid
        );
      }
      setCelebration({ status: 'WON', amount: paid, multiplier: bestMultiplier, net: paid - staked, message: `${sumLabel}Dice landed` });
    } else if (staked > 0) {
      audioEngine.play('loss');
      haptic.error();
      setCelebration({ status: 'LOST', amount: staked, message: `${sumLabel}Bet Lost` });
    }
    fetchBalance();
  });

  useEffect(() => {
    const s = createGameSocket();
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('dice:join', { room: '1min' });
      s.emit('dice:history', { room: '1min' }, (res: any) => {
        if (res.success) setHistory(res.data);
      });
    });

    s.on('dice:tick', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      if (data.status === 'OPEN' && hasResultRef.current) {
        hasResultRef.current = false;
        setDiceResult(null);
        setMyBets({}); // Clear bets for new round
      }
    });

    s.on('dice:locked', () => {
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      audioEngine.play('diceShake');
      haptic.deal();
      toast('Bets Locked! Rolling...', { icon: '🎲' });
    });

    s.on('dice:result', (data: any) => {
      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      hasResultRef.current = true;
      setDiceResult(data.diceResult);
      audioEngine.play('diceBounce');
      haptic.card();
      
      const sum = data.diceResult.reduce((a: number, b: number) => a + b, 0);
      
      // Update history
      setHistory(prev => [{ diceResult: data.diceResult, resultTime: new Date() }, ...prev].slice(0, 15));

      lastSumRef.current = sum;

      // We refetch balance after 2s to allow settlement
      setTimeout(() => fetchBalance(), 2000);
    });

    return () => { 
      s.emit('dice:leave', { room: '1min' });
      s.disconnect(); 
    };
  }, [fetchBalance]);

  // Sync timer strictly
  useEffect(() => {
    if (gameState.status !== 'OPEN') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const placeBet = (market: string, chipAmount: number = 100) => {
    if (gameState.status !== 'OPEN') {
      toast.error("Bets are currently locked!");
      return;
    }
    
    if (!socket) return;
    
    socket.emit('dice:bet', { room: '1min', market, amount: chipAmount }, (res: any) => {
      if (res.success) {
        audioEngine.play('chipDrop');
        haptic.bet();
        if (typeof window !== 'undefined') {
          addChipFlight(
            { x: window.innerWidth / 2, y: window.innerHeight - 80 },
            { x: window.innerWidth / 2, y: window.innerHeight * 0.45 },
            chipAmount
          );
        }
        setMyBets(prev => ({
          ...prev,
          [market]: (prev[market] || 0) + chipAmount
        }));
        toast.success(`Placed ₹${chipAmount} on ${market.replace('_', ' ')}`);
        fetchBalance(); // Immediate deduct
      } else {
        toast.error(res.message);
      }
    });
  };

  // Dice visual renderer
  const renderDice = (value: number, key: number) => {
    // A simple CSS dice approach
    const dots: any = {
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    };

    return (
      <motion.div 
        key={key}
        initial={{ rotateX: 0, rotateY: 0, scale: 0 }}
        animate={{ 
          rotateX: diceResult ? 720 : 0, 
          rotateY: diceResult ? 720 : 0, 
          scale: diceResult ? 1 : 0 
        }}
        transition={{ type: "spring", duration: 1.5, bounce: 0.5, delay: key * 0.1 }}
        className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-xl shadow-[0_4px_15px_rgba(15,23,42,0.13)] border-t border-slate-200 border-b-4 border-gray-300 relative flex items-center justify-center m-2"
      >
        {dots[value]?.map((pos: string) => {
          let posClass = "";
          if (pos === 'center') posClass = "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
          if (pos === 'top-left') posClass = "top-3 left-3";
          if (pos === 'top-right') posClass = "top-3 right-3";
          if (pos === 'bottom-left') posClass = "bottom-3 left-3";
          if (pos === 'bottom-right') posClass = "bottom-3 right-3";
          if (pos === 'middle-left') posClass = "top-1/2 left-3 -translate-y-1/2";
          if (pos === 'middle-right') posClass = "top-1/2 right-3 -translate-y-1/2";

          return (
            <div key={pos} className={`absolute w-3 h-3 sm:w-4 sm:h-4 bg-red-600 rounded-full shadow-inner ${posClass}`} />
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className="min-h-[calc(100dvh-58px)] w-full bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900 font-sans flex flex-col">


      {/* Game Stage Area */}
      <div className="w-full h-64 sm:h-72 bg-gradient-to-b from-sky-50 to-white relative flex flex-col items-center justify-center overflow-hidden border-b border-slate-200">
        
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent opacity-60" />
        
        {/* Timer / Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/80 border border-slate-200 px-6 py-2 rounded-full flex items-center gap-3 backdrop-blur-md z-10 shadow-lg">
           {gameState.status === 'OPEN' ? (
             <>
               <div className="w-2 h-2 rounded-full bg-neon-mint animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm">Betting Open</span>
               <span className={`font-mono font-black text-xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-neon-mint'}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </span>
             </>
           ) : (
             <>
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm text-red-500">{gameState.status === 'LOCKED' ? 'Rolling...' : gameState.status}</span>
             </>
           )}
        </div>

        {/* Dice tray: tumbles while locked, lands on the server's result */}
        <div className="relative z-20 mt-10 flex h-full w-full items-center justify-center px-4">
          <DiceTray values={diceResult} tumbling={gameState.status !== 'OPEN' && !diceResult} />
        </div>
      </div>

      {/* Betting Grid */}
      <div className="flex-1 p-4 sm:p-6">
         
         <div className="max-w-3xl mx-auto space-y-4">
            
            {/* Row 1: SMALL / ANY TRIPLE / BIG */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 h-24">
               <button 
                 onClick={() => { setSelectedMarket('SMALL'); setSelectedOdds(2.0); }}
                 className={`relative bg-gradient-to-br from-blue-900/50 to-blue-800/20 hover:from-blue-800/80 hover:to-blue-700/50 border rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all group cursor-pointer ${
                   selectedMarket === 'SMALL' ? 'border-neon-mint ring-2 ring-neon-mint/50 scale-102' : 'border-blue-500/30'
                 }`}
               >
                 <div className="text-lg font-black tracking-widest text-blue-600 group-hover:text-blue-700">SMALL</div>
                 <div className="text-xs text-blue-700 font-bold tracking-widest">4 TO 10</div>
                 <div className="text-[10px] text-slate-500 mt-1">1:1</div>
                 {myBets['SMALL'] && (
                   <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">₹{myBets['SMALL']}</div>
                 )}
               </button>

               <button 
                 onClick={() => { setSelectedMarket('TRIPLE_ANY'); setSelectedOdds(25.0); }}
                 className={`relative bg-gradient-to-br from-yellow-900/50 to-yellow-800/20 hover:from-yellow-800/80 hover:to-yellow-700/50 border rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all group cursor-pointer ${
                   selectedMarket === 'TRIPLE_ANY' ? 'border-neon-mint ring-2 ring-neon-mint/50 scale-102' : 'border-yellow-500/50'
                 }`}
               >
                 <div className="text-sm font-black tracking-widest text-yellow-500 group-hover:text-yellow-600 uppercase text-center leading-tight">ANY<br/>TRIPLE</div>
                 <div className="text-[10px] text-slate-500 mt-1">24:1</div>
                 {myBets['TRIPLE_ANY'] && (
                   <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">₹{myBets['TRIPLE_ANY']}</div>
                 )}
               </button>

               <button 
                 onClick={() => { setSelectedMarket('BIG'); setSelectedOdds(2.0); }}
                 className={`relative bg-gradient-to-br from-red-900/50 to-red-800/20 hover:from-red-800/80 hover:to-red-700/50 border rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all group cursor-pointer ${
                   selectedMarket === 'BIG' ? 'border-neon-mint ring-2 ring-neon-mint/50 scale-102' : 'border-red-500/30'
                 }`}
               >
                 <div className="text-lg font-black tracking-widest text-red-600 group-hover:text-red-700">BIG</div>
                 <div className="text-xs text-red-700 font-bold tracking-widest">11 TO 17</div>
                 <div className="text-[10px] text-slate-500 mt-1">1:1</div>
                 {myBets['BIG'] && (
                   <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">₹{myBets['BIG']}</div>
                 )}
               </button>
            </div>

            {/* Row 2: Specific Sums */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
              <div className="text-xs text-slate-500 font-bold tracking-widest uppercase mb-3 text-center">Specific Sums</div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                 {[4,5,6,7,8,9,10,11,12,13,14,15,16,17].map(sum => {
                    const odds: any = { 4:50, 17:50, 5:18, 16:18, 6:14, 15:14, 7:12, 14:12, 8:8, 13:8, 9:6, 12:6, 10:6, 11:6 };
                    const market = `SUM_${sum}`;
                    const isSelected = selectedMarket === market;
                    return (
                      <button 
                        key={sum}
                        onClick={() => { setSelectedMarket(market); setSelectedOdds(odds[sum] + 1); }}
                        className={`relative bg-slate-100 hover:bg-slate-100 border rounded-lg py-2 flex flex-col items-center justify-center group cursor-pointer transition-all ${
                          isSelected ? 'border-neon-mint ring-2 ring-neon-mint/50 bg-neon-mint/10' : 'border-slate-200'
                        }`}
                      >
                         <div className="font-black text-slate-900 text-lg">{sum}</div>
                         <div className="text-[9px] text-slate-500">{odds[sum]}:1</div>
                         {myBets[market] && (
                           <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1 rounded-full shadow-lg border border-slate-200 z-10">₹{myBets[market]}</div>
                         )}
                      </button>
                    )
                 })}
              </div>
            </div>

         </div>
      </div>

      {/* Universal Bet Panel Footer */}
      <div className="bg-white/90 border-t border-slate-200 p-3 sm:p-4 sm:sticky sm:bottom-0 z-40 backdrop-blur-md">
         <div className="max-w-3xl mx-auto">
            <UniversalBetPanel
              title="Dice Bet Engine"
              marketName={selectedMarket.replace('_', ' ')}
              odds={selectedOdds}
              minBet={10}
              maxBet={50000}
              isOpen={gameState.status === 'OPEN'}
              lockedMessage="Rolling Dice - Bets Locked"
              onPlaceBet={async (amount) => {
                return new Promise((resolve) => {
                  socket?.emit('dice:bet', { room: '1min', market: selectedMarket, amount }, (res: any) => {
                    if (res && res.success) {
                      audioEngine.play('chipDrop');
                      haptic.bet();
                      if (typeof window !== 'undefined') {
                        addChipFlight(
                          { x: window.innerWidth / 2, y: window.innerHeight - 80 },
                          { x: window.innerWidth / 2, y: window.innerHeight * 0.45 },
                          amount
                        );
                      }
                      setMyBets(prev => ({
                        ...prev,
                        [selectedMarket]: (prev[selectedMarket] || 0) + amount
                      }));
                      fetchBalance();
                      resolve({ success: true, betId: res.data?.betId });
                    } else {
                      resolve({ success: false, message: res?.message || 'Failed to place bet' });
                    }
                  });
                });
              }}
            />
          </div>
       </div>

      {/* Win & Loss Animation Overlay */}
      <WinLossCelebration
        status={celebration.status}
        net={celebration.net}
        amount={celebration.amount}
        multiplier={celebration.multiplier}
        message={celebration.message}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })}
      />

      {/* Flying Chips Layer */}
      <AnimatedChipFlight
        flights={flyingChips}
        onFlightComplete={(id: string) => setFlyingChips((prev) => prev.filter((c) => c.id !== id))}
      />

    </div>
  );
}
