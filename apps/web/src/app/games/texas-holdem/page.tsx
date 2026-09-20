"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Settings, MessageSquare, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '@/store/walletStore';
import io from 'socket.io-client';

import confetti from 'canvas-confetti';

const socket = io('http://localhost:4000');

export default function PokerTable() {
  const { balance } = useWalletStore();
  const [tableState, setTableState] = useState<any>(null);
  const [mySeat, setMySeat] = useState(-1);
  const [actionAmount, setActionAmount] = useState(20); // big blind
  const [winnerInfo, setWinnerInfo] = useState<any>(null);

  useEffect(() => {
    socket.emit('poker_join', { tableId: 'high-roller-1', seatIndex: 0 });

    socket.on('poker_state', (state) => {
      setTableState(state);
      // find my seat
      const idx = state.seats.findIndex((s: any) => s && (s.name === 'Player' || s.id === 'guest' || s.id === 'sbx-usr-normal-001'));
      setMySeat(idx >= 0 ? idx : 0);

      if (state.phase === 'SHOWDOWN' && state.winner) {
        setWinnerInfo(state.winner);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
      } else {
        setWinnerInfo(null);
      }
    });

    return () => {
      socket.off('poker_state');
    };
  }, []);

  const handleAction = (action: string) => {
    socket.emit('poker_action', { tableId: 'high-roller-1', action, amount: action === 'raise' ? actionAmount : 0 });
  };

  const formatCard = (card: string) => {
    if (!card || card.length < 2) return { rank: '?', suit: '♠', isRed: false };
    const r = card[0].replace('T', '10');
    const s = card[1] === 'h' ? '♥' : card[1] === 'd' ? '♦' : card[1] === 's' ? '♠' : '♣';
    return { rank: r, suit: s, isRed: ['h', 'd'].includes(card[1]) };
  };

  return (
    <main className="min-h-screen bg-black font-sans selection:bg-neon-mint flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-deep-ocean/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ChevronLeft size={24} className="text-white" />
          </Link>
          <div>
            <h1 className="text-white font-black tracking-widest text-sm uppercase">Texas Hold'em</h1>
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Blinds 10/20 • High Roller Table</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-neon-mint/10 border border-neon-mint/30 px-3 py-1 rounded-full text-neon-mint text-xs font-mono font-bold">
            ₹{balance.toFixed(2)}
          </div>
          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
            <Info size={16} />
          </button>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Background Ambient Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/40 via-black to-black opacity-90" />

        {/* The Felt Table */}
        <div className="relative w-full max-w-4xl aspect-[2/1] bg-gradient-to-br from-[#004d40] via-[#003d33] to-[#00251f] rounded-[110px] shadow-[inset_0_0_60px_rgba(0,0,0,0.85),0_25px_60px_rgba(0,0,0,0.7)] border-[10px] border-[#3e2723] flex items-center justify-center">
          
          {/* Inner ring */}
          <div className="absolute w-[92%] h-[82%] rounded-[90px] border border-white/10 pointer-events-none" />

          {/* Dealer Shoe (Top Center) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
            <div className="w-14 h-8 bg-gradient-to-b from-amber-950 to-amber-900 rounded-b-lg border border-amber-700/50 shadow-md flex items-center justify-center">
              <span className="text-[9px] font-bold text-amber-300/70 tracking-widest uppercase">DEALER</span>
            </div>
          </div>

          {/* Watermark Logo */}
          <div className="absolute opacity-15 flex flex-col items-center pointer-events-none">
             <span className="text-3xl font-black tracking-widest text-white uppercase italic">WinDaq</span>
             <span className="text-xs font-bold tracking-[0.25em] text-neon-mint uppercase">VIP Poker Room</span>
          </div>

          {/* Central Pot & Community Cards */}
          <div className="relative z-10 flex flex-col items-center gap-3">
            {/* Animated Pot */}
            <motion.div 
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="bg-black/60 px-5 py-1.5 rounded-full border border-yellow-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center gap-2"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" />
              <span className="text-white font-bold text-xs tracking-widest">
                POT: <span className="text-yellow-400 font-black text-sm">₹{tableState?.pot || 0}</span>
              </span>
            </motion.div>
            
            {/* Community Cards with 3D Flip */}
            <div className="flex gap-2">
              <AnimatePresence>
                {tableState?.communityCards?.map((card: string, i: number) => {
                  const c = formatCard(card);
                  return (
                    <motion.div
                      key={`${card}-${i}`}
                      initial={{ scale: 0, rotateY: 180, y: -40, opacity: 0 }}
                      animate={{ scale: 1, rotateY: 0, y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.15, type: 'spring', stiffness: 200, damping: 18 }}
                      className="w-12 h-16 md:w-16 md:h-24 bg-gradient-to-b from-white to-gray-100 rounded-lg shadow-2xl flex flex-col justify-between p-1.5 border border-gray-300 select-none"
                    >
                      <div className="flex items-center justify-between leading-none">
                        <span className={`text-xs md:text-sm font-black ${c.isRed ? 'text-red-600' : 'text-zinc-900'}`}>{c.rank}</span>
                        <span className={`text-xs md:text-sm ${c.isRed ? 'text-red-600' : 'text-zinc-900'}`}>{c.suit}</span>
                      </div>
                      <div className={`text-xl md:text-3xl self-center font-bold ${c.isRed ? 'text-red-600' : 'text-zinc-900'}`}>
                        {c.suit}
                      </div>
                      <div className="flex items-center justify-between leading-none rotate-180">
                        <span className={`text-xs md:text-sm font-black ${c.isRed ? 'text-red-600' : 'text-zinc-900'}`}>{c.rank}</span>
                        <span className={`text-xs md:text-sm ${c.isRed ? 'text-red-600' : 'text-zinc-900'}`}>{c.suit}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Seats (6-Max Oval) */}
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isMe = index === mySeat;
            const player = tableState?.seats?.[index];
            const isTurn = tableState?.currentTurn === index;
            
            // Positioning math for oval
            const positions = [
              "bottom-[-24px] left-1/2 -translate-x-1/2", // 0 (Me)
              "bottom-4 left-6", // 1
              "top-6 left-6", // 2
              "top-[-24px] left-1/2 -translate-x-1/2", // 3
              "top-6 right-6", // 4
              "bottom-4 right-6", // 5
            ];

            return (
              <div key={index} className={`absolute ${positions[index]} flex flex-col items-center z-20`}>
                {player ? (
                  <>
                    {/* Hole Cards */}
                    <div className="flex gap-1 mb-1.5">
                      {isMe && player.cards && player.cards.length >= 2 ? (
                        player.cards.map((cStr: string, cIdx: number) => {
                          const fc = formatCard(cStr);
                          return (
                            <motion.div 
                              key={cIdx}
                              initial={{ scale: 0, rotateY: 180 }}
                              animate={{ scale: 1, rotateY: 0 }}
                              className={`w-9 h-14 md:w-11 md:h-16 bg-white rounded-md shadow-lg border border-gray-300 p-1 flex flex-col justify-between ${cIdx === 1 ? 'rotate-[8deg] -ml-4' : '-rotate-[4deg]'}`}
                            >
                              <span className={`text-[10px] md:text-xs font-black leading-none ${fc.isRed ? 'text-red-600' : 'text-zinc-900'}`}>{fc.rank}{fc.suit}</span>
                              <span className={`text-lg md:text-xl self-center leading-none ${fc.isRed ? 'text-red-600' : 'text-zinc-900'}`}>{fc.suit}</span>
                            </motion.div>
                          );
                        })
                      ) : (
                        // Facedown cards
                        <>
                          <div className="w-8 h-12 bg-gradient-to-br from-red-800 to-red-950 rounded-md shadow-md border border-white/20 -rotate-[6deg]" />
                          <div className="w-8 h-12 bg-gradient-to-br from-red-800 to-red-950 rounded-md shadow-md border border-white/20 rotate-[10deg] -ml-4" />
                        </>
                      )}
                    </div>

                    {/* Avatar Info Box with Turn Indicator */}
                    <div className="relative">
                      {isTurn && (
                        <motion.div 
                          className="absolute -inset-1 rounded-2xl border-2 border-neon-mint"
                          animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                      )}
                      
                      <div className={`bg-[#050814]/95 px-3 py-1.5 rounded-xl border ${isMe ? 'border-neon-mint/80 shadow-[0_0_15px_rgba(0,255,163,0.3)]' : isTurn ? 'border-amber-400' : 'border-white/10'} flex flex-col items-center min-w-[90px] backdrop-blur-md`}>
                        <span className="text-white font-bold text-xs truncate max-w-[90px] text-center">
                          {player.name} {isMe && '(You)'}
                        </span>
                        <span className="text-yellow-400 font-mono text-[10px] font-bold">
                          ₹{player.balance || player.chips || 0}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center opacity-40">
                    <span className="text-white/40 text-[10px] font-bold">OPEN</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Showdown Winner Fanfare Banner */}
          <AnimatePresence>
            {winnerInfo && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs rounded-[100px] pointer-events-none"
              >
                <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black px-8 py-3 rounded-2xl font-black text-xl tracking-widest shadow-[0_0_40px_rgba(234,179,8,0.8)] border-2 border-white">
                  WINNER: {winnerInfo.name || 'HIGH ROLLER'}
                </div>
                <div className="mt-2 text-white font-bold text-sm bg-black/70 px-4 py-1 rounded-full border border-white/20">
                  {winnerInfo.handDesc || 'POT WON!'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Action Panel */}
      <div className="flex-none bg-[#050814] border-t border-white/10 p-4 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
        <div className="max-w-4xl mx-auto">
          {/* Quick Bets */}
          <div className="flex justify-end gap-2 mb-3">
             <button onClick={() => setActionAmount(Math.max(20, Math.floor((tableState?.pot || 0)/2)))} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg border border-white/10 transition-colors">1/2 Pot</button>
             <button onClick={() => setActionAmount(Math.max(20, tableState?.pot || 0))} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg border border-white/10 transition-colors">Pot</button>
             <button onClick={() => setActionAmount(Math.max(20, balance))} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-lg border border-white/10 transition-colors">All-in</button>
          </div>
          
          {/* Main Actions */}
          <div className="flex justify-between gap-3">
            <button onClick={() => handleAction('fold')} className="flex-1 py-3.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 font-black tracking-widest hover:bg-red-500/30 transition-all uppercase text-sm">
              Fold
            </button>
            <button onClick={() => handleAction('check')} className="flex-1 py-3.5 rounded-xl bg-white/10 text-white border border-white/20 font-black tracking-widest hover:bg-white/20 transition-all uppercase text-sm">
              Check / Call
            </button>
            <div className="flex-1 flex gap-2">
              <input 
                type="number" 
                value={actionAmount} 
                onChange={(e) => setActionAmount(Number(e.target.value))}
                className="w-20 bg-black border border-white/20 rounded-xl text-center text-white font-mono font-bold focus:border-neon-mint outline-none text-sm" 
              />
              <button onClick={() => handleAction('raise')} className="flex-1 py-3.5 rounded-xl bg-neon-mint text-deep-ocean font-black tracking-widest shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase text-sm">
                Raise
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
