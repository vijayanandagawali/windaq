"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, Maximize2, Volume2, ShieldCheck } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';

export default function LiveCasino() {
  const { balance, deductBalance } = useWalletStore();
  
  const [selectedChip, setSelectedChip] = useState(100);
  const [bets, setBets] = useState<{ [key: string]: number }>({});
  
  const handlePlaceBet = (spot: string) => {
    if (balance < selectedChip) {
      toast.error("Insufficient balance!");
      return;
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
    deductBalance(selectedChip);
    setBets(prev => ({
      ...prev,
      [spot]: (prev[spot] || 0) + selectedChip
    }));
    toast.success(`₹${selectedChip} placed on ${spot}`);
  };

  return (
    <main className="min-h-screen bg-black font-sans selection:bg-neon-mint flex flex-col">
      {/* Video Stream Area (Top Half) */}
      <div className="relative w-full h-[40vh] md:h-[50vh] bg-gray-900 border-b-2 border-neon-mint/50">
        {/* Placeholder for iframe / video stream */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="https://images.unsplash.com/photo-1596838132731-3301c3fd4317?q=80&w=1000&auto=format&fit=crop" 
          alt="Live Dealer"
          className="w-full h-full object-cover opacity-80"
        />
        
        {/* Stream Overlay UI */}
        <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 via-transparent to-black/60">
           <header className="flex items-center justify-between z-20">
              <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 bg-black/40 backdrop-blur">
                <ChevronLeft size={24} className="text-white" />
              </Link>
              <div className="flex items-center gap-2">
                 <div className="bg-red-600 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1 animate-pulse">
                   <div className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE
                 </div>
                 <div className="bg-black/40 backdrop-blur p-2 rounded-full"><Volume2 size={16} className="text-white" /></div>
                 <div className="bg-black/40 backdrop-blur p-2 rounded-full"><Maximize2 size={16} className="text-white" /></div>
              </div>
           </header>
           
           <div className="text-center pb-2">
              <h2 className="text-white font-black text-2xl tracking-widest drop-shadow-lg shadow-black">LIGHTNING ROULETTE</h2>
              <p className="text-neon-mint text-xs font-bold uppercase drop-shadow-md">Place your bets - 12s remaining</p>
           </div>
        </div>
      </div>

      {/* Betting Grid Area (Bottom Half) */}
      <div className="flex-1 bg-deep-ocean flex flex-col justify-between p-4 pb-safe relative">
        <div className="absolute top-2 left-4 text-[10px] text-gray-500 flex items-center gap-1 font-mono">
           <ShieldCheck size={10} className="text-green-500" />
           Evolution Gaming Certified
        </div>

        {/* Simplified Roulette Grid */}
        <div className="flex-1 mt-6">
          <div className="grid grid-cols-3 gap-1 mb-1">
             <button onClick={() => handlePlaceBet('1-12')} className="bet-spot bg-green-900/40 border border-green-500/30">1st 12</button>
             <button onClick={() => handlePlaceBet('13-24')} className="bet-spot bg-green-900/40 border border-green-500/30">2nd 12</button>
             <button onClick={() => handlePlaceBet('25-36')} className="bet-spot bg-green-900/40 border border-green-500/30">3rd 12</button>
          </div>
          <div className="grid grid-cols-6 gap-1 h-32">
             {[...Array(18)].map((_, i) => {
               const num = i + 1;
               const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
               return (
                 <button 
                   key={num}
                   onClick={() => handlePlaceBet(num.toString())}
                   className={`bet-spot relative flex items-center justify-center font-bold text-white border border-white/20
                     ${isRed ? 'bg-red-600 hover:bg-red-500' : 'bg-black hover:bg-gray-900'}
                   `}
                 >
                   {num}
                   {bets[num.toString()] && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-yellow-400 rounded-full border border-black flex items-center justify-center text-black text-[8px] font-black z-10 pointer-events-none">
                       {bets[num.toString()]}
                     </div>
                   )}
                 </button>
               )
             })}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1">
             <button onClick={() => handlePlaceBet('Red')} className="bet-spot bg-red-600 border border-red-400">RED</button>
             <button onClick={() => handlePlaceBet('Black')} className="bet-spot bg-black border border-gray-600">BLACK</button>
          </div>
        </div>

        {/* Chip Rack */}
        <div className="flex-none bg-ocean-card/50 rounded-2xl border border-white/10 p-3 mt-4">
           <div className="flex justify-between items-center mb-3 px-2">
             <span className="text-xs text-gray-400 font-bold uppercase">Balance: <span className="text-neon-mint">₹{balance.toFixed(2)}</span></span>
             <button className="text-[10px] text-gray-400 border border-gray-600 px-2 py-1 rounded">Clear Bets</button>
           </div>
           
           <div className="flex justify-between px-2">
             {[10, 50, 100, 500, 1000].map(chip => (
               <button 
                 key={chip}
                 onClick={() => setSelectedChip(chip)}
                 className={`w-12 h-12 rounded-full flex items-center justify-center font-black border-2 transition-transform shadow-lg
                   ${selectedChip === chip 
                     ? 'bg-yellow-400 text-black border-white scale-110 shadow-yellow-400/50' 
                     : 'bg-gray-800 text-white border-gray-500 opacity-70'}
                 `}
               >
                 {chip >= 1000 ? `${chip/1000}k` : chip}
               </button>
             ))}
           </div>
        </div>
      </div>
      
      <style jsx>{`
        .bet-spot {
          border-radius: 4px;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: bold;
          transition: all 0.2s;
        }
        .bet-spot:active {
          transform: scale(0.95);
        }
      `}</style>
    </main>
  );
}
