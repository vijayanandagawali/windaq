"use client";

import React, { useEffect } from 'react';
import { ShieldCheck, Plus, Bell, Crown, User, LogOut, ChevronLeft, Flame, Rocket, Video, Dices, Trophy, Gift, Volume2, VolumeX, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { useAudioStore } from '@/store/audioStore';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { balance, vipTier, setDepositing, setVipOpen, setNotifOpen, fetchBalance } = useWalletStore();
  const { isAuthenticated, user, isGuest, logout, openAuthModal, loginAsGuest } = useAuthStore();
  const { soundEnabled, volume, setControlsOpen } = useAudioStore();

  const isHome = pathname === '/';

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, isAuthenticated]);

  const handleDepositClick = () => {
    setDepositing(true);
  };

  const navLinks = [
    { name: 'Lobby', href: '/', icon: Flame, match: pathname === '/' },
    { name: 'Crash', href: '/games/aviator', icon: Rocket, match: pathname.includes('/aviator') },
    { name: 'Live Casino', href: '/games/live-casino', icon: Video, match: pathname.includes('/live') },
    { name: 'Slots', href: '/games/slots', icon: Trophy, match: pathname.includes('/slots') },
    { name: 'Table', href: '/games/teen-patti', icon: Dices, match: pathname.includes('/teen-patti') || pathname.includes('/roulette') || pathname.includes('/blackjack') },
    { name: 'Sports', href: '/games/sportsbook', icon: Trophy, match: pathname.includes('/sportsbook') },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0c101c]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
      {/* Brand & Back Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {!isHome && (
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Go Back"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-neon-mint via-emerald-400 to-blue-500 rounded-xl flex items-center justify-center font-black text-deep-ocean text-base sm:text-lg shadow-[0_0_15px_rgba(0,255,163,0.4)] group-hover:scale-105 transition-transform">
            W
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-xl font-black text-white leading-none tracking-tight brand-title">WINDAQ</span>
              <span className="text-[9px] sm:text-[10px] font-bold text-neon-mint hidden min-[340px]:inline">विन डैक</span>
            </div>
            <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
              <ShieldCheck size={10} className="text-neon-mint" />
              <span>Provably Fair</span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 ml-4 pl-4 border-l border-white/10">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  item.match
                    ? 'bg-neon-mint/15 text-neon-mint border border-neon-mint/30 shadow-[0_0_10px_rgba(0,255,163,0.2)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setVipOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 text-yellow-400 hover:bg-yellow-500/10 transition-all cursor-pointer"
          >
            <Gift size={14} />
            <span>VIP Club</span>
          </button>
        </nav>
      </div>

      {/* Header Right Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* VIP Tier Badge (Mobile/Tablet - hidden below 400px to prevent overflow) */}
        <button
          onClick={() => setVipOpen(true)}
          className={`hidden min-[400px]:flex px-2 py-0.5 rounded-full text-[10px] font-extrabold items-center gap-1 hover:scale-105 transition-transform cursor-pointer ${
            isGuest
              ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]'
              : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-500/40 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
          }`}
          title="VIP Club"
        >
          <Crown size={11} className="text-yellow-400" />
          <span className="hidden sm:inline">{isGuest ? 'TEST GUEST' : vipTier.toUpperCase()}</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setNotifOpen(true)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors cursor-pointer"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={14} className="text-gray-300" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-mint rounded-full shadow-[0_0_6px_rgba(0,255,163,1)] animate-pulse"></span>
        </button>

        {/* Sound & Haptics Control Button */}
        <button
          onClick={() => setControlsOpen(true)}
          data-testid="header-sound-btn"
          role="button"
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center relative hover:scale-105 transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-neon-mint/10 border-neon-mint/30 text-neon-mint shadow-[0_0_8px_rgba(0,255,163,0.2)]'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
          title={soundEnabled ? `Sound: ON (${Math.round(volume * 100)}%) - Click for settings` : 'Sound: MUTED - Click to configure'}
          aria-label={soundEnabled ? 'Sound Settings (Active)' : 'Sound Settings (Muted)'}
        >
          {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>

        {!isAuthenticated ? (
          /* Visitor State: Login / Register / Guest */
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              data-testid="header-guest-btn"
              onClick={() => loginAsGuest()}
              className="px-2 sm:px-2.5 py-1 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-[10px] sm:text-xs font-bold rounded-xl hover:bg-yellow-400/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              title="Play as Sandbox Guest"
            >
              <Sparkles size={11} />
              <span>GUEST</span>
            </button>

            <button
              data-testid="header-login-btn"
              onClick={() => openAuthModal('LOGIN')}
              className="px-2.5 sm:px-3 py-1 bg-white/5 border border-white/15 text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              LOGIN
            </button>

            <button
              data-testid="header-register-btn"
              onClick={() => openAuthModal('REGISTER')}
              className="px-3 sm:px-3.5 py-1 bg-neon-mint text-deep-ocean text-[11px] sm:text-xs font-black rounded-xl shadow-[0_0_10px_rgba(0,255,163,0.3)] hover:bg-[#1ed49c] active:scale-95 transition-all cursor-pointer"
            >
              REGISTER
            </button>
          </div>
        ) : (
          /* Authenticated State: Profile & Logout */
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Link
              href="/profile"
              data-testid="header-profile-link"
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
              data-testid="header-logout-btn"
              onClick={() => logout()}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors cursor-pointer"
              title="Log Out"
              aria-label="Log Out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        {/* Balance Chip / 1-Tap Deposit Trigger */}
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
