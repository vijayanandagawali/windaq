"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Gift, Zap, ShieldCheck, Trophy } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';

export default function NotifDrawer() {
  const { isNotifOpen, setNotifOpen } = useWalletStore();

  React.useEffect(() => {
    if (!isNotifOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNotifOpen, setNotifOpen]);

  if (!isNotifOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setNotifOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm bg-gradient-to-b from-white via-white to-slate-50 border border-slate-200 rounded-3xl p-5 shadow-[0_0_50px_rgba(15,23,42,0.18)] text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-neon-mint" />
              <h3 className="text-slate-900 font-black text-base tracking-wide">SYSTEM NOTIFICATIONS</h3>
            </div>
            <button 
              onClick={() => setNotifOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-white/90 border border-slate-200 rounded-2xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-neon-mint/20 text-neon-mint flex items-center justify-center flex-shrink-0">
                <Gift size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">₹10,000 Welcome Balance Active!</div>
                <p className="text-[11px] text-slate-600 mt-0.5">Your deposit of ₹10,000 was confirmed and added to your wallet.</p>
                <span className="text-[9px] text-slate-500 mt-1 block">Today, 02:15 PM</span>
              </div>
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-600 flex items-center justify-center flex-shrink-0">
                <Trophy size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Daily Lucky Spin is Ready!</div>
                <p className="text-[11px] text-slate-600 mt-0.5">You have 1 FREE spin waiting on the Lucky Wheel. Win up to ₹2,500 real cash.</p>
                <span className="text-[9px] text-slate-500 mt-1 block">Today, 12:00 PM</span>
              </div>
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Zap size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Gold VIP Unlocked</div>
                <p className="text-[11px] text-slate-600 mt-0.5">You are now eligible for 7% daily loss cashback and instant 10-second withdrawals.</p>
                <span className="text-[9px] text-slate-500 mt-1 block">Yesterday</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setNotifOpen(false)}
            className="w-full mt-4 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            DISMISS
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
