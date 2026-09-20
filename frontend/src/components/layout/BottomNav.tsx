"use client";

import React from 'react';
import { Home, Rocket, Sparkles, Gift, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWalletStore } from '@/store/walletStore';

export default function BottomNav() {
  const pathname = usePathname();
  const { setSpinOpen, setVipOpen } = useWalletStore();

  const handleSpinClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
    setSpinOpen(true);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0d18]/95 backdrop-blur-lg border-t border-white/10 px-4 py-2 flex items-center justify-between shadow-[0_-4px_25px_rgba(0,0,0,0.7)] max-w-lg mx-auto">
      {/* 1. Home */}
      <Link 
        href="/" 
        className={`flex flex-col items-center gap-1 transition-colors ${pathname === '/' ? 'text-neon-mint' : 'text-gray-400 hover:text-gray-200'}`}
      >
        <Home size={20} strokeWidth={pathname === '/' ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold">Home</span>
      </Link>

      {/* 2. Crash Games */}
      <Link 
        href="/games/aviator" 
        className={`flex flex-col items-center gap-1 transition-colors ${pathname.includes('/aviator') ? 'text-neon-mint' : 'text-gray-400 hover:text-gray-200'}`}
      >
        <Rocket size={20} strokeWidth={pathname.includes('/aviator') ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold">Crash</span>
      </Link>

      {/* 3. Center Elevated Spin Button */}
      <div className="relative -top-5">
        <button 
          onClick={handleSpinClick}
          className="w-14 h-14 bg-gradient-to-tr from-yellow-400 via-amber-500 to-yellow-300 rounded-full flex flex-col items-center justify-center shadow-[0_0_25px_rgba(234,179,8,0.6)] border-4 border-[#070a14] text-deep-ocean hover:scale-105 active:scale-95 transition-transform group"
          title="Daily Lucky Spin"
        >
          <span className="text-2xl group-hover:rotate-12 transition-transform">🎰</span>
        </button>
        <span className="text-[9px] font-black text-yellow-400 tracking-wider block text-center mt-0.5">SPIN</span>
      </div>

      {/* 4. VIP / Promos */}
      <button 
        onClick={() => setVipOpen(true)} 
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Gift size={20} />
        <span className="text-[10px] font-extrabold">VIP Club</span>
      </button>

      {/* 5. Wallet */}
      <Link 
        href="/wallet" 
        className={`flex flex-col items-center gap-1 transition-colors ${pathname.includes('/wallet') ? 'text-neon-mint' : 'text-gray-400 hover:text-gray-200'}`}
      >
        <Wallet size={20} strokeWidth={pathname.includes('/wallet') ? 2.5 : 2} />
        <span className="text-[10px] font-extrabold">Wallet</span>
      </Link>
    </nav>
  );
}
