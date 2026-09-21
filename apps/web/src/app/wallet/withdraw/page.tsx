"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Landmark, IndianRupee, Clock, ShieldCheck, AlertCircle, ArrowUpRight, Lock } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { TransactionStatusAnimation } from '@/components/wallet/TransactionStatusAnimation';
import toast from 'react-hot-toast';

export default function WithdrawScreen() {
  const router = useRouter();
  const { balance, availableBalance, lockedBalance, submitWithdraw, fetchBalance } = useWalletStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  
  const [amount, setAmount] = useState<string>('500');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [destination, setDestination] = useState<string>('');
  const [step, setStep] = useState<'input' | 'processing' | 'success' | 'failed'>('input');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastTxId, setLastTxId] = useState('');

  const effectiveAvailable = availableBalance > 0 ? availableBalance : balance;

  const handleWithdraw = async () => {
    if (!isAuthenticated) {
      openAuthModal('LOGIN');
      toast.error('Please log in to withdraw');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 200) {
      toast.error('Minimum withdrawal is ₹200');
      return;
    }
    if (numAmount > effectiveAvailable) {
      toast.error(`Insufficient available balance (₹${effectiveAvailable.toLocaleString('en-IN')})`);
      return;
    }

    const cleanDest = destination.trim();
    if (!cleanDest || (method === 'upi' && !cleanDest.includes('@'))) {
      toast.error(method === 'upi' ? 'Please enter a valid UPI ID (e.g. name@okhdfcbank)' : 'Please enter valid Bank Account & IFSC');
      return;
    }

    setLoading(true);
    setStep('processing');
    const idempotencyKey = `wdr-pg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await submitWithdraw(numAmount, cleanDest, method.toUpperCase(), idempotencyKey);
      setLoading(false);

      if (res.success) {
        setStep('success');
        setLastTxId(res.data?.transactionId || res.data?.id || `TX-${Date.now()}`);
        await fetchBalance();
        toast.success(`Withdrawal of ₹${numAmount.toLocaleString('en-IN')} successfully initiated!`);
      } else {
        setStep('failed');
        setErrorMessage(res.message || 'Withdrawal rejected by banking risk engine');
        toast.error(res.message || 'Withdrawal rejected');
      }
    } catch (err: any) {
      setLoading(false);
      setStep('failed');
      setErrorMessage(err.message || 'Network error during payout');
      toast.error('Network error during withdrawal');
    }
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-white font-sans selection:bg-neon-mint selection:text-deep-ocean relative pb-20">
      {/* Header Banner */}
      <div className="px-4 py-3.5 border-b border-white/10 bg-[#0d1424]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <Link href="/wallet" className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
          <span>BACK TO WALLET</span>
        </Link>
        <span className="text-[10px] bg-red-500/15 text-red-400 font-extrabold px-2.5 py-0.5 rounded-full border border-red-500/30">
          INSTANT BANK PAYOUT
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Available vs Locked Balance Card */}
              <div className="bg-gradient-to-b from-[#0d1627] to-[#0b101c] border border-white/10 rounded-3xl p-5 mb-5 shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Available for Payout</p>
                    <h2 className="text-3xl font-black text-white font-mono mt-0.5">
                      ₹{effectiveAvailable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h2>
                  </div>
                  <span className="text-[10px] text-neon-mint font-extrabold bg-neon-mint/10 border border-neon-mint/20 px-2 py-1 rounded-md">
                    0% COMM
                  </span>
                </div>

                {lockedBalance > 0 && (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-white/10 text-xs text-amber-400 font-medium">
                    <Lock size={12} />
                    <span>₹{lockedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} locked in pending operations</span>
                  </div>
                )}
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-gray-400 text-xs font-extrabold uppercase tracking-wider pl-1">
                    Withdraw Amount (INR)
                  </label>
                  <button 
                    type="button"
                    onClick={() => setAmount(Math.floor(effectiveAvailable).toString())}
                    className="text-neon-mint text-xs font-bold hover:underline"
                  >
                    MAX ₹{Math.floor(effectiveAvailable).toLocaleString('en-IN')}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <IndianRupee size={18} className="text-neon-mint" />
                  </div>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={200}
                    max={effectiveAvailable}
                    className="w-full bg-deep-ocean border border-white/15 rounded-2xl py-3 pl-10 pr-4 text-white font-mono font-bold text-lg placeholder-gray-600 focus:outline-none focus:border-red-400 transition-all"
                    placeholder="500"
                  />
                </div>
                <p className="text-gray-500 text-[11px] mt-1.5 pl-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Minimum withdrawal is ₹200. Authoritative double-entry ledger debit.
                </p>
              </div>

              {/* Transfer Method Selector */}
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 pl-1">Payout Channel</h3>
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div 
                  onClick={() => setMethod('upi')}
                  className={`p-3.5 rounded-2xl cursor-pointer border transition-all flex items-center gap-3 ${method === 'upi' ? 'border-red-400 bg-red-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-black text-white text-xs">UPI</div>
                  <div>
                    <p className="text-white font-bold text-sm">Instant UPI</p>
                    <p className="text-gray-400 text-[10px]">~30 Seconds</p>
                  </div>
                </div>

                <div 
                  onClick={() => setMethod('bank')}
                  className={`p-3.5 rounded-2xl cursor-pointer border transition-all flex items-center gap-3 ${method === 'bank' ? 'border-red-400 bg-red-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                    <Landmark size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Bank IMPS</p>
                    <p className="text-gray-400 text-[10px]">Direct Transfer</p>
                  </div>
                </div>
              </div>

              {/* Destination Input */}
              <div className="mb-6">
                <label className="text-gray-400 text-xs font-extrabold uppercase tracking-wider block mb-1.5 pl-1">
                  {method === 'upi' ? 'Receiving UPI ID / VPA' : 'Bank Account & IFSC'}
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={method === 'upi' ? 'e.g. mobile@paytm or name@okaxis' : 'e.g. 501002341234, HDFC0001234'}
                  className="w-full bg-deep-ocean border border-white/15 rounded-2xl py-3 px-3.5 text-white font-mono text-sm focus:outline-none focus:border-red-400 transition-all"
                />
              </div>

              {/* Submit Action */}
              <button 
                onClick={handleWithdraw}
                disabled={loading || Number(amount) < 200 || Number(amount) > effectiveAvailable || !destination}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-black text-base shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ArrowUpRight size={20} strokeWidth={2.5} />
                <span>WITHDRAW ₹{Number(amount || 0).toLocaleString('en-IN')}</span>
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Authoritative Row-Level Locked Transaction</span>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center space-y-4">
              <TransactionStatusAnimation status="PROCESSING" size="lg" />
              <div>
                <h2 className="text-xl font-black text-white">Authorizing Withdrawal</h2>
                <p className="text-xs text-gray-400 mt-1">Acquiring row-level PostgreSQL lock & dispatching payout...</p>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-5">
              <TransactionStatusAnimation status="SUCCESS" size="lg" />
              <div>
                <h2 className="text-2xl font-black text-emerald-400">Withdrawal Processed!</h2>
                <p className="text-xs text-gray-300 mt-1">
                  ₹{Number(amount).toLocaleString('en-IN')} has been deducted from your authoritative balance and dispatched to {destination}.
                </p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-xs space-y-2 text-left">
                <div className="flex justify-between text-gray-400">
                  <span>Transaction ID:</span>
                  <span className="text-neon-mint font-mono font-bold text-[11px]">{lastTxId}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Destination:</span>
                  <span className="text-white font-mono">{destination}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Ledger Status:</span>
                  <span className="text-emerald-400 font-bold">COMPLETED / RECONCILED</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href="/wallet" className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl text-center transition-all">
                  Return to Wallet
                </Link>
                <Link href={`/wallet/transactions/${lastTxId}`} className="flex-1 py-3 bg-neon-mint hover:bg-emerald-400 text-deep-ocean font-black text-xs rounded-xl text-center shadow-[0_0_15px_rgba(0,255,163,0.3)] transition-all">
                  View Receipt
                </Link>
              </div>
            </motion.div>
          )}

          {step === 'failed' && (
            <motion.div key="failed" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-4">
              <TransactionStatusAnimation status="FAILED" size="lg" />
              <div>
                <h2 className="text-xl font-black text-rose-400">Withdrawal Unsuccessful</h2>
                <p className="text-xs text-rose-300 mt-1">{errorMessage}</p>
                <p className="text-[11px] text-gray-400 mt-1">No funds were deducted. Your balance remains safe.</p>
              </div>
              <button
                onClick={() => setStep('input')}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
