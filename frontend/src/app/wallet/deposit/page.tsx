"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Wallet, ShieldCheck, CheckCircle2, Copy } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { motion, AnimatePresence } from 'framer-motion';

const CHIPS = [100, 500, 1000, 5000, 10000];
const GATEWAYS = [
  { id: 'upi', name: 'UPI Auto', icon: 'UPI', bonus: '200% Bonus' },
  { id: 'gpay', name: 'Google Pay', icon: 'GPay', bonus: '100% Bonus' },
  { id: 'phonepe', name: 'PhonePe', icon: 'Pe', bonus: '' },
  { id: 'imps', name: 'Bank IMPS', icon: 'Bank', bonus: '' },
];

export default function DepositScreen() {
  const router = useRouter();
  const { setBalance } = useWalletStore();
  
  const [amount, setAmount] = useState<number>(500);
  const [selectedGateway, setSelectedGateway] = useState('upi');
  const [step, setStep] = useState<'input' | 'intent' | 'success'>('input');

  const handleDeposit = () => {
    setStep('intent');
    // Simulate payment gateway delay
    setTimeout(() => {
      setStep('success');
      setBalance(500); // Simulate setting balance
      // In real life this would be a webhook pinging the WS/Redux state
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-deep-ocean font-sans selection:bg-neon-mint selection:text-deep-ocean relative overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card rounded-none border-t-0 border-x-0 px-4 py-4 flex items-center justify-center">
        <Link href="/wallet" className="absolute left-4 p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} className="text-white" />
        </Link>
        <h1 className="text-lg font-bold text-white">Deposit Cash</h1>
      </header>

      <div className="px-4 pt-6 pb-24">
        
        {step === 'input' && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="glass-card p-6 mb-6">
              <p className="text-gray-400 text-sm font-medium mb-2 text-center">Enter Deposit Amount</p>
              <div className="flex items-center justify-center gap-1 mb-6">
                <span className="text-gray-400 text-3xl font-light">₹</span>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="bg-transparent text-5xl font-extrabold text-white w-48 text-center focus:outline-none placeholder-gray-600"
                  placeholder="0"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-2">
                {CHIPS.slice(0, 3).map(chip => (
                  <button 
                    key={chip}
                    onClick={() => setAmount(chip)}
                    className={`py-2 rounded-lg font-bold text-sm transition-all border ${amount === chip ? 'bg-neon-mint/20 border-neon-mint text-neon-mint' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                  >
                    +₹{chip}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CHIPS.slice(3).map(chip => (
                  <button 
                    key={chip}
                    onClick={() => setAmount(chip)}
                    className={`py-2 rounded-lg font-bold text-sm transition-all border ${amount === chip ? 'bg-neon-mint/20 border-neon-mint text-neon-mint' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                  >
                    +₹{chip.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Wallet size={18} className="text-neon-mint" />
              Select Payment Method
            </h3>
            
            <div className="grid gap-3 mb-8">
              {GATEWAYS.map(gateway => (
                <div 
                  key={gateway.id}
                  onClick={() => setSelectedGateway(gateway.id)}
                  className={`glass-card p-4 rounded-xl flex items-center justify-between cursor-pointer border-2 transition-colors ${selectedGateway === gateway.id ? 'border-neon-mint bg-neon-mint/5' : 'border-transparent hover:border-white/10'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black text-white text-xs">
                      {gateway.icon}
                    </div>
                    <div>
                      <p className="text-white font-bold">{gateway.name}</p>
                      {gateway.bonus && <p className="text-neon-mint text-[10px] font-bold uppercase tracking-wide">{gateway.bonus}</p>}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedGateway === gateway.id ? 'border-neon-mint' : 'border-gray-500'}`}>
                    {selectedGateway === gateway.id && <div className="w-2.5 h-2.5 bg-neon-mint rounded-full" />}
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleDeposit}
              className="w-full btn-neon py-4 text-lg"
            >
              Deposit ₹{amount}
            </button>
            
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={14} className="text-green-500" />
              <span>100% Safe & Secure | 256-bit SSL</span>
            </div>
          </motion.div>
        )}

        {step === 'intent' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 relative mb-8">
              <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-neon-mint rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Processing Payment</h2>
            <p className="text-gray-400 text-center text-sm px-8">Please complete the payment on your {GATEWAYS.find(g => g.id === selectedGateway)?.name} app. Do not press back or close this screen.</p>
            
            <div className="mt-12 glass-card p-4 w-full flex items-center justify-between">
               <div>
                  <p className="text-gray-500 text-xs mb-1">Pay to UPI ID</p>
                  <p className="text-white font-bold">windaqpay@icici</p>
               </div>
               <button className="p-2 bg-white/10 rounded-lg text-neon-mint hover:bg-white/20 transition-colors">
                 <Copy size={18} />
               </button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center relative">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neon-mint/30 via-transparent to-transparent opacity-60"></div>
            
            <CheckCircle2 size={80} className="text-neon-mint mb-6 drop-shadow-[0_0_15px_rgba(0,255,163,0.8)]" />
            <h2 className="text-3xl font-extrabold text-white mb-2">Deposit Successful!</h2>
            <p className="text-gray-400 mb-8">₹{amount} has been added to your WinDaq wallet.</p>
            
            <Link href="/lobby" className="btn-neon px-12 py-4 rounded-xl text-lg w-full">
              Play Now
            </Link>
          </motion.div>
        )}

      </div>
    </main>
  );
}
