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
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm bg-gradient-to-b from-[#11241f] via-[#101b22] to-[#0a0d16] border border-emerald-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(16,185,129,0.25)] text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎁</span>
              <h3 className="text-white font-black text-base tracking-wide">REFER & EARN</h3>
            </div>
            <button 
              onClick={() => setReferralOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-gray-300 text-xs mb-4">
            Invite friends to WinDaq. Earn <b className="text-neon-mint">₹200 instant cash</b> on every friend's signup plus <b className="text-neon-mint">30% lifetime commission</b> on every bet!
          </p>

          {/* Stats Box */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-ocean-card/90 border border-white/10 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-neon-mint mb-1">
                <Users size={16} />
              </div>
              <div className="text-lg font-black text-white">4 Friends</div>
              <div className="text-[10px] text-gray-400">Total Joined</div>
            </div>

            <div className="bg-ocean-card/90 border border-white/10 rounded-2xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
                <IndianRupee size={16} />
              </div>
              <div className="text-lg font-black text-yellow-400">₹1,650</div>
              <div className="text-[10px] text-gray-400">Earned So Far</div>
            </div>
          </div>

          {/* Referral Code Box */}
          <div className="bg-deep-ocean border border-dashed border-neon-mint/50 rounded-2xl p-3.5 mb-4 flex items-center justify-between">
            <div>
              <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest block">YOUR REFERRAL CODE</span>
              <span className="text-xl font-black text-white tracking-widest">{referralCode}</span>
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
            className="w-full py-2.5 rounded-xl bg-white/5 text-gray-300 font-bold text-xs hover:bg-white/10 transition-colors"
          >
            CLOSE
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
