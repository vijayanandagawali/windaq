"use client";

import React from 'react';
import { Home, Rocket, Plus, Spade, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';

const TABLE_PATHS = ['/european-roulette', '/dragon-tiger', '/andar-bahar', '/blackjack'];

export default function BottomNav() {
  const pathname = usePathname();
  const { setDepositing } = useWalletStore();

  const item = (active: boolean) =>
    `min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'}`;
  const onTables = TABLE_PATHS.some((p) => pathname.includes(p));

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between shadow-[0_-8px_30px_rgba(15,23,42,0.08)] max-w-lg mx-auto"
    >
      <Link href="/" className={item(pathname === '/')} aria-label="Lobby">
        <Home size={20} strokeWidth={pathname === '/' ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold leading-none">Lobby</span>
      </Link>

      <Link href="/games/aviator" className={item(pathname.includes('/aviator'))} aria-label="Aviator">
        <Rocket size={20} strokeWidth={pathname.includes('/aviator') ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold leading-none">Aviator</span>
      </Link>

      {/* Center: deposit */}
      <div className="relative -top-5 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDepositing(true)}
          className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-[0_10px_24px_rgba(5,150,105,0.45)] border-4 border-white text-white hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          aria-label="Deposit"
        >
          <Plus size={26} strokeWidth={3} />
        </button>
        <span className="text-[9px] font-black text-emerald-600 tracking-wider block text-center mt-0.5 select-none">DEPOSIT</span>
      </div>

      <Link href="/?cat=table" className={item(onTables)} aria-label="Table games">
        <Spade size={20} strokeWidth={onTables ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold leading-none">Tables</span>
      </Link>

      <Link href="/wallet" className={item(pathname.includes('/wallet'))} aria-label="Wallet">
        <Wallet size={20} strokeWidth={pathname.includes('/wallet') ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold leading-none">Wallet</span>
      </Link>
    </nav>
  );
}
