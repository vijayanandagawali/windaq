"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';

export default function WithdrawModal() {
  const { balance, isWithdrawing, setWithdrawing, withdraw, userId } = useWalletStore();
  const { user, token, isAuthenticated, openAuthModal } = useAuthStore();
  const activeUserId = user?.id || userId || '';
  const [amount, setAmount] = useState(1000);
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isWithdrawing && !isAuthenticated) {
      setWithdrawing(false);
      openAuthModal('LOGIN');
      toast.error('Please login to withdraw funds');
    }
  }, [isWithdrawing, isAuthenticated, setWithdrawing, openAuthModal]);

  if (!isWithdrawing || !isAuthenticated) return null;

  const handleWithdraw = async () => {
    if (amount < 200) {
      toast.error('Minimum withdrawal is ₹200');
      return;
    }
    if (amount > balance) {
      toast.error('Insufficient available balance');
      return;
    }
    if (!upiId || !upiId.includes('@')) {
      toast.error('Please enter a valid UPI ID (e.g. name@okhdfcbank)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/payments/withdraw'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': activeUserId,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          amount,
          provider: 'MOCK_UPI',
          destination: upiId
        })
      });
      const data = await res.json();
      setLoading(false);

      if (!data.success) {
        toast.error(data.error || data.message || 'Withdrawal failed. Please check details.');
        return;
      }

      // Simulate webhook taking effect and local wallet decrement
      const ok = withdraw(amount, upiId);
      if (ok) {
        toast.success(`🎉 Withdrawal of ₹${amount.toLocaleString('en-IN')} requested! Payout will be sent to ${upiId}. Status: ${data.data.status}`, {
          duration: 4500
        });
        setWithdrawing(false);
      }
    } catch (err) {
      setLoading(false);
      const ok = withdraw(amount, upiId);
      if (ok) {
        toast.success(`🎉 Withdrawal of ₹${amount.toLocaleString('en-IN')} requested to ${upiId}!`);
        setWithdrawing(false);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setWithdrawing(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm max-h-[88dvh] overflow-y-auto overscroll-contain bg-gradient-to-b from-[#181326] via-[#101322] to-[#070a12] border border-red-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(239,68,68,0.2)] text-left pb-safe"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3 sticky -top-5 bg-[#181326]/95 backdrop-blur-md pt-1 pb-2 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xl">💸</span>
              <h3 className="text-white font-black text-base tracking-wide">INSTANT WITHDRAWAL</h3>
            </div>
            <button 
              onClick={() => setWithdrawing(false)}
              className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer"
              aria-label="Close Withdrawal Modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Balance Preview */}
          <div className="bg-ocean-card/90 border border-white/10 rounded-2xl p-3 mb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase">Available Balance</span>
              <div className="text-lg font-black text-white">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <span className="text-[10px] text-neon-mint font-extrabold bg-neon-mint/10 border border-neon-mint/20 px-2 py-1 rounded-md">
              0% FEE
            </span>
          </div>

          {/* UPI ID Input */}
          <div className="mb-3">
            <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-1.5">
              ENTER UPI ID (GPay / PhonePe / Paytm)
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="username@okhdfcbank"
              className="w-full bg-deep-ocean border border-white/15 rounded-xl py-2.5 px-3 text-white font-bold text-sm outline-none focus:border-red-400"
            />
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-1.5">
              WITHDRAW AMOUNT
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neon-mint font-black text-base">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-deep-ocean border border-white/15 rounded-xl py-2.5 pl-8 pr-3 text-white font-black text-base outline-none focus:border-red-400"
              />
            </div>
          </div>

          {/* Trust Banner */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5 mb-4 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5 text-green-400 font-bold">
              <ShieldCheck size={14} />
              <span>Direct Bank Transfer</span>
            </div>
            <div className="flex items-center gap-1 text-neon-mint font-black">
              <Zap size={12} />
              <span>SPEED: ~30 SECONDS</span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            onClick={handleWithdraw}
            disabled={loading || amount > balance || amount < 200}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-black text-sm tracking-wide shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <ArrowUpRight size={18} strokeWidth={2.5} />
            <span>{loading ? 'SENDING...' : `WITHDRAW ₹${amount.toLocaleString('en-IN')}`}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
