"use client";

import React from 'react';
import { ShieldCheck, Plus, Bell, Crown } from 'lucide-react';
import Link from 'next/link';
import { useWalletStore } from '@/store/walletStore';

export default function Header() {
  const { balance, vipTier, setDepositing, setVipOpen, setNotifOpen, fetchBalance } = useWalletStore();

  React.useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <header className="sticky top-0 z-40 bg-[#0c101c]/95 backdrop-blur-md border-b border-white/10 px-4 py-2.5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-neon-mint via-emerald-400 to-blue-500 rounded-xl flex items-center justify-center font-black text-deep-ocean text-lg shadow-[0_0_15px_rgba(0,255,163,0.4)]">
            W
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-white leading-none tracking-tight brand-title">WINDAQ</span>
              <span className="text-[10px] font-bold text-neon-mint">विन डैक</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
              <ShieldCheck size={10} className="text-neon-mint" />
              <span>Provably Fair</span>
            </div>
          </div>
        </Link>

        {/* VIP Tier Badge */}
        <button 
          onClick={() => setVipOpen(true)}
          className="ml-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-[0_0_10px_rgba(234,179,8,0.2)] hover:scale-105 transition-transform"
        >
          <Crown size={11} className="text-yellow-400" />
          <span>{vipTier.toUpperCase()}</span>
        </button>
      </div>
      
      {/* Header Right */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <button 
          onClick={() => setNotifOpen(true)}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors"
          title="Notifications"
        >
          <Bell size={15} className="text-gray-300" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-mint rounded-full shadow-[0_0_6px_rgba(0,255,163,1)]"></span>
        </button>

        {/* Balance Chip / Deposit Trigger */}
        <button 
          data-testid="header-deposit-btn"
          role="button"
          aria-label="Deposit Funds"
          onClick={() => setDepositing(true)}
          className="bg-ocean-card/90 border border-neon-mint/30 py-1 pl-2.5 pr-1 rounded-full flex items-center gap-2 cursor-pointer hover:border-neon-mint transition-all shadow-[0_0_12px_rgba(0,255,163,0.15)] group"
        >
          <span className="text-neon-mint text-xs font-black">₹</span>
          <span className="font-extrabold text-white text-xs tracking-tight">
            {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="w-6 h-6 rounded-full bg-neon-mint text-deep-ocean font-black text-sm flex items-center justify-center shadow-[0_0_10px_rgba(0,255,163,0.5)] group-hover:scale-110 transition-transform">
            <Plus size={14} strokeWidth={3} />
          </div>
        </button>
      </div>
    </header>
  );
}
