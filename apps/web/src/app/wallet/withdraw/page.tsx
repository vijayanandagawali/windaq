"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Landmark, IndianRupee, Clock, ShieldCheck, AlertCircle, FileCheck2, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion } from 'framer-motion';

export default function WithdrawScreen() {
  const router = useRouter();
  const { balance, deductBalance } = useWalletStore();
  
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'bank' | 'upi'>('upi');
  const [step, setStep] = useState<'kyc' | 'input' | 'tracker'>('kyc'); // Assuming they haven't verified yet for the demo
  const [status, setStatus] = useState<'pending' | 'processing' | 'approved'>('pending');

  const handleWithdraw = () => {
    if (Number(amount) < 500) {
      alert("Minimum withdrawal is ₹500");
      return;
    }
    if (Number(amount) > balance) {
      alert("Insufficient balance");
      return;
    }
    
    deductBalance(Number(amount));
    setStep('tracker');
    
    // Simulate tracker flow
    setTimeout(() => setStatus('processing'), 2000);
    setTimeout(() => setStatus('approved'), 5000);
  };

  return (
    <main className="min-h-screen bg-deep-ocean font-sans selection:bg-neon-mint selection:text-deep-ocean relative overflow-x-hidden">
      {/* Page Title Banner */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <h1 className="text-base font-extrabold text-white">Withdraw Winnings</h1>
      </div>

      <div className="px-4 pt-6 pb-24">
        
        {step === 'kyc' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-10">
            <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 relative">
              <FileCheck2 size={48} className="text-blue-400" />
              <div className="absolute -bottom-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-deep-ocean">
                REQUIRED
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">KYC Verification Required</h2>
            <p className="text-gray-400 text-center text-sm mb-8 px-4">
              As per RBI guidelines, you must complete your KYC to withdraw winnings to your bank account.
            </p>
            
            <div className="glass-card w-full p-4 mb-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">PAN</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">PAN Card</p>
                    <p className="text-gray-500 text-xs">Verify your identity</p>
                  </div>
                </div>
                <button className="text-neon-mint text-sm font-bold bg-neon-mint/10 px-3 py-1.5 rounded-lg">Verify</button>
              </div>
              <div className="border-t border-white/5"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <Landmark size={18} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Bank Account</p>
                    <p className="text-gray-500 text-xs">Where you get paid</p>
                  </div>
                </div>
                <button className="text-neon-mint text-sm font-bold bg-neon-mint/10 px-3 py-1.5 rounded-lg">Add</button>
              </div>
            </div>

            <button 
              onClick={() => setStep('input')} 
              className="w-full btn-neon py-4 text-lg"
            >
              Skip Demo KYC
            </button>
          </motion.div>
        )}

        {step === 'input' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="glass-card bg-gradient-to-br from-ocean-card to-blue-900/40 p-5 mb-6 flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs font-medium mb-1">Withdrawable Balance</p>
                <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-1">
                  <span className="text-neon-mint text-2xl">₹</span>
                  {balance.toFixed(2)}
                </h2>
              </div>
              <ShieldCheck size={40} className="text-green-500/20" />
            </div>

            <div className="mb-6">
              <label className="text-gray-400 text-sm font-bold block mb-2 pl-1">Withdrawal Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <IndianRupee size={20} className="text-neon-mint" />
                </div>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-4 pl-12 pr-20 text-white font-bold text-xl placeholder-gray-600 focus:outline-none focus:border-neon-mint focus:ring-1 focus:ring-neon-mint transition-all"
                  placeholder="0"
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                  <button 
                    onClick={() => setAmount(balance.toString())}
                    className="text-neon-mint text-xs font-bold uppercase bg-neon-mint/10 px-3 py-1.5 rounded-lg"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <p className="text-gray-500 text-[11px] mt-2 pl-1 flex items-center gap-1">
                <AlertCircle size={12} /> Minimum withdrawal is ₹500
              </p>
            </div>

            <h3 className="text-white font-bold mb-3 pl-1">Transfer To</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div 
                onClick={() => setMethod('upi')}
                className={`glass-card p-4 rounded-xl cursor-pointer border-2 transition-colors flex flex-col items-center justify-center gap-2 ${method === 'upi' ? 'border-neon-mint bg-neon-mint/5' : 'border-transparent hover:border-white/10'}`}
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center font-black text-white">UPI</div>
                <p className="text-white font-bold text-sm">UPI ID</p>
              </div>
              <div 
                onClick={() => setMethod('bank')}
                className={`glass-card p-4 rounded-xl cursor-pointer border-2 transition-colors flex flex-col items-center justify-center gap-2 ${method === 'bank' ? 'border-neon-mint bg-neon-mint/5' : 'border-transparent hover:border-white/10'}`}
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><Landmark size={24} className="text-gray-300" /></div>
                <p className="text-white font-bold text-sm">Bank Transfer</p>
              </div>
            </div>

            <button 
              onClick={handleWithdraw}
              className={`w-full btn-neon py-4 text-lg ${(!amount || Number(amount) < 500 || Number(amount) > balance) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
            >
              Withdraw ₹{amount || '0'}
            </button>
          </motion.div>
        )}

        {step === 'tracker' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
             <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                <Clock size={40} className="text-white opacity-50" />
             </div>
             
             <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1 mb-1">
                <span className="text-neon-mint text-2xl">₹</span>
                {amount}
              </h2>
             <p className="text-gray-400 text-sm mb-10">Withdrawal Initiated</p>

             <div className="glass-card text-left p-6 relative before:absolute before:inset-y-10 before:left-[35px] before:w-[2px] before:bg-white/10">
                
                {/* Step 1 */}
                <div className="flex gap-4 mb-8 relative z-10">
                  <div className="w-6 h-6 rounded-full bg-neon-mint flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,255,163,0.5)]">
                    <CheckCircle2 size={14} className="text-deep-ocean" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Request Received</h4>
                    <p className="text-gray-500 text-xs mt-1">Just now</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4 mb-8 relative z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${status === 'processing' || status === 'approved' ? 'bg-neon-mint shadow-[0_0_10px_rgba(0,255,163,0.5)]' : 'bg-ocean-card border-2 border-white/20'}`}>
                    {status === 'processing' || status === 'approved' ? <CheckCircle2 size={14} className="text-deep-ocean" /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm transition-colors ${status === 'processing' || status === 'approved' ? 'text-white' : 'text-gray-500'}`}>Processing</h4>
                    <p className="text-gray-500 text-xs mt-1">Checking for fair play and fraud.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4 relative z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${status === 'approved' ? 'bg-neon-mint shadow-[0_0_10px_rgba(0,255,163,0.5)]' : 'bg-ocean-card border-2 border-white/20'}`}>
                    {status === 'approved' ? <CheckCircle2 size={14} className="text-deep-ocean" /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm transition-colors ${status === 'approved' ? 'text-white' : 'text-gray-500'}`}>Approved & Transferred</h4>
                    <p className="text-gray-500 text-xs mt-1">Money sent to your {method.toUpperCase()} account.</p>
                  </div>
                </div>

             </div>

             {status === 'approved' && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-8">
                  <Link href="/wallet" className="btn-neon px-8 py-3 rounded-xl inline-block w-full">
                    Return to Wallet
                  </Link>
                </motion.div>
             )}
          </motion.div>
        )}

      </div>
    </main>
  );
}
