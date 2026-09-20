"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

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
  const [history, setHistory] = useState<any[]>([]);

  // Betting State
  const [selectedChips, setSelectedChips] = useState<number>(10);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];
  const [myBets, setMyBets] = useState<Record<string, number>>({});

  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
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
      
      if (data.status === 'OPEN' && diceResult) {
        setDiceResult(null);
        setMyBets({}); // Clear bets for new round
      }
    });

    s.on('dice:locked', () => {
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      toast('Bets Locked!', { icon: '🔒' });
    });

    s.on('dice:result', (data: any) => {
      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      setDiceResult(data.diceResult);
      
      const sum = data.diceResult.reduce((a: number, b: number) => a + b, 0);
      const isTriple = data.diceResult[0] === data.diceResult[1] && data.diceResult[1] === data.diceResult[2];
      
      // Update history
      setHistory(prev => [{ diceResult: data.diceResult, resultTime: new Date() }, ...prev].slice(0, 15));
      
      // We refetch balance after 2s to allow settlement
      setTimeout(() => fetchBalance(), 2000);
    });

    return () => { 
      s.emit('dice:leave', { room: '1min' });
      s.disconnect(); 
    };
  }, [fetchBalance, diceResult]);

  // Sync timer strictly
  useEffect(() => {
    if (gameState.status !== 'OPEN') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const placeBet = (market: string) => {
    if (gameState.status !== 'OPEN') {
      toast.error("Bets are currently locked!");
      return;
    }
    
    if (!socket) return;
    
    const userId = "guest"; // Replace with real auth id
    socket.emit('dice:bet', { userId, room: '1min', market, amount: selectedChips }, (res: any) => {
      if (res.success) {
        setMyBets(prev => ({
          ...prev,
          [market]: (prev[market] || 0) + selectedChips
        }));
        toast.success(`Placed ₹${selectedChips} on ${market.replace('_', ' ')}`);
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
        className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] border-t border-white/50 border-b-4 border-gray-300 relative flex items-center justify-center m-2"
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
    <main className="min-h-screen w-full bg-[#0a0f1a] text-white font-sans selection:bg-neon-mint flex flex-col">
      
      {/* Navbar */}
      <header className="bg-black/40 border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="font-bold tracking-widest text-sm uppercase">Sic Bo</h1>
          <div className="text-neon-mint font-bold text-xs bg-neon-mint/10 px-2 py-0.5 rounded-full mt-1">₹ {balance.toFixed(2)}</div>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10" onClick={() => toast("View History coming soon")}>
          <History size={20}/>
        </button>
      </header>

      {/* Game Stage Area */}
      <div className="w-full h-48 sm:h-64 bg-gradient-to-b from-[#1a1235] to-[#0a0f1a] relative flex flex-col items-center justify-center overflow-hidden border-b border-white/10">
        
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-transparent to-transparent opacity-60" />
        
        {/* Timer / Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 border border-white/10 px-6 py-2 rounded-full flex items-center gap-3 backdrop-blur-md z-10 shadow-lg">
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

        {/* Dice Container */}
        <div className="flex items-center justify-center h-full w-full relative z-20">
          <AnimatePresence>
            {diceResult ? (
              <div className="flex gap-2 sm:gap-6 mt-8">
                {diceResult.map((val, i) => renderDice(val, i))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="flex gap-2 sm:gap-6 mt-8 opacity-50 grayscale blur-[2px]"
              >
                 {renderDice(1, 0)}
                 {renderDice(2, 1)}
                 {renderDice(3, 2)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Result Overlay */}
        <AnimatePresence>
          {diceResult && gameState.status === 'RESULT' && (
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0 }}
               className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black px-6 py-2 rounded-full font-black text-xl tracking-widest shadow-[0_0_30px_rgba(234,179,8,0.4)] border border-yellow-300 z-30 flex gap-2"
             >
                {diceResult.reduce((a,b)=>a+b, 0)} 
                <span className="font-normal opacity-80">|</span> 
                {diceResult.reduce((a,b)=>a+b, 0) >= 11 ? 'BIG' : 'SMALL'}
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Betting Grid */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
         
         <div className="max-w-3xl mx-auto space-y-4">
            
            {/* Row 1: SMALL / ANY TRIPLE / BIG */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 h-24">
               <button 
                 onClick={() => placeBet('SMALL')}
                 className="relative bg-gradient-to-br from-blue-900/50 to-blue-800/20 hover:from-blue-800/80 hover:to-blue-700/50 border border-blue-500/30 rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all group"
               >
                 <div className="text-lg font-black tracking-widest text-blue-400 group-hover:text-blue-300">SMALL</div>
                 <div className="text-xs text-blue-200/50 font-bold tracking-widest">4 TO 10</div>
                 <div className="text-[10px] text-gray-400 mt-1">1:1</div>
                 {myBets['SMALL'] && (
                   <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">₹{myBets['SMALL']}</div>
                 )}
               </button>

               <button 
                 onClick={() => placeBet('TRIPLE_ANY')}
                 className="relative bg-gradient-to-br from-yellow-900/50 to-yellow-800/20 hover:from-yellow-800/80 hover:to-yellow-700/50 border border-yellow-500/50 rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all group"
               >
                 <div className="text-sm font-black tracking-widest text-yellow-500 group-hover:text-yellow-400 uppercase text-center leading-tight">ANY<br/>TRIPLE</div>
                 <div className="text-[10px] text-gray-400 mt-1">24:1</div>
                 {myBets['TRIPLE_ANY'] && (
                   <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">₹{myBets['TRIPLE_ANY']}</div>
                 )}
               </button>

               <button 
                 onClick={() => placeBet('BIG')}
                 className="relative bg-gradient-to-br from-red-900/50 to-red-800/20 hover:from-red-800/80 hover:to-red-700/50 border border-red-500/30 rounded-xl flex flex-col items-center justify-center overflow-hidden transition-all group"
               >
                 <div className="text-lg font-black tracking-widest text-red-400 group-hover:text-red-300">BIG</div>
                 <div className="text-xs text-red-200/50 font-bold tracking-widest">11 TO 17</div>
                 <div className="text-[10px] text-gray-400 mt-1">1:1</div>
                 {myBets['BIG'] && (
                   <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg">₹{myBets['BIG']}</div>
                 )}
               </button>
            </div>

            {/* Row 2: Specific Sums */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
              <div className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-3 text-center">Specific Sums</div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                 {[4,5,6,7,8,9,10,11,12,13,14,15,16,17].map(sum => {
                    const odds: any = { 4:50, 17:50, 5:18, 16:18, 6:14, 15:14, 7:12, 14:12, 8:8, 13:8, 9:6, 12:6, 10:6, 11:6 };
                    const market = `SUM_${sum}`;
                    return (
                      <button 
                        key={sum}
                        onClick={() => placeBet(market)}
                        className="relative bg-black/40 hover:bg-white/10 border border-white/5 rounded-lg py-2 flex flex-col items-center justify-center group"
                      >
                         <div className="font-black text-white text-lg">{sum}</div>
                         <div className="text-[9px] text-gray-500">{odds[sum]}:1</div>
                         {myBets[market] && (
                           <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[9px] font-bold px-1 rounded-full shadow-lg border border-black z-10">₹{myBets[market]}</div>
                         )}
                      </button>
                    )
                 })}
              </div>
            </div>

         </div>
      </div>

      {/* Chip Selector Footer */}
      <div className="bg-black/60 border-t border-white/10 p-4 sticky bottom-0 z-40 backdrop-blur-md">
         <div className="max-w-3xl mx-auto flex gap-2 justify-center overflow-x-auto pb-2 scrollbar-hide">
            {CHIP_VALUES.map(val => (
              <button 
                key={val}
                onClick={() => setSelectedChips(val)}
                className={`relative w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center border-4 shadow-lg transition-transform ${selectedChips === val ? 'scale-110 -translate-y-2 border-neon-mint bg-neon-mint/20' : 'border-gray-500 bg-gray-800 opacity-80 hover:opacity-100'}`}
              >
                 <div className="absolute inset-1 border border-white/20 rounded-full border-dashed" />
                 <span className={`font-black text-sm ${selectedChips === val ? 'text-neon-mint drop-shadow-[0_0_5px_#10b981]' : 'text-gray-300'}`}>{val >= 1000 ? `${val/1000}k` : val}</span>
              </button>
            ))}
         </div>
      </div>

    </main>
  );
}
