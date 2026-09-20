"use client";

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, History, ShieldCheck, CreditCard, ChevronRight, Gift, Trophy } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import AndroidStatusBar from '@/components/layout/AndroidStatusBar';
import Header from '@/components/layout/Header';

export default function WalletHub() {
  const { balance, bonusBalance, setDepositing, setWithdrawing, setPassbookOpen, setVipOpen, setReferralOpen } = useWalletStore();

  return (
    <main className="min-h-screen bg-deep-ocean pb-24 font-sans selection:bg-neon-mint selection:text-deep-ocean max-w-lg mx-auto">
      <AndroidStatusBar />
      <Header />
      
      <div className="px-4 pt-4">
        <h2 className="text-xl font-black text-white mb-4 tracking-wide">MY GAMING WALLET</h2>

        {/* Balance Card */}
        <div className="bg-gradient-to-br from-ocean-card to-blue-950/70 p-5 relative overflow-hidden mb-5 border border-white/10 rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard size={80} />
          </div>
          
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Total Available Balance</p>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-1.5">
            <span className="text-neon-mint">₹</span>
            {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
          
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-[10px] font-bold uppercase">Bonus Cash</p>
              <p className="text-neon-mint font-black text-xs">₹{bonusBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <ShieldCheck size={13} /> WALLET
            </div>
          </div>
        </div>

        {/* Primary Deposit & Withdraw Actions */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button 
            onClick={() => setDepositing(true)}
            className="flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neon-mint to-emerald-400 hover:from-neon-mint hover:to-emerald-300 py-4 text-deep-ocean rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.4)] active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-deep-ocean/10 flex items-center justify-center">
              <ArrowDownLeft size={24} strokeWidth={2.5} className="text-deep-ocean" />
            </div>
            <span className="font-black text-sm tracking-wide">INSTANT DEPOSIT</span>
          </button>
          
          <button 
            onClick={() => setWithdrawing(true)}
            className="flex flex-col items-center justify-center gap-2 bg-ocean-card hover:bg-ocean-card/80 transition-colors border border-white/10 text-white rounded-2xl py-4 shadow-lg active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
              <ArrowUpRight size={24} strokeWidth={2.5} className="text-gray-300" />
            </div>
            <span className="font-black text-sm tracking-wide">WITHDRAWAL</span>
          </button>
        </div>

        {/* Action Menu List */}
        <div className="bg-ocean-card/90 rounded-3xl border border-white/5 divide-y divide-white/5 overflow-hidden mb-6">
          <button 
            onClick={() => setPassbookOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                <History size={18} />
              </div>
              <div>
                <p className="text-white font-bold text-xs">Transaction History (Passbook)</p>
                <p className="text-gray-400 text-[10px]">View all deposits, bets, and win receipts</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-500" />
          </button>
          
          <button 
            onClick={() => setVipOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
                <Trophy size={18} />
              </div>
              <div>
                <p className="text-white font-bold text-xs">VIP Tier & Daily Cashback</p>
                <p className="text-gray-400 text-[10px]">Claim 7% loss cashback & VIP perks</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-500" />
          </button>

          <button 
            onClick={() => setReferralOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Gift size={18} />
              </div>
              <div>
                <p className="text-white font-bold text-xs">Refer & Earn Program</p>
                <p className="text-gray-400 text-[10px]">Invite friends & get ₹200 instant cash</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>
      </div>
    </main>
  );
}
