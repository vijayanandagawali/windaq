"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, HelpCircle } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from '@/lib/gameSocket';

export default function RummyGame() {
  const { balance, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);

  const [gameState, setGameState] = useState<any>({
    state: 'WAITING',
    seats: [],
    activePlayerIndex: -1,
    turnPhase: null,
    wildJoker: null,
    openDeckTop: null,
    turnEndTime: 0
  });

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [mySeat, setMySeat] = useState<any>(null);
  
  // Hand Management
  // melds is an array of arrays of strings. Each nested array is a group.
  const [melds, setMelds] = useState<string[][]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  
  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('rm:join', { userId: 'guest' });
    });

    s.on('rm:state', (data: any) => {
      setGameState(data);
      const diff = Math.max(0, Math.floor((data.turnEndTime - Date.now()) / 1000));
      setTimeLeft(diff);
      
      const me = data.seats.find((st: any) => st?.id === 'guest');
      setMySeat(me);
      
      if (me?.cards && me.cards.length > 0) {
        // Only reset melds if it's completely out of sync (e.g. freshly dealt)
        const flatMelds = melds.flat();
        if (flatMelds.length === 0 || flatMelds.length !== me.cards.length) {
           setMelds([me.cards]); // Everything in one group initially
        }
      } else {
        setMelds([]);
      }
    });

    s.on('rm:showdown', (data: any) => {
      setGameState((prev: any) => ({ ...prev, state: 'SHOWDOWN' }));
      
      const amIWinner = data.winnerId === 'guest';
      if (amIWinner) toast.success("You Won!", { icon: '🏆' });
      else toast.error("You Lost!");
      
      setTimeout(() => fetchBalance(), 3000);
    });

    return () => { 
      s.emit('rm:leave', { userId: 'guest' });
      s.disconnect(); 
    };
  }, [fetchBalance]);

  useEffect(() => {
    if (!gameState.turnEndTime) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((gameState.turnEndTime - Date.now()) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.turnEndTime]);

  // Actions
  const draw = (source: 'OPEN' | 'CLOSED') => {
    if (socket) socket.emit('rm:draw', { userId: 'guest', source });
  };

  const discard = () => {
    if (selectedCards.length !== 1) {
      return toast.error("Select exactly 1 card to discard");
    }
    if (socket) socket.emit('rm:discard', { userId: 'guest', card: selectedCards[0] });
    setSelectedCards([]);
  };

  const declare = () => {
    // If they have exactly 14 cards (13 + 1 drawn), they can declare using 13 and discarding the 14th 
    // Wait, the rule engine assumes they discard via the UI, then the remaining 14th card is assumed as the finish card.
    // Our implementation assumes all 14 cards are sent as melds, and the engine validates.
    if (socket) socket.emit('rm:declare', { userId: 'guest', melds });
  };

  const drop = () => {
    if (socket) socket.emit('rm:drop', { userId: 'guest' });
  };

  // UI Handlers
  const toggleSelect = (card: string) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(prev => prev.filter(c => c !== card));
    } else {
      setSelectedCards(prev => [...prev, card]);
    }
  };

  const groupSelected = () => {
    if (selectedCards.length < 2) return toast("Select at least 2 cards to group");
    
    // Remove selected from existing melds
    const newMelds = melds.map(group => group.filter(c => !selectedCards.includes(c))).filter(g => g.length > 0);
    // Add new group
    newMelds.push([...selectedCards]);
    
    setMelds(newMelds);
    setSelectedCards([]);
  };

  const isMyTurn = mySeat && mySeat.seatIndex === gameState.activePlayerIndex;

  const renderCard = (cardStr: string, isWild = false) => {
    if (cardStr === 'JOKER') {
      return (
        <div className={`w-14 h-20 sm:w-16 sm:h-24 bg-white rounded flex items-center justify-center border-2 border-yellow-400 font-bold text-red-600 shadow-md`}>
          🃏
        </div>
      );
    }
    const rank = cardStr[0];
    const suit = cardStr[1];
    const suitColors: Record<string, string> = { 'H': 'text-red-600', 'D': 'text-red-600', 'C': 'text-black', 'S': 'text-black' };
    const suitSymbols: Record<string, string> = { 'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠' };
    const displayRank = rank === 'T' ? '10' : rank;
    
    return (
      <div className={`w-14 h-20 sm:w-16 sm:h-24 bg-white rounded p-1 flex flex-col justify-between border border-gray-300 shadow-sm relative ${isWild ? 'ring-2 ring-yellow-400' : ''}`}>
        <div className={`text-xs sm:text-sm font-bold leading-none ${suitColors[suit]}`}>
          {displayRank}<br/>{suitSymbols[suit]}
        </div>
        <div className={`text-xs sm:text-sm font-bold leading-none rotate-180 self-end ${suitColors[suit]}`}>
          {displayRank}<br/>{suitSymbols[suit]}
        </div>
        {isWild && <div className="absolute top-0 right-1 text-[10px] uppercase text-yellow-600 font-bold">W</div>}
      </div>
    );
  };

  const renderCardBack = () => (
    <div className="w-14 h-20 sm:w-16 sm:h-24 bg-blue-800 rounded border-2 border-white/20 shadow-md bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] flex items-center justify-center">
      <div className="w-8 h-12 border border-white/20 rounded-sm"></div>
    </div>
  );

  return (
    <div className="min-h-[calc(100dvh-58px)] w-full bg-[#1b263b] text-white font-sans selection:bg-yellow-500 flex flex-col relative overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]">


      {/* Table Area */}
      <div className="flex-1 w-full relative flex flex-col items-center justify-center p-4">
        
        {/* Opponents */}
        <div className="absolute top-8 w-full px-4 flex justify-around">
          {gameState.seats.filter((s:any) => s && s.id !== 'guest').map((s:any, i:number) => (
            <div key={i} className={`flex flex-col items-center p-2 rounded-lg bg-black/40 border border-white/10 ${s.seatIndex === gameState.activePlayerIndex ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}`}>
              <div className="font-bold text-xs">{s.name}</div>
              <div className="text-[10px] text-white/50">{s.cardCount} cards</div>
              {s.hasDropped && <div className="text-[10px] text-red-400 font-bold uppercase">Dropped</div>}
              {s.seatIndex === gameState.activePlayerIndex && (
                <div className="mt-1 w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                   <div className="bg-yellow-400 h-full" style={{ width: `${(timeLeft/30)*100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center Table (Piles & Joker) */}
        <div className="bg-green-900/40 border-2 border-green-500/30 w-72 h-40 rounded-full flex items-center justify-center gap-6 relative shadow-[0_0_50px_rgba(0,0,0,0.5)] inset-0 backdrop-blur-sm">
           
           {/* Wild Joker Indicator */}
           {gameState.wildJoker && (
             <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[10px] font-bold text-yellow-400 uppercase bg-black/60 px-2 py-0.5 rounded-full shadow-lg border border-yellow-400/30">Wild Joker</span>
                <div className="scale-75 origin-top mt-1">
                   {renderCard(gameState.wildJoker, true)}
                </div>
             </div>
           )}

           {/* Closed Deck */}
           <div className="flex flex-col items-center">
             <div 
               className={`relative cursor-pointer transition-transform hover:-translate-y-1 ${isMyTurn && gameState.turnPhase === 'DRAW' ? 'ring-4 ring-yellow-400 rounded-lg animate-pulse' : ''}`}
               onClick={() => isMyTurn && gameState.turnPhase === 'DRAW' && draw('CLOSED')}
             >
               {renderCardBack()}
               <div className="absolute top-0.5 right-0.5">{renderCardBack()}</div>
               <div className="absolute top-1 right-1">{renderCardBack()}</div>
             </div>
             <span className="text-[10px] mt-2 font-bold text-white/50">CLOSED</span>
           </div>

           {/* Open Deck */}
           <div className="flex flex-col items-center">
             <div 
               className={`cursor-pointer transition-transform hover:-translate-y-1 ${isMyTurn && gameState.turnPhase === 'DRAW' ? 'ring-4 ring-yellow-400 rounded-lg animate-pulse' : ''}`}
               onClick={() => isMyTurn && gameState.turnPhase === 'DRAW' && draw('OPEN')}
             >
               {gameState.openDeckTop ? renderCard(gameState.openDeckTop, gameState.wildJoker && gameState.wildJoker[0] === gameState.openDeckTop[0]) : <div className="w-14 h-20 sm:w-16 sm:h-24 border-2 border-dashed border-white/20 rounded flex items-center justify-center text-white/20 text-xs text-center">Empty</div>}
             </div>
             <span className="text-[10px] mt-2 font-bold text-white/50">OPEN</span>
           </div>

        </div>

      </div>

      {/* Player Actions & Hand Area */}
      <div className="w-full bg-black/60 border-t border-white/10 p-2 sm:p-4 rounded-t-3xl backdrop-blur-xl relative">
         
         {/* Action Buttons */}
         <div className="flex justify-between items-end mb-4 px-2">
           <button onClick={drop} className="bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
             Drop
           </button>
           
           <div className="flex gap-2">
             <button 
               onClick={groupSelected}
               disabled={selectedCards.length < 2}
               className="bg-blue-900/60 hover:bg-blue-800 text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/30 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
             >
               Group
             </button>

             {isMyTurn && gameState.turnPhase === 'DISCARD' && (
               <button 
                 onClick={discard}
                 className="bg-yellow-500 hover:bg-yellow-400 text-black border border-yellow-600 px-6 py-2 rounded-lg text-sm font-black uppercase tracking-wider shadow-[0_0_15px_rgba(234,179,8,0.4)] animate-bounce"
               >
                 Discard
               </button>
             )}

             {isMyTurn && gameState.turnPhase === 'DISCARD' && (
               <button 
                 onClick={declare}
                 className="bg-green-600 hover:bg-green-500 text-white border border-green-400 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-wider shadow-[0_0_15px_rgba(22,163,7,0.4)]"
               >
                 Declare
               </button>
             )}
           </div>
         </div>

         {/* Hand Display */}
         <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center pb-2">
           {melds.map((group, gIndex) => (
             <div key={gIndex} className="flex bg-white/5 p-1 rounded-xl border border-white/10">
               {group.map((c, i) => {
                 const isSelected = selectedCards.includes(c);
                 return (
                   <motion.div
                     key={`${gIndex}-${i}`}
                     onClick={() => toggleSelect(c)}
                     animate={{ y: isSelected ? -15 : 0 }}
                     className="-ml-4 sm:-ml-6 first:ml-0 cursor-pointer transition-transform hover:-translate-y-2"
                   >
                     {renderCard(c, gameState.wildJoker && gameState.wildJoker[0] === c[0])}
                   </motion.div>
                 );
               })}
             </div>
           ))}
         </div>

      </div>

    </div>
  );
}
