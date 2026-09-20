"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, HelpCircle, Clock, History } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

const COLORS = [
  { id: 'green', label: 'Join Green', multiplier: 2, bg: 'bg-green-500', shadow: 'shadow-[0_0_20px_rgba(34,197,94,0.5)]' },
  { id: 'violet', label: 'Join Violet', multiplier: 4.5, bg: 'bg-purple-500', shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.5)]' },
  { id: 'red', label: 'Join Red', multiplier: 2, bg: 'bg-red-500', shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.5)]' },
];

const NUMBERS = Array.from({length: 10}, (_, i) => i);

export default function ColorPrediction() {
  const { balance, deductBalance, addWinnings } = useWalletStore();
  
  const [countdown, setCountdown] = useState(60); // 1-Min draw
  const [period, setPeriod] = useState(20240919001);
  const [history, setHistory] = useState([
    { period: 20240919000, number: 4, color: 'red' },
    { period: 20240919999, number: 7, color: 'green' },
    { period: 20240919998, number: 0, color: 'violet' },
    { period: 20240919997, number: 2, color: 'red' },
    { period: 20240919996, number: 5, color: 'green' },
  ]);
  
  const [activeTab, setActiveTab] = useState<'1min' | '3min'>('1min');
  
  // Betting state
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<{type: 'color'|'number', val: string|number, color: string} | null>(null);
  const [betAmount, setBetAmount] = useState(100);

  // Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          generateResult();
          return activeTab === '1min' ? 60 : 180;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateResult = () => {
    // Mock logic
    const winningNumber = Math.floor(Math.random() * 10);
    let winningColor = 'green';
    if (winningNumber === 0 || winningNumber === 5) winningColor = 'violet';
    else if (winningNumber % 2 === 0) winningColor = 'red';
    
    setHistory(prev => [{ period, number: winningNumber, color: winningColor }, ...prev.slice(0, 9)]);
    setPeriod(prev => prev + 1);
  };

  const handleOpenBet = (type: 'color'|'number', val: string|number, colorStr: string) => {
    if (countdown <= 10) return; // Locked
    setSelectedBet({ type, val, color: colorStr });
    setBetModalOpen(true);
  };

  const handlePlaceBet = () => {
    if (balance < betAmount) {
      toast.error("Insufficient balance!");
      return;
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
    deductBalance(betAmount);
    setBetModalOpen(false);
    toast.success(`₹${betAmount} placed successfully!`);
    // In real app, we send to backend here.
  };

  return (
    <main className="min-h-screen bg-deep-ocean font-sans selection:bg-neon-mint relative flex flex-col pb-safe">
      <header className="flex-none bg-deep-ocean border-b border-white/5 px-4 py-3 flex items-center justify-between z-20 shadow-lg">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">WinDaq Color</h1>
        <span className="text-neon-mint font-bold text-sm">₹{balance.toFixed(2)}</span>
      </header>

      {/* Tabs */}
      <div className="flex bg-ocean-card/50 p-1 m-4 rounded-xl border border-white/10">
        <button 
          onClick={() => { setActiveTab('1min'); setCountdown(60); }} 
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === '1min' ? 'bg-neon-mint text-deep-ocean' : 'text-gray-400'}`}
        >
          1 Min Draw
        </button>
        <button 
          onClick={() => { setActiveTab('3min'); setCountdown(180); }} 
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === '3min' ? 'bg-neon-mint text-deep-ocean' : 'text-gray-400'}`}
        >
          3 Min Draw
        </button>
      </div>

      {/* Timer Section */}
      <div className="mx-4 mb-6 glass-card p-4 rounded-2xl flex items-center justify-between">
         <div>
           <p className="text-gray-400 text-xs font-bold uppercase mb-1 flex items-center gap-1"><Clock size={12}/> Period</p>
           <h3 className="text-white font-black text-xl">{period}</h3>
         </div>
         <div className="text-right">
           <p className="text-gray-400 text-xs font-bold uppercase mb-1">Count Down</p>
           <div className="flex items-center gap-1">
             <span className={`text-3xl font-black tabular-nums ${countdown <= 10 ? 'text-red-500 animate-pulse' : 'text-neon-mint'}`}>
                {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
             </span>
           </div>
         </div>
      </div>

      {/* Betting Area */}
      <div className="mx-4 mb-6">
        {/* Colors */}
        <div className="flex gap-3 mb-6 relative">
          {countdown <= 10 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 rounded-xl flex items-center justify-center border border-red-500/50">
              <span className="text-red-500 font-black tracking-widest text-lg uppercase shadow-black drop-shadow-lg">Locked</span>
            </div>
          )}
          
          {COLORS.map(c => (
            <button 
              key={c.id}
              onClick={() => handleOpenBet('color', c.id, c.bg)}
              className={`flex-1 py-4 rounded-xl ${c.bg} ${c.shadow} flex flex-col items-center justify-center transform active:scale-95 transition-transform text-white border-2 border-white/20`}
            >
              <span className="font-black text-sm uppercase tracking-wide drop-shadow-md">{c.label}</span>
              <span className="text-[10px] font-bold mt-1 opacity-90">{c.multiplier}x</span>
            </button>
          ))}
        </div>

        {/* Numbers Grid */}
        <div className="bg-ocean-card/30 border border-white/5 rounded-2xl p-4 relative">
          {countdown <= 10 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 rounded-xl" />
          )}
          <div className="grid grid-cols-5 gap-3">
            {NUMBERS.map(n => {
              let bg = 'bg-blue-500';
              if (n === 0 || n === 5) bg = 'bg-purple-500';
              else if (n % 2 === 0) bg = 'bg-red-500';
              else bg = 'bg-green-500';
              
              return (
                <button 
                  key={n}
                  onClick={() => handleOpenBet('number', n, bg)}
                  className={`aspect-square rounded-full ${bg} flex items-center justify-center text-white font-black text-xl border-2 border-white/20 shadow-lg transform active:scale-90 transition-transform`}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p className="text-center text-gray-500 text-[10px] font-bold uppercase mt-4">Number Win: 9x Payout</p>
        </div>
      </div>

      {/* Roadmap / History */}
      <div className="flex-1 bg-ocean-card/80 rounded-t-3xl border-t border-white/10 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
         <h3 className="text-white font-bold mb-4 flex items-center gap-2"><History size={16} className="text-neon-mint"/> Trend History</h3>
         
         <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {history.map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-none">
                 <span className="text-[10px] text-gray-500 mb-1">{h.period.toString().slice(-3)}</span>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 border-white/20
                    ${h.color === 'red' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 
                      h.color === 'green' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 
                      'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]'}
                 `}>
                   {h.number}
                 </div>
              </div>
            ))}
         </div>
      </div>

      {/* Betting Modal */}
      <AnimatePresence>
        {betModalOpen && selectedBet && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setBetModalOpen(false)} />
            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-ocean-card rounded-t-3xl border-t border-white/10 p-6"
            >
               <h3 className={`text-xl font-black text-white mb-4 ${selectedBet.color.replace('bg-', 'text-')}`}>
                 Bet on {selectedBet.type === 'color' ? selectedBet.val.toString().toUpperCase() : `Number ${selectedBet.val}`}
               </h3>
               
               <div className="flex gap-2 mb-6">
                 {[10, 50, 100, 500, 1000].map(amt => (
                   <button 
                     key={amt}
                     onClick={() => setBetAmount(amt)}
                     className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${betAmount === amt ? 'bg-white/20 border-white text-white' : 'bg-black/30 border-white/5 text-gray-400'}`}
                   >
                     ₹{amt}
                   </button>
                 ))}
               </div>
               
               <div className="flex gap-3">
                 <button onClick={() => setBetModalOpen(false)} className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold">Cancel</button>
                 <button onClick={handlePlaceBet} className={`flex-[2] py-4 rounded-xl font-black text-white ${selectedBet.color} shadow-lg`}>Confirm ₹{betAmount}</button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
