"use client";

import React from 'react';
import { Sparkles, Crown, Gift, FileText } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';

export default function QuickHub() {
  const { setSpinOpen, setVipOpen, setReferralOpen, setPassbookOpen } = useWalletStore();

  const handleAction = (cb: () => void) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    cb();
  };

  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 mb-4">
      {/* 1. Daily Lucky Spin */}
      <button 
        onClick={() => handleAction(() => setSpinOpen(true))}
        className="bg-gradient-to-br from-amber-500/15 via-ocean-card to-yellow-950/40 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-3 text-left relative overflow-hidden group active:scale-95 transition-all shadow-[0_4px_16px_rgba(234,179,8,0.1)]"
      >
        <span className="absolute top-1.5 right-2 bg-yellow-500/20 text-yellow-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-yellow-500/30">
          FREE DAILY
        </span>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(234,179,8,0.4)] group-hover:rotate-12 transition-transform">
          🎰
        </div>
        <div>
          <h4 className="text-white text-xs font-black tracking-wide">LUCKY SPIN</h4>
          <p className="text-[10px] text-yellow-400 font-bold mt-0.5">Win Up to ₹2,500</p>
        </div>
      </button>

      {/* 2. VIP Loyalty Club */}
      <button 
        onClick={() => handleAction(() => setVipOpen(true))}
        className="bg-gradient-to-br from-purple-500/15 via-ocean-card to-fuchsia-950/40 border border-purple-500/30 rounded-2xl p-3 flex items-center gap-3 text-left relative overflow-hidden group active:scale-95 transition-all shadow-[0_4px_16px_rgba(168,85,247,0.1)]"
      >
        <span className="absolute top-1.5 right-2 bg-purple-500/20 text-purple-300 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-purple-500/30">
          REWARDS
        </span>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(168,85,247,0.4)] group-hover:scale-110 transition-transform">
          👑
        </div>
        <div>
          <h4 className="text-white text-xs font-black tracking-wide">VIP CLUB</h4>
          <p className="text-[10px] text-purple-400 font-bold mt-0.5">12% Cashback</p>
        </div>
      </button>

      {/* 3. Refer & Earn */}
      <button 
        onClick={() => handleAction(() => setReferralOpen(true))}
        className="bg-gradient-to-br from-emerald-500/15 via-ocean-card to-teal-950/40 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-3 text-left relative overflow-hidden group active:scale-95 transition-all shadow-[0_4px_16px_rgba(16,185,129,0.1)]"
      >
        <span className="absolute top-1.5 right-2 bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/30">
          30% COMM
        </span>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] group-hover:rotate-12 transition-transform">
          🎁
        </div>
        <div>
          <h4 className="text-white text-xs font-black tracking-wide">REFER & EARN</h4>
          <p className="text-[10px] text-emerald-400 font-bold mt-0.5">₹200 Per Friend</p>
        </div>
      </button>

      {/* 4. Passbook / Statement */}
      <button 
        onClick={() => handleAction(() => setPassbookOpen(true))}
        className="bg-gradient-to-br from-blue-500/15 via-ocean-card to-cyan-950/40 border border-blue-500/30 rounded-2xl p-3 flex items-center gap-3 text-left relative overflow-hidden group active:scale-95 transition-all shadow-[0_4px_16px_rgba(59,130,246,0.1)]"
      >
        <span className="absolute top-1.5 right-2 bg-blue-500/20 text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-blue-500/30">
          HISTORY
        </span>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(59,130,246,0.4)] group-hover:scale-110 transition-transform">
          📜
        </div>
        <div>
          <h4 className="text-white text-xs font-black tracking-wide">PASSBOOK</h4>
          <p className="text-[10px] text-cyan-400 font-bold mt-0.5">Live Statements</p>
        </div>
      </button>
    </div>
  );
}
