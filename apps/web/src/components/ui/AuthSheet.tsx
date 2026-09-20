"use client";

import React, { useState } from 'react';
import { ShieldCheck, X, Phone, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStore } from '@/store/walletStore';
import toast from 'react-hot-toast';

export default function AuthSheet({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpVal, setOtpVal] = useState('');
  const { setIsLoggedIn } = useWalletStore();
  
  const handleGetOTP = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
      toast.success('OTP sent successfully to +91 XXXXX');
      
      // Simulate auto-fill OTP after 1 second for production UX feel
      setTimeout(() => setOtpVal('1234'), 1000);
    }, 1500);
  };
  
  const handleLogin = () => {
    if (otpVal.length < 4) {
      toast.error('Please enter 4-digit OTP');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsLoggedIn(true);
      toast.success('Login Successful!');
      onClose();
    }, 1500);
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[101] glass-card bg-ocean-card/95 border-b-0 rounded-b-none p-6 pt-2 pb-10"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Welcome to WinDaq</h2>
                <p className="text-gray-400 text-sm">Login or register to continue</p>
              </div>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400">
                <X size={20} />
              </button>
            </div>

            {step === 'phone' ? (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={18} className="text-gray-400" />
                  </div>
                  <input 
                    type="tel" 
                    placeholder="Mobile Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-mint focus:ring-1 focus:ring-neon-mint transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm font-medium">+91</span>
                  </div>
                </div>
                <button 
                  onClick={handleGetOTP}
                  disabled={loading}
                  className="w-full btn-neon py-3.5 text-lg flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-deep-ocean border-t-transparent rounded-full animate-spin" /> : 'Get OTP'}
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound size={18} className="text-gray-400" />
                  </div>
                  <input 
                    type="number" 
                    placeholder="Enter 4-digit OTP" 
                    value={otpVal}
                    onChange={(e) => setOtpVal(e.target.value.slice(0, 4))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-mint focus:ring-1 focus:ring-neon-mint transition-all text-center tracking-widest text-lg"
                  />
                </div>
                <button 
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full btn-neon py-3.5 text-lg shadow-[0_0_15px_rgba(0,255,163,0.4)] flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-deep-ocean border-t-transparent rounded-full animate-spin" /> : 'Verify & Login'}
                </button>
                <button 
                  onClick={() => setStep('phone')}
                  className="w-full text-center mt-4 text-sm text-gray-400 hover:text-white"
                >
                  Change Number
                </button>
              </motion.div>
            )}

            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={14} className="text-green-500" />
              <span>Secured Connections</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
