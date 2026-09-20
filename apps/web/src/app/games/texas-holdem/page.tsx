"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Settings, MessageSquare, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '@/store/walletStore';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function PokerTable() {
  const { balance } = useWalletStore();
  const [tableState, setTableState] = useState<any>(null);
  const [mySeat, setMySeat] = useState(-1);
  const [actionAmount, setActionAmount] = useState(20); // big blind

  useEffect(() => {
    socket.emit('poker_join', { tableId: 'high-roller-1', seatIndex: 0 });

    socket.on('poker_state', (state) => {
      setTableState(state);
      // find my seat
      const idx = state.seats.findIndex((s: any) => s && s.name === 'Player');
      setMySeat(idx);
    });

    return () => {
      socket.off('poker_state');
    };
  }, []);

  const handleAction = (action: string) => {
    socket.emit('poker_action', { tableId: 'high-roller-1', action, amount: action === 'raise' ? actionAmount : 0 });
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
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">Blinds 10/20 • High Roller</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
            <Info size={16} />
          </button>
          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
            <Settings size={16} />
          </button>
          <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors">
            <MessageSquare size={16} />
          </button>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 relative flex items-center justify-center p-4">
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-deep-ocean via-black to-black opacity-80" />

        {/* The Felt */}
        <div className="relative w-full max-w-4xl aspect-[2/1] bg-[#004d40] rounded-[100px] shadow-[inset_0_0_50px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.5)] border-8 border-[#2e1d0f] flex items-center justify-center">
          
          {/* Inner ring */}
          <div className="absolute w-[90%] h-[80%] rounded-[80px] border border-white/10" />

          {/* Logo */}
          <div className="absolute opacity-20 flex flex-col items-center">
             <span className="text-2xl font-black tracking-widest text-white uppercase italic">WinDaq</span>
             <span className="text-xs font-bold tracking-[0.2em] text-neon-mint uppercase">Poker</span>
          </div>

          {/* Community Cards Area */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="bg-black/40 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
              <span className="text-white font-bold text-sm tracking-widest">POT: <span className="text-neon-mint">₹{tableState?.pot || 0}</span></span>
            </div>
            
            <div className="flex gap-2">
              <AnimatePresence>
                {tableState?.communityCards?.map((card: string, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0, x: -50 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    className="w-12 h-16 md:w-16 md:h-24 bg-white rounded-md shadow-xl flex items-center justify-center border border-gray-200"
                  >
                    <span className={`text-xl md:text-3xl font-bold ${['h', 'd'].includes(card[1]) ? 'text-red-600' : 'text-black'}`}>
                      {card[0].replace('T', '10')}
                      {card[1] === 'h' ? '♥' : card[1] === 'd' ? '♦' : card[1] === 's' ? '♠' : '♣'}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Seats (Simplified for layout) */}
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isMe = index === mySeat;
            const player = tableState?.seats?.[index];
            
            // Positioning math for oval
            const positions = [
              "bottom-[-30px] left-1/2 -translate-x-1/2", // 0 (Me)
              "bottom-4 left-4", // 1
              "top-4 left-4", // 2
              "top-[-30px] left-1/2 -translate-x-1/2", // 3
              "top-4 right-4", // 4
              "bottom-4 right-4", // 5
            ];

            return (
              <div key={index} className={`absolute ${positions[index]} flex flex-col items-center`}>
                {player ? (
                  <>
                    {/* Hole Cards */}
                    <div className="flex gap-1 mb-2">
                      <div className="w-8 h-12 bg-white rounded shadow-md border border-gray-300" />
                      <div className="w-8 h-12 bg-white rounded shadow-md border border-gray-300 rotate-[10deg] -ml-4" />
                    </div>
                    {/* Avatar Info */}
                    <div className={`bg-[#050814] px-4 py-2 rounded-xl border ${isMe ? 'border-neon-mint shadow-[0_0_15px_rgba(0,255,163,0.3)]' : 'border-white/10'} flex flex-col items-center min-w-[100px]`}>
                      <span className="text-white font-bold text-xs truncate w-full text-center">{player.name}</span>
                      <span className="text-neon-mint font-mono text-[10px]">₹{player.balance || 0}</span>
                    </div>
                  </>
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center opacity-50">
                    <span className="text-white/30 text-xs">Seat</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Panel */}
      <div className="flex-none bg-[#050814] border-t border-white/10 p-4 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
        <div className="max-w-4xl mx-auto">
          {/* Quick Bets */}
          <div className="flex justify-end gap-2 mb-4">
             <button onClick={() => setActionAmount(Math.floor((tableState?.pot || 0)/2))} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded border border-white/10 transition-colors">1/2 Pot</button>
             <button onClick={() => setActionAmount(tableState?.pot || 0)} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded border border-white/10 transition-colors">Pot</button>
             <button onClick={() => setActionAmount(balance)} className="px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded border border-white/10 transition-colors">All-in</button>
          </div>
          
          {/* Main Actions */}
          <div className="flex justify-between gap-4">
            <button onClick={() => handleAction('fold')} className="flex-1 py-4 rounded-xl bg-red-500/20 text-red-500 border border-red-500/30 font-black tracking-widest hover:bg-red-500/30 transition-all uppercase">
              Fold
            </button>
            <button onClick={() => handleAction('check')} className="flex-1 py-4 rounded-xl bg-white/5 text-white border border-white/10 font-black tracking-widest hover:bg-white/10 transition-all uppercase">
              Check / Call
            </button>
            <div className="flex-1 flex gap-2">
              <input 
                type="number" 
                value={actionAmount} 
                onChange={(e) => setActionAmount(Number(e.target.value))}
                className="w-20 bg-black border border-white/20 rounded-xl text-center text-white font-mono font-bold focus:border-neon-mint outline-none" 
              />
              <button onClick={() => handleAction('raise')} className="flex-1 py-4 rounded-xl bg-neon-mint text-deep-ocean font-black tracking-widest shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:scale-[1.02] transition-all uppercase">
                Raise
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
