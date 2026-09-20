"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from '@/lib/gameSocket';

export default function AndarBaharGame() {
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
  const [result, setResult] = useState<any>(null); // { joker, dealtCards, winner }
  const [history, setHistory] = useState<any[]>([]);

  // Betting State
  const [selectedChips, setSelectedChips] = useState<number>(10);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  
  // Realtime Live Bets
  const [liveBets, setLiveBets] = useState<any[]>([]);

  // Animation State
  const [displayedCards, setDisplayedCards] = useState<any[]>([]);
  const [isDealing, setIsDealing] = useState(false);

  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('tg:join', { gameId: 'andar-bahar', room: 'Auto' });
      s.emit('tg:history', { gameId: 'andar-bahar', room: 'Auto' }, (res: any) => {
        if (res.success) setHistory(res.data);
      });
    });

    s.on('tg:tick', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      if (data.status === 'OPEN' && result !== null) {
        setResult(null);
        setMyBets({}); 
        setLiveBets([]);
        setDisplayedCards([]);
        setIsDealing(false);
      }
    });

    s.on('tg:locked', () => {
      setGameState((p: any) => ({ ...p, status: 'LOCKED' }));
      setTimeLeft(0);
      toast('Bets Locked! Dealing Joker...', { icon: '🃏' });
    });

    s.on('tg:result', (data: any) => {
      setGameState((p: any) => ({ ...p, status: 'RESULT' }));
      setResult(data.result);
      
      // Start dealing animation
      startDealingAnimation(data.result.dealtCards);
      
      setHistory(prev => [{ result: data.result, resultTime: new Date() }, ...prev].slice(0, 15));
      setTimeout(() => fetchBalance(), 2000); 
    });
    
    s.on('tg:live_bet', (data: any) => {
      setLiveBets(prev => [data, ...prev].slice(0, 5));
    });

    return () => { 
      s.emit('tg:leave', { gameId: 'andar-bahar', room: 'Auto' });
      s.disconnect(); 
    };
  }, [fetchBalance, result]);

  useEffect(() => {
    if (gameState.status !== 'OPEN') return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.lockTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const startDealingAnimation = (cards: any[]) => {
    setIsDealing(true);
    setDisplayedCards([]);
    
    // Animate cards dealing one by one rapidly
    cards.forEach((cardObj, index) => {
      setTimeout(() => {
        setDisplayedCards(prev => [...prev, cardObj]);
        if (index === cards.length - 1) {
          setIsDealing(false);
        }
      }, 500 * (index + 1)); // 500ms per card deal
    });
  };

  const placeBet = (market: string) => {
    if (gameState.status !== 'OPEN') {
      toast.error("Bets are currently locked!");
      return;
    }
    
    if (!socket) return;
    
    const userId = "guest"; 
    socket.emit('tg:bet', { userId, gameId: 'andar-bahar', room: 'Auto', market, amount: selectedChips }, (res: any) => {
      if (res.success) {
        setMyBets(prev => ({
          ...prev,
          [market]: (prev[market] || 0) + selectedChips
        }));
        toast.success(`Placed ₹${selectedChips} on ${market}`);
        fetchBalance(); 
      } else {
        toast.error(res.message);
      }
    });
  };

  const renderCardUI = (cardStr: any, key: string, isJoker = false) => {
    if (!cardStr) return null;
    
    const faceCards: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const rankStr = cardStr.rank <= 10 ? cardStr.rank.toString() : (faceCards[Number(cardStr.rank)] || cardStr.rank.toString());
    const suit = cardStr.suit;
    
    const suitColors: Record<string, string> = { 'H': 'text-red-600', 'D': 'text-red-600', 'C': 'text-black', 'S': 'text-black' };
    const suitSymbols: Record<string, string> = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    
    return (
      <motion.div 
        key={key}
        initial={{ x: 0, y: -200, opacity: 0, scale: 0.5, rotateY: 180 }}
        animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ type: "spring", damping: 15 }}
        className={`w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white shadow-2xl flex flex-col justify-between p-1.5 border border-gray-300 relative ${isJoker ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-green-900 z-20' : ''}`}
      >
        <div className={`text-sm sm:text-base font-bold leading-none ${suitColors[suit]}`}>
          {rankStr}
          <div className="text-xs sm:text-sm">{suitSymbols[suit]}</div>
        </div>
        <div className={`text-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 ${suitColors[suit]}`}>
          {suitSymbols[suit]}
        </div>
        <div className={`text-sm sm:text-base font-bold leading-none rotate-180 self-end ${suitColors[suit]}`}>
          {rankStr}
          <div className="text-xs sm:text-sm">{suitSymbols[suit]}</div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="h-[calc(100dvh-58px)] w-full bg-[#1e4620] bg-[url('https://www.transparenttextures.com/patterns/felt.png')] text-white font-sans selection:bg-yellow-500 flex flex-col relative overflow-hidden">


      {/* Game Stage Area */}
      <div className="flex-1 w-full relative flex flex-col items-center py-6 px-4">
        
        {/* Timer / Status */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 border border-white/10 px-6 py-2 rounded-full flex items-center gap-3 backdrop-blur-md z-30 shadow-lg">
           {gameState.status === 'OPEN' ? (
             <>
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm">Place Bets</span>
               <span className={`font-mono font-black text-xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                 00:{timeLeft.toString().padStart(2, '0')}
               </span>
             </>
           ) : (
             <>
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               <span className="font-bold tracking-widest uppercase text-sm text-red-500">{isDealing ? 'Dealing Cards...' : gameState.status === 'LOCKED' ? 'Bets Closed' : gameState.status}</span>
             </>
           )}
        </div>

        {/* Central Joker Area */}
        <div className="mt-12 mb-8 relative">
           <div className="text-center mb-2 font-bold tracking-widest text-yellow-400 text-xs uppercase opacity-70">Joker Card</div>
           <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center bg-black/20">
             {result && renderCardUI(result.joker, 'joker', true)}
           </div>
        </div>

        {/* Andar / Bahar Table Zones */}
        <div className="w-full max-w-4xl flex justify-between gap-4 sm:gap-8 px-2">
           
           {/* Andar Area (Left) */}
           <div className="flex-1 bg-blue-900/40 border border-blue-500/30 rounded-2xl p-4 flex flex-col items-center relative min-h-[160px]">
              <div className="absolute top-2 left-4 font-black text-2xl sm:text-4xl text-white/10 uppercase tracking-tighter pointer-events-none">Andar</div>
              <div className="flex flex-wrap justify-center gap-[-40px] z-10 mt-6">
                {displayedCards.filter(c => c.side === 'ANDAR').map((c, i) => (
                  <div key={i} className="-ml-8 first:ml-0">
                    {renderCardUI(c.card, `andar-${i}`)}
                  </div>
                ))}
              </div>
              {result && result.winner === 'ANDAR' && !isDealing && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 border-4 border-yellow-400 rounded-2xl bg-yellow-400/10 pointer-events-none flex items-center justify-center"
                >
                  <span className="bg-yellow-500 text-black font-black uppercase px-4 py-1 rounded shadow-lg rotate-12">Winner!</span>
                </motion.div>
              )}
           </div>

           {/* Bahar Area (Right) */}
           <div className="flex-1 bg-red-900/40 border border-red-500/30 rounded-2xl p-4 flex flex-col items-center relative min-h-[160px]">
              <div className="absolute top-2 right-4 font-black text-2xl sm:text-4xl text-white/10 uppercase tracking-tighter pointer-events-none">Bahar</div>
              <div className="flex flex-wrap justify-center gap-[-40px] z-10 mt-6">
                {displayedCards.filter(c => c.side === 'BAHAR').map((c, i) => (
                  <div key={i} className="-ml-8 first:ml-0">
                    {renderCardUI(c.card, `bahar-${i}`)}
                  </div>
                ))}
              </div>
              {result && result.winner === 'BAHAR' && !isDealing && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 border-4 border-yellow-400 rounded-2xl bg-yellow-400/10 pointer-events-none flex items-center justify-center"
                >
                  <span className="bg-yellow-500 text-black font-black uppercase px-4 py-1 rounded shadow-lg -rotate-12">Winner!</span>
                </motion.div>
              )}
           </div>

        </div>

      </div>

      {/* Betting Panels */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Andar Bet Button */}
          <button 
            onClick={() => placeBet('ANDAR')}
            className="bg-blue-600/80 hover:bg-blue-500 border border-blue-400/50 rounded-xl py-6 flex flex-col items-center relative overflow-hidden transition-all active:scale-95"
          >
             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
             <span className="font-black text-2xl uppercase tracking-widest relative z-10">Andar</span>
             <span className="text-blue-200 text-xs font-bold relative z-10 mt-1">Pays 1.9x</span>
             {myBets['ANDAR'] && (
               <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow-lg border border-black z-20">
                 ₹ {myBets['ANDAR']}
               </div>
             )}
          </button>

          {/* Bahar Bet Button */}
          <button 
            onClick={() => placeBet('BAHAR')}
            className="bg-red-600/80 hover:bg-red-500 border border-red-400/50 rounded-xl py-6 flex flex-col items-center relative overflow-hidden transition-all active:scale-95"
          >
             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
             <span className="font-black text-2xl uppercase tracking-widest relative z-10">Bahar</span>
             <span className="text-red-200 text-xs font-bold relative z-10 mt-1">Pays 2x</span>
             {myBets['BAHAR'] && (
               <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs font-black px-2 py-0.5 rounded-full shadow-lg border border-black z-20">
                 ₹ {myBets['BAHAR']}
               </div>
             )}
          </button>
        </div>
      </div>

      {/* History Ribbon */}
      <div className="bg-black/50 border-t border-white/5 py-1.5 px-4 flex gap-1 overflow-x-auto scrollbar-hide items-center h-10 w-full justify-center">
        {history.map((h, i) => (
          <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${h.result.winner === 'ANDAR' ? 'bg-blue-600' : 'bg-red-600'} border border-white/20`}>
            {h.result.winner === 'ANDAR' ? 'A' : 'B'}
          </div>
        ))}
      </div>

      {/* Chip Selector Footer */}
      <div className="bg-black/80 border-t border-white/10 p-4 sticky bottom-0 z-40 backdrop-blur-md">
         <div className="max-w-3xl mx-auto flex gap-3 justify-center overflow-x-auto pb-1 scrollbar-hide">
            {CHIP_VALUES.map(val => (
              <button 
                key={val}
                onClick={() => setSelectedChips(val)}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center border-4 shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-transform ${selectedChips === val ? 'scale-110 -translate-y-2 border-yellow-400 bg-yellow-400/20' : 'border-gray-500 bg-gray-800 opacity-80 hover:opacity-100'}`}
              >
                 <div className="absolute inset-1 border border-white/20 rounded-full border-dashed" />
                 <span className={`font-black text-sm ${selectedChips === val ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-gray-300'}`}>{val >= 1000 ? `${val/1000}k` : val}</span>
              </button>
            ))}
         </div>
      </div>
    </div>
  );
}
