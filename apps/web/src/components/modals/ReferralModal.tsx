"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, Users, IndianRupee } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';

export default function ReferralModal() {
  const { isReferralOpen, setReferralOpen, referralCode } = useWalletStore();
  const [copied, setCopied] = useState(false);

  if (!isReferralOpen) return null;

  const referralLink = `https://windaq.vip/join?ref=${referralCode}`;
  const shareText = `🔥 Play on WinDaq (विन डैक) - India's #1 Real Money Gaming Platform! Get ₹1,000 Sign Up Bonus + 200% Deposit Match instantly. Use my invite code: ${referralCode} 👉 ${referralLink}`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success('Referral Code Copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setReferralOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm max-h-[88dvh] overflow-y-auto overscroll-contain pb-safe bg-gradient-to-b from-white via-white to-slate-50 border border-emerald-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(16,185,129,0.25)] text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 sticky -top-5 bg-white/90 backdrop-blur-md pt-1 pb-2 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎁</span>
              <h3 className="text-slate-900 font-black text-base tracking-wide">REFER & EARN</h3>
            </div>
            <button 
              onClick={() => setReferralOpen(false)}
              className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
              aria-label="Close Referral Modal"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-slate-600 text-xs mb-4">
            Invite friends to WinDaq. Earn <b className="text-neon-mint">₹200 instant cash</b> on every friend&apos;s signup plus <b className="text-neon-mint">30% lifetime commission</b> on every bet!
          </p>

          {/* Stats Box */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-white/90 border border-slate-200 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-neon-mint mb-1">
                <Users size={16} />
              </div>
              <div className="text-lg font-black text-slate-900">4 Friends</div>
              <div className="text-[10px] text-slate-500">Total Joined</div>
            </div>

            <div className="bg-white/90 border border-slate-200 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
                <IndianRupee size={16} />
              </div>
              <div className="text-lg font-black text-yellow-600">₹1,650</div>
              <div className="text-[10px] text-slate-500">Earned So Far</div>
            </div>
          </div>

          {/* Referral Code Box */}
          <div className="bg-deep-ocean border border-dashed border-neon-mint/50 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest block">YOUR REFERRAL CODE</span>
              <span className="text-xl font-black text-slate-900 tracking-widest">{referralCode}</span>
            </div>
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-neon-mint text-deep-ocean font-black text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,163,0.4)] active:scale-95 transition-all"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>

          {/* WhatsApp Share Button */}
          <button
            onClick={handleWhatsAppShare}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black text-sm tracking-wide shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 transition-transform flex items-center justify-center gap-2 mb-2"
          >
            <Share2 size={16} />
            <span>INVITE VIA WHATSAPP</span>
          </button>

          <button
            onClick={() => setReferralOpen(false)}
            className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            CLOSE
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
