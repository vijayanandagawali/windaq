"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Eye, LogOut, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from '@/lib/gameSocket';

import confetti from 'canvas-confetti';

const BOOT_AMOUNT = 10; // Fixed for MVP display

export default function TeenPattiGame() {
  const { balance, userId, fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string>('');

  // Game State
  const [gameState, setGameState] = useState<any>({
    state: 'WAITING',
    pot: '0',
    currentStake: '10',
    activePlayerIndex: -1,
    turnEndTime: 0,
    seats: Array(6).fill(null)
  });

  const [showdownResult, setShowdownResult] = useState<any>(null);

  // Init Socket
  useEffect(() => {
    const activeId = userId || (typeof window !== 'undefined' ? (localStorage.getItem('windaq_user_id') || 'guest') : 'guest');
    setMyId(activeId);

    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('connect', () => {
      s.emit('tp:join', { userId: activeId });
    });

    s.on('tp:state', (data: any) => {
      setGameState(data);
      if (data.state !== 'SHOWDOWN') {
        setShowdownResult(null); // Clear previous showdown when new hand starts
      }
    });

    s.on('tp:showdown', (data: any) => {
      setShowdownResult(data);
      toast(`Winner: ${data.winningHandDesc}`, { icon: '🏆' });
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
      fetchBalance();
    });

    return () => { 
      s.emit('tp:leave', { userId: activeId });
      s.disconnect(); 
    };
  }, [userId, fetchBalance]);

  const sendAction = (action: string) => {
    if (socket) {
      socket.emit('tp:action', { action, userId: myId }, (res: any) => {
        if (!res.success) toast.error(res.message);
      });
    }
  };

  const mySeat = gameState.seats.find((s: any) => s && s.id === myId);
  const isMyTurn = mySeat && mySeat.seatIndex === gameState.activePlayerIndex;

  // Seat positioning mapping for 6 players (oval layout)
  const getSeatClass = (index: number) => {
    const positions = [
      "bottom-4 left-1/2 -translate-x-1/2", // 0 (Me/Bottom)
      "bottom-20 left-4",                   // 1 (Bottom Left)
      "top-20 left-4",                      // 2 (Top Left)
      "top-4 left-1/2 -translate-x-1/2",    // 3 (Top)
      "top-20 right-4",                     // 4 (Top Right)
      "bottom-20 right-4",                  // 5 (Bottom Right)
    ];
    return positions[index];
  };

  const formatCard = (c: any) => {
    const suits: any = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
    const ranks: any = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J' };
    const r = ranks[c.rank] || c.rank;
    const color = (c.suit === 'H' || c.suit === 'D') ? 'text-red-600' : 'text-zinc-900';
    return { str: `${r}${suits[c.suit]}`, color };
  };

  return (
    <div className="h-[calc(100dvh-58px)] w-full bg-[#0a0f1a] overflow-hidden flex flex-col font-sans selection:bg-neon-mint relative">


      {/* Game Table Area */}
      <div className="flex-1 relative w-full h-full pt-16 pb-32 flex items-center justify-center">
        
        {/* Table Felt */}
        <div className="absolute inset-4 sm:inset-10 md:inset-20 bg-gradient-to-br from-blue-900 via-indigo-950 to-[#0c1222] rounded-[100px] border-[12px] border-[#3f2b1c] shadow-[0_0_60px_rgba(0,0,0,0.9)_inset,0_20px_50px_rgba(0,0,0,0.6)] flex items-center justify-center">
           <div className="absolute inset-0 rounded-[88px] border-2 border-white/10 m-2 pointer-events-none" />
           <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20 absolute inset-0 rounded-[88px] pointer-events-none mix-blend-overlay" />
           
           {/* Virtual Dealer Shoe at top */}
           <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
              <div className="w-16 h-7 bg-gradient-to-b from-yellow-950 to-yellow-900 border border-yellow-600/40 rounded-b-lg shadow-lg flex items-center justify-center">
                <span className="text-[9px] font-bold text-yellow-300 tracking-wider">DEALER</span>
              </div>
           </div>

           {/* Center Pot & Info */}
           <div className="text-center z-10 flex flex-col items-center">
              <div className="bg-black/60 border border-white/10 rounded-full px-6 py-2 mb-2 flex items-center gap-2 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-neon-mint animate-pulse" />
                <span className="text-white font-bold text-sm tracking-widest uppercase">{gameState.state}</span>
              </div>
              
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center justify-center gap-2 mb-1"
              >
                 <div className="w-10 h-10 rounded-full border-4 border-dashed border-yellow-500 bg-yellow-400/20 animate-[spin_8s_linear_infinite]" />
              </motion.div>
              <div className="text-3xl font-black text-yellow-400 drop-shadow-md">₹{Number(gameState.pot) / 100}</div>
              <div className="text-xs text-gray-300 font-bold uppercase tracking-wider mt-1">Total Pot</div>
           </div>
        </div>

        {/* Players */}
        {gameState.seats.map((seat: any, i: number) => {
           if (!seat) return null;
           
           const isActiveTurn = gameState.activePlayerIndex === seat.seatIndex;
           
           return (
             <div key={i} className={`absolute ${getSeatClass(i)} flex flex-col items-center transition-all z-20`}>
                
                {/* Cards with 3D Flip */}
                {seat.isActive && !seat.isPacked && (
                  <div className="flex -space-x-4 mb-2">
                     {seat.cards && seat.cards.length > 0 ? (
                       // 3D Revealed Cards
                       seat.cards.map((c: any, idx: number) => {
                         const f = formatCard(c);
                         return (
                           <motion.div 
                             key={idx} 
                             initial={{ scale: 0, rotateY: 180, y: -20 }}
                             animate={{ scale: 1, rotateY: 0, y: 0 }}
                             transition={{ duration: 0.35, delay: idx * 0.1 }}
                             className={`w-11 h-16 bg-gradient-to-b from-white to-zinc-100 rounded-lg flex items-center justify-center border border-gray-300 shadow-xl transform ${idx === 0 ? '-rotate-12' : idx === 2 ? 'rotate-12' : 'z-10 -translate-y-2'}`}
                           >
                              <span className={`text-base font-black ${f.color}`}>{f.str}</span>
                           </motion.div>
                         );
                       })
                     ) : (
                       // Hidden Facedown Cards
                       [1,2,3].map((n, idx) => (
                         <div key={idx} className={`w-11 h-16 bg-gradient-to-br from-red-800 to-red-950 rounded-lg border border-white/20 shadow-lg transform ${idx === 0 ? '-rotate-12' : idx === 2 ? 'rotate-12' : 'z-10 -translate-y-2'} bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-90`} />
                       ))
                     )}
                  </div>
                )}

                {/* Avatar / Frame */}
                <div className="relative">
                  {isActiveTurn && (
                    <motion.div 
                      className="absolute -inset-2 rounded-full border-4 border-neon-mint"
                      layoutId="turnIndicator"
                      initial={false}
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    />
                  )}
                  
                  <div className={`w-16 h-16 rounded-full bg-gray-800 border-2 ${seat.isPacked ? 'border-red-500 opacity-50' : 'border-gray-500'} flex items-center justify-center overflow-hidden z-10 relative bg-cover bg-center shadow-lg`} style={{ backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${seat.id})` }}>
                    {seat.isPacked && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white text-xs font-bold rotate-[-45deg]">PACKED</span></div>}
                  </div>
                  
                  {/* Status Badges */}
                  {!seat.isPacked && seat.isActive && (
                    <div className="absolute -bottom-2 -right-2 bg-black border border-white/20 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white uppercase shadow">
                      {seat.isSeen ? <span className="text-blue-400">Seen</span> : <span className="text-gray-400">Blind</span>}
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="mt-2 bg-black/80 px-3 py-1 rounded-full border border-white/10 text-center backdrop-blur-sm">
                  <div className="text-xs text-white font-bold truncate max-w-[80px]">{seat.name} {seat.id === myId && '(You)'}</div>
                  <div className="text-[10px] text-yellow-400 font-bold">₹{Number(seat.balance)/100}</div>
                </div>
             </div>
           );
        })}

        {/* Showdown Overlay with Winner Glow */}
        <AnimatePresence>
          {showdownResult && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none"
            >
               <motion.div 
                 animate={{ scale: [1, 1.05, 1] }}
                 transition={{ duration: 1.5, repeat: Infinity }}
                 className="bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 text-black px-8 py-4 rounded-3xl font-black text-2xl uppercase tracking-widest shadow-[0_0_60px_rgba(234,179,8,0.8)] border-2 border-white"
               >
                  🏆 Winner: {showdownResult.winnerId === myId ? 'YOU WON!' : showdownResult.winningHandDesc}
               </motion.div>
               <div className="mt-4 text-white text-xl font-bold bg-black/60 px-6 py-2 rounded-full border border-white/20">
                 Pot Awarded: ₹{Number(showdownResult.pot)/100}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Action Controls (Bottom Dock) */}
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/90 to-transparent p-4 pb-8 z-30">
        <div className="max-w-2xl mx-auto">
          
          {/* Messages */}
          <div className="text-center mb-4 min-h-[24px]">
             {gameState.state === 'WAITING' && <span className="text-gray-400 animate-pulse">Waiting for players to join...</span>}
             {gameState.state === 'PLAYING' && !isMyTurn && <span className="text-gray-400">Waiting for other players...</span>}
             {gameState.state === 'PLAYING' && isMyTurn && <span className="text-neon-mint font-bold animate-pulse">YOUR TURN! Make a move.</span>}
          </div>

          <div className="flex gap-2 justify-center">
             
             {/* Not Playing / Spectating */}
             {!mySeat && (
               <div className="text-white bg-black/50 px-6 py-3 rounded-full border border-white/10">
                 Spectating...
               </div>
             )}

             {/* Playing & Active Controls */}
             {mySeat && mySeat.isActive && !mySeat.isPacked && gameState.state === 'PLAYING' && (
               <>
                 <button 
                   onClick={() => sendAction('pack')}
                   disabled={!isMyTurn}
                   className="flex-1 max-w-[120px] bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:grayscale text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors"
                 >
                   PACK
                 </button>
                 
                 {!mySeat.isSeen && (
                   <button 
                     onClick={() => sendAction('see')}
                     className="flex-1 max-w-[120px] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-1"
                   >
                     <Eye size={18} /> SEE
                   </button>
                 )}

                 <button 
                   onClick={() => sendAction('chaal')}
                   disabled={!isMyTurn}
                   className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:to-yellow-300 disabled:opacity-50 disabled:grayscale text-black font-black uppercase py-3 px-4 rounded-xl shadow-lg transition-colors border border-yellow-200"
                 >
                   {mySeat.isSeen ? 'CHAAL' : 'BLIND'} (₹{mySeat.isSeen ? Number(gameState.currentStake)*2/100 : Number(gameState.currentStake)/100})
                 </button>

                 <button 
                   onClick={() => sendAction('show')}
                   disabled={!isMyTurn}
                   className="flex-1 max-w-[120px] bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:grayscale text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors"
                 >
                   SHOW
                 </button>
               </>
             )}
          </div>
        </div>
      </div>

    </div>
  );
}
