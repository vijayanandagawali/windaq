"use client";

import React, { useEffect } from 'react';
import { ShieldCheck, Plus, Bell, LogOut, ChevronLeft, Flame, Rocket, Spade, Dices, Trophy, Volume2, VolumeX, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { useAudioStore } from '@/store/audioStore';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { balance, setDepositing, setNotifOpen, fetchBalance } = useWalletStore();
  const { isAuthenticated, user, logout, openAuthModal, loginAsGuest } = useAuthStore();
  const { soundEnabled, volume, setControlsOpen } = useAudioStore();

  const isHome = pathname === '/';

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, isAuthenticated]);

  const handleDepositClick = () => {
    setDepositing(true);
  };

  const TABLE_PATHS = ['/european-roulette', '/dragon-tiger', '/andar-bahar', '/blackjack'];
  const DRAW_PATHS = ['/color-prediction', '/colour-prediction', '/dice', '/lotto'];
  const navLinks = [
    { name: 'Lobby', href: '/', icon: Flame, match: pathname === '/' },
    { name: 'Aviator', href: '/games/aviator', icon: Rocket, match: pathname.includes('/aviator') },
    { name: 'Table Games', href: '/?cat=table', icon: Spade, match: TABLE_PATHS.some((p) => pathname.includes(p)) },
    { name: 'Draws & Dice', href: '/?cat=draws', icon: Dices, match: DRAW_PATHS.some((p) => pathname.includes(p)) },
    { name: 'Slots', href: '/?cat=instant', icon: Trophy, match: pathname.includes('/slots') || pathname.includes('/scratch') },
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
        </nav>
      </div>

      {/* Header Right Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">

        {/* Notification Bell */}
        <button
          onClick={() => setNotifOpen(true)}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors cursor-pointer"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={14} className="text-gray-300" />
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
