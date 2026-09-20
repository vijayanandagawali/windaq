"use client";

import React, { useEffect } from 'react';
import { ShieldCheck, Plus, Bell, Crown, User, LogOut, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';

export default function Header() {
  const { balance, vipTier, setDepositing, setVipOpen, setNotifOpen, fetchBalance } = useWalletStore();
  const { isAuthenticated, user, isGuest, logout, openAuthModal, loginAsGuest } = useAuthStore();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, isAuthenticated]);

  const handleDepositClick = () => {
    setDepositing(true);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0c101c]/95 backdrop-blur-md border-b border-white/10 px-3 py-2 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-neon-mint via-emerald-400 to-blue-500 rounded-xl flex items-center justify-center font-black text-deep-ocean text-base sm:text-lg shadow-[0_0_15px_rgba(0,255,163,0.4)]">
            W
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl font-black text-white leading-none tracking-tight brand-title">WINDAQ</span>
              <span className="text-[10px] font-bold text-neon-mint">विन डैक</span>
            </div>
            <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
              <ShieldCheck size={10} className="text-neon-mint" />
              <span>Provably Fair</span>
            </div>
          </div>
        </Link>

        {/* VIP Tier Badge (Always Visible) */}
        <button 
          onClick={() => setVipOpen(true)}
          className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 hover:scale-105 transition-transform ${
            isGuest 
              ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]'
              : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/40 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
          }`}
          title="VIP Club"
        >
          <Crown size={11} className="text-yellow-400" />
          <span>{isGuest ? 'TEST GUEST' : vipTier.toUpperCase()}</span>
        </button>
      </div>
      
      {/* Header Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Notification Bell (Always Visible) */}
        <button 
          onClick={() => setNotifOpen(true)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors"
          title="Notifications"
        >
          <Bell size={14} className="text-gray-300" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-mint rounded-full shadow-[0_0_6px_rgba(0,255,163,1)]"></span>
        </button>

        {!isAuthenticated ? (
          /* Visitor State: Login / Register Actions */
          <>
            <button
              onClick={() => openAuthModal('LOGIN')}
              className="px-2.5 py-1 bg-white/5 border border-white/15 text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              LOGIN
            </button>

            <button
              onClick={() => openAuthModal('REGISTER')}
              className="px-3 py-1 bg-neon-mint text-deep-ocean text-[11px] sm:text-xs font-black rounded-xl shadow-[0_0_10px_rgba(0,255,163,0.3)] hover:bg-[#1ed49c] active:scale-95 transition-all cursor-pointer"
            >
              REGISTER
            </button>
          </>
        ) : (
          /* Authenticated State: Profile Pill, and Logout */
          <>
            <Link
              href="/profile"
              className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/5 border border-white/10 hover:border-white/25 transition-all"
              title="My Profile"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-neon-mint flex items-center justify-center text-[10px] font-black text-deep-ocean">
                {user?.isGuest ? 'G' : (user?.phone ? user.phone.slice(-2) : 'U')}
              </div>
              <span className="hidden sm:inline text-xs font-bold text-gray-200">
                {user?.isGuest ? 'Guest' : (user?.phone ? user.phone.slice(-4) : 'Profile')}
              </span>
            </Link>

            <button
              onClick={() => logout()}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
              title="Log Out"
            >
              <LogOut size={13} />
            </button>
          </>
        )}

        {/* Balance Chip / Deposit Trigger (Always present for 1-Tap Deposit) */}
        <button 
          data-testid="header-deposit-btn"
          role="button"
          aria-label="Deposit Funds"
          onClick={handleDepositClick}
          className="bg-ocean-card/90 border border-neon-mint/30 py-0.5 sm:py-1 pl-2 sm:pl-2.5 pr-1 rounded-full flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:border-neon-mint transition-all shadow-[0_0_12px_rgba(0,255,163,0.15)] group shrink-0"
        >
          <span className="text-neon-mint text-xs font-black">₹</span>
          <span className="font-extrabold text-white text-[11px] sm:text-xs tracking-tight">
            {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neon-mint text-deep-ocean font-black text-xs sm:text-sm flex items-center justify-center shadow-[0_0_10px_rgba(0,255,163,0.5)] group-hover:scale-110 transition-transform">
            <Plus size={13} strokeWidth={3} />
          </div>
        </button>
      </div>
    </header>
  );
}
