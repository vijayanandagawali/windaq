"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, HelpCircle, Activity, Wifi, ShieldCheck, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

export default function LiveRoulette() {
  const { balance, fetchBalance, user } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [gameState, setGameState] = useState<any>(null);
  const [myBets, setMyBets] = useState<any[]>([]);
  const [betAmount, setBetAmount] = useState(10);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // We connect to the live-dealer namespace (or default, where we registered it)
    const s = io('http://localhost:4000', { auth: { token: 'mock-token' } });
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('live:join', { tableId: 'live-roulette-1' }, (res: any) => {
         if (res.success && res.state) setGameState(res.state);
      });
    });

    s.on('live:state', (data: any) => {
      setGameState(data);
      if (data.status === 'SETTLED') {
         setTimeout(() => fetchBalance(), 1000);
         // Show result toast
         toast.success(`Result: ${data.result.number}`, { icon: '🎯' });
         // clear bets after a delay
         setTimeout(() => setMyBets([]), 3000);
      }
      if (data.status === 'BETTING_OPEN') {
         setMyBets([]);
      }
    });

    return () => { s.disconnect(); };
  }, [fetchBalance]);

  const placeBet = (market: string, targets: number[]) => {
    if (!socket) return;
    if (gameState?.status !== 'BETTING_OPEN') return toast.error("Betting is closed");
    if (balance < betAmount * 100) return toast.error("Insufficient balance");
    
    // Optimistic UI
    const newBet = { market, targets, amount: betAmount };
    setMyBets(prev => [...prev, newBet]);
    
    socket.emit('live:bet', {
      tableId: 'live-roulette-1',
      userId: user?.id || 'guest',
      market,
      targets,
      amount: betAmount
    }, (res: any) => {
      if (!res.success) {
        toast.error(res.message);
        setMyBets(prev => prev.filter(b => b !== newBet));
      } else {
        fetchBalance(); // sync real balance
      }
    });
  };

  const getNumberColor = (num: number) => {
    if (num === 0) return 'bg-green-600 text-white border-green-500';
    return RED_NUMBERS.includes(num) ? 'bg-red-600 text-white border-red-500' : 'bg-black text-white border-gray-800';
  };

  return (
    <main className="min-h-screen w-full bg-[#111] text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* VIDEO HERO BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover opacity-60 mix-blend-screen"
          autoPlay 
          muted 
          loop 
          playsInline
          poster="https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=1200&auto=format&fit=crop"
        >
          {/* Using a placeholder free stock video for demonstration. In production, this would be an HLS stream. */}
          <source src="https://assets.mixkit.co/videos/preview/mixkit-playing-roulette-in-a-casino-8987-large.mp4" type="video/mp4" />
        </video>
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-black/80 pointer-events-none"></div>
      </div>

      {/* HEADER */}
      <header className="relative z-10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 bg-black/40 backdrop-blur-md">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
              <h1 className="font-bold text-sm tracking-widest uppercase">VIP Roulette</h1>
            </div>
            <div className="text-[10px] text-white/50 flex items-center gap-1">
              <ShieldCheck size={12} className="text-green-400" /> Provably Fair
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Bal</span>
            <span className="font-bold text-green-400 text-sm">₹{(balance / 100).toLocaleString()}</span>
          </div>
          <button className="p-2 rounded-full hover:bg-white/10 bg-black/40 backdrop-blur-md">
            <Wifi size={18} className="text-green-400" />
          </button>
        </div>
      </header>

      {/* CENTER STATUS MESSAGE */}
      <div className="relative z-10 flex-1 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {gameState?.status === 'BETTING_OPEN' && (
            <motion.div 
              key="open"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="bg-green-600/80 backdrop-blur-md border border-green-400 text-white px-8 py-3 rounded-full text-2xl font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(22,163,7,0.5)]"
            >
              Place Your Bets
            </motion.div>
          )}
          {gameState?.status === 'BETTING_CLOSED' && (
            <motion.div 
              key="closed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="bg-red-600/80 backdrop-blur-md border border-red-400 text-white px-8 py-3 rounded-full text-2xl font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.5)]"
            >
              No More Bets
            </motion.div>
          )}
          {gameState?.status === 'RESULT_PENDING' && (
            <motion.div 
              key="pending"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.2, opacity: 0 }}
              className="bg-orange-600/80 backdrop-blur-md border border-orange-400 text-white px-8 py-3 rounded-full text-xl font-bold uppercase tracking-widest flex items-center gap-3"
            >
              <Activity className="animate-spin" /> Verifying Result...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM BETTING PANEL */}
      <div className="relative z-10 w-full bg-black/80 backdrop-blur-xl border-t border-white/10 p-2 sm:p-4 pb-safe flex flex-col items-center">
         
         {/* Chip Selector */}
         <div className="flex gap-2 mb-4">
           {[10, 50, 100, 500, 1000].map(amt => (
             <button
               key={amt}
               onClick={() => setBetAmount(amt)}
               className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${betAmount === amt ? 'bg-yellow-500 border-white text-black scale-110 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-gray-800 border-gray-600 text-white opacity-70 hover:opacity-100'}`}
             >
               {amt}
             </button>
           ))}
         </div>

         {/* Compact Roulette Board */}
         <div className="w-full max-w-2xl bg-green-900/40 p-2 rounded-xl border-2 border-green-500/30">
            {/* Numbers Grid */}
            <div className="flex">
               {/* 0 */}
               <div 
                 onClick={() => placeBet('STRAIGHT', [0])}
                 className="w-10 flex-shrink-0 bg-green-600 border border-green-500 flex items-center justify-center font-bold cursor-pointer hover:brightness-125 relative"
               >
                 0
                 {myBets.some(b => b.market==='STRAIGHT' && b.targets.includes(0)) && <div className="absolute w-4 h-4 bg-yellow-500 rounded-full border border-white"></div>}
               </div>

               {/* 1-36 */}
               <div className="flex-1 grid grid-cols-12 grid-rows-3 gap-0">
                  {/* Row 3: 3, 6, 9... */}
                  {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => (
                    <div key={n} onClick={() => placeBet('STRAIGHT', [n])} className={`aspect-square sm:aspect-auto border flex items-center justify-center font-bold text-xs cursor-pointer hover:brightness-125 relative ${getNumberColor(n)}`}>
                      {n}
                      {myBets.some(b => b.market==='STRAIGHT' && b.targets.includes(n)) && <div className="absolute w-4 h-4 bg-yellow-500 rounded-full border border-white"></div>}
                    </div>
                  ))}
                  {/* Row 2: 2, 5, 8... */}
                  {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => (
                    <div key={n} onClick={() => placeBet('STRAIGHT', [n])} className={`aspect-square sm:aspect-auto border flex items-center justify-center font-bold text-xs cursor-pointer hover:brightness-125 relative ${getNumberColor(n)}`}>
                      {n}
                      {myBets.some(b => b.market==='STRAIGHT' && b.targets.includes(n)) && <div className="absolute w-4 h-4 bg-yellow-500 rounded-full border border-white"></div>}
                    </div>
                  ))}
                  {/* Row 1: 1, 4, 7... */}
                  {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => (
                    <div key={n} onClick={() => placeBet('STRAIGHT', [n])} className={`aspect-square sm:aspect-auto border flex items-center justify-center font-bold text-xs cursor-pointer hover:brightness-125 relative ${getNumberColor(n)}`}>
                      {n}
                      {myBets.some(b => b.market==='STRAIGHT' && b.targets.includes(n)) && <div className="absolute w-4 h-4 bg-yellow-500 rounded-full border border-white"></div>}
                    </div>
                  ))}
               </div>
            </div>

            {/* Outside Bets */}
            <div className="flex gap-1 mt-1 ml-10">
               <div onClick={() => placeBet('RED', [])} className="flex-1 bg-red-600 border border-red-500 py-2 flex justify-center items-center font-bold text-xs cursor-pointer hover:brightness-125 rounded relative">
                 RED
                 {myBets.some(b => b.market==='RED') && <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-500 rounded-full"></div>}
               </div>
               <div onClick={() => placeBet('BLACK', [])} className="flex-1 bg-black border border-gray-700 py-2 flex justify-center items-center font-bold text-xs cursor-pointer hover:brightness-125 rounded relative">
                 BLACK
                 {myBets.some(b => b.market==='BLACK') && <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-500 rounded-full"></div>}
               </div>
               <div onClick={() => placeBet('EVEN', [])} className="flex-1 bg-transparent border border-white/20 py-2 flex justify-center items-center font-bold text-xs cursor-pointer hover:bg-white/10 rounded relative text-white/80">
                 EVEN
                 {myBets.some(b => b.market==='EVEN') && <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-500 rounded-full"></div>}
               </div>
               <div onClick={() => placeBet('ODD', [])} className="flex-1 bg-transparent border border-white/20 py-2 flex justify-center items-center font-bold text-xs cursor-pointer hover:bg-white/10 rounded relative text-white/80">
                 ODD
                 {myBets.some(b => b.market==='ODD') && <div className="absolute top-1 right-1 w-3 h-3 bg-yellow-500 rounded-full"></div>}
               </div>
            </div>
         </div>

      </div>

    </main>
  );
}
