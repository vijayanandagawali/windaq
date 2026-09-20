"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Coins, Volume2, VolumeX } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const SYMBOL_MAP: Record<string, { icon: string, color: string }> = {
  WILD: { icon: '💎', color: 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' },
  SCATTER: { icon: '⭐', color: 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' },
  H1: { icon: '🧜‍♂️', color: 'text-blue-500' },
  H2: { icon: '🔱', color: 'text-yellow-600' },
  H3: { icon: '💰', color: 'text-orange-500' },
  L1: { icon: 'A', color: 'text-red-500 font-serif' },
  L2: { icon: 'K', color: 'text-orange-500 font-serif' },
  L3: { icon: 'Q', color: 'text-yellow-500 font-serif' },
  L4: { icon: 'J', color: 'text-green-500 font-serif' }
};

export default function SlotsGame() {
  const { balance, deductBalance, setBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [stake, setStake] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][]>([
    ['H1', 'L2', 'L3'],
    ['WILD', 'H1', 'L1'],
    ['SCATTER', 'H2', 'H3'],
    ['L1', 'L4', 'L2'],
    ['H3', 'WILD', 'L1']
  ]);
  const [winAmount, setWinAmount] = useState<number>(0);
  const [winningLines, setWinningLines] = useState<any[]>([]);
  
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Init Socket
  useEffect(() => {
    const s = io('http://localhost:4000', {
      auth: { token: null } // Guest auth
    });
    setSocket(s);

    s.emit('slot:join');

    return () => {
      s.emit('slot:leave');
      s.disconnect();
    };
  }, []);

  const playSound = (type: 'spin' | 'win' | 'click') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    // In a real app, use Audio API here.
    if (type === 'click' && navigator.vibrate) navigator.vibrate(20);
  };

  const handleSpin = () => {
    if (balance < stake) {
      toast.error("Insufficient balance!");
      return;
    }
    if (!socket || spinning) return;

    playSound('click');
    setSpinning(true);
    setWinAmount(0);
    setWinningLines([]);
    
    // Optimistic deduct for visual speed
    deductBalance(stake);

    // Fake spin animation visually by scrambling grid periodically
    let spinInterval = setInterval(() => {
      setGrid(prev => prev.map(col => [
         Object.keys(SYMBOL_MAP)[Math.floor(Math.random() * 9)],
         Object.keys(SYMBOL_MAP)[Math.floor(Math.random() * 9)],
         Object.keys(SYMBOL_MAP)[Math.floor(Math.random() * 9)]
      ]));
    }, 100);

    socket.emit('slot:spin', { userId: 'guest', stake: stake * 100 }, (res: any) => {
      // Keep spinning for at least 1.5 seconds for cinematic effect
      setTimeout(() => {
        clearInterval(spinInterval);
        setSpinning(false);
        
        if (res.success) {
          const { grid: finalGrid, totalWin, newBalance, winningLines: lines } = res.data;
          setGrid(finalGrid);
          
          if (totalWin > 0) {
            const winInRupees = totalWin / 100;
            setWinAmount(winInRupees);
            setWinningLines(lines);
            
            // Sync real balance from backend
            setBalance(Number(newBalance) / 100);
            
            playSound('win');
            if (winInRupees >= stake * 5) {
              triggerBigWin();
            } else {
              toast.success(`You won ₹${winInRupees}!`, { icon: '🎉' });
            }
          }
        } else {
          toast.error(res.message || "Spin failed");
          // Revert balance on error
          setBalance(balance);
        }
      }, 1500);
    });
  };

  const triggerBigWin = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#fbbf24', '#f59e0b', '#d97706']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#fbbf24', '#f59e0b', '#d97706']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a] font-sans selection:bg-neon-mint relative flex flex-col pb-safe">
      <header className="flex-none bg-black/40 border-b border-white/5 px-4 py-3 flex items-center justify-between z-20">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">Ocean Treasures</h1>
        <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-full hover:bg-white/10 text-white">
          {soundEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
        </button>
      </header>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background ambient effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-deep-ocean to-[#0a0f1a] pointer-events-none" />
        
        {/* Logo / Title */}
        <motion.div 
           initial={{ y: -20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className="mb-8 z-10 text-center"
        >
           <h2 className="text-4xl font-black bg-gradient-to-b from-yellow-200 to-yellow-600 text-transparent bg-clip-text drop-shadow-[0_5px_15px_rgba(202,138,4,0.5)] tracking-tighter">
             OCEAN TREASURES
           </h2>
        </motion.div>

        {/* Slot Grid Viewport */}
        <div className="relative z-10 bg-black/60 p-3 rounded-2xl border-4 border-yellow-600/30 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
          {/* Paylines Overlay (simplified) */}
          {winningLines.length > 0 && (
             <div className="absolute inset-0 z-20 pointer-events-none animate-pulse border-2 border-yellow-400 rounded-xl" />
          )}

          <div className="flex gap-2">
            {grid.map((reel, x) => (
              <div key={x} className="flex flex-col gap-2 w-16 md:w-24">
                {reel.map((symbol, y) => {
                  const s = SYMBOL_MAP[symbol] || SYMBOL_MAP['L1'];
                  const isWinningSymbol = winningLines.some(l => l.symbol === symbol || symbol === 'WILD' || symbol === 'SCATTER');
                  
                  return (
                    <motion.div 
                      key={`${x}-${y}`}
                      animate={spinning ? { y: [0, 50, -50, 0] } : { y: 0 }}
                      transition={spinning ? { repeat: Infinity, duration: 0.2, delay: x * 0.05 } : { type: 'spring', bounce: 0.5 }}
                      className={`
                        h-16 md:h-24 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg flex items-center justify-center border border-white/5
                        ${!spinning && isWinningSymbol ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-110 z-10' : ''}
                      `}
                    >
                      <span className={`text-4xl md:text-5xl font-black ${s.color}`}>
                        {s.icon}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Win Banner */}
        <AnimatePresence>
          {winAmount > 0 && !spinning && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute z-30 bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 px-8 py-3 rounded-full border-2 border-white shadow-[0_0_30px_rgba(250,204,21,0.6)]"
            >
              <span className="text-black font-black text-2xl uppercase tracking-widest whitespace-nowrap">
                Win ₹{winAmount.toFixed(2)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Panel */}
      <div className="flex-none bg-gradient-to-t from-black to-black/80 rounded-t-3xl border-t border-white/10 p-6 z-20 relative shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
         <div className="flex items-center justify-between mb-6">
           <div className="flex flex-col">
             <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Balance</span>
             <span className="text-white font-black text-xl">₹{balance.toFixed(2)}</span>
           </div>
           
           <button className="text-gray-400 hover:text-white p-2 rounded-full transition-colors">
             <Info size={20} />
           </button>
         </div>

         <div className="flex gap-4 items-center">
            {/* Stake Controls */}
            <div className="flex-1 flex flex-col">
               <div className="flex justify-between text-xs font-bold uppercase text-gray-400 mb-2">
                 <span>Stake</span>
                 <span className="text-yellow-400">₹{stake}</span>
               </div>
               <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 border border-white/10">
                 <button 
                   disabled={spinning || stake <= 10}
                   onClick={() => { playSound('click'); setStake(s => Math.max(10, s - 10)); }}
                   className="w-10 h-10 rounded-lg bg-white/10 text-white font-bold disabled:opacity-50 hover:bg-white/20 active:scale-95 transition-all"
                 >-</button>
                 <div className="flex-1 text-center font-black text-white">{stake}</div>
                 <button 
                   disabled={spinning || stake >= 10000}
                   onClick={() => { playSound('click'); setStake(s => Math.min(10000, s + 50)); }}
                   className="w-10 h-10 rounded-lg bg-white/10 text-white font-bold disabled:opacity-50 hover:bg-white/20 active:scale-95 transition-all"
                 >+</button>
               </div>
            </div>

            {/* Spin Button */}
            <button 
              disabled={spinning}
              onClick={handleSpin}
              className="w-24 h-24 rounded-full bg-gradient-to-b from-neon-mint to-teal-600 shadow-[0_0_30px_rgba(45,212,191,0.4)] border-4 border-black flex flex-col items-center justify-center transform active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {spinning ? (
                <div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Coins className="text-black mb-1" size={24} />
                  <span className="text-black font-black uppercase tracking-widest text-sm">Spin</span>
                </>
              )}
            </button>
         </div>
      </div>
    </main>
  );
}
