"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Info, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function Sportsbook() {
  const { balance, deductBalance } = useWalletStore();
  
  const [expandedSections, setExpandedSections] = useState({
    matchWinner: true,
    fancy: true,
    partnership: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Bet Slip state
  const [betSlip, setBetSlip] = useState<{ market: string, selection: string, odds: number, type: 'Back' | 'Lay' } | null>(null);
  const [stake, setStake] = useState(1000);

  const handleOddsClick = (market: string, selection: string, odds: number, type: 'Back' | 'Lay') => {
    setBetSlip({ market, selection, odds, type });
  };

  const placeBet = async () => {
    if (!betSlip) return;
    if (balance < stake) {
      toast.error("Insufficient balance!");
      return;
    }
    
    if (navigator.vibrate) navigator.vibrate(50);
    deductBalance(stake);
    
    try {
      await fetch('/api/v1/sports/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '9876543210',
          matchId: 'cric_t20_ind_pak',
          market: betSlip.market,
          selection: betSlip.selection,
          type: betSlip.type,
          odds: betSlip.odds,
          stake: stake
        })
      });
    } catch (e) {
      console.warn('Sports bet sync note:', e);
    }

    toast.success(`Bet Placed: ${betSlip.type} ${betSlip.selection} @ ${betSlip.odds} for ₹${stake}`);
    setBetSlip(null);
  };

  return (
    <main className="min-h-screen bg-deep-ocean font-sans selection:bg-neon-mint flex flex-col pb-safe">
      <header className="flex-none bg-[#091b3d] border-b border-white/5 px-4 py-3 flex items-center justify-between z-20 shadow-lg">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-white font-bold tracking-widest text-sm uppercase">WinDaq Sports</h1>
        <span className="text-neon-mint font-bold text-sm">₹{balance.toFixed(2)}</span>
      </header>

      {/* Live Scorecard Engine */}
      <div className="bg-[#0b214a] p-4 border-b border-white/5">
         <div className="flex justify-between items-center mb-2">
            <span className="text-red-500 font-bold text-[10px] uppercase tracking-widest animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> Live
            </span>
            <span className="text-gray-400 text-[10px] uppercase tracking-widest">T20 World Cup</span>
         </div>
         
         <div className="flex justify-between items-center mb-4">
           <div className="flex flex-col items-center">
             <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white mb-1 shadow-lg">IND</div>
             <span className="text-white font-black text-xl">186/3</span>
             <span className="text-gray-400 text-xs">17.4 Overs</span>
           </div>
           
           <div className="flex flex-col items-center justify-center">
             <span className="text-gray-500 text-xs font-bold uppercase mb-1">CRR: 10.5</span>
             <span className="text-white text-xs bg-white/10 px-2 py-1 rounded">Target: 210</span>
           </div>

           <div className="flex flex-col items-center">
             <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center font-bold text-white mb-1 shadow-lg opacity-50">PAK</div>
             <span className="text-gray-400 font-black text-xl">Yet to bat</span>
           </div>
         </div>
         
         <div className="bg-black/20 rounded p-2 text-[10px] text-gray-300 flex justify-between font-mono border border-white/5">
            <span>V Kohli: 82* (53)</span>
            <span>S Yadav: 14* (8)</span>
         </div>
      </div>

      {/* Markets Engine */}
      <div className="flex-1 overflow-y-auto p-2">
         {/* Headers */}
         <div className="flex justify-end gap-1 px-2 mb-1 text-[10px] font-bold text-gray-500 uppercase">
            <div className="w-16 text-center">Back</div>
            <div className="w-16 text-center">Lay</div>
         </div>

         {/* Accordion: Match Winner */}
         <div className="mb-2 bg-ocean-card/50 border border-white/10 rounded-lg overflow-hidden">
            <button 
              onClick={() => toggleSection('matchWinner')}
              className="w-full flex items-center justify-between p-3 bg-ocean-card hover:bg-white/5 transition-colors"
            >
              <span className="text-white font-bold text-sm uppercase tracking-wider">Match Winner</span>
              {expandedSections.matchWinner ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </button>
            
            <AnimatePresence>
              {expandedSections.matchWinner && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-2 flex flex-col gap-1">
                    {/* IND */}
                    <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                       <span className="text-white font-bold text-sm">India</span>
                       <div className="flex gap-1">
                          <button onClick={() => handleOddsClick('Match Winner', 'India', 1.45, 'Back')} className="w-16 h-10 bg-blue-500/20 text-blue-400 font-bold rounded flex flex-col items-center justify-center border border-blue-500/30 hover:bg-blue-500/40">
                             <span>1.45</span>
                          </button>
                          <button onClick={() => handleOddsClick('Match Winner', 'India', 1.48, 'Lay')} className="w-16 h-10 bg-pink-500/20 text-pink-400 font-bold rounded flex flex-col items-center justify-center border border-pink-500/30 hover:bg-pink-500/40">
                             <span>1.48</span>
                          </button>
                       </div>
                    </div>
                    {/* PAK */}
                    <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                       <span className="text-white font-bold text-sm">Pakistan</span>
                       <div className="flex gap-1">
                          <button onClick={() => handleOddsClick('Match Winner', 'Pakistan', 2.80, 'Back')} className="w-16 h-10 bg-blue-500/20 text-blue-400 font-bold rounded flex flex-col items-center justify-center border border-blue-500/30 hover:bg-blue-500/40">
                             <span>2.80</span>
                          </button>
                          <button onClick={() => handleOddsClick('Match Winner', 'Pakistan', 2.85, 'Lay')} className="w-16 h-10 bg-pink-500/20 text-pink-400 font-bold rounded flex flex-col items-center justify-center border border-pink-500/30 hover:bg-pink-500/40">
                             <span>2.85</span>
                          </button>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
         </div>

         {/* Accordion: Fancy Bets (Session) */}
         <div className="mb-2 bg-ocean-card/50 border border-white/10 rounded-lg overflow-hidden">
            <button 
              onClick={() => toggleSection('fancy')}
              className="w-full flex items-center justify-between p-3 bg-ocean-card hover:bg-white/5 transition-colors"
            >
              <span className="text-white font-bold text-sm uppercase tracking-wider">Session (Fancy)</span>
              {expandedSections.fancy ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </button>
            
            <AnimatePresence>
              {expandedSections.fancy && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="p-2 flex flex-col gap-1">
                    <div className="flex justify-end gap-1 px-2 mb-1 text-[10px] font-bold text-gray-500 uppercase">
                      <div className="w-16 text-center text-pink-400">No (Khaya)</div>
                      <div className="w-16 text-center text-blue-400">Yes (Lagaya)</div>
                    </div>
                    
                    {/* Runs in 20 Overs */}
                    <div className="flex items-center justify-between bg-black/20 p-2 rounded">
                       <span className="text-white font-bold text-sm">20 Over Runs IND</span>
                       <div className="flex gap-1">
                          <button onClick={() => handleOddsClick('20 Over Runs IND', 'Under 214', 1.00, 'Lay')} className="w-16 h-10 bg-pink-500/20 text-pink-400 font-bold rounded flex flex-col items-center justify-center border border-pink-500/30">
                             <span>214</span>
                          </button>
                          <button onClick={() => handleOddsClick('20 Over Runs IND', 'Over 215', 1.00, 'Back')} className="w-16 h-10 bg-blue-500/20 text-blue-400 font-bold rounded flex flex-col items-center justify-center border border-blue-500/30">
                             <span>215</span>
                          </button>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
         </div>
      </div>

      {/* Bet Slip (Dynamic Bottom Sheet) */}
      <AnimatePresence>
        {betSlip && (
          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }}
            className={`fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t shadow-[0_-10px_30px_rgba(0,0,0,0.8)] p-4
              ${betSlip.type === 'Back' ? 'bg-[#0f172a] border-blue-500/30' : 'bg-[#1e1115] border-pink-500/30'}
            `}
          >
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h4 className="text-white font-black uppercase text-sm mb-1">{betSlip.market}</h4>
                  <p className="text-gray-400 text-xs font-bold">{betSlip.type} - {betSlip.selection}</p>
               </div>
               <div className="text-right">
                  <span className={`font-black text-2xl ${betSlip.type === 'Back' ? 'text-blue-400' : 'text-pink-400'}`}>{betSlip.odds}</span>
               </div>
            </div>

            <div className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 mb-4">
               <button onClick={() => setStake(Math.max(100, stake - 100))} className="w-10 h-10 rounded bg-white/5 text-white font-bold">-</button>
               <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Stake</span>
                  <input 
                    type="number" 
                    value={stake} 
                    onChange={e => setStake(Number(e.target.value))}
                    className="w-24 bg-transparent text-white font-black text-xl text-center focus:outline-none" 
                  />
               </div>
               <button onClick={() => setStake(stake + 100)} className="w-10 h-10 rounded bg-white/5 text-white font-bold">+</button>
            </div>

            <div className="flex justify-between items-center mb-4 px-2">
               <span className="text-gray-400 text-xs font-bold uppercase">Potential Return</span>
               <span className="text-neon-mint font-black text-lg">₹{(stake * betSlip.odds).toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
               <button onClick={() => setBetSlip(null)} className="flex-1 py-4 rounded-xl border border-white/10 text-white font-bold uppercase text-sm">Cancel</button>
               <button onClick={placeBet} className={`flex-[2] py-4 rounded-xl font-black text-white uppercase text-sm tracking-widest shadow-lg
                 ${betSlip.type === 'Back' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-pink-600 hover:bg-pink-500'}
               `}>
                 Place Bet
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
