"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, ShieldCheck, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';

export default function VipClubModal() {
  const { isVipOpen, setVipOpen, vipTier, vipPoints, claimCashback } = useWalletStore();
  const [claimed, setClaimed] = useState(false);

  React.useEffect(() => {
    if (!isVipOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVipOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVipOpen, setVipOpen]);

  if (!isVipOpen) return null;

  const cashbackAmount = 380.00;

  const handleClaim = () => {
    if (claimed) return;
    claimCashback(cashbackAmount);
    setClaimed(true);
    toast.success(`🎉 ₹${cashbackAmount.toFixed(2)} VIP Cashback credited to your balance!`, {
      duration: 4000
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setVipOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm max-h-[88dvh] overflow-y-auto overscroll-contain pb-safe bg-gradient-to-b from-[#19152b] via-[#121626] to-[#0a0d18] border border-purple-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(168,85,247,0.25)] text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sticky -top-5 bg-[#19152b]/95 backdrop-blur-md pt-1 pb-2 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xl">👑</span>
              <h3 className="text-white font-black text-base tracking-wide">WINDAQ VIP LOYALTY CLUB</h3>
            </div>
            <button 
              onClick={() => setVipOpen(false)}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
              aria-label="Close VIP Modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Current VIP Metal Card */}
          <div className="bg-gradient-to-r from-amber-600/30 via-yellow-600/20 to-amber-900/40 border border-yellow-500/50 rounded-2xl p-4 mb-4 relative overflow-hidden shadow-[0_4px_20px_rgba(234,179,8,0.2)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1">
                <Crown size={14} /> {vipTier} VIP TIER
              </span>
              <span className="text-xs font-extrabold text-white">{vipPoints} PTS</span>
            </div>

            <div className="text-2xl font-black text-white tracking-tight mb-2">
              7% Daily Loss Cashback
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden mb-1">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-amber-500 h-full rounded-full transition-all"
                style={{ width: `${(vipPoints / 5000) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Current: {vipPoints} pts</span>
              <span>Platinum: 5,000 pts</span>
            </div>
          </div>

          {/* Daily Cashback Claim Card */}
          <div className="bg-ocean-card/90 border border-white/10 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase">Available Cashback</div>
              <div className="text-lg font-black text-neon-mint">₹{cashbackAmount.toFixed(2)}</div>
            </div>
            <button
              onClick={handleClaim}
              disabled={claimed}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                claimed
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-neon-mint text-deep-ocean shadow-[0_0_15px_rgba(0,255,163,0.4)] active:scale-95'
              }`}
            >
              {claimed ? 'CLAIMED TODAY' : 'CLAIM CASHBACK'}
            </button>
          </div>

          {/* VIP Perks */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={14} className="text-neon-mint flex-shrink-0" />
              <span>Priority 10-second instant UPI withdrawals</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={14} className="text-neon-mint flex-shrink-0" />
              <span>Personal 24/7 VIP Telegram account manager</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={14} className="text-neon-mint flex-shrink-0" />
              <span>Weekly 200% VIP reload bonus</span>
            </div>
          </div>

          <button
            onClick={() => setVipOpen(false)}
            className="w-full py-3 rounded-xl bg-white/10 text-white font-black text-xs hover:bg-white/15 transition-colors"
          >
            CLOSE
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
