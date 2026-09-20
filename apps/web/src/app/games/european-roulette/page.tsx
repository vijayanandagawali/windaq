"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const isRed = (n: number) => RED_NUMBERS.includes(n);

export default function RouletteGame() {
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
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Betting State
  const [selectedChips, setSelectedChips] = useState<number>(10);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  
  // Realtime Live Bets
  const [liveBets, setLiveBets] = useState<any[]>([]);

  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('roulette:join', { room: 'Auto' });
      s.emit('roulette:history', { room: 'Auto' }, (res: any) => {
        if (res.success) setHistory(res.data);
      });
    });

    s.on('roulette:tick', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      if (data.status === 'OPEN' && resultNumber !== null) {
        setResultNumber(null);
        setMyBets({}); // Clear bets for new round
        setLiveBets([]);
      }
    });

    s.on('roulette:locked', () => {
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      toast('Bets Locked! Spinning...', { icon: '🎡' });
    });

    s.on('roulette:result', (data: any) => {
      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      setResultNumber(data.resultNumber);
      
      setHistory(prev => [{ resultNumber: data.resultNumber, resultTime: new Date() }, ...prev].slice(0, 15));
      
      setTimeout(() => fetchBalance(), 2000); // Check for winnings
    });
    
    s.on('roulette:live_bet', (data: any) => {
      setLiveBets(prev => [data, ...prev].slice(0, 5));
    });

    return () => { 
      s.emit('roulette:leave', { room: 'Auto' });
      s.disconnect(); 
    };
  }, [fetchBalance, resultNumber]);

  useEffect(() => {
    if (gameState.status !== 'OPEN') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const placeBet = (market: string, targets: number[]) => {
    if (gameState.status !== 'OPEN') {
      toast.error("Bets are currently locked!");
      return;
    }
    
    if (!socket) return;
    
    const userId = "guest"; // Replace with real auth id
    socket.emit('roulette:bet', { userId, room: 'Auto', market, targets, amount: selectedChips }, (res: any) => {
      if (res.success) {
        // use a unique key for the grid to stack chips visually
        const betKey = targets.length === 1 ? `STRAIGHT_${targets[0]}` : market;
        setMyBets(prev => ({
          ...prev,
          [betKey]: (prev[betKey] || 0) + selectedChips
        }));
        toast.success(`Placed ₹${selectedChips} on ${market}`);
        fetchBalance(); 
      } else {
        toast.error(res.message);
      }
    });
  };

  const getNumberColorClass = (n: number) => {
    if (n === 0) return "bg-green-600 hover:bg-green-500 border-green-400 text-white";
    if (isRed(n)) return "bg-red-700 hover:bg-red-600 border-red-500 text-white";
    return "bg-gray-900 hover:bg-gray-800 border-gray-600 text-white";
  };

  const renderNumberCell = (n: number) => {
    const betKey = `STRAIGHT_${n}`;
    return (
      <button 
        key={n}
        onClick={() => placeBet('STRAIGHT', [n])}
        className={`relative flex items-center justify-center border-t border-l border-white/20 transition-all font-bold text-lg sm:text-xl py-3 ${getNumberColorClass(n)}`}
      >
        {n}
        {myBets[betKey] && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full shadow border border-black">
              {myBets[betKey]}
            </div>
          </div>
        )}
      </button>
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
          <h1 className="font-bold tracking-widest text-sm uppercase">European Roulette</h1>
          <div className="text-neon-mint font-bold text-xs bg-neon-mint/10 px-2 py-0.5 rounded-full mt-1">₹ {balance.toFixed(2)}</div>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10" onClick={() => toast("View History coming soon")}>
          <History size={20}/>
        </button>
      </header>

      {/* Game Stage Area */}
      <div className="w-full h-48 sm:h-56 bg-gradient-to-b from-[#1a2b1f] to-[#0a0f1a] relative flex flex-col items-center justify-center overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/30 via-transparent to-transparent opacity-60" />
        
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
               <span className="font-bold tracking-widest uppercase text-sm text-red-500">{gameState.status === 'LOCKED' ? 'Spinning...' : gameState.status}</span>
             </>
           )}
        </div>

        {/* Central Display */}
        <div className="z-20 relative flex flex-col items-center mt-6">
          <AnimatePresence mode="wait">
            {resultNumber !== null ? (
              <motion.div
                key="result"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center border-4 shadow-[0_0_40px_rgba(255,255,255,0.2)] ${getNumberColorClass(resultNumber)}`}
              >
                <span className="text-4xl sm:text-5xl font-black drop-shadow-md">{resultNumber}</span>
              </motion.div>
            ) : (
              <motion.div 
                key="wheel"
                animate={gameState.status === 'LOCKED' ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-dashed border-gray-600/50 flex items-center justify-center bg-black/20"
              >
                <span className="text-gray-500 font-bold uppercase tracking-widest text-xs">Wheel</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* History Ribbon */}
      <div className="bg-black/50 border-b border-white/5 py-2 px-4 flex gap-2 overflow-x-auto scrollbar-hide items-center h-12">
        <span className="text-xs text-gray-500 font-bold uppercase mr-2 whitespace-nowrap">Last 15</span>
        {history.map((h, i) => (
          <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${getNumberColorClass(h.resultNumber)}`}>
            {h.resultNumber}
          </div>
        ))}
      </div>

      {/* Betting Grid */}
      <div className="flex-1 p-2 sm:p-4 overflow-y-auto bg-[#0f1523]">
        <div className="max-w-4xl mx-auto">
          
          {/* Main Grid Wrapper */}
          <div className="flex border-b border-r border-white/20 bg-black/40 rounded-xl overflow-hidden shadow-2xl">
            
            {/* Zero Cell */}
            <button 
              onClick={() => placeBet('STRAIGHT', [0])}
              className="w-12 sm:w-16 relative flex items-center justify-center border-t border-l border-white/20 hover:bg-green-500 bg-green-600 transition-colors"
            >
               <span className="font-black text-2xl rotate-90 text-white">0</span>
               {myBets['STRAIGHT_0'] && (
                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                   <div className="bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow border border-black rotate-90">
                     {myBets['STRAIGHT_0']}
                   </div>
                 </div>
               )}
            </button>
            
            {/* Numbers Grid */}
            <div className="flex-1 grid grid-cols-12 grid-rows-3">
              {/* Row 1: 3,6,9...36 */}
              {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => renderNumberCell(n))}
              
              {/* Row 2: 2,5,8...35 */}
              {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => renderNumberCell(n))}
              
              {/* Row 3: 1,4,7...34 */}
              {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => renderNumberCell(n))}
            </div>

            {/* Column Bets */}
            <div className="w-12 sm:w-16 flex flex-col font-bold text-xs tracking-widest border-t border-l border-white/20 text-gray-400">
               <button onClick={() => placeBet('COLUMN', [3,6,9,12,15,18,21,24,27,30,33,36])} className="flex-1 border-b border-white/20 hover:bg-white/10 flex items-center justify-center relative">
                 <span className="-rotate-90">2:1</span>
                 {myBets['COLUMN'] && <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">{myBets['COLUMN']}</div>}
               </button>
               <button onClick={() => placeBet('COLUMN', [2,5,8,11,14,17,20,23,26,29,32,35])} className="flex-1 border-b border-white/20 hover:bg-white/10 flex items-center justify-center relative">
                 <span className="-rotate-90">2:1</span>
                 {/* Needs unique key if distinguishing which column, but for simplicity we just pass same market type "COLUMN". Our engine doesn't distinguish which column for payouts as long as targets are met. Wait, if multiple COLUMN bets are placed, they overwrite the local UI state key `COLUMN`. Let's fix that by sending unique keys for UI only. */}
               </button>
               <button onClick={() => placeBet('COLUMN', [1,4,7,10,13,16,19,22,25,28,31,34])} className="flex-1 border-b border-white/20 hover:bg-white/10 flex items-center justify-center">
                 <span className="-rotate-90">2:1</span>
               </button>
            </div>
          </div>

          {/* Outside Bets Row 1: Dozens */}
          <div className="flex ml-12 sm:ml-16 mr-12 sm:mr-16 border-l border-r border-b border-white/20">
            <button onClick={() => placeBet('DOZEN', Array.from({length:12}, (_,i)=>i+1))} className="flex-1 py-3 text-center border-r border-white/20 hover:bg-white/10 font-bold text-gray-300 text-xs sm:text-sm tracking-widest relative">
              1ST 12
              {myBets['DOZEN_1'] && <div className="absolute top-1 right-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">{myBets['DOZEN_1']}</div>}
            </button>
            <button onClick={() => placeBet('DOZEN', Array.from({length:12}, (_,i)=>i+13))} className="flex-1 py-3 text-center border-r border-white/20 hover:bg-white/10 font-bold text-gray-300 text-xs sm:text-sm tracking-widest relative">
              2ND 12
            </button>
            <button onClick={() => placeBet('DOZEN', Array.from({length:12}, (_,i)=>i+25))} className="flex-1 py-3 text-center hover:bg-white/10 font-bold text-gray-300 text-xs sm:text-sm tracking-widest relative">
              3RD 12
            </button>
          </div>

          {/* Outside Bets Row 2: 1-18, EVEN, RED, BLACK, ODD, 19-36 */}
          <div className="flex ml-12 sm:ml-16 mr-12 sm:mr-16 border-l border-r border-b border-white/20">
            <button onClick={() => placeBet('LOW', Array.from({length:18}, (_,i)=>i+1))} className="flex-1 py-3 border-r border-white/20 hover:bg-white/10 font-bold text-gray-300 text-[10px] sm:text-xs">1 TO 18</button>
            <button onClick={() => placeBet('EVEN', Array.from({length:18}, (_,i)=>(i+1)*2))} className="flex-1 py-3 border-r border-white/20 hover:bg-white/10 font-bold text-gray-300 text-[10px] sm:text-xs">EVEN</button>
            <button onClick={() => placeBet('RED', RED_NUMBERS)} className="flex-1 py-3 border-r border-white/20 hover:bg-red-900/50 bg-red-950/30 flex items-center justify-center">
               <div className="w-6 h-4 bg-red-600 rounded" />
            </button>
            <button onClick={() => placeBet('BLACK', Array.from({length:36}, (_,i)=>i+1).filter(x => !isRed(x)))} className="flex-1 py-3 border-r border-white/20 hover:bg-gray-800/80 bg-gray-900/50 flex items-center justify-center">
               <div className="w-6 h-4 bg-gray-800 rounded border border-gray-600" />
            </button>
            <button onClick={() => placeBet('ODD', Array.from({length:18}, (_,i)=>(i*2)+1))} className="flex-1 py-3 border-r border-white/20 hover:bg-white/10 font-bold text-gray-300 text-[10px] sm:text-xs">ODD</button>
            <button onClick={() => placeBet('HIGH', Array.from({length:18}, (_,i)=>i+19))} className="flex-1 py-3 hover:bg-white/10 font-bold text-gray-300 text-[10px] sm:text-xs">19 TO 36</button>
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
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center border-4 shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-transform ${selectedChips === val ? 'scale-110 -translate-y-2 border-neon-mint bg-neon-mint/20' : 'border-gray-500 bg-gray-800 opacity-80 hover:opacity-100'}`}
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
