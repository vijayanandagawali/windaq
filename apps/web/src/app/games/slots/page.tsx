"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Coins, Volume2, VolumeX } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { audioEngine, haptic } from '@/lib/audioEngine';
import { useAudioStore } from '@/store/audioStore';
import WinLossCelebration from '@/components/games/WinLossCelebration';

const SYMBOL_MAP: Record<string, { icon: string, color: string }> = {
  WILD: { icon: '💎', color: 'text-cyan-600 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' },
  SCATTER: { icon: '⭐', color: 'text-yellow-600 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' },
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
  const { soundEnabled, toggleSound } = useAudioStore();
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
  const [celebration, setCelebration] = useState<{ type: 'win' | 'loss'; amount: number; multiplier?: string } | null>(null);

  // Init Socket
  useEffect(() => {
    const s = createGameSocket();
    setSocket(s);

    s.on('connect', () => {
      console.log("Connected to Slots");
      s.emit('slot:join');
    });

    return () => {
      s.emit('slot:leave');
      s.disconnect();
    };
  }, []);

  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false, false, false]);
  // The scramble interval reads the live reel state through a ref (state would be stale inside it).
  const spinningReelsRef = useRef<boolean[]>([false, false, false, false, false]);
  useEffect(() => { spinningReelsRef.current = spinningReels; }, [spinningReels]);

  const handleSpin = () => {
    if (balance < stake) {
      toast.error("Insufficient balance!");
      return;
    }
    if (!socket || spinning) return;

    audioEngine.play('reelSpin');
    haptic.deal();
    setSpinning(true);
    spinningReelsRef.current = [true, true, true, true, true];
    setSpinningReels([true, true, true, true, true]);
    setWinAmount(0);
    setWinningLines([]);
    
    // Optimistic deduct for visual speed
    deductBalance(stake);

    // Continuous symbol scramble while spinning
    let spinInterval = setInterval(() => {
      setGrid(prev => prev.map((col, cIdx) => {
        if (!spinningReelsRef.current[cIdx]) return col;
        return [
          Object.keys(SYMBOL_MAP)[Math.floor(Math.random() * 9)],
          Object.keys(SYMBOL_MAP)[Math.floor(Math.random() * 9)],
          Object.keys(SYMBOL_MAP)[Math.floor(Math.random() * 9)]
        ];
      }));
    }, 80);

    socket.emit('slot:spin', { stake: stake * 100 }, (res: any) => {
      if (res.success) {
        const { grid: finalGrid, totalWin, newBalance, winningLines: lines } = res.data;

        // Staggered reel stops (reel 0 -> reel 4)
        [0, 1, 2, 3, 4].forEach((reelIdx) => {
          setTimeout(() => {
            audioEngine.play('reelStop');
            haptic.bet();
            setGrid(prev => {
              const next = [...prev];
              next[reelIdx] = finalGrid[reelIdx];
              return next;
            });
            setSpinningReels(prev => {
              const next = [...prev];
              next[reelIdx] = false;
              return next;
            });

            // When last reel stops
            if (reelIdx === 4) {
              clearInterval(spinInterval);
              setSpinning(false);
              
              if (totalWin > 0) {
                const winInRupees = totalWin / 100;
                setWinAmount(winInRupees);
                setWinningLines(lines);
                setBalance(Number(newBalance) / 100);
                if (winInRupees >= stake * 10) {
                  audioEngine.play('jackpot');
                } else {
                  audioEngine.play('win');
                }
                triggerBigWin();
                setCelebration({
                  type: 'win',
                  amount: winInRupees,
                  multiplier: `${(winInRupees / stake).toFixed(1)}x`
                });
              } else {
                setBalance(Number(newBalance) / 100);
                setCelebration({
                  type: 'loss',
                  amount: stake
                });
              }
            }
          }, 600 + reelIdx * 250);
        });
      } else {
        clearInterval(spinInterval);
        setSpinning(false);
        setSpinningReels([false, false, false, false, false]);
        audioEngine.play('loss');
        toast.error(res.message || "Spin failed");
        setBalance(balance);
      }
    });
  };

  const triggerBigWin = () => {
    // Golden coin burst with confetti
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#fbbf24', '#f59e0b', '#d97706', '#fef08a']
    });
  };

  return (
    <div className="min-h-[calc(100dvh-58px)] bg-gradient-to-b from-orange-50/60 via-white to-emerald-50/60 font-sans relative flex flex-col pb-safe">


      {/* Main Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background ambient effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-deep-ocean to-slate-50 pointer-events-none" />
        
        {/* Logo / Title */}
        <motion.div 
           initial={{ y: -20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className="mb-6 z-10 text-center"
        >
           <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-b from-yellow-200 to-yellow-600 text-transparent bg-clip-text drop-shadow-[0_5px_15px_rgba(202,138,4,0.5)] tracking-tighter">
             OCEAN TREASURES
           </h2>
        </motion.div>

        {/* Slot Grid Viewport */}
        <div className="relative z-10 bg-white/80 p-3 sm:p-4 rounded-2xl border-4 border-yellow-600/40 shadow-[0_0_50px_rgba(15,23,42,0.18),0_0_30px_rgba(234,179,8,0.2)] backdrop-blur-md">
          
          {/* Animated Laser Paylines Overlay */}
          {winningLines.length > 0 && !spinning && (
            <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none">
              <defs>
                <linearGradient id="laserGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="50%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#00ffa3" />
                </linearGradient>
              </defs>
              <line x1="5%" y1="25%" x2="95%" y2="25%" stroke="url(#laserGrad)" strokeWidth="3" strokeDasharray="6 4" className="animate-pulse" />
              <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="url(#laserGrad)" strokeWidth="3" strokeDasharray="6 4" className="animate-pulse" />
              <line x1="5%" y1="75%" x2="95%" y2="75%" stroke="url(#laserGrad)" strokeWidth="3" strokeDasharray="6 4" className="animate-pulse" />
            </svg>
          )}

          <div className="flex gap-2">
            {grid.map((reel, x) => {
              const isReelSpinning = spinningReels[x];
              return (
                <div key={x} className={`flex flex-col gap-2 w-14 sm:w-20 md:w-24 transition-all ${isReelSpinning ? 'blur-[1.5px]' : ''}`}>
                  {reel.map((symbol, y) => {
                    const s = SYMBOL_MAP[symbol] || SYMBOL_MAP['L1'];
                    const isWinningSymbol = winningLines.some(l => l.symbol === symbol || symbol === 'WILD' || symbol === 'SCATTER');
                    
                    // Keyframe spins stop with a tween: framer-motion springs cannot resolve multi-keyframe values.
                    return (
                      <motion.div 
                        key={`${x}-${y}`}
                        animate={isReelSpinning ? { y: [0, 60, -60, 0] } : { y: 0 }}
                        transition={isReelSpinning ? { repeat: Infinity, duration: 0.15, ease: 'linear' } : { type: 'tween', duration: 0.25, ease: 'easeOut' }}
                        className={`
                          h-16 sm:h-20 md:h-24 bg-gradient-to-b from-slate-100 to-white rounded-xl flex items-center justify-center border border-slate-200
                          ${!spinning && isWinningSymbol ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.7)] scale-105 z-10' : ''}
                        `}
                      >
                        <span className={`text-3xl sm:text-4xl md:text-5xl font-black ${s.color}`}>
                          {s.icon}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Win Banner with Coin Burst */}
        <AnimatePresence>
          {winAmount > 0 && !spinning && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="mt-4 z-30 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 px-8 py-3 rounded-full border-2 border-white shadow-[0_0_40px_rgba(250,204,21,0.8)]"
            >
              <span className="text-black font-black text-2xl uppercase tracking-widest whitespace-nowrap">
                🪙 WIN ₹{winAmount.toFixed(2)}!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Panel */}
      <div className="flex-none bg-gradient-to-t from-slate-100 to-slate-100 rounded-t-3xl border-t border-slate-200 p-6 z-20 relative shadow-[0_-10px_40px_rgba(15,23,42,0.18)]">
         <div className="flex items-center justify-between mb-6">
           <div className="flex flex-col">
             <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Balance</span>
             <span className="text-slate-900 font-black text-xl">₹{balance.toFixed(2)}</span>
           </div>
           
           <button className="text-slate-500 hover:text-slate-900 p-2 rounded-full transition-colors">
             <Info size={20} />
           </button>
         </div>

         <div className="flex gap-4 items-center">
            {/* Stake Controls */}
            <div className="flex-1 flex flex-col">
               <div className="flex justify-between text-xs font-bold uppercase text-slate-500 mb-2">
                 <span>Stake</span>
                 <span className="text-yellow-600">₹{stake}</span>
               </div>
               <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-200">
                  <button 
                    disabled={spinning || stake <= 10}
                    onClick={() => { audioEngine.play('click'); setStake(s => Math.max(10, s - 10)); }}
                    className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 font-bold disabled:opacity-50 hover:bg-slate-200 active:scale-95 transition-all"
                  >-</button>
                  <div className="flex-1 text-center font-black text-slate-900">{stake}</div>
                  <button 
                    disabled={spinning || stake >= 10000}
                    onClick={() => { audioEngine.play('click'); setStake(s => Math.min(10000, s + 50)); }}
                    className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 font-bold disabled:opacity-50 hover:bg-slate-200 active:scale-95 transition-all"
                  >+</button>
               </div>
            </div>

            {/* Spin Button */}
            <button 
              disabled={spinning}
              onClick={handleSpin}
              className="w-24 h-24 rounded-full bg-gradient-to-b from-neon-mint to-teal-600 shadow-[0_0_30px_rgba(45,212,191,0.4)] border-4 border-slate-200 flex flex-col items-center justify-center transform active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {spinning ? (
                <div className="w-8 h-8 border-4 border-slate-200 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Coins className="text-black mb-1" size={24} />
                  <span className="text-black font-black uppercase tracking-widest text-sm">Spin</span>
                </>
              )}
            </button>
         </div>
       </div>

      <WinLossCelebration
        celebration={celebration}
        onComplete={() => setCelebration(null)}
      />
    </div>
  );
}
