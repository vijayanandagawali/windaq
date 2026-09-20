"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

export default function DragonTigerGame() {
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
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Betting State
  const [selectedChips, setSelectedChips] = useState<number>(10);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];
  const [myBets, setMyBets] = useState<Record<string, number>>({});

  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('tg:join', { gameId: 'dragon-tiger', room: 'Standard' });
      s.emit('tg:history', { gameId: 'dragon-tiger', room: 'Standard' }, (res: any) => {
        if (res.success) setHistory(res.data);
      });
    });

    s.on('tg:tick', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      if (data.status === 'OPEN' && result) {
        setResult(null);
        setMyBets({}); // Clear bets for new round
      }
    });

    s.on('tg:locked', () => {
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      toast('Bets Locked!', { icon: '🔒' });
    });

    s.on('tg:result', (data: any) => {
      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      setResult(data.result);
      
      // Update history
      setHistory(prev => [{ result: data.result, resultTime: new Date() }, ...prev].slice(0, 20));
      
      // We refetch balance after 2s to allow settlement
      setTimeout(() => fetchBalance(), 2000);
    });

    return () => { 
      s.emit('tg:leave', { gameId: 'dragon-tiger' });
      s.disconnect(); 
    };
  }, [fetchBalance, result]);

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
    socket.emit('tg:bet', { userId, gameId: 'dragon-tiger', room: 'Standard', market, amount: selectedChips }, (res: any) => {
      if (res.success) {
        setMyBets(prev => ({
          ...prev,
          [market]: (prev[market] || 0) + selectedChips
        }));
        toast.success(`Placed ₹${selectedChips} on ${market}`);
        fetchBalance(); // Immediate deduct
      } else {
        toast.error(res.message);
      }
    });
  };

  const formatCard = (c: any) => {
    if (!c) return { str: '', color: '' };
    const suits: any = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
    const ranks: any = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J' };
    const r = ranks[c.rank] || c.rank;
    const color = (c.suit === 'H' || c.suit === 'D') ? 'text-red-600' : 'text-black';
    return { str: `${r}${suits[c.suit]}`, color };
  };

  return (
    <main className="h-screen w-full bg-[#0a0f1a] text-white font-sans selection:bg-neon-mint flex flex-col overflow-hidden">
      
      {/* Navbar */}
      <header className="bg-black/40 border-b border-white/5 px-4 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="font-bold tracking-widest text-sm uppercase">Dragon Tiger</h1>
          <div className="text-neon-mint font-bold text-xs bg-neon-mint/10 px-2 py-0.5 rounded-full mt-1">₹ {balance.toFixed(2)}</div>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10">
          <Info size={20}/>
        </button>
      </header>

      {/* Table & Dealer Area */}
      <div className="relative h-[45vh] bg-gradient-to-b from-[#3a1c22] via-[#221013] to-[#0a0f1a] flex flex-col items-center border-b border-white/10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20 pointer-events-none mix-blend-overlay" />
        
        {/* Timer */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 border border-white/10 px-6 py-2 rounded-full flex items-center gap-3 backdrop-blur-md z-10 shadow-lg">
           {gameState.status === 'OPEN' ? (
             <>
               <div className="w-2 h-2 rounded-full bg-neon-mint animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm">Betting Open</span>
               <span className={`font-mono font-black text-xl ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-neon-mint'}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </span>
             </>
           ) : (
             <>
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm text-red-500">{gameState.status === 'LOCKED' ? 'Dealing...' : gameState.status}</span>
             </>
           )}
        </div>

        {/* Card Dealing Area */}
        <div className="flex-1 w-full flex items-center justify-center gap-12 sm:gap-24 relative mt-12">
          
          {/* Dragon Box */}
          <div className="flex flex-col items-center">
             <div className="text-red-500 font-black tracking-widest text-lg mb-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">DRAGON</div>
             <div className="w-24 h-36 bg-black/40 border-2 border-dashed border-red-500/30 rounded-xl relative flex items-center justify-center">
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ x: 100, y: -100, rotateY: 180, opacity: 0 }}
                      animate={{ x: 0, y: 0, rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
                      className="absolute inset-0 bg-white rounded-xl shadow-2xl border border-gray-300 flex items-center justify-center"
                    >
                      <span className={`text-4xl font-bold ${formatCard(result.dragon).color}`}>{formatCard(result.dragon).str}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>

          <div className="text-2xl font-black text-white/20">VS</div>

          {/* Tiger Box */}
          <div className="flex flex-col items-center">
             <div className="text-yellow-500 font-black tracking-widest text-lg mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">TIGER</div>
             <div className="w-24 h-36 bg-black/40 border-2 border-dashed border-yellow-500/30 rounded-xl relative flex items-center justify-center">
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ x: -100, y: -100, rotateY: 180, opacity: 0 }}
                      animate={{ x: 0, y: 0, rotateY: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 100, delay: 0.8 }}
                      className="absolute inset-0 bg-white rounded-xl shadow-2xl border border-gray-300 flex items-center justify-center"
                    >
                      <span className={`text-4xl font-bold ${formatCard(result.tiger).color}`}>{formatCard(result.tiger).str}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>

        </div>

        {/* Result Announcement */}
        <AnimatePresence>
          {result && gameState.status === 'RESULT' && (
             <motion.div
               initial={{ opacity: 0, scale: 0.5 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0 }}
               className="absolute bottom-8 z-30"
             >
               <div className={`px-8 py-3 rounded-full font-black text-2xl tracking-widest border-2 shadow-2xl ${
                 result.winner === 'DRAGON' ? 'bg-red-600 text-white border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.5)]' :
                 result.winner === 'TIGER' ? 'bg-yellow-500 text-black border-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.5)]' :
                 'bg-green-600 text-white border-green-400 shadow-[0_0_30px_rgba(22,163,74,0.5)]'
               }`}>
                 {result.winner} WINS
               </div>
             </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Bead Road History */}
      <div className="bg-black/50 py-2 border-b border-white/5 flex gap-1 px-4 overflow-x-auto scrollbar-hide">
         {history.map((h, i) => (
           <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
             h.result.winner === 'DRAGON' ? 'bg-red-600 text-white' :
             h.result.winner === 'TIGER' ? 'bg-yellow-500 text-black' :
             'bg-green-600 text-white'
           }`}>
             {h.result.winner[0]}
           </div>
         ))}
      </div>

      {/* Betting Grid */}
      <div className="flex-1 p-4 flex flex-col justify-center">
         <div className="max-w-2xl mx-auto w-full grid grid-cols-2 gap-4 relative">
            
            <button 
              onClick={() => placeBet('DRAGON')}
              className="relative bg-gradient-to-b from-red-900/50 to-red-800/20 hover:from-red-800/80 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center justify-center transition-all min-h-[120px]"
            >
              <div className="text-2xl font-black tracking-widest text-red-400">DRAGON</div>
              <div className="text-xs text-red-200/50 font-bold mt-1">1:1</div>
              {myBets['DRAGON'] && (
                 <div className="absolute top-2 right-2 bg-white text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-red-500">₹{myBets['DRAGON']}</div>
              )}
            </button>

            <button 
              onClick={() => placeBet('TIGER')}
              className="relative bg-gradient-to-b from-yellow-900/50 to-yellow-800/20 hover:from-yellow-800/80 border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center justify-center transition-all min-h-[120px]"
            >
              <div className="text-2xl font-black tracking-widest text-yellow-500">TIGER</div>
              <div className="text-xs text-yellow-200/50 font-bold mt-1">1:1</div>
              {myBets['TIGER'] && (
                 <div className="absolute top-2 right-2 bg-white text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-yellow-500">₹{myBets['TIGER']}</div>
              )}
            </button>
            
            {/* Tie in the middle spanning full width below, or absolute center */}
            <button 
              onClick={() => placeBet('TIE')}
              className="col-span-2 relative bg-gradient-to-b from-green-900/50 to-green-800/20 hover:from-green-800/80 border border-green-500/30 rounded-2xl py-4 flex flex-col items-center justify-center transition-all"
            >
              <div className="text-xl font-black tracking-widest text-green-400">TIE</div>
              <div className="text-xs text-green-200/50 font-bold mt-1">8:1</div>
              {myBets['TIE'] && (
                 <div className="absolute top-2 right-2 bg-white text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-green-500">₹{myBets['TIE']}</div>
              )}
            </button>
         </div>
      </div>

      {/* Chip Selector Footer */}
      <div className="bg-black/60 border-t border-white/10 p-4 z-40 backdrop-blur-md">
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
