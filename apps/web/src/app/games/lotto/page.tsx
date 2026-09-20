"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, RefreshCw, Ticket, Clock, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const TICKET_PRICE = 100;

export default function LottoGame() {
  const { balance, deductBalance, setBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [myTickets, setMyTickets] = useState<{ id: string, numbers: number[] }[]>([]);
  
  // Realtime state
  const [status, setStatus] = useState<string>('OPEN');
  const [lockTime, setLockTime] = useState<number>(Date.now() + 60000);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [winningNumbers, setWinningNumbers] = useState<number[]>([]);
  
  const [buying, setBuying] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // Init Socket
  useEffect(() => {
    const s = io('http://localhost:4000', { auth: { token: null } });
    setSocket(s);
    
    s.emit('lotto:join', { room: '5min' });
    s.emit('lotto:history', { room: '5min' }, (res: any) => {
      if (res.success) setHistory(res.data);
    });

    s.on('lotto:tick', (data: any) => {
      setStatus(data.status);
      setLockTime(data.lockTime);
      const remaining = Math.max(0, Math.floor((data.lockTime - data.now) / 1000));
      setTimeRemaining(remaining);
      
      // Clear previous winning numbers if we are starting a new round
      if (data.status === 'OPEN' && winningNumbers.length > 0) {
        setWinningNumbers([]);
        setMyTickets([]);
      }
    });

    s.on('lotto:locked', () => {
      setStatus('LOCKED');
      toast("Draw is locked! Numbers will be drawn soon.", { icon: '🔒' });
    });

    s.on('lotto:result', (data: any) => {
      setStatus('RESULT');
      setWinningNumbers(data.winningNumbers);
      
      // Fetch new balance after a slight delay to allow settlement to finish
      setTimeout(() => {
        // We could emit a balance refresh here or assume the next socket tick has it if we tracked user state,
        // but for this UI we'll just check if any of our tickets won.
        checkWin(data.winningNumbers);
        
        // Refresh history
        s.emit('lotto:history', { room: '5min' }, (res: any) => {
          if (res.success) setHistory(res.data);
        });
      }, 1000);
    });

    return () => { 
      s.emit('lotto:leave');
      s.disconnect(); 
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (status !== 'OPEN') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((lockTime - Date.now()) / 1000));
      setTimeRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockTime, status]);

  const checkWin = useCallback((drawnNums: number[]) => {
    let maxMatch = 0;
    myTickets.forEach(ticket => {
      const matches = ticket.numbers.filter(n => drawnNums.includes(n)).length;
      if (matches > maxMatch) maxMatch = matches;
    });

    if (maxMatch >= 3) {
      toast.success(`You matched ${maxMatch} numbers!`, { icon: '🎉', duration: 5000 });
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } else if (myTickets.length > 0) {
      toast.error('No matching tickets this round. Better luck next time!', { duration: 3000 });
    }
  }, [myTickets]);

  const handleSelect = (num: number) => {
    if (status !== 'OPEN') return;
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
    } else if (selectedNumbers.length < 6) {
      setSelectedNumbers(prev => [...prev, num].sort((a, b) => a - b));
    }
  };

  const quickPick = () => {
    if (status !== 'OPEN') return;
    const pool = Array.from({length: 49}, (_, i) => i + 1);
    const pick = [];
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      pick.push(pool[idx]);
      pool.splice(idx, 1);
    }
    setSelectedNumbers(pick.sort((a, b) => a - b));
  };

  const handleBuy = () => {
    if (selectedNumbers.length !== 6) return toast.error("Select exactly 6 numbers.");
    if (balance < TICKET_PRICE) return toast.error("Insufficient balance!");
    if (!socket || status !== 'OPEN') return;

    setBuying(true);
    deductBalance(TICKET_PRICE);

    socket.emit('lotto:buy', { userId: 'guest', room: '5min', numbers: selectedNumbers }, (res: any) => {
      setBuying(false);
      if (res.success) {
        toast.success("Ticket Purchased!", { icon: '🎫' });
        setMyTickets(prev => [...prev, { id: res.data.ticketId, numbers: res.data.numbers }]);
        setBalance(Number(res.data.newBalance) / 100);
        setSelectedNumbers([]); // reset selection
      } else {
        toast.error(res.message);
        setBalance(balance); // Revert
      }
    });
  };

  // Format time (MM:SS)
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a] font-sans selection:bg-neon-mint flex flex-col pb-safe">
      <header className="flex-none bg-black/40 border-b border-white/5 px-4 py-3 flex items-center justify-between z-20">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">Quick Draw 6/49</h1>
        <button className="p-2 rounded-full hover:bg-white/10 text-white">
          <Info size={20}/>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto flex flex-col relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0a0f1a] to-[#0a0f1a] pointer-events-none" />

        {/* Top Info Panel */}
        <div className="bg-black/60 border-b border-white/10 px-4 py-6 z-10 flex flex-col items-center">
           <div className="text-cyan-400 font-bold tracking-widest text-xs uppercase mb-2">Next Draw In</div>
           
           {status === 'OPEN' ? (
             <div className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] font-mono">
               {formatTime(timeRemaining)}
             </div>
           ) : (
             <div className="text-3xl md:text-4xl font-black text-yellow-400 tracking-widest animate-pulse">
               {status === 'LOCKED' ? 'DRAWING SOON...' : 'DRAWING NOW!'}
             </div>
           )}

           {/* Drawn Numbers Display */}
           <div className="mt-6 flex gap-2 h-16 items-center justify-center">
             <AnimatePresence>
               {winningNumbers.map((num, idx) => (
                 <motion.div 
                   key={idx}
                   initial={{ scale: 0, opacity: 0, y: -20 }}
                   animate={{ scale: 1, opacity: 1, y: 0 }}
                   transition={{ delay: idx * 0.5, type: 'spring' }}
                   className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.5)] border-2 border-white"
                 >
                   <span className="text-black font-black text-xl md:text-2xl">{num}</span>
                 </motion.div>
               ))}
               {winningNumbers.length === 0 && status === 'RESULT' && (
                 <span className="text-gray-400 animate-pulse">Selecting numbers...</span>
               )}
             </AnimatePresence>
           </div>
        </div>

        <div className="flex-1 p-4 max-w-4xl mx-auto w-full flex flex-col lg:flex-row gap-8 z-10">
          
          {/* Main Grid */}
          <div className="flex-1">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-white font-bold text-lg">Pick 6 Numbers</h2>
               <button 
                 onClick={quickPick}
                 disabled={status !== 'OPEN'}
                 className="flex items-center gap-1 text-neon-mint hover:text-white transition-colors disabled:opacity-50"
               >
                 <RefreshCw size={16} /> <span className="text-sm font-bold uppercase tracking-wider">Quick Pick</span>
               </button>
             </div>

             <div className="grid grid-cols-7 gap-2 md:gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                {Array.from({length: 49}, (_, i) => i + 1).map(num => {
                  const isSelected = selectedNumbers.includes(num);
                  return (
                    <button
                      key={num}
                      onClick={() => handleSelect(num)}
                      disabled={status !== 'OPEN' || (!isSelected && selectedNumbers.length >= 6)}
                      className={`
                        aspect-square rounded-full flex items-center justify-center font-bold text-sm md:text-base transition-all
                        ${isSelected 
                          ? 'bg-neon-mint text-black shadow-[0_0_15px_rgba(45,212,191,0.6)] scale-110' 
                          : 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10'
                        }
                      `}
                    >
                      {num}
                    </button>
                  );
                })}
             </div>

             <div className="mt-6 flex flex-col md:flex-row items-center justify-between bg-black/50 p-4 rounded-xl border border-white/10">
                <div className="flex flex-col mb-4 md:mb-0 text-center md:text-left">
                   <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Ticket Price</span>
                   <span className="text-white font-black text-2xl">₹{TICKET_PRICE}</span>
                </div>
                
                <div className="flex gap-2">
                   {Array.from({length: 6}).map((_, i) => (
                     <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-sm ${selectedNumbers[i] ? 'bg-neon-mint text-black border-transparent' : 'bg-transparent border-white/20 text-gray-500'}`}>
                       {selectedNumbers[i] || '?'}
                     </div>
                   ))}
                </div>

                <button 
                  onClick={handleBuy}
                  disabled={selectedNumbers.length !== 6 || buying || status !== 'OPEN'}
                  className="mt-4 md:mt-0 px-8 py-3 bg-gradient-to-r from-neon-mint to-teal-500 rounded-full text-black font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  Buy Ticket
                </button>
             </div>
          </div>

          {/* Sidebar: Tickets & History */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
             {/* My Tickets */}
             <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
               <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                 <Ticket size={18} className="text-neon-mint" /> Active Tickets ({myTickets.length})
               </h3>
               <div className="space-y-2 max-h-48 overflow-y-auto">
                 {myTickets.length === 0 ? (
                   <p className="text-sm text-gray-500 text-center py-4">No tickets for this draw.</p>
                 ) : (
                   myTickets.map(t => (
                     <div key={t.id} className="bg-black/50 rounded-lg p-3 border border-white/5 flex gap-1 justify-center">
                       {t.numbers.map(n => (
                         <div key={n} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                           {n}
                         </div>
                       ))}
                     </div>
                   ))
                 )}
               </div>
             </div>

             {/* History */}
             <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex-1">
               <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                 <Clock size={18} className="text-gray-400" /> Recent Results
               </h3>
               <div className="space-y-3">
                 {history.length === 0 ? (
                   <p className="text-sm text-gray-500">Loading history...</p>
                 ) : (
                   history.map((draw: any) => (
                     <div key={draw.id} className="flex flex-col gap-1 border-b border-white/5 pb-2">
                       <span className="text-xs text-gray-400">{new Date(draw.resultTime).toLocaleTimeString()}</span>
                       <div className="flex gap-1">
                         {draw.winningNumbers.map((n: number) => (
                           <div key={n} className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xs font-bold border border-yellow-500/30">
                             {n}
                           </div>
                         ))}
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </div>
          </div>

        </div>
      </div>
    </main>
  );
}
