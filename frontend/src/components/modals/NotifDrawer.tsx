"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Gift, Zap, ShieldCheck, Trophy } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';

export default function NotifDrawer() {
  const { isNotifOpen, setNotifOpen } = useWalletStore();

  if (!isNotifOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setNotifOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm bg-gradient-to-b from-[#11192e] via-[#0e1322] to-[#070a12] border border-white/10 rounded-3xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-neon-mint" />
              <h3 className="text-white font-black text-base tracking-wide">SYSTEM NOTIFICATIONS</h3>
            </div>
            <button 
              onClick={() => setNotifOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-ocean-card/90 border border-white/5 rounded-2xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-neon-mint/20 text-neon-mint flex items-center justify-center flex-shrink-0">
                <Gift size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">₹10,000 Welcome Balance Active!</div>
                <p className="text-[11px] text-gray-300 mt-0.5">Your deposit of ₹10,000 was confirmed and added to your wallet.</p>
                <span className="text-[9px] text-gray-500 mt-1 block">Today, 02:15 PM</span>
              </div>
            </div>

            <div className="bg-ocean-card/90 border border-white/5 rounded-2xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center flex-shrink-0">
                <Trophy size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Daily Lucky Spin is Ready!</div>
                <p className="text-[11px] text-gray-300 mt-0.5">You have 1 FREE spin waiting on the Lucky Wheel. Win up to ₹2,500 real cash.</p>
                <span className="text-[9px] text-gray-500 mt-1 block">Today, 12:00 PM</span>
              </div>
            </div>

            <div className="bg-ocean-card/90 border border-white/5 rounded-2xl p-3 flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Zap size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Gold VIP Unlocked</div>
                <p className="text-[11px] text-gray-300 mt-0.5">You are now eligible for 7% daily loss cashback and instant 10-second withdrawals.</p>
                <span className="text-[9px] text-gray-500 mt-1 block">Yesterday</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setNotifOpen(false)}
            className="w-full mt-4 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15 transition-colors"
          >
            DISMISS
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
