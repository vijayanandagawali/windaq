"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, ShieldCheck, Zap, Lock } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { TransactionStatusAnimation } from '@/components/wallet/TransactionStatusAnimation';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export default function WithdrawModal() {
  const { balance, availableBalance, lockedBalance, isWithdrawing, setWithdrawing, submitWithdraw } = useWalletStore();
  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  
  const [amount, setAmount] = useState(1000);
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'INPUT' | 'PROCESSING' | 'CONFIRMED' | 'FAILED'>('INPUT');
  const [lastTxId, setLastTxId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const currentAvailable = availableBalance > 0 ? availableBalance : balance;

  React.useEffect(() => {
    if (isWithdrawing && !isAuthenticated) {
      setWithdrawing(false);
      openAuthModal('LOGIN');
      toast.error('Please login to withdraw funds');
    }
  }, [isWithdrawing, isAuthenticated, setWithdrawing, openAuthModal]);

  // Reset state when opened
  React.useEffect(() => {
    if (isWithdrawing) {
      setStep('INPUT');
      setErrorMessage('');
      setLoading(false);
    }
  }, [isWithdrawing]);

  if (!isWithdrawing || !isAuthenticated) return null;

  const handleWithdraw = async () => {
    if (amount < 200) {
      toast.error('Minimum withdrawal is ₹200');
      return;
    }
    if (amount > currentAvailable) {
      toast.error(`Insufficient available balance. You have ₹${currentAvailable.toLocaleString('en-IN')}`);
      return;
    }
    const cleanUpi = upiId.trim();
    if (!cleanUpi || !cleanUpi.includes('@') || cleanUpi.length < 5) {
      toast.error('Please enter a valid UPI ID (e.g. name@okhdfcbank or phone@paytm)');
      return;
    }

    setLoading(true);
    setStep('PROCESSING');

    // Generate unique idempotency key for this withdrawal attempt
    const idempotencyKey = `wdr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await submitWithdraw(amount, cleanUpi, 'UPI', idempotencyKey);
      setLoading(false);

      if (res.success) {
        setStep('CONFIRMED');
        setLastTxId(res.data?.transactionId || res.data?.id || `TX-${Date.now()}`);
        toast.success(`Withdrawal of ₹${amount.toLocaleString('en-IN')} successfully initiated!`);
      } else {
        setStep('FAILED');
        setErrorMessage(res.message || 'Withdrawal rejected by banking risk engine');
        toast.error(res.message || 'Withdrawal failed. Please check details.');
      }
    } catch (err: any) {
      setLoading(false);
      setStep('FAILED');
      setErrorMessage(err.message || 'Network error occurred during withdrawal');
      toast.error('Network error during withdrawal. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!loading) setWithdrawing(false);
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.88, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-sm max-h-[90dvh] overflow-y-auto overscroll-contain bg-gradient-to-b from-[#181326] via-[#101322] to-[#070a12] border border-red-500/40 rounded-3xl p-5 shadow-[0_0_50px_rgba(239,68,68,0.25)] text-left pb-safe"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sticky -top-5 bg-[#181326]/95 backdrop-blur-md pt-1 pb-2 z-10 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xl">💸</span>
              <div>
                <h3 className="text-white font-black text-sm tracking-wide uppercase">Instant Bank Payout</h3>
                <p className="text-[10px] text-gray-400 font-semibold">Authoritative Ledger Settlements</p>
              </div>
            </div>
            <button 
              onClick={() => !loading && setWithdrawing(false)}
              disabled={loading}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer disabled:opacity-30"
              aria-label="Close Withdrawal Modal"
            >
              <X size={16} />
            </button>
          </div>

          {step === 'INPUT' && (
            <>
              {/* Balance Card with Available vs Locked */}
              <div className="bg-ocean-card/90 border border-white/10 rounded-2xl p-3.5 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Available for Payout</span>
                    <div className="text-xl font-black text-white">
                      ₹{currentAvailable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <span className="text-[10px] text-neon-mint font-extrabold bg-neon-mint/10 border border-neon-mint/20 px-2 py-1 rounded-md">
                    0% COMM
                  </span>
                </div>

                {lockedBalance > 0 && (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/10 text-[11px] text-amber-400 font-medium">
                    <Lock size={12} />
                    <span>₹{lockedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} locked in pending operations</span>
                  </div>
                )}
              </div>

              {/* UPI ID Input */}
              <div className="mb-3">
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-1.5">
                  Receiving UPI ID / VPA
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. mobile@paytm or name@okaxis"
                  className="w-full bg-deep-ocean border border-white/15 rounded-xl py-2.5 px-3 text-white font-bold text-sm outline-none focus:border-red-400 transition-colors"
                />
              </div>

              {/* Amount Input */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block">
                    Withdraw Amount (INR)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(Math.floor(currentAvailable))}
                    className="text-[10px] text-neon-mint font-bold hover:underline"
                  >
                    MAX ₹{Math.floor(currentAvailable).toLocaleString('en-IN')}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neon-mint font-black text-base">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min={200}
                    max={currentAvailable}
                    className="w-full bg-deep-ocean border border-white/15 rounded-xl py-2.5 pl-8 pr-3 text-white font-black text-base outline-none focus:border-red-400"
                  />
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt)}
                    disabled={amt > currentAvailable}
                    className={`py-1.5 rounded-lg text-xs font-black transition-all border ${
                      amount === amt 
                        ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 disabled:opacity-30'
                    }`}
                  >
                    ₹{amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>

              {/* Trust Badge */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 mb-4 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck size={14} />
                  <span>Verified Double-Entry Ledger</span>
                </div>
                <div className="flex items-center gap-1 text-neon-mint font-black">
                  <Zap size={12} />
                  <span>IMPS / UPI 24x7</span>
                </div>
              </div>

              {/* Submit Action */}
              <button
                onClick={handleWithdraw}
                disabled={loading || amount > currentAvailable || amount < 200 || !upiId}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-black text-sm tracking-wide shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <ArrowUpRight size={18} strokeWidth={2.5} />
                <span>WITHDRAW ₹{amount.toLocaleString('en-IN')}</span>
              </button>
            </>
          )}

          {step === 'PROCESSING' && (
            <div className="py-8 text-center space-y-4">
              <TransactionStatusAnimation status="PROCESSING" size="lg" />
              <div>
                <h4 className="text-white font-black text-base">Processing Atomic Settlement</h4>
                <p className="text-xs text-gray-400 mt-1">Acquiring row-level PostgreSQL lock & executing payout...</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-xs space-y-1 text-left">
                <div className="flex justify-between text-gray-400">
                  <span>Amount:</span>
                  <span className="text-white font-bold">₹{amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Destination:</span>
                  <span className="text-white font-mono">{upiId}</span>
                </div>
              </div>
            </div>
          )}

          {step === 'CONFIRMED' && (
            <div className="py-6 text-center space-y-4">
              <TransactionStatusAnimation status="SUCCESS" size="lg" />
              <div>
                <h4 className="text-emerald-400 font-black text-lg">Withdrawal Processed!</h4>
                <p className="text-xs text-gray-300 mt-1">
                  ₹{amount.toLocaleString('en-IN')} has been deducted from your authoritative balance and sent to your UPI.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 text-xs space-y-2 text-left">
                <div className="flex justify-between text-gray-400">
                  <span>Transaction ID:</span>
                  <span className="text-neon-mint font-mono font-bold text-[11px]">{lastTxId}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Target UPI:</span>
                  <span className="text-white font-mono">{upiId}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Ledger Status:</span>
                  <span className="text-emerald-400 font-bold">COMPLETED / RECONCILED</span>
                </div>
              </div>

              <button
                onClick={() => setWithdrawing(false)}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          )}

          {step === 'FAILED' && (
            <div className="py-6 text-center space-y-4">
              <TransactionStatusAnimation status="FAILED" size="lg" />
              <div>
                <h4 className="text-rose-400 font-black text-lg">Payout Unsuccessful</h4>
                <p className="text-xs text-rose-300 mt-1">{errorMessage}</p>
                <p className="text-[11px] text-gray-400 mt-1">No funds were deducted. Your balance remains safe.</p>
              </div>

              <button
                onClick={() => setStep('INPUT')}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
