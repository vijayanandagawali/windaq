"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Eye, LogOut, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const BOOT_AMOUNT = 10; // Fixed for MVP display

export default function TeenPattiGame() {
  const { balance } = useWalletStore();
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
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.on('connect', () => {
      // In a real app we'd get this from auth
      setMyId(`guest-${s.id?.substring(0,4)}`);
      s.emit('tp:join');
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
    });

    return () => { 
      s.emit('tp:leave');
      s.disconnect(); 
    };
  }, []);

  const sendAction = (action: string) => {
    if (socket) {
      socket.emit('tp:action', { action }, (res: any) => {
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
    const color = (c.suit === 'H' || c.suit === 'D') ? 'text-red-500' : 'text-black';
    return { str: `${r}${suits[c.suit]}`, color };
  };

  return (
    <main className="h-screen w-full bg-[#0a0f1a] overflow-hidden flex flex-col font-sans selection:bg-neon-mint relative">
      
      {/* Navbar */}
      <header className="flex-none bg-black/40 border-b border-white/5 px-4 py-3 flex items-center justify-between z-20 absolute top-0 w-full">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <div className="text-center">
           <h1 className="text-white font-bold tracking-widest text-sm uppercase">Teen Patti Classic</h1>
           <p className="text-xs text-gray-400">Boot: ₹{BOOT_AMOUNT}</p>
        </div>
        <button className="p-2 rounded-full hover:bg-white/10 text-white">
          <Info size={20}/>
        </button>
      </header>

      {/* Game Table Area */}
      <div className="flex-1 relative w-full h-full pt-16 pb-32 flex items-center justify-center">
        
        {/* Table Felt */}
        <div className="absolute inset-4 sm:inset-10 md:inset-20 bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-950 rounded-[100px] border-[12px] border-[#3f2b1c] shadow-[0_0_50px_rgba(0,0,0,0.8)_inset,0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center">
           <div className="absolute inset-0 rounded-[88px] border-2 border-white/10 m-2 pointer-events-none" />
           <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20 absolute inset-0 rounded-[88px] pointer-events-none mix-blend-overlay" />
           
           {/* Center Pot & Info */}
           <div className="text-center z-10 flex flex-col items-center">
              <div className="bg-black/50 border border-white/10 rounded-full px-6 py-2 mb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-neon-mint animate-pulse" />
                <span className="text-white font-bold text-sm tracking-widest uppercase">{gameState.state}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-1">
                 <div className="w-10 h-10 rounded-full border-4 border-dashed border-yellow-500 bg-yellow-400/20 animate-[spin_10s_linear_infinite]" />
              </div>
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
                
                {/* Cards */}
                {seat.isActive && !seat.isPacked && (
                  <div className="flex -space-x-4 mb-2">
                     {seat.cards && seat.cards.length > 0 ? (
                       // Show Cards
                       seat.cards.map((c: any, idx: number) => {
                         const f = formatCard(c);
                         return (
                           <div key={idx} className={`w-10 h-14 bg-white rounded flex items-center justify-center border border-gray-300 shadow-md transform ${idx === 0 ? '-rotate-12' : idx === 2 ? 'rotate-12' : 'z-10 -translate-y-2'}`}>
                              <span className={`text-lg font-bold ${f.color}`}>{f.str}</span>
                           </div>
                         );
                       })
                     ) : (
                       // Hidden Cards
                       [1,2,3].map((n, idx) => (
                         <div key={idx} className={`w-10 h-14 bg-gradient-to-br from-red-700 to-red-900 rounded border border-white/20 shadow-md transform ${idx === 0 ? '-rotate-12' : idx === 2 ? 'rotate-12' : 'z-10 -translate-y-2'} bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-90`} />
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
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    />
                  )}
                  
                  <div className={`w-16 h-16 rounded-full bg-gray-800 border-2 ${seat.isPacked ? 'border-red-500 opacity-50' : 'border-gray-500'} flex items-center justify-center overflow-hidden z-10 relative bg-cover bg-center`} style={{ backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${seat.id})` }}>
                    {seat.isPacked && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-white text-xs font-bold rotate-[-45deg]">PACKED</span></div>}
                  </div>
                  
                  {/* Status Badges */}
                  {!seat.isPacked && seat.isActive && (
                    <div className="absolute -bottom-2 -right-2 bg-black border border-white/20 rounded px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                      {seat.isSeen ? <span className="text-blue-400">Seen</span> : <span className="text-gray-400">Blind</span>}
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="mt-2 bg-black/80 px-3 py-1 rounded-full border border-white/10 text-center">
                  <div className="text-xs text-white font-bold truncate max-w-[80px]">{seat.name} {seat.id === myId && '(You)'}</div>
                  <div className="text-[10px] text-yellow-400 font-bold">₹{Number(seat.balance)/100}</div>
                </div>
             </div>
           );
        })}

        {/* Showdown Overlay */}
        <AnimatePresence>
          {showdownResult && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
            >
               <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 text-black px-8 py-4 rounded-3xl font-black text-2xl uppercase tracking-widest shadow-[0_0_50px_rgba(234,179,8,0.5)] border-2 border-yellow-200">
                  Winner: {showdownResult.winnerId === myId ? 'YOU WON!' : showdownResult.winningHandDesc}
               </div>
               <div className="mt-4 text-white text-xl font-bold bg-black/50 px-6 py-2 rounded-full border border-white/10">
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

    </main>
  );
}
