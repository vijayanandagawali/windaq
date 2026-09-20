"use client";

import React, { useState, useEffect } from 'react';
import { X, Smartphone, KeyRound, Sparkles, ShieldCheck, ArrowRight, Loader2, AlertCircle, Gift, UserCheck, Send } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { getApiUrl } from '@/lib/config';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    isLoading,
    error,
    login,
    register,
    loginAsGuest,
    closeAuthModal,
    clearError
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'GUEST'>(authModalMode);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Keep internal tab synchronized with store mode
  useEffect(() => {
    setActiveTab(authModalMode);
    clearError();
  }, [authModalMode, isAuthModalOpen, clearError]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setCountdown(30);
        toast.success(data.message || 'OTP sent to your mobile via SMS!');
      } else {
        toast.error(data.message || 'Could not send OTP.');
      }
    } catch {
      toast.error('Network error sending OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'GUEST') {
      await loginAsGuest();
      return;
    }

    if (activeTab === 'REGISTER') {
      await register(phone, referralCode);
    } else {
      if (!otp) {
        toast.error('Please enter the OTP sent to your phone.');
        return;
      }
      await login(phone, otp);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
      {/* Sleek, cleanly proportioned card with zero browser scrollbars */}
      <div 
        className="relative w-full max-w-md bg-[#0a0f1d] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-[0_20px_70px_rgba(0,0,0,0.9)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-neon-mint/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          data-testid="auth-close-btn"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors z-10 cursor-pointer"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-neon-mint via-emerald-400 to-blue-500 rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.3)] mb-2">
            <span className="font-black text-deep-ocean text-2xl">W</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">WINDAQ ACCESS</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeTab === 'GUEST'
              ? 'Instant sandbox session with test currency'
              : activeTab === 'REGISTER'
              ? 'Create your verified account & claim ₹500 welcome bonus'
              : 'Sign in with your mobile OTP to access your wallet'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-white/5 p-1 rounded-2xl border border-white/10 mb-5">
          <button
            type="button"
            data-testid="auth-tab-login"
            onClick={() => { setActiveTab('LOGIN'); clearError(); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'LOGIN'
                ? 'bg-neon-mint text-deep-ocean shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            LOGIN
          </button>
          <button
            type="button"
            data-testid="auth-tab-register"
            onClick={() => { setActiveTab('REGISTER'); clearError(); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'REGISTER'
                ? 'bg-neon-mint text-deep-ocean shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            REGISTER
          </button>
          <button
            type="button"
            data-testid="auth-tab-guest"
            onClick={() => { setActiveTab('GUEST'); clearError(); }}
            className={`py-2 text-xs font-black rounded-xl transition-all ${
              activeTab === 'GUEST'
                ? 'bg-amber-400 text-deep-ocean shadow-md'
                : 'text-yellow-400/80 hover:text-yellow-300'
            }`}
          >
            🧪 GUEST
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-red-300 animate-shake">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Guest Tab Content */}
        {activeTab === 'GUEST' ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/25 rounded-2xl">
              <div className="flex items-center gap-2 text-yellow-400 font-black text-xs uppercase mb-1">
                <Sparkles size={16} />
                <span>Sandbox Test Environment</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                Test the platform with a synthetic sandbox account. Automatically provisioned with{' '}
                <strong className="text-yellow-400">₹10,000 test credits</strong>. Zero SMS or real money required.
              </p>
            </div>

            <button
              onClick={() => loginAsGuest()}
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-deep-ocean font-black text-sm rounded-2xl shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>INITIALIZING SANDBOX...</span>
                </>
              ) : (
                <>
                  <UserCheck size={18} strokeWidth={2.5} />
                  <span>PLAY AS GUEST (₹10,000 CREDIT)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Login & Register Forms */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone Input */}
            <div>
              <label className="block text-[11px] font-black uppercase text-gray-400 mb-1.5">
                MOBILE NUMBER
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1.5 text-gray-400 font-bold text-xs pointer-events-none">
                  <Smartphone size={15} className="text-neon-mint" />
                  <span>+91</span>
                </div>
                <input
                  type="tel"
                  data-testid="auth-phone-input"
                  maxLength={10}
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/5 border border-white/15 focus:border-neon-mint rounded-2xl py-3 pl-16 pr-4 text-white font-mono text-sm tracking-wide outline-none transition-colors"
                />
              </div>
            </div>

            {/* Login: Real OTP Input with Send OTP Button */}
            {activeTab === 'LOGIN' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black uppercase text-gray-400">
                    VERIFICATION CODE (OTP)
                  </label>
                  <button
                    type="button"
                    disabled={sendingOtp || countdown > 0 || phone.length !== 10}
                    onClick={handleSendOtp}
                    className="text-[11px] font-bold text-neon-mint hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1 cursor-pointer"
                  >
                    {sendingOtp ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : countdown > 0 ? (
                      `Resend in ${countdown}s`
                    ) : (
                      <>
                        <Send size={11} />
                        <span>{otpSent ? 'Resend OTP' : 'Send OTP via SMS'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative flex items-center">
                  <KeyRound size={16} className="absolute left-3.5 text-neon-mint pointer-events-none" />
                  <input
                    type="text"
                    data-testid="auth-otp-input"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white/5 border border-white/15 focus:border-neon-mint rounded-2xl py-3 pl-10 pr-4 text-white font-mono text-sm tracking-widest outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Register: Referral Code & Welcome Bonus Badge */}
            {activeTab === 'REGISTER' && (
              <div>
                <label className="block text-[11px] font-black uppercase text-gray-400 mb-1.5">
                  REFERRAL CODE (OPTIONAL)
                </label>
                <div className="relative flex items-center">
                  <Gift size={16} className="absolute left-3.5 text-yellow-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="WIN500 (Optional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full bg-white/5 border border-white/15 focus:border-neon-mint rounded-2xl py-3 pl-10 pr-4 text-white font-mono text-xs uppercase outline-none transition-colors"
                  />
                </div>
                <div className="mt-2.5 p-2.5 bg-neon-mint/10 border border-neon-mint/20 rounded-xl flex items-center gap-2 text-[11px] text-neon-mint font-bold">
                  <Sparkles size={14} className="shrink-0" />
                  <span>₹500 instant welcome bonus credited upon signup!</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={isLoading || phone.length < 10}
              className="w-full py-3.5 bg-neon-mint text-deep-ocean font-black text-sm rounded-2xl shadow-[0_0_20px_rgba(0,255,163,0.35)] hover:bg-[#1ed49c] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>VERIFYING...</span>
                </>
              ) : (
                <>
                  <span>{activeTab === 'REGISTER' ? 'CREATE ACCOUNT & CLAIM ₹500' : 'SECURE SIGN IN'}</span>
                  <ArrowRight size={16} strokeWidth={3} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer */}
        <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <ShieldCheck size={13} className="text-neon-mint" />
          <span>256-Bit Encrypted • Fast2SMS Verified OTP</span>
        </div>
      </div>
    </div>
  );
}
