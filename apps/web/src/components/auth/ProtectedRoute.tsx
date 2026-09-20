"use client";

import React from 'react';
import Link from 'next/link';
import { Lock, ShieldAlert, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'USER' | 'ADMIN';
  title?: string;
}

export default function ProtectedRoute({ children, requiredRole = 'USER', title = 'SECURE AREA' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, openAuthModal } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={32} className="text-neon-mint animate-spin mb-3" />
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Verifying Session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-neon-mint/10 border border-neon-mint/30 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(0,255,163,0.2)]">
          <Lock size={28} className="text-neon-mint" />
        </div>
        <h2 className="text-lg font-black text-white tracking-tight uppercase mb-1">
          {title}
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed mb-6">
          You must be logged in to view your private wallet, transactions, and profile records.
        </p>

        <div className="w-full space-y-2.5">
          <button
            onClick={() => openAuthModal('LOGIN')}
            className="w-full py-3 bg-neon-mint text-deep-ocean font-black text-xs rounded-2xl shadow-[0_0_15px_rgba(0,255,163,0.3)] hover:bg-[#1ed49c] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>SIGN IN / REGISTER</span>
            <ArrowRight size={14} strokeWidth={3} />
          </button>

          <button
            onClick={() => openAuthModal('GUEST')}
            className="w-full py-3 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 font-black text-xs rounded-2xl hover:bg-yellow-400/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles size={14} />
            <span>PLAY AS GUEST (TEST MODE)</span>
          </button>

          <Link
            href="/"
            className="block py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            ← Return to Home Lobby
          </Link>
        </div>
      </div>
    );
  }

  if (requiredRole === 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
          <ShieldAlert size={28} className="text-red-400" />
        </div>
        <h2 className="text-lg font-black text-white tracking-tight uppercase mb-1">
          ACCESS RESTRICTED
        </h2>
        <p className="text-xs text-gray-400 leading-relaxed mb-6">
          Administrator privileges are required to access this console.
        </p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all"
        >
          Return to Home Lobby
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
