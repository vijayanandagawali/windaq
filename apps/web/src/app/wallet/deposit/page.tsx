"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Wallet, ShieldCheck, CheckCircle2, Copy, ArrowDownLeft, Zap } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { TransactionStatusAnimation } from '@/components/wallet/TransactionStatusAnimation';
import toast from 'react-hot-toast';

const CHIPS = [100, 500, 1000, 2000, 5000, 10000];
const GATEWAYS = [
  { id: 'upi', name: 'Instant UPI / QR', icon: 'UPI', tag: 'Fastest' },
  { id: 'gpay', name: 'Google Pay', icon: 'GPay', tag: 'Direct' },
  { id: 'phonepe', name: 'PhonePe UPI', icon: 'Pe', tag: 'Direct' },
  { id: 'paytm', name: 'Paytm UPI', icon: 'Paytm', tag: 'Direct' },
];

export default function DepositScreen() {
  const router = useRouter();
  const { balance, submitDeposit, fetchBalance } = useWalletStore();
  const { isAuthenticated, openAuthModal } = useAuthStore();
  
  const [amount, setAmount] = useState<number>(1000);
  const [selectedGateway, setSelectedGateway] = useState('upi');
  const [utr, setUtr] = useState<string>('');
  const [step, setStep] = useState<'input' | 'intent' | 'processing' | 'success' | 'failed'>('input');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastTxId, setLastTxId] = useState('');

  const merchantVpa = process.env.NEXT_PUBLIC_MERCHANT_UPI_ID || 'windaq.merchant@icici';

  const handleInitiate = () => {
    if (!isAuthenticated) {
      openAuthModal('LOGIN');
      toast.error('Please log in to deposit');
      return;
    }
    if (amount < 100) {
      toast.error('Minimum deposit amount is ₹100');
      return;
    }
    setStep('intent');
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    setStep('processing');
    const idempotencyKey = `dep-pg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await submitDeposit(amount, utr, selectedGateway.toUpperCase(), idempotencyKey);
      setLoading(false);

      if (res.success) {
        setStep('success');
        setLastTxId(res.data?.transactionId || res.data?.id || `TX-${Date.now()}`);
        await fetchBalance();
        toast.success(`Deposited ₹${amount.toLocaleString('en-IN')} successfully!`);
      } else {
        setStep('failed');
        setErrorMessage(res.message || 'Payment verification failed');
        toast.error(res.message || 'Payment verification failed');
      }
    } catch (err: any) {
      setLoading(false);
      setStep('failed');
      setErrorMessage(err.message || 'Network error occurred');
      toast.error('Network error during deposit');
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
        <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
          SECURE ESCROW CLEARING
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-gradient-to-b from-[#0d1627] to-[#0b101c] border border-white/10 rounded-3xl p-6 mb-6 shadow-xl text-center">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Enter Deposit Amount (INR)</p>
                <div className="flex items-center justify-center gap-1 mb-6">
                  <span className="text-neon-mint text-3xl font-black">₹</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min={100}
                    className="bg-transparent text-4xl sm:text-5xl font-mono font-black text-white w-48 text-center focus:outline-none placeholder-gray-600"
                    placeholder="1000"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {CHIPS.slice(0, 3).map(chip => (
                    <button 
                      key={chip}
                      type="button"
                      onClick={() => setAmount(chip)}
                      className={`py-2 rounded-xl font-bold text-xs transition-all border cursor-pointer ${amount === chip ? 'bg-neon-mint/20 border-neon-mint text-neon-mint shadow-sm' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                    >
                      ₹{chip}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CHIPS.slice(3).map(chip => (
                    <button 
                      key={chip}
                      type="button"
                      onClick={() => setAmount(chip)}
                      className={`py-2 rounded-xl font-bold text-xs transition-all border cursor-pointer ${amount === chip ? 'bg-neon-mint/20 border-neon-mint text-neon-mint shadow-sm' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                    >
                      ₹{chip >= 1000 ? `${chip / 1000}k` : chip}
                    </button>
                  ))}
                </div>
              </div>

              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <Wallet size={14} className="text-neon-mint" />
                Select Payment Channel
              </h3>
              
              <div className="grid gap-2.5 mb-6">
                {GATEWAYS.map(gateway => (
                  <div 
                    key={gateway.id}
                    onClick={() => setSelectedGateway(gateway.id)}
                    className={`p-3.5 rounded-2xl flex items-center justify-between cursor-pointer border transition-all ${
                      selectedGateway === gateway.id 
                        ? 'border-neon-mint bg-neon-mint/10 shadow-[0_0_15px_rgba(0,255,163,0.15)]' 
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-black text-white text-xs">
                        {gateway.icon}
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{gateway.name}</p>
                        <p className="text-gray-400 text-[10px] font-semibold">{gateway.tag} • Instant Verification</p>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedGateway === gateway.id ? 'border-neon-mint' : 'border-gray-500'}`}>
                      {selectedGateway === gateway.id && <div className="w-2 h-2 bg-neon-mint rounded-full" />}
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleInitiate}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-neon-mint to-emerald-400 hover:from-emerald-400 hover:to-neon-mint text-deep-ocean font-black text-base shadow-[0_0_20px_rgba(0,255,163,0.3)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowDownLeft size={20} strokeWidth={2.5} />
                <span>PROCEED TO PAY ₹{amount.toLocaleString('en-IN')}</span>
              </button>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Authoritative Double-Entry Ledger Protection</span>
              </div>
            </motion.div>
          )}

          {step === 'intent' && (
            <motion.div key="intent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-[#0b101c] border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                <span className="text-[10px] bg-neon-mint/10 text-neon-mint font-bold px-2.5 py-1 rounded-full border border-neon-mint/20">
                  STEP 2: SCAN & PAY
                </span>
                <div>
                  <h2 className="text-xl font-black text-white">Complete ₹{amount.toLocaleString('en-IN')} Transfer</h2>
                  <p className="text-xs text-gray-400 mt-1">Transfer via UPI and enter your 12-digit UTR below for immediate confirmation.</p>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Official Merchant VPA</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(merchantVpa);
                        toast.success('Copied VPA to clipboard');
                      }}
                      className="text-neon-mint text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="font-mono font-bold text-sm text-white select-all">{merchantVpa}</div>
                </div>

                <div>
                  <label className="text-left block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    12-Digit Bank UTR / UPI Reference Number
                  </label>
                  <input
                    type="text"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="e.g. 428194018291"
                    maxLength={16}
                    className="w-full bg-deep-ocean border border-white/15 rounded-xl py-2.5 px-3 font-mono text-sm text-white focus:border-neon-mint outline-none"
                  />
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-neon-mint to-emerald-400 hover:from-emerald-400 hover:to-neon-mint text-deep-ocean font-black text-sm shadow-[0_0_20px_rgba(0,255,163,0.3)] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  VERIFY & CREDIT ₹{amount.toLocaleString('en-IN')}
                </button>

                <button
                  onClick={() => setStep('input')}
                  className="w-full py-2 text-xs text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel and Change Amount
                </button>
              </div>
            </motion.div>
          )}

          {step === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center space-y-4">
              <TransactionStatusAnimation status="PROCESSING" size="lg" />
              <div>
                <h2 className="text-xl font-black text-white">Authorizing Deposit</h2>
                <p className="text-xs text-gray-400 mt-1">Executing double-entry ledger settlement on PostgreSQL...</p>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-5">
              <TransactionStatusAnimation status="SUCCESS" size="lg" />
              <div>
                <h2 className="text-2xl font-black text-emerald-400">Deposit Reconciled & Credited!</h2>
                <p className="text-xs text-gray-300 mt-1">
                  ₹{amount.toLocaleString('en-IN')} has been credited to your authoritative wallet balance.
                </p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-xs space-y-2 text-left">
                <div className="flex justify-between text-gray-400">
                  <span>Transaction ID:</span>
                  <span className="text-neon-mint font-mono font-bold text-[11px]">{lastTxId}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Amount Credited:</span>
                  <span className="text-white font-bold">₹{amount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Authoritative Ledger:</span>
                  <span className="text-emerald-400 font-bold">RECONCILED</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href="/wallet" className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white font-bold text-xs rounded-xl text-center transition-all">
                  Go to Wallet
                </Link>
                <Link href="/" className="flex-1 py-3 bg-neon-mint hover:bg-emerald-400 text-deep-ocean font-black text-xs rounded-xl text-center shadow-[0_0_15px_rgba(0,255,163,0.3)] transition-all">
                  Play Games
                </Link>
              </div>
            </motion.div>
          )}

          {step === 'failed' && (
            <motion.div key="failed" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-12 text-center space-y-4">
              <TransactionStatusAnimation status="FAILED" size="lg" />
              <div>
                <h2 className="text-xl font-black text-rose-400">Payment Verification Failed</h2>
                <p className="text-xs text-rose-300 mt-1">{errorMessage}</p>
              </div>
              <button
                onClick={() => setStep('input')}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
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
