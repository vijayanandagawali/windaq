"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from '@/lib/gameSocket';
import WinLossCelebration from '@/components/games/WinLossCelebration';

export default function BlackjackGame() {
  const { balance, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  const [gameState, setGameState] = useState<any>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  
  const [selectedChips, setSelectedChips] = useState<number>(50);
  const CHIP_VALUES = [10, 50, 100, 500, 1000];

  // Win / Loss Celebration
  const [celebration, setCelebration] = useState<{
    status: 'IDLE' | 'WON' | 'LOST';
    amount: number;
    multiplier?: number;
    message?: string;
  }>({ status: 'IDLE', amount: 0 });

  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);

    s.on('connect', () => {
      s.emit('bj:join', { userId: "guest" }, (res: any) => {
        if (res.success) {
          setGameId(res.gameId);
          setGameState(res.state);
        }
      });
    });

    s.on('bj:state', (state: any) => {
      setGameState(state);
      fetchBalance();

      // Trigger win/loss celebration on SETTLED state
      if (state.status === 'SETTLED' && state.hands && state.hands.length > 0) {
        const totalPayout = state.hands.reduce((sum: number, h: any) => sum + (h.payout || 0), 0);
        const hasWin = state.hands.some((h: any) => h.status === 'WON' || h.status === 'BLACKJACK');
        const hasLoss = state.hands.some((h: any) => h.status === 'BUST' || h.status === 'LOST');

        if (hasWin && totalPayout > 0) {
          const isBj = state.hands.some((h: any) => h.status === 'BLACKJACK');
          setCelebration({
            status: 'WON',
            amount: totalPayout,
            multiplier: isBj ? 2.5 : 2.0,
            message: isBj ? 'NATURAL BLACKJACK!' : 'YOU WON THE HAND!'
          });
        } else if (hasLoss) {
          setCelebration({
            status: 'LOST',
            amount: state.hands[0]?.bet || 0,
            message: 'Dealer Takes Hand'
          });
        }
      }
    });

    return () => { s.disconnect(); };
  }, [fetchBalance]);

  const placeBet = () => {
    if (!socket || !gameId) return;
    if (gameState?.status !== 'BETTING' && gameState?.status !== 'SETTLED') {
      toast.error("Game already in progress!");
      return;
    }

    socket.emit('bj:bet', { gameId, amount: selectedChips }, (res: any) => {
      if (res.success) {
        setGameState(res.state);
        toast.success(`Bet ₹${selectedChips} placed!`);
        fetchBalance();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleAction = (actionType: string) => {
    if (!socket || !gameId || !gameState) return;
    const activeHand = gameState.hands[gameState.activeHandIndex];
    if (!activeHand) return;

    socket.emit('bj:action', { gameId, handId: activeHand.id, actionType }, (res: any) => {
      if (res.success) {
        setGameState(res.state);
      } else {
        toast.error(res.message);
      }
    });
  };

  const renderCard = (cardStr: string | null, index: number, hidden: boolean = false) => {
    if (hidden || !cardStr) {
      return (
        <motion.div 
          initial={{ x: 50, y: -200, opacity: 0, rotateY: 180 }}
          animate={{ x: index * 20, y: 0, opacity: 1, rotateY: 180 }}
          transition={{ type: "spring", damping: 15 }}
          className="absolute w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blue-900 border-2 border-white/20 shadow-xl"
        />
      );
    }
    
    const rank = cardStr[0];
    const suit = cardStr[1];
    
    const suitColors: Record<string, string> = { 'H': 'text-red-500', 'D': 'text-red-500', 'C': 'text-gray-900', 'S': 'text-gray-900' };
    const suitSymbols: Record<string, string> = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    
    return (
      <motion.div 
        key={cardStr + index}
        initial={{ x: 50, y: -200, opacity: 0 }}
        animate={{ x: index * 20, y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="absolute w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white shadow-xl flex flex-col justify-between p-1.5 sm:p-2 border border-gray-200"
      >
        <div className={`text-sm sm:text-base font-bold leading-none ${suitColors[suit]}`}>
          {rank === 'T' ? '10' : rank}
          <div className="text-xs sm:text-sm">{suitSymbols[suit]}</div>
        </div>
        <div className={`text-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 ${suitColors[suit]}`}>
          {suitSymbols[suit]}
        </div>
        <div className={`text-sm sm:text-base font-bold leading-none rotate-180 self-end ${suitColors[suit]}`}>
          {rank === 'T' ? '10' : rank}
          <div className="text-xs sm:text-sm">{suitSymbols[suit]}</div>
        </div>
      </motion.div>
    );
  };

  const getHandTotal = (cards: (string | null)[]) => {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      if (!card) continue;
      const r = card[0];
      if (['T','J','Q','K'].includes(r)) total += 10;
      else if (r === 'A') { total += 11; aces++; }
      else total += parseInt(r);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  };

  return (
    <div className="h-[calc(100dvh-58px)] w-full bg-[#1e4620] bg-[url('https://www.transparenttextures.com/patterns/felt.png')] text-white font-sans flex flex-col relative overflow-hidden">


      {/* Table Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        
        {/* Dealer Zone */}
        <div className="absolute top-10 sm:top-20 flex flex-col items-center">
          <div className="text-yellow-400/80 font-bold tracking-widest text-xs uppercase mb-2">Dealer Must Draw to 16</div>
          <div className="relative w-48 h-28 flex justify-center">
            {gameState?.dealerCards?.map((card: any, i: number) => {
              // Hide second card if playing
              const isHidden = gameState.status === 'PLAYING' && i === 1;
              return renderCard(card, i, isHidden);
            })}
          </div>
          {gameState?.status === 'SETTLED' && gameState?.dealerCards && (
             <div className="bg-black/60 px-3 py-1 rounded-full text-xs font-bold border border-white/10 mt-2 backdrop-blur-sm">
               {getHandTotal(gameState.dealerCards)}
             </div>
          )}
        </div>

        {/* Center Logo / Status */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 text-center pointer-events-none">
           <h2 className="text-4xl sm:text-6xl font-black text-white/50 tracking-[0.5em] mb-2 uppercase">Blackjack</h2>
           <p className="text-xl font-bold text-yellow-500/50 uppercase tracking-widest">Pays 3 to 2</p>
        </div>

        {/* Player Zone */}
        <div className="absolute bottom-32 sm:bottom-40 flex flex-col items-center z-10 w-full">
           <div className="flex gap-4 sm:gap-12 justify-center w-full max-w-2xl px-4">
             {gameState?.hands?.map((hand: any, i: number) => {
               const isActive = gameState.activeHandIndex === i && gameState.status === 'PLAYING';
               const isSettled = gameState.status === 'SETTLED';
               return (
                 <div key={hand.id} className={`flex flex-col items-center transition-all ${isActive ? 'scale-110' : 'opacity-80 scale-95'}`}>
                   {/* Hand Status/Payout Tag */}
                   {isSettled && (
                     <motion.div 
                       initial={{ y: 20, opacity: 0 }}
                       animate={{ y: 0, opacity: 1 }}
                       className={`mb-2 px-3 py-1 rounded-full text-xs font-black uppercase shadow-lg border ${
                         hand.status === 'WON' || hand.status === 'BLACKJACK' ? 'bg-yellow-500 text-black border-yellow-300' :
                         hand.status === 'PUSH' ? 'bg-gray-500 text-white border-gray-400' :
                         'bg-red-600 text-white border-red-400'
                       }`}
                     >
                       {hand.status} {hand.payout > 0 ? `+₹${hand.payout}` : ''}
                     </motion.div>
                   )}
                   
                   {/* Cards */}
                   <div className="relative w-32 h-28 flex justify-center mb-4">
                     {hand.cards.map((c: any, ci: number) => renderCard(c, ci))}
                   </div>
                   
                   {/* Total & Bet Info */}
                   <div className={`bg-black/60 px-3 py-1.5 rounded-full flex gap-3 text-xs font-bold border ${isActive ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-white/10'}`}>
                     <span className="text-white">{getHandTotal(hand.cards)}</span>
                     <div className="w-px bg-white/20" />
                     <span className="text-yellow-400">₹ {hand.bet}</span>
                   </div>
                 </div>
               );
             })}
           </div>
        </div>

      </div>

      {/* Controls Area */}
      <div className="h-24 sm:h-28 bg-black/80 border-t border-white/10 z-20 flex items-center justify-center px-4 backdrop-blur-md">
        
        {(!gameState || gameState.status === 'BETTING' || gameState.status === 'SETTLED') && (
           <div className="flex gap-4 items-center w-full max-w-3xl">
             <div className="flex-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
               {CHIP_VALUES.map(val => (
                 <button 
                   key={val}
                   onClick={() => setSelectedChips(val)}
                   className={`relative w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center border-2 shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-transform ${selectedChips === val ? 'scale-110 -translate-y-2 border-yellow-400 bg-yellow-400/20' : 'border-gray-500 bg-gray-800 opacity-80 hover:opacity-100'}`}
                 >
                    <div className="absolute inset-1 border border-white/20 rounded-full border-dashed" />
                    <span className={`font-black text-xs ${selectedChips === val ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-gray-300'}`}>{val >= 1000 ? `${val/1000}k` : val}</span>
                 </button>
               ))}
             </div>
             <button 
               onClick={placeBet}
               className="bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest px-6 py-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all active:scale-95"
             >
               Deal
             </button>
           </div>
        )}

        {gameState?.status === 'PLAYING' && (
           <div className="flex gap-3 sm:gap-6 justify-center w-full">
             <button onClick={() => handleAction('HIT')} className="flex-1 max-w-[120px] bg-green-600 hover:bg-green-500 text-white font-black uppercase px-2 py-3 rounded-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all text-sm sm:text-base shadow-lg">
               Hit
             </button>
             <button onClick={() => handleAction('STAND')} className="flex-1 max-w-[120px] bg-red-600 hover:bg-red-500 text-white font-black uppercase px-2 py-3 rounded-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all text-sm sm:text-base shadow-lg">
               Stand
             </button>
           </div>
        )}
      </div>

      {/* Win & Loss Animation Overlay */}
      <WinLossCelebration
        status={celebration.status}
        amount={celebration.amount}
        multiplier={celebration.multiplier}
        message={celebration.message}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })}
      />

    </div>
  );
}
