"use client";

import React, { useEffect } from 'react';
import { ShieldCheck, Plus, Bell, LogOut, ChevronLeft, Flame, Rocket, Spade, Dices, Trophy, Volume2, VolumeX, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { useAudioStore } from '@/store/audioStore';

const TABLE_PATHS = ['/european-roulette', '/dragon-tiger', '/andar-bahar', '/blackjack'];
const DRAW_PATHS = ['/color-prediction', '/colour-prediction', '/dice', '/lotto'];

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

  const navLinks = [
    { name: 'Lobby', href: '/', icon: Flame, match: pathname === '/' },
    { name: 'Aviator', href: '/games/aviator', icon: Rocket, match: pathname.includes('/aviator') },
    { name: 'Table Games', href: '/?cat=table', icon: Spade, match: TABLE_PATHS.some((p) => pathname.includes(p)) },
    { name: 'Draws & Dice', href: '/?cat=draws', icon: Dices, match: DRAW_PATHS.some((p) => pathname.includes(p)) },
    { name: 'Slots', href: '/?cat=instant', icon: Trophy, match: pathname.includes('/slots') || pathname.includes('/scratch') },
  ];

  const iconButton = 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm transition cursor-pointer';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 px-3 pb-2.5 pt-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 sm:px-5">
      <div aria-hidden="true" className="tiranga-strip absolute inset-x-0 top-0 h-[3px] opacity-90" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        {/* Brand & back */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {!isHome && (
            <button onClick={() => router.back()} className={iconButton} title="Go back" aria-label="Back">
              <ChevronLeft size={18} />
            </button>
          )}

          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-500 text-base font-black text-white shadow-[0_8px_20px_rgba(16,185,129,0.35)] transition-transform group-hover:scale-105 group-hover:rotate-3">
              W
            </span>
            {/* On small phones inner pages show only the mark, leaving room for the back button and wallet. */}
            <span className={`leading-none ${isHome ? '' : 'hidden min-[430px]:block'}`}>
              <span className="block text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">WinDaq</span>
              <span className="mt-0.5 hidden items-center gap-1 text-[10px] font-semibold text-slate-500 min-[380px]:flex">
                <ShieldCheck size={11} className="text-emerald-600" /> Provably fair
              </span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 border-l border-slate-200 pl-4 lg:flex" aria-label="Main">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.name} href={item.href}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
                    item.match ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}>
                  <Icon size={15} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button onClick={() => setNotifOpen(true)} className={`${iconButton} hidden min-[400px]:flex`} title="Notifications" aria-label="Notifications">
            <Bell size={15} />
          </button>

          <button onClick={() => setControlsOpen(true)} data-testid="header-sound-btn" role="button"
            className={`${iconButton} ${soundEnabled ? '' : 'text-rose-500'} hidden min-[430px]:flex`}
            title={soundEnabled ? `Sound on (${Math.round(volume * 100)}%)` : 'Sound muted'}
            aria-label={soundEnabled ? 'Sound Settings (Active)' : 'Sound Settings (Muted)'}>
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {!isAuthenticated ? (
            <div className="flex items-center gap-1.5">
              <button data-testid="header-guest-btn" onClick={() => loginAsGuest()}
                className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-100 min-[420px]:flex"
                title="Play with play money">
                <Sparkles size={12} /> Guest
              </button>
              <button data-testid="header-login-btn" onClick={() => openAuthModal('LOGIN')}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
                Log in
              </button>
              <button data-testid="header-register-btn" onClick={() => openAuthModal('REGISTER')}
                className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)] transition hover:brightness-105">
                Sign up
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/profile" data-testid="header-profile-link" title="My profile"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 transition hover:border-slate-300">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-emerald-500 text-[10px] font-black text-white">
                  {user?.isGuest ? 'G' : (user?.phone ? user.phone.slice(-2) : 'U')}
                </span>
                <span className="hidden text-xs font-bold text-slate-700 sm:inline">
                  {user?.isGuest ? 'Guest' : (user?.phone ? user.phone.slice(-4) : 'Profile')}
                </span>
              </Link>
              <button data-testid="header-logout-btn" onClick={() => logout()} className={`${iconButton} hidden hover:text-rose-600 min-[430px]:flex`} title="Log out" aria-label="Log Out">
                <LogOut size={14} />
              </button>
            </div>
          )}

          <button data-testid="header-deposit-btn" role="button" aria-label="Deposit Funds" onClick={() => setDepositing(true)}
            className="group flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 py-1 pl-3 pr-1 text-white shadow-[0_6px_18px_rgba(5,150,105,0.35)] transition hover:shadow-[0_8px_24px_rgba(5,150,105,0.45)]">
            <span className="text-xs font-extrabold tabular-nums tracking-tight sm:text-[13px]">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-emerald-600 transition-transform group-hover:rotate-90 sm:h-7 sm:w-7">
              <Plus size={14} strokeWidth={3} />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
